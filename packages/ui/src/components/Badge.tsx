import React from 'react';

export type BadgeVariant =
  'brandYellow' | 'brandCrimson' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
  style,
  ...props
}) => {
  const getStyles = (): { container: React.CSSProperties; dotColor: string } => {
    switch (variant) {
      case 'brandYellow':
        return {
          container: {
            backgroundColor: 'var(--ys-color-brand-yellow-subtle)',
            color: '#8A6800',
            border: '1px solid var(--ys-color-brand-yellow)',
          },
          dotColor: 'var(--ys-color-brand-yellow)',
        };
      case 'brandCrimson':
        return {
          container: {
            backgroundColor: 'var(--ys-color-status-danger-subtle)',
            color: 'var(--ys-color-brand-crimson)',
            border: '1px solid var(--ys-color-brand-crimson)',
          },
          dotColor: 'var(--ys-color-brand-crimson)',
        };
      case 'success':
        return {
          container: {
            backgroundColor: 'var(--ys-color-status-success-subtle)',
            color: '#1E7E34',
            border: '1px solid var(--ys-color-status-success)',
          },
          dotColor: 'var(--ys-color-status-success)',
        };
      case 'warning':
        return {
          container: {
            backgroundColor: 'var(--ys-color-status-warning-subtle)',
            color: '#B26B00',
            border: '1px solid var(--ys-color-status-warning)',
          },
          dotColor: 'var(--ys-color-status-warning)',
        };
      case 'danger':
        return {
          container: {
            backgroundColor: 'var(--ys-color-status-danger-subtle)',
            color: 'var(--ys-color-status-danger)',
            border: '1px solid var(--ys-color-status-danger)',
          },
          dotColor: 'var(--ys-color-status-danger)',
        };
      case 'info':
        return {
          container: {
            backgroundColor: 'var(--ys-color-status-info-subtle)',
            color: 'var(--ys-color-status-info)',
            border: '1px solid var(--ys-color-status-info)',
          },
          dotColor: 'var(--ys-color-status-info)',
        };
      case 'neutral':
      default:
        return {
          container: {
            backgroundColor: 'var(--ys-color-surface-muted)',
            color: 'var(--ys-color-text-secondary)',
            border: '1px solid var(--ys-color-border-subtle)',
          },
          dotColor: 'var(--ys-color-text-muted)',
        };
    }
  };

  const { container, dotColor } = getStyles();

  return (
    <span
      className={`ys-badge ys-badge--${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: 'var(--ys-radius-pill)',
        lineHeight: '1.4',
        ...container,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
};
