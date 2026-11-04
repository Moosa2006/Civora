import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'civora-liquid-btn inline-flex items-center justify-center whitespace-nowrap font-sans font-medium focus-visible:outline-none disabled:pointer-events-none disabled:opacity-52 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'civora-liquid-btn--primary',
        primary: 'civora-liquid-btn--primary',
        secondary: 'civora-liquid-btn--secondary',
        success: 'civora-liquid-btn--success',
        destructive: 'civora-liquid-btn--danger',
        danger: 'civora-liquid-btn--danger',
        warning: 'civora-liquid-btn--warning',
        cool: 'civora-liquid-btn--primary ring-1 ring-inset ring-white/25',
        outline: 'civora-liquid-btn--outline',
        ghost: 'civora-liquid-btn--ghost',
        link: 'civora-liquid-btn--text',
        text: 'civora-liquid-btn--text',
      },
      size: {
        default: 'px-4 py-2.5 text-base rounded-lg gap-2 min-h-[42px]',
        sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5 min-h-[36px]',
        md: 'px-4 py-2.5 text-base rounded-lg gap-2 min-h-[42px]',
        lg: 'px-6 py-3 text-base sm:text-lg rounded-lg gap-2.5 min-h-[46px]',
        xl: 'px-7 py-3.5 text-lg rounded-xl gap-2.5 min-h-[50px]',
        icon: 'h-9 w-9 p-0 rounded-lg shrink-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ShadcnLiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ShadcnLiquidButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        />
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

const liquidbuttonVariants = cva(
  'civora-liquid-btn inline-flex items-center justify-center whitespace-nowrap font-sans font-medium shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-52',
  {
    variants: {
      variant: {
        default: 'civora-liquid-btn--primary',
        primary: 'civora-liquid-btn--primary',
        secondary: 'civora-liquid-btn--secondary',
        success: 'civora-liquid-btn--success',
        destructive: 'civora-liquid-btn--danger',
        danger: 'civora-liquid-btn--danger',
        warning: 'civora-liquid-btn--warning',
        outline: 'civora-liquid-btn--outline',
        ghost: 'civora-liquid-btn--ghost',
        link: 'civora-liquid-btn--text',
        text: 'civora-liquid-btn--text',
      },
      size: {
        default: 'px-4 py-2.5 text-base rounded-lg gap-2 min-h-[42px]',
        sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5 min-h-[36px]',
        md: 'px-4 py-2.5 text-base rounded-lg gap-2 min-h-[42px]',
        lg: 'px-6 py-3 text-base sm:text-lg rounded-lg gap-2.5 min-h-[46px]',
        xl: 'px-7 py-3.5 text-lg rounded-xl gap-2.5 min-h-[50px]',
        xxl: 'px-9 py-4 text-xl rounded-xl gap-3 min-h-[56px]',
        icon: 'h-9 w-9 p-0 rounded-lg shrink-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidbuttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  withGlassFilter?: boolean;
}

const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      withGlassFilter = false,
      disabled = false,
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    const rawId = React.useId();
    const filterId = `civora-glass-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const isDisabled = disabled || isLoading;
    const isTextVariant = variant === 'text' || variant === 'link';

    const mergedClasses = cn(
      liquidbuttonVariants({ variant, size }),
      fullWidth && 'w-full',
      className
    );

    if (asChild) {
      return (
        <Slot
          ref={ref}
          data-slot="button"
          aria-disabled={isDisabled ? 'true' : undefined}
          className={mergedClasses}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        data-slot="button"
        disabled={isDisabled}
        aria-busy={isLoading ? 'true' : undefined}
        className={mergedClasses}
        {...props}
      >
        {/* Specular liquid-glass inner bevel & rim highlight */}
        {!isTextVariant && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] shadow-[inset_1.5px_1.5px_0.75px_-1px_rgba(255,255,255,0.42),inset_-1.5px_-1.5px_0.75px_-1px_rgba(255,255,255,0.16)] dark:shadow-[inset_1.5px_1.5px_0.75px_-1px_rgba(255,255,255,0.28),inset_-1.5px_-1.5px_0.75px_-1px_rgba(255,255,255,0.1)] transition-opacity duration-200"
          />
        )}

        {withGlassFilter && !isTextVariant && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
              style={{ backdropFilter: `url("#${filterId}")` }}
            />
            <GlassFilter id={filterId} />
          </>
        )}

        <span className="relative z-10 inline-flex items-center justify-center gap-[inherit]">
          {isLoading && (
            <svg
              className="animate-spin -ml-0.5 mr-1 h-4 w-4 text-current"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </span>
      </button>
    );
  }
);
LiquidButton.displayName = 'LiquidButton';

export interface GlassFilterProps {
  id?: string;
}

export function GlassFilter({ id = 'container-glass' }: GlassFilterProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
    >
      <defs>
        <filter
          id={id}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves={1}
            seed={1}
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation={2} result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale={32}
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation={3} result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export type ColorVariant = 'default' | 'primary' | 'success' | 'error' | 'gold' | 'bronze';

export interface MetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ColorVariant;
}

const colorVariants: Record<
  ColorVariant,
  {
    outer: string;
    inner: string;
    button: string;
    textColor: string;
    textShadow: string;
  }
> = {
  default: {
    outer: 'bg-gradient-to-b from-[#1F2937] to-[#9CA3AF]',
    inner: 'bg-gradient-to-b from-[#FAFAFA] via-[#374151] to-[#E5E7EB]',
    button: 'bg-gradient-to-b from-[#6B7280] to-[#374151]',
    textColor: 'text-white',
    textShadow: '[text-shadow:_0_-1px_0_rgb(31_41_55_/_100%)]',
  },
  primary: {
    outer: 'bg-gradient-to-b from-[#051F17] to-[#6EE7B7]',
    inner: 'bg-gradient-to-b from-[#D1FAE5] via-[#072B20] to-[#A7F3D0]',
    button: 'bg-gradient-to-b from-[#0F5C44] to-[#0B3D2E] dark:from-[#10986E] dark:to-[#0D7A58]',
    textColor: 'text-white',
    textShadow: '[text-shadow:_0_-1px_0_rgb(5_31_23_/_100%)]',
  },
  success: {
    outer: 'bg-gradient-to-b from-[#005A43] to-[#7CCB9B]',
    inner: 'bg-gradient-to-b from-[#E5F8F0] via-[#00352F] to-[#D1F0E6]',
    button: 'bg-gradient-to-b from-[#109468] to-[#065F46]',
    textColor: 'text-[#FFF7F0]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(6_78_59_/_100%)]',
  },
  error: {
    outer: 'bg-gradient-to-b from-[#5A0000] to-[#FFAEB0]',
    inner: 'bg-gradient-to-b from-[#FFDEDE] via-[#680002] to-[#FFE9E9]',
    button: 'bg-gradient-to-b from-[#CE2626] to-[#991B1B]',
    textColor: 'text-[#FFF7F0]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(127_29_29_/_100%)]',
  },
  gold: {
    outer: 'bg-gradient-to-b from-[#917100] to-[#EAD98F]',
    inner: 'bg-gradient-to-b from-[#FFFDDD] via-[#856807] to-[#FFF1B3]',
    button: 'bg-gradient-to-b from-[#D97706] to-[#92400E]',
    textColor: 'text-[#FFFDE5]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(120_53_15_/_100%)]',
  },
  bronze: {
    outer: 'bg-gradient-to-b from-[#864813] to-[#E9B486]',
    inner: 'bg-gradient-to-b from-[#EDC5A1] via-[#5F2D01] to-[#FFDEC1]',
    button: 'bg-gradient-to-b from-[#B45309] to-[#78350F]',
    textColor: 'text-[#FFF7F0]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(124_45_18_/_100%)]',
  },
};

const metalButtonVariants = (
  variant: ColorVariant = 'default',
  isPressed: boolean,
  isHovered: boolean,
  isTouchDevice: boolean
) => {
  const colors = colorVariants[variant];
  const transitionStyle = 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)';

  return {
    wrapper: cn(
      'relative inline-flex transform-gpu rounded-lg p-[1.25px] will-change-transform',
      colors.outer
    ),
    wrapperStyle: {
      transform: isPressed ? 'translateY(1.5px) scale(0.99)' : 'translateY(0) scale(1)',
      boxShadow: isPressed
        ? '0 1px 2px rgba(0, 0, 0, 0.15)'
        : isHovered && !isTouchDevice
          ? '0 4px 12px rgba(0, 0, 0, 0.14)'
          : '0 3px 8px rgba(0, 0, 0, 0.08)',
      transition: transitionStyle,
      transformOrigin: 'center center',
    } satisfies React.CSSProperties,
    inner: cn(
      'pointer-events-none absolute inset-[1px] transform-gpu rounded-[7px] will-change-transform',
      colors.inner
    ),
    innerStyle: {
      transition: transitionStyle,
      transformOrigin: 'center center',
      filter: isHovered && !isPressed && !isTouchDevice ? 'brightness(1.05)' : 'none',
    } satisfies React.CSSProperties,
    button: cn(
      'relative z-10 m-[1px] inline-flex h-10 transform-gpu cursor-pointer items-center justify-center overflow-hidden rounded-md px-5 py-2 font-sans text-sm leading-none font-semibold will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:pointer-events-none disabled:opacity-50',
      colors.button,
      colors.textColor,
      colors.textShadow
    ),
    buttonStyle: {
      transform: isPressed ? 'scale(0.98)' : 'scale(1)',
      transition: transitionStyle,
      transformOrigin: 'center center',
      filter: isHovered && !isPressed && !isTouchDevice ? 'brightness(1.03)' : 'none',
    } satisfies React.CSSProperties,
  };
};

const ShineEffect = ({ isPressed }: { isPressed: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-300',
      isPressed ? 'opacity-20' : 'opacity-0'
    )}
  >
    <span className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-neutral-100 to-transparent" />
  </span>
);

const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  (
    {
      children,
      className,
      variant = 'default',
      type = 'button',
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onMouseEnter,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      ...props
    },
    ref
  ) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isTouchDevice] = React.useState(
      () =>
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    );

    const buttonText = children || 'Button';
    const variants = metalButtonVariants(variant, isPressed, isHovered, isTouchDevice);

    return (
      <div className={variants.wrapper} style={variants.wrapperStyle}>
        <div className={variants.inner} style={variants.innerStyle} />
        <button
          ref={ref}
          type={type}
          className={cn(variants.button, className)}
          style={variants.buttonStyle}
          {...props}
          onMouseDown={(e) => {
            setIsPressed(true);
            onMouseDown?.(e);
          }}
          onMouseUp={(e) => {
            setIsPressed(false);
            onMouseUp?.(e);
          }}
          onMouseLeave={(e) => {
            setIsPressed(false);
            setIsHovered(false);
            onMouseLeave?.(e);
          }}
          onMouseEnter={(e) => {
            if (!isTouchDevice) setIsHovered(true);
            onMouseEnter?.(e);
          }}
          onTouchStart={(e) => {
            setIsPressed(true);
            onTouchStart?.(e);
          }}
          onTouchEnd={(e) => {
            setIsPressed(false);
            onTouchEnd?.(e);
          }}
          onTouchCancel={(e) => {
            setIsPressed(false);
            onTouchCancel?.(e);
          }}
        >
          <ShineEffect isPressed={isPressed} />
          {buttonText}
          {isHovered && !isPressed && !isTouchDevice && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-t from-transparent to-white/10"
            />
          )}
        </button>
      </div>
    );
  }
);
MetalButton.displayName = 'MetalButton';

export { Button, buttonVariants, LiquidButton, liquidbuttonVariants, MetalButton };

