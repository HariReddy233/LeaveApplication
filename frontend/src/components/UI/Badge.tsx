import React from 'react';
import classNames from 'classnames';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'pending' | 'approved' | 'rejected' | 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={classNames(
        'badge',
        {
          'badge-pending': variant === 'pending',
          'badge-approved': variant === 'approved',
          'badge-rejected': variant === 'rejected',
          'bg-gray-100 text-gray-800': variant === 'default',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-yellow-100 text-yellow-800': variant === 'warning',
          'bg-red-100 text-red-800': variant === 'error',
        },
        className
      )}
    >
      {children}
    </span>
  );
}



