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
          animate-spin rounded-full border-[#173D32]/20 border-t-[#173D32] dark:border-[#4F9B8B]/20 dark:border-t-[#4F9B8B]
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
      className={`animate-pulse rounded-md bg-[#ECE7DB] dark:bg-[#1C2823] ${className}`.trim()}
      aria-hidden="true"
      {...props}
    />
  );
}
