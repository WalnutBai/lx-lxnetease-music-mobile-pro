import { memo, useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { View, Animated, Easing, TouchableWithoutFeedback, Platform } from 'react-native';
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook';
import { useWindowSize } from '@/utils/hooks';
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant';
import { HEADER_HEIGHT } from './components/Header';
import Image from '@/components/common/Image';
import { useStatusbarHeight } from '@/store/common/hook';
import { useSettingValue } from '@/store/setting/hook';
import { createStyle, toast, requestStoragePermission } from '@/utils/tools';
import Menu, { type MenuType, type Menus } from '@/components/common/Menu';
import { addTask } from '@/core/download';
import RNFetchBlob from 'rn-fetch-blob';
import { getPicUrl } from '@/core/music/online';
import { getFileExtensionFromUrl } from '@/screens/Home/Views/Mylist/MusicList/download/utils';
import settingState from '@/store/setting/state';

export default memo(({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayMusicInfo();
  const { width: winWidth, height: winHeight } = useWindowSize();
  const statusBarHeight = useStatusbarHeight();
  const isPlay = useIsPlay();
  const isCoverSpin = useSettingValue('playDetail.isCoverSpin');
  const coverSizeRaw = useSettingValue('playDetail.style.coverSize');
  const coverSize = typeof coverSizeRaw === 'number' && !isNaN(coverSizeRaw) ? coverSizeRaw : 100;
  const isNewUI = useSettingValue('playDetail.style.newUI');
  const spinValue = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isAnimating = useRef(false);
  const menuRef = useRef<MenuType>(null);
  const coverRef = useRef<View>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const shouldForceLayerComposition = Platform.OS === 'android' && global.lx.isCarMode && isCoverSpin;
  const isUnmounted = useRef(false);

  const createAnimation = useCallback((value: number) => {
    return Animated.timing(spinValue, {
      toValue: 1,
      duration: 25000 * (1 - value),
      easing: Easing.linear,
      useNativeDriver: true,
    });
  }, [spinValue]);

  const startAnimation = useCallback(() => {
    if (isAnimating.current || !isCoverSpin || isUnmounted.current) return;
    isAnimating.current = true;
    spinValue.stopAnimation(value => {
      if (isUnmounted.current) return;
      animationRef.current = createAnimation(value);
      animationRef.current.start(({ finished }) => {
        if (finished && isAnimating.current && !isUnmounted.current) {
          spinValue.setValue(0);
          isAnimating.current = false;
          startAnimation();
        }
      });
    });
  }, [spinValue, createAnimation, isCoverSpin]);

  const stopAnimation = useCallback(() => {
    if (!isAnimating.current) return;
    isAnimating.current = false;
    animationRef.current?.stop();
    animationRef.current = null;
    spinValue.stopAnimation();
  }, [spinValue]);

  useEffect(() => {
    if (isPlay && isCoverSpin) {
      startAnimation();
    } else {
      stopAnimation();
      if (!isCoverSpin) {
        spinValue.setValue(0);
      }
    }
  }, [isPlay, isCoverSpin, startAnimation, stopAnimation, spinValue]);

  useEffect(() => {
    stopAnimation();
    spinValue.setValue(0);
    if (isPlay && isCoverSpin) {
      startAnimation();
    }
  }, [musicInfo.musicInfo?.id, isCoverSpin, startAnimation, stopAnimation, spinValue]);

  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      stopAnimation();
    };
  }, [stopAnimation]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const imageContainerStyle = useMemo(() => {
    const baseWidth = isNewUI 
      ? Math.min(winWidth * 0.75, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.45)
      : Math.min(winWidth * 0.85, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.5);
    const imgWidth = baseWidth * (coverSize / 100);
    const radius = isCoverSpin ? imgWidth / 2 : 4;
    return {
      width: imgWidth,
      height: imgWidth,
      borderRadius: radius,
      elevation: 3,
      opacity: 1,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    };
  }, [statusBarHeight, winHeight, winWidth, isCoverSpin, coverSize, isNewUI]);

  const imageStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    borderRadius: imageContainerStyle.borderRadius,
  } as any), [imageContainerStyle.borderRadius]);

  const animatedCoverStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden' as const,
    transform: [{ rotate: spin }],
    borderRadius: imageContainerStyle.borderRadius,
  } as any), [spin, imageContainerStyle.borderRadius]);

  const menus = useMemo((): Menus => [
    { action: 'download_song', label: '下载歌曲' },
    { action: 'download_pic', label: '下载封面' },
  ], []);

  const handleLongPress = () => {
    if (!coverRef.current) return;
    coverRef.current.measure((x, y, w, h, px, py) => {
      setMenuVisible(true);
      requestAnimationFrame(() => {
        menuRef.current?.show({ x: px, y: py, w, h });
      });
    });
  };

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    switch (action) {
      case 'download_song':
        if (musicInfo.musicInfo) {
          const quality = settingState.setting['player.playQuality'];
          addTask(musicInfo.musicInfo as LX.Music.MusicInfo, quality);
        }
        break;
      case 'download_pic':
        if (musicInfo.musicInfo) {
          void (async () => {
            try {
              const isGranted = await requestStoragePermission();
              if (isGranted === false) {
                toast('没有存储权限，无法下载', 'short');
                return;
              }

              toast('正在下载封面...', 'short');
              const picUrl = await getPicUrl({ musicInfo: musicInfo.musicInfo as LX.Music.MusicInfoOnline, isRefresh: true });
              const extension = getFileExtensionFromUrl(picUrl);
              const picBaseDir = RNFetchBlob.fs.dirs.PictureDir || RNFetchBlob.fs.dirs.DownloadDir;
              const downloadDir = `${picBaseDir}/LX-N-Music`;
              const mInfo = musicInfo.musicInfo as LX.Music.MusicInfo;
              const fileName = `${mInfo.name}_${mInfo.singer}.${extension}`.replace(/[\\/:*?"<>|]/g, '_');
              const filePath = `${downloadDir}/${fileName}`;

              const exists = await RNFetchBlob.fs.exists(downloadDir);
              if (!exists) {
                try {
                  await RNFetchBlob.fs.mkdir(downloadDir);
                } catch (e) {
                  console.warn('mkdir failed');
                }
              }

              const targetPath = (await RNFetchBlob.fs.exists(downloadDir)) ? filePath : `${picBaseDir}/${fileName}`;

              await RNFetchBlob.config({ path: targetPath }).fetch('GET', picUrl);
              await RNFetchBlob.fs.scanFile([{ path: targetPath }]);
              toast(`封面已保存到: ${targetPath}`, 'long');
            } catch (err: any) {
              toast(`下载封面失败: ${err.message}`, 'long');
            }
          })();
        }
        break;
    }
  };

  return (
    <View style={[styles.container, isNewUI ? styles.containerNew : {}]}>
      <TouchableWithoutFeedback onLongPress={handleLongPress}>
        <View
          ref={coverRef}
          collapsable={false}
          style={[styles.content, imageContainerStyle, { overflow: 'hidden' }]}
          renderToHardwareTextureAndroid={shouldForceLayerComposition}
          needsOffscreenAlphaCompositing={shouldForceLayerComposition}
        >
          <Animated.View
            style={animatedCoverStyle}
            renderToHardwareTextureAndroid={shouldForceLayerComposition}
            needsOffscreenAlphaCompositing={shouldForceLayerComposition}
          >
            <Image
              url={(musicInfo.musicInfo as LX.Music.MusicInfo)?.meta?.picUrl}
              nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
              style={imageStyle}
            />
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
      {menuVisible && <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} onHide={() => setMenuVisible(false)} />}
    </View>
  );
});

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: '3%',
  },
  containerNew: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 30,
    paddingBottom: 5,
  },
  content: {
    backgroundColor: 'rgba(0,0,0,0)',
  },
});