import React, { useState, useEffect } from 'react';
import { X, MapPin, Star, ExternalLink, Navigation, ChevronLeft, ChevronRight, Plus, Check, Loader2 } from 'lucide-react';

interface RecommendationData {
  name: string;
  description?: string;
  location?: string;
  address?: string;
  imageUrl?: string;
  website?: string;
  rating?: number;
  isEvent?: boolean;
  startDate?: string;
  endDate?: string;
  recommendedDishes?: string[];
  sources?: Array<{ domain: string; url: string }> | string[];
  // For fetching more photos
  placeId?: string;
}

interface RecommendationModalProps {
  place: RecommendationData | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (place: RecommendationData) => Promise<void>;
  isSaved: boolean;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export function RecommendationModal({ place, isOpen, onClose, onAdd, isSaved }: RecommendationModalProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch additional photos when modal opens
  useEffect(() => {
    if (isOpen && place) {
      setCurrentPhotoIndex(0);
      // Start with the existing image
      const initialPhotos = place.imageUrl ? [place.imageUrl] : [];
      setPhotos(initialPhotos);
      
      // Fetch more photos from our API
      fetchAdditionalPhotos(place.name, place.location || place.address || 'New York');
    }
  }, [isOpen, place]);

  const fetchAdditionalPhotos = async (name: string, location: string) => {
    setIsLoadingPhotos(true);
    try {
      const response = await fetch('/api/places/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location })
      });
      const data = await response.json();
      if (data.photos && data.photos.length > 0) {
        setPhotos(data.photos);
      }
    } catch (error) {
      console.error('Failed to fetch photos:', error);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhotoIndex(prev => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleAdd = async () => {
    if (!place || isSaved) return;
    setIsAdding(true);
    try {
      await onAdd(place);
    } finally {
      setIsAdding(false);
    }
  };

  const getGoogleMapsUrl = () => {
    if (!place) return '';
    const query = encodeURIComponent(`${place.name} ${place.address || place.location || ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  const getStaticMapUrl = () => {
    if (!place || !GOOGLE_MAPS_API_KEY) return null;
    const query = encodeURIComponent(`${place.name} ${place.address || place.location || 'New York'}`);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${query}&zoom=15&size=400x200&maptype=roadmap&markers=color:red%7C${query}&key=${GOOGLE_MAPS_API_KEY}`;
  };

  if (!isOpen || !place) return null;

  const staticMapUrl = getStaticMapUrl();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-background w-full sm:w-[480px] max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[90vh] sm:max-h-[85vh]">
          {/* Photo carousel */}
          <div className="relative h-64 sm:h-72 bg-muted">
            {photos.length > 0 ? (
              <>
                <img 
                  src={photos[currentPhotoIndex]} 
                  alt={place.name} 
                  className="w-full h-full object-cover"
                />
                {/* Photo navigation */}
                {photos.length > 1 && (
                  <>
                    <button 
                      onClick={handlePrevPhoto}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleNextPhoto}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    {/* Photo dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {photos.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx); }}
                          className={`w-2 h-2 rounded-full transition-all ${idx === currentPhotoIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/70'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
                {isLoadingPhotos && (
                  <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading photos...
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                <MapPin className="w-12 h-12 text-muted-foreground/30" />
              </div>
            )}
            
            {/* Location badge */}
            {(place.location || place.address) && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium">
                📍 {place.location || place.address}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{place.name}</h2>
                {place.isEvent && place.startDate && (
                  <p className="text-sm text-primary font-medium mt-1">
                    📅 {new Date(place.startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    {place.endDate && place.endDate !== place.startDate && (
                      <> - {new Date(place.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</>
                    )}
                  </p>
                )}
              </div>
              {place.rating && (
                <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded-lg text-sm font-bold flex-shrink-0">
                  <Star className="w-4 h-4 fill-current" />
                  <span>{place.rating}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {place.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{place.description}</p>
            )}

            {/* Recommended dishes */}
            {place.recommendedDishes && place.recommendedDishes.length > 0 && (
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs font-medium text-foreground mb-1">🍽️ Recommended Dishes</p>
                <p className="text-sm text-muted-foreground">{place.recommendedDishes.join(' · ')}</p>
              </div>
            )}

            {/* Sources */}
            {place.sources && place.sources.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Sources:</span>
                {place.sources.map((source, i) => {
                  const domain = typeof source === 'string' ? source : source.domain;
                  const url = typeof source === 'string' ? `https://${source}` : source.url;
                  return (
                    <a 
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-secondary/50 hover:bg-secondary px-2 py-1 rounded-md text-xs text-muted-foreground transition-colors"
                    >
                      <img 
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                        alt={domain}
                        className="w-3 h-3 rounded-sm"
                      />
                      {domain}
                    </a>
                  );
                })}
              </div>
            )}

            {/* Map */}
            {staticMapUrl ? (
              <a 
                href={getGoogleMapsUrl()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
              >
                <img 
                  src={staticMapUrl} 
                  alt="Map location" 
                  className="w-full h-32 object-cover"
                />
                <div className="bg-secondary/30 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tap to open in Google Maps</span>
                  <Navigation className="w-4 h-4 text-muted-foreground" />
                </div>
              </a>
            ) : (
              <a 
                href={getGoogleMapsUrl()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-secondary/30 hover:bg-secondary/50 rounded-lg p-4 transition-colors"
              >
                <Navigation className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Open in Google Maps</span>
              </a>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground py-3 rounded-xl font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Website
                </a>
              )}
              <button
                onClick={handleAdd}
                disabled={isSaved || isAdding}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
                  isSaved 
                    ? 'bg-secondary text-muted-foreground cursor-not-allowed' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved to List
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add to List
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

