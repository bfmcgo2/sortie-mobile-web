'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import { fetchGuideById, GuideLocation, Guide, GuidePin } from '@/lib/supabase';
import { debugGuideLocation, warnGuideNoVideoOnClick } from '@/lib/guideDebug';
import GuideMap from '@/components/GuideMap';
import GuideHeaderBar from '@/components/GuideHeaderBar';
import GuideLocationsMenuOverlay from '@/components/GuideLocationsMenuOverlay';
import { locationsToMenuItems, pinsToMenuItems } from '@/lib/guideMenuItems';
import GuideTitleH1 from '@/components/GuideTitleH1';
import GuideViewportShell from '@/components/GuideViewportShell';
import VideoSegmentPlayer from '@/components/VideoSegmentPlayer';
import SVG2 from '@/components/svg/SVG2';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
});

interface CompanyData {
  id: string;
  name: string;
  logo: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

type ViewState = 'loading' | 'map' | 'video';

const MENU_MAP_ZOOM = 17;

export default function CreatorGuidePage() {
  const params = useParams();
  const guideId = params['guide-id'] as string | undefined;
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [guide, setGuide] = useState<Guide | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [pins, setPins] = useState<GuidePin[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GuideLocation | null>(null);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [locationsMenuOpen, setLocationsMenuOpen] = useState(false);
  const [mapRecenterNonce, setMapRecenterNonce] = useState(0);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    if (!guideId) {
      console.warn('⚠️ No guide ID provided');
      return;
    }

    async function loadGuide() {
      if (!guideId) {
        return; // Type guard for TypeScript
      }
      
      setLoadingLocations(true);

      try {
        console.log('🔍 Fetching creator guide by ID:', guideId);
        const guideData = await fetchGuideById(guideId);
        
        setGuide(guideData.guide);
        setLocations(guideData.locations);
        setPins(guideData.pins || []);
        
        console.log('✅ Creator guide loaded:', guideData.guide.name, 'Locations:', guideData.locations.length);
        console.log('👤 Created by:', guideData.guide.user_email);
        
        // If there's no logo_url, immediately mark image as loaded so we don't wait for it
        if (!guideData.guide.logo_url) {
          console.log('📷 No logo URL, proceeding without logo');
          setImageLoaded(true);
        }
      } catch (error: any) {
        console.error('❌ Failed to load creator guide:', error);
        // Even on error, try to show something
      } finally {
        setLoadingLocations(false);
      }
    }

    loadGuide();
  }, [guideId]);

