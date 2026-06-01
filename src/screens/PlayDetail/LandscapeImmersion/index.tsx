import { memo, useEffect, useRef, useMemo } from 'react'
import { View, BackHandler, StyleSheet, Image } from 'react-native'
import { Navigation } from 'react-native-navigation'
import { setIsLandscapeImmersion } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useBgPic } from '@/store/common/hook'
import { usePlayMusicInfo, usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { defaultHeaders } from '@/components/common/Image'
import settingState from '@/store/setting/state'
import Pic from './Pic'
import Lyric from './Lyric'
import Player from './Player'

export default memo(({ componentId }: { componentId: string }) => {
  const lastBackTime = useRef(0)
  const showControl = useSettingValue('playDetail.landscapeImmersion.showControl')
  const theme = useTheme()
  const windowSize = useWindowSize()
  const dynamicPic = useBgPic()
  const customBgPicPath = useSettingValue('theme.customBgPicPath')
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const pic = useMemo(() => {
    return customBgPicPath || dynamicPic || musicInfo.pic || (playMusicInfo.musicInfo ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo.pic : playMusicInfo.musicInfo.pic) : null)
  }, [customBgPicPath, dynamicPic, musicInfo.pic, playMusicInfo.musicInfo])
  const picOpacity = useSettingValue('theme.picOpacity')
  const blur = useSettingValue('theme.blur')

  useEffect(() => {
    // Hide status bar and lock orientation
    Navigation.mergeOptions(componentId, {
      statusBar: {
        visible: false,
        drawBehind: true,
      },
      navigationBar: {
        visible: false,
      },
      layout: {
        orientation: ['landscape'],
        componentBackgroundColor: 'transparent',
      },
      topBar: {
        visible: false,
        drawBehind: true,
      },
      window: {
        backgroundColor: 'transparent',
      },
    })
    screenkeepAwake()

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now()
      if (now - lastBackTime.current < 2000) {
        // Restore settings before switching state
        Navigation.mergeOptions(componentId, {
          statusBar: {
            visible: true,
            drawBehind: false,
          },
          navigationBar: {
            visible: !settingState.setting['common.hideNavigationBar'],
          },
          layout: {
            orientation: ['portrait'],
          },
        })
        setTimeout(() => {
          setIsLandscapeImmersion(false)
        }, 100)
        return true
      }
      lastBackTime.current = now
      toast('双击返回键退出横屏沉浸模式')
      return true
    })

    return () => {
      backHandler.remove()
      screenUnkeepAwake()
    }
  }, [componentId])

  const bgStyle = useMemo(() => {
    const isLandscape = windowSize.width > windowSize.height
    if (!isLandscape) return {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme['c-content-background'],
    }
    return {
      position: 'absolute',
      left: -(windowSize.width - windowSize.height) / 2,
      top: (windowSize.width - windowSize.height) / 2,
      width: windowSize.height,
      height: windowSize.width,
      transform: [{ rotate: '-90deg' }],
      backgroundColor: theme['c-content-background'],
    } as any
  }, [windowSize, theme])

  return (
    <View style={styles.container}>
      {/* Background Layer */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          style={bgStyle}
          source={pic ? { uri: pic, headers: defaultHeaders } : theme['bg-image']}
          resizeMode="cover"
          blurRadius={blur}
        />
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: theme['c-content-background'],
            opacity: pic ? picOpacity / 100 : 0.7, // 增加默认遮罩
          }}
        />
      </View>

      {/* Content Layer */}
      <View style={styles.left}>
        <Pic />
        {showControl && (
          <View style={styles.playerContainer}>
            <Player />
          </View>
        )}
      </View>
      <View style={styles.right}>
        <Lyric />
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  left: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  right: {
    flex: 1,
    position: 'relative',
  },
  playerContainer: {
    marginTop: 20,
    width: '100%',
  },
})
