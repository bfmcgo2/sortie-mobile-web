'use client';

import type { ReactNode } from 'react';

const DEFAULT_TITLE_COLOR = '#fdf5e2';

const MENU_ICON_TRANSITION_MS = 300;

type GuideHeaderBarProps = {
  children: ReactNode;
  /** Matches guide title text (default cream). */
  titleColor?: string;
  /** When true, the menu control shows a close (X) icon; crossfades with the hamburger. */
  menuOpen?: boolean;
  /** Toggle menu open/closed (same control shows hamburger or X). */
  onMenuClick?: () => void;
};

export default function GuideHeaderBar({
  children,
  titleColor = DEFAULT_TITLE_COLOR,
  menuOpen = false,
  onMenuClick,
}: GuideHeaderBarProps) {
  return (
    <div className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-1 px-safe">
      {/* Mirror horizontal inset of the menu side so the title stays visually centered */}
      <div className="shrink-0 pl-3" aria-hidden />
      <div className="flex min-w-0 justify-center">{children}</div>
      <div className="flex shrink-0 items-center justify-end pr-3">
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={onMenuClick}
          className="relative flex h-12 w-12 items-center justify-center rounded-lg active:opacity-80"
          style={{ color: titleColor }}
        >
          <span className="relative block h-8 w-8">
            <span
              className={`absolute inset-0 flex items-center justify-center transition-opacity ease-out ${
                menuOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
              style={{ transitionDuration: `${MENU_ICON_TRANSITION_MS}ms` }}
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                className="h-8 w-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </span>
            <span
              className={`absolute inset-0 flex items-center justify-center transition-opacity ease-out ${
                menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              style={{ transitionDuration: `${MENU_ICON_TRANSITION_MS}ms` }}
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                className="h-8 w-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
