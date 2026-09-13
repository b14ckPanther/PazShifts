export const workerHosts = ['paz.darb.co.il', 'paz-shifts.vercel.app'] as const;
export const tokenPattern = /^[a-zA-Z0-9_-]{16,256}$/;
export const scanPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseNfcLink(input: string): { token: string; scan?: string; at?: number } | null {
  try {
    if (
      input.length > 2048 ||
      /[\s\\]/.test(input) ||
      /(?:\/|%2f)(?:\.|%2e)(?:\.|%2e)?(?:\/|%2f)/i.test(input)
    )
      return null;
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !workerHosts.some((h) => h === url.hostname) ||
      url.hash
    )
      return null;
    const match = url.pathname.match(/^\/nfc\/([a-zA-Z0-9_-]{16,256})$/);
    if (!match) return null;
    if ([...url.searchParams.keys()].some((k) => !['scan', 'at'].includes(k))) return null;
    const scan = url.searchParams.get('scan'),
      at = url.searchParams.get('at');
    if (url.searchParams.getAll('scan').length > 1 || url.searchParams.getAll('at').length > 1)
      return null;
    if (url.searchParams.has('scan') || url.searchParams.has('at')) {
      if (
        !scan ||
        !at ||
        !scanPattern.test(scan) ||
        !/^\d{10,16}$/.test(at) ||
        !Number.isSafeInteger(Number(at))
      )
        return null;
      return { token: match[1], scan, at: Number(at) };
    }
    return { token: match[1] };
  } catch {
    return null;
  }
}
