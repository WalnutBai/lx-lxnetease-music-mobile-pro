import { saveLyric, saveMusicUrl } from '@/utils/data'
import { updateListMusics } from '@/core/list'
import {
  buildLyricInfo,
  getCachedLyricInfo,
  getOnlineOtherSourceLyricByLocal,
  getOnlineOtherSourceLyricInfo,
  getOnlineOtherSourceMusicUrl,
  getOnlineOtherSourceMusicUrlByLocal,
  getOnlineOtherSourcePicByLocal,
  getOnlineOtherSourcePicUrl,
  getOtherSource,
} from './utils'
import { getLocalFilePath } from '@/utils/music'
import { readLyric, readPic } from '@/utils/localMediaMetadata'
import { stat, existsFile, mkdir, writeFile, readDir } from '@/utils/fs'
import { requestStoragePermission } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { btoa } from 'react-native-quick-base64'
import playerState from '@/store/player/state'
import appEvent from '@/event/appEvent'

let webDAVModule: typeof import('@/core/webdavMusic/drive') | null = null
let webDAVLog: {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
} | null = null

const loadWebDAVModule = async () => {
  if (!webDAVModule) {
    webDAVModule = await import('@/core/webdavMusic/drive')
    const logger = await import('@/core/webdavMusic/logger')
    webDAVLog = logger.webDAVLog
  }
  return webDAVModule
}

const getOtherSourceByLocal = async <T>(
  musicInfo: LX.Music.MusicInfoLocal,
  handler: (infos: LX.Music.MusicInfoOnline[]) => Promise<T>
) => {
  let result: LX.Music.MusicInfoOnline[] = []
  result = await getOtherSource(musicInfo)
  if (result.length)
    try {
      return await handler(result)
    } catch {}
  if (musicInfo.name.includes('-')) {
    const [name, singer] = musicInfo.name.split('-').map((val) => val.trim())
    result = await getOtherSource(
      {
        ...musicInfo,
        name,
        singer,
      },
      true
    )
    if (result.length)
      try {
        return await handler(result)
      } catch {}
    result = await getOtherSource(
      {
        ...musicInfo,
        name: singer,
        singer: name,
      },
      true
    )
    if (result.length)
      try {
        return await handler(result)
      } catch {}
  }
  let fileName =
    (await stat(musicInfo.meta.filePath).catch(() => ({ name: null }))).name ??
    musicInfo.meta.filePath.split(/\/|\\/).at(-1)
  if (fileName) {
    fileName = fileName.substring(0, fileName.lastIndexOf('.'))
    if (fileName != musicInfo.name) {
      if (fileName.includes('-')) {
        const [name, singer] = fileName.split('-').map((val) => val.trim())
        result = await getOtherSource(
          {
            ...musicInfo,
            name,
            singer,
          },
          true
        )
        if (result.length)
          try {
            return await handler(result)
          } catch {}
        result = await getOtherSource(
          {
            ...musicInfo,
            name: singer,
            singer: name,
          },
          true
        )
      } else {
        result = await getOtherSource(
          {
            ...musicInfo,
            name: fileName,
            singer: '',
          },
          true
        )
      }
      if (result.length)
        try {
          return await handler(result)
        } catch {}
    }
  }

  throw new Error('source not found')
}

