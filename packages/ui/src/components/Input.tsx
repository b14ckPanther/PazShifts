import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  /** Shown at the inline end (left in RTL). */
  leftIcon?: React.ReactNode;
  /** Shown at the inline start (right in RTL). */
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
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    const messageId = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
    return (
      <div className={`ys-form-field ${className}`}>
        {label && (
          <label htmlFor={inputId} className="ys-label">
            {label}
            {isRequired && (
              <span className="ys-label-required" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="ys-field-control">
          {rightIcon && <span className="ys-field-icon ys-field-icon--start">{rightIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className="ys-input"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={messageId}
            aria-required={isRequired || undefined}
            style={style}
            {...props}
          />
          {leftIcon && <span className="ys-field-icon ys-field-icon--end">{leftIcon}</span>}
        </div>
        {error ? (
          <p id={messageId} role="alert" className="ys-error">
            {error}
          </p>
        ) : helperText ? (
          <p id={messageId} className="ys-help">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
