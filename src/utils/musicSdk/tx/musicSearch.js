import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'
import { signRequest } from './utils'
import { txLog } from '@/utils/txLog'

const SEARCH_TYPE_MAP = {
  0: '歌曲',
  1: '歌手',
  2: '专辑',
  3: '歌单',
  4: 'MV',
  7: '歌词',
  8: '用户',
  15: '节目专辑',
  18: '节目',
}

function getSearchTypeName(searchType) {
  return SEARCH_TYPE_MAP[searchType] || `未知(${searchType})`
}

export default {
  limit: 50,
  total: 0,
  page: 0,
  allPage: 1,
  successCode: 0,
  musicSearch(str, page, limit, searchType = 0, retryNum = 0) {
    if (retryNum > 5) return Promise.reject(new Error('搜索失败'))
    txLog.info('=== musicSearch 开始 ===', {
      searchType: getSearchTypeName(searchType),
      query: str,
      page,
      limit,
      retryNum,
      timestamp: new Date().toISOString(),
    })
    const searchRequest = signRequest({
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
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicMobile',
        param: {
          search_type: searchType,
          searchid: Math.random().toString().slice(2),
          query: str,
          page_num: page,
          num_per_page: limit,
          highlight: 0,
          nqc_flag: 0,
          multi_zhida: 0,
          cat: 2,
          grp: 1,
          sin: 0,
          sem: 0,
        },
      },
    })
    return searchRequest.then(({ body }) => {
      txLog.info('=== musicSearch 请求成功 ===', {
        searchType: getSearchTypeName(searchType),
        query: str,
        page,
        responseKeys: body ? Object.keys(body) : [],
        reqCode: body?.req?.code,
        bodyCode: body?.code,
        hasData: !!(body?.req?.data),
        dataKeys: body?.req?.data ? Object.keys(body.req.data) : [],
      })
      
      if (!body || !body.req || body.code != this.successCode || body.req.code != this.successCode) {
        txLog.warn('=== musicSearch 请求失败，准备重试 ===', {
          query: str,
          page,
          bodyCode: body?.code,
          reqCode: body?.req?.code,
          retryNum: retryNum + 1,
        })
        return this.musicSearch(str, page, limit, searchType, ++retryNum)
      }
      txLog.info('=== musicSearch 返回数据概览 ===', {
        searchType: getSearchTypeName(searchType),
        query: str,
        itemSongCount: body.req.data?.item_song?.length || 0,
        itemSingerCount: body.req.data?.item_singer?.length || 0,
        itemAlbumCount: body.req.data?.item_album?.length || 0,
        meta: body.req.data?.meta,
      })
      return body.req.data
    })
  },
  handleResult(rawList) {
    if (!rawList || !Array.isArray(rawList)) return []
    const list = []
    rawList.forEach((item) => {
      if (!item.file?.media_mid) return

      let types = []
      let _types = {}
      const file = item.file
      if (file.size_128mp3 != 0) {
        let size = sizeFormate(file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = {
          size,
        }
      }
      if (file.size_320mp3 !== 0) {
        let size = sizeFormate(file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = {
          size,
        }
      }
      if (file.size_flac !== 0) {
        let size = sizeFormate(file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = {
          size,
        }
      }
      if (file.size_hires !== 0) {
        let size = sizeFormate(file.size_hires)
        types.push({ type: 'hires', size })
        _types.hires = {
          size,
        }
      }
      if (file.size_new?.[1] !== 0) {
        let size = sizeFormate(file.size_new[1])
        types.push({ type: 'atmos', size })
        _types.atmos = {
          size,
        }
      }
      if (file.size_new?.[2] !== 0) {
        let size = sizeFormate(file.size_new[2])
        types.push({ type: 'atmos_plus', size })
        _types.atmos_plus = {
          size,
        }
      }
      if (file.size_new?.[0] !== 0) {
        let size = sizeFormate(file.size_new[0])
        types.push({ type: 'master', size })
        _types.master = {
          size,
        }
      }
      let albumId = ''
      let albumName = ''
      if (item.album) {
        albumName = item.album.name
        albumId = item.album.mid
      }
      list.push({
        id: String(item.id),
        singer: formatSingerName(item.singer, 'name'),
        artists: item.singer?.map(s => ({ id: s.id || s.mid, name: s.name })) || [],
        name: item.title,
        albumName,
        albumId,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album?.mid ?? '',
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img:
          albumId === '' || albumId === '空'
            ? item.singer?.length
              ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg`
              : ''
            : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        types,
        _types,
        typeUrl: {},
        vid: item.mv?.vid || '',
      })
    })
    return list
  },
  search(str, page = 1, limit) {
    if (limit == null) limit = this.limit
    txLog.info('=== search 开始 ===', {
      query: str,
      page,
      limit,
      timestamp: new Date().toISOString(),
    })
    return this.musicSearch(str, page, limit).then(({ body, meta }) => {
      txLog.info('=== search 返回 ===', {
        query: str,
        page,
        bodyKeys: body ? Object.keys(body) : [],
        itemSongLength: body?.item_song?.length || 0,
        meta,
      })
      let list = this.handleResult(body.item_song)
      txLog.info('=== search 处理完成 ===', {
        query: str,
        originalCount: body.item_song?.length || 0,
        processedCount: list.length,
        firstItem: list[0] ? { name: list[0].name, singer: list[0].singer } : null,
        total: meta.estimate_sum,
        allPage: Math.ceil(meta.estimate_sum / limit),
      })

      this.total = meta.estimate_sum
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'tx',
      })
    })
  },

  searchSinger(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    txLog.info('=== searchSinger 开始 ===', {
      query: str,
      page,
      limit,
      retryNum,
      timestamp: new Date().toISOString(),
    })
    return this.musicSearch(str, page, limit, 1).then(({ body, meta }) => {
      txLog.info('=== searchSinger 返回 ===', {
        query: str,
        page,
        bodyKeys: body ? Object.keys(body) : [],
        itemSingerLength: body.item_singer?.length || 0,
        singerLength: body.singer?.length || 0,
        meta,
      })
      const singerData = body.item_singer || body.singer || []
      txLog.info('=== searchSinger 使用的数据来源 ===', {
        source: body.item_singer ? 'item_singer' : (body.singer ? 'singer' : 'empty'),
        dataLength: singerData.length,
      })
      const list = this.handleSingerResult(singerData)
      txLog.info('=== searchSinger 处理完成 ===', {
        query: str,
        originalCount: body.item_singer?.length || 0,
        processedCount: list.length,
        firstItem: list[0] ? { 
          id: list[0].id,
          mid: list[0].mid,
          name: list[0].name,
          albumSize: list[0].albumSize,
          songNum: list[0].songNum,
          source: list[0].source,
        } : null,
        total: meta.estimate_sum || 0,
        allPage: Math.ceil((meta.estimate_sum || 0) / limit),
      })
      return {
        list,
        total: meta.estimate_sum || 0,
        allPage: Math.ceil((meta.estimate_sum || 0) / limit),
        limit,
        source: 'tx',
      }
    }).catch(err => {
      txLog.error('=== searchSinger 出错 ===', {
        query: str,
        page,
        error: err.message,
        stack: err.stack,
        retryNum,
      })
      return this.searchSinger(str, page, limit, retryNum)
    })
  },

  async searchAlbum(str, page = 1, limit = 20, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    txLog.info('=== searchAlbum 开始 ===', {
      query: str,
      page,
      limit,
      retryNum,
      timestamp: new Date().toISOString(),
    })
    try {
      const { body, meta } = await this.musicSearch(str, page, limit, 2)
      txLog.info('=== searchAlbum 返回 ===', {
        query: str,
        page,
        bodyKeys: body ? Object.keys(body) : [],
        itemAlbumLength: body.item_album?.length || 0,
        meta,
      })
      let list = this.handleAlbumResult(body.item_album)
      txLog.info('=== searchAlbum 处理完成 ===', {
        query: str,
        originalCount: body.item_album?.length || 0,
        processedCount: list.length,
        firstItem: list[0] ? {
          id: list[0].id,
          mid: list[0].mid,
          name: list[0].name,
          artistName: list[0].artistName,
          artistId: list[0].artistId,
          size: list[0].size,
          publishTime: list[0].publishTime,
          source: list[0].source,
        } : null,
        total: meta.estimate_sum || 0,
      })

      if (list.length > 0) {
        txLog.info('=== searchAlbum 获取歌曲数量 ===', {
          albumCount: list.length,
          albums: list.map(item => ({ mid: item.mid, name: item.name })),
        })
        const sizeResults = await Promise.all(
          list.map(item => this.getAlbumSongCount(item.mid).catch(() => 0))
        )
        list = list.map((item, index) => ({
          ...item,
          size: sizeResults[index] || 0,
        }))
        txLog.info('=== searchAlbum 歌曲数量获取完成 ===', {
          query: str,
          totalAlbums: list.length,
          songCounts: sizeResults,
          sample: list.slice(0, 3).map(item => ({ name: item.name, size: item.size })),
        })
      }

      return {
        list,
        total: meta.estimate_sum || 0,
        allPage: Math.ceil((meta.estimate_sum || 0) / limit),
        limit,
        source: 'tx',
      }
    } catch (err) {
      txLog.error('=== searchAlbum 出错 ===', {
        query: str,
        page,
        error: err.message,
        stack: err.stack,
        retryNum,
      })
      return this.searchAlbum(str, page, limit, retryNum)
    }
  },

  getAlbumSongCount(albumMid, retryNum = 0) {
    if (retryNum > 2) {
      txLog.warn('=== getAlbumSongCount 重试次数超限 ===', { albumMid, retryNum })
      return Promise.resolve(0)
    }
    txLog.info('=== getAlbumSongCount 开始 ===', { albumMid, retryNum })
    const request = signRequest({
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
          num: 1,
        },
      },
    })
    return request.then(({ body }) => {
      const bodyCode = body?.code
      const reqCode = body?.req?.code
      
      if (!body || !body.req || bodyCode != this.successCode || reqCode != this.successCode) {
        txLog.warn('=== getAlbumSongCount 获取失败 ===', {
          albumMid,
          bodyCode,
          reqCode,
          retryNum: retryNum + 1,
        })
        
        if (reqCode === 104400 || reqCode === 500003) {
          txLog.warn('=== getAlbumSongCount 需要登录或参数错误，跳过重试 ===', { albumMid, reqCode })
          return 0
        }
        
        return this.getAlbumSongCount(albumMid, ++retryNum)
      }
      const totalNum = body.req.data?.totalNum || body.req.data?.total_num || 0
      txLog.info('=== getAlbumSongCount 获取成功 ===', {
        albumMid,
        totalNum,
        dataKeys: body.req.data ? Object.keys(body.req.data) : [],
      })
      return totalNum
    }).catch(err => {
      txLog.error('=== getAlbumSongCount 出错 ===', {
        albumMid,
        error: err.message,
        stack: err.stack,
        retryNum: retryNum + 1,
      })
      return this.getAlbumSongCount(albumMid, ++retryNum)
    })
  },

  handleSingerResult(rawList) {
    if (!rawList) {
      txLog.warn('=== handleSingerResult rawList 为空 ===')
      return []
    }
    txLog.info('=== handleSingerResult 开始 ===', {
      rawListLength: rawList.length,
      firstItem: rawList[0] ? {
        id: rawList[0].id,
        mid: rawList[0].mid,
        name: rawList[0].name,
        singer_name: rawList[0].singer_name,
        singerPic: rawList[0].singerPic,
        albumNum: rawList[0].albumNum,
        songNum: rawList[0].songNum,
        allKeys: Object.keys(rawList[0]),
      } : null,
    })
    const extractMidFromPicUrl = (picUrl) => {
      if (!picUrl) return ''
      const match = picUrl.match(/M000([A-Za-z0-9]+)/)
      return match ? match[1] : ''
    }
    
    const result = rawList.map(item => {
      const mid = item.mid || extractMidFromPicUrl(item.singerPic) || String(item.id || '')
      const picUrl = item.singerPic 
        ? item.singerPic.replace(/R\d+x\d+M000/, 'R500x500M000').replace(/_\d+\.jpg$/, '_1.jpg')
        : ''
      return {
        id: mid,
        mid: mid,
        name: item.name || item.singer_name || item.singerName || '',
        picUrl,
        alias: [],
        albumSize: item.albumNum || item.album_size || 0,
        songNum: item.songNum || item.song_num || 0,
        source: 'tx',
      }
    })
    txLog.info('=== handleSingerResult 完成 ===', {
      inputCount: rawList.length,
      outputCount: result.length,
      firstProcessedItem: result[0] || null,
    })
    return result
  },

  handleAlbumResult(rawList) {
    if (!rawList) {
      txLog.warn('=== handleAlbumResult rawList 为空 ===')
      return []
    }
    txLog.info('=== handleAlbumResult 开始 ===', {
      rawListLength: rawList.length,
      firstItem: rawList[0] ? {
        id: rawList[0].id,
        mid: rawList[0].mid,
        name: rawList[0].name,
        pic: rawList[0].pic,
        singer_list: rawList[0].singer_list,
        time_public: rawList[0].time_public,
        song_num: rawList[0].song_num,
        allKeys: Object.keys(rawList[0]),
      } : null,
    })
    const result = rawList.map(item => {
      const mid = item.mid || item.albummid || ''
      return {
        id: item.id,
        mid,
        name: item.name,
        picUrl: item.pic || '',
        artistName: item.singer_list?.[0]?.name || '',
        artistId: item.singer_list?.[0]?.id || 0,
        size: item.song_num || item.songNum || item.total_num || item.totalNum || item.total || item.num || 0,
        publishTime: item.time_public || '',
        source: 'tx',
      }
    })
    txLog.info('=== handleAlbumResult 完成 ===', {
      inputCount: rawList.length,
      outputCount: result.length,
      firstProcessedItem: result[0] || null,
    })
    return result
  },
}
