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
          w-full bg-white dark:bg-[#141C18] border rounded-lg px-3.5 py-2 text-sm text-[#202522] dark:text-[#F5F2EA] font-sans
          transition-colors duration-150 appearance-none cursor-pointer pr-10
          focus:outline-none focus:ring-2 focus:ring-[#173D32] dark:focus:ring-[#4F9B8B] focus:border-transparent
          disabled:bg-[#ECE7DB] dark:disabled:bg-[#0F1613] disabled:border-[#DED8CB] dark:disabled:border-[#283931] disabled:text-[#54625A] disabled:cursor-not-allowed
          ${hasError ? 'border-[#9C3B2D] focus:ring-[#9C3B2D]' : 'border-[#C2BAA8] dark:border-[#3D5449] hover:border-[#173D32] dark:hover:border-[#7BC4B2]'}
          ${className}
        `.trim()}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-[#586860] dark:text-[#94A79D] bg-white dark:bg-[#141C18]">
            {placeholder}
          </option>
        )}
        {options
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-white text-[#202522] dark:bg-[#141C18] dark:text-[#F5F2EA]"
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>

      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-[#54625A] dark:text-[#94A79D]">
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
