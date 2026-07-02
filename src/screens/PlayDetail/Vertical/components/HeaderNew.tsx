import { memo, useRef, useEffect } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { Icon } from '@/components/common/Icon'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { pop } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import { useStatusbarHeight } from '@/store/common/hook'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useWindowSize } from '@/utils/hooks'

const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)
const ICON_SIZE = 22
const DOT_ACTIVE_WIDTH = scaleSizeW(16)
const DOT_INACTIVE_WIDTH = scaleSizeW(6)
const DOT_HEIGHT = scaleSizeW(6)
const DOT_BORDER_RADIUS = DOT_HEIGHT / 2

const AnimatedIndicatorDot = ({ isActive }: { isActive: boolean }) => {
  const animatedWidth = useRef(new Animated.Value(isActive ? DOT_ACTIVE_WIDTH : DOT_INACTIVE_WIDTH)).current
  const animatedOpacity = useRef(new Animated.Value(isActive ? 1 : 0.5)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedWidth, {
        toValue: isActive ? DOT_ACTIVE_WIDTH : DOT_INACTIVE_WIDTH,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }),
      Animated.spring(animatedOpacity, {
        toValue: isActive ? 1 : 0.5,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }),
    ]).start()
  }, [isActive])

  return (
    <Animated.View
      style={{
        width: animatedWidth,
        height: DOT_HEIGHT,
        borderRadius: DOT_BORDER_RADIUS,
        backgroundColor: '#000',
        opacity: animatedOpacity,
      }}
    />
  )
}

const HeaderNew = memo(({ pageIndex }: { pageIndex?: number }) => {
  const popupRef = useRef<SettingPopupType>(null)
  const timerModalRef = useRef<TimeoutExitEditModalType>(null)
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()
  const timeInfo = useTimeInfo()
  const { width: winWidth } = useWindowSize()
  const back = () => {
    void pop(commonState.componentIds[commonState.componentIds.length - 1]?.id!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }
  const showTimer = () => {
    timerModalRef.current?.show()
  }
  const iconColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const activeIndex = pageIndex ?? 0

  const sideAreaWidth = winWidth * 0.2
  const iconGap = scaleSizeW(12)
  const dotGap = scaleSizeW(8)
  const containerPadding = scaleSizeW(10)

  return (
    <View
      style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}
    >
      <StatusBar />
      <View style={[styles.containerNew, { paddingHorizontal: containerPadding }]}>
        <View style={[styles.leftArea, { width: sideAreaWidth }]}>
          <Icon name="chevron-left" color={iconColor} size={24} onPress={back} />
        </View>
        <View style={styles.centerArea}>
          <View style={[styles.pageIndicator, { gap: dotGap }]}>
            <AnimatedIndicatorDot isActive={activeIndex === 0} />
            <AnimatedIndicatorDot isActive={activeIndex === 1} />
          </View>
        </View>
        <View style={[styles.rightArea, { width: sideAreaWidth, gap: iconGap }]}>
          <Icon
            name="music_time"
            color={timeInfo.active ? theme['c-primary-font-active'] : iconColor}
            size={ICON_SIZE}
            onPress={showTimer}
          />
          <Icon name="slider" color={iconColor} size={ICON_SIZE} onPress={showSetting} />
        </View>
      </View>
      <SettingPopup ref={popupRef} direction="vertical" />
      <TimeoutExitEditModal ref={timerModalRef} timeInfo={timeInfo} />
    </View>
  )
})

export default HeaderNew

const styles = StyleSheet.create({
  containerNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  leftArea: {
    alignItems: 'flex-start',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
