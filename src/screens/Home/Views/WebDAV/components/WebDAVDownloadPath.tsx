import { memo, useRef } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import { toast } from '@/utils/tools'
import { getWebDAVPrivateDirectory } from '@/utils/fs'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const webdavPath = useSettingValue('webdav.downloadPath')
  const fileSelectRef = useRef<FileSelectType>(null)

  const defaultPath = getWebDAVPrivateDirectory()

  const handleSelectPath = () => {
    fileSelectRef.current?.show(
      {
        title: t('webdav_download_path_select'),
        dirOnly: true,
      },
      (path) => {
        if (!path) return
        updateSetting({ 'webdav.downloadPath': path })
        toast(t('webdav_download_path_set_success'))
      },
    )
  }

  const handleResetPath = () => {
    updateSetting({ 'webdav.downloadPath': '' })
    toast(t('webdav_download_path_reset_success'))
  }

  return (
    <View style={{ ...styles.panel, borderColor: theme['c-border-background'] }}>
      <Text style={styles.label}>{t('webdav_download_path')}</Text>
      <Text color={theme['c-font-label']} style={styles.meta}>
        {t('webdav_download_path_label', { path: webdavPath || defaultPath })}
      </Text>
      <View style={styles.buttonRow}>
        <Button
          style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
          onPress={handleSelectPath}
        >
          <Text color={theme['c-button-font']}>{t('webdav_download_path_select')}</Text>
        </Button>
        <Button
          style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
          onPress={handleResetPath}
        >
          <Text color={theme['c-button-font']}>{t('webdav_download_path_default')}</Text>
        </Button>
      </View>
      <FileSelect ref={fileSelectRef} />
    </View>
  )
})

const styles = createStyle({
  panel: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  label: {
    marginBottom: 6,
  },
  meta: {
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 10,
    marginBottom: 8,
  },
})