import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { id, error, leftIcon, rightIcon, className = '', disabled, ...props },
  ref
) {
  const hasError = Boolean(error);

  return (
    <div className="relative flex items-center w-full">
      {leftIcon && (
        <div className="absolute left-3 flex items-center pointer-events-none text-[#6B7280] dark:text-[#9CA3AF]">
          {leftIcon}
        </div>
      )}

      <input
        ref={ref}
        id={id}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={
          hasError && id ? `${id}-error` : id ? `${id}-helper` : undefined
        }
        className={`
          w-full min-h-[44px] bg-white dark:bg-[#1F2937] border rounded-lg px-4 py-2.5 text-base text-[#111827] dark:text-[#F9FAFB]
          placeholder-[#9CA3AF] dark:placeholder-[#9CA3AF] font-sans
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-[#0B3D2E]/20 dark:focus:ring-[#34D399]/30 focus:border-[#0B3D2E] dark:focus:border-[#34D399]
          disabled:bg-[#F9FAFB] dark:disabled:bg-[#182230] disabled:border-[#E5E7EB] dark:disabled:border-[#374151] disabled:text-[#6B7280] dark:disabled:text-[#9CA3AF] disabled:cursor-not-allowed
          ${hasError ? 'border-[#B91C1C] dark:border-[#F87171] focus:ring-[#B91C1C]/20 dark:focus:ring-[#F87171]/30 focus:border-[#B91C1C] dark:focus:border-[#F87171]' : 'border-[#D1D5DB] dark:border-[#4B5563] hover:border-[#9CA3AF] dark:hover:border-[#6EE7B7]'}
          ${leftIcon ? 'pl-11' : ''}
          ${rightIcon ? 'pr-11' : ''}
          ${className}
        `.trim()}
        {...props}
      />

      {rightIcon && (
        <div className="absolute right-3 flex items-center text-[#6B7280] dark:text-[#9CA3AF]">
          {rightIcon}
        </div>
      )}
    </div>
  );
});
