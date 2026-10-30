import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'interactive';
}

export function Card({ children, className = '', variant = 'default', ...props }: CardProps) {
  const variantStyles = {
    default:
      'bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-[0_1px_3px_rgba(32,37,34,0.04)]',
    subtle:
      'bg-[#FAF8F5] dark:bg-[#141C18] border border-[#EAE5D9] dark:border-[#212C26]',
    interactive:
      'bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] hover:border-[#173D32] dark:hover:border-[#4F9B8B] transition-colors shadow-[0_1px_3px_rgba(32,37,34,0.04)] hover:shadow-sm cursor-pointer',
  };

  return (
    <div
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
      className={`text-lg font-heading font-semibold tracking-tight text-[#202522] dark:text-[#F5F2EA] ${className}`.trim()}
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
    <p className={`text-sm text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed ${className}`.trim()} {...props}>
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
      className={`flex items-center pt-4 mt-4 border-t border-[#EAE5D9] dark:border-[#283931] ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
