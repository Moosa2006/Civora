import { useState, useEffect, type ReactNode } from 'react';
import { RouterContext } from './RouterContext';

export interface RouterProps {
  children: ReactNode;
}

export function Router({ children }: RouterProps) {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (window.location.pathname + window.location.search) || '/';
    }
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath((window.location.pathname + window.location.search) || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Reusable global scroll restoration across all routes & layouts
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Respect in-page hash anchor navigation (e.g., #main-content, #about)
    if (window.location.hash) {
      const hashTarget = window.location.hash;
      const scrollToHash = () => {
        const element = document.querySelector(hashTarget);
        if (element) {
          const prefersReduced =
            document.documentElement.dataset.reducedMotion === 'true' ||
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
          element.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
          return true;
        }
        return false;
      };

      if (scrollToHash()) return;
      const timer = window.setTimeout(scrollToHash, 80);
      return () => window.clearTimeout(timer);
    }

    // Default: Reset window and document scroll to top on navigation
    window.scrollTo(0, 0);
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, [currentPath]);

  const navigate = (to: string) => {
    const hashIndex = to.indexOf('#');
    const pathWithoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) || '/' : to;
    const hashPart = hashIndex >= 0 ? to.slice(hashIndex) : '';

    if (pathWithoutHash !== currentPath) {
      window.history.pushState({}, '', to);
      setCurrentPath(pathWithoutHash);
    } else if (hashPart) {
      window.history.pushState({}, '', to);
      const element = document.querySelector(hashPart);
      if (element) {
        const prefersReduced =
          document.documentElement.dataset.reducedMotion === 'true' ||
          window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        element.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
      }
    } else {
      // Re-navigating to current path resets scroll unless an anchor is present
      if (!window.location.hash) {
        window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
    }
  };

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}
