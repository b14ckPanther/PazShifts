/** Shared branding; each independently deployed app serves its own public assets. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <img
      src="/brand/logomark.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
    />
  );
}

export function BrandLogo() {
  return (
    <img
      src="/brand/logo-horizontal.png"
      alt="YellowShifts"
      width={168}
      height={56}
      style={{
        display: 'block',
        width: '168px',
        maxWidth: '100%',
        height: 'auto',
        objectFit: 'contain',
      }}
    />
  );
}
