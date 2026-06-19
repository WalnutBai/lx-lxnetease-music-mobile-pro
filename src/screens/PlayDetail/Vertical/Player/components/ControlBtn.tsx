import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeW } from '@/utils/pixelRatio'
import { BTN_WIDTH } from './MoreBtn/Btn'
import { useMemo } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import { MUSIC_TOGGLE_MODE_LIST, MUSIC_TOGGLE_MODE } from '@/config/constant'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import userState from '@/store/user/state'
import playerState from '@/store/player/state'
import wyApi from '@/utils/musicSdk/wy'
import { playOnlineList } from '@/core/list'
import settingState from '@/store/setting/state'
import { SvgIcon } from '@/components/common/SvgIcon'

const PREV_NEXT_SIZE_RATIO = 0.45
const PLAY_BTN_SIZE_RATIO = 0.9
const EXTRA_BTN_SIZE_RATIO = 0.8

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  return (
    <TouchableOpacity
      style={{ ...styles.oldControlBtn, width: size, height: size }}
      activeOpacity={0.5}
      onPress={() => void playPrev()}
    >
      <Icon name="prevMusic" color={activeColor} rawSize={size * 0.7} />
    </TouchableOpacity>
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  return (
    <TouchableOpacity
      style={{ ...styles.oldControlBtn, width: size, height: size }}
      activeOpacity={0.5}
      onPress={() => void playNext()}
    >
      <Icon name="nextMusic" color={activeColor} rawSize={size * 0.7} />
    </TouchableOpacity>
  )
}
const TogglePlayBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const isPlay = useIsPlay()
  return (
    <TouchableOpacity
      style={{ ...styles.oldControlBtn, width: size, height: size }}
      activeOpacity={0.5}
      onPress={togglePlay}
    >
      <Icon name={isPlay ? 'pause' : 'play'} color={activeColor} rawSize={size * 0.7} />
    </TouchableOpacity>
  )
}

const MAX_SIZE = BTN_WIDTH * 1.6
const MIN_SIZE = BTN_WIDTH * 1.2

