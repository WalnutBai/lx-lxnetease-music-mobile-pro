import { log } from '@/utils/log'
import settingState from '@/store/setting/state'

export const webDAVLog = {
  info(...msgs: unknown[]) {
    if (!global.lx.isEnableLog) return
    if (!settingState.setting['common.isEnableWebDAVLog']) return
    log.info(`[WebDAV] ${msgs.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ')}`)
  },
  warn(...msgs: unknown[]) {
    if (!global.lx.isEnableLog) return
    if (!settingState.setting['common.isEnableWebDAVLog']) return
    log.warn(`[WebDAV] ${msgs.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ')}`)
  },
  error(...msgs: unknown[]) {
    if (!global.lx.isEnableLog) return
    if (!settingState.setting['common.isEnableWebDAVLog']) return
    log.error(`[WebDAV] ${msgs.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ')}`)
  },
}

export const initWebDAVLog = async () => {
}

export const clearWebDAVLogs = async () => {
}
