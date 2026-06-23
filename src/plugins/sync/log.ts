import { log as writeLog } from '@/utils/log'

export default {
  r_info(...params: any[]) {
    if (!global.lx.isEnableLog) return
    writeLog.info(...params)
  },
  r_warn(...params: any[]) {
    if (!global.lx.isEnableLog) return
    writeLog.warn(...params)
  },
  r_error(...params: any[]) {
    if (!global.lx.isEnableLog) return
    writeLog.error(...params)
  },
  info(...params: any[]) {
    if (!global.lx.isEnableLog) return
    if (!global.lx.isEnableSyncLog) return
    writeLog.info(...params)
  },
  warn(...params: any[]) {
    if (!global.lx.isEnableLog) return
    if (!global.lx.isEnableSyncLog) return
    writeLog.warn(...params)
  },
  error(...params: any[]) {
    if (!global.lx.isEnableLog) return
    if (!global.lx.isEnableSyncLog) return
    writeLog.error(...params)
  },
}
