import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.sentinel.app',
  appName: 'Sentinel',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    // Use Android Studio bundled JDK
    javaVersion: '21',
  },
};

export default config;
