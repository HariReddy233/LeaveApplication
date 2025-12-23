import React from 'react';
import classNames from 'classnames';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className, padding = 'md', hover = false, onClick }: CardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={classNames(
        'card',
        paddingClasses[padding],
        {
          'cursor-pointer': onClick || hover,
        },
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}



