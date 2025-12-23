'use client';

import classNames from 'classnames';
import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  fullWidth?: boolean;
}

/**
 * Common Button Component
 * Reusable button with consistent styling across the application
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  fullWidth = false
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
    outline: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500 disabled:bg-gray-50 disabled:text-gray-400'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        disabled && 'cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Icon Button Component
 * Button with icon support
 */
export function IconButton({
  children,
  icon,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className = ''
}: ButtonProps & { icon?: ReactNode }) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={classNames('gap-2', className)}
    >
      {icon && <span>{icon}</span>}
      {children}
    </Button>
  );
}



