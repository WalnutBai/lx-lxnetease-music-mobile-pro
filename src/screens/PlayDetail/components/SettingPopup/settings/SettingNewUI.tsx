import { View } from 'react-native';
import { useSettingValue } from '@/store/setting/hook';
import { updateSetting } from '@/core/common';
import { useI18n } from '@/lang';
import CheckBox from '@/components/common/CheckBox';
import styles from './style';

export default () => {
  const t = useI18n();
  const isNewUI = useSettingValue('playDetail.style.newUI');
  const setNewUI = (isNew: boolean) => {
    updateSetting({ 'playDetail.style.newUI': isNew });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <CheckBox
          check={isNewUI}
          label={t('play_detail_setting_new_ui')}
          onChange={setNewUI}
        />
      </View>
    </View>
  );
};
