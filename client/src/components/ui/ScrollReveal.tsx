import type { HTMLAttributes, ReactNode } from 'react';

export type ScrollRevealElement =
  | 'div'
  | 'section'
  | 'article'
  | 'header'
  | 'footer'
  | 'aside'
  | 'span';

export interface ScrollRevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Semantic HTML tag to render (defaults to 'div') */
  as?: ScrollRevealElement;
  /** Optional delay in milliseconds before starting reveal once visible */
  delay?: number;
  /** Upward slide distance in pixels (defaults to 14px) */
  distance?: number;
  /** Transition duration in milliseconds (defaults to 580ms) */
  duration?: number;
  /** Allow revealing independently even when nested inside another reveal container */
  independent?: boolean;
  className?: string;
}

/**
 * Lightweight, zero-CLS scroll-reveal wrapper.
 * Managed centrally by the single shared IntersectionObserver in AppShell.
 */
export function ScrollReveal({
  children,
  as: Component = 'div',
  delay,
  distance,
  duration,
  independent = false,
  className = '',
  ...props
}: ScrollRevealProps) {
  return (
    <Component
      data-scroll-reveal="true"
      data-scroll-reveal-independent={independent ? 'true' : undefined}
      data-reveal-delay={delay !== undefined ? String(delay) : undefined}
      data-reveal-distance={distance !== undefined ? String(distance) : undefined}
      data-reveal-duration={duration !== undefined ? String(duration) : undefined}
      className={className || undefined}
      {...props}
    >
      {children}
    </Component>
  );
}

