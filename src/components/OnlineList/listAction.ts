import { LIST_IDS } from '@/config/constant'
import { addListMusics } from '@/core/list'
import { playList, playNext } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { getListMusicSync } from '@/utils/listManage'
import { confirmDialog, openUrl, shareMusic, toast } from '@/utils/tools'
import { addDislikeInfo, hasDislike } from '@/core/dislikeList'
import playerState from '@/store/player/state'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import { httpFetch } from '@/utils/request'
import musicDetailApi from '@/utils/musicSdk/wy/musicDetail'
import userState from '@/store/user/state'
import {weapi} from "@/utils/musicSdk/wy/utils/crypto.js";
import {addWyLikedSong, removeWyLikedSong, addTxLikedSong, removeTxLikedSong, addKgLikedSong, removeKgLikedSong} from "@/store/user/action.ts";
import {navigations} from "@/navigation";
import commonState from '@/store/common/state'
import wyApi from '@/utils/musicSdk/wy/user'
import txApi from '@/utils/musicSdk/tx/user'
import { log } from '@/utils/log'
import { addSongToPlaylist, removeSongsFromPlaylist } from '@/utils/musicSdk/kg/utils/api'

export const handleShowAlbumDetail = (componentId: string, musicInfo: LX.Music.MusicInfoOnline) => {
  const albumId = musicInfo.meta.albumId
  if (!albumId) {
    toast('专辑信息不存在')
    return
  }
  const albumInfo = {
    id: albumId,
    mid: (musicInfo.meta as any).albumMid || albumId,
    name: musicInfo.meta.albumName,
    author: musicInfo.singer,
    img: musicInfo.meta.picUrl,
    source: musicInfo.source,
  }
  navigations.pushAlbumDetailScreen(componentId, albumInfo)
}

export const handleShowArtistDetail = async (componentId: string, musicInfo: LX.Music.MusicInfoOnline) => {
  log.info('[handleShowArtistDetail] === 开始查看歌手详情 ===', {
    source: musicInfo.source,
    name: musicInfo.name,
    singer: musicInfo.singer,
    hasArtists: !!musicInfo.artists,
    artistsLength: musicInfo.artists?.length || 0,
    artists: musicInfo.artists,
    meta: musicInfo.meta,
    timestamp: new Date().toISOString(),
  })

  if (musicInfo.source !== 'wy' && musicInfo.source !== 'tx' && musicInfo.source !== 'kg') {
    log.info('[handleShowArtistDetail] 暂不支持该音源', { source: musicInfo.source })
    toast('暂不支持该音源查看歌手详情')
    return
  }

  let artists = musicInfo.artists

  if (!artists?.length && musicInfo.singer) {
    log.info('[handleShowArtistDetail] artists 为空，尝试通过搜索API获取', {
      singer: musicInfo.singer,
      source: musicInfo.source,
    })

    try {
      const singerNames = musicInfo.singer.split(/[、,，&/]/).map(s => s.trim()).filter(Boolean)
      const foundArtists: Array<{ id: string | number, mid?: string, name: string, picUrl?: string }> = []

      for (const singerName of singerNames) {
        const searchResult = await musicSdk[musicInfo.source].musicSearch.searchSinger(singerName, 1, 1)
        if (searchResult?.list?.length) {
          const firstResult = searchResult.list[0]
          const resultName = firstResult.name.toLowerCase()
          const searchName = singerName.toLowerCase()
          if (resultName === searchName || resultName.includes(searchName) || searchName.includes(resultName)) {
            foundArtists.push({
              id: firstResult.id,
              mid: firstResult.mid,
              name: firstResult.name,
              picUrl: firstResult.picUrl,
            })
          }
        }
      }

      if (foundArtists.length === 0 && musicInfo.name) {
        log.info('[handleShowArtistDetail] 歌手名搜索未匹配，尝试通过歌曲名搜索获取歌手', {
          songName: musicInfo.name,
          source: musicInfo.source,
        })
        try {
          const response = await httpFetch(
            `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(musicInfo.name)}&page=1&pagesize=10&userid=0&platform=WebFilter&filter=2&iscorrection=1&area_code=1`
          )
          const { body } = await response.promise
          if (body?.data?.lists?.length) {
            for (const song of body.data.lists) {
              const songName = (song.SongName || '').toLowerCase()
              const targetName = musicInfo.name.toLowerCase()
              if (songName.includes(targetName) || targetName.includes(songName)) {
                if (song.Singers && song.Singers.length > 0) {
                  for (const s of song.Singers) {
                    if (s.id && s.name) {
                      const sName = s.name.toLowerCase()
                      for (const sn of singerNames) {
                        if (sName.includes(sn.toLowerCase()) || sn.toLowerCase().includes(sName)) {
                          foundArtists.push({ id: s.id, name: s.name })
                          break
                        }
                      }
                      if (foundArtists.length > 0) break
                    }
                  }
                  if (foundArtists.length > 0) break
                }
              }
            }
          }
        } catch (e: any) {
          log.error('[handleShowArtistDetail] 歌曲名搜索出错', { error: e.message })
        }
      }

      if (foundArtists.length > 0) {
        artists = foundArtists
        log.info('[handleShowArtistDetail] 通过搜索API成功获取歌手信息', {
          artists,
        })
      }
    } catch (error: any) {
      log.error('[handleShowArtistDetail] 搜索API出错', { error: error.message })
    }
  }

  if (!artists?.length) {
    log.warn('[handleShowArtistDetail] 未找到歌手信息', {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
    })
    toast('未找到该歌曲的歌手信息')
    return
  }

  const onSelect = (artist: { id: string | number, mid?: string, name: string }) => {
    log.info('[handleShowArtistDetail] 选中歌手，跳转歌手详情页', {
      artistId: artist.id,
      artistMid: artist.mid,
      artistName: artist.name,
      source: musicInfo.source,
    })
    navigations.pushArtistDetailScreen(componentId, { id: String(artist.id), mid: artist.mid, name: artist.name, picUrl: artist.picUrl, source: musicInfo.source })
  }

  if (artists.length > 1) {
    log.info('[handleShowArtistDetail] 多个歌手，显示选择器', { artists })
    global.app_event.showArtistSelector(artists, onSelect)
  } else if (artists.length === 1) {
    log.info('[handleShowArtistDetail] 单个歌手，直接跳转', { artist: artists[0] })
    onSelect(artists[0])
  }
}

