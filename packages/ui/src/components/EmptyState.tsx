import React from 'react';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

/** An empty state that says what is missing and what to do next. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  ...props
}) => (
  <div className={`ys-empty ${className}`} {...props}>
    {icon && (
      <span className="ys-empty-icon" aria-hidden="true">
        {icon}
      </span>
    )}
    <p className="ys-empty-title">{title}</p>
    {description && <p className="ys-empty-text">{description}</p>}
    {action && <div className="ys-empty-action">{action}</div>}
  </div>
);

export const Skeleton: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = '100%',
  height = '16px',
  className = '',
}) => <span aria-hidden="true" className={`ys-skeleton ${className}`} style={{ width, height }} />;
