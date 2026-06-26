package com.lxwalnut.music.mobile;

import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.reactnativenavigation.NavigationActivity;

import java.util.Arrays;

public class MainActivity extends NavigationActivity {

    @Override
    protected void onStart() {
        super.onStart();
        pushShortcuts();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forwardIntentToReactNative(intent);
    }

    private void forwardIntentToReactNative(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        String url = intent.getData().toString();
        if (url == null || url.isEmpty()) return;

        try {
            MainApplication app = (MainApplication) getApplication();
            app.getReactNativeHost()
                .getReactInstanceManager()
                .getCurrentReactContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("url", url);
        } catch (Exception e) {
            // React context not ready yet, will be handled by getInitialURL
        }
    }

    private void pushShortcuts() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return;

        ShortcutManager shortcutManager = getSystemService(ShortcutManager.class);
        if (shortcutManager == null) return;

        Intent recognitionIntent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("lxmusic://recognition"), this, MainActivity.class);
        recognitionIntent.putExtra("shortcut_id", "recognition");

        Intent settingIntent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse("lxmusic://nav?target=setting"), this, MainActivity.class);
        settingIntent.putExtra("shortcut_id", "setting");

        ShortcutInfo recognitionShortcut = new ShortcutInfo.Builder(this, "recognition")
                .setShortLabel("识曲")
                .setLongLabel("听歌识曲")
                .setIcon(Icon.createWithResource(this, R.drawable.ic_shortcut_recognition))
                .setIntent(recognitionIntent)
                .build();

        ShortcutInfo settingShortcut = new ShortcutInfo.Builder(this, "setting")
                .setShortLabel("设置")
                .setLongLabel("打开设置")
                .setIcon(Icon.createWithResource(this, R.drawable.ic_shortcut_setting))
                .setIntent(settingIntent)
                .build();

        shortcutManager.setDynamicShortcuts(Arrays.asList(
                recognitionShortcut,
                settingShortcut
        ));
    }
}
