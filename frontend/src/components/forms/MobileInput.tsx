'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">+1</span>
          <input
            ref={ref}
            type="tel"
            className={clsx(
              'w-full pl-12 pr-4 py-3 border rounded-lg',
              'focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'transition-all outline-none',
              error
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 bg-white',
              className
            )}
            placeholder="(555) 123-4567"
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

MobileInput.displayName = 'MobileInput';

export default MobileInput;