const downloadWebDAVMusic = async (musicInfo: LX.WebDAV.MusicInfo): Promise<string> => {
  const module = await loadWebDAVModule()
  const { getWebDAVDownloadUrl, updateWebDAVMusicMeta } = module
  const { downloadFile } = await import('@/utils/fs')
  const { readMetadata } = await import('@/utils/localMediaMetadata')
  
  // 请求存储权限
  const hasPermission = await requestStoragePermission()
  if (!hasPermission) {
    throw new Error('没有存储权限，无法下载音乐')
  }
  
  const downloadUrl = getWebDAVDownloadUrl(musicInfo)
  
  // 优先使用 WebDAV 专用路径配置，默认使用私有目录
  const webdavPath = settingState.setting['webdav.downloadPath']
  let downloadDir = ''
  if (webdavPath && typeof webdavPath === 'string' && webdavPath.trim()) {
    downloadDir = webdavPath.trim()
  } else {
    // 使用私有目录作为默认路径
    const { getWebDAVPrivateDirectory } = await import('@/utils/fs')
    downloadDir = getWebDAVPrivateDirectory()
  }
  
  webDAVLog?.info('downloadWebDAVMusic: using download directory', { downloadDir, webdavPath })
  
  const fileName = musicInfo.meta.fileName
  
  let filePath = `${downloadDir}/${fileName}`

  if (downloadPromises.has(filePath)) {
    webDAVLog?.info('downloadWebDAVMusic: waiting for existing download', { filePath })
    return downloadPromises.get(filePath)!
  }

  webDAVLog?.info('downloadWebDAVMusic called', { musicId: musicInfo.id, fileName, filePath })

  if (await existsFile(filePath)) {
    webDAVLog?.info('downloadWebDAVMusic: file exists locally', { filePath })
    return filePath
  }

  webDAVLog?.info('downloadWebDAVMusic: starting new download', { filePath })
  const downloadPromise = (async () => {
    try {
      await mkdir(downloadDir)
      webDAVLog?.info('downloadWebDAVMusic: download directory created', { downloadDir })

      const username = settingState.setting['sync.webdav.username']
      const password = settingState.setting['sync.webdav.password']
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36',
      }
      if (username && password) {
        headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`)
      }

      webDAVLog?.info('downloadWebDAVMusic: fetching file', { downloadUrl, filePath })
      await downloadFile(downloadUrl, filePath, { headers }).promise

      webDAVLog?.info('downloadWebDAVMusic: download completed successfully', { filePath })

      // 读取文件元数据（包括专辑名称等信息）
      const fileMetadata = await readMetadata(filePath).catch(() => null)
      webDAVLog?.info('downloadWebDAVMusic: read file metadata', { metadata: fileMetadata })
      
      const updates: Record<string, any> = { filePath }
      
      // 如果文件中有专辑信息，更新到配置
      if (fileMetadata) {
        if (fileMetadata.albumName) {
          updates.albumName = fileMetadata.albumName
          webDAVLog?.info('downloadWebDAVMusic: found album name in file', { albumName: fileMetadata.albumName })
        }
        if (fileMetadata.name && !musicInfo.name) {
          updates.name = fileMetadata.name
          webDAVLog?.info('downloadWebDAVMusic: found song name in file', { name: fileMetadata.name })
        }
        if (fileMetadata.singer && !musicInfo.singer) {
          updates.singer = fileMetadata.singer
          webDAVLog?.info('downloadWebDAVMusic: found singer in file', { singer: fileMetadata.singer })
        }
      }
      
      // 更新配置中的文件路径和元数据
      await updateWebDAVMusicMeta(musicInfo.id, updates)

      // 提取并保存内嵌封面
      await readEmbeddedCoverAndSave(musicInfo, filePath, updateWebDAVMusicMeta)

      // 更新播放器状态中的音乐信息
      if (playerState.playMusicInfo.musicInfo?.id === musicInfo.id) {
        webDAVLog?.info('downloadWebDAVMusic: updating player state with new filePath', { filePath })
        const playerAction = await import('@/store/player/action')
        const updatedMusicInfo = { ...playerState.playMusicInfo.musicInfo }
        if (updatedMusicInfo && updatedMusicInfo.meta) {
          updatedMusicInfo.meta.filePath = filePath
        }
        playerAction.default.setPlayMusicInfo(playerState.playMusicInfo.listId, updatedMusicInfo, playerState.playMusicInfo.isTempPlay)
      }

      return filePath
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : ''
      webDAVLog?.error('downloadWebDAVMusic: error occurred', {
        message: errorMessage,
        stack: errorStack,
        errorType: error?.constructor?.name,
        errorString: String(error)
      })
      throw error
    } finally {
      downloadPromises.delete(filePath)
    }
  })()

  downloadPromises.set(filePath, downloadPromise)
  return downloadPromise
}

const downloadPromises = new Map<string, Promise<string>>()

const readEmbeddedCoverAndSave = async (
  musicInfo: LX.WebDAV.MusicInfo,
  filePath: string,
  updateWebDAVMetaFn: typeof import('@/core/webdavMusic/drive').updateWebDAVMusicMeta
) => {
  try {
    webDAVLog?.info('readEmbeddedCoverAndSave: reading embedded cover', { musicId: musicInfo.id, filePath })
    const picPath = await readPic(filePath)
    if (picPath) {
      webDAVLog?.info('readEmbeddedCoverAndSave: found embedded cover', { picPath })
      const updatedPicUrl = picPath.startsWith('/') ? `file://${picPath}` : picPath
      await updateWebDAVMetaFn(musicInfo.id, { picUrl: updatedPicUrl })
      webDAVLog?.info('readEmbeddedCoverAndSave: saved cover to meta', { picUrl: updatedPicUrl })

      if (playerState.playMusicInfo.musicInfo?.id === musicInfo.id) {
        webDAVLog?.info('readEmbeddedCoverAndSave: triggering pic update for current playing song')
        global.app_event.picUpdated()
      }
    } else {
      webDAVLog?.info('readEmbeddedCoverAndSave: no embedded cover found, will use online source')
    }
  } catch (error) {
    webDAVLog?.warn('readEmbeddedCoverAndSave: failed to read embedded cover', { error })
  }
}

export const getMusicUrl = async ({
  musicInfo,
  isRefresh,
  allowToggleSource = true,
  onToggleSource = () => {},
}: {
  musicInfo: LX.Music.MusicInfoLocal
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  allowToggleSource?: boolean
}): Promise<string> => {
  if (!isRefresh) {
    const isWebDAV = 'webdav' in musicInfo.meta && (musicInfo.meta as any).webdav === true
    if (isWebDAV) {
      webDAVLog?.info('getMusicUrl: detected WebDAV music, calling downloadWebDAVMusic', { musicId: musicInfo.id })
      return downloadWebDAVMusic(musicInfo as LX.WebDAV.MusicInfo)
    }

    const path = await getLocalFilePath(musicInfo)
    if (path) return path
  }

  try {
    return await getOnlineOtherSourceMusicUrlByLocal(musicInfo, isRefresh).then(
      ({ url, quality, isFromCache }) => {
        if (!isFromCache) void saveMusicUrl(musicInfo, quality, url)
        return url
      }
    )
  } catch {}

  if (!allowToggleSource) throw new Error('failed')

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async (otherSource) => {
    return getOnlineOtherSourceMusicUrl({
      musicInfos: [...otherSource],
      onToggleSource,
      isRefresh,
    }).then(({ url, quality: targetQuality, musicInfo: targetMusicInfo, isFromCache }) => {
      // saveLyric(musicInfo, data.lyricInfo)
      if (!isFromCache) void saveMusicUrl(targetMusicInfo, targetQuality, url)

      // TODO: save url ?
      return url
    })
  })
}