export const handleLikeMusic = async (musicInfo: LX.Music.MusicInfoOnline) => {
  const cookie = settingState.setting['common.wy_cookie']
  if (!cookie) {
    toast('请先设置网易云 Cookie')
    return
  }
  if (musicInfo.source !== 'wy') {
    toast('非网易云音源无法执行此操作')
    return
  }

  const songId = musicInfo.meta.songId
  const isLiked = userState.wy_liked_song_ids.has(String(songId))
  const like = !isLiked

  try {
    await wyApi.likeSong(songId, like);
    if (like) {
      toast('喜欢成功');
      addWyLikedSong(songId);
    } else {
      toast('取消喜欢成功');
      removeWyLikedSong(songId);
    }
  } catch (error: any) {
    toast(`操作失败: ${error.message}`);
  }
}

export const handleTxLikeMusic = async (musicInfo: LX.Music.MusicInfoOnline) => {
  const cookie = settingState.setting['common.tx_cookie']
  if (!cookie) {
    toast('请先设置QQ音乐 Cookie')
    return
  }
  if (musicInfo.source !== 'tx') {
    toast('非QQ音源无法执行此操作')
    return
  }

  // 安全提取元数据
  const rawSongMid = (musicInfo.meta as any).songmid || (musicInfo.meta as any).strMediaMid || musicInfo.id
  // 兼容 musicInfo.id 带有 "tx_" 前缀的情况
  const songMid = typeof rawSongMid === 'string' && rawSongMid.startsWith('tx_') ? rawSongMid.slice(3) : rawSongMid
  const songId = (musicInfo.meta as any).id

  // 严格的纯数字 ID 校验（使用正则，完全避开 parseInt 截断问题）
  const isNumericId = songId && /^\d+$/.test(String(songId))

  // 统一使用 songId 作为喜欢状态的键（如果存在），否则使用 songMid
  const likeKey = isNumericId ? String(songId) : songMid

  // 决定传递给底层的标识符：如果是纯数字 songId，使用它；否则使用 songMid
  const songIdentifier = isNumericId ? String(songId) : songMid

  const isLiked = userState.tx_liked_song_ids.has(likeKey)
  const like = !isLiked

  try {
    await txApi.likeSong(songIdentifier, like);
    if (like) {
      toast('喜欢成功');
      addTxLikedSong(likeKey);
    } else {
      toast('取消喜欢成功');
      removeTxLikedSong(likeKey);
    }
  } catch (error: any) {
    toast(`操作失败: ${error.message}`);
  }
}

