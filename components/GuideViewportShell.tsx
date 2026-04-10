'use client';

import type { ReactNode } from 'react';

type GuideViewportShellProps = {
  children: ReactNode;
  /** Extra classes on the inner column (e.g. font family). */
  className?: string;
};

/**
 * Black full-bleed background; inner column is phone-width so the guide matches mobile
 * while remaining usable on desktop.
 */
export default function GuideViewportShell({ children, className = '' }: GuideViewportShellProps) {
  return (
    <div className="flex min-h-[var(--vvh,100dvh)] w-full justify-center bg-black">
      <div
        className={`relative flex min-h-[var(--vvh,100dvh)] w-full max-w-[430px] flex-col overflow-hidden ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
