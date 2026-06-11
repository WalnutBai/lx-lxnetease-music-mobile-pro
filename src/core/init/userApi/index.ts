import {
  type InitParams,
  onScriptAction,
  sendAction,
  type ResponseParams,
  type UpdateInfoParams,
  type RequestParams,
} from '@/utils/nativeModules/userApi'
import { log, setUserApiList, setUserApiStatus } from '@/core/userApi'
import settingState from '@/store/setting/state'
import BackgroundTimer from 'react-native-background-timer'
import { fetchData } from './request'
import { getUserApiList } from '@/utils/data'
import { confirmDialog, openUrl, tipDialog } from '@/utils/tools'

const parseFileSize = (sizeStr: string): number => {
  const match = sizeStr.match(/^([\d.]+)\s*(MB|KB)$/i)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  return unit === 'KB' ? num / 1024 : num
}

const getActualQualityBySize = (actualSizeMB: number, claimedQuality: string, musicInfo: LX.Music.MusicInfo): string => {
  const qualitySizes: Record<string, number> = {}
  
  if (musicInfo._types) {
    for (const [quality, info] of Object.entries(musicInfo._types)) {
      if (typeof info === 'object' && info.size) {
        qualitySizes[quality] = parseFileSize(info.size)
      }
    }
  }
  
  if (Object.keys(qualitySizes).length === 0 && musicInfo.meta?._qualitys) {
    for (const [quality, info] of Object.entries(musicInfo.meta._qualitys)) {
      if (typeof info === 'object' && info.size) {
        qualitySizes[quality] = parseFileSize(info.size)
      }
    }
  }
  
  if (Object.keys(qualitySizes).length === 0) return claimedQuality
  
  let closestQuality = claimedQuality
  let minDiff = Infinity
  
  for (const [quality, expectedSize] of Object.entries(qualitySizes)) {
    const diff = Math.abs(actualSizeMB - expectedSize)
    if (diff < minDiff) {
      minDiff = diff
      closestQuality = quality
    }
  }
  
  return closestQuality
}

