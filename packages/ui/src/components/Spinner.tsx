import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
  color = 'currentColor',
}) => {
  const sizePixels = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;

  return (
    <svg
      className={`ys-spinner ${className}`}
      width={sizePixels}
      height={sizePixels}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation: 'ys-spin 0.75s linear infinite',
      }}
      role="status"
      aria-label="טוען..."
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4"
        strokeDashoffset="10"
        opacity="0.25"
      />
      <path
        d="M12 2C6.47715 2 2 6.47715 2 12"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <style>{`
        @keyframes ys-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
};
