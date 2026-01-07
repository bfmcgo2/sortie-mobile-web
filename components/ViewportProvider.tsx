'use client';

import { useEffect } from 'react';

/**
 * ViewportProvider - Handles mobile browser UI offsets
 * Similar to how YouTube Shorts handles browser chrome
 * Uses Visual Viewport API as fallback for 100dvh
 */
export default function ViewportProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const setViewportHeight = () => {
      // Use Visual Viewport API if available (most accurate)
      // Falls back to window.innerHeight for older browsers
      const vvh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--vvh', `${vvh}px`);
    };

    // Initial set
    setViewportHeight();

    // Update on visual viewport changes (most reliable)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setViewportHeight);
      window.visualViewport.addEventListener('scroll', setViewportHeight);
    }

    // Fallback for browsers without visual viewport support
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setViewportHeight);
        window.visualViewport.removeEventListener('scroll', setViewportHeight);
      }
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  return <>{children}</>;
}

