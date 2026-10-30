import type { HTMLAttributes, ReactNode } from 'react';
import type { BadgeVariant } from '../../types/index.js';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  hasDot?: boolean;
  withIcon?: boolean;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  default: {
    container:
      'bg-[#173D32]/10 text-[#173D32] border-[#173D32]/30 dark:bg-[#215748]/40 dark:text-[#E8F0EC] dark:border-[#4F9B8B]/40',
    dot: 'bg-[#173D32] dark:bg-[#E8F0EC]',
  },
  info: {
    container:
      'bg-[#4F9B8B]/15 text-[#1D584D] border-[#4F9B8B]/35 dark:bg-[#1D3E37] dark:text-[#7BC4B2] dark:border-[#4F9B8B]/50',
    dot: 'bg-[#1D584D] dark:bg-[#7BC4B2]',
  },
  success: {
    container:
      'bg-[#1E6B52]/15 text-[#185541] border-[#1E6B52]/35 dark:bg-[#183B2E] dark:text-[#78C7AE] dark:border-[#1E6B52]/50',
    dot: 'bg-[#185541] dark:bg-[#78C7AE]',
  },
  warning: {
    container:
      'bg-[#B26A15]/15 text-[#854F0B] border-[#B26A15]/35 dark:bg-[#3D280B] dark:text-[#F3B768] dark:border-[#B26A15]/50',
    dot: 'bg-[#854F0B] dark:bg-[#F3B768]',
  },
  danger: {
    container:
      'bg-[#B94B3B]/15 text-[#9C3B2D] border-[#B94B3B]/35 dark:bg-[#401C18] dark:text-[#F39182] dark:border-[#B94B3B]/50',
    dot: 'bg-[#9C3B2D] dark:bg-[#F39182]',
  },
  neutral: {
    container:
      'bg-[#ECE7DB] text-[#202522] border-[#C2BAA8] dark:bg-[#1C2823] dark:text-[#E8F0EC] dark:border-[#3D5449]',
    dot: 'bg-[#54625A] dark:bg-[#94A79D]',
  },
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs font-medium',
  md: 'px-2.5 py-1 text-xs font-semibold',
};

function renderVariantIcon(variant: BadgeVariant) {
  switch (variant) {
    case 'success':
      return (
        <svg className="w-3 h-3 text-[#185541] dark:text-[#78C7AE]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'danger':
      return (
        <svg className="w-3 h-3 text-[#9C3B2D] dark:text-[#F39182]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-3 h-3 text-[#854F0B] dark:text-[#F3B768]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v5l3 3" />
        </svg>
      );
    case 'info':
      return (
        <svg className="w-3 h-3 text-[#1D584D] dark:text-[#7BC4B2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8h.01M12 12v4" />
        </svg>
      );
    default:
      return null;
  }
}

export function Badge({
  variant = 'default',
  size = 'md',
  hasDot = false,
  withIcon = false,
  children,
  className = '',
  ...props
}: BadgeProps) {
  const styles = variantStyles[variant];
  const icon = withIcon ? renderVariantIcon(variant) : null;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border select-none
        ${styles.container}
        ${sizeStyles[size]}
        ${className}
      `.trim()}
      {...props}
    >
      {icon ? (
        icon
      ) : hasDot ? (
        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </span>
  );
}
