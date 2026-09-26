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
      role="status"
      aria-label="טוען..."
    >
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 0-10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};
