import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, NfcScanResult, ResolvedNfcStation } from '@yellowshifts/types';
import { getNativeWorkerContext } from './worker-context';
export type NativeNfcContext = {
  station: ResolvedNfcStation;
  active: { id: string; station_id: string; clock_in_at: string } | null;
  leftOpenHours: number;
  receipt: NfcScanResult | null;
};
export async function getNativeNfcContext(
  client: SupabaseClient<Database>,
  userId: string,
  token: string,
  scanId: string
): Promise<NativeNfcContext> {
  const context = await getNativeWorkerContext(client, userId);
  const resolved = await client.rpc('resolve_station_by_nfc_token', { p_token: token });
  if (resolved.error || !resolved.data?.[0]?.is_active) throw Error('INVALID_TAG');
  const station = resolved.data[0];
  if (!context.stations.some((s) => s.id === station.id)) throw Error('NO_MEMBERSHIP');
  const [active, settings, receipt] = await Promise.all([
    client
      .from('attendance_records')
      .select('id,station_id,clock_in_at')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle(),
    client.from('stations').select('left_open_warning_hours').eq('id', station.id).single(),
    client.rpc('read_native_nfc_receipt', { p_token: token, p_scan_id: scanId }),
  ]);
  if (active.error || settings.error || receipt.error)
    throw Error(
      receipt.error?.code === 'PGRST202'
        ? 'SERVICE_UNAVAILABLE'
        : receipt.error?.code === '42501'
          ? 'SESSION_EXPIRED'
          : 'NETWORK_ERROR'
    );
  return {
    station,
    active: active.data,
    leftOpenHours: settings.data.left_open_warning_hours,
    receipt: receipt.data as unknown as NfcScanResult | null,
  };
}
export type NativeNfcRequest = {
  token: string;
  scanId: string;
  at: number;
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  recordId: string | null;
};
export async function submitNativeNfc(
  client: SupabaseClient<Database>,
  userId: string,
  request: NativeNfcRequest,
  location: { latitude: number; longitude: number; accuracy: number; timestamp: number }
): Promise<NfcScanResult> {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) return { success: false, code: 'SESSION_EXPIRED' };
  const response = await client.rpc('process_native_nfc_scan', {
    p_token: request.token,
    p_scan_id: request.scanId,
    p_scanned_at: new Date(request.at).toISOString(),
    p_expected_action: request.action,
    p_expected_record: request.recordId,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_accuracy: location.accuracy,
    p_location_at: new Date(location.timestamp).toISOString(),
  });
  if (response.error || !response.data)
    return {
      success: false,
      code: response.error?.code === 'PGRST202' ? 'SERVICE_UNAVAILABLE' : 'NETWORK_ERROR',
    };
  return response.data as unknown as NfcScanResult;
}
