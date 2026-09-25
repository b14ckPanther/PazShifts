'use client';
import type { ReactNode } from 'react';

export function MobileDock({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-dock-space">
      <nav className="mobile-dock" aria-label="ניווט ראשי">
        {children}
      </nav>
    </div>
  );
}

