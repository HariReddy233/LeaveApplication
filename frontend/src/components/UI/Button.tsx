import React from 'react';
import classNames from 'classnames';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={classNames(
        'btn',
        `btn-${variant}`,
        sizeClasses[size],
        'font-medium rounded-lg transition-all',
        {
          'bg-[#2563EB] text-white hover:bg-[#1D4ED8]': variant === 'primary',
          'bg-gray-100 text-gray-700 hover:bg-gray-200': variant === 'secondary',
          'bg-[#16A34A] text-white hover:bg-[#15803D]': variant === 'success',
          'bg-[#DC2626] text-white hover:bg-[#B91C1C]': variant === 'danger',
          'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50': variant === 'outline',
          'opacity-50 cursor-not-allowed': props.disabled,
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