export const getPicUrl = async ({
  musicInfo,
  listId,
  isRefresh,
  skipFilePic,
  onToggleSource = () => {},
}: {
  musicInfo: LX.Music.MusicInfoLocal
  listId?: string | null
  isRefresh: boolean
  skipFilePic?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  const isWebDAVMusic = 'webdav' in musicInfo.meta && (musicInfo.meta as any).webdav === true
  
  if (!isRefresh && !skipFilePic) {
    if (isWebDAVMusic) {
      const { picCachePath, readPic: extractPic } = await import('@/utils/localMediaMetadata')
      
      // 第1步：优先检查 local-media-covers 目录下是否有同名图片
      const audioFileName = musicInfo.meta.fileName?.replace(/\.[^/.]+$/, '') || musicInfo.name
      const coverExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
      let foundPicUrl = ''
      
      try {
        const coverFiles = await readDir(picCachePath).catch(() => [])
        for (const file of coverFiles) {
          const fileName = file.name || ''
          const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
          const baseName = fileName.substring(0, fileName.lastIndexOf('.'))
          
          if (coverExtensions.includes(ext) && baseName.includes(audioFileName)) {
            foundPicUrl = `file://${picCachePath}/${fileName}`
            webDAVLog?.info('getPicUrl: found cover in cache', { audioFileName, picUrl: foundPicUrl })
            break
          }
        }
      } catch (err) {
        webDAVLog?.warn('getPicUrl: failed to read cover cache dir', { err })
      }
      
      // 如果找到封面，直接返回
      if (foundPicUrl) {
        return foundPicUrl
      }
      
      // 第2步：如果没有找到，检查 WebDAV 下载路径下是否有 MP3 文件
      const webdavPath = settingState.setting['webdav.downloadPath']
      let downloadDir = ''
      if (webdavPath && typeof webdavPath === 'string' && webdavPath.trim()) {
        downloadDir = webdavPath.trim()
      } else {
        const { getWebDAVPrivateDirectory } = await import('@/utils/fs')
        downloadDir = getWebDAVPrivateDirectory()
      }
      const audioFilePath = musicInfo.meta.filePath
      let targetFilePath = audioFilePath
      
      // 如果音频文件路径不存在，尝试在下载目录查找
      if (audioFilePath) {
        const audioExists = await existsFile(audioFilePath).catch(() => false)
        if (!audioExists) {
          webDAVLog?.warn('getPicUrl: original audio file not found, trying download dir', { audioFilePath, downloadDir })
          targetFilePath = `${downloadDir}/${musicInfo.meta.fileName}`
        }
      } else {
        targetFilePath = `${downloadDir}/${musicInfo.meta.fileName}`
      }
      
      // 第3步：检查目标文件是否存在，如果存在则提取封面
      const targetExists = await existsFile(targetFilePath).catch(() => false)
      if (targetExists) {
        webDAVLog?.info('getPicUrl: found audio file, extracting cover', { targetFilePath })
        try {
          const pic = await extractPic(targetFilePath)
          if (pic) {
            const picUrl = pic.startsWith('/') ? `file://${pic}` : pic
            webDAVLog?.info('getPicUrl: extracted cover from audio', { picUrl })
            
            // 保存封面路径到配置
            const module = await loadWebDAVModule()
            void module.updateWebDAVMusicMeta(musicInfo.id, { picUrl })
            
            // 触发全局事件通知列表页和详情页更新
            appEvent.webdavPicUpdated(musicInfo.id, picUrl)
            
            return picUrl
          }
        } catch (err) {
          webDAVLog?.warn('getPicUrl: failed to extract cover', { err })
        }
      } else {
        webDAVLog?.warn('getPicUrl: audio file not found in download dir', { targetFilePath })
      }
      
      // 第4步：尝试使用配置中的 picUrl
      if (musicInfo.meta.picUrl) {
        if (musicInfo.meta.picUrl.startsWith('file://')) {
          const picFilePath = musicInfo.meta.picUrl.replace('file://', '')
          const picExists = await existsFile(picFilePath).catch(() => false)
          if (picExists) {
            webDAVLog?.info('getPicUrl: using cached picUrl', { picUrl: musicInfo.meta.picUrl })
            return musicInfo.meta.picUrl
          }
        } else {
          webDAVLog?.info('getPicUrl: using online picUrl', { picUrl: musicInfo.meta.picUrl })
          return musicInfo.meta.picUrl
        }
      }
      
      // 第5步：都没有，返回空
      webDAVLog?.info('getPicUrl: no cover found, return empty')
      return ''
    }

    // 非 WebDAV 音乐的封面获取逻辑保持不变
    let pic = await readPic(musicInfo.meta.filePath).catch(() => null)        
    if (pic) {
      if (pic.startsWith('/')) pic = `file://${pic}`
      return pic
    }

    if (musicInfo.meta.picUrl) return musicInfo.meta.picUrl
  }

  if (isWebDAVMusic) {
    webDAVLog?.info('getPicUrl: WebDAV music has no local cover, return empty (use manual fetch)')
    return ''
  }

  try {
    const result = await getOnlineOtherSourcePicByLocal(musicInfo)
    webDAVLog?.info('getPicUrl: fetched online cover', { url: result.url })
    return result.url
  } catch (err) {
    webDAVLog?.warn('getPicUrl: getOnlineOtherSourcePicByLocal failed', { err })
  }

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async (otherSource) => {
    return getOnlineOtherSourcePicUrl({
      musicInfos: [...otherSource],
      onToggleSource,
      isRefresh,
    }).then(async ({ url, musicInfo: targetMusicInfo, isFromCache }) => {
      return url
    })
  })
}

