import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ButtonSize, ButtonVariant } from '../../types/index.js';
import { LiquidButton } from './liquid-glass-button.js';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  asChild?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    asChild = false,
    disabled = false,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <LiquidButton
      ref={ref}
      type={type}
      variant={variant}
      size={size}
      isLoading={isLoading}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      fullWidth={fullWidth}
      asChild={asChild}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </LiquidButton>
  );
});
