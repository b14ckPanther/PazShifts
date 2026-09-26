import React from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  className = '',
  ...props
}) => (
  <div
    className={`ys-container${size === 'full' ? '' : ` ys-container--${size}`} ${className}`}
    {...props}
  >
    {children}
  </div>
);

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
}) => (
  <div className={`ys-page-header ${className}`}>
    <div className="ys-page-header-text">
      <div className="ys-page-header-title">
        <h1>{title}</h1>
        {badge}
      </div>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="ys-page-header-actions">{actions}</div>}
  </div>
);
