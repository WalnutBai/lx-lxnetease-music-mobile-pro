import TrackPlayer, { State as TPState, Event as TPEvent } from 'react-native-track-player'
import { setMusicUrl } from '@/core/player/player'
import playerState from '@/store/player/state'
import { log } from '@/utils/log'
// import { store } from '@/store'
// import { action as playerAction, STATUS } from '@/store/modules/player'
import { isTempId, isEmpty } from './utils'
// import { play as lrcPlay, pause as lrcPause } from '@/core/lyric'
import { exitApp } from '@/core/common'
import { getCurrentTrackId } from './playList'
import { pause, play, playNext, playPrev } from '@/core/player/player'
import { showDesktopLyric, hideDesktopLyric } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { onWidgetPlayPause, onWidgetPrev, onWidgetNext } from '@/utils/nativeModules/musicWidget'
import { playerLog } from '@/utils/playerLog'
import { getAllKeys, removeDataMultiple, storageDataPrefix } from '@/plugins/storage'

let isInitialized = false

// let retryTrack: LX.Player.Track | null = null
// let retryGetUrlId: string | null = null
// let retryGetUrlNum = 0
// let errorTime = 0
// let prevDuration = 0
// let isPlaying = false

// 销毁播放器并退出
const handleExitApp = async (reason: string) => {
  global.lx.isPlayedStop = false
  exitApp(reason)
}

