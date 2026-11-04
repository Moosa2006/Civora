import type { HTMLAttributes, ReactNode } from 'react';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-7xl',
  full: 'max-w-full',
};

export function Container({
  children,
  size = 'lg',
  className = '',
  ...props
}: ContainerProps) {
  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${sizeStyles[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
