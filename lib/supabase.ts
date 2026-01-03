import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type VideoRecord = {
  id: string;
  title?: string;
  description?: string;
  video_url: string;
  video_file_type?: string;
  video_file_size?: number;
  general_locations?: string[];
  locations?: Array<{
    id: string;
    name: string;
    location_name: string;
    coordinates: { lat: number; lng: number };
    time_start_sec: number;
    time_end_sec: number | null;
    place_id?: string;
    mention?: string;
    context?: string;
  }>;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  video_filename?: string;
  transcript?: string;
  processing_status?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
};

// Convert signed URL to public URL (same logic as mobile app)
function convertToPublicUrl(signedUrl: string): string {
  try {
    const url = new URL(signedUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const userId = pathParts[pathParts.length - 2];
    const publicUrl = `https://pub-2d441c7919fd461bbca73a2b957915fa.r2.dev/${userId}/${fileName}`;
    return publicUrl;
  } catch (error) {
    console.log('Failed to convert URL, using original:', error);
    return signedUrl;
  }
}

// Fetch all public videos with locations
export async function fetchPublicVideos(): Promise<VideoRecord[]> {
  const { data: videosData, error: videosError } = await supabase
    .from('videos')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (videosError) {
    throw new Error(`Failed to fetch videos: ${videosError.message}`);
  }

  if (!videosData || videosData.length === 0) {
    return [];
  }

  const videoIds = videosData.map((v: any) => v.id);
  
  const { data: locationsData, error: locationsError } = await supabase
    .from('locations')
    .select('*')
    .in('video_id', videoIds)
    .order('time_start_sec', { ascending: true })
    .limit(1000);

  if (locationsError) {
    console.error('Failed to fetch locations:', locationsError);
  }

  const locationsByVideo: Record<string, any[]> = {};
  (locationsData || []).forEach((loc: any) => {
    if (!locationsByVideo[loc.video_id]) {
      locationsByVideo[loc.video_id] = [];
    }
    locationsByVideo[loc.video_id].push({
      id: loc.id,
      name: loc.name,
      location_name: loc.location_name,
      coordinates: typeof loc.coordinates === 'string' ? JSON.parse(loc.coordinates) : loc.coordinates,
      time_start_sec: typeof loc.time_start_sec === 'string' ? parseFloat(loc.time_start_sec) : loc.time_start_sec,
      time_end_sec: loc.time_end_sec ? (typeof loc.time_end_sec === 'string' ? parseFloat(loc.time_end_sec) : loc.time_end_sec) : null,
      place_id: loc.place_id,
      mention: loc.mention,
      context: loc.context
    });
  });

  const result = videosData.map((video: any) => ({
    ...video,
    video_url: convertToPublicUrl(video.video_url),
    locations: locationsByVideo[video.id] || []
  })) as VideoRecord[];

  return result;
}

// Location type for guide pages
export type GuideLocation = {
  id: string;
  name: string;
  location_name: string;
  coordinates: { lat: number; lng: number };
  time_start_sec: number;
  time_end_sec: number | null;
  place_id?: string;
  mention?: string;
  context?: string;
  video_id: string;
  video_url: string;
};

// Fetch all locations from all public videos for guide pages
export async function fetchAllGuideLocations(): Promise<GuideLocation[]> {
  const { data: videosData, error: videosError } = await supabase
    .from('videos')
    .select('id, video_url')
    .eq('is_public', true);

  if (videosError) {
    throw new Error(`Failed to fetch videos: ${videosError.message}`);
  }

  if (!videosData || videosData.length === 0) {
    return [];
  }

  const videoIds = videosData.map((v: any) => v.id);
  const videoUrlMap = new Map(videosData.map((v: any) => [v.id, convertToPublicUrl(v.video_url)]));
  
  const { data: locationsData, error: locationsError } = await supabase
    .from('locations')
    .select('*')
    .in('video_id', videoIds)
    .order('time_start_sec', { ascending: true })
    .limit(1000);

  if (locationsError) {
    console.error('Failed to fetch locations:', locationsError);
    return [];
  }

  const guideLocations: GuideLocation[] = (locationsData || [])
    .filter((loc: any) => loc.name && loc.coordinates) // Only include locations with name and coordinates
    .map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      location_name: loc.location_name,
      coordinates: typeof loc.coordinates === 'string' ? JSON.parse(loc.coordinates) : loc.coordinates,
      time_start_sec: typeof loc.time_start_sec === 'string' ? parseFloat(loc.time_start_sec) : loc.time_start_sec,
      time_end_sec: loc.time_end_sec ? (typeof loc.time_end_sec === 'string' ? parseFloat(loc.time_end_sec) : loc.time_end_sec) : null,
      place_id: loc.place_id,
      mention: loc.mention,
      context: loc.context,
      video_id: loc.video_id,
      video_url: videoUrlMap.get(loc.video_id) || '',
    }));

  return guideLocations;
}

