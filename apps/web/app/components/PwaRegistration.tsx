'use client';

import { useEffect } from 'react';
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          // The online app remains usable if registration is unavailable/private browsing.
        });
    }
  }, []);
  return null;
}
