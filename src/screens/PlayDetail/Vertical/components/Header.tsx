import { memo, useRef, useCallback, useMemo, useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native'
import { Icon } from '@/components/common/Icon'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
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
import { handleShowArtistDetail } from '@/components/OnlineList/listAction'
import HeaderNew from './HeaderNew'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

const Title = () => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()
  const musicInfo = playMusicInfo.musicInfo ? ('progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo) : null

  const handleArtistPress = useCallback((artist: { id: string | number, mid?: string, name: string }) => {
    if (!musicInfo || (musicInfo.source !== 'wy' && musicInfo.source !== 'tx' && musicInfo.source !== 'kg') || !artist.id) return
    navigations.pushArtistDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(artist.id), mid: artist.mid, name: artist.name, source: musicInfo.source })
  }, [musicInfo])

  const handleAlbumPress = useCallback(() => {
    if (!musicInfo) return
    if (musicInfo.source !== 'wy' && musicInfo.source !== 'tx' && musicInfo.source !== 'kg') return
    const albumId = (musicInfo.meta as any)?.albumId || (musicInfo as any).albumId
    const albumName = musicInfo.meta?.albumName || (musicInfo as any).albumName
    const albumMid = (musicInfo.meta as any)?.albumMid || (musicInfo as any).albumMid || albumId
    if (!albumId || !albumName) return
    if (musicInfo.source === 'tx') {
      navigations.pushAlbumDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(albumId), mid: albumMid, name: albumName, source: 'tx' })
    } else {
      navigations.pushAlbumDetailScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!, { id: String(albumId), name: albumName, source: musicInfo.source })
    }
  }, [musicInfo])

  const singerRender = useMemo(() => {
    if (!musicInfo) return null
    const albumName = musicInfo.meta?.albumName || (musicInfo as any).albumName
    const albumId = (musicInfo.meta as any)?.albumId || (musicInfo as any).albumId

    if (!musicInfo.artists?.length || musicInfo.source == 'local') {
      return (
        <View style={styles.singerContainer}>
          <TouchableOpacity onPress={() => handleShowArtistDetail(commonState.componentIds[commonState.componentIds.length - 1]?.id!, musicInfo)}>
            <Text numberOfLines={1} size={12} color={theme['c-font']}>
              {musicInfo.singer}
            </Text>
          </TouchableOpacity>
          {albumName ? (
            <TouchableOpacity style={{ flexShrink: 1 }} onPress={handleAlbumPress} disabled={(musicInfo.source !== 'wy' && musicInfo.source !== 'tx' && musicInfo.source !== 'kg') || !albumId}>
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
          <TouchableOpacity style={{ flexShrink: 1 }} onPress={handleAlbumPress} disabled={(musicInfo.source !== 'wy' && musicInfo.source !== 'tx' && musicInfo.source !== 'kg') || !albumId}>
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

const HeaderOld = memo(({ pageIndex }: { pageIndex?: number }) => {
  const popupRef = useRef<SettingPopupType>(null)
  const timerModalRef = useRef<TimeoutExitEditModalType>(null)
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()
  const timeInfo = useTimeInfo()
  const back = () => {
    void pop(commonState.componentIds[commonState.componentIds.length - 1]?.id!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']

  return (
    <View
      style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}
    >
      <StatusBar />
      <View style={styles.containerOld}>
        <Btn icon="chevron-left" onPress={back} />
        <Title />
        <TimeoutExitBtn />
        <Btn icon="slider" onPress={showSetting} />
      </View>
      <SettingPopup ref={popupRef} direction="vertical" />
      <TimeoutExitEditModal ref={timerModalRef} timeInfo={timeInfo} />
    </View>
  )
})

export default memo(({ isNewUI, pageIndex }: { isNewUI: boolean; pageIndex?: number }) => {
  return isNewUI ? <HeaderNew pageIndex={pageIndex} /> : <HeaderOld pageIndex={pageIndex} />
})

const styles = StyleSheet.create({
  containerOld: {
    flexDirection: 'row',
    height: '100%',
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
})
