import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import settingState from '@/store/setting/state'
import MusicList from './MusicList'
import MyList from './MyList'
import NewListUI from './NewListUI'
import { useTheme } from '@/store/theme/hook'
import DrawerLayoutFixed, {
  type DrawerLayoutFixedType,
} from '@/components/common/DrawerLayoutFixed'
import { COMPONENT_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import type { InitState as CommonState } from '@/store/common/state'
import { useSettingValue } from '@/store/setting/hook'
import { useBgPic } from '@/store/common/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { defaultHeaders } from '@/components/common/Image'

const MAX_WIDTH = scaleSizeW(400)

export default () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const theme = useTheme()
  const isNewListUI = useSettingValue('list.isNewListUI')
  const isDynamicBg = useSettingValue('theme.dynamicBg')
  const isMylistDynamicBg = useSettingValue('theme.mylistDynamicBg')
  const dynamicPic = useBgPic()
  const customBgPicPath = useSettingValue('theme.customBgPicPath')
  const pic = customBgPicPath || dynamicPic
  const blur = useSettingValue('theme.blur')
  const picOpacity = useSettingValue('theme.picOpacity')

  const showMylistBg = isDynamicBg && isMylistDynamicBg && pic
  // const [width, setWidth] = useState(0)

  useEffect(() => {
    const handleFixDrawer = (id: CommonState['navActiveId']) => {
      if (id == 'nav_love') drawer.current?.fixWidth()
    }
    const changeVisible = (visible: boolean) => {
      if (visible) {
        requestAnimationFrame(() => {
          drawer.current?.openDrawer()
        })
      } else {
        drawer.current?.closeDrawer()
      }
    }

    // setWidth(getWindowSise().width * 0.82)

    global.state_event.on('navActiveIdUpdated', handleFixDrawer)
    global.app_event.on('changeLoveListVisible', changeVisible)

    // 就放旋转屏幕后的宽度没有更新的问题
    // const changeEvent = onDimensionChange(({ window }) => {
    //   setWidth(window.width * 0.82)
    //   drawer.current?.setNativeProps({
    //     width: window.width,
    //   })
    // })

    return () => {
      global.state_event.off('navActiveIdUpdated', handleFixDrawer)
      global.app_event.off('changeLoveListVisible', changeVisible)
      // changeEvent.remove()
    }
  }, [])

  const drawerBgColor = showMylistBg ? 'transparent' : theme['c-content-background']

  const navigationView = () => (
    <View style={{ flex: 1, backgroundColor: drawerBgColor }}>
      {showMylistBg ? (
        <ImageBackground
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
          }}
          source={{ uri: pic, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={blur}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: theme['c-content-background'],
              opacity: picOpacity / 100,
            }}
          />
        </ImageBackground>
      ) : null}
      <MyList />
    </View>
  )
  // console.log('render drawer content')

  if (isNewListUI) {
    return <NewListUI />
  }

  return (
    <DrawerLayoutFixed
      ref={drawer}
      visibleNavNames={[COMPONENT_IDS.home]}
      // drawerWidth={width}
      widthPercentage={0.82}
      widthPercentageMax={MAX_WIDTH}
      drawerPosition={settingState.setting['common.drawerLayoutPosition']}
      renderNavigationView={navigationView}
      drawerBackgroundColor={drawerBgColor}
      style={{ elevation: 1 }}
    >
      <MusicList />
    </DrawerLayoutFixed>
  )
}
