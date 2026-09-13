import { androidAssociation } from '../association';
export const dynamic = 'force-dynamic';
export function GET() {
  const value = androidAssociation(
    process.env.ANDROID_APP_LINKS_PACKAGE,
    process.env.ANDROID_APP_LINKS_SHA256
  );
  return Response.json(value ?? { error: 'Association configuration pending' }, {
    status: value ? 200 : 503,
    headers: { 'Cache-Control': value ? 'public, max-age=300' : 'no-store' },
  });
}
