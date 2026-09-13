import type { ExpoConfig } from 'expo/config';
// Linked EAS project; identifiers below remain development identities until production signing.
const easProjectId = process.env.EAS_PROJECT_ID || 'c737ab37-6406-450c-ace7-b516e7815c93';
if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  (!process.env.MOBILE_IOS_BUNDLE_ID || !process.env.MOBILE_ANDROID_PACKAGE)
) {
  throw new Error('Set confirmed mobile bundle/package IDs before a production build.');
}
const config: ExpoConfig = {
  name: 'YellowShifts',
  owner: 'millionroses',
  slug: 'yellowshifts-worker',
  version: '1.0.0',
  scheme: 'yellowshifts',
  icon: './assets/logomark.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: process.env.MOBILE_IOS_BUNDLE_ID || 'il.co.darb.yellowshifts.dev',
    supportsTablet: true,
    associatedDomains: ['applinks:paz.darb.co.il', 'applinks:paz-shifts.vercel.app'],
  },
  android: {
    intentFilters: ['paz.darb.co.il', 'paz-shifts.vercel.app'].map((host) => ({
      action: 'VIEW',
      autoVerify: true,
      category: ['BROWSABLE', 'DEFAULT'],
      data: [{ scheme: 'https', host, pathPrefix: '/nfc/' }],
    })),
    package: process.env.MOBILE_ANDROID_PACKAGE || 'il.co.darb.yellowshifts.dev',
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'המיקום משמש לאימות דיווח נוכחות בעת סריקת NFC, ולתזכורות לפי מיקום אם בחרת להפעיל אותן. לא נשמרת היסטוריית מיקום.',
        locationAlwaysAndWhenInUsePermission:
          'אפשר מיקום תמיד כדי לקבל תזכורות לסריקת NFC גם כשהאפליקציה סגורה. אין מעקב מסלול או דיווח נוכחות אוטומטי.',
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isAndroidMotionActivityEnabled: false,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ['expo-notifications', { color: '#FCBC00', defaultChannel: 'work' }],
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
  extra: { eas: { projectId: easProjectId } },
};
export default config;
