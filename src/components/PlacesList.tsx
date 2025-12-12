import { Place, TabType, FilterType } from '@/types/places';
import { PlaceCard } from './PlaceCard';
import { MapPin } from 'lucide-react';

interface PlacesListProps {
  places: Place[];
  activeTab: TabType;
  activeFilter: FilterType;
  selectedPlaceId?: string;
  onSelectPlace: (place: Place) => void;
  onToggleFavorite: (id: string) => void;
  onToggleVisited: (id: string) => void;
  onDelete: (id: string) => void;
}

export const PlacesList = ({
  places,
  activeTab,
  activeFilter,
  selectedPlaceId,
  onSelectPlace,
  onToggleFavorite,
  onToggleVisited,
  onDelete,
}: PlacesListProps) => {
  const filteredPlaces = places.filter((place) => {
    // Filter by tab using new main_category system
    if (activeTab === 'completed' && !place.isVisited) return false;
    if (activeTab === 'eat' && place.mainCategory !== 'eat') return false;
    if (activeTab === 'todo' && place.mainCategory !== 'see') return false;
    // For non-completed tabs, exclude visited items
    if (activeTab !== 'completed' && place.isVisited) return false;

    // Filter by subtype (or legacy type for backwards compatibility)
    if (activeFilter !== 'all') {
      // Check if filter matches subtype or legacy type
      const matchesSubtype = place.subtype?.toLowerCase() === activeFilter.toLowerCase();
      const matchesType = place.type === activeFilter;
      // Special filter for events
      const matchesEvent = activeFilter === 'event' && place.isEvent;
      if (!matchesSubtype && !matchesType && !matchesEvent) return false;
    }

    return true;
  });

  if (filteredPlaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <MapPin className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No places found</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Share a link in the chat to add places!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
      </p>
      {filteredPlaces.map((place, index) => (
        <div
          key={place.id}
          className="animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <PlaceCard
            place={place}
            isSelected={selectedPlaceId === place.id}
            onSelect={() => onSelectPlace(place)}
            onToggleFavorite={() => onToggleFavorite(place.id)}
            onToggleVisited={() => onToggleVisited(place.id)}
            onDelete={() => onDelete(place.id)}
          />
        </div>
      ))}
    </div>
  );
};
