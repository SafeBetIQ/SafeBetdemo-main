'use client';

import { useEffect, useCallback, ReactNode } from 'react';

interface AccessibleGameWrapperProps {
  children: ReactNode;
  onKeyboardNavigation?: (key: string) => void;
  announceMessage?: (message: string) => void;
  focusableElements?: string[];
}

export default function AccessibleGameWrapper({
  children,
  onKeyboardNavigation,
  announceMessage,
  focusableElements = ['button', 'a', '[role="button"]'],
}: AccessibleGameWrapperProps) {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (typeof window === 'undefined') return;

    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);

    if (announceMessage) {
      announceMessage(message);
    }
  }, [announceMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (onKeyboardNavigation) {
        onKeyboardNavigation(e.key);
      }

      switch (e.key) {
        case 'Tab':
          break;

        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          const focusedElement = document.activeElement as HTMLElement;
          if (focusedElement && focusedElement.getAttribute('role') === 'button') {
            e.preventDefault();

            let nextElement: HTMLElement | null = null;
            const selector = focusableElements.join(', ');
            const allFocusable = Array.from(
              document.querySelectorAll(selector)
            ) as HTMLElement[];
            const currentIndex = allFocusable.indexOf(focusedElement);

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              nextElement = allFocusable[currentIndex + 1] || allFocusable[0];
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              nextElement = allFocusable[currentIndex - 1] || allFocusable[allFocusable.length - 1];
            }

            if (nextElement) {
              nextElement.focus();
              const label = nextElement.getAttribute('aria-label') || nextElement.textContent || '';
              announce(`Focused on ${label}`);
            }
          }
          break;

        case 'Enter':
        case ' ':
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement && activeElement.getAttribute('role') === 'button') {
            e.preventDefault();
            activeElement.click();
          }
          break;

        case 'Escape':
          announce('Press Escape to exit or Tab to navigate', 'polite');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onKeyboardNavigation, focusableElements, announce]);

  useEffect(() => {
    announce('Wellbeing game loaded. Use Tab to navigate, Enter or Space to select, and Arrow keys to move between options.', 'polite');
  }, [announce]);

  return <>{children}</>;
}
