import { createClient } from '@supabase/supabase-js';
import { handleStationInterest } from './handler';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'unavailable' }, { status: 503 });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleStationInterest(request, client, process.env);
}
