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

import { GuidePin } from '@/lib/supabase';

interface GuideMapProps {
  locations: GuideLocation[];
  pins?: GuidePin[]; // Non-video pins
  isActive: boolean;
  onLocationClick?: (location: GuideLocation) => void;
  onPinClick?: (pin: GuidePin) => void;
  company?: CompanyData | null;
  guide?: { company_pin_coordinates?: { lat: number; lng: number } | null; company_pin_name?: string | null } | null;
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

export default function GuideMap({ locations, pins = [], isActive, onLocationClick, onPinClick, company, guide }: GuideMapProps) {
  console.log('🗺️ GuideMap rendered with locations:', locations?.length, 'isActive:', isActive);
  console.log('🗺️ GuideMap locations type:', typeof locations, 'isArray?', Array.isArray(locations), 'constructor:', locations?.constructor?.name);
  if (locations && locations.length > 0) {
    console.log('🗺️ First location:', locations[0]);
    console.log('🗺️ First location type:', typeof locations[0]);
  }
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const regularMarkersRef = useRef<google.maps.Marker[]>([]);
  const pinMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const pinRegularMarkersRef = useRef<google.maps.Marker[]>([]);
  const companyPinMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const companyMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const userLocationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const watchPositionIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [useAdvancedMarkers, setUseAdvancedMarkers] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
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

    // Add company pin from guide if available
    if (guide?.company_pin_coordinates) {
      allLatitudes.push(guide.company_pin_coordinates.lat);
      allLongitudes.push(guide.company_pin_coordinates.lng);
    }
    
    // Add company coordinates if available and has company_id or logo (non-empty)
    if (company?.coordinates && (company?.id || (company?.logo && company.logo.trim() !== ''))) {
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
    
    // Add pin coordinates
    pins.forEach((pin) => {
      allLatitudes.push(pin.coordinates.lat);
      allLongitudes.push(pin.coordinates.lng);
    });

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
  }, [locations, pins, company, guide]);

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
      pinMarkersRef.current.forEach(marker => marker.map = null);
      pinMarkersRef.current = [];
      pinRegularMarkersRef.current.forEach(marker => marker.setMap(null));
      pinRegularMarkersRef.current = [];

