import React from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant =
  | 'primary'
  | 'brandYellow'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'tertiary'
  | 'destructive'
  | 'destructiveOutline';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Rendered at the inline start (right in RTL), before the label. */
  leftIcon?: React.ReactNode;
  /** Rendered at the inline start (right in RTL), before the label. */
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Square icon-only button; pass an `aria-label`. */
  iconOnly?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  iconOnly = false,
  disabled,
  className = '',
  ...props
}) => {
  const classes = [
    'ys-button',
    `ys-button--${variant}`,
    size !== 'md' && `ys-button--${size}`,
    fullWidth && 'ys-button--full',
    iconOnly && 'ys-button--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // No default `type`: inside a form a Button submits, exactly like a native button.
    <button
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      aria-label={isLoading && typeof children === 'string' ? children : undefined}
      className={classes}
      {...props}
    >
      <span className="ys-button-content">
        {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        {children}
        {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
      </span>
      {isLoading && (
        <span className="ys-button-spinner" aria-hidden="true">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      )}
    </button>
  );
};
