/** Public association documents: signing values are public identifiers, never private keys. */
export function appleAssociation(raw: string | undefined) {
  const ids = (raw ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    !ids.length ||
    ids.some((id) => !/^[A-Z0-9]{10}\.[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)+$/.test(id))
  )
    return null;
  return { applinks: { apps: [], details: ids.map((appID) => ({ appID, paths: ['/nfc/*'] })) } };
}
export function androidAssociation(packageName: string | undefined, raw: string | undefined) {
  const fingerprints = (raw ?? '')
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  if (
    !packageName ||
    !/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName) ||
    !fingerprints.length ||
    fingerprints.some((f) => !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(f))
  )
    return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
