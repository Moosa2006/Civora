import type { ReactNode } from 'react';
import type { AlertVariant } from '../../types';
import { InfoIcon, CheckCircleIcon, AlertTriangleIcon, XCircleIcon, CloseIcon } from './icons';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; icon: ReactNode }> = {
  info: {
    container:
      'bg-[#F9FAFB] dark:bg-[#1F2937] border-[#E5E7EB] dark:border-[#374151] text-[#374151] dark:text-[#D1D5DB]',
    icon: <InfoIcon className="w-5 h-5 text-[#0B6640] dark:text-[#34D399] shrink-0" />,
  },
  success: {
    container:
      'bg-emerald-50/70 dark:bg-[#34D399]/10 border-emerald-200 dark:border-[#34D399]/35 text-[#065F46] dark:text-[#6EE7B7]',
    icon: <CheckCircleIcon className="w-5 h-5 text-[#0B6640] dark:text-[#34D399] shrink-0" />,
  },
  warning: {
    container:
      'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/35 text-[#92400E] dark:text-[#FCD34D]',
    icon: <AlertTriangleIcon className="w-5 h-5 text-amber-700 dark:text-[#FBBF24] shrink-0" />,
  },
  error: {
    container:
      'bg-red-50/80 dark:bg-rose-500/10 border-red-200 dark:border-rose-500/35 text-[#991B1B] dark:text-[#FCA5A5]',
    icon: <XCircleIcon className="w-5 h-5 text-[#B91C1C] dark:text-[#F87171] shrink-0" />,
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className = '',
}: AlertProps) {
  const { container, icon } = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-xs
        ${container}
        ${className}
      `.trim()}
    >
      <div className="mt-0.5">{icon}</div>

      <div className="flex-1 text-base leading-relaxed font-sans">
        {title && <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] mb-1 font-sans text-base sm:text-lg">{title}</h4>}
        <div className="text-sm sm:text-base">{children}</div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="civora-liquid-btn civora-liquid-btn--ghost p-1 rounded-md min-h-[28px] min-w-[28px]"
          aria-label="Dismiss alert"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
