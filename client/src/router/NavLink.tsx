import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useRouter } from './RouterContext';

export interface NavLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
}

function checkNavActive(currentPath: string, to: string, exact = false): boolean {
  if (!to || to.startsWith('#') || to.includes('#')) {
    return false;
  }

  const [currBaseRaw, currQuery = ''] = currentPath.split('?');
  const [toBaseRaw, toQuery] = to.split('?');

  const currBase = (currBaseRaw || '/').replace(/\/+$/, '') || '/';
  const toBase = (toBaseRaw || '/').replace(/\/+$/, '') || '/';

  // Root home route matches '/' or '/dashboard' only
  if (toBase === '/') {
    return (currBase === '/' || currBase === '/dashboard') && !currQuery;
  }

  // If link specifies query parameters (e.g. '/contractor?tab=bids'), match exact path + query
  if (toQuery !== undefined) {
    return currBase === toBase && currQuery === toQuery;
  }

  // Exact base match: if on '/contractor?tab=bids', plain '/contractor' should not also highlight
  if (currBase === toBase) {
    if (currQuery && currQuery.includes('tab=')) {
      return false;
    }
    return true;
  }

  if (exact) {
    return false;
  }

  // Sub-route prefix match (e.g. '/tenders/123' highlights '/tenders', '/engagement/polls/1' highlights '/engagement')
  return currBase.startsWith(`${toBase}/`);
}

export function NavLink({
  to,
  children,
  className = '',
  activeClassName = '',
  exact = false,
  onClick,
  ...props
}: NavLinkProps) {
  const { currentPath, navigate } = useRouter();
  const isActive = checkNavActive(currentPath, to, exact);

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
