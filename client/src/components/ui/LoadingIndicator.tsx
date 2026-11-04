import type { HTMLAttributes } from 'react';

export interface LoadingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const sizeStyles = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-3',
};

export function LoadingIndicator({
  size = 'md',
  label = 'Loading...',
  className = '',
  ...props
}: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`.trim()}
      {...props}
    >
      <div
        className={`
          animate-spin rounded-full border-[#0B3D2E]/20 border-t-[#0B3D2E] dark:border-[#34D399]/20 dark:border-t-[#34D399]
          ${sizeStyles[size]}
        `}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#F3F4F6] dark:bg-[#273548] ${className}`.trim()}
      aria-hidden="true"
      {...props}
    />
  );
}
