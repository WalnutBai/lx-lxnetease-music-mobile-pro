/**
 * @name 哔哩哔哩音乐
 * @description 从哔哩哔哩获取音乐资源
 * @version 1.0.0
 * @author 猫头猫
 * @homepage https://gitee.com/maotoumao/MusicFreePlugins
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
const headers = {
  "user-agent": UA,
  accept: "*/*",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
}

let cookie = null
async function getCookie() {
  if (!cookie) {
    const cancel = request("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: { "User-Agent": UA },
    }, (err, resp) => {
      if (!err) {
        cookie = resp.body.data
      }
    })
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve()
      }, 5000)
      const originalOnComplete = cancel
      cancel = () => {
        clearTimeout(timer)
        originalOnComplete?.()
        resolve()
      }
    })
  }
  return cookie
}

function getCookieString() {
  if (!cookie) return ""
  return `buvid3=${cookie.b_3};buvid4=${cookie.b_4}`
}

async function getCid(bvid, aid) {
  return new Promise((resolve) => {
    const params = bvid ? { bvid } : { aid }
    request("https://api.bilibili.com/x/web-interface/view", {
      headers,
      params,
    }, (err, resp) => {
      if (err) {
        resolve({})
      } else {
        resolve(typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body)
      }
    })
  })
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

async function getMediaSource(musicInfo, quality) {
  let cid = musicInfo.cid
  if (!cid) {
    const cidRes = await getCid(musicInfo.bvid, musicInfo.aid)
    cid = cidRes.data?.cid
  }
  
  return new Promise((resolve, reject) => {
    const _params = musicInfo.bvid
      ? { bvid: musicInfo.bvid }
      : { aid: musicInfo.aid }
    
    request("https://api.bilibili.com/x/player/playurl", {
      headers,
      params: Object.assign({}, _params, { cid, fnval: 16 }),
    }, (err, resp) => {
      if (err) {
        reject(err)
        return
      }
      
      const data = typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body
      let url = ""
      
      if (data.data?.dash?.audio) {
        const audios = data.data.dash.audio
        audios.sort((a, b) => a.bandwidth - b.bandwidth)
        const len = audios.length
        
        switch (quality) {
          case "128k":
            url = audios[0]?.baseUrl || audios[len - 1]?.baseUrl
            break
          case "320k":
            url = audios[Math.min(1, len - 1)]?.baseUrl || audios[len - 1]?.baseUrl
            break
          case "flac":
          case "flac24bit":
            url = audios[len - 1]?.baseUrl || audios[Math.min(2, len - 1)]?.baseUrl
            break
          default:
            url = audios[len - 1]?.baseUrl
        }
      } else if (data.data?.durl?.[0]) {
        url = data.data.durl[0].url
      }
      
      if (!url) {
        reject(new Error("无法获取音频链接"))
        return
      }
      
      const hostUrl = url.substring(url.indexOf("/") + 2)
      const musicUrl = {
        url: url,
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
          accept: "*/*",
          host: hostUrl.substring(0, hostUrl.indexOf("/")),
          "accept-encoding": "gzip, deflate, br",
          connection: "keep-alive",
          referer: "https://www.bilibili.com/video/" + (musicInfo.bvid || musicInfo.aid),
        },
      }
      
      resolve(musicUrl.url)
    })
  })
}

on(EVENT_NAMES.request, ({ source, action, info }) => {
  switch (action) {
    case "musicUrl":
      return getMediaSource(info.musicInfo, info.type).catch(err => {
        console.log(err)
        return Promise.reject(err)
      })
    default:
      return Promise.reject(new Error("不支持的操作: " + action))
  }
})

send(EVENT_NAMES.inited, {
  sources: {
    local: {
      name: "哔哩哔哩",
      type: "music",
      actions: ["musicUrl"],
      qualitys: ["128k", "320k", "flac"],
    },
  },
})