export const handleKgLikeMusic = async (musicInfo: LX.Music.MusicInfoOnline) => {
  const cookie = settingState.setting['common.kg_cookie']
  if (!cookie) {
    toast('请先设置酷狗音乐 Cookie')
    return
  }
  if (musicInfo.source !== 'kg') {
    toast('非酷狗音源无法执行此操作')
    return
  }

  // 使用 hash 作为喜欢的唯一标识（audio_id 可能为 0 导致多首歌共享同一 ID）
  const meta = musicInfo.meta as any
  const songHash = meta.hash || ''
  const songId = musicInfo.meta.songId
  // 优先使用 hash 作为 liked 状态的 key，因为 hash 是每首歌唯一的
  const likeKey = songHash || String(songId)
  const isLiked = userState.kg_liked_song_ids.has(likeKey)
  const like = !isLiked

  try {
    if (like) {
      // 获取用户的歌单列表，找到"我喜欢"歌单（is_def === 2）
      const { getUserPlaylists, getPlaylistSongs } = await import('@/utils/musicSdk/kg/utils/api')
      const playlistsResult = await getUserPlaylists(cookie)
      if (!playlistsResult.success || !playlistsResult.data) {
        toast('获取歌单列表失败')
        return
      }
      
      const favoritesPlaylist = playlistsResult.data.createdList.find((p: any) => p.isFavorites)
      if (!favoritesPlaylist || !favoritesPlaylist.listid) {
        toast('未找到"我喜欢"歌单，可能是Cookie已失效，请重新登录')
        return
      }
      
      // 提取歌曲信息
      const meta = musicInfo.meta as any
      const songInfo = {
        name: musicInfo.name || '',
        hash: meta.hash || meta.songmid || songId,
        album_id: meta.albumId ? Number(meta.albumId) : 0,
        mixsongid: meta.mixsongid ? Number(meta.mixsongid) : 0,
      }
      
      const result = await addSongToPlaylist(cookie, favoritesPlaylist.listid, songInfo)
      if (result.success) {
        toast('喜欢成功')
        addKgLikedSong(likeKey)
      } else {
        toast(`操作失败: ${result.message}，可能是Cookie已失效，请重新登录`)
      }
    } else {
      // 取消喜欢 - 获取"我喜欢"歌单的歌曲列表，找到对应的歌曲并移除
      const { getUserPlaylists, getPlaylistSongs } = await import('@/utils/musicSdk/kg/utils/api')
      const playlistsResult = await getUserPlaylists(cookie)
      if (!playlistsResult.success || !playlistsResult.data) {
        toast('获取歌单列表失败，可能是Cookie已失效，请重新登录')
        return
      }
      
      const favoritesPlaylist = playlistsResult.data.createdList.find((p: any) => p.isFavorites)
      if (!favoritesPlaylist || !favoritesPlaylist.listid) {
        toast('未找到"我喜欢"歌单，可能是Cookie已失效，请重新登录')
        return
      }
      
      // 获取歌单中的歌曲，找到对应的fileid
      const songsResult = await getPlaylistSongs(cookie, favoritesPlaylist.id, 1, 500)
      if (!songsResult.success || !songsResult.data?.list) {
        toast('获取歌单歌曲失败')
        return
      }
      
      const meta = musicInfo.meta as any
      const songHash = (meta.hash || '').toString().toLowerCase()
      console.log('[KgLike] 查找歌曲:', { songHash, totalSongs: songsResult.data.list.length })
      
      const targetSong = songsResult.data.list.find((s: any) => {
        const sHash = (s.hash || '').toString().toLowerCase()
        return sHash === songHash || sHash.includes(songHash) || songHash.includes(sHash)
      })
      
      console.log('[KgLike] 找到歌曲:', { found: !!targetSong, fileId: targetSong?.fileId, listid: favoritesPlaylist.listid })
      
      if (targetSong && targetSong.fileId && targetSong.fileId !== 0) {
        const removeResult = await removeSongsFromPlaylist(cookie, favoritesPlaylist.listid, [Number(targetSong.fileId)])
        if (removeResult.success) {
          toast('取消喜欢成功')
          removeKgLikedSong(likeKey)
        } else {
          toast(`操作失败: ${removeResult.message}，可能是Cookie已失效，请重新登录`)
        }
      } else {
        toast('未找到歌曲信息，可能是Cookie已失效，请重新登录')
      }
    }
  } catch (error: any) {
    toast(`操作失败: ${error.message}，可能是Cookie已失效，请重新登录`)
  }
}

