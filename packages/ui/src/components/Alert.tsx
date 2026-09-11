import React from 'react';
import { SuccessIcon, WarningIcon, DangerIcon, StationIcon } from '@yellowshifts/icons';

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success' | 'brand';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  icon,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): {
    bg: string;
    border: string;
    text: string;
    defaultIcon: React.ReactNode;
  } => {
    switch (variant) {
      case 'success':
        return {
          bg: 'var(--ys-color-status-success-subtle)',
          border: 'var(--ys-color-status-success)',
          text: '#165B27',
          defaultIcon: <SuccessIcon size={20} color="var(--ys-color-status-success)" />,
        };
      case 'warning':
        return {
          bg: 'var(--ys-color-status-warning-subtle)',
          border: 'var(--ys-color-status-warning)',
          text: '#8F5300',
          defaultIcon: <WarningIcon size={20} color="var(--ys-color-status-warning)" />,
        };
      case 'danger':
        return {
          bg: 'var(--ys-color-status-danger-subtle)',
          border: 'var(--ys-color-status-danger)',
          text: 'var(--ys-color-brand-crimson)',
          defaultIcon: <DangerIcon size={20} color="var(--ys-color-status-danger)" />,
        };
      case 'brand':
        return {
          bg: 'var(--ys-color-brand-yellow-subtle)',
          border: 'var(--ys-color-brand-yellow)',
          text: '#664D00',
          defaultIcon: <StationIcon size={20} color="var(--ys-color-brand-crimson)" />,
        };
      case 'info':
      default:
        return {
          bg: 'var(--ys-color-status-info-subtle)',
          border: 'var(--ys-color-status-info)',
          text: '#0051A8',
          defaultIcon: <StationIcon size={20} color="var(--ys-color-status-info)" />,
        };
    }
  };

  const config = getVariantStyles();

  return (
    <div
      role="alert"
      className={`ys-alert ys-alert--${variant} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: 'var(--ys-radius-md)',
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
        textAlign: 'right',
        direction: 'rtl',
        ...style,
      }}
      {...props}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon || config.defaultIcon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
        {title && <strong style={{ fontSize: '14px', fontWeight: 600 }}>{title}</strong>}
        <div style={{ fontSize: '13px', lineHeight: '1.5' }}>{children}</div>
      </div>
    </div>
  );
};
