'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import { fetchGuideById, GuideLocation, Guide, GuidePin } from '@/lib/supabase';
import GuideMap from '@/components/GuideMap';
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

export default function CreatorGuidePage() {
  const params = useParams();
  const guideId = params['guide-id'] as string | undefined;
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [guide, setGuide] = useState<Guide | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [pins, setPins] = useState<GuidePin[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GuideLocation | null>(null);
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
    }
  };

  const handlePinClick = (pin: GuidePin) => {
    // Pins don't have videos, so open Google Maps
    console.log('Pin clicked:', pin.name);
    
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

        {/* Guide Name */}
        <p 
          className="text-2xl font-bold text-center mb-6"
          style={{ color: '#fdf5e2', fontWeight: 700 }}
        >
          {guide?.name || 'Guide'} Guide
        </p>

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

  // Video view
  if (viewState === 'video' && isMobile) {
    return (
      <div className="h-full-viewport">
        <VideoSegmentPlayer
          location={selectedLocation}
          onClose={handleCloseVideo}
        />
      </div>
    );
  }

  // Map view (default after loading)
  if (isMobile) {
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
      <div className="h-full-viewport relative flex flex-col">
        {/* Header Bar */}
        <div 
          className="flex items-center justify-center z-50 flex-shrink-0 pt-safe"
          style={{ 
            padding: '10px 0',
            backgroundColor: '#18204aff',
            paddingTop: `max(10px, calc(10px + env(safe-area-inset-top, 0px)))`
          }}
        >
          <p 
            className={`font-bold text-center ${inter.className}`}
            style={{ color: '#fdf5e2', fontWeight: 700, fontSize: '30px' }}
          >
            {guide?.name ? `${guide.name} Guide` : 'Guide'}
          </p>
        </div>
        {/* Map Container - takes remaining space */}
        <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
          <GuideMap
            locations={locations}
            pins={pins}
            isActive={viewState === 'map'}
            onLocationClick={handleLocationClick}
            onPinClick={handlePinClick}
            company={displayCompany}
            guide={guide}
          />
        </div>
      </div>
    );
  }

  // Fallback if guideId is not available
  if (!guideId) {
    return (
      <div 
        className={`flex flex-col items-center justify-center h-full-viewport ${inter.className}`}
        style={{ backgroundColor: '#18204aff', color: '#fdf5e2' }}
      >
        <p className="text-xl font-bold text-center">
          Guide ID not found
        </p>
      </div>
    );
  }

  // Fallback (shouldn't reach here due to early return, but just in case)
  return null;
}

