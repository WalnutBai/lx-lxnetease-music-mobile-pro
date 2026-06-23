/**
 * 酷狗人机验证 Modal
 */

import { forwardRef, useImperativeHandle, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Modal, { type ModalType } from '@/components/common/Modal';
import WebView from 'react-native-webview';
import { useTheme } from '@/store/theme/hook';
import { useStatusbarHeight } from '@/store/common/hook';
import { Icon } from '@/components/common/Icon';
import Text from '@/components/common/Text';
import { getVerifyInfo, verifyUserInfo } from '@/utils/musicSdk/kg/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface KgVerifyModalType {
  show: (ssaCode: string, onComplete?: (success: boolean) => void) => void;
}

const Header = ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme();
  const statusBarHeight = useStatusbarHeight();

  return (
    <View style={[styles.header, { height: 56 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: '#fff' }]}>
      <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
        <Icon name="chevron-left" size={26} color="#333" />
      </TouchableOpacity>
      <Text size={18} weight="600" color="#333">验证</Text>
      <View style={styles.placeholder} />
    </View>
  );
};

function generateHtml(txappid: string, ssaCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0}
body{background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}
.box{text-align:center;padding:20px}
.btn{background:#1677ff;color:#fff;border:none;padding:12px 30px;border-radius:8px;font-size:16px;cursor:pointer}
.status{margin-top:15px;color:#666}
</style>
</head>
<body>
<div class="box">
<button class="btn" id="btn" onclick="start()">开始验证</button>
<div class="status" id="status"></div>
</div>
<script>
var appid='${txappid}';
var code='${ssaCode}';

// 修复触摸事件 - 让滑块能正常工作
(function() {
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function(event) {
    var now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
})();

function start(){
document.getElementById('btn').disabled=true;
document.getElementById('status').textContent='加载中...';
var s=document.createElement('script');
s.src='https://turing.captcha.qcloud.com/TCaptcha.js';
s.onload=function(){
var c=new TencentCaptcha(appid,function(r){
if(r.ret===0){
window.ReactNativeWebView.postMessage(JSON.stringify({type:'ok',ticket:r.ticket,randstr:r.randstr,appid:appid,code:code}));
}else{
window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancel'}));
}
}, { 
  type: 'popup', 
  enableDarkMode: false, 
  themeColor: '#667eea' 
});
c.show();
};
s.onerror=function(){document.getElementById('status').textContent='加载失败'};
document.head.appendChild(s);
}
</script>
</body>
</html>`;
}

const KgVerifyModal = forwardRef<KgVerifyModalType, object>((props, ref) => {
  const modalRef = useRef<ModalType>(null);
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState('');
  const onCompleteRef = useRef<((success: boolean) => void) | null>(null);

  const sessionidRef = useRef<string>('');

  useImperativeHandle(ref, () => ({
    async show(ssaCode: string, onComplete?: (success: boolean) => void) {
      console.log('[Verify] KgVerifyModal.show 被调用, ssaCode:', ssaCode);
      onCompleteRef.current = onComplete || null;
      console.log('[Verify] 开始获取验证信息...');
      const result = await getVerifyInfo(ssaCode);
      console.log('[Verify] getVerifyInfo 返回:', JSON.stringify(result));
      if (result.success && result.data?.txappid) {
        // 保存 sessionid 用于后续 verifyUserInfo 调用
        sessionidRef.current = result.data.sessionid || ssaCode;
        console.log('[Verify] 保存 sessionid:', sessionidRef.current);
        console.log('[Verify] 生成验证页面HTML, txappid:', result.data.txappid);
        setHtml(generateHtml(result.data.txappid, ssaCode));
        setVisible(true);
        modalRef.current?.setVisible(true);
      } else {
        console.log('[Verify] 获取验证信息失败:', result.message);
        onComplete?.(false);
      }
    },
  }));

  const handleClose = useCallback(() => {
    setVisible(false);
    modalRef.current?.setVisible(false);
  }, []);

  const handleMessage = useCallback(async (event: any) => {
    try {
      console.log('[Verify] 收到WebView消息:', event.nativeEvent.data);
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[Verify] 解析后的消息:', JSON.stringify(data));
      if (data.type === 'ok') {
        const code = 'KGCodeTX|' + JSON.stringify({ticket: data.ticket, randstr: data.randstr, txappid: data.appid});
        console.log('[Verify] 验证码:', code.substring(0, 100) + '...');
        console.log('[Verify] 开始调用 verifyUserInfo...');
        // 使用 sessionid 作为 eventid，而不是原始的 ssa-code
        const eventid = sessionidRef.current || data.code;
        console.log('[Verify] 参数: eventid=' + eventid + ', vType=23');
        const r = await verifyUserInfo(eventid, 23, code, '', '');
        console.log('[Verify] verifyUserInfo 返回:', JSON.stringify(r));
        onCompleteRef.current?.(r.success);
        handleClose();
      } else if (data.type === 'cancel') {
        console.log('[Verify] 用户取消验证');
        onCompleteRef.current?.(false);
        handleClose();
      } else {
        console.log('[Verify] 未知消息类型:', data.type);
        onCompleteRef.current?.(false);
        handleClose();
      }
    } catch (e: any) {
      console.error('[Verify] handleMessage 异常:', e?.message);
      console.error('[Verify] 异常堆栈:', e?.stack);
      onCompleteRef.current?.(false);
      handleClose();
    }
  }, [handleClose]);

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={styles.container}>
        <Header onClose={handleClose} />
        <View style={styles.webViewContainer}>
          {visible && html ? (
            <WebView
              source={{ html }}
              onMessage={handleMessage}
              style={styles.webView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              useWebKit={true}
              cacheEnabled={false}
              incognito={true}
              nestedScrollEnabled={true}
              overScrollMode="never"
              bounces={false}
              setSupportMultipleWindows={false}
              allowsFullscreenVideo={true}
              mediaPlaybackRequiresUserAction={false}
              allowsBackForwardNavigationGestures={false}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

export default KgVerifyModal;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { padding: 8, width: 44, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 44 },
  webViewContainer: { flex: 1 },
  webView: { flex: 1, width: SCREEN_WIDTH },
});