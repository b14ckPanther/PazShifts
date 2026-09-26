import type { ReactNode } from 'react';
import { BrandEntrance } from './BrandSplash';

/** Branded route splash screen. Mustard yellow Paz branding. */
export function RouteLoading({ children }: { children?: ReactNode }) {
  return (
    <div
      data-route-loading="true"
      className="brand-splash brand-splash-visible"
      role="status"
      aria-busy="true"
      aria-label="טוענים"
    >
      {children ?? <BrandEntrance />}
    </div>
  );
}
