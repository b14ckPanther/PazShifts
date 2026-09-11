import React from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  className = '',
  style,
  ...props
}) => {
  const getMaxWidth = () => {
    switch (size) {
      case 'sm':
        return '640px';
      case 'md':
        return '840px';
      case 'lg':
        return '1140px';
      case 'xl':
        return '1320px';
      case 'full':
        return '100%';
    }
  };

  return (
    <div
      className={`ys-container ${className}`}
      style={{
        width: '100%',
        maxWidth: getMaxWidth(),
        margin: '0 auto',
        padding: '0 20px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`ys-page-header ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '24px 0 32px 0',
        direction: 'rtl',
        textAlign: 'right',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--ys-color-text-primary)',
              letterSpacing: '-0.5px',
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p
            style={{
              fontSize: '15px',
              color: 'var(--ys-color-text-secondary)',
              maxWidth: '640px',
              lineHeight: '1.5',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>{actions}</div>
      )}
    </div>
  );
};
