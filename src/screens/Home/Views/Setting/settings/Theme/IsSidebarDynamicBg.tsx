import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'

export default memo(() => {
  const t = useI18n()
  const isSidebarDynamicBg = useSettingValue('theme.sidebarDynamicBg')
  const setIsSidebarDynamicBg = (isSidebarDynamicBg: boolean) => {
    updateSetting({ 'theme.sidebarDynamicBg': isSidebarDynamicBg })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isSidebarDynamicBg}
        label={t('setting_basic_theme_sidebar_dynamic_bg')}
        onChange={setIsSidebarDynamicBg}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