  // Show loading screen for 3 seconds, then transition to map
  // Image is optional - don't wait for it if there's no logo
  useEffect(() => {
    if (guide && !loadingLocations) {
      // If there's no logo_url, don't wait for image to load
      // If there is a logo_url, wait for it to load (or fail)
      const shouldProceed = !guide.logo_url || imageLoaded;
      
      if (shouldProceed) {
        const timer = setTimeout(() => {
          setViewState('map');
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [guide, imageLoaded, loadingLocations]);

  const handleLocationClick = (location: GuideLocation) => {
    debugGuideLocation('creator guide — location click', location);

    if (location.coordinates) {
      setMapFocus({ lat: location.coordinates.lat, lng: location.coordinates.lng });
    }

    // Company pins don't have videos, so don't open video player
    if (location.isCompanyPin === true) {
      // For company pins, you could show location info or open Google Maps
      // For now, we'll just log it - you can add a modal or info panel later
      console.log('Company pin clicked:', location.name);
      
      // Optionally open Google Maps
      if (location.place_id) {
        window.open(`https://www.google.com/maps/place/?q=place_id:${location.place_id}`, '_blank');
      } else if (location.coordinates) {
        window.open(`https://www.google.com/maps?q=${location.coordinates.lat},${location.coordinates.lng}`, '_blank');
      }
      return;
    }
    
    // Only open video player for video locations
    if (location.video_url) {
      setSelectedLocation(location);
      setViewState('video');
    } else {
      warnGuideNoVideoOnClick(
        location,
        'Missing video_url (creator guide: check joined video is_public and video_url on videos row).'
      );
    }
  };

  const handlePinClick = (pin: GuidePin) => {
    // Pins don't have videos, so open Google Maps
    console.log('Pin clicked:', pin.name);

    if (pin.coordinates) {
      setMapFocus({ lat: pin.coordinates.lat, lng: pin.coordinates.lng });
    }

    // Prefer custom pin link when provided
    const rawLink = pin.pinLinkUrl?.trim();
    if (rawLink) {
      const normalizedLink = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;
      try {
        const url = new URL(normalizedLink);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          window.open(url.toString(), '_blank');
          return;
        }
      } catch {
        // Fall through to Google Maps fallback if custom URL is invalid
      }
    }

    if (pin.placeId) {
      window.open(`https://www.google.com/maps/place/?q=place_id:${pin.placeId}`, '_blank');
    } else if (pin.coordinates) {
      window.open(`https://www.google.com/maps?q=${pin.coordinates.lat},${pin.coordinates.lng}`, '_blank');
    }
  };

  const handleCloseVideo = () => {
    setSelectedLocation(null);
    setViewState('map');
  };

  const menuMapItems = useMemo(() => {
    const pinItems = pinsToMenuItems(pins).map((item, index, arr) => ({
      ...item,
      separatorAfter: index === arr.length - 1 && locations.length > 0,
    }));
    return [...pinItems, ...locationsToMenuItems(locations)];
  }, [locations, pins]);

  // Loading screen
  if (viewState === 'loading') {
    return (
      <GuideViewportShell className={inter.className}>
      <div className="min-h-[var(--vvh,100dvh)] w-full flex-1 px-safe" style={{ backgroundColor: '#18204aff' }}>
        <div className="flex min-h-[var(--vvh,100dvh)] w-full flex-col items-center justify-center px-8 sm:px-12">
        {/* Guide Logo - Only show if logo_url exists */}
        {guide && guide.logo_url && (
          <div 
            className="mb-8 rounded-full flex items-center justify-center overflow-hidden"
            style={{ 
              backgroundColor: '#fdf5e2',
              width: '120px',
              height: '120px',
              padding: '4px'
            }}
          >
            <img 
              src={guide.logo_url} 
              alt={`${guide.name} logo`}
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                console.error('Failed to load logo:', guide.logo_url);
                e.currentTarget.style.display = 'none';
                setImageLoaded(true); // Mark as loaded so we can proceed even if logo fails
              }}
              onLoad={() => {
                console.log('Logo loaded successfully:', guide.logo_url);
                setImageLoaded(true);
              }}
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
          </div>
        )}

        {guide && (
          <p
            className="mx-auto max-w-lg text-2xl font-bold text-center mb-6"
            style={{ color: '#fdf5e2', fontWeight: 700 }}
          >
            {guide.name} Guide
          </p>
        )}

        {/* Loading Text with Animated Dots */}
        <div className="flex items-center justify-center gap-1">
          <span style={{ color: '#fdf5e2', fontSize: '18px' }}>Loading</span>
          <span className="loading-dot" style={{ color: '#fdf5e2', fontSize: '18px' }}>.</span>
          <span className="loading-dot" style={{ color: '#fdf5e2', fontSize: '18px' }}>.</span>
          <span className="loading-dot" style={{ color: '#fdf5e2', fontSize: '18px' }}>.</span>
        </div>
        
        {/* SVG2 Loader - Commented out */}
        {/* <div className="mt-4 w-full max-w-xl">
          <SVG2 />
        </div> */}
        </div>
      </div>
      </GuideViewportShell>
    );
  }

  // Map + optional video overlay (map stays mounted so camera is preserved when closing video)
  if (viewState === 'map' || viewState === 'video') {
    // Convert guide to company data format for GuideMap component
    // Only show company logo pin if there's a company_id or logo_url (non-empty)
    // Prefer company_pin_coordinates for the logo pin position, fall back to guide.coordinates
    const displayCompany: CompanyData | null =
      guide && (guide.company_id || (guide.logo_url && guide.logo_url.trim() !== ''))
        ? {
            id: guide.company_id || guide.id,
            name: guide.name,
            logo: guide.logo_url || '',
            coordinates:
              guide.company_pin_coordinates ||
              guide.coordinates ||
              undefined,
          }
        : null;

    return (
      <GuideViewportShell className={inter.className}>
      <div className="guide-app-shell relative flex min-h-[var(--vvh,100dvh)] w-full flex-col">
        {/* Header Bar */}
        <div 
          className="relative z-[160] flex w-full flex-shrink-0 items-center justify-center pt-safe"
          style={{ 
            padding: '10px 0',
            backgroundColor: '#18204aff',
            paddingTop: `max(10px, calc(10px + env(safe-area-inset-top, 0px)))`
          }}
        >
          <GuideHeaderBar
            titleColor="#fdf5e2"
            menuOpen={locationsMenuOpen}
            onMenuClick={() => setLocationsMenuOpen((o) => !o)}
          >
            <GuideTitleH1
              className={inter.className}
              style={{ color: '#fdf5e2', fontWeight: 700 }}
              onClick={() => {
                setMapFocus(null);
                setMapRecenterNonce((n) => n + 1);
              }}
            >
              {guide?.name ? `${guide.name} Guide` : 'Guide'}
            </GuideTitleH1>
          </GuideHeaderBar>
        </div>
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
          <GuideMap
            locations={locations}
            pins={pins}
            isActive
            mapFocus={mapFocus}
            resetBoundsNonce={mapRecenterNonce}
            onLocationClick={handleLocationClick}
            onPinClick={handlePinClick}
            company={displayCompany}
            guide={guide}
          />
        </div>
        {viewState === 'video' && (
          <div className="absolute inset-0 z-[200] bg-black">
            <VideoSegmentPlayer
              location={selectedLocation}
              onClose={handleCloseVideo}
            />
          </div>
        )}
        <GuideLocationsMenuOverlay
          open={locationsMenuOpen}
          items={menuMapItems}
          onNavigateToItem={(item) => {
            setMapFocus({ lat: item.lat, lng: item.lng, zoom: MENU_MAP_ZOOM });
            setLocationsMenuOpen(false);
          }}
          titleFontClassName={inter.className}
        />
      </div>
      </GuideViewportShell>
    );
  }

  // Fallback if guideId is not available
  if (!guideId) {
    return (
      <GuideViewportShell className={inter.className}>
      <div 
        className="flex min-h-[var(--vvh,100dvh)] w-full flex-1 flex-col items-center justify-center"
        style={{ backgroundColor: '#18204aff', color: '#fdf5e2' }}
      >
        <p className="text-xl font-bold text-center">
          Guide ID not found
        </p>
      </div>
      </GuideViewportShell>
    );
  }

  // Fallback (shouldn't reach here due to early return, but just in case)
  return null;
}

