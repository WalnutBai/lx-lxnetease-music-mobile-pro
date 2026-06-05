export function getFileExtension(quality: LX.Quality) {
  switch (quality) {
    case '128k':
    case '320k':
      return 'mp3'
    default:
      return 'flac'
  }
}

export function getFileExtensionFromUrl(url: string) {
  const match = url.match(/\.([0-9a-z]+)(?=[?#]|$)/i)
  if (match) {
    const ext = match[1].toLowerCase();
    // 常用音频格式
    const audioExts = ['mp3', 'm4a', 'flac', 'wav', 'ogg', 'aac', 'wma', 'm4b', 'mp4', 'm4s'];
    // 常用图片格式
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    
    if (audioExts.includes(ext)) {
      // 对于 bilibili 的 m4s 格式，我们将其视为 mp3
      if (ext === 'm4s') return 'mp3';
      return ext;
    }
    if (imageExts.includes(ext)) return ext;
    return ext; // 其他格式直接返回
  }
  // 如果无法匹配，尝试根据 URL 特征判断
  if (url.includes('bilibili') || url.includes('bilivideo')) {
    return 'mp3'; // bilibili 音频保存为 mp3 格式
  }
  return 'mp3'; // 默认音频格式
}
