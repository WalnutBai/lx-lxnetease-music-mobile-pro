import { memo, useMemo } from 'react'
import { View } from 'react-native'

import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import FeatureBtns from '../FeatureBtns'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useWindowSize } from '@/utils/hooks'
import { scaleSizeW } from '@/utils/pixelRatio'

const PlayerNew = memo(({ componentId }: { componentId: string }) => {
  const { height: winHeight } = useWindowSize()
  const containerStyle = useMemo(() => ({
    paddingHorizontal: scaleSizeW(15),
    paddingBottom: Math.max(Math.round(winHeight * 0.018), 10),
    paddingTop: Math.max(Math.round(winHeight * 0.006), 4),
  }), [winHeight])

  return (
    <View
      style={[styles.container, containerStyle]}
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}
    >
      <FeatureBtns componentId={componentId} />
      <PlayInfo />
      <ControlBtn isNewUI={true} />
    </View>
  )
})

export default PlayerNew

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    flexDirection: 'column',
  },
})
