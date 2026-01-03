'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { VideoRecord } from '@/lib/supabase';

interface VideoMapProps {
  currentVideo: VideoRecord | null;
  isActive: boolean;
  onLocationClick?: (location: { lat: number; lng: number; time_start_sec: number }) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 39.9526, // Philadelphia default
  lng: -75.1652,
};

const defaultZoom = 10;

// Define libraries as a constant to avoid the warning
const LIBRARIES: ("marker")[] = ['marker'];

export default function VideoMap({ currentVideo, isActive, onLocationClick }: VideoMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const regularMarkersRef = useRef<google.maps.Marker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [useAdvancedMarkers, setUseAdvancedMarkers] = useState(true);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || '';

  console.log('🗺️ VideoMap render:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey.length,
    currentVideo: currentVideo?.id,
    locationsCount: currentVideo?.locations?.length || 0,
    isActive,
    mapReady,
  });

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES, // Use constant to avoid reload warning
  });

  useEffect(() => {
    if (loadError) {
      const errorMsg = `Failed to load Google Maps: ${loadError.message || 'Unknown error'}`;
      console.error('🗺️ Google Maps load error:', loadError);
      setError(errorMsg);
    } else {
      setError(null);
    }
  }, [loadError]);

  useEffect(() => {
    if (isLoaded) {
      console.log('🗺️ Google Maps loaded successfully');
      console.log('🗺️ Available APIs:', {
        hasMaps: !!window.google?.maps,
        hasMarker: !!window.google?.maps?.marker,
        hasAdvancedMarker: !!window.google?.maps?.marker?.AdvancedMarkerElement,
      });
    }
  }, [isLoaded]);

  // Get locations from current video
  const locations = useMemo(() => {
    if (!currentVideo?.locations || currentVideo.locations.length === 0) {
      return [];
    }
    return currentVideo.locations;
  }, [currentVideo?.id, currentVideo?.locations]);

  // Calculate map bounds to fit all locations
  const mapOptions = useMemo(() => {
    if (locations.length === 0) {
      return {
        center: defaultCenter,
        zoom: defaultZoom,
      };
    }

    const latitudes = locations.map(loc => loc.coordinates.lat);
    const longitudes = locations.map(loc => loc.coordinates.lng);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    
    // Add padding
    const latPadding = Math.max((maxLat - minLat) * 0.3, 0.01);
    const lngPadding = Math.max((maxLng - minLng) * 0.3, 0.01);
    
    return {
      center: {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
      },
      bounds: {
        north: maxLat + latPadding,
        south: minLat - latPadding,
        east: maxLng + lngPadding,
        west: minLng - lngPadding,
      },
    };
  }, [locations]);

  // Create and update markers using AdvancedMarkerElement
  useEffect(() => {
    console.log('🗺️ Marker effect triggered:', {
      isLoaded,
      hasMapRef: !!mapRef.current,
      mapReady,
      locationsCount: locations.length,
      isActive,
    });

    if (!isLoaded) {
      console.log('🗺️ Maps not loaded yet, skipping marker creation');
      return;
    }

    if (!mapRef.current || !mapReady) {
      console.log('🗺️ Map ref not ready yet, skipping marker creation');
      return;
    }

    if (locations.length === 0) {
      console.log('🗺️ No locations to display');
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current = [];
      return;
    }

    if (!isActive) {
      console.log('🗺️ Map not active, cleaning up markers');
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current = [];
      return;
    }

    const map = mapRef.current;

    // Check if we should use AdvancedMarkerElement (requires Map ID)
    const hasMapId = !!mapId || !!map.getMapId?.();
    const hasAdvancedMarkerSupport = window.google?.maps?.marker?.AdvancedMarkerElement && hasMapId;

    console.log('🗺️ Marker support check:', {
      hasMapId,
      hasAdvancedMarkerSupport,
      mapId: mapId || 'not set',
      actualMapId: map.getMapId?.(),
    });

    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];
    regularMarkersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    regularMarkersRef.current = [];

    if (!hasAdvancedMarkerSupport) {
      console.log('🗺️ Using regular markers (no Map ID or AdvancedMarkerElement not available)');
      setUseAdvancedMarkers(false);
      
      // Use regular markers as fallback
      let successCount = 0;
      let errorCount = 0;
      locations.forEach((location, index) => {
        try {
          console.log(`🗺️ Creating regular marker ${index + 1}/${locations.length}:`, {
            name: location.name,
            lat: location.coordinates.lat,
            lng: location.coordinates.lng,
          });

          const marker = new google.maps.Marker({
            map: map,
            position: {
              lat: location.coordinates.lat,
              lng: location.coordinates.lng,
            },
            title: location.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#007AFF',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });

          // Add click listener
          marker.addListener('click', () => {
            console.log('🗺️ Marker clicked:', location.name);
            if (onLocationClick) {
              onLocationClick({
                lat: location.coordinates.lat,
                lng: location.coordinates.lng,
                time_start_sec: location.time_start_sec,
              });
            }
          });

          regularMarkersRef.current.push(marker);
          successCount++;
          console.log(`🗺️ Regular marker ${index + 1} created successfully`);
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Error creating marker for ${location.name}: ${error.message || error}`;
          console.error('🗺️', errorMsg, error);
          setError(errorMsg);
        }
      });

      console.log(`🗺️ Regular marker creation complete: ${successCount} success, ${errorCount} errors`);
    } else {
      console.log('🗺️ Using AdvancedMarkerElement');
      setUseAdvancedMarkers(true);

      // Create new markers using AdvancedMarkerElement
      let successCount = 0;
      let errorCount = 0;
      locations.forEach((location, index) => {
        try {
          console.log(`🗺️ Creating advanced marker ${index + 1}/${locations.length}:`, {
            name: location.name,
            lat: location.coordinates.lat,
            lng: location.coordinates.lng,
          });

          const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: {
              lat: location.coordinates.lat,
              lng: location.coordinates.lng,
            },
            title: location.name,
          });

          // Add click listener
          marker.addListener('click', () => {
            console.log('🗺️ Marker clicked:', location.name);
            if (onLocationClick) {
              onLocationClick({
                lat: location.coordinates.lat,
                lng: location.coordinates.lng,
                time_start_sec: location.time_start_sec,
              });
            }
          });

          markersRef.current.push(marker);
          successCount++;
          console.log(`🗺️ Advanced marker ${index + 1} created successfully`);
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Error creating marker for ${location.name}: ${error.message || error}`;
          console.error('🗺️', errorMsg, error);
          setError(errorMsg);
        }
      });

      console.log(`🗺️ Advanced marker creation complete: ${successCount} success, ${errorCount} errors`);
    }

    // Fit map to bounds
    const totalSuccess = (hasAdvancedMarkerSupport ? markersRef.current.length : regularMarkersRef.current.length);
    if (locations.length > 0 && totalSuccess > 0) {
      try {
        const bounds = new google.maps.LatLngBounds();
        locations.forEach(loc => {
          bounds.extend({
            lat: loc.coordinates.lat,
            lng: loc.coordinates.lng,
          });
        });
        
        console.log('🗺️ Fitting map to bounds');
        map.fitBounds(bounds, {
          top: 100,
          right: 50,
          bottom: 200,
          left: 50,
        });
      } catch (error: any) {
        console.error('🗺️ Error fitting bounds:', error);
        setError(`Error fitting map bounds: ${error.message || error}`);
      }
    }

    return () => {
      console.log('🗺️ Cleaning up markers');
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current = [];
      regularMarkersRef.current.forEach(marker => {
        marker.setMap(null);
      });
      regularMarkersRef.current = [];
    };
  }, [isLoaded, mapReady, locations, isActive, onLocationClick]);

  const onLoad = (map: google.maps.Map) => {
    console.log('🗺️ Map loaded successfully:', {
      center: map.getCenter()?.toJSON(),
      zoom: map.getZoom(),
    });
    mapRef.current = map;
    setMapReady(true); // Mark map as ready so marker effect can run
    setError(null);
  };

  const onUnmount = () => {
    console.log('🗺️ Map unmounting');
    mapRef.current = null;
    setMapReady(false);
  };

  if (loadError) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4">
        <p className="text-red-400 font-bold mb-2">Error loading map</p>
        <p className="text-sm text-center mb-2">{loadError.message || 'Unknown error'}</p>
        <p className="text-xs text-gray-400 text-center">
          Check your API key and ensure Maps JavaScript API is enabled in Google Cloud Console.
        </p>
        <details className="mt-4 text-xs text-left max-w-md">
          <summary className="cursor-pointer text-gray-300">Error Details</summary>
          <pre className="mt-2 text-xs overflow-auto bg-gray-900 p-2 rounded">
            {JSON.stringify(loadError, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4">
        <p className="text-red-400 font-bold mb-2">Map Error</p>
        <p className="text-sm text-center">{error}</p>
        <p className="text-xs text-gray-400 text-center mt-2">
          Check the browser console for more details.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white">
        <p>Loading map...</p>
        <p className="text-xs text-gray-400 mt-2">
          {apiKey ? `API Key: ${apiKey.substring(0, 10)}...` : 'No API key found'}
        </p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white">
        <p>No locations in this video</p>
        <p className="text-xs text-gray-400 mt-2">
          Current video: {currentVideo?.id || 'none'}
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapOptions.center}
      zoom={mapOptions.center === defaultCenter ? defaultZoom : undefined}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        mapId: mapId || undefined, // Use Map ID if provided (required for AdvancedMarkerElement)
        styles: [
          {
            featureType: 'all',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      }}
    />
  );
}

