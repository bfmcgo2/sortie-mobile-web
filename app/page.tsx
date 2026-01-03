'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchPublicVideos, VideoRecord } from '@/lib/supabase';
import { createSectionsFromLocations, getNextSection, getCurrentSection } from '@/lib/sectionNavigation';
import VideoMap from '@/components/VideoMap';

export default function Home() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const touchStartX = useRef(0);
  const manuallyPausedVideos = useRef<Set<number>>(new Set());
  const lastAutoPlayIndex = useRef<number>(-1);
  const touchHandledPlayPause = useRef<boolean>(false);
  const videoCurrentTimes = useRef<Map<number, number>>(new Map());
  const videoDurations = useRef<Map<number, number>>(new Map());

  // Load videos on mount
  useEffect(() => {
    async function loadVideos() {
      try {
        setLoading(true);
        const publicVideos = await fetchPublicVideos();
        setVideos(publicVideos);
        console.log('Loaded videos:', publicVideos.length);
      } catch (error) {
        console.error('Failed to load videos:', error);
      } finally {
        setLoading(false);
      }
    }
    loadVideos();
  }, []);

  // Use Intersection Observer to detect which video is in view
  useEffect(() => {
    if (videos.length === 0) return;

    const observers: IntersectionObserver[] = [];

    videoContainerRefs.current.forEach((container, index) => {
      if (!container) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              setCurrentIndex(index);
            }
          });
        },
        {
          threshold: 0.5,
          rootMargin: '0px'
        }
      );

      observer.observe(container);
      observers.push(observer);
    });

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [videos.length]);

  // Update mute state for all videos when isMuted changes
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) {
        video.muted = isMuted;
      }
    });
  }, [isMuted]);

  // Auto-play current video and pause others
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      
      if (index === currentIndex) {
        const isNewVideo = lastAutoPlayIndex.current !== currentIndex;
        const isManuallyPaused = manuallyPausedVideos.current.has(currentIndex);
        
        if (isNewVideo && !isManuallyPaused) {
          video.play().catch((error) => {
            console.log('Autoplay prevented for video', index, error);
          });
          lastAutoPlayIndex.current = currentIndex;
          manuallyPausedVideos.current.delete(currentIndex);
        }
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [currentIndex]);

  const scrollToVideo = useCallback((index: number) => {
    const container = videoContainerRefs.current[index];
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndTime = Date.now();
    const deltaY = touchStartY.current - touchEndY;
    const deltaX = Math.abs(touchStartX.current - touchEndX);
    const deltaTime = touchEndTime - touchStartTime.current;
    
    // Calculate 10% of screen height for swipe threshold
    const screenHeight = window.innerHeight;
    const swipeThreshold = screenHeight * 0.1; // 10% of screen height
    
    const isVerticalSwipe = Math.abs(deltaY) > swipeThreshold;
    const isTap = !isVerticalSwipe && deltaX < 50 && deltaTime < 300;
    
    if (isVerticalSwipe && deltaTime < 300) {
      // Swipe up (negative deltaY means finger moved up)
      if (deltaY < -swipeThreshold && currentIndex < videos.length - 1) {
        scrollToVideo(currentIndex + 1);
      } 
      // Swipe down (positive deltaY means finger moved down)
      else if (deltaY > swipeThreshold && currentIndex > 0) {
        scrollToVideo(currentIndex - 1);
      }
    } else if (isTap) {
      const screenWidth = window.innerWidth;
      const leftThird = screenWidth / 3;
      const rightThird = (screenWidth * 2) / 3;
      const isLeftTap = touchStartX.current < leftThird;
      const isRightTap = touchStartX.current > rightThird;
      const isCenterTap = !isLeftTap && !isRightTap;
      
      const video = videoRefs.current[currentIndex];
      const currentVideo = videos[currentIndex];
      
      if (video && currentVideo) {
        touchHandledPlayPause.current = true;
        
        if (isLeftTap) {
          const currentTime = videoCurrentTimes.current.get(currentIndex) || 0;
          const duration = videoDurations.current.get(currentIndex) || video.duration * 1000;
          const sections = createSectionsFromLocations(currentVideo.locations || [], duration);
          const locationSections = sections.filter(section => section.type === 'location');
          
          let previousLocation = null;
          for (let i = locationSections.length - 1; i >= 0; i--) {
            const section = locationSections[i];
            if (section.startTime < currentTime) {
              const currentSection = getCurrentSection(currentTime, sections);
              if (!currentSection || section.id !== currentSection.id) {
                previousLocation = section;
                break;
              }
            }
          }
          
          if (previousLocation) {
            video.currentTime = previousLocation.startTime / 1000;
            videoCurrentTimes.current.set(currentIndex, previousLocation.startTime);
          }
        } else if (isRightTap) {
          const currentTime = videoCurrentTimes.current.get(currentIndex) || 0;
          const duration = videoDurations.current.get(currentIndex) || video.duration * 1000;
          const sections = createSectionsFromLocations(currentVideo.locations || [], duration);
          const nextSection = getNextSection(currentTime, sections);
          
          if (nextSection) {
            video.currentTime = nextSection.startTime / 1000;
            videoCurrentTimes.current.set(currentIndex, nextSection.startTime);
          }
        } else if (isCenterTap) {
          if (video.paused) {
            video.play().catch((error) => {
              console.log('Play prevented:', error);
            });
            manuallyPausedVideos.current.delete(currentIndex);
          } else {
            video.pause();
            manuallyPausedVideos.current.add(currentIndex);
          }
        }
        
        setTimeout(() => {
          touchHandledPlayPause.current = false;
        }, 300);
      }
    }
  }, [currentIndex, videos.length, scrollToVideo]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleVideoClick = useCallback((e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (index !== currentIndex) return;
    
    if (touchHandledPlayPause.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const screenWidth = window.innerWidth;
    const clickX = e.clientX;
    const leftThird = screenWidth / 3;
    const rightThird = (screenWidth * 2) / 3;
    const isLeftClick = clickX < leftThird;
    const isRightClick = clickX > rightThird;
    const isCenterClick = !isLeftClick && !isRightClick;
    
    const video = videoRefs.current[currentIndex];
    const currentVideo = videos[currentIndex];
    
    if (video && currentVideo) {
      if (isLeftClick) {
        const currentTime = videoCurrentTimes.current.get(currentIndex) || video.currentTime * 1000;
        const duration = videoDurations.current.get(currentIndex) || video.duration * 1000;
        const sections = createSectionsFromLocations(currentVideo.locations || [], duration);
        const locationSections = sections.filter(section => section.type === 'location');
        
        let previousLocation = null;
        for (let i = locationSections.length - 1; i >= 0; i--) {
          const section = locationSections[i];
          if (section.startTime < currentTime) {
            const currentSection = getCurrentSection(currentTime, sections);
            if (!currentSection || section.id !== currentSection.id) {
              previousLocation = section;
              break;
            }
          }
        }
        
        if (previousLocation) {
          video.currentTime = previousLocation.startTime / 1000;
          videoCurrentTimes.current.set(currentIndex, previousLocation.startTime);
        }
      } else if (isRightClick) {
        const currentTime = videoCurrentTimes.current.get(currentIndex) || video.currentTime * 1000;
        const duration = videoDurations.current.get(currentIndex) || video.duration * 1000;
        const sections = createSectionsFromLocations(currentVideo.locations || [], duration);
        const nextSection = getNextSection(currentTime, sections);
        
        if (nextSection) {
          video.currentTime = nextSection.startTime / 1000;
          videoCurrentTimes.current.set(currentIndex, nextSection.startTime);
        }
      } else if (isCenterClick) {
        if (video.paused) {
          video.play().catch((error) => {
            console.log('Play prevented:', error);
          });
          manuallyPausedVideos.current.delete(currentIndex);
        } else {
          video.pause();
          manuallyPausedVideos.current.add(currentIndex);
        }
      }
    }
  }, [currentIndex, videos]);

  const handleLocationClick = useCallback((location: { lat: number; lng: number; time_start_sec: number }) => {
    const video = videoRefs.current[currentIndex];
    if (video) {
      video.currentTime = location.time_start_sec;
      videoCurrentTimes.current.set(currentIndex, location.time_start_sec * 1000);
      setShowMap(false); // Switch back to video when location is clicked
    }
  }, [currentIndex]);

  const currentVideo = videos[currentIndex] || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>Loading videos...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <p>No videos available</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-black">
      {/* Map Overlay */}
      {showMap && (
        <div className="absolute inset-0 z-50 bg-black">
          <VideoMap
            currentVideo={currentVideo}
            isActive={showMap}
            onLocationClick={handleLocationClick}
          />
        </div>
      )}

      {/* Map/Video Toggle Button */}
      <button
        onClick={() => setShowMap(!showMap)}
        className="fixed top-4 left-4 z-[60] bg-black/70 hover:bg-black/90 text-white rounded-lg px-4 py-2 transition-all duration-200 flex items-center justify-center"
        aria-label={showMap ? 'Show Video' : 'Show Map'}
      >
        {showMap ? 'Video' : 'Map'}
      </button>

      {/* Mute/Unmute Button */}
      <button
        onClick={toggleMute}
        className="fixed top-4 right-4 z-[60] bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all duration-200 flex items-center justify-center"
        style={{ width: '48px', height: '48px' }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l-2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-7.5-6L9 9m0 0l-1.5 1.5M9 9L7.5 7.5M9 9l1.5 1.5M9 15.75l-6-6v-4.5a1.5 1.5 0 0 1 1.5-1.5h4.5l6-6a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-4.5l-6-6z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.5c-.83 0-1.5-.67-1.5-1.5v-6c0-.83.67-1.5 1.5-1.5h2.25Z" />
          </svg>
        )}
      </button>

      {/* Video Feed */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory bg-black"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videos.map((video, index) => (
          <div
            key={video.id}
            ref={(el) => {
              videoContainerRefs.current[index] = el;
            }}
            className="h-screen w-full snap-start snap-always relative flex items-center justify-center cursor-pointer"
            onClick={(e) => handleVideoClick(e, index)}
          >
            <video
              ref={(el) => {
                videoRefs.current[index] = el;
              }}
              src={video.video_url}
              className="w-full h-full object-cover pointer-events-none"
              playsInline
              loop
              muted={isMuted}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onLoadedMetadata={() => {
                const video = videoRefs.current[index];
                if (video) {
                  const duration = video.duration * 1000;
                  videoDurations.current.set(index, duration);
                  if (index === 0) {
                    video.play().catch((error) => {
                      console.log('Autoplay prevented for first video:', error);
                    });
                  }
                }
              }}
              onTimeUpdate={() => {
                const video = videoRefs.current[index];
                if (video) {
                  const currentTime = video.currentTime * 1000;
                  videoCurrentTimes.current.set(index, currentTime);
                }
              }}
            />
          </div>
        ))}
        </div>
    </div>
  );
}
