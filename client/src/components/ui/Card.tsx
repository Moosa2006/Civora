import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'interactive';
}

export function Card({ children, className = '', variant = 'default', ...props }: CardProps) {
  const variantStyles = {
    default:
      'bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-2xs',
    subtle:
      'bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151]',
    interactive:
      'bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/60 dark:hover:bg-[#273548]/70 transition-colors shadow-2xs hover:shadow-sm cursor-pointer',
  };

  return (
    <div
      data-scroll-reveal="true"
      className={`rounded-xl p-6 ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
  return (
    <div className={`flex flex-col space-y-1.5 pb-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function CardTitle({ children, className = '', as: Component = 'h3', ...props }: CardTitleProps) {
  return (
    <Component
      className={`text-xl sm:text-2xl font-semibold tracking-tight text-[#111827] dark:text-[#F9FAFB] font-sans ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '', ...props }: CardDescriptionProps) {
  return (
    <p className={`text-base text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed mt-1 ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '', ...props }: CardContentProps) {
  return <div className={className} {...props}>{children}</div>;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div
      className={`flex items-center pt-4 mt-4 border-t border-[#E5E7EB] dark:border-[#374151] ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
