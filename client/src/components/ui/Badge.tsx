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
      'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/20 dark:bg-[#273548] dark:text-[#6EE7B7] dark:border-[#34D399]/35',
    dot: 'bg-[#0B3D2E] dark:bg-[#34D399]',
  },
  info: {
    container:
      'bg-[#F0FDF4] text-[#0B6640] border-emerald-200 dark:bg-sky-500/15 dark:text-[#7DD3FC] dark:border-sky-500/35',
    dot: 'bg-[#0B6640] dark:bg-[#38BDF8]',
  },
  success: {
    container:
      'bg-emerald-50 text-[#065F46] border-emerald-200 dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border-[#34D399]/35',
    dot: 'bg-[#065F46] dark:bg-[#34D399]',
  },
  warning: {
    container:
      'bg-amber-50 text-[#92400E] border-amber-200 dark:bg-amber-500/15 dark:text-[#FCD34D] dark:border-amber-500/35',
    dot: 'bg-[#92400E] dark:bg-[#FBBF24]',
  },
  danger: {
    container:
      'bg-red-50 text-[#991B1B] border-red-200 dark:bg-rose-500/15 dark:text-[#FCA5A5] dark:border-rose-500/35',
    dot: 'bg-[#991B1B] dark:bg-[#F87171]',
  },
  neutral: {
    container:
      'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB] dark:bg-[#273548] dark:text-[#D1D5DB] dark:border-[#4B5563]',
    dot: 'bg-[#6B7280] dark:bg-[#9CA3AF]',
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
        <svg className="w-3 h-3 text-[#185541] dark:text-[#34D399]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'danger':
      return (
        <svg className="w-3 h-3 text-[#9C3B2D] dark:text-[#FCA5A5]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-3 h-3 text-[#854F0B] dark:text-[#FCD34D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v5l3 3" />
        </svg>
      );
    case 'info':
      return (
        <svg className="w-3 h-3 text-[#1D584D] dark:text-[#7DD3FC]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
