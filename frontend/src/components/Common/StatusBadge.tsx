'use client';

import { Clock, CheckCircle, XCircle } from 'lucide-react';
import classNames from 'classnames';

type StatusType = 'pending' | 'approved' | 'rejected' | 'Pending' | 'Approved' | 'Rejected';

interface StatusBadgeProps {
  status: StatusType | string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Common Status Badge Component
 * Reusable status badge with consistent styling across the application
 */
export default function StatusBadge({ 
  status, 
  showIcon = true, 
  size = 'md',
  className = '' 
}: StatusBadgeProps) {
  const statusLower = status?.toLowerCase() || 'pending';
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };

  const styles = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  };

  const icons = {
    pending: <Clock className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
  };

  const statusKey = statusLower as keyof typeof styles;
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return (
    <span 
      className={classNames(
        'inline-flex items-center gap-1 rounded-full font-medium border',
        sizeClasses[size],
        styles[statusKey] || styles.pending,
        className
      )}
    >
      {showIcon && icons[statusKey]}
      {displayStatus}
    </span>
  );
}

/**
 * Status Badge Variant for HOD/Admin Status Display
 * Used in approval pages where both HOD and Admin statuses are shown
 */
export function StatusBadgeInline({ 
  status, 
  label,
  className = '' 
}: { 
  status: StatusType | string;
  label?: string;
  className?: string;
}) {
  const statusLower = status?.toLowerCase() || 'pending';
  
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const statusKey = statusLower as keyof typeof styles;
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return (
    <div className={classNames('flex items-center gap-1.5', className)}>
      {label && <span className="text-xs text-gray-500">{label}:</span>}
      <span 
        className={classNames(
          'px-2 py-0.5 rounded text-xs font-medium',
          styles[statusKey] || styles.pending
        )}
      >
        {displayStatus}
      </span>
    </div>
  );
}



