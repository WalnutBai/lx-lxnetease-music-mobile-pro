import { memo, useRef, useCallback, useMemo, useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { pop, navigations } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import Text from '@/components/common/Text'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import { useStatusbarHeight } from '@/store/common/hook'
import Btn from './Btn'
import TimeoutExitBtn from './TimeoutExitBtn'
import Marquee from './Marquee'
import StatusBar from '@/components/common/StatusBar'
import { handleShare } from '@/screens/Home/Views/Mylist/MusicList/listAction'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

const Title = () => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()
  const musicInfo = playMusicInfo.musicInfo ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo) : null

  const handleArtistPress = useCallback((artist: { id: string | number, name: string }) => {
    if (!musicInfo || musicInfo.source !== 'wy' || !artist.id) return
    navigations.pushArtistDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(artist.id), name: artist.name })
  }, [musicInfo])

  const handleAlbumPress = useCallback(() => {
    if (!musicInfo || musicInfo.source !== 'wy' || !(musicInfo.meta as any).albumId) return
    navigations.pushAlbumDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String((musicInfo.meta as any).albumId), name: musicInfo.meta.albumName, source: musicInfo.source })
  }, [musicInfo])

  const singerRender = useMemo(() => {
    if (!musicInfo) return null
    const albumName = musicInfo.meta?.albumName
    const albumId = (musicInfo.meta as any)?.albumId

    if (!musicInfo.artists?.length || musicInfo.source == 'local') {
      return (
        <View style={styles.singerContainer}>
          <Text numberOfLines={1} size={12} color={theme['c-font']}>
            {musicInfo.singer}
          </Text>
          {albumName ? (
            <TouchableOpacity style={{ flexShrink: 1 }} onPress={handleAlbumPress} disabled={musicInfo.source !== 'wy' || !albumId}>
              <Text numberOfLines={1} size={12} color={theme['c-font']}>
                {` · ${albumName}`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )
    }

    return (
      <View style={styles.singerContainer}>
        {musicInfo.artists.map((artist, index) => (
          <TouchableOpacity key={artist.id || index} onPress={() => handleArtistPress(artist)}>
            <Text style={styles.singerText} size={12} color={theme['c-font']}>
              {artist.name}
              {(musicInfo.artists?.length ?? 0) > 0 && index < (musicInfo.artists?.length ?? 0) - 1 ? ' / ' : ''}
            </Text>
          </TouchableOpacity>
        ))}
        {albumName ? (
          <TouchableOpacity style={{ flexShrink: 1 }} onPress={handleAlbumPress} disabled={musicInfo.source !== 'wy' || !albumId}>
            <Text numberOfLines={1} size={12} color={theme['c-font']}>
              {` · ${albumName}`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    )
  }, [musicInfo, theme, handleArtistPress, handleAlbumPress])

  return (
    <View style={styles.titleContent}>
      {musicInfo ? (
        <>
          <Marquee style={styles.title} size={16}>
            {musicInfo.name}
            {musicInfo.alias ? <Text color={theme['c-font-label']}> ({musicInfo.alias})</Text> : null}
          </Marquee>
          {singerRender}
        </>
      ) : null}
    </View>
  )
}

const AnimatedIndicatorDot = ({ isActive }: { isActive: boolean }) => {
  const animatedWidth = useRef(new Animated.Value(isActive ? 16 : 6)).current
  const animatedOpacity = useRef(new Animated.Value(isActive ? 1 : 0.5)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedWidth, {
        toValue: isActive ? 16 : 6,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }),
      Animated.spring(animatedOpacity, {
        toValue: isActive ? 1 : 0.5,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }),
    ]).start()
  }, [isActive])

  return (
    <Animated.View
      style={{
        width: animatedWidth,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#000',
        opacity: animatedOpacity,
      }}
    />
  )
}

export default memo(({ isNewUI, pageIndex }: { isNewUI: boolean; pageIndex?: number }) => {
  const popupRef = useRef<SettingPopupType>(null)
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()
  const back = () => {
    void pop(commonState.componentIds[commonState.componentIds.length - 1]?.id!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const activeIndex = pageIndex ?? 0

  const handleShare = useCallback(() => {
    const info = playerState.playMusicInfo.musicInfo
    if (!info) return
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    handleShare(musicInfo)
  }, [])

  return (
    <View
      style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}
    >
      <StatusBar />
      {isNewUI ? (
        <View style={styles.containerNew}>
          <View style={styles.leftArea}>
            <Icon name="chevron-left" color={iconColor} size={24} onPress={back} />
          </View>
          <View style={styles.centerArea}>
            <View style={styles.pageIndicator}>
              <AnimatedIndicatorDot isActive={activeIndex === 0} />
              <AnimatedIndicatorDot isActive={activeIndex === 1} />
            </View>
          </View>
          <View style={styles.rightArea}>
            <Icon name="music_time" color={iconColor} size={22} />
            <Icon name="slider" color={iconColor} size={22} onPress={showSetting} />
          </View>
        </View>
      ) : (
        <View style={styles.containerOld}>
          <Btn icon="chevron-left" onPress={back} />
          <Title />
          <TimeoutExitBtn />
          <Btn icon="slider" onPress={showSetting} />
        </View>
      )}
      <SettingPopup ref={popupRef} direction="vertical" />
    </View>
  )
})

const styles = StyleSheet.create({
  containerOld: {
    flexDirection: 'row',
    height: '100%',
  },
  containerNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 10,
  },
  leftArea: {
    width: scaleSizeW(60),
    alignItems: 'flex-start',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    width: scaleSizeW(60),
    justifyContent: 'flex-end',
  },
  titleContent: {
    flex: 1,
    paddingHorizontal: 5,
    justifyContent: 'center',
  },
  title: {},
  singerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  singerText: {
    paddingRight: 2,
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})