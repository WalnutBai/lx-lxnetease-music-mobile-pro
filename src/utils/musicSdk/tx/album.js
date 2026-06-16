import { httpFetch } from '../../request'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'
import { signRequest } from './utils'
import { txLog } from '@/utils/txLog'

export default {
  successCode: 0,

  async getAlbum(albumMid, retryNum = 0) {
    if (retryNum > 2) {
      txLog.error('=== txApi.getAlbum 重试次数超限 ===', { albumMid, retryNum })
      return Promise.reject(new Error('获取专辑详情失败'))
    }
    
    txLog.info('=== txApi.getAlbum 开始 ===', { albumMid, retryNum })

    const requestData = {
      comm: {
        ct: '11',
        cv: '14090508',
        v: '14090508',
        tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10',
        deviceScore: '553.47',
        devicelevel: '50',
        newdevicelevel: '20',
        rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
        os_ver: '12',
        OpenUDID: '0',
        OpenUDID2: '0',
        QIMEI36: '0',
        udid: '0',
        chid: '0',
        aid: '0',
        oaid: '0',
        taid: '0',
        tid: '0',
        wid: '0',
        uid: '0',
        sid: '0',
        modeSwitch: '6',
        teenMode: '0',
        ui_mode: '2',
        nettype: '1020',
        v4ip: '',
      },
      req: {
        module: 'music.musichallAlbum.AlbumSongList',
        method: 'GetAlbumSongList',
        param: {
          albumMid,
          begin: 0,
          num: 20,
        },
      },
    }

    txLog.info('=== txApi.getAlbum 请求参数 ===', {
      albumMid,
      module: requestData.req.module,
      method: requestData.req.method,
      uid: requestData.comm.uid,
    })

    const request = signRequest(requestData)

    try {
      const { body } = await request

      txLog.info('=== txApi.getAlbum 原始响应 ===', {
        albumMid,
        bodyCode: body?.code,
        reqCode: body?.req?.code,
        reqSubcode: body?.req?.subcode,
        bodyPreview: JSON.stringify(body).slice(0, 200),
      })

      const bodyCode = body?.code
      const reqCode = body?.req?.code
      
      if (!body || !body.req || bodyCode != this.successCode || reqCode != this.successCode) {
        txLog.warn('=== txApi.getAlbum 获取失败 ===', {
          albumMid,
          bodyCode,
          reqCode,
          retryNum: retryNum + 1,
        })
        
        if (reqCode === 104400 || reqCode === 500003) {
          txLog.warn('=== txApi.getAlbum 需要登录或参数错误，跳过重试 ===', { albumMid, reqCode })
          return Promise.reject(new Error(`获取专辑详情失败: 错误码${reqCode}`))
        }
        
        return this.getAlbum(albumMid, ++retryNum)
      }

      const data = body.req.data
      const songList = data.songList || data.list || []
      txLog.info('=== txApi.getAlbum 获取成功 ===', {
        albumMid,
        songCount: songList.length,
        totalNum: data.totalNum || data.total_num,
        dataKeys: data ? Object.keys(data) : [],
        songListField: data.songList ? 'songList' : (data.list ? 'list' : 'none'),
        firstSongItem: songList[0] ? {
          id: songList[0].id,
          mid: songList[0].mid,
          title: songList[0].title,
          hasFile: !!songList[0].file,
          mediaMid: songList[0].file?.media_mid,
          singerLength: songList[0].singer?.length,
          allKeys: Object.keys(songList[0]),
          isArray: Array.isArray(songList),
          songListType: typeof songList,
        } : null,
      })

      const list = this.handleResult(songList)
      const info = this.handleAlbumInfo(data, albumMid)

      return {
        list,
        info,
      }
    } catch (error) {
      txLog.error('=== txApi.getAlbum 出错 ===', {
        albumMid,
        error: error.message,
        stack: error.stack,
        retryNum: retryNum + 1,
      })
      return this.getAlbum(albumMid, ++retryNum)
    }
  },

  handleResult(rawList) {
    if (!rawList || !Array.isArray(rawList)) return []
    
    txLog.info('=== txApi.handleAlbumResult 开始 ===', {
      rawListLength: rawList.length,
      firstItem: rawList[0] ? { 
        id: rawList[0].id, 
        name: rawList[0].title,
        hasSongInfo: !!rawList[0].songInfo,
        songInfoKeys: rawList[0].songInfo ? Object.keys(rawList[0].songInfo) : [],
      } : null,
    })

    const list = []
    rawList.forEach((item, index) => {
      // 支持新的数据格式：歌曲信息在 songInfo 字段中
      const songInfo = item.songInfo || item
      
      // 详细记录原始数据结构
      txLog.info('=== txApi.handleAlbumResult 原始数据诊断 ===', {
        index,
        itemId: item.id,
        itemMid: item.mid,
        hasSongInfo: !!item.songInfo,
        songInfoId: songInfo.id,
        songInfoMid: songInfo.mid,
        songInfoTitle: songInfo.title,
        songInfoKeys: Object.keys(songInfo),
      })
      
      if (!songInfo.file?.media_mid) {
        txLog.info('=== txApi.handleAlbumResult 跳过无media_mid的歌曲 ===', {
          name: songInfo.title,
          hasFile: !!songInfo.file,
          hasMediaMid: !!songInfo.file?.media_mid,
        })
        return
      }

      let types = []
      let _types = {}
      const file = songInfo.file
      if (file.size_128mp3 != 0) {
        let size = sizeFormate(file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = { size }
      }
      if (file.size_320mp3 !== 0) {
        let size = sizeFormate(file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = { size }
      }
      if (file.size_flac !== 0) {
        let size = sizeFormate(file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = { size }
      }
      if (file.size_hires !== 0) {
        let size = sizeFormate(file.size_hires)
        types.push({ type: 'hires', size })
        _types.hires = { size }
      }
      if (file.size_new?.[1] !== 0) {
        let size = sizeFormate(file.size_new[1])
        types.push({ type: 'atmos', size })
        _types.atmos = { size }
      }
      if (file.size_new?.[2] !== 0) {
        let size = sizeFormate(file.size_new[2])
        types.push({ type: 'atmos_plus', size })
        _types.atmos_plus = { size }
      }
      if (file.size_new?.[0] !== 0) {
        let size = sizeFormate(file.size_new[0])
        types.push({ type: 'master', size })
        _types.master = { size }
      }

      let albumId = ''
      let albumName = ''
      if (songInfo.album) {
        albumName = songInfo.album.name
        albumId = songInfo.album.mid
      }

      const processedSongmid = songInfo.mid || songInfo.id
      const processedMeta = {
        songId: songInfo.id,
        id: songInfo.id,
        mid: songInfo.mid,
        songmid: processedSongmid,
        strMediaMid: songInfo.file.media_mid,
        albumName,
        albumId,
        albumMid: songInfo.album?.mid ?? '',
        vid: songInfo.mv?.vid || '',
        picUrl: albumId === '' || albumId === '空'
          ? songInfo.singer?.length
            ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${songInfo.singer[0]?.mid}.jpg`
            : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        qualitys: types,
        _qualitys: _types,
      }
      
      txLog.info('=== txApi.handleAlbumResult 处理歌曲 ===', {
        index,
        songName: songInfo.title,
        originalMid: songInfo.mid,
        processedSongmid,
        hasMeta: !!processedMeta,
        metaSongmid: processedMeta.songmid,
      })
      
      list.push({
        id: String(songInfo.id),
        singer: formatSingerName(songInfo.singer, 'name'),
        artists: songInfo.singer?.map(s => ({ id: s.id || s.mid, name: s.name })) || [],
        name: songInfo.title,
        albumName,
        albumId,
        source: 'tx',
        interval: formatPlayTime(songInfo.interval),
        songId: songInfo.id,
        albumMid: songInfo.album?.mid ?? '',
        strMediaMid: songInfo.file.media_mid,
        songmid: songInfo.mid || songInfo.id,
        img: albumId === '' || albumId === '空'
          ? songInfo.singer?.length
            ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${songInfo.singer[0]?.mid}.jpg`
            : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        types,
        _types,
        typeUrl: {},
        vid: songInfo.mv?.vid || '',
        meta: processedMeta,
      })
    })

    txLog.info('=== txApi.handleAlbumResult 完成 ===', {
      inputCount: rawList.length,
      outputCount: list.length,
    })

    return list
  },

  handleAlbumInfo(data, albumMid) {
    if (!data) return null
    
    const songList = data.songList || data.list || []
    const firstSong = songList[0]
    
    return {
      id: albumMid,
      mid: albumMid,
      name: data.albumName || firstSong?.album?.name || firstSong?.title || '',
      artist: formatSingerName(firstSong?.singer || [], 'name'),
      artistId: firstSong?.singer?.[0]?.id || '',
      picUrl: `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`,
      publishTime: data.time_public || '',
      size: data.totalNum || data.total_num || songList.length,
    }
  },
}
