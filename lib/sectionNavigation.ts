export type Location = {
  id: string;
  time_start_sec: number;
  time_end_sec: number | null;
  name: string;
  location_name: string;
  coordinates: { lat: number; lng: number };
};

export type Section = {
  id: string;
  name: string;
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
  type: 'intro' | 'location';
};

export function createSectionsFromLocations(locations: Location[], videoDuration: number): Section[] {
  const sections: Section[] = [];
  
  // Add intro section if there's time before the first location
  if (locations.length > 0 && locations[0].time_start_sec > 0) {
    sections.push({
      id: 'intro',
      name: 'Intro',
      startTime: 0,
      endTime: locations[0].time_start_sec * 1000,
      type: 'intro'
    });
  } else if (locations.length === 0) {
    // If no locations, the entire video is intro
    sections.push({
      id: 'intro',
      name: 'Intro',
      startTime: 0,
      endTime: videoDuration,
      type: 'intro'
    });
  }
  
  // Add location sections only (no transition sections)
  locations.forEach((location) => {
    const startTime = location.time_start_sec * 1000;
    const endTime = location.time_end_sec ? location.time_end_sec * 1000 : videoDuration;
    
    sections.push({
      id: location.id,
      name: location.name,
      startTime,
      endTime,
      type: 'location'
    });
  });
  
  return sections;
}

export function getCurrentSection(currentTime: number, sections: Section[]): Section | null {
  // First try to find an exact section match
  const exactSection = sections.find(section => 
    currentTime >= section.startTime && currentTime < section.endTime
  );
  
  if (exactSection) {
    return exactSection;
  }
  
  // If we're in a transition period, show the previous section's banner
  // Find the last section that has ended before current time
  const previousSection = sections
    .filter(section => currentTime >= section.endTime)
    .sort((a, b) => b.endTime - a.endTime)[0];
  
  return previousSection || null;
}

export function getNextSection(currentTime: number, sections: Section[]): Section | null {
  // Find the next section that starts after the current time
  const nextSection = sections.find(section => section.startTime > currentTime);
  return nextSection || null;
}

export function getPreviousSection(currentTime: number, sections: Section[]): Section | null {
  // Find the previous section that starts before the current time
  const previousSections = sections
    .filter(section => section.startTime < currentTime)
    .sort((a, b) => b.startTime - a.startTime);
  
  return previousSections[0] || null;
}

