import type { ReactNode } from 'react';

export interface PageHeadingProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeading({
  title,
  description,
  badge,
  actions,
  className = '',
}: PageHeadingProps) {
  return (
    <div
      className={`
        flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-8
        border-b border-[#DED8CB] dark:border-[#283931]
        ${className}
      `.trim()}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA]">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm md:text-base text-[#3E4B44] dark:text-[#C5D4C9] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