export default ({ isNewUI }: { isNewUI: boolean }) => {
  const theme = useTheme()
  const winSize = useWindowSize()
  const isPlay = useIsPlay()
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const t = useI18n()

  const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
  const size = Math.min(
    Math.max(winSize.width * 0.33 * global.lx.fontSize * 0.4, MIN_SIZE),
    MAX_SIZE,
    maxHeight
  )

  const toggleNextPlayMode = async () => {
    let list = [...MUSIC_TOGGLE_MODE_LIST] as any[]

    const playMusicInfo = playerState.playMusicInfo.musicInfo
    const musicInfo = playMusicInfo
      ? ('progress' in playMusicInfo ? playMusicInfo.metadata.musicInfo : playMusicInfo)
      : null
    const isWy = musicInfo?.source === 'wy'
    const songId = (musicInfo as any)?.meta?.songId || (musicInfo as any)?.songmid || musicInfo?.id
    const isLiked = userState.wy_liked_song_ids.has(String(songId))
    const playlistId = userState.wy_subscribed_playlists[0]?.id

    if (isWy && isLiked && playlistId) {
      list.splice(list.length - 1, 0, MUSIC_TOGGLE_MODE.heartbeat)
    }

    let index = list.indexOf(togglePlayMethod)
    if (++index >= list.length) index = 0
    const mode = list[index]
    updateSetting({ 'player.togglePlayMethod': mode })

    if (mode === MUSIC_TOGGLE_MODE.heartbeat) {
      toast(t('play_heartbeat') || '心动模式已开启')
      try {
        const cookie = settingState.setting['common.wy_cookie']
        const res = await wyApi.dailyRec.getHeartbeatModeList(cookie, playlistId, songId)
        if (res?.list?.length) {
          const mInfo = playMusicInfo
            ? ('progress' in playMusicInfo ? playMusicInfo.metadata.musicInfo : playMusicInfo)
            : musicInfo
          const heartbeatList = [mInfo, ...res.list].filter(Boolean) as any[]
          const isCurrent = mInfo?.id === musicInfo?.id
          playOnlineList('heartbeat', heartbeatList, 0, isCurrent)
        } else {
          toast('心动模式获取歌曲为空')
        }
      } catch (err: any) {
        toast('心动模式加载失败')
      }
      return
    }

    let modeName:
      | 'play_list_loop'
      | 'play_list_random'
      | 'play_list_order'
      | 'play_single_loop'
      | 'play_single'
      | 'play_heartbeat'
    switch (mode) {
      case MUSIC_TOGGLE_MODE.listLoop:
        modeName = 'play_list_loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        modeName = 'play_list_random'
        break
      case MUSIC_TOGGLE_MODE.list:
        modeName = 'play_list_order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        modeName = 'play_single_loop'
        break
      case MUSIC_TOGGLE_MODE.heartbeat:
        modeName = 'play_heartbeat'
        break
      default:
        modeName = 'play_single'
        break
    }
    toast(t(modeName))
  }

  const playModeIcon = useMemo(() => {
    let playModeIcon = null
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        playModeIcon = 'list-loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        playModeIcon = 'list-random'
        break
      case MUSIC_TOGGLE_MODE.list:
        playModeIcon = 'list-order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        playModeIcon = 'single-loop'
        break
      case MUSIC_TOGGLE_MODE.heartbeat:
        playModeIcon = 'svg:heartbeat'
        break
      default:
        playModeIcon = 'single'
        break
    }
    return playModeIcon
  }, [togglePlayMethod])

  const handleShowPlaylist = () => {
    global.app_event.showPlaylist()
  }

  if (!isNewUI) {
    const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
    const containerStyle = useMemo(() => ({
      ...styles.oldContainer,
      maxHeight,
    }), [maxHeight])
    const size = Math.min(
      Math.max(winSize.width * 0.33 * global.lx.fontSize * 0.4, MIN_SIZE),
      MAX_SIZE,
      maxHeight
    )
    return (
      <View style={containerStyle}>
        <PrevBtn size={size} />
        <TogglePlayBtn size={size} />
        <NextBtn size={size} />
      </View>
    )
  }

  const containerHeight = Math.max(winSize.height * 0.14, 80)
  const playBtnSize = Math.min(winSize.width * PLAY_BTN_SIZE_RATIO, containerHeight * 0.75)
  const smallBtnSize = playBtnSize * PREV_NEXT_SIZE_RATIO
  const extraBtnSize = smallBtnSize * EXTRA_BTN_SIZE_RATIO

  return (
    <View style={[styles.newContainer, { height: containerHeight }]}>
      <TouchableOpacity
        style={[styles.oldControlBtn, { width: extraBtnSize, height: extraBtnSize, marginLeft: -15 }]}
        activeOpacity={0.5}
        onPress={toggleNextPlayMode}
      >
        {playModeIcon?.startsWith('svg:') ? (
          <SvgIcon name={playModeIcon.slice(4)} size={extraBtnSize * 0.7} color={iconColor} />
        ) : (
          <Icon name={playModeIcon} color={iconColor} size={extraBtnSize * 0.7} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.oldControlBtn, { width: size, height: size }]}
        activeOpacity={0.5}
        onPress={() => void playPrev()}
      >
        <Icon name="prevMusic" color={iconColor} size={size * 0.7} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.oldControlBtn, { width: size, height: size }]}
        activeOpacity={0.5}
        onPress={togglePlay}
      >
        <Icon name={isPlay ? 'pause' : 'play'} color={iconColor} size={size * 0.7} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.oldControlBtn, { width: size, height: size }]}
        activeOpacity={0.5}
        onPress={() => void playNext()}
      >
        <Icon name="nextMusic" color={iconColor} size={size * 0.7} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.oldControlBtn, { width: extraBtnSize, height: extraBtnSize, marginRight: -15 }]}
        activeOpacity={0.5}
        onPress={handleShowPlaylist}
      >
        <Icon name="menu" color={iconColor} size={extraBtnSize * 0.7} />
      </TouchableOpacity>
    </View>
  )
}

const styles = createStyle({
  oldContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '4%',
    paddingVertical: 22,
  },
  oldControlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
  newContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: '4%',
    paddingVertical: 22,
  },
  extraBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    marginHorizontal: scaleSizeW(12),
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
})