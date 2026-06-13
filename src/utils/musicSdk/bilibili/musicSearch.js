import { httpFetch } from '../../request'
import { searchLog } from '@/utils/searchLog'
import settingState from '@/store/setting/state'

const log = searchLog

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
const headers = {
  "user-agent": UA,
  accept: "*/*",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
}

const searchHeaders = {
  "user-agent": UA,
  accept: "application/json, text/plain, */*",
  origin: "https://search.bilibili.com",
  "sec-fetch-site": "same-site",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  referer: "https://search.bilibili.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
}

let cookie = null
async function getCookie() {
  log.info('[Bilibili Search] getCookie - cookie缓存状态: ' + (cookie ? '已缓存' : '未缓存'))
  if (!cookie) {
    try {
      log.info('[Bilibili Search] getCookie - 开始请求指纹接口')
      const requestObj = httpFetch("https://api.bilibili.com/x/frontend/finger/spi", {
        headers: { "User-Agent": UA },
      })
      const { body } = await requestObj.promise
      log.info('[Bilibili Search] getCookie - 响应body类型: ' + typeof body)
      log.info('[Bilibili Search] getCookie - 响应body: ' + JSON.stringify(body))
      cookie = body?.data
      log.info('[Bilibili Search] getCookie - cookie获取成功: ' + JSON.stringify(cookie))
    } catch (error) {
      log.error('[Bilibili Search] Cookie获取失败: ' + error.message)
      log.error('[Bilibili Search] Cookie获取失败堆栈: ' + (error.stack || '无'))
      cookie = { b_3: '', b_4: '' }
    }
  }
  return cookie
}

function getCookieString() {
  if (!cookie) return ""
  const cookieStr = `buvid3=${cookie.b_3};buvid4=${cookie.b_4}`
  log.info('[Bilibili Search] getCookieString: ' + cookieStr)
  return cookieStr
}

function durationToSec(duration) {
  if (typeof duration === "number") {
    return duration
  }
  if (typeof duration === "string") {
    const dur = duration.split(":")
    return dur.reduce(function (prev, curr) {
      return 60 * prev + +curr
    }, 0)
  }
  return 0
}

function formatPlayTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function generateSongId(bvid, aid) {
  const hash = bvid ? bvid : aid
  return `bilibili_${hash}`
}

function generateAlbumId(album) {
  if (!album) return ""
  return `album_bilibili_${album}`
}

