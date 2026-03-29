'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { GuideLocation } from '@/lib/supabase';
import { debugGuideLocation } from '@/lib/guideDebug';

interface VideoSegmentPlayerProps {
  location: GuideLocation | null;
  onClose: () => void;
}

export default function VideoSegmentPlayer({ location, onClose }: VideoSegmentPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasStartedRef = useRef(false);
  const segmentEndTime = useRef<number | null>(null);

  // Run after DOM commit so videoRef is attached when opening the player.
  useLayoutEffect(() => {
    if (!location || !videoRef.current) return;

    const video = videoRef.current;
    const startTime = location.time_start_sec;
    const endTime = location.time_end_sec;

    // Reset state when location changes
    hasStartedRef.current = false;
    setIsPlaying(false);

    // Set up video
    video.currentTime = startTime;
    segmentEndTime.current = endTime;

    // Play when ready
    const handleCanPlay = () => {
      if (!hasStartedRef.current) {
        // Ensure video is unmuted
        video.muted = false;
        video.volume = 1.0;
        video.play().catch((error) => {
          console.error('[Sortie Guide] VideoSegmentPlayer: play() rejected', {
            id: location.id,
            name: location.name,
            error,
          });
        });
        hasStartedRef.current = true;
        setIsPlaying(true);
      }
    };

    // Check if we've reached the end of the segment
    const handleTimeUpdate = () => {
      if (endTime !== null && video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
        // Optionally loop back to start or close
        // For now, just pause at the end
      }
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', () => setIsPlaying(true));
    video.addEventListener('pause', () => setIsPlaying(false));

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', () => setIsPlaying(true));
      video.removeEventListener('pause', () => setIsPlaying(false));
    };
  }, [location]);

  const handleTogglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // Ensure video is unmuted when playing
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch((error) => {
        console.error('Error playing video:', error);
      });
    }
  };

  if (!location || !location.video_url || location.isCompanyPin === true) {
    if (location && (!location.video_url || location.isCompanyPin === true)) {
      console.warn('[Sortie Guide] VideoSegmentPlayer: not rendering', {
        id: location.id,
        name: location.name,
        isCompanyPin: location.isCompanyPin,
        hasVideoUrl: Boolean(location.video_url),
      });
    }
    return null;
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        src={location.video_url}
        className="w-full h-full object-cover"
        playsInline
        muted={false}
        autoPlay
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          debugGuideLocation('VideoSegmentPlayer — loadedmetadata', location, {
            duration: v.duration,
            currentTime: v.currentTime,
            seekTo: location.time_start_sec,
            segmentEnd: location.time_end_sec,
          });
        }}
        onError={(e) => {
          const v = e.currentTarget;
          const err = v.error;
          console.error('[Sortie Guide] VideoSegmentPlayer: <video> error', {
            id: location.id,
            name: location.name,
            src: location.video_url?.slice(0, 120),
            code: err?.code,
            message: err?.message,
          });
        }}
      />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all duration-200"
        aria-label="Close video"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Play/Pause Overlay (center tap) */}
      <div
        className="absolute inset-0 flex items-center justify-center cursor-pointer"
        onClick={handleTogglePlayPause}
      >
        {!isPlaying && (
          <div className="bg-black/50 rounded-full p-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" className="w-16 h-16">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Location Name and Address Link */}
      {(location.name || location.location_name) && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pt-6 pb-safe px-safe"
          style={{ 
            paddingBottom: 'max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))'
          }}
        >
          <a
            href={
              location.coordinates
                ? `https://www.google.com/maps/search/?api=1&query=${location.coordinates.lat},${location.coordinates.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.location_name || location.name)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {location.name && (
              <h3 className="text-white text-xl font-bold mb-1 hover:text-white/90 transition-colors">
                {location.name}
              </h3>
            )}
            {location.location_name && (
              <p className="text-white/90 text-sm hover:text-white underline transition-colors">
                {location.location_name}
              </p>
            )}
          </a>
        </div>
      )}
    </div>
  );
}

