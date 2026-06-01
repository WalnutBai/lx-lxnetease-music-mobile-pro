import { getData, saveData } from '@/plugins/storage'
import { createClient, FileStat } from 'webdav'
import settingState from '@/store/setting/state'
import { webDAVLog, initWebDAVLog } from './logger'

const CONFIG_KEY = '@webdav_music_config'
const audioExts = new Set([
  'mp3',
  'flac',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'wma',
  'ape',
])

function getClient() {
  const settings = settingState.setting
  const url = settings['sync.webdav.url']
  const username = settings['sync.webdav.username']
  const password = settings['sync.webdav.password']

  webDAVLog.info('getClient called', { url, username: username ? '***' : undefined })

  if (!url || !username) {
    webDAVLog.error('WebDAV 未配置')
    throw new Error('WebDAV 未配置')
  }

  return createClient(url, { username, password })
}

const normalizePath = (path: string | undefined, name: string) => {
  return path ? `${path}/${name}` : `/${name}`
}

const getExt = (name: string) => {
  const ext = name.split('.').pop()
  return ext && ext != name ? ext.toLowerCase() : ''
}

const parseFileName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.')
  const rawName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  if (!rawName.includes('-')) return { name: rawName.trim(), singer: '' }
  const [left, ...rest] = rawName.split('-')
  return {
    name: left.trim(),
    singer: rest.join('-').trim(),
  }
}

export const getWebDAVConfig = async (): Promise<LX.WebDAV.Config> => {
  const config = (await getData<LX.WebDAV.Config>(CONFIG_KEY)) ?? {
    selectedFolder: null,
    songs: [],
  }
  config.songs = (config.songs ?? []).map(normalizeWebDAVMusicInfo)
  return config
}

export const saveWebDAVConfig = async (config: LX.WebDAV.Config) => {
  await saveData(CONFIG_KEY, config)
}

export const listWebDAVFolders = async (folder?: LX.WebDAV.DriveFolder | null) => {
  webDAVLog.info('listWebDAVFolders called', { folderPath: folder?.path })
  const client = getClient()
  const basePath = folder?.path ?? '/'
  
  let contents: Array<FileStat & { type: string }>
  try {
    contents = await client.getDirectoryContents(basePath) as Array<FileStat & { type: string }>
    webDAVLog.info('listWebDAVFolders success', { basePath, count: contents.length })
  } catch (error: any) {
    webDAVLog.error('listWebDAVFolders error', { error, status: error.status })
    if (error.status === 404 || error.status === 409) {
      return []
    }
    throw error
  }
  
  return contents
    .filter(item => item.type === 'directory')
    .sort((a, b) => a.basename.localeCompare(b.basename))
    .map<LX.WebDAV.DriveFolder>(item => ({
      id: item.filename,
      name: item.basename,
      parentId: folder?.id,
      path: normalizePath(folder?.path, item.basename),
    }))
}

export const saveWebDAVSelectedFolder = async (folder: LX.WebDAV.DriveFolder | null) => {
  const config = await getWebDAVConfig()
  config.selectedFolder = folder
  await saveWebDAVConfig(config)
  return config
}

const toMusicInfo = (item: FileStat, path: string): LX.WebDAV.MusicInfo => {
  const ext = getExt(item.basename)
  const title = parseFileName(item.basename)
  const modifiedTime = item.lastmod ? new Date(item.lastmod).getTime() : 0
  return {
    id: `webdav_${item.filename}`,
    name: title.name,
    singer: title.singer,
    source: 'local',
    interval: null,
    meta: {
      webdav: true,
      fileName: item.basename,
      filePath: path,
      remotePath: path, // 保存原始的 WebDAV 路径
      ext,
      size: item.size,
      lastModifiedTime: modifiedTime,
      songId: path,
      albumName: '',
    },
  }
}

export const normalizeWebDAVMusicInfo = (musicInfo: LX.WebDAV.MusicInfo) => {
  const title = parseFileName(musicInfo.meta.fileName || musicInfo.name)
  return {
    ...musicInfo,
    name: title.name,
    singer: title.singer,
    meta: {
      ...musicInfo.meta,
    },
  }
}

const scanFolder = async (
  folder: LX.WebDAV.DriveFolder | null,
  onProgress?: (count: number, folderPath: string) => void
) => {
  webDAVLog.info('scanFolder called', { folderPath: folder?.path })
  const client = getClient()
  const result: LX.WebDAV.MusicInfo[] = []
  const basePath = folder?.path ?? '/'
  
  let contents: Array<FileStat & { type: string }>
  try {
    contents = await client.getDirectoryContents(basePath) as Array<FileStat & { type: string }>
    webDAVLog.info('scanFolder got directory contents', { basePath, count: contents.length })
  } catch (error: any) {
    webDAVLog.error('scanFolder error', { error, status: error.status })
    if (error.status === 404 || error.status === 409) {
      return result
    }
    throw error
  }
  
  for (const item of contents) {
    const path = normalizePath(folder?.path, item.basename)
    if (item.type === 'directory') {
      result.push(
        ...(await scanFolder(
          { id: item.filename, name: item.basename, parentId: folder?.id, path },
          onProgress
        ))
      )
      onProgress?.(result.length, path)
      continue
    }
    if (item.type !== 'file') continue
    const ext = getExt(item.basename)
    if (!audioExts.has(ext)) continue
    result.push(toMusicInfo(item, path))
  }
  webDAVLog.info('scanFolder completed', { basePath, songCount: result.length })
  return result
}

