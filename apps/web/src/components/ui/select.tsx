import * as React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, children, value, ...props }, ref) => {
    const selectId = id || React.useId();
    const isPlaceholder = value === '' || value === undefined;

    return (
      <div className="w-full text-right">
        {label && (
          <label htmlFor={selectId} className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative w-full">
          <select
            ref={ref}
            id={selectId}
            value={value}
            className={`w-full min-h-[44px] sm:min-h-[46px] h-11 sm:h-[46px] pr-4 pl-10 py-2.5 rounded-xl bg-[#181818] border ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-[#333333] focus:border-[#FFCC00] focus:ring-[#FFCC00]/20'
            } ${
              isPlaceholder ? 'text-gray-400' : 'text-white'
            } text-sm sm:text-base focus:outline-none focus:ring-2 transition-all duration-200 appearance-none cursor-pointer leading-normal disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[#181818] text-white py-2"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
