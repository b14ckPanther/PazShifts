'use client';

import { Fragment, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
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

const SPLASH_DURATION_MS = 1800;

/**
 * Branded splash screen for initial load and smooth tab transitions. Apps with their own
 * launch intro pass `showOnMount={false}` to keep only the navigation splash, and may
 * replace the default entrance animation with `content` and its minimum `duration`.
 */
export function BrandSplash({
  waitForContent = false,
  showOnMount = true,
  content,
  duration = SPLASH_DURATION_MS,
}: {
  waitForContent?: boolean;
  showOnMount?: boolean;
  content?: ReactNode;
  duration?: number;
}) {
  const [visible, setVisible] = useState(false);
  // Remounts the content on each opening so entrance animations do not finish while
  // hidden, and keeps it mounted while the splash fades out.
  const [opening, setOpening] = useState(0);
  const timerRef = useRef<number | null>(null);
  const shownRef = useRef(false);

  const triggerSplash = useCallback(
    (minimum = duration) => {
      if (typeof window === 'undefined') return;
      if (!waitForContent && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (window.location.pathname.startsWith('/nfc/')) return;

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!shownRef.current) setOpening((count) => count + 1);
      shownRef.current = true;
      setVisible(true);

      const finishWhenReady = () => {
        // Next's link status covers server navigation; loading boundaries cover
        // streamed content, and the login form exposes its server-action state.
        const pending =
          waitForContent &&
          document.querySelector(
            '[data-route-loading], .navigation-pending[data-pending="true"], .compact-login-form[aria-busy="true"]'
          );
        if (pending) {
          timerRef.current = window.setTimeout(finishWhenReady, 100);
          return;
        }
        shownRef.current = false;
        setVisible(false);
        timerRef.current = null;
      };
      timerRef.current = window.setTimeout(finishWhenReady, minimum);
    },
    [waitForContent, duration]
  );

  // 1. Initial page load splash
  useEffect(() => {
    if (showOnMount) triggerSplash();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [triggerSplash, showOnMount]);

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
        triggerSplash();
      } catch {
        // ignore invalid URLs
      }
    };

    const handlePopState = () => {
      triggerSplash();
    };

    const handleCustomSplash = (e: Event) => {
      const customEvent = e as CustomEvent<{ duration?: number }>;
      triggerSplash(customEvent.detail?.duration || undefined);
    };

    const handleLogin = (e: Event) => {
      if (!waitForContent || !(e.target instanceof HTMLFormElement)) return;
      if (!e.target.matches('.compact-login-form')) return;
      const next = new FormData(e.target).get('next');
      if (typeof next === 'string' && next.startsWith('/nfc/')) return;
      triggerSplash();
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('ys-show-splash', handleCustomSplash);
    document.addEventListener('submit', handleLogin, { capture: true });

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('ys-show-splash', handleCustomSplash);
      document.removeEventListener('submit', handleLogin, { capture: true });
    };
  }, [triggerSplash, waitForContent]);

  return (
    <div
      className={`brand-splash ${visible ? 'brand-splash-visible' : ''}`}
      aria-hidden={!visible}
      role="status"
      aria-label="טוענים את התחנה שלכם"
      data-wait-for-content={waitForContent}
    >
      {opening > 0 && <Fragment key={opening}>{content ?? <BrandEntrance />}</Fragment>}
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
