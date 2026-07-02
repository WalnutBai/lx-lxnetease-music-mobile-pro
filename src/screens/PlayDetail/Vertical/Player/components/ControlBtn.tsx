import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeW } from '@/utils/pixelRatio'
import { BTN_WIDTH } from './MoreBtn/Btn'
import { useMemo } from 'react'
import { useSettingValue } from '@/store/setting/hook'
import ControlBtnNew from './ControlBtnNew'

const MAX_SIZE = BTN_WIDTH * 1.6
const MIN_SIZE = BTN_WIDTH * 1.2

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  return (
    <TouchableOpacity
      style={{ ...styles.controlBtn, width: size, height: size }}
      activeOpacity={0.5}
      onPress={() => void playPrev()}
    >
      <Icon name="prevMusic" color={activeColor} rawSize={size * 0.7} />
    </TouchableOpacity>
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  return (
    <TouchableOpacity
      style={{ ...styles.controlBtn, width: size, height: size }}
      activeOpacity={0.5}
      onPress={() => void playNext()}
    >
      <Icon name="nextMusic" color={activeColor} rawSize={size * 0.7} />
    </TouchableOpacity>
  )
}
const TogglePlayBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const activeColor = theme.isDark ? theme['c-font'] : theme['c-primary']
  const isPlay = useIsPlay()
  return (
    <TouchableOpacity
      style={{ ...styles.controlBtn, width: size, height: size }}
      activeOpacity={0.5}
      onPress={togglePlay}
    >
      <Icon name={isPlay ? 'pause' : 'play'} color={activeColor} rawSize={size * 0.7} />
    </TouchableOpacity>
  )
}

const ControlBtnOld = () => {
  const winSize = useWindowSize()
  const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
  const containerStyle = useMemo(() => ({
    ...styles.oldContainer,
    maxHeight,
  }), [maxHeight])
  const size = Math.min(
    Math.max(winSize.width * 0.33 * global.lx.fontSize * 0.4, MIN_SIZE),
    MAX_SIZE,
    maxHeight
  )

  return (
    <View style={containerStyle}>
      <PrevBtn size={size} />
      <TogglePlayBtn size={size} />
      <NextBtn size={size} />
    </View>
  )
}

export default ({ isNewUI }: { isNewUI: boolean }) => {
  return isNewUI ? <ControlBtnNew /> : <ControlBtnOld />
}

const styles = createStyle({
  controlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
  oldContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '4%',
    paddingVertical: 22,
  },
})