      if (!hasAdvancedMarkerSupport) {
        console.log('🗺️ Marker useEffect - using regular markers');
        setUseAdvancedMarkers(false);
        
        locations.forEach((location, index) => {
          console.log(`🗺️ Creating regular marker ${index} for location:`, location.name);
          try {
          // Different styling for company pins vs video locations
          const isCompanyPin = location.isCompanyPin === true;
          const marker = new google.maps.Marker({
            map: map,
            position: {
              lat: location.coordinates.lat,
              lng: location.coordinates.lng,
            },
            title: location.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: isCompanyPin ? 10 : 8, // Slightly larger for company pins
              fillColor: isCompanyPin ? '#34C759' : '#007AFF', // Green for company pins, blue for video locations
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: isCompanyPin ? 3 : 2, // Thicker border for company pins
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
            // Different styling for company pins vs video locations
            const isCompanyPin = location.isCompanyPin === true;
            
            // Create a colored pin element for company pins
            let content: HTMLElement | undefined;
            if (isCompanyPin) {
              const pinElement = document.createElement('div');
              pinElement.style.width = '20px';
              pinElement.style.height = '20px';
              pinElement.style.borderRadius = '50%';
              pinElement.style.backgroundColor = '#34C759'; // Green for company pins
              pinElement.style.border = '3px solid white';
              pinElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
              content = pinElement;
            }
            
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: map,
              position: {
                lat: location.coordinates.lat,
                lng: location.coordinates.lng,
              },
              title: location.name,
              content: content, // Green pin for company pins, default for video locations
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
      
      // Create markers for pins (non-video locations) - Orange color
      if (pins.length > 0) {
        console.log('🗺️ Creating markers for', pins.length, 'pins');
        
        if (!hasAdvancedMarkerSupport) {
          // Regular markers for pins
          pins.forEach((pin, index) => {
            try {
              const marker = new google.maps.Marker({
                map: map,
                position: {
                  lat: pin.coordinates.lat,
                  lng: pin.coordinates.lng,
                },
                title: pin.name,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 9, // Slightly larger than video locations
                  fillColor: '#FF9500', // Orange for pins
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
              });

              marker.addListener('click', () => {
                if (onPinClick) {
                  onPinClick(pin);
                }
              });

              pinRegularMarkersRef.current.push(marker);
            } catch (error: any) {
              console.error(`❌ Error creating pin marker ${index}:`, error);
            }
          });
        } else {
          // Advanced markers for pins
          pins.forEach((pin, index) => {
            try {
              const pinElement = document.createElement('div');
              pinElement.style.width = '18px';
              pinElement.style.height = '18px';
              pinElement.style.borderRadius = '50%';
              pinElement.style.backgroundColor = '#FF9500'; // Orange for pins
              pinElement.style.border = '3px solid white';
              pinElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
              
              const marker = new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: {
                  lat: pin.coordinates.lat,
                  lng: pin.coordinates.lng,
                },
                title: pin.name,
                content: pinElement,
              });

              marker.addListener('click', () => {
                if (onPinClick) {
                  onPinClick(pin);
                }
              });

              pinMarkersRef.current.push(marker);
            } catch (error: any) {
              console.error(`❌ Error creating advanced pin marker ${index}:`, error);
            }
          });
        }
      }
      
      // Create company pin marker from guide (if present) - Green color
      if (guide?.company_pin_coordinates) {
        console.log('🗺️ Creating company pin marker from guide');
        const hasMapIdForCompanyPin = !!mapId;
        const hasAdvancedMarkerSupportForCompanyPin = window.google?.maps?.marker?.AdvancedMarkerElement && hasMapIdForCompanyPin;

        // Clear existing company pin marker
        if (companyPinMarkerRef.current) {
          if (companyPinMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
            companyPinMarkerRef.current.map = null;
          } else {
            companyPinMarkerRef.current.setMap(null);
          }
          companyPinMarkerRef.current = null;
        }

        try {
          if (hasAdvancedMarkerSupportForCompanyPin) {
            const pinElement = document.createElement('div');
            pinElement.style.width = '22px';
            pinElement.style.height = '22px';
            pinElement.style.borderRadius = '50%';
            pinElement.style.backgroundColor = '#34C759'; // Green for company pin
            pinElement.style.border = '3px solid white';
            pinElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: map,
              position: {
                lat: guide.company_pin_coordinates.lat,
                lng: guide.company_pin_coordinates.lng,
              },
              title: guide.company_pin_name || 'Company Pin',
              content: pinElement,
              zIndex: 1000,
            });

            companyPinMarkerRef.current = marker;
          } else {
            const marker = new google.maps.Marker({
              map: map,
              position: {
                lat: guide.company_pin_coordinates.lat,
                lng: guide.company_pin_coordinates.lng,
              },
              title: guide.company_pin_name || 'Company Pin',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#34C759', // Green for company pin
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              },
              zIndex: 1000,
            });

            companyPinMarkerRef.current = marker;
          }
        } catch (error: any) {
          console.error('Error creating company pin marker:', error);
        }
      }
    } catch (error: any) {
      console.error('❌ Fatal error in marker creation useEffect:', error);
      console.error('❌ Error stack:', error?.stack);
      throw error;
    }

    // Create company pin marker if coordinates are available and has company_id or logo (non-empty)
    if (company?.coordinates && (company?.id || (company?.logo && company.logo.trim() !== ''))) {
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
          // NOTE: External URLs may fail due to CORS; in that case we gracefully
          // fall back to a simple colored circle without throwing.
          const createCircularIcon = (logoUrl: string, size: number): Promise<string | null> => {
            return new Promise((resolve) => {
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                console.error('Could not get canvas context for company logo');
                resolve(null);
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
                console.error('Failed to load logo image, falling back to simple marker:', logoUrl);
                resolve(null);
              };
              
              img.src = logoUrl;
            });
          };