// Fetch locations for a specific company (filtered by location IDs)
export async function fetchCompanyGuideLocations(companyId: string, locationIds: string[]): Promise<GuideLocation[]> {
  if (!locationIds || locationIds.length === 0) {
    return [];
  }

  // Fetch the specific locations
  const { data: locationsData, error: locationsError } = await supabase
    .from('locations')
    .select('*')
    .in('id', locationIds)
    .order('time_start_sec', { ascending: true });

  if (locationsError) {
    console.error('Failed to fetch company locations:', locationsError);
    return [];
  }

  if (!locationsData || locationsData.length === 0) {
    return [];
  }

  // Get unique video IDs from the locations
  const videoIds = [...new Set(locationsData.map((loc: any) => loc.video_id))];
  
  // Fetch video URLs
  const { data: videosData, error: videosError } = await supabase
    .from('videos')
    .select('id, video_url')
    .in('id', videoIds);

  if (videosError) {
    console.error('Failed to fetch videos:', videosError);
    return [];
  }

  const videoUrlMap = new Map((videosData || []).map((v: any) => [v.id, convertToPublicUrl(v.video_url)]));

  const guideLocations: GuideLocation[] = locationsData
    .filter((loc: any) => loc.name && loc.coordinates) // Only include locations with name and coordinates
    .map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      location_name: loc.location_name,
      coordinates: typeof loc.coordinates === 'string' ? JSON.parse(loc.coordinates) : loc.coordinates,
      time_start_sec: typeof loc.time_start_sec === 'string' ? parseFloat(loc.time_start_sec) : loc.time_start_sec,
      time_end_sec: loc.time_end_sec ? (typeof loc.time_end_sec === 'string' ? parseFloat(loc.time_end_sec) : loc.time_end_sec) : null,
      place_id: loc.place_id,
      mention: loc.mention,
      context: loc.context,
      video_id: loc.video_id,
      video_url: videoUrlMap.get(loc.video_id) || '',
    }));

  return guideLocations;
}

// Type for location with all videos that contain it
export type LocationWithVideos = {
  id: string;
  name: string;
  location_name: string;
  coordinates: { lat: number; lng: number };
  videoSegments: Array<{
    video_id: string;
    video_url: string;
    time_start_sec: number;
    time_end_sec: number | null;
    location_id: string;
  }>;
};

// Fetch all unique locations from Philadelphia, PA videos
export async function fetchPhiladelphiaLocations(): Promise<LocationWithVideos[]> {
  // First, get all videos with "Philadelphia, PA" in general_locations
  const { data: videosData, error: videosError } = await supabase
    .from('videos')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (videosError) {
    throw new Error(`Failed to fetch videos: ${videosError.message}`);
  }

  if (!videosData || videosData.length === 0) {
    return [];
  }

  // Filter videos that contain "Philadelphia, PA" in general_locations
  const phillyVideos = videosData.filter((video: any) => {
    let generalLocations: string[] = [];
    if (typeof video.general_locations === 'string') {
      try {
        generalLocations = JSON.parse(video.general_locations);
      } catch {
        generalLocations = [];
      }
    } else if (Array.isArray(video.general_locations)) {
      generalLocations = video.general_locations;
    }
    return generalLocations.some((loc: string) => 
      loc.toLowerCase().includes('philadelphia') || loc.toLowerCase().includes('philly')
    );
  });

  if (phillyVideos.length === 0) {
    return [];
  }

  const phillyVideoIds = phillyVideos.map((v: any) => v.id);
  const videoUrlMap = new Map(phillyVideos.map((v: any) => [v.id, convertToPublicUrl(v.video_url)]));

  // Get all locations from these videos
  const { data: locationsData, error: locationsError } = await supabase
    .from('locations')
    .select('*')
    .in('video_id', phillyVideoIds)
    .order('time_start_sec', { ascending: true });

  if (locationsError) {
    console.error('Failed to fetch locations:', locationsError);
    return [];
  }

  if (!locationsData || locationsData.length === 0) {
    return [];
  }

  // Group locations by name and coordinates (same location can appear in multiple videos)
  const locationMap = new Map<string, LocationWithVideos>();

  locationsData.forEach((loc: any) => {
    const coordinates = typeof loc.coordinates === 'string' 
      ? JSON.parse(loc.coordinates) 
      : loc.coordinates;
    
    // Create a unique key based on location name and coordinates (rounded to avoid duplicates)
    const lat = Math.round(coordinates.lat * 1000) / 1000;
    const lng = Math.round(coordinates.lng * 1000) / 1000;
    const key = `${loc.name}_${lat}_${lng}`;

    if (!locationMap.has(key)) {
      locationMap.set(key, {
        id: loc.id,
        name: loc.name,
        location_name: loc.location_name,
        coordinates: { lat: coordinates.lat, lng: coordinates.lng },
        videoSegments: [],
      });
    }

    const location = locationMap.get(key)!;
    location.videoSegments.push({
      video_id: loc.video_id,
      video_url: videoUrlMap.get(loc.video_id) || '',
      time_start_sec: typeof loc.time_start_sec === 'string' 
        ? parseFloat(loc.time_start_sec) 
        : loc.time_start_sec,
      time_end_sec: loc.time_end_sec 
        ? (typeof loc.time_end_sec === 'string' ? parseFloat(loc.time_end_sec) : loc.time_end_sec)
        : null,
      location_id: loc.id,
    });
  });

  return Array.from(locationMap.values());
}
