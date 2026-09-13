import type { ExpoConfig } from 'expo/config';
// Development identities only. Confirm production IDs and EAS ownership before signing.
if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  (!process.env.MOBILE_IOS_BUNDLE_ID ||
    !process.env.MOBILE_ANDROID_PACKAGE ||
    !process.env.EAS_PROJECT_ID)
) {
  throw new Error(
    'Set confirmed mobile bundle/package IDs and EAS_PROJECT_ID before a production build.'
  );
}
const config: ExpoConfig = {
  name: 'YellowShifts',
  slug: 'yellowshifts-worker',
  version: '1.0.0',
  scheme: 'yellowshifts',
  icon: './assets/logomark.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: process.env.MOBILE_IOS_BUNDLE_ID || 'il.co.darb.yellowshifts.dev',
    supportsTablet: true,
  },
  android: { package: process.env.MOBILE_ANDROID_PACKAGE || 'il.co.darb.yellowshifts.dev' },
  plugins: [
    ['expo-notifications', { color: '#FCBC00' }],
    '@react-native-community/datetimepicker',
    'expo-router',
    'expo-font',
    'expo-status-bar',
    'expo-secure-store',
    ['expo-localization', { supportsRTL: true, forcesRTL: true }],
    [
      'expo-splash-screen',
      { backgroundColor: '#FFF7CC', image: './assets/logomark.png', imageWidth: 96 },
    ],
  ],
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
};
export default config;
