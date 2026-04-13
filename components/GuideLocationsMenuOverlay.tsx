'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GuideMenuMapItem } from '@/lib/guideMenuItems';

export type { GuideMenuMapItem };

const MENU_BG = 'rgb(24, 32, 74)';
const MENU_FG = '#fdf5e2';
const OVERLAY_TRANSITION_MS = 300;
const ITEM_STAGGER_S = 0.072;

type GuideLocationsMenuOverlayProps = {
  open: boolean;
  items: GuideMenuMapItem[];
  /** Runs after overlay fade-out. Parent should set map focus and close the menu. */
  onNavigateToItem: (item: GuideMenuMapItem) => void;
  titleFontClassName?: string;
};

export default function GuideLocationsMenuOverlay({
  open,
  items,
  onNavigateToItem,
  titleFontClassName = '',
}: GuideLocationsMenuOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [opacityOn, setOpacityOn] = useState(false);
  const pendingAfterFadeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    pendingAfterFadeRef.current = null;
    setMounted(true);
    setOpacityOn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpacityOn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (open || !mounted) return;
    setOpacityOn(false);
    pendingAfterFadeRef.current = () => {
      setMounted(false);
    };
  }, [open, mounted]);

  const finishFadeOut = useCallback(() => {
    const fn = pendingAfterFadeRef.current;
    pendingAfterFadeRef.current = null;
    fn?.();
  }, []);

  const handleOverlayTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'opacity' || opacityOn) return;
      if (!pendingAfterFadeRef.current) return;
      finishFadeOut();
    },
    [opacityOn, finishFadeOut]
  );

  const startClose = useCallback((afterFade: () => void) => {
    pendingAfterFadeRef.current = afterFade;
    setOpacityOn(false);
  }, []);

  const handlePick = useCallback(
    (item: GuideMenuMapItem) => {
      startClose(() => {
        onNavigateToItem(item);
        setMounted(false);
      });
    },
    [onNavigateToItem, startClose]
  );

  useEffect(() => {
    if (opacityOn || !mounted) return;
    const t = window.setTimeout(() => {
      if (pendingAfterFadeRef.current) finishFadeOut();
    }, OVERLAY_TRANSITION_MS + 80);
    return () => window.clearTimeout(t);
  }, [opacityOn, mounted, finishFadeOut]);

  if (!mounted) return null;

  return (
    <div
      className={`absolute inset-0 z-[150] flex min-h-0 flex-col px-safe transition-opacity ease-out ${titleFontClassName}`}
      style={{
        backgroundColor: MENU_BG,
        color: MENU_FG,
        opacity: opacityOn ? 1 : 0,
        transitionDuration: `${OVERLAY_TRANSITION_MS}ms`,
        paddingTop: 'var(--guide-header-height, 4.5rem)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
      onTransitionEnd={handleOverlayTransitionEnd}
    >
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 pt-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`list-none w-full text-center ${
                item.separatorAfter
                  ? 'border-b border-[rgba(253,245,226,0.28)] pb-5'
                  : ''
              }`}
            >
              <button
                type="button"
                onClick={() => handlePick(item)}
                className={
                  opacityOn
                    ? 'guide-menu-cta w-full max-w-lg border-0 bg-transparent px-3 py-2 text-center text-xl font-semibold transition-transform active:opacity-80'
                    : 'w-full max-w-lg border-0 bg-transparent px-3 py-2 text-center text-xl font-semibold opacity-0 transition-transform active:opacity-80'
                }
                style={{
                  color: MENU_FG,
                  animationDelay: opacityOn ? `${index * ITEM_STAGGER_S}s` : '0s',
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