const getMusicFileLyric = async (filePath: string) => {
  const lyric = await readLyric(filePath).catch(() => null)
  if (!lyric) return null
  return {
    lyric,
  }
}
export const getLyricInfo = async ({
  musicInfo,
  isRefresh,
  skipFileLyric,
  onToggleSource = () => {},
}: {
  musicInfo: LX.Music.MusicInfoLocal
  skipFileLyric?: boolean
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  const isWebDAVMusic = 'webdav' in musicInfo.meta && (musicInfo.meta as any).webdav === true

  if (!isRefresh && !skipFileLyric) {
    // WebDAV 音乐特殊处理
    if (isWebDAVMusic) {
      // 第1步：检查缓存歌词
      const lyricInfo = await getCachedLyricInfo(musicInfo)
      if (lyricInfo?.lyric) {
        webDAVLog?.info('getLyricInfo: WebDAV music using cached lyric', { musicId: musicInfo.id })
        return buildLyricInfo(lyricInfo)
      }

      // 第2步：检查本地下载的文件是否有内嵌歌词
      const webdavPath = settingState.setting['webdav.downloadPath']
      let downloadDir = ''
      if (webdavPath && typeof webdavPath === 'string' && webdavPath.trim()) {
        downloadDir = webdavPath.trim()
      } else {
        const { getWebDAVPrivateDirectory } = await import('@/utils/fs')
        downloadDir = getWebDAVPrivateDirectory()
      }
      const audioFilePath = musicInfo.meta.filePath
      let targetFilePath = audioFilePath

      if (audioFilePath) {
        const audioExists = await existsFile(audioFilePath).catch(() => false)
        if (!audioExists) {
          targetFilePath = `${downloadDir}/${musicInfo.meta.fileName}`
        }
      } else {
        targetFilePath = `${downloadDir}/${musicInfo.meta.fileName}`
      }

      const targetExists = await existsFile(targetFilePath).catch(() => false)
      if (targetExists) {
        webDAVLog?.info('getLyricInfo: WebDAV music reading lyric from local file', { targetFilePath })
        const rawlrcInfo = await getMusicFileLyric(targetFilePath)
        if (rawlrcInfo) {
          webDAVLog?.info('getLyricInfo: WebDAV music found embedded lyric', { musicId: musicInfo.id })
          return buildLyricInfo(rawlrcInfo)
        }
      }

      // 第3步：尝试在线获取歌词（AI识别）
      webDAVLog?.info('getLyricInfo: WebDAV music fetching lyric from online source', { musicId: musicInfo.id })
      try {
        return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(
          ({ lyricInfo, isFromCache }) => {
            if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
            webDAVLog?.info('getLyricInfo: WebDAV music fetched lyric successfully', { musicId: musicInfo.id })
            return buildLyricInfo(lyricInfo)
          }
        )
      } catch (err) {
        webDAVLog?.warn('getLyricInfo: WebDAV music online lyric fetch failed', { err })
      }

      // 第4步：尝试其他来源
      onToggleSource()
      return getOtherSourceByLocal(musicInfo, async (otherSource) => {
        return getOnlineOtherSourceLyricInfo({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
        }).then(async ({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
          void saveLyric(musicInfo, lyricInfo)
          if (!isFromCache) void saveLyric(targetMusicInfo, lyricInfo)
          return buildLyricInfo(lyricInfo)
        })
      })
    }

    // 非 WebDAV 音乐的歌词获取逻辑保持不变
    const rawlrcInfo = await getMusicFileLyric(musicInfo.meta.filePath)
    if (rawlrcInfo) return buildLyricInfo(rawlrcInfo)

    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo?.lyric) return buildLyricInfo(lyricInfo)
  }

  try {
    return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(
      ({ lyricInfo, isFromCache }) => {
        if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
        return buildLyricInfo(lyricInfo)
      }
    )
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async (otherSource) => {
    return getOnlineOtherSourceLyricInfo({
      musicInfos: [...otherSource],
      onToggleSource,
      isRefresh,
    }).then(async ({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
      void saveLyric(musicInfo, lyricInfo)

      if (isFromCache) return buildLyricInfo(lyricInfo)
      void saveLyric(targetMusicInfo, lyricInfo)

      return buildLyricInfo(lyricInfo)
    })
  })
}
