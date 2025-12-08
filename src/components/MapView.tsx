import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Place } from '@/lib/api';
import { Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  places: Place[];
  selectedPlaceId?: string;
  onPinClick: (place: Place) => void;
  userLocation?: { lat: number; lng: number } | null;
  onLocateMe?: () => void;
}

// Create custom marker with emoji icon - smaller size
const createCustomIcon = (emoji: string, color: string) => L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      position: relative;
      width: 18px;
      height: 28px;
    ">
      <svg viewBox="0 0 18 28" width="18" height="28" style="position: absolute; top: 0; left: 0;">
        <path d="M9 0C4.03 0 0 4.03 0 9c0 6.3 9 19 9 19s9-12.7 9-19C18 4.03 13.97 0 9 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
      <span style="
        position: absolute;
        top: 2px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 10px;
        line-height: 1;
      ">${emoji}</span>
    </div>
  `,
  iconSize: [18, 28],
  iconAnchor: [9, 28],
  popupAnchor: [0, -26],
});

// Orange markers for different place types
const placeIcons: Record<string, L.DivIcon> = {
  // Food
  restaurant: createCustomIcon('🍽️', '#F97316'),
  pizza: createCustomIcon('🍕', '#F97316'),
  indian: createCustomIcon('🍛', '#F97316'),
  chinese: createCustomIcon('🥡', '#F97316'),
  japanese: createCustomIcon('🍣', '#F97316'),
  korean: createCustomIcon('🍜', '#F97316'),
  thai: createCustomIcon('🍲', '#F97316'),
  mexican: createCustomIcon('🌮', '#F97316'),
  italian: createCustomIcon('🍝', '#F97316'),
  american: createCustomIcon('🍔', '#F97316'),
  mediterranean: createCustomIcon('🥙', '#F97316'),
  cafe: createCustomIcon('☕', '#F97316'),
  bakery: createCustomIcon('🥐', '#F97316'),
  bar: createCustomIcon('🍸', '#F97316'),
  dessert: createCustomIcon('🍰', '#F97316'),

  // Activities
  activity: createCustomIcon('🎯', '#F97316'),
  museum: createCustomIcon('🏛️', '#F97316'),
  park: createCustomIcon('🌳', '#F97316'),
  attraction: createCustomIcon('🎡', '#F97316'),
  theater: createCustomIcon('🎭', '#F97316'),
  movie: createCustomIcon('🎬', '#F97316'),
  music: createCustomIcon('🎵', '#F97316'),
  sports: createCustomIcon('⚽', '#F97316'),
  shopping: createCustomIcon('🛍️', '#F97316'),
  spa: createCustomIcon('💆', '#F97316'),

  // Default
  default: createCustomIcon('📍', '#F97316'),
};

// Green for visited places
const visitedIcon = createCustomIcon('✅', '#22C55E');

const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Component to fly to selected place or user location
function MapController({
  selectedPlace,
  userLocation
}: {
  selectedPlace: Place | null;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedPlace?.coordinates) {
      const { lat, lng } = selectedPlace.coordinates;
      if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
        map.flyTo([lat, lng], 15, {
          duration: 1,
        });
      }
    }
  }, [selectedPlace, map]);

  useEffect(() => {
    if (userLocation) {
      const { lat, lng } = userLocation;
      if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
        map.flyTo([lat, lng], 13, {
          duration: 1,
        });
      }
    }
  }, [userLocation, map]);

  return null;
}

// Component to fix map sizing issues
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and repeatedly
    const invalidate = () => {
      try {
        map?.invalidateSize();
      } catch (e) {
        console.log('Map invalidateSize error:', e);
      }
    };

    // Call multiple times at different intervals
    invalidate();
    const timers = [
      setTimeout(invalidate, 50),
      setTimeout(invalidate, 100),
      setTimeout(invalidate, 200),
      setTimeout(invalidate, 300),
      setTimeout(invalidate, 500),
      setTimeout(invalidate, 750),
      setTimeout(invalidate, 1000),
      setTimeout(invalidate, 1500),
      setTimeout(invalidate, 2000),
    ];

    // Handle window resize
    window.addEventListener('resize', invalidate);

    // Use ResizeObserver for container size changes (with fallback for older browsers)
    let resizeObserver: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== 'undefined') {
        const container = map?.getContainer();
        if (container) {
          resizeObserver = new ResizeObserver(() => {
            invalidate();
          });
          resizeObserver.observe(container);

          if (container.parentElement) {
            resizeObserver.observe(container.parentElement);
          }
        }
      }
    } catch (e) {
      console.log('ResizeObserver not supported:', e);
    }

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', invalidate);
      try {
        resizeObserver?.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [map]);

  return null;
}

export const MapView = ({
  places,
  selectedPlaceId,
  onPinClick,
  userLocation,
  onLocateMe,
}: MapViewProps) => {
  const selectedPlace = places.find(p => p.id === selectedPlaceId) || null;

  // Validate userLocation - must have valid numeric lat/lng
  const validUserLocation = userLocation && 
    typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) &&
    typeof userLocation.lng === 'number' && !isNaN(userLocation.lng)
    ? userLocation : null;

  // Default to NYC, or user location if available and valid
  const center: [number, number] = validUserLocation
    ? [validUserLocation.lat, validUserLocation.lng]
    : [40.7308, -73.9973];

  const getIcon = (place: Place) => {
    // Visited places get green checkmark
    if (place.isVisited) return visitedIcon;

    // Match by cuisine (lowercase)
    const cuisine = place.cuisine?.toLowerCase() || '';
    if (placeIcons[cuisine]) return placeIcons[cuisine];

    // Match by type
    const type = place.type?.toLowerCase() || '';
    if (placeIcons[type]) return placeIcons[type];

    // Food types get plate icon, activities get target icon
    if (['restaurant', 'cafe', 'bar'].includes(type)) {
      return placeIcons.restaurant;
    }
    if (['activity', 'attraction', 'museum', 'other'].includes(type)) {
      return placeIcons.activity;
    }

    // Default orange pin
    return placeIcons.default;
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
          url="https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=jOqKNMVRgmTPjJJDyvcq"
        />

        <MapController selectedPlace={selectedPlace} userLocation={validUserLocation} />
        <MapResizer />

        {/* User location marker */}
        {validUserLocation && (
          <>
            <Marker
              position={[validUserLocation.lat, validUserLocation.lng]}
              icon={userLocationIcon}
            >
              <Popup>You are here</Popup>
            </Marker>
            <Circle
              center={[validUserLocation.lat, validUserLocation.lng]}
              radius={200}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          </>
        )}

        {/* Place markers - only show places with valid numeric coordinates */}
        {places.filter(p => 
          p.coordinates && 
          typeof p.coordinates.lat === 'number' && !isNaN(p.coordinates.lat) &&
          typeof p.coordinates.lng === 'number' && !isNaN(p.coordinates.lng)
        ).map((place) => (
          <Marker
            key={place.id}
            position={[place.coordinates!.lat, place.coordinates!.lng]}
            icon={getIcon(place)}
            eventHandlers={{
              click: () => onPinClick(place),
            }}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-semibold text-sm">{place.name}</h3>
                {place.cuisine && (
                  <p className="text-xs text-gray-600">{place.cuisine}</p>
                )}
                <div className="flex gap-2 mt-1 text-xs">
                  {place.isFavorite && <span>⭐</span>}
                  {place.isVisited && <span>✅</span>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Locate Me Button */}
      {onLocateMe && (
        <button
          onClick={onLocateMe}
          className="absolute bottom-12 right-4 z-[1000] w-12 h-12 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Find my location"
        >
          <Navigation className="w-5 h-5 text-blue-500" />
        </button>
      )}
    </div>
  );
};
