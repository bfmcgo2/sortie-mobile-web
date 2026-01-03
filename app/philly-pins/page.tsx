'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useJsApiLoader, GoogleMap } from '@react-google-maps/api';
import { fetchPhiladelphiaLocations, LocationWithVideos } from '@/lib/supabase';
import SVG2 from '@/components/svg/SVG2';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 39.9526, // Philadelphia
  lng: -75.1652,
};

const defaultZoom = 12;

const LIBRARIES: ("marker")[] = ['marker'];

type ViewState = 'map' | 'videos';

export default function PhillyPinsPage() {
  const [viewState, setViewState] = useState<ViewState>('map');
  const [locations, setLocations] = useState<LocationWithVideos[]>([]);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithVideos | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const regularMarkersRef = useRef<google.maps.Marker[]>([]);
  const tooltipRefs = useRef<Map<google.maps.marker.AdvancedMarkerElement, HTMLDivElement>>(new Map());
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const videoContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [savedMapState, setSavedMapState] = useState<{ center: { lat: number; lng: number }; zoom: number } | null>(null);
  const [hasInitialBounds, setHasInitialBounds] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || '';

  // Check if user is on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load Philadelphia locations (only on mobile)
  useEffect(() => {
    if (!isMobile) {
      setLoading(false);
      return;
    }
    
    async function loadLocations() {
      try {
        setLoading(true);
        const phillyLocations = await fetchPhiladelphiaLocations();
        setLocations(phillyLocations);
        console.log('Loaded Philadelphia locations:', phillyLocations.length);
      } catch (error) {
        console.error('Failed to load locations:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLocations();
  }, [isMobile]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  // Keep splash/loading screen up a bit longer after map & locations are ready
  useEffect(() => {
    if (!loading && isLoaded && mapReady && !splashDone) {
      const timer = setTimeout(() => {
        setSplashDone(true);
      }, 1500); // extra 1.5s to ensure map is fully mounted
      return () => clearTimeout(timer);
    }
  }, [loading, isLoaded, mapReady, splashDone]);

  // Create markers on map (only when in map view and on mobile)
  useEffect(() => {
    if (!isMobile) {
      return; // Don't create markers on desktop
    }
    
    console.log('📍 Marker creation effect triggered:', {
      viewState,
      isLoaded,
      hasMapRef: !!mapRef.current,
      locationsCount: locations.length,
      mapReady,
    });

    if (viewState !== 'map') {
      console.log('📍 Skipping marker creation - not in map view');
      return; // Only create markers when in map view
    }

    if (!isLoaded) {
      console.log('📍 Skipping marker creation - maps not loaded');
      return;
    }

    if (!mapRef.current) {
      console.log('📍 Skipping marker creation - map ref not available');
      return;
    }

    if (locations.length === 0) {
      console.log('📍 Skipping marker creation - no locations');
      return;
    }

    if (!mapReady) {
      console.log('📍 Skipping marker creation - map not ready');
      return;
    }

    console.log('📍 Creating markers for', locations.length, 'locations');

    try {
      // Clear existing markers
      console.log('📍 Clearing existing markers:', {
        advancedMarkers: markersRef.current.length,
        regularMarkers: regularMarkersRef.current.length,
      });
      
      markersRef.current.forEach(marker => {
        try {
          marker.map = null;
          // Remove tooltip if it exists
          const tooltip = tooltipRefs.current.get(marker);
          if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
          }
          tooltipRefs.current.delete(marker);
        } catch (e) {
          console.error('Error clearing advanced marker:', e);
        }
      });
      markersRef.current = [];
      tooltipRefs.current.clear();
      
      regularMarkersRef.current.forEach(marker => {
        try {
          marker.setMap(null);
        } catch (e) {
          console.error('Error clearing regular marker:', e);
        }
      });
      regularMarkersRef.current = [];

      // Check if Advanced Markers are available and if we have a mapId
      const hasAdvancedMarker = !!window.google?.maps?.marker?.AdvancedMarkerElement;
      const map = mapRef.current;
      const getMapIdFunc = map && 'getMapId' in map ? (map as any).getMapId : undefined;
      const hasMapId = !!mapId || !!(getMapIdFunc && typeof getMapIdFunc === 'function' && getMapIdFunc());
      const useAdvanced = hasAdvancedMarker && hasMapId;

      console.log('📍 Marker type check:', {
        hasAdvancedMarker,
        hasMapId,
        mapId: mapId || 'not set',
        useAdvanced,
      });

      let createdCount = 0;
      let errorCount = 0;

      locations.forEach((location, index) => {
        try {
          const position = { lat: location.coordinates.lat, lng: location.coordinates.lng };

          if (useAdvanced && mapRef.current) {
            try {
              const marker = new google.maps.marker.AdvancedMarkerElement({
                map: mapRef.current,
                position,
                title: location.name,
              });

              // Create tooltip element that will be positioned on the map
              const tooltip = document.createElement('div');
              tooltip.textContent = location.name;
              tooltip.style.cssText = `
                position: absolute;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                pointer-events: none;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.2s;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              `;
              document.body.appendChild(tooltip);
              tooltipRefs.current.set(marker, tooltip);

              // Position and show tooltip on hover
              const updateTooltipPosition = (event?: MouseEvent) => {
                if (!mapRef.current) return;
                
                if (event) {
                  // Use mouse position for more accurate placement
                  tooltip.style.left = `${event.clientX}px`;
                  tooltip.style.top = `${event.clientY - tooltip.offsetHeight - 10}px`;
                  tooltip.style.transform = 'translateX(-50%)';
                } else {
                  // Fallback: use map projection
                  const projection = mapRef.current.getProjection();
                  if (!projection) return;
                  
                  const point = projection.fromLatLngToPoint(position);
                  const scale = Math.pow(2, mapRef.current.getZoom() || 12);
                  const pixelX = point.x * scale;
                  const pixelY = point.y * scale;
                  
                  const mapDiv = mapRef.current.getDiv();
                  const bounds = mapDiv.getBoundingClientRect();
                  
                  tooltip.style.left = `${bounds.left + pixelX}px`;
                  tooltip.style.top = `${bounds.top + pixelY - tooltip.offsetHeight - 10}px`;
                  tooltip.style.transform = 'translateX(-50%)';
                }
              };

              marker.addListener('mouseenter', (event: any) => {
                updateTooltipPosition(event?.domEvent);
                tooltip.style.opacity = '1';
              });

              marker.addListener('mouseleave', () => {
                tooltip.style.opacity = '0';
              });

              // Update tooltip position on map move/zoom if visible
              if (mapRef.current) {
                mapRef.current.addListener('bounds_changed', () => {
                  if (tooltip.style.opacity === '1') {
                    updateTooltipPosition();
                  }
                });
              }

              marker.addListener('click', () => {
                console.log('📍 Marker clicked:', location.name);
                // Save current map state before switching to video
                if (mapRef.current) {
                  const center = mapRef.current.getCenter();
                  const zoom = mapRef.current.getZoom();
                  if (center && zoom !== undefined) {
                    setSavedMapState({
                      center: { lat: center.lat(), lng: center.lng() },
                      zoom: zoom,
                    });
                  }
                }
                setSelectedLocation(location);
                setCurrentVideoIndex(0);
                setViewState('videos');
              });

              markersRef.current.push(marker);
              createdCount++;
            } catch (error) {
              console.error(`Failed to create advanced marker ${index + 1}:`, error);
              errorCount++;
              // Fallback to regular marker
              if (mapRef.current) {
                const regularMarker = new google.maps.Marker({
                  map: mapRef.current,
                  position,
                  title: location.name,
                });
                regularMarker.addListener('click', () => {
                  console.log('📍 Regular marker clicked:', location.name);
                  // Save current map state before switching to video
                  if (mapRef.current) {
                    const center = mapRef.current.getCenter();
                    const zoom = mapRef.current.getZoom();
                    if (center && zoom !== undefined) {
                      setSavedMapState({
                        center: { lat: center.lat(), lng: center.lng() },
                        zoom: zoom,
                      });
                    }
                  }
                  setSelectedLocation(location);
                  setCurrentVideoIndex(0);
                  setViewState('videos');
                });
                regularMarkersRef.current.push(regularMarker);
                createdCount++;
              }
            }
          } else if (mapRef.current) {
            // Use regular markers (fallback)
            const marker = new google.maps.Marker({
              map: mapRef.current,
              position,
              title: location.name,
            });

            marker.addListener('click', () => {
              console.log('📍 Regular marker clicked:', location.name);
              // Save current map state before switching to video
              if (mapRef.current) {
                const center = mapRef.current.getCenter();
                const zoom = mapRef.current.getZoom();
                if (center && zoom !== undefined) {
                  setSavedMapState({
                    center: { lat: center.lat(), lng: center.lng() },
                    zoom: zoom,
                  });
                }
              }
              setSelectedLocation(location);
              setCurrentVideoIndex(0);
              setViewState('videos');
            });

            regularMarkersRef.current.push(marker);
            createdCount++;
          }
        } catch (error) {
          console.error(`Error creating marker for location ${index + 1} (${location.name}):`, error);
          errorCount++;
        }
      });

      console.log('📍 Marker creation complete:', {
        total: locations.length,
        created: createdCount,
        errors: errorCount,
        advancedMarkers: markersRef.current.length,
        regularMarkers: regularMarkersRef.current.length,
      });

      // Verify markers are actually on the map
      if (regularMarkersRef.current.length > 0) {
        const firstMarker = regularMarkersRef.current[0];
        console.log('📍 Verifying first marker:', {
          hasMarker: !!firstMarker,
          markerMap: !!firstMarker.getMap(),
          markerPosition: firstMarker.getPosition()?.toJSON(),
        });
      }

      // Fit map to bounds (only on initial load, not when returning from video)
      if (locations.length > 0 && mapRef.current && !hasInitialBounds && !savedMapState) {
        try {
          const bounds = new google.maps.LatLngBounds();
          locations.forEach(loc => {
            bounds.extend(new google.maps.LatLng(loc.coordinates.lat, loc.coordinates.lng));
          });
          mapRef.current.fitBounds(bounds);
          setHasInitialBounds(true);
          console.log('📍 Map bounds fitted (initial)');
          
          // Double-check markers after fitting bounds
          setTimeout(() => {
            console.log('📍 Post-bounds check - markers on map:', {
              regularMarkers: regularMarkersRef.current.filter(m => m.getMap()).length,
              totalRegularMarkers: regularMarkersRef.current.length,
            });
          }, 500);
        } catch (error) {
          console.error('Error fitting map bounds:', error);
        }
      }
    } catch (error) {
      console.error('📍 Fatal error in marker creation:', error);
    }
  }, [isLoaded, locations, mapReady, viewState, mapId, hasInitialBounds, savedMapState, isMobile]);

  // Handle video segment playback
  useEffect(() => {
    if (viewState !== 'videos' || !selectedLocation) return;

    const segments = selectedLocation.videoSegments;
    if (segments.length === 0) return;

    const currentSegment = segments[currentVideoIndex];
    const video = videoRefs.current[currentVideoIndex];

    if (!video || !currentSegment) return;

    // Set video source and time
    video.src = currentSegment.video_url;
    video.currentTime = currentSegment.time_start_sec;

    // Play when ready
    const handleCanPlay = () => {
      video.muted = false;
      video.volume = 1.0;
      video.play().catch(console.error);
    };

    // Check if segment ended
    const handleTimeUpdate = () => {
      const endTime = currentSegment.time_end_sec || video.duration;
      if (video.currentTime >= endTime) {
        video.pause();
        // Auto-advance to next video
        if (currentVideoIndex < segments.length - 1) {
          setTimeout(() => {
            setCurrentVideoIndex(currentVideoIndex + 1);
          }, 300);
        } else {
          // All videos played, go back to map
          setTimeout(() => {
            setViewState('map');
            setSelectedLocation(null);
            setCurrentVideoIndex(0);
          }, 1000);
        }
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [viewState, selectedLocation, currentVideoIndex]);

  // Intersection Observer for video scrolling
  useEffect(() => {
    if (viewState !== 'videos' || !selectedLocation) return;

    const observers: IntersectionObserver[] = [];

    videoContainerRefs.current.forEach((container, index) => {
      if (!container) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              setCurrentVideoIndex(index);
            }
          });
        },
        { threshold: 0.5 }
      );

      observer.observe(container);
      observers.push(observer);
    });

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [viewState, selectedLocation]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (viewState !== 'videos' || !selectedLocation) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = touchStartY.current - touchEndY;
    const deltaTime = touchEndTime - touchStartTime.current;

    const screenHeight = window.innerHeight;
    const swipeThreshold = screenHeight * 0.1;

    if (Math.abs(deltaY) > swipeThreshold && deltaTime < 300) {
      const segments = selectedLocation.videoSegments;
      if (deltaY < -swipeThreshold && currentVideoIndex < segments.length - 1) {
        setCurrentVideoIndex(currentVideoIndex + 1);
      } else if (deltaY > swipeThreshold && currentVideoIndex > 0) {
        setCurrentVideoIndex(currentVideoIndex - 1);
      }
    }
  }, [viewState, selectedLocation, currentVideoIndex]);

  const scrollToVideo = useCallback((index: number) => {
    const container = videoContainerRefs.current[index];
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  useEffect(() => {
    if (viewState === 'videos' && selectedLocation) {
      scrollToVideo(currentVideoIndex);
    }
  }, [currentVideoIndex, viewState, selectedLocation, scrollToVideo]);

  // Restore map state when returning to map view
  useEffect(() => {
    if (viewState === 'map' && mapRef.current && savedMapState) {
      // Small delay to ensure map is visible
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.setCenter(savedMapState.center);
          mapRef.current.setZoom(savedMapState.zoom);
          console.log('📍 Restored map state on view change:', savedMapState);
        }
      }, 200);
    }
  }, [viewState, savedMapState]);

  const handleBackToMap = () => {
    console.log('📍 Going back to map view');
    setViewState('map');
    setSelectedLocation(null);
    setCurrentVideoIndex(0);
    // Restore saved map state if available
    if (mapRef.current && savedMapState) {
      setTimeout(() => {
        mapRef.current?.setCenter(savedMapState.center);
        mapRef.current?.setZoom(savedMapState.zoom);
        console.log('📍 Restored map state:', savedMapState);
      }, 100);
    } else if (mapRef.current) {
      setTimeout(() => {
        setMapReady(true);
      }, 100);
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Failed to load map: {loadError.message}</p>
      </div>
    );
  }

  // Desktop message
  if (!isMobile) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-screen w-screen"
        style={{ backgroundColor: '#18204aff' }}
      >
        <p 
          className="text-xl font-bold text-center px-6"
          style={{ color: '#fdf5e2', fontWeight: 700 }}
        >
          Please view this page on a mobile device for the best experience.
        </p>
      </div>
    );
  }

  const showSplash = loading || !isLoaded || !mapReady || !splashDone;

  // Always render map and content; splash sits on top and fades out once ready
  return (
    <div className="relative h-screen w-screen bg-black">
      {/* Map - always mounted but hidden when in video view */}
      <div
        style={{
          visibility: viewState === 'map' ? 'visible' : 'hidden',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      >
        {isLoaded && isMobile && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={defaultZoom}
            onLoad={(map) => {
              console.log('📍 GoogleMap onLoad called');
              mapRef.current = map;
              setMapReady(true);
              console.log('📍 Map ready set to true, map instance:', !!map);
            }}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              mapId: mapId || undefined, // Use Map ID if provided (required for AdvancedMarkerElement)
            }}
          />
        )}
      </div>

      {/* Video view overlay */}
      {isMobile && viewState === 'videos' && selectedLocation && (
        <div className="absolute inset-0 z-10 bg-black">
          {/* Back Button */}
          <button
            onClick={handleBackToMap}
            className="fixed top-4 left-4 z-[60] bg-black/70 hover:bg-black/90 text-white rounded-lg px-4 py-2 transition-all duration-200"
          >
            ← Back to Map
          </button>

          {/* Location Name */}
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-black/70 text-white rounded-lg px-4 py-2">
            <h2 className="text-lg font-bold">{selectedLocation.name}</h2>
            <p className="text-xs text-white/60 font-mono">ID: {selectedLocation.id}</p>
            <p className="text-sm text-white/80">
              {selectedLocation.videoSegments.length}{' '}
              {selectedLocation.videoSegments.length === 1 ? 'video' : 'videos'}
            </p>
          </div>

          {/* Video Feed */}
          <div
            className="h-screen overflow-y-scroll snap-y snap-mandatory bg-black"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {selectedLocation.videoSegments.map((segment, index) => (
              <div
                key={`${segment.video_id}-${segment.location_id}-${index}`}
                ref={(el) => {
                  videoContainerRefs.current[index] = el;
                }}
                className="h-screen w-full snap-start snap-always relative flex items-center justify-center"
              >
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={segment.video_url}
                  className="w-full h-full object-cover"
                  playsInline
                  loop={false}
                  muted={false}
                />
                {/* Segment Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <p className="text-white text-sm">
                    Video {index + 1} of {selectedLocation.videoSegments.length}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Splash overlay that fades out once map & data are ready */}
      <div
        className={`pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center transition-opacity duration-700 ${
          showSplash ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: '#FFC27E' }}
      >
        <div className="w-full max-w-2xl">
          <SVG2 />
        </div>
        <div className="mt-6 text-center">
          <h1 className="text-2xl font-semibold mb-1">Philadelphia Pins</h1>
          <p className="text-sm text-gray-300">Loading locations and videos…</p>
        </div>
      </div>
    </div>
  );
}