export const scanWebDAVSongs = async (
  folder: LX.WebDAV.DriveFolder | null,
  onProgress?: (count: number, folderPath: string) => void
) => {
  const songs = await scanFolder(folder, onProgress)
  songs.sort((a, b) => b.meta.lastModifiedTime - a.meta.lastModifiedTime)

  const config = await getWebDAVConfig()
  const existingSongsMap = new Map<string, LX.WebDAV.MusicInfo>()
  for (const song of config.songs ?? []) {
    existingSongsMap.set(song.id, song)
  }
  
  const mergedSongs = songs.map(newSong => {
    const existingSong = existingSongsMap.get(newSong.id)
    if (existingSong) {
      return {
        ...newSong,
        meta: {
          ...newSong.meta,
          ...existingSong.meta,
        },
      }
    }
    return newSong
  })
  
  config.selectedFolder = folder
  config.songs = mergedSongs
  config.scannedAt = Date.now()
  await saveWebDAVConfig(config)
  webDAVLog.info('scanWebDAVSongs: merged songs', { 
    newCount: songs.length, 
    existingCount: existingSongsMap.size,
    mergedCount: mergedSongs.length 
  })
  return config
}

export const getWebDAVDownloadUrl = (musicInfo: LX.WebDAV.MusicInfo) => {
  webDAVLog.info('getWebDAVDownloadUrl called', { musicId: musicInfo.id, fileName: musicInfo.meta.fileName, filePath: musicInfo.meta.filePath, remotePath: musicInfo.meta.remotePath, songId: musicInfo.meta.songId })
  const settings = settingState.setting
  const url = settings['sync.webdav.url']
  
  // 优先使用 remotePath，其次是 songId，最后是 filePath
  let remoteFilePath = String(musicInfo.meta.remotePath || musicInfo.meta.songId || musicInfo.meta.filePath)
  
  if (!remoteFilePath.startsWith('/')) {
    remoteFilePath = '/' + remoteFilePath
    webDAVLog.info('getWebDAVDownloadUrl normalized remoteFilePath', { original: musicInfo.meta.remotePath || musicInfo.meta.songId || musicInfo.meta.filePath, normalized: remoteFilePath })
  }
  
  // 检查路径是否是本地路径（包含 /storage/emulated/ 或 /sdcard/）
  if (remoteFilePath.includes('/storage/emulated/') || remoteFilePath.includes('/sdcard/') || remoteFilePath.includes('/storage/self/')) {
    webDAVLog.warn('getWebDAVDownloadUrl: detected local path in remoteFilePath, using songId instead', { remoteFilePath, songId: musicInfo.meta.songId })
    remoteFilePath = String(musicInfo.meta.songId || musicInfo.meta.filePath)
    if (!remoteFilePath.startsWith('/')) {
      remoteFilePath = '/' + remoteFilePath
    }
  }
  
  if (!url) {
    webDAVLog.error('getWebDAVDownloadUrl: WebDAV 未配置')
    throw new Error('WebDAV 未配置')
  }
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url
  const encodedFilePath = encodeURIComponent(remoteFilePath.substring(1))
  const downloadUrl = `${baseUrl}/${encodedFilePath}`
  webDAVLog.info('getWebDAVDownloadUrl result', { downloadUrl, encodedFilePath, remoteFilePath })
  return downloadUrl
}

export interface WebDAVMusicMetaUpdate {
  picUrl?: string
  filePath?: string
}

export const updateWebDAVMusicMeta = async (musicId: string, update: WebDAVMusicMetaUpdate): Promise<void> => {
  webDAVLog.info('updateWebDAVMusicMeta called', { musicId, update })
  const config = await getWebDAVConfig()
  const songIndex = config.songs.findIndex(song => song.id === musicId)
  if (songIndex === -1) {
    webDAVLog.warn('updateWebDAVMusicMeta: song not found', { musicId })
    return
  }
  
  const song = config.songs[songIndex]
  if (update.picUrl !== undefined) {
    song.meta.picUrl = update.picUrl
  }
  if (update.filePath !== undefined) {
    song.meta.filePath = update.filePath
  }
  
  config.songs[songIndex] = song
  await saveWebDAVConfig(config)
  webDAVLog.info('updateWebDAVMusicMeta: updated successfully', { musicId })
}
