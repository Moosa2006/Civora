import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useRouter } from './RouterContext';

export interface NavLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
}

export function NavLink({
  to,
  children,
  className = '',
  activeClassName = '',
  onClick,
  ...props
}: NavLinkProps) {
  const { currentPath, navigate } = useRouter();
  const isActive = currentPath.split('?')[0] === to;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Respect browser conventions for opening in new tabs
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to);
      if (onClick) {
        onClick(e);
      }
    }
  };

  const combinedClasses = `${className} ${isActive ? activeClassName : ''}`.trim();

  return (
    <a
      href={to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={combinedClasses}
      {...props}
    >
      {children}
    </a>
  );
}
