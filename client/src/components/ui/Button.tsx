import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ButtonSize, ButtonVariant } from '../../types/index.js';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#173D32] hover:bg-[#112F26] active:bg-[#0C241D] text-[#F4F0E6] font-semibold border border-[#173D32] shadow-xs focus-visible:ring-[#173D32] dark:bg-[#215748] dark:hover:bg-[#2B6D5B] dark:text-[#F4F0E6] dark:border-[#215748] dark:focus-visible:ring-[#4F9B8B]',
  secondary:
    'bg-[#ECE7DB] hover:bg-[#E2DDD0] active:bg-[#D5CFC0] text-[#202522] font-semibold border border-[#C2BAA8] shadow-xs focus-visible:ring-[#173D32] dark:bg-[#1C2823] dark:hover:bg-[#24352E] dark:text-[#F5F2EA] dark:border-[#3D5449] dark:focus-visible:ring-[#4F9B8B]',
  outline:
    'bg-transparent hover:bg-[#173D32]/10 active:bg-[#173D32]/20 text-[#173D32] font-semibold border-2 border-[#173D32] focus-visible:ring-[#173D32] dark:text-[#F5F2EA] dark:border-[#7BC4B2] dark:hover:border-[#7BC4B2] dark:hover:bg-[#1C2823] dark:focus-visible:ring-[#4F9B8B]',
  ghost:
    'bg-transparent hover:bg-[#ECE7DB]/70 active:bg-[#ECE7DB] text-[#202522] font-medium hover:text-[#173D32] border border-transparent focus-visible:ring-[#173D32] dark:text-[#E8F0EC] dark:hover:text-[#FFFFFF] dark:hover:bg-[#1C2823] dark:focus-visible:ring-[#4F9B8B]',
  danger:
    'bg-[#9C3B2D] hover:bg-[#832E22] active:bg-[#6D251A] text-white font-semibold border border-[#9C3B2D] shadow-xs focus-visible:ring-[#9C3B2D] dark:bg-[#C85242] dark:hover:bg-[#D46353] dark:focus-visible:ring-[#D46353]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-md gap-1.5 min-h-[36px]',
  md: 'px-4 py-2 text-sm font-medium rounded-lg gap-2 min-h-[40px]',
  lg: 'px-5 py-2.5 text-base font-semibold rounded-lg gap-2.5 min-h-[44px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled = false,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading ? 'true' : undefined}
      className={`
        inline-flex items-center justify-center transition-colors duration-150 cursor-pointer
        select-none font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-offset-[#F4F0E6] dark:focus-visible:ring-offset-[#0F1613] disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `.trim()}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
});