          createCircularIcon(company.logo, 48)
            .then((dataUrl) => {
              if (dataUrl) {
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
              } else {
                // Fallback to simple circular marker if logo couldn't be loaded (e.g., CORS)
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
              }
            });
        }
      } catch (error: any) {
        console.error('Error creating company marker:', error);
      }
    }

    // Fit map to bounds
    const bounds = new google.maps.LatLngBounds();
    
    // Add company pin from guide to bounds
    if (guide?.company_pin_coordinates) {
      bounds.extend({
        lat: guide.company_pin_coordinates.lat,
        lng: guide.company_pin_coordinates.lng,
      });
    }
    
    // Add company coordinates to bounds if has company_id or logo (non-empty)
    if (company?.coordinates && (company?.id || (company?.logo && company.logo.trim() !== ''))) {
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
    
    // Add pin coordinates to bounds
    pins.forEach(pin => {
      bounds.extend({
        lat: pin.coordinates.lat,
        lng: pin.coordinates.lng,
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
      pinMarkersRef.current.forEach(marker => marker.map = null);
      pinMarkersRef.current = [];
      pinRegularMarkersRef.current.forEach(marker => marker.setMap(null));
      pinRegularMarkersRef.current = [];
      if (companyPinMarkerRef.current) {
        if (companyPinMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
          companyPinMarkerRef.current.map = null;
        } else {
          companyPinMarkerRef.current.setMap(null);
        }
        companyPinMarkerRef.current = null;
      }
      if (companyMarkerRef.current) {
        if (companyMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
          companyMarkerRef.current.map = null;
        } else {
          companyMarkerRef.current.setMap(null);
        }
        companyMarkerRef.current = null;
      }
      // Note: userLocationMarkerRef is cleaned up in onUnmount
    };
  }, [isLoaded, mapReady, locations, pins, isActive, onLocationClick, onPinClick, mapId, company, guide]);

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    setError(null);
  };

  const onUnmount = () => {
    // Stop watching position
    if (watchPositionIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchPositionIdRef.current);
      watchPositionIdRef.current = null;
    }
    // Clean up user location marker
    if (userLocationMarkerRef.current) {
      if (userLocationMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
        userLocationMarkerRef.current.map = null;
      } else {
        userLocationMarkerRef.current.setMap(null);
      }
      userLocationMarkerRef.current = null;
    }
    mapRef.current = null;
    setMapReady(false);
  };

  // Update user location marker position
  const updateUserLocationMarker = (location: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const hasAdvancedMarkerSupport = window.google?.maps?.marker?.AdvancedMarkerElement && !!mapId;

    // If marker doesn't exist, create it
    if (!userLocationMarkerRef.current) {
      try {
        if (hasAdvancedMarkerSupport) {
          // Create a blue circle for user location
          const locationElement = document.createElement('div');
          locationElement.style.width = '20px';
          locationElement.style.height = '20px';
          locationElement.style.borderRadius = '50%';
          locationElement.style.backgroundColor = '#4285F4';
          locationElement.style.border = '3px solid white';
          locationElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

          const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: location,
            title: 'Your Location',
            content: locationElement,
            zIndex: 2000,
          });
          userLocationMarkerRef.current = marker;
        } else {
          // Fallback for regular markers
          const marker = new google.maps.Marker({
            map: map,
            position: location,
            title: 'Your Location',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
            zIndex: 2000,
          });
          userLocationMarkerRef.current = marker;
        }
      } catch (error: any) {
        console.error('Error creating user location marker:', error);
      }
    } else {
      // Update existing marker position
      try {
        if (userLocationMarkerRef.current instanceof google.maps.marker.AdvancedMarkerElement) {
          userLocationMarkerRef.current.position = location;
        } else {
          userLocationMarkerRef.current.setPosition(location);
        }
      } catch (error: any) {
        console.error('Error updating user location marker:', error);
      }
    }
  };

  // Get user's current location and watch for changes
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser.');
      alert('Geolocation is not supported by this browser.');
      return;
    }

    // Stop any existing watch
    if (watchPositionIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchPositionIdRef.current);
      watchPositionIdRef.current = null;
    }

    // Watch position for real-time updates
    watchPositionIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        console.log('📍 User location updated:', location);

        // Center map on user location (only on first update)
        if (!userLocation && mapRef.current) {
          mapRef.current.setCenter(location);
          mapRef.current.setZoom(15);
        }

        // Update user location marker
        updateUserLocationMarker(location);
      },
      (error) => {
        console.error('Error watching user location:', error);
        if (watchPositionIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchPositionIdRef.current);
          watchPositionIdRef.current = null;
        }
        alert('Unable to get your location. Please enable location services.');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0, // Always get fresh position
      }
    );
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

  if (locations.length === 0 && pins.length === 0 && !guide?.company_pin_coordinates && !(company?.coordinates && (company?.id || (company?.logo && company.logo.trim() !== '')))) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white">
        <p>No locations available</p>
      </div>
    );
  }

  console.log('🗺️ Rendering GoogleMap with mapOptions:', mapOptions);
  
  try {
    return (
      <div className="relative w-full h-full">
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
        {/* My Location Button */}
        <button
          onClick={getCurrentLocation}
          className="absolute bottom-4 left-4 z-10 bg-white hover:bg-gray-100 rounded-full p-3 shadow-lg flex items-center justify-center"
          style={{
            width: '48px',
            height: '48px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
          title="Show my location"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="#4285F4"
            width="24"
            height="24"
          >
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
          </svg>
        </button>
      </div>
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

