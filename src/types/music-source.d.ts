/**
 * 三方音乐源模块标准化类型声明
 *
 * 本文件定义了 wy / tx / kg 三个平台音乐源 SDK 的统一接口结构。
 *
 * 设计原则：
 * 1. 统一导出结构 — MusicSourceModule 定义了所有平台必须具备的模块集合
 * 2. 包容平台差异 — 各子模块内部通过可选属性(?)兼容不同平台独有的方法名
 * 3. 不重命名现有方法 — 严格遵循"不重命名"铁律，差异方法全部以可选属性共存
 */
declare namespace LX {

  // ============================================================
  //  通用辅助类型
  // ============================================================

  /** 歌曲信息（宽泛类型，兼容各平台 MusicInfo 变体） */
  type AnyMusicInfo = LX.Music.MusicInfoOnline

  /** 歌单标签 */
  interface SongListTag {
    id: string
    name: string
  }

  /** 歌单分类信息 */
  interface SongListCategory {
    name: string
    list: SongListTag[]
  }

  /** 歌单概要信息 */
  interface SongListItem {
    play_count: string
    id: string
    author: string
    name: string
    img: string
    desc?: string
    source: LX.OnlineSource
  }

  /** 歌单详情 */
  interface SongListDetail {
    info: {
      id: string
      name: string
      img: string
      desc: string
      author: string
      play_count?: string
      source: LX.OnlineSource
    }
    list: AnyMusicInfo[]
  }

  /** 排行榜条目 */
  interface LeaderboardItem {
    id: string
    name: string
    bangid?: string | number
    source: LX.OnlineSource
  }

