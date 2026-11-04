import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import '../../styles/shiny-button.css';

export interface ShinyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  className?: string;
}

export const ShinyButton = forwardRef<HTMLButtonElement, ShinyButtonProps>(function ShinyButton(
  { children, onClick, className = '', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      className={`shiny-cta ${className}`.trim()}
      {...props}
    >
      <span className="shiny-cta__label">{children}</span>
    </button>
  );
});

