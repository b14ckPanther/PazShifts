import { receiveNfcLink, readPending } from '../src/nfc/pending';
export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^https?:/i.test(path))
      return (await receiveNfcLink(path))
        ? `/attendance?scan=${(await readPending())?.scanId ?? ''}`
        : '/attendance?invalid=1';
    // Custom schemes cannot impersonate an HTTPS tag event.
    if (/(?:^|\/)nfc\//i.test(path)) return '/attendance?invalid=1';
    return path;
  } catch {
    return '/attendance?invalid=1';
  }
}
