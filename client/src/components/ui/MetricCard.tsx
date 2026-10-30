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
    blue: 'border-[#DED8CB] dark:border-[#283931] bg-white dark:bg-[#16201C]',
    emerald: 'border-[#C2BAA8] dark:border-[#2B4036] bg-white dark:bg-[#16201C]',
    amber: 'border-[#E2CFA5] dark:border-[#42341F] bg-white dark:bg-[#16201C]',
    rose: 'border-[#E8B2A9] dark:border-[#4B2520] bg-white dark:bg-[#16201C]',
    purple: 'border-[#DED8CB] dark:border-[#283931] bg-white dark:bg-[#16201C]',
    sky: 'border-[#BBD4DC] dark:border-[#223F4B] bg-white dark:bg-[#16201C]',
  };

  const accentIcons = {
    blue: 'bg-[#173D32]/10 text-[#173D32] border-[#173D32]/25 dark:bg-[#215748]/30 dark:text-[#E8F0EC] dark:border-[#4F9B8B]/30',
    emerald: 'bg-[#1E6B52]/10 text-[#185541] border-[#1E6B52]/25 dark:bg-[#1E6B52]/30 dark:text-[#78C7AE] dark:border-[#1E6B52]/30',
    amber: 'bg-[#B26A15]/10 text-[#854F0B] border-[#B26A15]/25 dark:bg-[#B26A15]/30 dark:text-[#F3B768] dark:border-[#B26A15]/30',
    rose: 'bg-[#B94B3B]/10 text-[#9C3B2D] border-[#B94B3B]/25 dark:bg-[#B94B3B]/30 dark:text-[#F39182] dark:border-[#B94B3B]/30',
    purple: 'bg-[#173D32]/10 text-[#173D32] border-[#173D32]/25 dark:bg-[#215748]/30 dark:text-[#E8F0EC] dark:border-[#4F9B8B]/30',
    sky: 'bg-[#4F9B8B]/10 text-[#1D584D] border-[#4F9B8B]/25 dark:bg-[#4F9B8B]/30 dark:text-[#7BC4B2] dark:border-[#4F9B8B]/30',
  };

  return (
    <Card className={`relative overflow-hidden ${accentBorders[accentColor]} ${className}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <span className="text-xs font-semibold text-[#3E4B44] dark:text-[#C5D4C9] uppercase tracking-wider block">
              {label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#202522] dark:text-[#F5F2EA] font-mono">
                {value}
              </span>
              {badge}
            </div>
            {subtext && <p className="text-xs text-[#54625A] dark:text-[#94A79D] pt-0.5">{subtext}</p>}
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
