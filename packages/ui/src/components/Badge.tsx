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
  ...props
}) => (
  <span className={`ys-badge ys-badge--${variant} ${className}`} {...props}>
    {dot && <span className="ys-badge-dot" aria-hidden="true" />}
    {children}
  </span>
);
