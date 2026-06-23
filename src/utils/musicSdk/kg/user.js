/**
 * 酷狗音乐用户模块适配层
 *
 * 封装 kg/utils/api.ts 中与歌单同步相关的方法，
 * 对外暴露与 wy/tx user 模块一致的方法签名，
 * 使 kg 模块可通过 musicSdk.kg.user 统一访问。
 */
import {
  getUserPlaylists as kgGetUserPlaylists,
  addSongToPlaylist as kgAddSongToPlaylist,
  removeSongsFromPlaylist as kgRemoveSongsFromPlaylist,
  subscribePlaylist as kgSubscribePlaylist,
  unsubscribePlaylist as kgUnsubscribePlaylist,
  getPlaylistSongs as kgGetPlaylistSongs,
  sendCaptcha as kgSendCaptcha,
  loginByPhone as kgLoginByPhone,
  refreshToken as kgRefreshToken,
  getVerifyInfo as kgGetVerifyInfo,
  verifyUserInfo as kgVerifyUserInfo,
  buildCookieString as kgBuildCookieString,
} from './utils/api'

export default {
  /**
   * 获取用户歌单列表
   * @param {string} cookie - 酷狗 Cookie 字符串
   * @returns {Promise<{createdList: Array, collectedList: Array, total: number}>}
   */
  async getUserPlaylists(cookie) {
    const result = await kgGetUserPlaylists(cookie)
    if (!result.success) throw new Error(result.message || '获取歌单失败')
    return {
      createdList: result.data?.createdList || [],
      collectedList: result.data?.collectedList || [],
      total: result.data?.total || 0,
    }
  },

  /**
   * 添加歌曲到歌单
   * @param {string} cookie - 酷狗 Cookie 字符串
   * @param {string|number} listId - 歌单 ID
   * @param {object} songInfo - 歌曲信息 { name, hash, album_id?, mixsongid? }
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async addSongToPlaylist(cookie, listId, songInfo) {
    const result = await kgAddSongToPlaylist(cookie, Number(listId), songInfo)
    if (!result.success) throw new Error(result.message || '添加歌曲失败')
    return result
  },

  /**
   * 从歌单删除歌曲
   * @param {string} cookie - 酷狗 Cookie 字符串
   * @param {string|number} listId - 歌单 ID
   * @param {Array<number>} fileIds - 要删除的歌曲 fileid 数组
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async removeSongsFromPlaylist(cookie, listId, fileIds) {
    const result = await kgRemoveSongsFromPlaylist(cookie, Number(listId), fileIds.map(id => Number(id)))
    if (!result.success) throw new Error(result.message || '删除歌曲失败')
    return result
  },

  /**
   * 收藏歌单 / 新建歌单
   * @param {string} cookie - 酷狗 Cookie 字符串
   * @param {object} playlistInfo - 歌单信息
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async subscribePlaylist(cookie, playlistInfo) {
    const result = await kgSubscribePlaylist(cookie, playlistInfo)
    if (!result.success) throw new Error(result.message || '收藏歌单失败')
    return result
  },

  /**
   * 取消收藏歌单 / 删除歌单
   * @param {string} cookie - 酷狗 Cookie 字符串
   * @param {string|number} listId - 歌单 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async unsubscribePlaylist(cookie, listId) {
    const result = await kgUnsubscribePlaylist(cookie, Number(listId))
    if (!result.success) throw new Error(result.message || '取消收藏歌单失败')
    return result
  },

  /**
   * 获取歌单歌曲列表
   * @param {string} cookie - 酷狗 Cookie 字符串
   * @param {string} globalCollectionId - 歌单全局 ID
   * @param {number} [page=1] - 页码
   * @param {number} [pagesize=100] - 每页数量
   * @returns {Promise<{list: Array, total: number}>}
   */
  async getPlaylistSongs(cookie, globalCollectionId, page = 1, pagesize = 100) {
    const result = await kgGetPlaylistSongs(cookie, globalCollectionId, page, pagesize)
    if (!result.success) throw new Error(result.message || '获取歌单歌曲失败')
    return {
      list: result.data?.list || [],
      total: result.data?.total || 0,
    }
  },

  /**
   * 发送验证码
   * @param {string} mobile - 手机号
   * @returns {Promise<{success: boolean, message: string, ssaCode?: string}>}
   */
  async sendCaptcha(mobile) {
    return kgSendCaptcha(mobile)
  },

  /**
   * 手机号登录
   * @param {string} mobile - 手机号
   * @param {string} code - 验证码
   * @returns {Promise<{success: boolean, data?: object, message: string}>}
   */
  async loginByPhone(mobile, code) {
    return kgLoginByPhone(mobile, code)
  },

  /**
   * 刷新 Token
   * @param {string} token - 当前 token
   * @param {string} userid - 用户 ID
   * @returns {Promise<{success: boolean, data?: object, message: string}>}
   */
  async refreshToken(token, userid) {
    return kgRefreshToken(token, userid)
  },

  /**
   * 获取验证信息
   * @param {string} eventid - 事件 ID
   * @returns {Promise<{success: boolean, data?: object, message: string}>}
   */
  async getVerifyInfo(eventid) {
    return kgGetVerifyInfo(eventid)
  },

  /**
   * 提交验证结果
   * @param {string} eventid - 事件 ID
   * @param {number} vType - 验证类型
   * @param {string} verifycode - 验证码
   * @param {string} sid - sid
   * @param {string} edt - edt
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async verifyUserInfo(eventid, vType, verifycode, sid, edt) {
    return kgVerifyUserInfo(eventid, vType, verifycode, sid, edt)
  },

  /**
   * 构建 Cookie 字符串
   * @param {object} data - { userid, token, t1, dfid, mid }
   * @returns {string}
   */
  buildCookieString(data) {
    return kgBuildCookieString(data)
  },
}
