import React from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant =
  'primary' | 'brandYellow' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  style,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  // Variant Styles based on semantic tokens
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--ys-color-brand-crimson)',
          color: 'var(--ys-color-text-inverse)',
          border: '1px solid transparent',
        };
      case 'brandYellow':
        return {
          backgroundColor: 'var(--ys-color-brand-yellow)',
          color: 'var(--ys-color-text-primary)',
          border: '1px solid transparent',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--ys-color-surface-raised)',
          color: 'var(--ys-color-text-primary)',
          border: '1px solid var(--ys-color-border-medium)',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--ys-color-text-primary)',
          border: '1px solid var(--ys-color-border-subtle)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--ys-color-text-secondary)',
          border: '1px solid transparent',
        };
      case 'destructive':
        return {
          backgroundColor: 'var(--ys-color-status-danger)',
          color: 'var(--ys-color-text-inverse)',
          border: '1px solid transparent',
        };
    }
  };

  // Sizing Styles
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          height: '32px',
          padding: '0 12px',
          fontSize: '13px',
          borderRadius: 'var(--ys-radius-sm)',
        };
      case 'lg':
        return {
          height: '48px',
          padding: '0 24px',
          fontSize: '16px',
          borderRadius: 'var(--ys-radius-md)',
        };
      case 'md':
      default:
        return {
          height: '40px',
          padding: '0 16px',
          fontSize: '14px',
          borderRadius: 'var(--ys-radius-md)',
        };
    }
  };

  return (
    <button
      disabled={isDisabled}
      aria-busy={isLoading}
      aria-label={isLoading && typeof children === 'string' ? children : undefined}
      className={`ys-button ys-button--${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'background-color var(--ys-transition-fast), color var(--ys-transition-fast)',
        position: 'relative',
        outline: 'none',
        width: fullWidth ? '100%' : 'auto',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isLoading ? 0 : 1,
        }}
      >
        {rightIcon && <span style={{ display: 'inline-flex' }}>{rightIcon}</span>}
        <span>{children}</span>
        {leftIcon && <span style={{ display: 'inline-flex' }}>{leftIcon}</span>}
      </span>
      {isLoading && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
        >
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      )}
    </button>
  );
};
