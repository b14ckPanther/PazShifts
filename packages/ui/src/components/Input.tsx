import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isRequired?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      isRequired,
      id,
      className = '',
      style,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div
        className={`ys-form-field ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          width: '100%',
          textAlign: 'right',
        }}
      >
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: error ? 'var(--ys-color-status-danger)' : 'var(--ys-color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {label}
            {isRequired && <span style={{ color: 'var(--ys-color-brand-crimson)' }}>*</span>}
          </label>
        )}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {rightIcon && (
            <div
              style={{
                position: 'absolute',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--ys-color-text-muted)',
                pointerEvents: 'none',
              }}
            >
              {rightIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            style={{
              width: '100%',
              height: '42px',
              padding: `0 ${rightIcon ? '40px' : '14px'} 0 ${leftIcon ? '40px' : '14px'}`,
              backgroundColor: disabled
                ? 'var(--ys-color-surface-muted)'
                : 'var(--ys-color-surface-raised)',
              border: `1px solid ${
                error ? 'var(--ys-color-status-danger)' : 'var(--ys-color-border-subtle)'
              }`,
              borderRadius: 'var(--ys-radius-md)',
              fontSize: '14px',
              color: 'var(--ys-color-text-primary)',
              outline: 'none',
              transition:
                'border-color var(--ys-transition-fast), box-shadow var(--ys-transition-fast)',
              direction: 'rtl',
              textAlign: 'right',
              cursor: disabled ? 'not-allowed' : 'text',
              ...style,
            }}
            {...props}
          />

          {leftIcon && (
            <div
              style={{
                position: 'absolute',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--ys-color-text-muted)',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </div>
          )}
        </div>

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            style={{
              fontSize: '12px',
              color: 'var(--ys-color-status-danger)',
              margin: '2px 0 0 0',
            }}
          >
            {error}
          </p>
        ) : helperText ? (
          <p
            id={`${inputId}-helper`}
            style={{
              fontSize: '12px',
              color: 'var(--ys-color-text-muted)',
              margin: '2px 0 0 0',
            }}
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
