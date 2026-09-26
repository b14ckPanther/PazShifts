'use client';

import { useEffect } from 'react';

/**
 * Returns focus to the element that opened a dialog. The browser only does this when a
 * <dialog> is closed while still in the document; dialogs that unmount on close lose it.
 */
export function useDialogFocusReturn(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      window.setTimeout(() => {
        const current = document.activeElement;
        const lost = !current || current === document.body || !current.isConnected;
        if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
      }, 0);
    };
  }, [active]);
}
