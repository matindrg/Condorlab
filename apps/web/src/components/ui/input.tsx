import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, type = 'text', ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full text-right">
        {label && (
          <label htmlFor={inputId} className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`w-full min-h-[44px] sm:min-h-[46px] h-11 sm:h-[46px] px-4 py-2.5 rounded-xl bg-[#181818] border ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-[#333333] focus:border-[#FFCC00] focus:ring-[#FFCC00]/20'
          } text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
