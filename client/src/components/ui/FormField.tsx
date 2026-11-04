import type { ReactNode } from 'react';

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  helperText,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`flex flex-col space-y-1.5 ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-base font-medium text-[#111827] dark:text-[#F9FAFB] select-none flex items-center gap-1 font-sans"
        >
          <span>{label}</span>
          {required && (
            <span className="text-[#B91C1C] dark:text-[#FCA5A5] font-bold text-sm" title="Required field">
              *
            </span>
          )}
        </label>
      </div>

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-[#B91C1C] dark:text-[#FCA5A5] mt-1.5">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-sm text-[#6B7280] dark:text-[#D1D5DB] mt-1.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
