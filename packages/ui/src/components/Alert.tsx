import React from 'react';
import { SuccessIcon, WarningIcon, DangerIcon, InfoIcon, StationIcon } from '@yellowshifts/icons';

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success' | 'brand';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
}

const ICONS: Record<AlertVariant, React.ReactNode> = {
  success: <SuccessIcon size={20} />,
  warning: <WarningIcon size={20} />,
  danger: <DangerIcon size={20} />,
  brand: <StationIcon size={20} />,
  info: <InfoIcon size={20} />,
};

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  icon,
  className = '',
  role,
  ...props
}) => (
  <div
    // Problems interrupt screen readers; informational notes are announced politely.
    role={role ?? (variant === 'danger' || variant === 'warning' ? 'alert' : 'status')}
    className={`ys-alert ys-alert--${variant} ${className}`}
    {...props}
  >
    <span className="ys-alert-icon" aria-hidden="true">
      {icon || ICONS[variant]}
    </span>
    <div className="ys-alert-body">
      {title && <strong className="ys-alert-title">{title}</strong>}
      {children && <div className="ys-alert-content">{children}</div>}
    </div>
  </div>
);
