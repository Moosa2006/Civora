import type { ReactNode } from 'react';
import { Card, CardContent } from './Card';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'sky';
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  badge,
  icon,
  accentColor = 'blue',
  className = '',
}: MetricCardProps) {
  // Editorial civic accents (forest green, muted teal, sage, warm amber, brick)
  const accentBorders = {
    blue: 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937]',
    emerald: 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937]',
    amber: 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937]',
    rose: 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937]',
    purple: 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937]',
    sky: 'border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937]',
  };

  const accentIcons = {
    blue: 'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/15 dark:bg-[#273548] dark:text-[#34D399] dark:border-[#374151]',
    emerald: 'bg-emerald-50 text-[#065F46] border-emerald-200 dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border-[#34D399]/30',
    amber: 'bg-amber-50 text-[#92400E] border-amber-200 dark:bg-amber-500/15 dark:text-[#FCD34D] dark:border-amber-500/30',
    rose: 'bg-red-50 text-[#991B1B] border-red-200 dark:bg-rose-500/15 dark:text-[#FCA5A5] dark:border-rose-500/30',
    purple: 'bg-[#F3F4F6] text-[#111827] border-[#E5E7EB] dark:bg-[#273548] dark:text-[#F9FAFB] dark:border-[#374151]',
    sky: 'bg-[#F0FDF4] text-[#0B6640] border-emerald-200 dark:bg-sky-500/15 dark:text-[#7DD3FC] dark:border-sky-500/30',
  };

  return (
    <Card className={`relative overflow-hidden p-5 ${accentBorders[accentColor]} ${className}`}>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <span className="text-xs sm:text-sm font-semibold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider block">
              {label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB] font-mono">
                {value}
              </span>
              {badge}
            </div>
            {subtext && <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#9CA3AF] pt-0.5">{subtext}</p>}
          </div>

          {icon && (
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${accentIcons[accentColor]}`}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