export default async (setting: LX.AppSetting) => {
  const userApiRequestMap = new Map<
    string,
    {
      resolve: (value: ResponseParams['result']) => void
      reject: (error: Error) => void
      timeout: number
    }
  >()
  const scriptRequestMap = new Map<string, { request: Promise<any>; abort: () => void }>()

  const cancelRequest = (requestKey: string, message: string) => {
    const target = scriptRequestMap.get(requestKey)
    if (!target) return
    scriptRequestMap.delete(requestKey)
    target.abort()
  }
  const sendScriptRequest = (
    requestKey: string,
    url: string,
    options: RequestParams['options']
  ) => {
    let req = fetchData(url, options)
    req.request
      .then((response) => {
        // console.log(response)
        sendAction('response', {
          error: null,
          requestKey,
          response,
        })
      })
      .catch((err) => {
        sendAction('response', {
          error: err.message,
          requestKey,
          response: null,
        })
      })
      .finally(() => {
        scriptRequestMap.delete(requestKey)
      })
    scriptRequestMap.set(requestKey, req)
  }
  const sendUserApiRequest = async (data: LX.UserApi.UserApiRequestParams) => {
    const handleApiUpdate = () => {
      const target = userApiRequestMap.get(data.requestKey)
      if (!target) return
      userApiRequestMap.delete(data.requestKey)
      BackgroundTimer.clearTimeout(target.timeout)
      target.reject(new Error('request failed'))
    }
    const requestPromise = new Promise<ResponseParams['result']>((resolve, reject) => {
      userApiRequestMap.set(data.requestKey, {
        resolve,
        reject,
        timeout: BackgroundTimer.setTimeout(() => {
          const target = userApiRequestMap.get(data.requestKey)
          if (!target) return
          userApiRequestMap.delete(data.requestKey)
          target.reject(new Error('request timeout'))
        }, 20_000),
      })
      sendAction('request', data)
    }).finally(() => {
      global.state_event.off('apiSourceUpdated', handleApiUpdate)
    })
    global.state_event.on('apiSourceUpdated', handleApiUpdate)
    return requestPromise
  }
  const handleUserApiResponse = ({ status, result, requestKey, errorMessage }: ResponseParams) => {
    const target = userApiRequestMap.get(requestKey)
    if (!target) return
    userApiRequestMap.delete(requestKey)
    BackgroundTimer.clearTimeout(target.timeout)
    if (status) target.resolve(result)
    else target.reject(new Error(errorMessage ?? 'failed'))
  }
  const handleStateChange = ({ status, errorMessage, info }: InitParams) => {
    // console.log(status, message, info)
    setUserApiStatus(status, errorMessage)
    if (!info || info.id !== settingState.setting['common.apiSource']) return
    if (status) {
      if (info.sources) {
        let apis: any = {}
        let qualitys: LX.QualityList = {}
        for (const [source, { actions, type, qualitys: sourceQualitys }] of Object.entries(
          info.sources
        )) {
          if (type != 'music') continue
          apis[source as LX.Source] = {}
          for (const action of actions) {
            switch (action) {
              case 'musicUrl':
                apis[source].getMusicUrl = (songInfo: LX.Music.MusicInfo, type: LX.Quality) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'musicUrl',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                    })
                      .then(async (res) => {
                        const extraQuality = res.data.extra?.quality
                        let actualQuality = typeof extraQuality === 'object' 
                          ? extraQuality.type || type 
                          : (extraQuality || type)
                        
                        const url = res.data.url
                        if (url) {
                          const urlLower = url.toLowerCase()
                          const urlExtension = urlLower.split('.').pop() || ''
                          
                          try {
                            const headResponse = await fetch(url, { method: 'HEAD' })
                            const contentLength = headResponse.headers.get('content-length')
                            const contentType = headResponse.headers.get('content-type') || ''
                            
                            let inferredType = urlExtension
                            if (contentType.includes('audio/flac') || contentType.includes('application/octet-stream')) {
                              inferredType = 'flac'
                            } else if (contentType.includes('audio/mpeg') || contentType.includes('audio/mp3')) {
                              inferredType = 'mp3'
                            } else if (contentType.includes('audio/mp4') || contentType.includes('audio/m4a') || contentType.includes('audio/aac')) {
                              inferredType = 'm4a'
                            }
                            
                            if (contentLength) {
                              const actualSizeMB = parseInt(contentLength) / (1024 * 1024)
                              actualQuality = getActualQualityBySize(actualSizeMB, actualQuality, songInfo)
                            } else if (inferredType === 'm4a' || inferredType === 'aac') {
                              actualQuality = '128k'
                            } else if (inferredType === 'mp3') {
                              actualQuality = '320k'
                            } else {
                              actualQuality = 'flac'
                            }
                          } catch {
                            if (urlExtension === 'm4a' || urlExtension === 'aac') {
                              actualQuality = '128k'
                            } else if (urlExtension === 'mp3') {
                              actualQuality = '320k'
                            } else {
                              actualQuality = 'flac'
                            }
                          }
                        }
                        
                        return { type: actualQuality, url: res.data.url }
                      })
                      .catch((err) => {
                        console.log(err.message)
                        throw err
                      }),
                  }
                }
                break
              case 'lyric':
                apis[source].getLyric = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'lyric',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                    })
                      .then((res) => {
                        // console.log(res)
                        return res.data
                      })
                      .catch(async (err) => {
                        console.log(err.message)
                        return Promise.reject(err)
                      }),
                  }
                }
                break
              case 'pic':
                apis[source].getPic = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'pic',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                    })
                      .then((res) => {
                        // console.log(res)
                        return res.data
                      })
                      .catch(async (err) => {
                        console.log(err.message)
                        return Promise.reject(err)
                      }),
                  }
                }
                break
              default:
                break
            }
          }
          qualitys[source as LX.Source] = sourceQualitys
        }
        global.lx.qualityList = qualitys
        global.lx.apis = apis
        global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
      }
    } else {
      if (errorMessage) {
        void tipDialog({
          message: `${global.i18n.t('user_api__init_failed_alert', { name: info.name })}\n${errorMessage}`,
          // selection: true,
          btnText: global.i18n.t('ok'),
        })
      }
    }
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](status)
  }
  const showUpdateAlert = ({ name, log, updateUrl }: UpdateInfoParams) => {
    if (!name && !log) return
    const message = `${global.i18n.t('user_api_update_alert', { name: name || '' })}\n${log || ''}`.trim()
    if (!message) return
    if (updateUrl) {
      void confirmDialog({
        message,
        confirmButtonText: global.i18n.t('user_api_update_alert_open_url'),
        cancelButtonText: global.i18n.t('close'),
      }).then((confirm) => {
        if (!confirm) return
        setTimeout(() => {
          void openUrl(updateUrl)
        }, 300)
      })
    } else {
      void tipDialog({
        message,
        btnText: global.i18n.t('ok'),
      })
    }
  }

  onScriptAction((event) => {
    // console.log('script actuon: ', event)
    switch (event.action) {
      case 'init':
        if ((event as unknown as { errorMessage?: string }).errorMessage)
          event.data.errorMessage = (event as unknown as { errorMessage: string }).errorMessage
        handleStateChange(event.data)
        break
      case 'response':
        handleUserApiResponse(event.data)
        break
      case 'request':
        sendScriptRequest(event.data.requestKey, event.data.url, event.data.options)
        break
      case 'cancelRequest':
        cancelRequest(event.data, 'request canceled')
        break
      case 'showUpdateAlert':
        showUpdateAlert(event.data)
        break
      case 'log':
        switch ((event as unknown as { type: keyof typeof log }).type) {
          case 'log':
          case 'info':
            log.info((event as unknown as { log: string }).log)
            break
          case 'error':
            log.error((event as unknown as { log: string }).log)
            break
          case 'warn':
            log.warn((event as unknown as { log: string }).log)
            break
          default:
            break
        }
        break
      default:
        break
    }
  })

  setUserApiList(await getUserApiList())
}
