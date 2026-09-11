'use client';

import { useEffect, useRef, useId, type ReactNode } from 'react';
import { CloseIcon } from '@yellowshifts/icons';

export function StaffDialog({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="staff-dialog"
      dir="rtl"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="staff-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="staff-icon-button"
          aria-label="סגירה"
          disabled={busy}
          onClick={onClose}
        >
          <CloseIcon size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
