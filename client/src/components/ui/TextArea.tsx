import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { id, error, rows = 4, className = '', disabled, ...props },
  ref
) {
  const hasError = Boolean(error);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      disabled={disabled}
      aria-invalid={hasError ? 'true' : 'false'}
      aria-describedby={
        hasError && id ? `${id}-error` : id ? `${id}-helper` : undefined
      }
      className={`
        w-full bg-white dark:bg-[#141C18] border rounded-lg px-3.5 py-2.5 text-sm text-[#202522] dark:text-[#F5F2EA]
        placeholder-[#586860] dark:placeholder-[#94A79D] font-sans
        transition-colors duration-150 resize-y
        focus:outline-none focus:ring-2 focus:ring-[#173D32] dark:focus:ring-[#4F9B8B] focus:border-transparent
        disabled:bg-[#ECE7DB] dark:disabled:bg-[#0F1613] disabled:border-[#DED8CB] dark:disabled:border-[#283931] disabled:text-[#54625A] disabled:cursor-not-allowed
        ${hasError ? 'border-[#9C3B2D] focus:ring-[#9C3B2D]' : 'border-[#C2BAA8] dark:border-[#3D5449] hover:border-[#173D32] dark:hover:border-[#7BC4B2]'}
        ${className}
      `.trim()}
      {...props}
    />
  );
});
