import { useContext } from 'react';
import {
  ThemeContext,
  type ThemeContextType,
  type ThemePreference,
  type ResolvedTheme,
} from './ThemeContext.js';

export type { ThemeContextType, ThemePreference, ResolvedTheme };

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

