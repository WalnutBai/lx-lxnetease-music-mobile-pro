import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'

export default memo(() => {
  const t = useI18n()
  const isMylistDynamicBg = useSettingValue('theme.mylistDynamicBg')
  const setIsMylistDynamicBg = (isMylistDynamicBg: boolean) => {
    updateSetting({ 'theme.mylistDynamicBg': isMylistDynamicBg })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isMylistDynamicBg}
        label={t('setting_basic_theme_mylist_dynamic_bg')}
        onChange={setIsMylistDynamicBg}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
