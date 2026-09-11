'use client';

import { useEffect, useState } from 'react';
import { BrandLogo } from './Brand';

function BrandEntrance() {
  return (
    <div className="brand-entrance" aria-hidden="true">
      <div className="brand-orbit">
        <span className="brand-orbit-ring" />
        <span className="brand-orbit-dot" />
        <img src="/brand/logomark.png" width="80" height="80" alt="" />
      </div>
      <BrandLogo />
      <span className="brand-entrance-caption">הזמן שלך. המשמרת שלך.</span>
      <span className="brand-entrance-track">
        <span />
      </span>
    </div>
  );
}

/** Once per tab. Never intercept input, delay authentication, or replay for NFC receipts. */
export function BrandSplash() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.location.pathname.startsWith('/nfc/')) return;
    try {
      if (sessionStorage.getItem('ys-brand-intro')) return;
      sessionStorage.setItem('ys-brand-intro', '1');
    } catch {
      // When storage is unavailable, skip decoration so scans remain quick.
      return;
    }
    setVisible(true);
    const dismiss = () => setVisible(false);
    const timer = window.setTimeout(dismiss, 1100);
    window.addEventListener('pointerdown', dismiss, { once: true });
    window.addEventListener('keydown', dismiss, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, []);
  return visible ? (
    <div className="brand-splash" aria-hidden="true">
      <BrandEntrance />
    </div>
  ) : null;
}

/** Real route loading, with no artificial minimum delay. */
export function BrandLoading() {
  return (
    <main className="brand-loading" role="status" aria-busy="true">
      <BrandEntrance />
      <p>טוענים את המסך שלך…</p>
    </main>
  );
}
