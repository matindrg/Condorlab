import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium text-sm rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 focus:ring-offset-[#121212] disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[44px] px-5 py-2.5';

    const variants = {
      primary: 'bg-[#FFCC00] text-black font-bold hover:bg-[#E6B800] active:scale-[0.98]',
      secondary: 'bg-[#1E1E1E] text-white hover:bg-[#2A2A2A] border border-[#3A3A3A]',
      outline: 'bg-transparent text-white border border-[#3A3A3A] hover:border-[#FFCC00] hover:text-[#FFCC00]',
      ghost: 'bg-transparent text-gray-300 hover:text-white hover:bg-white/5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span>در حال پردازش...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
