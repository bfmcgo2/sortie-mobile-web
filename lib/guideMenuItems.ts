import type { GuideLocation, GuidePin } from '@/lib/supabase';

export type GuideMenuMapItem = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

export function locationsToMenuItems(locations: GuideLocation[]): GuideMenuMapItem[] {
  return locations.map((loc) => ({
    id: `loc-${loc.id}`,
    label: loc.name || loc.location_name || 'Location',
    lat: loc.coordinates.lat,
    lng: loc.coordinates.lng,
  }));
}

export function pinsToMenuItems(pins: GuidePin[]): GuideMenuMapItem[] {
  return pins.map((p) => ({
    id: `pin-${p.id}`,
    label: p.name,
    lat: p.coordinates.lat,
    lng: p.coordinates.lng,
  }));
}
