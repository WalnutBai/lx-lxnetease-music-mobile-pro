import { memo } from 'react'
import { View } from 'react-native'

import MoreBtn from './components/MoreBtn'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import FeatureBtns from '../FeatureBtns'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

export default memo(({ componentId, isNewUI }: { componentId: string, isNewUI: boolean }) => {
  return (
    <View 
      style={styles.container} 
      nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}
    >
      {isNewUI ? <FeatureBtns componentId={componentId} /> : null}
      <PlayInfo />
      <ControlBtn isNewUI={isNewUI} />
      {isNewUI ? null : <MoreBtn componentId={componentId} />}
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    paddingHorizontal: 15,
    paddingBottom: 15,
    paddingTop: 5,
    flexDirection: 'column',
  },
})
