import type { StationInterest } from '@yellowshifts/database/public';
export async function sendStationInterest(
  value: StationInterest,
  requestId: string,
  platform: string,
  appVersion: string,
  transport: typeof fetch = fetch
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport('https://admin.paz.darb.co.il/api/station-interest', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...value, request_id: requestId, platform, app_version: appVersion }),
    });
    if (response.status === 429) throw Error('יותר מדי ניסיונות כרגע. נסו שוב בעוד שעה.');
    if (!response.ok || (await response.json()).accepted !== true) throw Error('unavailable');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('יותר מדי')) throw error;
    throw Error('הפנייה לא אושרה עדיין. הפרטים נשמרו כאן — בדקו את החיבור ונסו שוב.', {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}
