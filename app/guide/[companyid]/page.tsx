'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Inter } from 'next/font/google';
import companiesData from '@/data/companies.json';
import companyLocationsData from '@/data/company-locations.json';
import { fetchCompanyGuideLocations, GuideLocation } from '@/lib/supabase';
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

export default function GuidePage() {
  const params = useParams();
  const companyId = params?.companyid as string | undefined;
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GuideLocation | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [viewportHeight, setViewportHeight] = useState('100vh');

  // Set dynamic viewport height to account for mobile browser UI
  useEffect(() => {
    const setHeight = () => {
      // Use actual window innerHeight for mobile browsers
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setViewportHeight(`${window.innerHeight}px`);
    };
    
    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    
    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
    };
  }, []);

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
    setSelectedLocation(location);
    setViewState('video');
  };

  const handleCloseVideo = () => {
    setSelectedLocation(null);
    setViewState('map');
  };

  // Desktop message
  if (!isMobile) {
    return (
      <div 
        className={`flex flex-col items-center justify-center w-screen ${inter.className}`}
        style={{ backgroundColor: '#18204aff', height: viewportHeight }}
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
        className={`flex flex-col items-center justify-center w-screen ${inter.className}`}
        style={{ backgroundColor: '#18204aff', height: viewportHeight }}
      >
        {/* Company Logo - Only show when company data and image are ready */}
        {company && (
          <div 
            className="mb-6 rounded-full flex items-center justify-center overflow-hidden"
            style={{ 
              backgroundColor: '#fdf5e2',
              width: '50px',
              height: '50px',
              padding: '2px'
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

        {/* Loading Text */}
        <p 
          className="text-xl font-bold text-center"
          style={{ color: '#fdf5e2', fontWeight: 700 }}
        >
          {company?.name || 'Company'} Guide
        </p>
        
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
      <div className="w-screen" style={{ height: viewportHeight }}>
        <VideoSegmentPlayer
          location={selectedLocation}
          onClose={handleCloseVideo}
        />
      </div>
    );
  }

  // Map view (default after loading)
  if (isMobile) {
    // Calculate header height (30px font + 20px padding = ~50px, plus safe area)
    const headerHeight = 50;
    
    return (
      <div className="w-screen relative flex flex-col" style={{ height: viewportHeight }}>
        {/* Header Bar */}
        <div 
          className="flex items-center justify-center z-50 flex-shrink-0"
          style={{ 
            padding: '10px 0',
            backgroundColor: '#18204aff',
            paddingTop: `max(10px, calc(10px + env(safe-area-inset-top)))`,
            minHeight: `${headerHeight}px`
          }}
        >
          <p 
            className={`font-bold text-center ${inter.className}`}
            style={{ color: '#fdf5e2', fontWeight: 700, fontSize: '30px' }}
          >
            {company?.name ? `${company.name}'s Guide` : 'Guide'}
          </p>
        </div>
        {/* Map Container - takes remaining space */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <GuideMap
            locations={locations}
            isActive={viewState === 'map'}
            onLocationClick={handleLocationClick}
            company={company}
          />
        </div>
      </div>
    );
  }

  // Fallback if companyId is not available
  if (!companyId) {
    return (
      <div 
        className={`flex flex-col items-center justify-center w-screen ${inter.className}`}
        style={{ backgroundColor: '#18204aff', color: '#fdf5e2', height: viewportHeight }}
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

