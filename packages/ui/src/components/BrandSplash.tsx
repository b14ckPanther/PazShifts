'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { BrandLogo } from './Brand';

export function BrandEntrance() {
  return (
    <div className="brand-entrance" aria-hidden="true">
      <div className="brand-orbit">
        <span className="brand-orbit-ring" />
        <span className="brand-orbit-dot" />
        <img src="/brand/logomark.png" width="80" height="80" alt="" />
      </div>
      <BrandLogo />
      <span className="brand-entrance-track">
        <span />
      </span>
    </div>
  );
}

const SPLASH_DURATION_MS = 1400;

/** Branded splash screen for initial load and smooth tab transitions. */
export function BrandSplash() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const triggerSplash = useCallback((duration = SPLASH_DURATION_MS) => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.location.pathname.startsWith('/nfc/')) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setVisible(true);

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, duration);
  }, []);

  // 1. Initial page load splash
  useEffect(() => {
    triggerSplash(SPLASH_DURATION_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [triggerSplash]);

  // 2. Intercept tab clicks in navigation dock & internal links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.target === '_blank'
      ) {
        return;
      }

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;
        if (targetUrl.pathname.startsWith('/nfc/')) return;

        const currentFull = window.location.pathname + window.location.search;
        const targetFull = targetUrl.pathname + targetUrl.search;
        if (currentFull === targetFull) return;

        // Navigating to a different tab or page: trigger splash!
        triggerSplash(SPLASH_DURATION_MS);
      } catch {
        // ignore invalid URLs
      }
    };

    const handlePopState = () => {
      triggerSplash(SPLASH_DURATION_MS);
    };

    const handleCustomSplash = (e: Event) => {
      const customEvent = e as CustomEvent<{ duration?: number }>;
      triggerSplash(customEvent.detail?.duration || SPLASH_DURATION_MS);
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('ys-show-splash', handleCustomSplash);

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('ys-show-splash', handleCustomSplash);
    };
  }, [triggerSplash]);

  return (
    <div
      className={`brand-splash ${visible ? 'brand-splash-visible' : ''}`}
      aria-hidden={!visible}
    >
      <BrandEntrance />
    </div>
  );
}

/** Branded full page loading. */
export function BrandLoading() {
  return (
    <main className="brand-loading" role="status" aria-busy="true">
      <BrandEntrance />
    </main>
  );
}
