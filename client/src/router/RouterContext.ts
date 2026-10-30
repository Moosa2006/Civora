import { createContext, useContext } from 'react';

export interface RouterContextType {
  currentPath: string;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterContextType | null>(null);

export function useRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a <Router> provider');
  }
  return context;
}
