import { useContext } from 'react';
import {
  AccessibilityContext,
  type AccessibilityContextType,
  type TextSizeOption,
  type AccessibilityPreferences,
} from './AccessibilityContext.js';

export type { TextSizeOption, AccessibilityPreferences };

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
