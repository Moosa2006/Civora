import { useEffect, useLayoutEffect, useRef } from 'react';
import { useAccessibility } from '../context/useAccessibility.js';

const AUTO_REVEAL_SELECTOR = [
  '[data-scroll-reveal="true"]',
  '#main-content [role="tablist"]',
  '#main-content section > h2',
  '#main-content section > h3',
  '#main-content section > header',
  '#main-content > div > div[class*="rounded-2xl"][class*="border"]',
  '#main-content > div > div[class*="rounded-xl"][class*="border"]',
  '#main-content .grid > div[class*="rounded-xl"]',
  '#main-content .grid > div[class*="rounded-2xl"]',
  '#main-content .grid > article',
].join(', ');

const DEFAULT_DURATION_MS = 580;
const DEFAULT_DISTANCE_PX = 14;
const STAGGER_STEP_MS = 65;
const MAX_AUTO_STAGGER_MS = 260;

function shouldSkipElement(el: HTMLElement): boolean {
  if (el.dataset.noReveal === 'true') return true;
  if (el.classList.contains('sr-only')) return true;

  // Never animate modals, map canvases, or navigation menus
  if (
    el.closest(
      '[data-no-reveal="true"], [role="dialog"], [aria-modal="true"], .leaflet-container, nav'
    )
  ) {
    return true;
  }

  if (
    (el.classList.contains('fixed') && el.classList.contains('inset-0')) ||
    el.closest('.fixed.inset-0')
  ) {
    return true;
  }

  // Never apply CSS transform to an ancestor of a Leaflet map or fixed modal overlay
  if (
    el.querySelector(
      '.leaflet-container, .fixed.inset-0, [role="dialog"], [aria-modal="true"]'
    )
  ) {
    return true;
  }

  // Avoid compounding transforms on nested reveal elements unless explicitly independent
  if (el.dataset.scrollRevealIndependent !== 'true') {
    const registeredAncestor = el.parentElement?.closest('[data-reveal-registered="true"]');
    if (registeredAncestor) {
      return true;
    }
  }

  return false;
}

function clearRevealStyles(el: HTMLElement) {
  el.style.removeProperty('--reveal-delay');
  el.style.removeProperty('--reveal-duration');
  el.style.removeProperty('--reveal-y');
}

function settleImmediately(el: HTMLElement, completedElements?: WeakSet<HTMLElement>) {
  completedElements?.add(el);
  el.dataset.revealState = 'settled';
  clearRevealStyles(el);
}

/**
 * Coordinates smooth, one-shot viewport fade-in + slide-up animations across Civora.
 * Uses a single shared IntersectionObserver + scoped MutationObserver for 60fps performance
 * and automatically respects both OS and in-app Reduced Motion preferences.
 */
