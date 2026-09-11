import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'subtle':
        return {
          backgroundColor: 'var(--ys-color-surface-muted)',
          border: '1px solid var(--ys-color-border-subtle)',
        };
      case 'interactive':
        return {
          backgroundColor: 'var(--ys-color-surface-raised)',
          border: '1px solid var(--ys-color-border-subtle)',
          cursor: 'pointer',
          transition: 'all var(--ys-transition-fast)',
        };
      case 'default':
      default:
        return {
          backgroundColor: 'var(--ys-color-surface-raised)',
          border: '1px solid var(--ys-color-border-subtle)',
          boxShadow: 'var(--ys-shadow-subtle)',
        };
    }
  };

  return (
    <div
      className={`ys-card ${className}`}
      style={{
        borderRadius: 'var(--ys-radius-lg)',
        padding: '24px',
        textAlign: 'right',
        direction: 'rtl',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`ys-card-header ${className}`}
    style={{
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <h3
    className={`ys-card-title ${className}`}
    style={{
      fontSize: '18px',
      fontWeight: 600,
      color: 'var(--ys-color-text-primary)',
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <p
    className={`ys-card-description ${className}`}
    style={{
      fontSize: '14px',
      color: 'var(--ys-color-text-secondary)',
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`ys-card-content ${className}`}
    style={{
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  style,
  ...props
}) => (
  <div
    className={`ys-card-footer ${className}`}
    style={{
      marginTop: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '12px',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
