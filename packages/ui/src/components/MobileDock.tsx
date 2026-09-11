'use client';
import { useEffect, useState, type ReactNode } from 'react';

export function MobileDock({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const update = () =>
      setEditing(
        !!document.activeElement?.matches(
          'input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]'
        )
      );
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return (
    <div className="mobile-dock-space">
      <nav className="mobile-dock" aria-label="ניווט ראשי" hidden={editing}>
        {children}
      </nav>
    </div>
  );
}