export function useScrollReveal(currentPath: string) {
  const { reducedMotion, isSystemReducedMotion } = useAccessibility();
  const completedElementsRef = useRef<WeakSet<HTMLElement>>(new WeakSet());

  const prefersReduced =
    reducedMotion ||
    isSystemReducedMotion ||
    (typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches));

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const completedElements = completedElementsRef.current;

    // If reduced motion is active, ensure all elements are immediately settled with zero motion
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      const activeNodes = document.querySelectorAll<HTMLElement>('[data-reveal-state]');
      activeNodes.forEach((node) => settleImmediately(node, completedElements));
      return;
    }

    const observedInCycle = new WeakSet<HTMLElement>();
    const inFlightElements = new Set<HTMLElement>();
    const settleTimers = new Map<number, HTMLElement>();
    const rafIds = new Set<number>();

    const revealBatch = (intersectingEntries: IntersectionObserverEntry[]) => {
      if (intersectingEntries.length === 0) return;

      // Sort intersecting elements in natural visual reading order (top-to-bottom, left-to-right)
      const ordered = [...intersectingEntries].sort((a, b) => {
        const dy = a.boundingClientRect.top - b.boundingClientRect.top;
        if (Math.abs(dy) > 16) return dy;
        return a.boundingClientRect.left - b.boundingClientRect.left;
      });

      let autoStaggerIndex = 0;

      ordered.forEach((entry) => {
        const el = entry.target as HTMLElement;
        observer.unobserve(el);

        if (completedElements.has(el)) return;

        // Double-check if a modal or map mounted inside while waiting
        if (
          el.querySelector(
            '.leaflet-container, .fixed.inset-0, [role="dialog"], [aria-modal="true"]'
          )
        ) {
          settleImmediately(el, completedElements);
          return;
        }

        const explicitDelay = el.dataset.revealDelay
          ? Number.parseInt(el.dataset.revealDelay, 10)
          : null;
        const delayMs =
          explicitDelay !== null && !Number.isNaN(explicitDelay)
            ? Math.max(0, explicitDelay)
            : Math.min(autoStaggerIndex++ * STAGGER_STEP_MS, MAX_AUTO_STAGGER_MS);

        const explicitDuration = el.dataset.revealDuration
          ? Number.parseInt(el.dataset.revealDuration, 10)
          : null;
        const durationMs =
          explicitDuration !== null && !Number.isNaN(explicitDuration)
            ? explicitDuration
            : DEFAULT_DURATION_MS;

        el.style.setProperty('--reveal-delay', `${delayMs}ms`);
        el.style.setProperty('--reveal-duration', `${durationMs}ms`);
        inFlightElements.add(el);

        // Defer by a frame so elements mounted in the initial viewport smoothly transition from hidden -> visible
        const outerRaf = window.requestAnimationFrame(() => {
          rafIds.delete(outerRaf);
          const innerRaf = window.requestAnimationFrame(() => {
            rafIds.delete(innerRaf);
            inFlightElements.delete(el);
            if (!el.isConnected) return;

            completedElements.add(el);
            el.dataset.revealState = 'visible';

            const timerId = window.setTimeout(() => {
              settleTimers.delete(timerId);
              if (!el.isConnected) return;
              settleImmediately(el, completedElements);
            }, durationMs + delayMs + 80);

            settleTimers.set(timerId, el);
          });
          rafIds.add(innerRaf);
        });
        rafIds.add(outerRaf);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        revealBatch(intersecting);
      },
      {
        root: null,
        rootMargin: '0px 0px -16px 0px',
        threshold: 0.01,
      }
    );

    const registerCandidate = (el: HTMLElement) => {
      if (completedElements.has(el) || observedInCycle.has(el)) return;
      if (shouldSkipElement(el)) return;

      observedInCycle.add(el);
      el.dataset.revealRegistered = 'true';

      const rect = el.getBoundingClientRect();
      // If element is already scrolled completely above the viewport, show immediately without animating
      if (rect.bottom < 0 && window.scrollY > 0) {
        settleImmediately(el, completedElements);
        return;
      }

      const explicitDistance = el.dataset.revealDistance
        ? Number.parseInt(el.dataset.revealDistance, 10)
        : null;
      const isHeading = /^H[1-6]$/.test(el.tagName) || el.tagName === 'HEADER';
      const distancePx =
        explicitDistance !== null && !Number.isNaN(explicitDistance)
          ? explicitDistance
          : isHeading
          ? 10
          : DEFAULT_DISTANCE_PX;

      el.style.setProperty('--reveal-y', `${distancePx}px`);
      el.dataset.revealState = 'hidden';
      observer.observe(el);
    };

    const scanContainer = (root: ParentNode = document) => {
      const candidates = root.querySelectorAll<HTMLElement>(AUTO_REVEAL_SELECTOR);
      candidates.forEach((el) => registerCandidate(el));
    };

    // Initial synchronous scan before browser paint on route mount
    scanContainer(document);

    // Observe dynamically rendered content (lazy routes, API-fetched cards, tab switches)
    let pendingScanRaf: number | null = null;
    const mutationObserver = new MutationObserver((mutations) => {
      let hasAddedElement = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const elem = node as HTMLElement;
              // If a fixed modal opened inside a currently-animating parent, immediately clear parent transform
              if (
                (elem.classList.contains('fixed') && elem.classList.contains('inset-0')) ||
                elem.getAttribute('role') === 'dialog' ||
                elem.getAttribute('aria-modal') === 'true'
              ) {
                let parent = elem.parentElement;
                while (parent) {
                  if (parent.dataset.revealState && parent.dataset.revealState !== 'settled') {
                    settleImmediately(parent, completedElements);
                  }
                  parent = parent.parentElement;
                }
              }
              hasAddedElement = true;
            }
          }
        }
      }

      if (hasAddedElement && pendingScanRaf === null) {
        pendingScanRaf = window.requestAnimationFrame(() => {
          pendingScanRaf = null;
          scanContainer(document);
        });
      }
    });

    const mainEl = document.getElementById('main-content');
    const footerEl = document.querySelector('footer');
    if (mainEl) {
      mutationObserver.observe(mainEl, { childList: true, subtree: true });
    }
    if (footerEl) {
      mutationObserver.observe(footerEl, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      if (pendingScanRaf !== null) {
        window.cancelAnimationFrame(pendingScanRaf);
      }
      rafIds.forEach((id) => window.cancelAnimationFrame(id));
      inFlightElements.forEach((el) => {
        if (el.isConnected) settleImmediately(el, completedElements);
      });
      settleTimers.forEach((el, id) => {
        window.clearTimeout(id);
        if (el.isConnected) settleImmediately(el, completedElements);
      });
    };
  }, [currentPath, prefersReduced]);

  // Ensure any leftover hidden nodes are revealed if preferences flip
  useEffect(() => {
    if (prefersReduced && typeof document !== 'undefined') {
      document.querySelectorAll<HTMLElement>('[data-reveal-state]').forEach((node) => {
        settleImmediately(node, completedElementsRef.current);
      });
    }
  }, [prefersReduced]);
}
