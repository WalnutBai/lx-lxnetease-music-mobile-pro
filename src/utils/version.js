import { httpGet } from '@/utils/request'
import { author, name } from '../../package.json'
import { downloadFile, stopDownload, temporaryDirectoryPath, privateStorageDirectoryPath, existsFile, stat } from '@/utils/fs'
import { getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { APP_PROVIDER_NAME } from '@/config/constant'
import { log } from '@/utils/log'

const abis = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86', 'universal']

const address = [
  ['https://gh.llkk.cc/https://raw.githubusercontent.com/WalnutBai/lx-lxwalnut-music-mobile/master/publish/version.json', 'direct'],
  ['https://raw.githubusercontent.com/WalnutBai/lx-lxwalnut-music-mobile/master/publish/version.json', 'direct'],
  ['https://cdn.jsdelivr.net/gh/WalnutBai/lx-lxwalnut-music-mobile/publish/version.json', 'direct'],
  ['https://fastly.jsdelivr.net/gh/WalnutBai/lx-lxwalnut-music-mobile/publish/version.json', 'direct'],
  ['https://gcore.jsdelivr.net/gh/WalnutBai/lx-lxwalnut-music-mobile/publish/version.json', 'direct'],
]

const releaseRepo = 'lx-lxwalnut-music-mobile'
const releaseOwner = 'WalnutBai'
const apkFileNamePrefix = 'lx-lxwalnut-music-mobile'

const request = async (url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(
      url,
      {
        timeout: 10000,
      },
      (err, resp, body) => {
        if (err || resp.statusCode != 200) {
          ++retryNum >= 3
            ? reject(err || new Error(resp.statusMessage || resp.statusCode))
            : request(url, retryNum).then(resolve).catch(reject)
        } else resolve(body)
      }
    )
  })
}

const getDirectInfo = async (url) => {
  return request(url).then((info) => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

const getNpmPkgInfo = async (url) => {
  return request(url).then((json) => {
    if (!json.versionInfo) throw new Error('failed')
    const info = JSON.parse(json.versionInfo)
    if (info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async (index = 0) => {
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
    case 'npm':
      promise = getNpmPkgInfo(url)
      break
  }

  return promise.catch(async (err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

const getTargetAbi = async () => {
  const supportedAbis = await getSupportedAbis()
  for (const abi of abis) {
    if (supportedAbis.includes(abi)) return abi
  }
  return abis[abis.length - 1]
}
let downloadJobId = null
const noop = (total, download) => {}
let apkSavePath

export const downloadNewVersion = async (version, onDownload = noop) => {
  const abi = await getTargetAbi()
  const githubUrl = `https://github.com/${releaseOwner}/${releaseRepo}/releases/download/v${version}/${apkFileNamePrefix}-v${version}-${abi}.apk`
  const urls = [
    `https://gh.llkk.cc/https://github.com/${releaseOwner}/${releaseRepo}/releases/download/v${version}/${apkFileNamePrefix}-v${version}-${abi}.apk`,
    githubUrl,
  ]
  let savePath = privateStorageDirectoryPath + '/lx-lxwalnut-music-mobile.apk'

  log.info(`[Update] Download URLs: ${urls.join(', ')}`)
  log.info(`[Update] Target ABI: ${abi}`)
  log.info(`[Update] Save path: ${savePath}`)
  log.info(`[Update] Private storage directory path: ${privateStorageDirectoryPath}`)

  if (downloadJobId) stopDownload(downloadJobId)

  let lastError = null
  for (const url of urls) {
    let downloadError = null
    let contentLength = 0
    let downloadedBytes = 0
    let httpStatus = null

    log.info(`[Update] Trying download from: ${url}`)

    try {
      const result = await new Promise((resolve, reject) => {
        const { jobId, promise } = downloadFile(url, savePath, {
          progressInterval: 500,
          connectionTimeout: 20000,
          readTimeout: 30000,
          begin({ statusCode, contentLength: len }) {
            httpStatus = statusCode
            log.info(`[Update] Download begin, statusCode: ${statusCode}, contentLength: ${len}`)
            contentLength = len
            if (statusCode !== 200 && statusCode !== 206) {
              downloadError = new Error(`HTTP error ${statusCode}`)
              log.error(`[Update] HTTP error: ${statusCode}`)
            }
            onDownload(len, 0)
          },
          progress({ contentLength: len, bytesWritten }) {
            downloadedBytes = bytesWritten
            log.info(`[Update] Download progress: ${bytesWritten}/${len} (${((bytesWritten/len)*100).toFixed(1)}%)`)
            onDownload(len, bytesWritten)
          },
          resumable() {
            log.info(`[Update] Download is resumable`)
          },
        })
        downloadJobId = jobId

        promise.then(async (result) => {
          if (downloadError) {
            reject(downloadError)
            return
          }

          log.info(`[Update] Download completed, checking file exists...`)
          const fileExists = await existsFile(savePath)
          log.info(`[Update] File exists: ${fileExists}`)

          if (!fileExists) {
            reject(new Error(`Download completed but file not found at ${savePath}`))
            return
          }

          const statInfo = await stat(savePath)
          log.info(`[Update] File stats: ${JSON.stringify(statInfo)}`)

          if (statInfo.size !== contentLength && contentLength > 0) {
            log.warn(`[Update] File size mismatch: expected ${contentLength}, got ${statInfo.size}`)
          }

          apkSavePath = savePath
          resolve(updateApp())
        }).catch(reject)
      })

      return result
    } catch (err) {
      log.error(`[Update] Download failed from ${url}:`, err?.message || err)
      lastError = err
      continue
    }
  }

  log.error(`[Update] All download URLs failed`)
  throw lastError
}

export const updateApp = async () => {
  log.info(`[Update] updateApp called, apkSavePath: ${apkSavePath}`)
  if (!apkSavePath) throw new Error('apk Save Path is null')
  
  const fileExists = await existsFile(apkSavePath)
  log.info(`[Update] APK file exists before install: ${fileExists}`)
  
  if (!fileExists) {
    throw new Error(`APK file not found at: ${apkSavePath}`)
  }
  
  log.info(`[Update] Installing APK from: ${apkSavePath}`)
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
