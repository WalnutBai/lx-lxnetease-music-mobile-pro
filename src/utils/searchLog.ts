import { log } from '@/utils/log'
import settingState from '@/store/setting/state'

export const searchLog = {
  isEnabled: false,

  init() {
    const settingValue = settingState.setting['common.isEnableSearchLog']
    this.isEnabled = settingValue !== undefined ? settingValue : false
  },

  updateEnabled(enabled: boolean) {
    this.isEnabled = enabled
  },

  info(...msgs: any[]) {
    if (!global.lx.isEnableLog) return
    if (!this.isEnabled) return
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    log.info('[Search] ' + msg)
  },

  warn(...msgs: any[]) {
    if (!global.lx.isEnableLog) return
    if (!this.isEnabled) return
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    log.warn('[Search] ' + msg)
  },

  error(...msgs: any[]) {
    if (!global.lx.isEnableLog) return
    if (!this.isEnabled) return
    const msg = msgs
      .map((m) =>
        typeof m == 'string' ? m : m instanceof Error ? (m.stack ?? m.message) : JSON.stringify(m)
      )
      .join(' ')
    log.error('[Search] ' + msg)
  },
}

export default searchLog