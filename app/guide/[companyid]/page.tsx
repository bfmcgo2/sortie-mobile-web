'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import companiesData from '@/data/companies.json';
import companyLocationsData from '@/data/company-locations.json';
import { fetchCompanyGuideLocations, GuideLocation } from '@/lib/supabase';
import { debugGuideLocation, warnGuideNoVideoOnClick } from '@/lib/guideDebug';
import GuideMap from '@/components/GuideMap';
import GuideHeaderBar from '@/components/GuideHeaderBar';
import GuideLocationsMenuOverlay from '@/components/GuideLocationsMenuOverlay';
import { locationsToMenuItems } from '@/lib/guideMenuItems';
import GuideTitleH1 from '@/components/GuideTitleH1';
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

export default function GuidePage() {
  const params = useParams();
  const companyId = params?.companyid as string | undefined;
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GuideLocation | null>(null);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [locationsMenuOpen, setLocationsMenuOpen] = useState(false);
  const [mapRecenterNonce, setMapRecenterNonce] = useState(0);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  // Check if user is on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!companyId) {
      console.warn('⚠️ No company ID provided');
      return;
    }

    // Find company from JSON data
    const foundCompany = companiesData.find(
      (c: CompanyData) => c.id === companyId
    );

    console.log('🔍 Looking for company:', companyId);
    console.log('🔍 Available companies:', companiesData);
    console.log('🔍 Found company:', foundCompany);

    if (foundCompany) {
      setCompany(foundCompany);
      console.log('✅ Company loaded:', foundCompany.name, 'Logo:', foundCompany.logo);
    } else {
      // Fallback if company not found
      console.warn('⚠️ Company not found, using fallback');
      setCompany({
        id: companyId,
        name: 'Company',
        logo: '/placeholder-logo.png',
      });
    }
  }, [companyId]);

  // Load locations when company is loaded (only on mobile)
  useEffect(() => {
    if (!company || !isMobile) {
      if (!isMobile) {
        setLoadingLocations(false);
      }
      return;
    }

    async function loadLocations() {
      if (!company) return;
      
      setLoadingLocations(true);
      try {
        // Get location IDs for this company from the mapping file
        const locationIds = (companyLocationsData as Record<string, string[]>)[company.id] || [];
        console.log('📍 Company location IDs:', locationIds);
        
        if (locationIds.length === 0) {
          console.log('📍 No locations configured for this company');
          setLocations([]);
        } else {
          const companyLocations = await fetchCompanyGuideLocations(company.id, locationIds);
          console.log('📍 Loaded guide locations:', companyLocations.length);
          setLocations(companyLocations);
        }
      } catch (error) {
        console.error('Failed to load locations:', error);
        setLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    }

    loadLocations();
  }, [company, isMobile]);

  // Show loading screen for 3 seconds, then transition to map
  useEffect(() => {
    if (company && imageLoaded && !loadingLocations) {
      const timer = setTimeout(() => {
        setViewState('map');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [company, imageLoaded, loadingLocations]);

  const handleLocationClick = (location: GuideLocation) => {
    debugGuideLocation('static guide — location click', location);

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
        'Missing video_url after fetch (check locations.video_id and videos row / R2 URL conversion).'
      );
    }
  };

  const handleCloseVideo = () => {
    setSelectedLocation(null);
    setViewState('map');
  };

  const menuMapItems = useMemo(() => locationsToMenuItems(locations), [locations]);

  // Desktop message
  if (!isMobile) {
    return (
      <div 
        className={`flex flex-col items-center justify-center h-full-viewport ${inter.className}`}
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

  // Loading screen
  if (viewState === 'loading') {
    return (
      <div 
        className={`flex flex-col items-center justify-center h-full-viewport ${inter.className}`}
        style={{ backgroundColor: '#18204aff' }}
      >
        {/* Company Logo - Only show when company data and image are ready */}
        {company && (
          <div 
            className="mb-8 rounded-full flex items-center justify-center overflow-hidden"
            style={{ 
              backgroundColor: '#fdf5e2',
              width: '120px',
              height: '120px',
              padding: '4px'
            }}
          >
            {company.logo && (
              <img 
                src={company.logo} 
                alt={`${company.name} logo`}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  console.error('Failed to load logo:', company.logo);
                  e.currentTarget.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Logo loaded successfully:', company.logo);
                  setImageLoaded(true);
                }}
                style={{ display: imageLoaded ? 'block' : 'none' }}
              />
            )}
          </div>
        )}

        {company && (
          <p
            className="text-2xl font-bold text-center mb-6"
            style={{ color: '#fdf5e2', fontWeight: 700 }}
          >
            {company.name} Guide
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
    );
  }

  // Map + optional video overlay (map stays mounted so camera is preserved when closing video)
  if (isMobile && (viewState === 'map' || viewState === 'video')) {
    return (
      <div className="guide-app-shell h-full-viewport relative flex flex-col">
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
              {company?.name ? `${company.name} Guide` : 'Guide'}
            </GuideTitleH1>
          </GuideHeaderBar>
        </div>
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
          <GuideMap
            locations={locations}
            isActive
            mapFocus={mapFocus}
            resetBoundsNonce={mapRecenterNonce}
            onLocationClick={handleLocationClick}
            company={company}
          />
        </div>
        {viewState === 'video' && (
          <div className="fixed inset-0 z-[200] bg-black">
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
    );
  }

  // Fallback if companyId is not available
  if (!companyId) {
    return (
      <div 
        className={`flex flex-col items-center justify-center h-full-viewport ${inter.className}`}
        style={{ backgroundColor: '#18204aff', color: '#fdf5e2' }}
      >
        <p className="text-xl font-bold text-center">
          Company ID not found
        </p>
      </div>
    );
  }

  // Fallback (shouldn't reach here due to early return, but just in case)
  return null;
}

