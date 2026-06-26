import { getSongListSetting, saveSongListSetting } from '@/utils/data'
import { useEffect, useRef, useState, useCallback } from 'react'
import { StyleSheet, View, BackHandler } from 'react-native'
import { consumePendingAction } from '@/core/pendingAction'

import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import songlistState, { type InitState, type SortInfo, type ListInfoItem } from '@/store/songlist/state'
import List, { type ListType } from './List'
import SonglistDetail from '../../../SonglistDetail'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import { useWySubscribedPlaylists } from '@/store/user/hook'
import MusicInfoOnline = LX.Music.MusicInfoOnline;

interface SonglistInfo {
  source: InitState['sources'][number]
  sortId: SortInfo['id']
  tagId: string
}

export default () => {
  const headerBarRef = useRef<HeaderBarType>(null)
  const listRef = useRef<ListType>(null)
  const [selectedList, setSelectedList] = useState<ListInfoItem | null>(null)
  const [scrollToMusicInfo, setScrollToMusicInfo] = useState<MusicInfoOnline | null>(null)
  const selectedListRef = useRef(selectedList)
  selectedListRef.current = selectedList
  const songlistInfo = useRef<SonglistInfo>({ source: 'kw', sortId: '5', tagId: '' })
  const [headerKey, setHeaderKey] = useState(Date.now())
  const subscribedPlaylists = useWySubscribedPlaylists()

  const loadList = useCallback(() => {
    listRef.current?.loadList(songlistInfo.current.source, songlistInfo.current.sortId, songlistInfo.current.tagId)
  }, [])

  useEffect(() => {
    const onBackPress = () => {
      if (selectedListRef.current) {
        if (commonState.componentIds.length > 1) {
          return false;
        }

        setSelectedList(null);
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void getSongListSetting().then((info) => {
      songlistInfo.current.source = info.source
      songlistInfo.current.sortId = info.sortId
      songlistInfo.current.tagId = info.tagId
      headerBarRef.current?.setSource(info.source, info.sortId, info.tagName, info.tagId)
      loadList()
    })
  }, [loadList, headerKey])

  useEffect(() => {
    if (!selectedList) {
      setHeaderKey(Date.now())
      loadList()
    }
  }, [selectedList, loadList])


  useEffect(() => {
    const handleJumpPosition = () => {
      let listId = playerState.playMusicInfo.listId
      if (listId === LIST_IDS.TEMP) listId = listState.tempListMeta.id
      if (!listId || !listId.includes('__')) return

      const playlistId = listId.split('__')[1]
      if (subscribedPlaylists.some(p => String(p.id) === playlistId)) return

      const [source, id] = listId.split('__')
      const targetListInfo: ListInfoItem = {
        id,
        source: source as LX.OnlineSource,
        name: '',
        author: '',
        play_count: '',
      }

      const musicInfo = 'progress' in playerState.playMusicInfo.musicInfo
        ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
        : playerState.playMusicInfo.musicInfo
      if (musicInfo) setScrollToMusicInfo(musicInfo as MusicInfoOnline)
      setSelectedList(targetListInfo)
    }
    global.app_event.on('jumpListPosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [subscribedPlaylists])

  const handleSortChange: HeaderBarProps['onSortChange'] = (id) => {
    songlistInfo.current.sortId = id
    void saveSongListSetting({ sortId: id })
    listRef.current?.loadList(songlistInfo.current.source, id, songlistInfo.current.tagId)
  }

  const handleTagChange: HeaderBarProps['onTagChange'] = (name, id) => {
    songlistInfo.current.tagId = id
    void saveSongListSetting({ tagName: name, tagId: id })
    listRef.current?.loadList(songlistInfo.current.source, songlistInfo.current.sortId, id)
  }

  const handleSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    songlistInfo.current.source = source
    songlistInfo.current.tagId = ''
    songlistInfo.current.sortId = songlistState.sortList[source]![0].id
    void saveSongListSetting({
      sortId: songlistInfo.current.sortId,
      source,
      tagId: '',
      tagName: '',
    })
    headerBarRef.current?.setSource(
      source,
      songlistInfo.current.sortId,
      '',
      songlistInfo.current.tagId
    )
    listRef.current?.loadList(source, songlistInfo.current.sortId, songlistInfo.current.tagId)
  }

  const handleOpenDetail = useCallback((item: ListInfoItem) => {
    setSelectedList(item)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedList(null)
    setScrollToMusicInfo(null)
  }, [])

  useEffect(() => {
    const handleOpenImport = () => {
      headerBarRef.current?.setSource(
        songlistInfo.current.source,
        songlistInfo.current.sortId,
        '',
        songlistInfo.current.tagId
      )
      global.app_event.emit('_openSonglistModal', songlistInfo.current.source)
    }
    global.app_event.on('openSonglistImport', handleOpenImport)

    if (consumePendingAction('songlistImport')) {
      setTimeout(() => handleOpenImport(), 300)
    }

    return () => {
      global.app_event.off('openSonglistImport', handleOpenImport)
    }
  }, [])

  if (selectedList) {
    return <SonglistDetail info={selectedList} onBack={handleBack} initialScrollToInfo={scrollToMusicInfo} />
  }

  return (
    <View style={styles.container}>
      <HeaderBar
        key={headerKey}
        ref={headerBarRef}
        onSortChange={handleSortChange}
        onTagChange={handleTagChange}
        onSourceChange={handleSourceChange}
        onOpenDetail={handleOpenDetail}
      />
      <List ref={listRef} onOpenDetail={handleOpenDetail} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flex: 1,
  },
})
