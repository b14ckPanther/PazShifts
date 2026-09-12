'use server';

import type { TypedSupabaseClient } from '@yellowshifts/database';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@yellowshifts/database';
import type { NfcScanResult } from '@yellowshifts/types';

export async function processNfcScanAction(
  token: string,
  scanId: string,
  scannedAt: number,
  decision: 'scan' | 'confirm' | 'cancel' = 'scan',
  location?: { latitude: number; longitude: number; accuracy: number; timestamp: number }
): Promise<NfcScanResult> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scanId) ||
    !['scan', 'confirm', 'cancel'].includes(decision) ||
    !token ||
    token.length > 256 ||
    !Number.isFinite(scannedAt) ||
    Math.abs(scannedAt) > 8.64e15
  ) {
    return { success: false, code: 'INVALID_SCAN' };
  }
  try {
    const supabase: TypedSupabaseClient = createServerSupabaseClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, code: 'SESSION_EXPIRED' };
    const { data, error } = await supabase.rpc('process_nfc_scan', {
      p_token: token,
      p_scan_id: scanId,
      p_scanned_at: new Date(scannedAt).toISOString(),
      p_decision: decision,
      p_latitude: location?.latitude ?? null,
      p_longitude: location?.longitude ?? null,
      p_accuracy: location?.accuracy ?? null,
      p_location_at:
        location && Number.isFinite(location.timestamp) && Math.abs(location.timestamp) <= 8.64e15
          ? new Date(location.timestamp).toISOString()
          : null,
    });
    if (error || !data)
      return {
        success: false,
        code: error?.code === 'PGRST202' ? 'SERVICE_UNAVAILABLE' : 'NETWORK_ERROR',
      };
    const result = data as unknown as NfcScanResult;
    if (result.success) revalidatePath('/');
    return result;
  } catch {
    // Retrying uses the SAME scan ID, including when the database committed but the response was lost.
    return { success: false, code: 'NETWORK_ERROR' };
  }
}
