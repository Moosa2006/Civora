import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center p-8 md:p-12
        rounded-2xl border border-dashed border-[#DED8CB] dark:border-[#283931] bg-[#FAF8F5]/80 dark:bg-[#141C18]/60
        ${className}
      `.trim()}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-[#ECE7DB] dark:bg-[#1C2823] text-[#4A5750] dark:text-[#B0C0B6] flex items-center justify-center mb-4 border border-[#DED8CB] dark:border-[#283931]">
          {icon}
        </div>
      )}

      <h3 className="text-base font-heading font-semibold text-[#202522] dark:text-[#F5F2EA] mb-1.5">{title}</h3>
      <p className="text-sm text-[#4A5750] dark:text-[#B0C0B6] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
