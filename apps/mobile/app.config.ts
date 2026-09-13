import type { ExpoConfig } from 'expo/config';
// Owner-confirmed identities. Preview uses the production identity for signed release QA.
const profile = process.env.EAS_BUILD_PROFILE ?? 'development';
if (!['development', 'development-device', 'preview', 'production'].includes(profile))
  throw new Error('Unknown build profile. Choose an explicit release profile.');
const release = profile === 'production' || profile === 'preview';
const identity = release ? 'il.co.darb.yellowshifts' : 'il.co.darb.yellowshifts.dev';
for (const value of [process.env.MOBILE_IOS_BUNDLE_ID, process.env.MOBILE_ANDROID_PACKAGE]) {
  if (value && value !== identity)
    throw new Error('Build identity does not match the selected profile.');
}
const easProjectId = process.env.EAS_PROJECT_ID || 'c737ab37-6406-450c-ace7-b516e7815c93';
const nativeNfc =
  process.env.EXPO_PUBLIC_NATIVE_NFC_ENABLED === 'true' ||
  (!release && process.env.EXPO_PUBLIC_NATIVE_NFC_ENABLED !== 'false');
const backgroundLocation =
  process.env.EXPO_PUBLIC_BACKGROUND_LOCATION_ENABLED === 'true' ||
  (!release && process.env.EXPO_PUBLIC_BACKGROUND_LOCATION_ENABLED !== 'false');
const config: ExpoConfig = {
  name: 'YellowShifts',
  owner: 'millionroses',
  slug: 'yellowshifts-worker',
  version: '1.0.0',
  scheme: 'yellowshifts',
  icon: './assets/logomark.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: identity,
    supportsTablet: true,
    associatedDomains: nativeNfc
      ? ['applinks:paz.darb.co.il', 'applinks:paz-shifts.vercel.app']
      : [],
  },
  android: {
    allowBackup: false,
    blockedPermissions: release
      ? [
          'android.permission.READ_EXTERNAL_STORAGE',
          'android.permission.WRITE_EXTERNAL_STORAGE',
          'android.permission.SYSTEM_ALERT_WINDOW',
        ]
      : [],
    intentFilters: (nativeNfc ? ['paz.darb.co.il', 'paz-shifts.vercel.app'] : []).map((host) => ({
      action: 'VIEW',
      autoVerify: true,
      category: ['BROWSABLE', 'DEFAULT'],
      data: [{ scheme: 'https', host, pathPrefix: '/nfc/' }],
    })),
    package: identity,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  plugins: [
    ['expo-dev-client', { addGeneratedScheme: !release }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'המיקום משמש לאימות דיווח נוכחות בעת סריקת NFC, ולתזכורות לפי מיקום אם בחרת להפעיל אותן. לא נשמרת היסטוריית מיקום.',
        locationAlwaysAndWhenInUsePermission: backgroundLocation
          ? 'אפשר מיקום תמיד כדי לקבל תזכורת לסריקה בהגעה לתחנה, ולדיווח יציאה כשעזבת עם משמרת פעילה, גם כשהאפליקציה סגורה. אין מעקב מסלול או דיווח נוכחות אוטומטי.'
          : false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isAndroidMotionActivityEnabled: false,
        isIosBackgroundLocationEnabled: backgroundLocation,
        isAndroidBackgroundLocationEnabled: backgroundLocation,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ['expo-notifications', { color: '#FCBC00', defaultChannel: 'work' }],
    '@react-native-community/datetimepicker',
    'expo-router',
    'expo-font',
    'expo-status-bar',
    ['expo-secure-store', { faceIDPermission: false }],
    ['expo-localization', { supportsRTL: true, forcesRTL: true }],
    [
      'expo-splash-screen',
      { backgroundColor: '#FFF7CC', image: './assets/logomark.png', imageWidth: 96 },
    ],
    ['./plugins/withReleaseGuardrails.cjs', { release, backgroundLocation }],
  ],
  extra: { eas: { projectId: easProjectId }, features: { nativeNfc, backgroundLocation } },
};
export default config;
