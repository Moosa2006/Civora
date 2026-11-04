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
      data-scroll-reveal="true"
      data-reveal-distance="12"
      className={`
        flex flex-col items-center justify-center text-center p-8 md:p-12
        rounded-xl border border-dashed border-[#D1D5DB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230]
        ${className}
      `.trim()}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1F2937] text-[#4B5563] dark:text-[#34D399] flex items-center justify-center mb-4 border border-[#E5E7EB] dark:border-[#374151] shadow-2xs">
          {icon}
        </div>
      )}

      <h3 className="text-lg sm:text-xl font-semibold text-[#111827] dark:text-[#F9FAFB] mb-2 font-sans">{title}</h3>
      <p className="text-base text-[#6B7280] dark:text-[#D1D5DB] max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