export const handlePlay = (musicInfo: LX.Music.MusicInfoOnline) => {
  void addListMusics(
    LIST_IDS.DEFAULT,
    [musicInfo],
    settingState.setting['list.addMusicLocationType']
  ).then(() => {
    const index = getListMusicSync(LIST_IDS.DEFAULT).findIndex((m) => m.id == musicInfo.id)
    if (index < 0) return
    void playList(LIST_IDS.DEFAULT, index)
  })
}
export const handlePlayLater = (
  musicInfo: LX.Music.MusicInfoOnline,
  selectedList: LX.Music.MusicInfoOnline[],
  onCancelSelect: () => void
) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map((s) => ({ listId: '', musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId: '', musicInfo }])
  }
}

export const handleShare = (musicInfo: LX.Music.MusicInfoOnline) => {
  shareMusic(
    settingState.setting['common.shareType'],
    settingState.setting['download.fileName'],
    musicInfo
  )
}

export const handleShowMusicSourceDetail = async (minfo: LX.Music.MusicInfoOnline) => {
  const url = musicSdk[minfo.source as LX.OnlineSource]?.getMusicDetailPageUrl(
    toOldMusicInfo(minfo)
  )
  if (!url) return
  void openUrl(url)
}

export const handleDislikeMusic = async(musicInfo: LX.Music.MusicInfoOnline, listId?: string) => {
  // 如果是每日推荐列表，则执行新的API逻辑
  if (listId === 'dailyrec_wy') {
    const cookie = settingState.setting['common.wy_cookie']
    if (!cookie) {
      toast('请先设置网-易-云 Cookie')
      return
    }

    // 网易云API需要的是纯数字ID
    const songId = musicInfo.id.replace('wy_', '')

    try {
      const { body, statusCode } = await httpFetch('https://music.163.com/weapi/v2/discovery/recommend/dislike', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({
          resId: songId,
          resType: 4,
          sceneType: 1,
        }),
      }).promise;

      if (statusCode == 200 && body.code === 200) {
        // 将返回的新歌曲数据转换为应用内部格式
        const newMusicResult = await musicDetailApi.filterList({ songs: [body.data], privileges: [] })
        if (newMusicResult.length) {
          const newMusicInfo = newMusicResult[0]
          // 发送事件，通知UI更新
          global.list_event.daily_rec_music_replace(musicInfo.id, newMusicInfo as LX.Music.MusicInfoOnline)
          toast('操作成功！')
        } else {
          global.list_event.daily_rec_music_replace(musicInfo.id, null)
          toast('操作成功！')
        }
      } else {
        toast('操作失败')
      }
    } catch (error: any) {
      toast(`操作失败: ${error.message}`)
    }
    return
  }

  // --- 对于其他列表，保留原有的本地“不喜欢”逻辑 ---
  const confirm = await confirmDialog({
    message: musicInfo.singer
      ? global.i18n.t('lists_dislike_music_singer_tip', {
        name: musicInfo.name,
        singer: musicInfo.singer,
      })
      : global.i18n.t('lists_dislike_music_tip', { name: musicInfo.name }),
    cancelButtonText: global.i18n.t('cancel_button_text_2'),
    confirmButtonText: global.i18n.t('confirm_button_text'),
    bgClose: false,
  })
  if (!confirm) return
  await addDislikeInfo([{ name: musicInfo.name, singer: musicInfo.singer }])
  toast(global.i18n.t('lists_dislike_music_add_tip'))
  if (hasDislike(playerState.playMusicInfo.musicInfo)) {
    void playNext(true)
  }
}
