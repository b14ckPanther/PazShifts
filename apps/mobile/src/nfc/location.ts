import * as Location from 'expo-location';
import { Platform } from 'react-native';
/** One foreground fix per explicit confirmation. Never persisted or logged. */
export async function scanLocation() {
  let p = await Location.getForegroundPermissionsAsync();
  if (!p.granted) p = await Location.requestForegroundPermissionsAsync();
  if (!p.granted) throw Error('LOCATION_REQUIRED');
  if (
    (Platform.OS === 'ios' && p.ios?.accuracy !== 'full') ||
    (Platform.OS === 'android' && p.android?.accuracy !== 'fine')
  )
    throw Error('LOCATION_INACCURATE');
  if (!(await Location.hasServicesEnabledAsync())) throw Error('LOCATION_UNAVAILABLE');
  let timer: ReturnType<typeof setTimeout>;
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('LOCATION_TIMEOUT')), 12000);
    }),
  ]).finally(() => clearTimeout(timer));
  if (fix.mocked) throw Error('LOCATION_MOCKED');
  if (
    fix.coords.accuracy === null ||
    !Number.isFinite(fix.timestamp) ||
    Date.now() - fix.timestamp > 60000 ||
    fix.timestamp > Date.now() + 10000
  )
    throw Error('LOCATION_STALE');
  return {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    accuracy: fix.coords.accuracy,
    timestamp: fix.timestamp,
  };
}
