import { appleAssociation } from '../association';
export const dynamic = 'force-dynamic';
export function GET() {
  const value = appleAssociation(process.env.APPLE_APP_IDS);
  return Response.json(value ?? { error: 'Association configuration pending' }, {
    status: value ? 200 : 503,
    headers: { 'Cache-Control': value ? 'public, max-age=300' : 'no-store' },
  });
}
