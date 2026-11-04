import type { ReactNode } from 'react';

export interface PageHeadingProps {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeading({
  title,
  description,
  eyebrow,
  badge,
  actions,
  className = '',
}: PageHeadingProps) {
  return (
    <div
      data-scroll-reveal="true"
      data-reveal-distance="10"
      className={`
        flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 mb-8
        border-b border-[#E5E7EB] dark:border-[#374151]
        ${className}
      `.trim()}
    >
      <div className="space-y-1.5 min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB] font-sans leading-tight">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-base sm:text-lg text-[#4B5563] dark:text-[#D1D5DB] max-w-3xl leading-relaxed mt-1">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}
