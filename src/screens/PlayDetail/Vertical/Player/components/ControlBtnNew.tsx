import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
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
import { scaleSizeW } from '@/utils/pixelRatio'

const ControlBtnNew = () => {
  const theme = useTheme()
  const winSize = useWindowSize()
  const isPlay = useIsPlay()
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const t = useI18n()

  const { size, extraBtnSize, paddingV } = useMemo(() => {
    const containerWidth = winSize.width
    const maxPlayBtn = containerWidth * 0.18
    const minPlayBtn = scaleSizeW(36)
    const mainBtn = Math.min(Math.max(maxPlayBtn, minPlayBtn), scaleSizeW(72))
    const sideBtn = Math.round(mainBtn * 0.6)
    const pV = Math.round(winSize.height * 0.025)
    return { size: mainBtn, extraBtnSize: sideBtn, paddingV: Math.max(pV, 12) }
  }, [winSize.width, winSize.height])

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

  const iconSize = Math.round(size * 0.45)
  const sideIconSize = Math.round(extraBtnSize * 0.55)

  return (
    <View style={[styles.newContainer, { paddingVertical: paddingV }]}>
      <TouchableOpacity
        style={[styles.controlBtn, { width: extraBtnSize, height: extraBtnSize }]}
        activeOpacity={0.5}
        onPress={toggleNextPlayMode}
      >
        {playModeIcon?.startsWith('svg:') ? (
          <SvgIcon name={playModeIcon.slice(4)} rawSize={sideIconSize} color={iconColor} />
        ) : (
          <Icon name={playModeIcon} color={iconColor} rawSize={sideIconSize} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlBtn, { width: size, height: size }]}
        activeOpacity={0.5}
        onPress={() => void playPrev()}
      >
        <Icon name="prevMusic" color={iconColor} rawSize={iconSize} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlBtn, { width: size, height: size }]}
        activeOpacity={0.5}
        onPress={togglePlay}
      >
        <Icon name={isPlay ? 'pause' : 'play'} color={iconColor} rawSize={iconSize} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlBtn, { width: size, height: size }]}
        activeOpacity={0.5}
        onPress={() => void playNext()}
      >
        <Icon name="nextMusic" color={iconColor} rawSize={iconSize} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlBtn, { width: extraBtnSize, height: extraBtnSize }]}
        activeOpacity={0.5}
        onPress={handleShowPlaylist}
      >
        <Icon name="menu" color={iconColor} rawSize={sideIconSize} />
      </TouchableOpacity>
    </View>
  )
}

export default ControlBtnNew

const styles = createStyle({
  controlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
  newContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '3%',
  },
})
