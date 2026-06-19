import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const isNewUI = useSettingValue('playDetail.style.newUI')
  const setNewUI = (isNewUI: boolean) => {
    updateSetting({ 'playDetail.style.newUI': isNewUI })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isNewUI}
        label={t('setting_basic_play_detail_new_ui')}
        onChange={setNewUI}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
