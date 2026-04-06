'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

type GuideTitleH1Props = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** When set, the title is keyboard-focusable and activates like a button (e.g. recenter map). */
  onClick?: () => void;
};

/**
 * Single-line guide title: scales font size down so the full string fits
 * in the container (no ellipsis). Re-fits on resize and when text changes.
 */
export default function GuideTitleH1({
  children,
  className = '',
  style,
  onClick,
}: GuideTitleH1Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const title = titleRef.current;
    if (!container || !title) return;

    const fit = () => {
      const cw = container.clientWidth;
      if (cw <= 0) return;

      // Largest allowed size scales with container width; absolute caps for readability
      const maxFont = Math.min(40, Math.max(18, cw * 0.11));
      const minFont = 11;

      title.style.fontSize = `${maxFont}px`;
      if (title.scrollWidth <= cw) return;

      let low = minFont;
      let high = maxFont;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        title.style.fontSize = `${mid}px`;
        if (title.scrollWidth <= cw) low = mid;
        else high = mid;
      }
      title.style.fontSize = `${low}px`;
    };

    fit();

    const ro = new ResizeObserver(() => fit());
    ro.observe(container);

    const onFonts = () => fit();
    void document.fonts.ready.then(fit);

    return () => {
      ro.disconnect();
    };
  }, [children]);

  return (
    <div ref={containerRef} className="mx-auto w-[80%] min-w-0 max-w-full">
      <h1
        ref={titleRef}
        className={`text-center font-bold whitespace-nowrap ${onClick ? 'cursor-pointer select-none' : ''} ${className}`}
        style={{ ...style, fontSize: undefined }}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {children}
      </h1>
    </div>
  );
}
