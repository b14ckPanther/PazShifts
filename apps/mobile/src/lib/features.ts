import Constants from 'expo-constants';
// Fail closed if an old/missing manifest cannot attest the build configuration.
export const nativeNfcEnabled = Constants.expoConfig?.extra?.features?.nativeNfc === true;
export const backgroundLocationEnabled =
  Constants.expoConfig?.extra?.features?.backgroundLocation === true;
