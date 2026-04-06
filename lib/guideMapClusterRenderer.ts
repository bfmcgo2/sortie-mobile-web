import {
  MarkerUtils,
  type Cluster,
  type ClusterStats,
  type Renderer,
} from '@googlemaps/markerclusterer';

/** Matches guide header / overlay */
const CLUSTER_BG = '#18204a';
const CLUSTER_RING = '#fdf5e2';
const CLUSTER_TEXT = '#fdf5e2';

/**
 * Custom cluster appearance for {@link MarkerClusterer}.
 * Uses AdvancedMarkerElement only when the app initialized the map with a Map ID
 * (`NEXT_PUBLIC_GOOGLE_MAP_ID`) **and** the runtime reports advanced markers available.
 * Otherwise uses legacy {@link google.maps.Marker} so Google does not warn about
 * Advanced Markers without a Map ID (can happen if `isAdvancedMarkerAvailable` is true
 * before capabilities match the actual map options).
 */
export class GuideMapClusterRenderer implements Renderer {
  constructor(private readonly mapInitializedWithId: boolean) {}

  render({ count, position }: Cluster, _stats: ClusterStats, map: google.maps.Map) {
    const title = `${count} places`;
    const zIndex = Number(google.maps.Marker.MAX_ZINDEX) + count;

    const useAdvanced =
      this.mapInitializedWithId && MarkerUtils.isAdvancedMarkerAvailable(map);

    if (useAdvanced) {
      const el = document.createElement('div');
      el.style.width = '44px';
      el.style.height = '44px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = CLUSTER_BG;
      el.style.border = `3px solid ${CLUSTER_RING}`;
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = CLUSTER_TEXT;
      el.style.fontWeight = '700';
      el.style.fontSize = count > 99 ? '12px' : count > 9 ? '14px' : '16px';
      el.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      el.textContent = String(count);

      return new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        zIndex,
        title,
        content: el,
      });
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56">
<circle cx="28" cy="28" r="22" fill="${CLUSTER_BG}" stroke="${CLUSTER_RING}" stroke-width="3"/>
<text x="28" y="28" fill="${CLUSTER_TEXT}" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="700" font-family="system-ui,sans-serif">${count}</text>
</svg>`;

    return new google.maps.Marker({
      position,
      zIndex,
      title,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        anchor: new google.maps.Point(28, 28),
        scaledSize: new google.maps.Size(56, 56),
      },
    });
  }
}
