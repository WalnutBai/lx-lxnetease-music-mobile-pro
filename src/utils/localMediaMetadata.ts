import {temporaryDirectoryPath, readDir, unlink, extname, privateStorageDirectoryPath} from '@/utils/fs'
import { readPic as _readPic } from 'react-native-local-media-metadata'
export {
  type MusicMetadata,
  type MusicMetadataFull,
  readMetadata,
  writeMetadata,
  writePic,
  readLyric,
  writeLyric,
} from 'react-native-local-media-metadata'

let cleared = false
export const picCachePath = privateStorageDirectoryPath + '/local-media-covers';

export const getPicCachePath = () => picCachePath;

export const scanAudioFiles = async (dirPath: string) => {
  const files = await readDir(dirPath)
  // 支持的音频扩展名列表
  const supportedAudioExts = [
    '.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac', '.wma', '.m4b', '.mp4', '.opus'
  ]
  return files
    .filter((file) => {
      if (file.mimeType?.startsWith('audio/')) return true
      const fileExt = extname(file?.name ?? '').toLowerCase()
      if (supportedAudioExts.includes(fileExt)) return true
      return false
    })
    .map((file) => file)
}

const clearPicCache = async () => {
  await unlink(picCachePath)
  cleared = true
}

export const readPic = async (filePath: string): Promise<string> => {
  const processedPath = filePath.includes('#')
    ? filePath.replace(/#/g, '%23')
    : filePath;
  let path = await _readPic(processedPath, picCachePath);

  if (path && !path.startsWith('file://') && path.startsWith('/')) {
    path = `file://${path}`;
  }
  return path;
}
