import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.multishop.app',
  appName: 'MultiShop',
  webDir:  'dist',

  // ── Server ───────────────────────────────────────────────────────────────────
  server: {
    androidScheme: 'https',
    // ⚠ DEV ONLY — remove before generating a release APK
    // url: 'http://192.168.1.x:4000',
    // cleartext: true,
  },

  // ── Plugins ──────────────────────────────────────────────────────────────────
  plugins: {
    // Splash screen — dark background matching app shell
    SplashScreen: {
      launchShowDuration:       2500,
      launchAutoHide:           true,
      backgroundColor:          '#111827',
      androidSplashResourceName:'splash',
      androidScaleType:         'CENTER_CROP',
      showSpinner:              false,
      splashFullScreen:         true,
      splashImmersive:          true,
    },

    // Status bar matches app chrome
    StatusBar: {
      style:           'DARK',
      backgroundColor: '#111827',
      overlaysWebView: false,
    },

    // Keyboard — resize body so inputs stay visible
    Keyboard: {
      resize:              'body',
      resizeOnFullScreen:  true,
    },

    // Push — show badge + sound + alert when app is foregrounded
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  // ── Android build options ─────────────────────────────────────────────────────
  android: {
    // Set to true to allow cleartext (HTTP) traffic — DEV ONLY
    // allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true for debugging, false for release
  },
};

export default config;
