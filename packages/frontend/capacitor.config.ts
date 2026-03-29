/// <reference types="@capacitor/push-notifications" />
/// <reference types="@capacitor/splash-screen" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitals.app',
  appName: 'Vitals',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Vitals',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
  },
};

// In development, use Vite dev server for HMR
if (process.env.NODE_ENV !== 'production') {
  config.server = {
    url: 'http://localhost:3000',
    cleartext: true,
  };
}

export default config;
