import { version } from '../../package.json'
import { createAppEventHub } from '@/event/appEvent'
import { createListEventHub } from '@/event/listEvent'
import { createDislikeEventHub } from '@/event/dislikeEvent'
import { createStateEventHub } from '@/event/stateEvent'
if (process.versions == null) {
  // @ts-expect-error
  process.versions = {
    app: version,
  }
} else process.versions.app = version

global.lx = {
  fontSize: 0.9,
  playerStatus: {
    isInitialized: false,
    isRegisteredService: false,
    isIniting: false,
  },
  isCarMode: false,

  playerError: false,
  restorePlayInfo: null,

  isScreenKeepAwake: false,

  isPlayedStop: false,

  isEnableLog: true,
  isEnableSyncLog: false,
  isEnableUserApiLog: false,

  playerTrackId: '',

  gettingUrlId: '',

  qualityList: {},
  apis: {},
  apiInitPromise: [Promise.resolve(false), true, () => { }],

  jumpMyListPosition: false,

  settingActiveId: 'basic',

  homePagerIdle: true,
}

global.app_event = createAppEventHub()
global.list_event = createListEventHub()
global.dislike_event = createDislikeEventHub()
global.state_event = createStateEventHub()
