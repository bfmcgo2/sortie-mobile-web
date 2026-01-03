'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { GuideLocation } from '@/lib/supabase';

interface CompanyData {
  id: string;
  name: string;
  logo: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface GuideMapProps {
  locations: GuideLocation[];
  isActive: boolean;
  onLocationClick?: (location: GuideLocation) => void;
  company?: CompanyData | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 35.0458, // Chattanooga default (based on the data)
  lng: -85.3094,
};

const defaultZoom = 10;

// Define libraries as a constant to avoid the warning
const LIBRARIES: ("marker")[] = ['marker'];

export default function GuideMap({ locations, isActive, onLocationClick, company }: GuideMapProps) {
  console.log('🗺️ GuideMap rendered with locations:', locations?.length, 'isActive:', isActive);
  console.log('🗺️ GuideMap locations type:', typeof locations, 'isArray?', Array.isArray(locations), 'constructor:', locations?.constructor?.name);
  if (locations && locations.length > 0) {
    console.log('🗺️ First location:', locations[0]);
    console.log('🗺️ First location type:', typeof locations[0]);
  }
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const regularMarkersRef = useRef<google.maps.Marker[]>([]);
  const companyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [useAdvancedMarkers, setUseAdvancedMarkers] = useState(true);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script-guide',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (loadError) {
      const errorMsg = `Failed to load Google Maps: ${loadError.message || 'Unknown error'}`;
      console.error('🗺️ GuideMap load error:', loadError);
      setError(errorMsg);
    } else {
      setError(null);
    }
  }, [loadError]);

  // Calculate map bounds to fit all locations and company pin
  const mapOptions = useMemo(() => {
    console.log('🗺️ mapOptions useMemo called, locations:', locations);
    console.log('🗺️ mapOptions - locations type:', typeof locations, 'isArray?', Array.isArray(locations));
    
    const allLatitudes: number[] = [];
    const allLongitudes: number[] = [];

    // Add company coordinates if available
    if (company?.coordinates) {
      allLatitudes.push(company.coordinates!.lat);
      allLongitudes.push(company.coordinates!.lng);
    }

    // Add location coordinates
    try {
      console.log('🗺️ About to call locations.forEach, locations:', locations);
      locations.forEach((loc, index) => {
        console.log(`🗺️ Processing location ${index}:`, loc);
        console.log(`🗺️ Location ${index} coordinates:`, loc.coordinates);
        allLatitudes.push(loc.coordinates.lat);
        allLongitudes.push(loc.coordinates.lng);
      });
    } catch (error) {
      console.error('❌ Error in locations.forEach:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }

    if (allLatitudes.length === 0) {
      return {
        center: defaultCenter,
        zoom: defaultZoom,
      };
    }
    
    const minLat = Math.min(...allLatitudes);
    const maxLat = Math.max(...allLatitudes);
    const minLng = Math.min(...allLongitudes);
    const maxLng = Math.max(...allLongitudes);
    
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
  }, [locations, company]);

  // Create and update markers
  useEffect(() => {
    console.log('🗺️ Marker creation useEffect triggered');
    console.log('🗺️ Marker useEffect - isLoaded:', isLoaded, 'mapRef.current:', !!mapRef.current, 'mapReady:', mapReady, 'isActive:', isActive);
    
    if (!isLoaded || !mapRef.current || !mapReady || !isActive) {
      console.log('🗺️ Marker useEffect - early return');
      return;
    }

    if (locations.length === 0) {
      console.log('🗺️ Marker useEffect - no locations, clearing markers');
      markersRef.current.forEach(marker => marker.map = null);
      markersRef.current = [];
      regularMarkersRef.current.forEach(marker => marker.setMap(null));
      regularMarkersRef.current = [];
      return;
    }

    console.log('🗺️ Marker useEffect - creating markers for', locations.length, 'locations');
    
    const map = mapRef.current;
    if (!map) {
      console.log('🗺️ Marker useEffect - map not available, returning');
      return;
    }
    
    console.log('🗺️ Marker useEffect - map:', map, 'type:', typeof map);
    
    try {
      // Check for mapId - only use env var to avoid calling getMapId which causes context issues
      // The getMapId() method has context issues when called, so we'll just rely on the env var
      const hasMapId = !!mapId;
      console.log('🗺️ Marker useEffect - hasMapId:', hasMapId);
      const hasAdvancedMarkerSupport = window.google?.maps?.marker?.AdvancedMarkerElement && hasMapId;
      console.log('🗺️ Marker useEffect - hasAdvancedMarkerSupport:', hasAdvancedMarkerSupport);

      // Clear existing markers
      console.log('🗺️ Marker useEffect - clearing existing markers');
      markersRef.current.forEach(marker => marker.map = null);
      markersRef.current = [];
      regularMarkersRef.current.forEach(marker => marker.setMap(null));
      regularMarkersRef.current = [];

      if (!hasAdvancedMarkerSupport) {
        console.log('🗺️ Marker useEffect - using regular markers');
        setUseAdvancedMarkers(false);
        
        locations.forEach((location, index) => {
          console.log(`🗺️ Creating regular marker ${index} for location:`, location.name);
          try {
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

          marker.addListener('click', () => {
            if (onLocationClick) {
              onLocationClick(location);
            }
          });

          regularMarkersRef.current.push(marker);
          } catch (error: any) {
            console.error(`❌ Error creating marker ${index}:`, error);
            console.error('❌ Error stack:', error?.stack);
            throw error;
          }
        });
      } else {
        console.log('🗺️ Marker useEffect - using advanced markers');
        setUseAdvancedMarkers(true);

        locations.forEach((location, index) => {
          console.log(`🗺️ Creating advanced marker ${index} for location:`, location.name);
          try {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: map,
              position: {
                lat: location.coordinates.lat,
                lng: location.coordinates.lng,
              },
              title: location.name,
            });

            marker.addListener('click', () => {
              if (onLocationClick) {
                onLocationClick(location);
              }
            });

            markersRef.current.push(marker);
          } catch (error: any) {
            console.error(`❌ Error creating advanced marker ${index}:`, error);
            console.error('❌ Error stack:', error?.stack);
            throw error;
          }
        });
      }
    } catch (error: any) {
      console.error('❌ Fatal error in marker creation useEffect:', error);
      console.error('❌ Error stack:', error?.stack);
      throw error;
    }

    // Create company pin marker if coordinates are available
    if (company?.coordinates) {
      // Check for mapId - only use env var to avoid calling getMapId which causes context issues
      const hasMapIdForCompany = !!mapId;
      const hasAdvancedMarkerSupport = window.google?.maps?.marker?.AdvancedMarkerElement && hasMapIdForCompany;

      // Clear existing company marker
      if (companyMarkerRef.current) {
        if (companyMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
          companyMarkerRef.current.map = null;
        } else {
          companyMarkerRef.current.setMap(null);
        }
        companyMarkerRef.current = null;
      }

      try {
        if (hasAdvancedMarkerSupport) {
          // Create circular logo element for AdvancedMarkerElement
          const logoElement = document.createElement('div');
          logoElement.style.width = '48px';
          logoElement.style.height = '48px';
          logoElement.style.borderRadius = '50%';
          logoElement.style.overflow = 'hidden';
          logoElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          logoElement.style.backgroundColor = '#ffffff';
          logoElement.style.display = 'flex';
          logoElement.style.alignItems = 'center';
          logoElement.style.justifyContent = 'center';
          logoElement.style.position = 'relative';
          logoElement.style.padding = '2px';

          const img = document.createElement('img');
          img.src = company.logo;
          img.alt = company.name;
          img.style.width = 'calc(100% - 4px)';
          img.style.height = 'calc(100% - 4px)';
          img.style.borderRadius = '50%';
          img.style.objectFit = 'cover';
          img.style.objectPosition = 'center';
          img.style.display = 'block';
          img.onerror = () => {
            logoElement.style.display = 'none';
          };
          logoElement.appendChild(img);

              const marker = new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: {
                  lat: company.coordinates!.lat,
                  lng: company.coordinates!.lng,
                },
                title: company.name,
            content: logoElement,
            zIndex: 1000, // Higher z-index to appear above other markers
          });

          companyMarkerRef.current = marker;
        } else {
          // Fallback for regular markers - create circular icon using canvas
          const createCircularIcon = (logoUrl: string, size: number): Promise<string> => {
            return new Promise((resolve, reject) => {
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
              }

              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              img.onload = () => {
                // Clear canvas
                ctx.clearRect(0, 0, size, size);
                
                const padding = 2;
                const innerSize = size - (padding * 2);
                const centerX = size / 2;
                const centerY = size / 2;
                
                // Draw white background circle
                ctx.beginPath();
                ctx.arc(centerX, centerY, size / 2, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                
                // Create circular clipping path for the image (with padding)
                ctx.beginPath();
                ctx.arc(centerX, centerY, innerSize / 2, 0, 2 * Math.PI);
                ctx.clip();
                
                // Calculate dimensions to fill inner circle while maintaining aspect ratio
                const imgAspect = img.width / img.height;
                let drawWidth = innerSize;
                let drawHeight = innerSize;
                let offsetX = 0;
                let offsetY = 0;
                
                if (imgAspect > 1) {
                  // Image is wider - fit to height
                  drawWidth = innerSize * imgAspect;
                  offsetX = centerX - drawWidth / 2;
                  offsetY = centerY - innerSize / 2;
                } else {
                  // Image is taller - fit to width
                  drawHeight = innerSize / imgAspect;
                  offsetX = centerX - innerSize / 2;
                  offsetY = centerY - drawHeight / 2;
                }
                
                // Draw the image
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                
                resolve(canvas.toDataURL());
              };
              
              img.onerror = () => {
                reject(new Error('Failed to load logo image'));
              };
              
              img.src = logoUrl;
            });
          };

          createCircularIcon(company.logo, 48)
            .then((dataUrl) => {
              const marker = new google.maps.Marker({
                map: map,
                position: {
                  lat: company.coordinates!.lat,
                  lng: company.coordinates!.lng,
                },
                title: company.name,
                icon: {
                  url: dataUrl,
                  scaledSize: new google.maps.Size(48, 48),
                  anchor: new google.maps.Point(24, 24),
                },
                zIndex: 1000,
              });

              companyMarkerRef.current = marker;
            })
            .catch((error) => {
              console.error('Error creating circular icon:', error);
              // Fallback to simple circular marker
              const marker = new google.maps.Marker({
                map: map,
                position: {
                  lat: company.coordinates!.lat,
                  lng: company.coordinates!.lng,
                },
                title: company.name,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: '#007AFF',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
                zIndex: 1000,
              });
              companyMarkerRef.current = marker;
            });
        }
      } catch (error: any) {
        console.error('Error creating company marker:', error);
      }
    }

    // Fit map to bounds
    const bounds = new google.maps.LatLngBounds();
    
    // Add company coordinates to bounds
    if (company?.coordinates) {
      bounds.extend({
        lat: company.coordinates!.lat,
        lng: company.coordinates!.lng,
      });
    }
    
    // Add location coordinates to bounds
    locations.forEach(loc => {
      bounds.extend({
        lat: loc.coordinates.lat,
        lng: loc.coordinates.lng,
      });
    });

    if (bounds.isEmpty() === false) {
      try {
        map.fitBounds(bounds, {
          top: 100,
          right: 50,
          bottom: 200,
          left: 50,
        });
      } catch (error: any) {
        console.error('Error fitting bounds:', error);
      }
    }

    return () => {
      markersRef.current.forEach(marker => marker.map = null);
      markersRef.current = [];
      regularMarkersRef.current.forEach(marker => marker.setMap(null));
      regularMarkersRef.current = [];
      if (companyMarkerRef.current) {
        if (companyMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
          companyMarkerRef.current.map = null;
        } else {
          companyMarkerRef.current.setMap(null);
        }
        companyMarkerRef.current = null;
      }
    };
  }, [isLoaded, mapReady, locations, isActive, onLocationClick, mapId, company]);

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    setError(null);
  };

  const onUnmount = () => {
    mapRef.current = null;
    setMapReady(false);
  };

  if (loadError) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4">
        <p className="text-red-400 font-bold mb-2">Error loading map</p>
        <p className="text-sm text-center">{loadError.message || 'Unknown error'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4">
        <p className="text-red-400 font-bold mb-2">Map Error</p>
        <p className="text-sm text-center">{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white">
        <p>Loading map...</p>
      </div>
    );
  }

  if (locations.length === 0 && !company?.coordinates) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white">
        <p>No locations available</p>
      </div>
    );
  }

  console.log('🗺️ Rendering GoogleMap with mapOptions:', mapOptions);
  
  try {
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
          mapId: mapId || undefined,
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
  } catch (error: any) {
    console.error('❌ Error rendering GoogleMap:', error);
    console.error('❌ Error stack:', error?.stack);
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white p-4">
        <p className="text-red-400 font-bold mb-2">Error rendering map</p>
        <p className="text-sm text-center">{error?.message || 'Unknown error'}</p>
      </div>
    );
  }
}

