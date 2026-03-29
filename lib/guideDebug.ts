import type { GuideLocation } from '@/lib/supabase';

function isDebugGuideEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_DEBUG_GUIDE === '1') return true;
  try {
    return new URLSearchParams(window.location.search).get('debugGuide') === '1';
  } catch {
    return false;
  }
}

/** Verbose click / player diagnostics (enable with ?debugGuide=1 or NEXT_PUBLIC_DEBUG_GUIDE=1). */
export function debugGuideLocation(
  label: string,
  location: GuideLocation,
  extra?: Record<string, unknown>
): void {
  if (!isDebugGuideEnabled()) return;
  const urlPreview =
    location.video_url && location.video_url.length > 0
      ? `${location.video_url.slice(0, 96)}${location.video_url.length > 96 ? '…' : ''}`
      : '(empty)';
  console.groupCollapsed(`[Sortie Guide] ${label} — ${location.name} (${location.id})`);
  console.log('id', location.id);
  console.log('name', location.name);
  console.log('location_name', location.location_name);
  console.log('isCompanyPin', location.isCompanyPin);
  console.log('video_id', location.video_id);
  console.log('video_url', urlPreview);
  console.log('time_start_sec', location.time_start_sec, 'time_end_sec', location.time_end_sec);
  console.log('place_id', location.place_id);
  if (extra && Object.keys(extra).length) console.log('extra', extra);
  console.groupEnd();
}

/** Call when a pin was tapped but the app will not open the video player. */
export function warnGuideNoVideoOnClick(location: GuideLocation, reason: string): void {
  console.warn('[Sortie Guide] Pin click — video will not open:', reason, {
    id: location.id,
    name: location.name,
    isCompanyPin: location.isCompanyPin,
    video_id: location.video_id,
    hasVideoUrl: Boolean(location.video_url && String(location.video_url).trim()),
    time_start_sec: location.time_start_sec,
    time_end_sec: location.time_end_sec,
  });
  if (isDebugGuideEnabled()) {
    debugGuideLocation('no-video (detail)', location, { reason });
  }
}
