'use client';

import React, { useEffect, useId, useRef } from 'react';
import { CloseIcon } from '@yellowshifts/icons';
import { Button } from './Button';
import { useDialogFocusReturn } from './useDialogFocusReturn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Actions row; primary action first (it sits at the inline start in RTL). */
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /** False while a request is in flight: Escape and backdrop clicks are ignored. */
  dismissible?: boolean;
  closeLabel?: string;
  className?: string;
}

/**
 * Modal built on the native <dialog>: the browser provides the focus trap, Escape,
 * focus return and inert background. On phones it renders as a bottom sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  closeLabel = 'סגירה',
  className = '',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useDialogFocusReturn(open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => () => ref.current?.close(), []);

  return (
    <dialog
      ref={ref}
      className={`ys-dialog${size === 'lg' ? ' ys-dialog--lg' : ''} ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        // A click on the <dialog> element itself is a click on the backdrop.
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      {open && (
        <>
          <div className="ys-dialog-header">
            <div>
              <h2 id={titleId} className="ys-dialog-title">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="ys-dialog-description">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              iconOnly
              className="ys-dialog-close"
              aria-label={closeLabel}
              disabled={!dismissible}
              onClick={onClose}
            >
              <CloseIcon size={20} />
            </Button>
          </div>
          {children && <div className="ys-dialog-body">{children}</div>}
          {footer && <div className="ys-dialog-footer">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