const registerPlaybackService = async () => {
  if (isInitialized) return

  console.log('reg services...')
  TrackPlayer.addEventListener(TPEvent.RemotePlay, () => {
    // console.log('remote-play')
    play()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePause, () => {
    // console.log('remote-pause')
    void pause()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteNext, () => {
    // console.log('remote-next')
    void playNext()
  })

  // SkipToPrevious -> Previous track (standard)
  TrackPlayer.addEventListener(TPEvent.RemotePrevious, () => {
    // console.log('remote-previous -> prev track')
    void playPrev()
  })

  // JumpBackward (Rewind slot) -> LRC toggle
  TrackPlayer.addEventListener(TPEvent.RemoteJumpBackward, () => {
    // console.log('remote-jump-backward -> toggle lyric')
    const isEnable = !settingState.setting['desktopLyric.enable']
    if (isEnable) {
      void showDesktopLyric().then(() => {
        updateSetting({ 'desktopLyric.enable': true })
      }).catch(() => { })
    } else {
      void hideDesktopLyric().then(() => {
        updateSetting({ 'desktopLyric.enable': false })
      })
    }
  })

  // Stop is triggered by notification swipe-to-dismiss
  TrackPlayer.addEventListener(TPEvent.RemoteStop, () => {
    // console.log('remote-stop -> exit app')
    void handleExitApp('Notification Dismissed')
  })

  // Widget button handlers
  onWidgetPlayPause(() => {
    void TrackPlayer.getState().then(state => {
      if (state === TPState.Playing) {
        void pause()
      } else {
        play()
      }
    })
  })
  onWidgetPrev(() => {
    void playPrev()
  })
  onWidgetNext(() => {
    void playNext()
  })

  // TrackPlayer.addEventListener(TPEvent.RemoteDuck, async({ permanent, paused, ducking }) => {
  //   console.log('remote-duck')
  //   if (paused) {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.pause, text: '已暂停' }))
  //     lrcPause()
  //   } else {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.playing, text: '播放中...' }))
  //     TrackPlayer.getPosition().then(position => {
  //       lrcPlay(position * 1000)
  //     })
  //   }
  // })

  TrackPlayer.addEventListener(TPEvent.PlaybackError, async (err: any) => {
    log.error('[Player] ====== Playback Error ======')
    log.error('[Player] Error type:', typeof err)
    log.error('[Player] Error:', JSON.stringify(err, null, 2))

    try {
      const currentMusicInfo = playerState.playMusicInfo.musicInfo
      if (currentMusicInfo) {
        log.info('[Player] Clearing music URL cache for:', currentMusicInfo.name, currentMusicInfo.id)
        // 获取所有缓存键
        const allKeys = await getAllKeys()
        const prefix = storageDataPrefix.musicUrl
        const musicId = currentMusicInfo.id
        // 找到该音乐的所有音质缓存
        const cacheKeys = allKeys.filter(key => key.startsWith(prefix + musicId))
        if (cacheKeys.length > 0) {
          log.info('[Player] Found cached keys:', cacheKeys)
          await removeDataMultiple(cacheKeys)
          log.info('[Player] Music URL cache cleared successfully')
        } else {
          log.info('[Player] No cached URL found for this music')
        }

        // 尝试重新获取播放地址
        global.lx.playerError = true
        log.info('[Player] Attempting to re-fetch music URL')
        if (currentMusicInfo) {
          // 等待一段时间再重试，避免立即重试
          setTimeout(() => {
            log.info('[Player] Re-fetching music URL...')
            setMusicUrl(currentMusicInfo, true) // true 表示刷新缓存
          }, 1000)
        }
      } else {
        log.warn('[Player] No current music info available')
      }
    } catch (clearErr) {
      log.error('[Player] Failed to clear cache:', clearErr)
    }

    // 尝试获取当前播放的 track 信息
    try {
      const currentTrack = await TrackPlayer.getCurrentTrack()
      if (currentTrack != null) {
        const track = await TrackPlayer.getTrack(currentTrack)
        log.error('[Player] Current track:', JSON.stringify(track, null, 2))
        if (track?.url) log.error('[Player] Track URL:', track.url)
        if (track?.headers) log.error('[Player] Track headers:', JSON.stringify(track.headers, null, 2))
      }
    } catch (e) {
      log.error('[Player] Failed to get track info:', e)
    }

    // 详细记录错误对象的所有属性
    if (err) {
      Object.keys(err).forEach(key => {
        log.error(`[Player] Error.${key}:`, err[key])
      })
    }

    log.error('[Player] =============================')
    global.app_event.error()
    global.app_event.playerError()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteSeek, async ({ position }) => {
    global.app_event.setProgress(position as number)
  })

  TrackPlayer.addEventListener(TPEvent.PlaybackState, async (info) => {
    playerLog.info('PlaybackState changed:', JSON.stringify(info))
    if (global.lx.gettingUrlId || isTempId()) return
    // let currentIsPlaying = false

    switch (info.state) {
      case TPState.None:
        playerLog.info('State: None')
        break
      case TPState.Ready:
        playerLog.info('State: Ready')
        global.app_event.playerPause()
        global.app_event.pause()
        break
      case TPState.Stopped:
        playerLog.info('State: Stopped')
        global.app_event.playerPause()
        global.app_event.pause()
        break
      case TPState.Paused:
        playerLog.info('State: Paused')
        global.app_event.playerPause()
        global.app_event.pause()
        break
      case TPState.Playing:
        playerLog.info('State: Playing')
        global.app_event.playerPlaying()
        global.app_event.play()
        break
      case TPState.Buffering:
        playerLog.info('State: Buffering')
        global.app_event.pause()
        global.app_event.playerWaiting()
        break
      case TPState.Connecting:
        playerLog.info('State: Connecting')
        global.app_event.playerLoadstart()
        break
      default:
        playerLog.info('State: Unknown', info.state)
        break
    }
    if (global.lx.isPlayedStop) return handleExitApp('Timeout Exit')

    // console.log('currentIsPlaying', currentIsPlaying, global.lx.playInfo.isPlaying)
    // void updateMetaData(global.lx.store_playMusicInfo.musicInfo, currentIsPlaying)
  })
  TrackPlayer.addEventListener(TPEvent.PlaybackTrackChanged, async (info) => {
    // console.log('PlaybackTrackChanged====>', info)
    global.lx.playerTrackId = await getCurrentTrackId()
    if (info.track == null) return
    if (global.lx.isPlayedStop) return handleExitApp('Timeout Exit')

    // console.log('global.lx.playerTrackId====>', global.lx.playerTrackId)
    if (isEmpty()) {
      // console.log('====TEMP PAUSE====')
      await TrackPlayer.pause()
      global.app_event.playerPause()
      global.app_event.pause()
      if (global.lx.playerError) {
        // 如果是因错误导致的切换，则重置标志位，不触发播放结束事件
        global.lx.playerError = false
      } else {
        // 否则，认为是正常播放结束
        global.app_event.playerEnded()
      }
      global.app_event.playerEmptied()
      // if (retryTrack) {
      //   if (retryTrack.musicId == retryGetUrlId) {
      //     if (++retryGetUrlNum > 1) {
      //       store.dispatch(playerAction.playNext(true))
      //       retryGetUrlId = null
      //       retryTrack = null
      //       return
      //     }
      //   } else {
      //     retryGetUrlId = retryTrack.musicId
      //     retryGetUrlNum = 0
      //   }
      //   store.dispatch(playerAction.refreshMusicUrl(global.lx.playInfo.currentPlayMusicInfo, errorTime))
      // } else {
      //   store.dispatch(playerAction.playNext(true))
      // }
    }
    //   // if (!info.nextTrack) return
    //   // if (info.track) {
    //   //   const track = info.track.substring(0, info.track.lastIndexOf('__//'))
    //   //   const nextTrack = info.track.substring(0, info.nextTrack.lastIndexOf('__//'))
    //   //   console.log(nextTrack, track)
    //   //   if (nextTrack == track) return
    //   // }
    //   // const track = await TrackPlayer.getTrack(info.nextTrack)
    //   // if (!track) return
    //   // let newTrack
    //   // if (track.url == defaultUrl) {
    //   //   TrackPlayer.pause().then(async() => {
    //   //     isRefreshUrl = true
    //   //     retryGetUrlId = track.id
    //   //     retryGetUrlNum = 0
    //   //     try {
    //   //       newTrack = await updateTrackUrl(track)
    //   //       console.log('++++newTrack++++', newTrack)
    //   //     } catch (error) {
    //   //       console.log('error', error)
    //   //       if (error.message != '跳过播放') TrackPlayer.skipToNext()
    //   //       isRefreshUrl = false
    //   //       retryGetUrlId = null
    //   //       return
    //   //     }
    //   //     retryGetUrlId = null
    //   //     isRefreshUrl = false
    //   //     console.log(await TrackPlayer.getQueue(), null, 2)
    //   //     await TrackPlayer.play()
    //   //   })
    //   // }
    //   // store.dispatch(playerAction.playNext())
  })
  // TrackPlayer.addEventListener('playback-queue-ended', async info => {
  //   // console.log('playback-queue-ended', info)
  //   store.dispatch(playerAction.playNext())
  //   // if (!info.nextTrack) return
  //   // const track = await TrackPlayer.getTrack(info.nextTrack)
  //   // if (!track) return
  //   // // if (track.url == defaultUrl) {
  //   // //   TrackPlayer.pause()
  //   // //   getMusicUrl(track.original).then(url => {
  //   // //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   // //       url,
  //   // //     })
  //   // //     TrackPlayer.play()
  //   // //   })
  //   // // }
  //   // if (!track.artwork) {
  //   //   getMusicPic(track.original).then(url => {
  //   //     console.log(url)
  //   //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   //       artwork: url,
  //   //     })
  //   //   })
  //   // }
  // })
  // TrackPlayer.addEventListener('playback-destroy', async() => {
  //   console.log('playback-destroy')
  //   store.dispatch(playerAction.destroy())
  // })
  isInitialized = true
}

export default () => {
  if (global.lx.playerStatus.isRegisteredService) return
  console.log('handle registerPlaybackService...')
  TrackPlayer.registerPlaybackService(() => registerPlaybackService)
  global.lx.playerStatus.isRegisteredService = true
}
