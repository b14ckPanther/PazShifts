import React from 'react';
import {
  CalendarClockIcon,
  CircleCheckIcon,
  CircleXIcon,
  DraftIcon,
  OfflineIcon,
  PendingIcon,
  WarningIcon,
} from '@yellowshifts/icons';

export type StatusKind =
  | 'live'
  | 'upcoming'
  | 'completed'
  | 'late'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'warning'
  | 'offline'
  | 'draft'
  | 'published'
  | 'success'
  | 'error';

const DEFAULT_LABELS: Record<StatusKind, string> = {
  live: 'במשמרת עכשיו',
  upcoming: 'קרובה',
  completed: 'הסתיימה',
  late: 'באיחור',
  pending: 'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
  warning: 'דורש תשומת לב',
  offline: 'אין חיבור',
  draft: 'טיוטה',
  published: 'פורסם',
  success: 'בוצע',
  error: 'נכשל',
};

function StatusGlyph({ kind }: { kind: StatusKind }) {
  switch (kind) {
    case 'live':
      return <span className="ys-status-pulse" />;
    case 'upcoming':
      return <CalendarClockIcon size={14} />;
    case 'completed':
    case 'approved':
    case 'published':
    case 'success':
      return <CircleCheckIcon size={14} />;
    case 'late':
    case 'warning':
      return <WarningIcon size={14} />;
    case 'pending':
      return <PendingIcon size={14} />;
    case 'rejected':
    case 'error':
      return <CircleXIcon size={14} />;
    case 'offline':
      return <OfflineIcon size={14} />;
    case 'draft':
      return <DraftIcon size={14} />;
  }
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKind;
  /** Visible text; defaults to the Hebrew label for the status. */
  label?: React.ReactNode;
}

/** Operational status: always icon + text, never color alone. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
  ...props
}) => (
  <span className={`ys-status ys-status--${status} ${className}`} {...props}>
    <span aria-hidden="true" style={{ display: 'inline-flex' }}>
      <StatusGlyph kind={status} />
    </span>
    {label ?? DEFAULT_LABELS[status]}
  </span>
);
