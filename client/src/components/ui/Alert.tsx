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
      'bg-[#EDF5F7] dark:bg-[#122329] border-[#B7D8DE] dark:border-[#224550] text-[#1D515E] dark:text-[#8FD0DE]',
    icon: <InfoIcon className="w-5 h-5 text-[#2D6E62] dark:text-[#7BC4B2] shrink-0" />,
  },
  success: {
    container:
      'bg-[#EDF5F1] dark:bg-[#11241C] border-[#B6DBC7] dark:border-[#1E4936] text-[#18553F] dark:text-[#78C9A8]',
    icon: <CheckCircleIcon className="w-5 h-5 text-[#1E6B52] dark:text-[#78C7AE] shrink-0" />,
  },
  warning: {
    container:
      'bg-[#FDF6ED] dark:bg-[#281D0E] border-[#F2D7A5] dark:border-[#533916] text-[#86510B] dark:text-[#F3BA6C]',
    icon: <AlertTriangleIcon className="w-5 h-5 text-[#B26A15] dark:text-[#F3B768] shrink-0" />,
  },
  error: {
    container:
      'bg-[#FDF1EF] dark:bg-[#2A1310] border-[#EBB6AF] dark:border-[#5D221A] text-[#9A3526] dark:text-[#F39182]',
    icon: <XCircleIcon className="w-5 h-5 text-[#B94B3B] dark:text-[#F39182] shrink-0" />,
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

      <div className="flex-1 text-sm leading-relaxed font-sans">
        {title && <h4 className="font-semibold text-[#202522] dark:text-[#F5F2EA] mb-0.5 font-heading">{title}</h4>}
        <div>{children}</div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-[#54625A] hover:text-[#202522] dark:text-[#94A79D] dark:hover:text-[#F5F2EA] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Dismiss alert"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