  /** 排行榜歌曲列表结果 */
  interface LeaderboardListResult {
    list: AnyMusicInfo[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  /** 搜索结果（歌曲） */
  interface MusicSearchResult {
    list: AnyMusicInfo[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  /** 搜索结果（歌手） */
  interface SingerSearchResult {
    list: Array<{
      id: string | number
      name: string
      img?: string
      source: LX.OnlineSource
    }>
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  /** 搜索结果（专辑） */
  interface AlbumSearchResult {
    list: Array<{
      id: string | number
      name: string
      img?: string
      singer?: string
      publishDate?: string
      source: LX.OnlineSource
    }>
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  /** 热搜结果 */
  interface HotSearchResult {
    list: string[]
    source: LX.OnlineSource
  }

  /** 评论条目 */
  interface CommentItem {
    commentId: string | number
    userName: string
    avatar?: string
    content: string
    time: string | number
    likedCount?: number
    replyCount?: number
  }

  /** 评论结果 */
  interface CommentResult {
    list: CommentItem[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  /** 歌手详情 */
  interface ArtistDetail {
    artist: {
      id: string | number
      mid?: string
      name: string
      alias?: string[]
      picUrl?: string
      briefDesc?: string
      albumSize?: number
      songNum?: number
      source: LX.OnlineSource
    }
  }

  /** 歌手歌曲列表结果 */
  interface ArtistSongsResult {
    list: AnyMusicInfo[]
    total?: number
    hasMore?: boolean
    source: LX.OnlineSource
  }

  /** 歌手专辑列表结果 */
  interface ArtistAlbumsResult {
    hotAlbums: Array<{
      id: string | number
      mid?: string
      name: string
      picUrl?: string
      publishTime?: string
      size?: number
      artist?: string
      source: LX.OnlineSource
    }>
    hasMore?: boolean
    total?: number
  }

  /** 专辑详情 */
  interface AlbumDetail {
    list: AnyMusicInfo[]
    info: {
      id: string | number
      mid?: string
      name: string
      img?: string
      picUrl?: string
      desc?: string
      author?: string
      artist?: string
      artistId?: string | number
      artists?: Array<{ id: string | number; name: string }>
      publishTime?: string
      size?: number
      source: LX.OnlineSource
    }
  }

  /** 用户歌单条目 */
  interface UserPlaylistItem {
    id: string | number
    name: string
    img?: string
    playCount?: number
    trackCount?: number
    creator?: string
    source: LX.OnlineSource
  }

  /** 用户歌单列表结果 */
  interface UserPlaylistsResult {
    createdList?: UserPlaylistItem[]
    collectedList?: UserPlaylistItem[]
    list?: UserPlaylistItem[]
    source: LX.OnlineSource
  }

  /** 用户信息 */
  interface UserInfo {
    name: string
    avatar?: string
    uid?: string | number
    uin?: string | number
    source: LX.OnlineSource
  }

  /** 收藏专辑条目 */
  interface FavAlbumItem {
    id: string | number
    name: string
    img?: string
    artist?: string
    publishTime?: string
    size?: number
    source: LX.OnlineSource
  }

  /** 收藏歌单条目 */
  interface FavPlaylistItem {
    id: string | number
    name: string
    img?: string
    playCount?: number
    trackCount?: number
    source: LX.OnlineSource
  }

  /** 每日推荐结果 */
  interface DailyRecResult {
    list: AnyMusicInfo[]
    source: LX.OnlineSource
  }

  /** 推荐歌单结果 */
  interface RecommendSonglistResult {
    list: Array<{
      id: string | number
      name: string
      img?: string
      playCount?: number
      source: LX.OnlineSource
    }>
    hasMore?: boolean
    source: LX.OnlineSource
  }

  // ============================================================
  //  子模块接口定义
  // ============================================================

  /**
   * 歌单模块
   *
   * 统一方法：getTags, getList, getListDetail, getDetailPageUrl, search
   * 平台差异：
   *   - kg: getSongList, getSongListRecommend, getUserListDetail（酷狗特有歌单解析）
   *   - tx/kg: getListDetailNew（新版歌单详情）
   */
  interface SongListModule {
    /** 获取歌单标签分类 */
    getTags(retryNum?: number): Promise<{
      tags: SongListCategory[]
      hotTag: SongListTag[]
    }>

    /** 获取歌单列表 */
    getList(sortId: string | number, tagId: string, page: number, retryNum?: number): Promise<{
      list: SongListItem[]
      total?: number
      hasMore?: boolean
      source: LX.OnlineSource
    }>

    /** 获取歌单详情（歌曲列表） */
    getListDetail(id: string | number, page: number, retryNum?: number): Promise<SongListDetail>

    /** 获取歌单详情页URL */
    getDetailPageUrl(id: string | number): Promise<string> | string

    /** 搜索歌单 */
    search(text: string, page: number, limit?: number, retryNum?: number): Promise<{
      list: SongListItem[]
      total?: number
      hasMore?: boolean
      source: LX.OnlineSource
    }>

    // --- wy 专有 ---
    /** 解析歌单链接ID (wy) */
    handleParseId?(link: string, retryNum?: number): Promise<string>
    /** 获取歌单ID (wy) */
    getListId?(id: string | number): Promise<{ id: string }>

    // --- kg 专有 ---
    /** 获取歌单列表 - 旧接口 (kg) */
    getSongList?(sortId: string | number, tagId: string, page: number, retryNum?: number): Promise<any>
    /** 获取推荐歌单 (kg) */
    getSongListRecommend?(retryNum?: number): Promise<any>
    /** 通过链接获取用户歌单详情 (kg) */
    getUserListDetail?(link: string, page: number, retryNum?: number): Promise<SongListDetail>
    /** 通过ID获取用户歌单详情 (kg) */
    getUserListDetailById?(id: string, page: number, limit: number): Promise<SongListDetail>
    /** 获取歌单信息 (kg) */
    getListInfo?(tagId: string, retryNum?: number): Promise<any>

    // --- tx 专有 ---
    /** 新版歌单详情 (tx) */
    getListDetailNew?(id: string | number, retryNum?: number): Promise<SongListDetail>
  }

  /**
   * 每日推荐模块
   *
   * 平台差异（核心推荐方法名不同，不重命名）：
   *   - wy: getList(cookie, retryNum) → 每日推荐歌曲
   *   - tx: getGuessRecommend(retryNum) → 猜你喜欢
   *         getHomeFeed(page, direction, sNum, vCache, retryNum) → 首页Feed
   *   - kg: getRecommendSongs(retryNum) → 个性化推荐
   *         getEverydayRecommend(retryNum) → 每日推荐
   */
  interface DailyRecModule {
    // --- wy 专有 ---
    /** 获取每日推荐歌曲 (wy) */
    getList?(cookie: string, retryNum?: number): Promise<DailyRecResult>
    /** 保存风格化标签 (wy) */
    saveStylizedTag?(cookie: string, categoryId: string, tagIds: string, retryNum?: number): Promise<any>
    /** 获取风格化推荐 (wy) */
    getStylizedList?(cookie: string, retryNum?: number): Promise<any>
    /** 获取推荐歌单 (wy) */
    getRecPlaylists?(cookie: string, retryNum?: number): Promise<RecommendSonglistResult>
    /** 获取相似歌曲 (wy) */
    getSimilarSongs?(songId: string | number, limit?: number, offset?: number, retryNum?: number): Promise<DailyRecResult>
    /** 获取心动模式列表 (wy) */
    getHeartbeatModeList?(cookie: string, playlistId?: string, songId?: string, retryNum?: number): Promise<DailyRecResult>

    // --- tx 专有 ---
    /** 猜你喜欢推荐 (tx) */
    getGuessRecommend?(retryNum?: number): Promise<DailyRecResult>
    /** 获取首页Feed (tx) */
    getHomeFeed?(page?: number, direction?: number, sNum?: number, vCache?: any[], retryNum?: number): Promise<DailyRecResult>
    /** 雷达推荐 (tx) */
    getRadarRecommend?(page?: number, retryNum?: number): Promise<DailyRecResult>
    /** 推荐歌单 (tx) */
    getRecommendSonglist?(page?: number, num?: number, retryNum?: number): Promise<RecommendSonglistResult>
    /** 推荐新歌 (tx) */
    getRecommendNewsong?(retryNum?: number): Promise<DailyRecResult>
    /** 相似歌曲 (tx) */
    getSimilarSongs?(songMid: string, limit?: number, retryNum?: number): Promise<DailyRecResult>

    // --- kg 专有 ---
    /** 个性化推荐 (kg) */
    getRecommendSongs?(retryNum?: number): Promise<DailyRecResult>
    /** 每日推荐 (kg) */
    getEverydayRecommend?(retryNum?: number): Promise<DailyRecResult>
    /** 历史推荐 (kg) */
    getHistoryRecommend?(mode?: string, date?: string, historyName?: string, retryNum?: number): Promise<DailyRecResult>
    /** 风格推荐 (kg) */
    getStyleRecommend?(tagIds?: string, retryNum?: number): Promise<DailyRecResult>
    /** 新歌速递 (kg) */
    getNewSongs?(retryNum?: number): Promise<DailyRecResult>
  }

  /**
   * 歌手模块
   *
   * 统一方法：getDetail, getSongs, getAlbums, getSimilar
   * 平台差异：
   *   - 参数名不同：wy 用 id，tx 用 artistMid，kg 用 singerid
   *   - tx 额外：getSingerDesc, getAlbumSongCount
   *   - kg：getSimilar 暂不支持（返回空数组）
   */
  interface ArtistModule {
    /** 获取歌手详情 */
    getDetail(id: string | number, retryNum?: number): Promise<ArtistDetail>

    /** 获取歌手歌曲 */
    getSongs(
      id: string | number,
      order?: string,
      limit?: number,
      offset?: number,
      retryNum?: number
    ): Promise<ArtistSongsResult>

    /** 获取歌手专辑 */
    getAlbums(
      id: string | number,
      limit?: number,
      offset?: number,
      retryNum?: number
    ): Promise<ArtistAlbumsResult>

    /** 获取相似歌手 */
    getSimilar(id: string | number, retryNum?: number): Promise<ArtistDetail[] | { artists: ArtistDetail[] }>

    // --- tx 专有 ---
    /** 获取歌手描述 (tx) */
    getSingerDesc?(artistMid: string, retryNum?: number): Promise<string>
    /** 获取专辑歌曲数量 (tx) */
    getAlbumSongCount?(albumMid: string, retryNum?: number): Promise<number>
  }

  /**
   * 专辑模块
   *
   * 统一方法：getAlbum
   * 平台差异：
   *   - tx: getAlbumDetail（获取原始详情数据）
   *   - kg: getAlbumInfo, getAlbumDetail（拆分为信息+列表两个接口）
   */
  interface AlbumModule {
    /** 获取专辑歌曲列表+详情（统一入口） */
    getAlbum(id: string | number, retryNum?: number): Promise<AlbumDetail>

    // --- tx 专有 ---
    /** 获取专辑原始详情数据 (tx) */
    getAlbumDetail?(albumMid: string, retryNum?: number): Promise<any>

    // --- kg 专有 ---
    /** 获取专辑信息 (kg) */
    getAlbumInfo?(id: string | number): Promise<any>
    /** 获取专辑歌曲列表 (kg) */
    getAlbumDetail?(id: string | number, page?: number, limit?: number): Promise<any>
  }

  /**
   * 用户模块（歌单同步）
   *
   * 平台差异显著，方法名和参数各不相同：
   *   - wy: manipulatePlaylistTracks(op, pid, tracks) 统一增删
   *   - tx: addSongToPlaylist / removeSongFromPlaylist 分离增删
   *   - kg: 通过 kg/utils/api.ts 适配，方法签名含 cookie
   */
  interface UserModule {
    // ====== 歌单管理 ======

    /** 获取用户歌单列表 */
    getUserPlaylists(
      ...args: [uid?: string | number, cookie?: string, retryNum?: number] | [retryNum?: number] | [cookie?: string]
    ): Promise<UserPlaylistsResult>

    /** 创建歌单 */
    createPlaylist?(
      name: string,
      privacyOrRetry?: number | string,
      retryNum?: number
    ): Promise<any>

    /** 删除歌单 */
    deletePlaylist?(
      id: string | number,
      retryNum?: number
    ): Promise<any>

    /** 添加歌曲到歌单 */
    addSongToPlaylist?(
      ...args:
        | [pid: string | number, tracks: any[], retryNum?: number]           // wy: manipulatePlaylistTracks('add', ...)
        | [listId: string | number, songMids: string[], retryNum?: number]    // tx
        | [cookie: string, listId: string | number, songInfo: any]            // kg
    ): Promise<any>

    /** 从歌单删除歌曲 */
    removeSongsFromPlaylist?(
      ...args:
        | [pid: string | number, tracks: any[], retryNum?: number]            // wy: manipulatePlaylistTracks('del', ...)
        | [listId: string | number, songMids: string[], retryNum?: number]    // tx
        | [cookie: string, listId: string | number, fileHash: string]         // kg
    ): Promise<any>

    /** 操作歌单歌曲 - 增删统一入口 (wy) */
    manipulatePlaylistTracks?(
      op: 'add' | 'del',
      pid: string | number,
      tracks: any[],
      retryNum?: number
    ): Promise<any>

    /** 获取歌单歌曲列表 */
    getPlaylistSongs?(
      cookie: string,
      listId: string | number,
      page?: number,
      limit?: number
    ): Promise<{ list: AnyMusicInfo[]; total?: number }>

    /** 获取歌单详情 (tx) */
    getPlaylistDetail?(
      disstid: string | number,
      retryNum?: number
    ): Promise<SongListDetail>

    // ====== 收藏/订阅 ======

    /** 收藏歌单 */
    subPlaylist?(id: string | number, isSub: boolean, retryNum?: number): Promise<any>

    /** 取消收藏歌单 */
    unsubscribePlaylist?(
      ...args:
        | [cookie: string, listid: string | number]    // kg
        | [id: string | number, isSub: boolean]        // wy
    ): Promise<any>

    /** 收藏歌单 (kg) */
    subscribePlaylist?(
      cookie: string,
      playlistInfo: any
    ): Promise<any>

    /** 获取收藏歌单列表 */
    getFavPlaylists?(page?: number, pageSize?: number, retryNum?: number): Promise<{
      list: FavPlaylistItem[]
      total?: number
      hasMore?: boolean
    }>

    /** 获取收藏专辑列表 */
    getFavAlbums?(page?: number, pageSize?: number, retryNum?: number): Promise<{
      list: FavAlbumItem[]
      total?: number
      hasMore?: boolean
    }>

    /** 获取收藏专辑列表 - 全量 (wy) */
    getAllSubAlbumList?(): Promise<FavAlbumItem[]>

    /** 收藏/取消收藏专辑 */
    subAlbum?(id: string | number, isSub: boolean, retryNum?: number): Promise<any>

    // ====== 喜欢/收藏歌曲 ======

    /** 喜欢/取消喜欢歌曲 */
    likeSong?(
      ...args:
        | [songId: string | number, like: boolean, retryNum?: number]    // wy
        | [songMid: string, like: boolean]                                // tx
    ): Promise<any>

    /** 获取喜欢/收藏歌曲列表 */
    getLikedSongList?(
      uid: string | number,
      cookie: string,
      retryNum?: number
    ): Promise<AnyMusicInfo[]>

    /** 获取收藏歌曲 (tx) */
    getFavSongs?(page?: number, pageSize?: number, retryNum?: number): Promise<{
      list: AnyMusicInfo[]
      total?: number
      hasMore?: boolean
    }>

    /** 获取"我喜欢"歌单ID (tx) */
    getLikedListId?(): Promise<string>

    // ====== 用户信息 ======

    /** 获取用户UID (wy) */
    getUid?(cookie: string, retryNum?: number): Promise<string | number>

    /** 获取用户信息 (tx) */
    getUserInfo?(retryNum?: number): Promise<UserInfo>

    /** 从Cookie提取uin (tx) */
    extractUin?(cookie: string): string | undefined

    /** 从Cookie提取加密UIN (tx) */
    extractEuin?(cookie: string): string | undefined

    // ====== 关注歌手 ======

    /** 获取关注歌手列表 (wy) */
    getSublist?(limit?: number, offset?: number, retryNum?: number): Promise<any>

    /** 获取全部关注歌手 (wy) */
    getAllSublist?(): Promise<any>

    /** 关注/取消关注歌手 (wy) */
    followSinger?(id: string | number, isFollow: boolean, retryNum?: number): Promise<any>

    // ====== 其他 ======

    /** 歌曲打点/播放记录 (wy) */
    scrobble?(songId: string | number, sourceId: string | number, duration: number, retryNum?: number): Promise<any>

    /** 更新歌单信息 (wy) */
    updatePlaylist?(id: string | number, name: string, desc: string, retryNum?: number): Promise<any>

    /** 获取自建歌单 (tx) */
    getCreatedPlaylists?(retryNum?: number): Promise<UserPlaylistsResult>

    /** 获取"我喜欢"收藏音乐 (tx) */
    getFavoritesMusic?(page?: number, pageSize?: number, retryNum?: number): Promise<any>

    /** 通过songmid搜索歌曲 (tx) */
    searchSong?(songmid: string): Promise<AnyMusicInfo | null>

    /** 发送签名请求 (tx) */
    sendSignedRequest?(payload: any): Promise<any>
  }

  /**
   * 排行榜模块
   *
   * 统一方法：getBoards, getList
   */
  interface LeaderboardModule {
    /** 获取排行榜列表 */
    getBoards(retryNum?: number): Promise<{
      list: LeaderboardItem[]
      source: LX.OnlineSource
    }>

    /** 获取排行榜歌曲 */
    getList(bangid: string | number, page?: number, retryNum?: number): Promise<LeaderboardListResult>

    /** 获取排行榜详情页URL */
    getDetailPageUrl?(id: string | number): string
  }

  /**
   * 搜索模块
   *
   * 统一方法：search, searchSinger, searchAlbum
   * 平台差异：
   *   - wy: musicSearch 为内部方法（首字母小写），search 为对外方法
   *   - tx: musicSearch 为内部方法，search 为对外方法
   *   - kg: musicSearch 为内部方法，search 为对外方法
   */
  interface MusicSearchModule {
    /** 搜索歌曲 */
    search(str: string, page?: number, limit?: number, retryNum?: number, options?: Record<string, any>): Promise<MusicSearchResult>

    /** 搜索歌手 */
    searchSinger(str: string, page?: number, limit?: number, retryNum?: number): Promise<SingerSearchResult>

    /** 搜索专辑 */
    searchAlbum(str: string, page?: number, limit?: number, retryNum?: number): Promise<AlbumSearchResult>
  }

  /**
   * 热搜模块
   *
   * 统一方法：getList
   */
  interface HotSearchModule {
    /** 获取热搜词列表 */
    getList(retryNum?: number): Promise<HotSearchResult>
  }

  /**
   * 评论模块
   *
   * 统一方法：getComment, getHotComment
   * 平台差异：
   *   - wy: sendComment, replyComment, deleteComment（可发送/回复/删除评论）
   *   - kg: getReplyComment（可获取楼中楼回复）
   */
  interface CommentModule {
    /** 获取评论 */
    getComment(
      musicInfo: AnyMusicInfo,
      page?: number,
      limit?: number
    ): Promise<CommentResult>

    /** 获取热门评论 */
    getHotComment(
      musicInfo: AnyMusicInfo,
      page?: number,
      limit?: number
    ): Promise<CommentResult>

    // --- wy 专有 ---
    /** 发送评论 (wy) */
    sendComment?(songmid: string, content: string, retryNum?: number): Promise<any>
    /** 回复评论 (wy) */
    replyComment?(songmid: string, content: string, commentId: string | number, retryNum?: number): Promise<any>
    /** 删除评论 (wy) */
    deleteComment?(songmid: string, commentId: string | number, retryNum?: number): Promise<any>

    // --- kg 专有 ---
    /** 获取楼中楼回复 (kg) */
    getReplyComment?(
      musicInfo: AnyMusicInfo,
      replyId: string | number,
      page?: number,
      limit?: number
    ): Promise<CommentResult>
  }

  // ============================================================
  //  主模块接口
  // ============================================================

  /**
   * 音乐源模块 — 统一导出结构
   *
   * wy / tx / kg 三个平台的 index.js 导出对象均须实现此接口。
   * 各子模块通过可选属性(?)兼容平台差异，保证统一访问的同时不丢失特有功能。
   */
  interface MusicSourceModule {
    // --- 功能模块 ---
    leaderboard: LeaderboardModule
    songList: SongListModule
    musicSearch: MusicSearchModule
    hotSearch: HotSearchModule
    comment: CommentModule
    artist: ArtistModule
    dailyRec: DailyRecModule

    /** 专辑模块（wy 当前未挂载，标准化后须挂载） */
    album?: AlbumModule

    /** 用户模块（wy/kg 当前未挂载，标准化后须挂载） */
    user?: UserModule

    // --- Cookie 模块（wy 专有） ---
    cookie?: {
      /** 获取Cookie相关操作 */
      [key: string]: any
    }

    // --- 播放相关 ---
    /** 获取音乐播放URL */
    getMusicUrl(songInfo: AnyMusicInfo, type: string): Promise<LX.Music.MusicUrlInfo>

    /** 获取歌词 */
    getLyric(songInfo: AnyMusicInfo): Promise<LX.Music.LyricInfo>

    /** 获取歌曲封面图 */
    getPic(songInfo: AnyMusicInfo): Promise<string>

    /** 获取歌曲详情页URL */
    getMusicDetailPageUrl(songInfo: AnyMusicInfo): string
  }

  /**
   * 音乐源模块注册表
   *
   * 通过 musicSdk[source] 访问对应平台的模块实例
   */
  interface MusicSdkRegistry {
    wy: MusicSourceModule
    tx: MusicSourceModule
    kg: MusicSourceModule
    [key: string]: MusicSourceModule
  }
}
