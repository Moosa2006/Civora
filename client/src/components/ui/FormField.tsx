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
          className="text-sm font-medium text-[#202522] dark:text-[#F5F2EA] select-none flex items-center gap-1 font-sans"
        >
          <span>{label}</span>
          {required && (
            <span className="text-[#9C3B2D] font-bold text-xs" title="Required field">
              *
            </span>
          )}
        </label>
      </div>

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-[#9C3B2D] mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-[#3E4B44] dark:text-[#C5D4C9] mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