function decodeHtmlEntities(str) {
  if (!str) return str
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
  }
  return str.replace(/&[#\w]+;/g, match => entities[match] || match)
}

function formatMedia(result) {
  const title = decodeHtmlEntities(result.title?.replace(/(\<em(.*?)\>)|(\<\/em\>)/g, "") || "")
  return {
    id: result.cid ?? result.bvid ?? result.aid,
    aid: result.aid,
    bvid: result.bvid,
    cid: result.cid,
    artist: result.author ?? result.owner?.name,
    title,
    album: result.bvid ?? result.aid,
    pic: result.pic?.startsWith("//") ? `http:${result.pic}` : result.pic,
    duration: durationToSec(result.duration),
    tags: result.tag?.split(","),
    // 保存可能用于排序的字段
    play: result.play,
    view: result.view,
    like: result.like,
    pubdate: result.pubdate,
  }
}

async function getVideoDetail(bvid, aid) {
  log.info('[Bilibili Search] getVideoDetail 开始 - bvid: ' + bvid + ', aid: ' + aid)
  const params = bvid ? { bvid } : { aid }
  try {
    const requestObj = httpFetch("https://api.bilibili.com/x/web-interface/view", { headers, params })
    const { body } = await requestObj.promise
    const data = typeof body === 'string' ? JSON.parse(body) : body
    log.info('[Bilibili Search] getVideoDetail - 响应code: ' + data?.code)
    log.info('[Bilibili Search] getVideoDetail - 页数: ' + (data?.data?.pages?.length || 0))
    return data
  } catch (err) {
    log.error('[Bilibili Search] getVideoDetail 失败: ' + (err?.message || err))
    return null
  }
}

const musicSearchModule = {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,

  async handleResult(searchResults, page, limit, total = 0, numPages = 0) {
    log.info('[Bilibili Search] handleResult - 原始结果数量: ' + searchResults.length + ', page: ' + page + ', limit: ' + limit + ', total: ' + total + ', numPages: ' + numPages)
    
    const sortedResults = [...searchResults]
    log.info('[Bilibili Search] handleResult - 使用API默认排序')
    
    this.total = total || sortedResults.length
    this.allPage = numPages || Math.ceil(this.total / limit)
    this.page = page

    log.info('[Bilibili Search] handleResult - 直接使用API分页结果，数量: ' + sortedResults.length + ', allPage: ' + this.allPage)

    const enableMultiPage = settingState.setting['common.bilibili_multi_page'] !== false
    log.info('[Bilibili Search] 多P模式: ' + (enableMultiPage ? '开启' : '关闭'))

    // 并行获取所有视频详情，提高搜索速度
    log.info('[Bilibili Search] 开始并行获取视频详情...')
    const videoDetailsPromises = sortedResults.map(item => {
      const bvid = item.bvid
      const aid = item.aid
      if (bvid || aid) {
        return getVideoDetail(bvid, aid).catch(err => {
          log.warn('[Bilibili Search] getVideoDetail 失败: ' + (err?.message || err))
          return null
        })
      }
      return Promise.resolve(null)
    })
    
    const videoDetails = await Promise.all(videoDetailsPromises)
    log.info('[Bilibili Search] 视频详情获取完成，数量: ' + videoDetails.length)

    const list = []
    for (let i = 0; i < sortedResults.length; i++) {
      const item = sortedResults[i]
      const videoDetail = videoDetails[i]
      const index = list.length
      
      const bvid = item.bvid
      const aid = item.aid
      const pages = videoDetail?.data?.pages
      
      // 获取第一个P的时长和cid（用于单P模式）
      const firstPageDuration = pages?.[0]?.duration || videoDetail?.data?.duration || item.duration
      const firstPageCid = videoDetail?.data?.cid || pages?.[0]?.cid || item.cid
      
      // 判断是否需要拆分多P：开启多P且有多个分P
      const isMultiPage = enableMultiPage && pages && Array.isArray(pages) && pages.length > 1
      
      if (isMultiPage) {
        log.info('[Bilibili Search] 检测到合集视频: ' + item.title + ', 共 ' + pages.length + ' 个P')
        let partIndex = 1
        for (const page of pages) {
          const musicInfo = {
            name: (page.part || `P${partIndex}`) + ' - ' + item.title,
            singer: item.artist || '未知歌手',
            source: 'bilibili',
            songmid: generateSongId(bvid, aid) + '_' + page.cid,
            albumId: generateAlbumId(item.bvid || item.aid),
            interval: formatPlayTime(page.duration || 0),
            albumName: item.album || '未知专辑',
            lrc: null,
            img: item.pic,
            otherSource: null,
            types: [{ type: '192k', size: 'UNKNOWN' }],
            _types: { '192k': { size: 'UNKNOWN' } },
            typeUrl: {},
            meta: {
              qualitys: [{ type: '192k', size: 'UNKNOWN' }],
              _qualitys: { '192k': { size: 'UNKNOWN' } },
            },
            _bilibiliData: {
              bvid: item.bvid,
              aid: item.aid,
              cid: page.cid,
            },
          }
          log.info('[Bilibili Search] handleResult [' + index + ']-P' + partIndex + ': songmid=' + musicInfo.songmid + ', cid=' + page.cid + ', name=' + musicInfo.name)
          list.push(musicInfo)
          partIndex++
        }
      } else {
        // 单P模式：使用第一个P的时长（而非总时长）
        const musicInfo = {
          name: item.title || '未知歌曲',
          singer: item.artist || '未知歌手',
          source: 'bilibili',
          songmid: generateSongId(item.bvid, item.aid),
          albumId: generateAlbumId(item.bvid || item.aid),
          interval: formatPlayTime(firstPageDuration || 0),
          albumName: item.album || '未知专辑',
          lrc: null,
          img: item.pic,
          otherSource: null,
          types: [{ type: '192k', size: 'UNKNOWN' }],
          _types: { '192k': { size: 'UNKNOWN' } },
          typeUrl: {},
          meta: {
            qualitys: [{ type: '192k', size: 'UNKNOWN' }],
            _qualitys: { '192k': { size: 'UNKNOWN' } },
          },
          _bilibiliData: {
            bvid: item.bvid,
            aid: item.aid,
            cid: firstPageCid,
          },
        }
        log.info('[Bilibili Search] handleResult [' + index + ']: songmid=' + musicInfo.songmid + ', bvid=' + item.bvid + ', aid=' + item.aid + ', cid=' + firstPageCid + ', duration=' + firstPageDuration + '秒')
        list.push(musicInfo)
      }
    }

    return list
  },

  async search(keyword, page = 1, limit, retryNum = 0) {
    const startTime = Date.now()
    log.info('[Bilibili Search] ========== search 开始 ==========')
    log.info('[Bilibili Search] keyword: ' + keyword + ', page: ' + page + ', limit: ' + limit + ', retryNum: ' + retryNum)
    log.info('[Bilibili Search] 当前模块状态: total=' + this.total + ', allPage=' + this.allPage + ', page=' + this.page)
    
    if (retryNum > 2) {
      log.error('[Bilibili Search] 重试次数超过上限，放弃搜索')
      return Promise.reject(new Error('搜索失败，请稍后重试'))
    }

    if (limit == null) limit = this.limit

    try {
      log.info('[Bilibili Search] 开始获取Cookie')
      await getCookie()
      log.info('[Bilibili Search] Cookie获取完成，Cookie状态: ' + (cookie ? '已设置' : '未设置'))

      const params = {
        context: "",
        page,
        order: "", // 默认排序
        page_size: limit,
        keyword,
        duration: "",
        tids_1: "",
        tids_2: "",
        __refresh__: true,
        _extra: "",
        highlight: 1,
        single_column: 0,
        platform: "pc",
        from_source: "",
        search_type: "video",
        dynamic_offset: 0,
      }
      log.info('[Bilibili Search] 搜索参数: ' + JSON.stringify(params))

      const requestHeaders = { ...searchHeaders, cookie: getCookieString() }
      log.info('[Bilibili Search] 请求头: ' + JSON.stringify(requestHeaders))

      const requestObj = httpFetch("https://api.bilibili.com/x/web-interface/search/type", {
        headers: requestHeaders,
        params,
      })
      log.info('[Bilibili Search] httpFetch 创建成功，等待响应')

      const response = await requestObj.promise
      log.info('[Bilibili Search] 响应获取成功')
      log.info('[Bilibili Search] 响应类型: ' + typeof response)
      log.info('[Bilibili Search] 响应键: ' + JSON.stringify(response ? Object.keys(response) : 'null'))
      
      let data = response.body
      log.info('[Bilibili Search] response.body 类型: ' + typeof data)

      if (typeof data === 'string') {
        log.info('[Bilibili Search] response.body 是字符串，长度: ' + data.length)
        log.info('[Bilibili Search] response.body 前200字符: ' + data.substring(0, 200))
        try {
          data = JSON.parse(data)
          log.info('[Bilibili Search] JSON解析成功')
        } catch (parseError) {
          log.error('[Bilibili Search] JSON解析失败: ' + parseError.message)
          log.error('[Bilibili Search] JSON解析失败堆栈: ' + (parseError.stack || '无'))
          log.error('[Bilibili Search] 原始字符串: ' + data)
          return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
        }
      } else {
        log.info('[Bilibili Search] response.body 已经是对象')
      }

      log.info('[Bilibili Search] data 类型: ' + typeof data)
      log.info('[Bilibili Search] data 是否为 null: ' + (data == null))
      
      if (data) {
        log.info('[Bilibili Search] data.code: ' + data.code + ', data.message: ' + data.message)
        log.info('[Bilibili Search] data.data 是否存在: ' + (data.data != null))
        if (data.data) {
          log.info('[Bilibili Search] data.data 键: ' + JSON.stringify(Object.keys(data.data)))
          log.info('[Bilibili Search] data.data.result 是否存在: ' + (data.data.result != null))
          log.info('[Bilibili Search] data.data.result 类型: ' + (Array.isArray(data.data.result) ? 'array' : typeof data.data.result))
          log.info('[Bilibili Search] data.data.result 长度: ' + (data.data.result ? data.data.result.length : 0))
          log.info('[Bilibili Search] data.data.numResults: ' + data.data.numResults)
          log.info('[Bilibili Search] data.data.numPages: ' + data.data.numPages)
        }
      }

      if (data.code !== 0 && data.code !== undefined) {
        log.error('[Bilibili Search] API错误: code=' + data.code + ', message=' + data.message)
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }

      if (!data?.data?.result) {
        log.info('[Bilibili Search] data.data.result 为空，返回空列表')
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }

      log.info('[Bilibili Search] 开始格式化搜索结果，原始数量: ' + data.data.result.length)
      
      let searchResults
      try {
        searchResults = data.data.result.map(formatMedia)
        log.info('[Bilibili Search] formatMedia 完成，结果数量: ' + searchResults.length)
        if (searchResults.length > 0) {
          log.info('[Bilibili Search] 第一个结果: ' + JSON.stringify(searchResults[0]))
        }
      } catch (formatErr) {
        log.error('[Bilibili Search] formatMedia 失败: ' + (formatErr?.message || formatErr))
        log.error('[Bilibili Search] formatMedia 堆栈: ' + (formatErr?.stack || '无'))
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }
      
      let list
      try {
        list = await this.handleResult(searchResults, page, limit, data.data.numResults, data.data.numPages)
        log.info('[Bilibili Search] handleResult 完成，list数量: ' + list.length)
      } catch (handleErr) {
        log.error('[Bilibili Search] handleResult 失败: ' + (handleErr?.message || handleErr))
        log.error('[Bilibili Search] handleResult 堆栈: ' + (handleErr?.stack || '无'))
        return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
      }

      const result = {
        list,
        allPage: this.allPage,
        total: this.total,
        limit,
        source: 'bilibili',
      }
      const endTime = Date.now()
      const duration = endTime - startTime
      log.info('[Bilibili Search] ========== search 成功结束 ==========')
      log.info('[Bilibili Search] 返回结果: list数量=' + result.list.length + ', allPage=' + result.allPage + ', total=' + result.total)
      log.info('[Bilibili Search] 搜索耗时: ' + duration + 'ms')
      log.info('[Bilibili Search] 是否还有更多数据: ' + (this.allPage > page ? '是' : '否'))
      return Promise.resolve(result)
    } catch (error) {
      log.error('[Bilibili Search] ========== search 异常 ==========')
      log.error('[Bilibili Search] 错误消息: ' + (error?.message || error))
      log.error('[Bilibili Search] 错误堆栈: ' + (error?.stack || '无'))
      log.error('[Bilibili Search] 错误类型: ' + typeof error)
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT') || error.message?.includes('Network')) {
        log.info('[Bilibili Search] 网络错误，重试 (retryNum=' + (retryNum + 1) + ')')
        return this.search(keyword, page, limit, retryNum + 1)
      }
      return Promise.resolve({ list: [], allPage: 0, total: 0, limit, source: 'bilibili' })
    }
  },
}

export default musicSearchModule