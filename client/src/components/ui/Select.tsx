import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean | string;
  options?: SelectOption[];
  placeholder?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, error, options, placeholder, children, className = '', disabled, ...props },
  ref
) {
  const hasError = Boolean(error);

  return (
    <div className="relative w-full">
      <select
        ref={ref}
        id={id}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={
          hasError && id ? `${id}-error` : id ? `${id}-helper` : undefined
        }
        className={`
          w-full min-h-[44px] bg-white dark:bg-[#1F2937] border rounded-lg px-4 py-2.5 text-base text-[#111827] dark:text-[#F9FAFB] font-sans
          transition-colors duration-150 appearance-none cursor-pointer pr-10
          focus:outline-none focus:ring-2 focus:ring-[#0B3D2E]/20 dark:focus:ring-[#34D399]/30 focus:border-[#0B3D2E] dark:focus:border-[#34D399]
          disabled:bg-[#F9FAFB] dark:disabled:bg-[#182230] disabled:border-[#E5E7EB] dark:disabled:border-[#374151] disabled:text-[#6B7280] dark:disabled:text-[#9CA3AF] disabled:cursor-not-allowed
          ${hasError ? 'border-[#B91C1C] dark:border-[#F87171] focus:ring-[#B91C1C]/20 dark:focus:ring-[#F87171]/30 focus:border-[#B91C1C] dark:focus:border-[#F87171]' : 'border-[#D1D5DB] dark:border-[#4B5563] hover:border-[#9CA3AF] dark:hover:border-[#6EE7B7]'}
          ${className}
        `.trim()}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-[#9CA3AF] dark:text-[#9CA3AF] bg-white dark:bg-[#1F2937]">
            {placeholder}
          </option>
        )}
        {options
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-white text-[#111827] dark:bg-[#1F2937] dark:text-[#F9FAFB]"
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>

      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-[#6B7280] dark:text-[#9CA3AF]">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
});
