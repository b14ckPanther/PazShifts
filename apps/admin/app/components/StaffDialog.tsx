'use client';

import { useEffect, useRef, useId, type ReactNode } from 'react';
import { Button, useDialogFocusReturn } from '@yellowshifts/ui';
import { CloseIcon } from '@yellowshifts/icons';

/**
 * Native <dialog> used by the staff and attendance dialogs. It shares the `.ys-dialog`
 * look (centered on desktop, bottom sheet on phones). Children own their form and their
 * `.staff-dialog-footer` / `.staff-dialog-actions` row, which sticks to the bottom.
 * Escape, the backdrop and the close button are ignored while `busy`.
 */
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
  useDialogFocusReturn(true);
  useEffect(() => {
    const dialog = ref.current;
    // Focus the dialog itself (not the close button) so no focus ring flashes on open.
    dialog?.setAttribute('autofocus', '');
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className="ys-dialog staff-dialog"
      dir="rtl"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        // A click on the <dialog> element itself is a click on the backdrop.
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <header className="ys-dialog-header">
        <h2 id={titleId} className="ys-dialog-title">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          iconOnly
          className="ys-dialog-close"
          aria-label="סגירה"
          disabled={busy}
          onClick={onClose}
        >
          <CloseIcon size={20} />
        </Button>
      </header>
      <div className="ys-dialog-body staff-dialog-body">{children}</div>
    </dialog>
  );
}
