import React, { useState, useRef, useEffect } from 'react';
import { Sun, Cloud, CloudRain, Snowflake, RefreshCw, Plus, Check, MapPin, Loader2, ExternalLink } from 'lucide-react';
import { DraggableScrollContainer } from './DraggableScrollContainer';

interface WeatherData {
  temp: number;
  feels_like: number;
  conditions: string;
  icon: string;
  spot_quip: string;
}

interface DigestRecommendation {
  id: string;
  name: string;
  type: string;
  description: string;
  location: string;
  imageUrl?: string;
  website?: string;
  rating?: number;
  isEvent: boolean;
  startDate?: string;
  endDate?: string;
  mainCategory: 'eat' | 'see';
  subtype: string;
  recommendedDishes?: string[];
  sources?: Array<{ domain: string; url: string }>;
  timeframe?: 'today' | 'tomorrow' | 'weekend';
}

interface DigestData {
  id: string;
  greeting: string;
  weather: WeatherData;
  intro_text: string;
  recommendations: DigestRecommendation[]; // First 15
  next_batch?: DigestRecommendation[]; // Preloaded next 6
  shown_ids: string[];
  created_at: string;
}

interface DigestCarouselProps {
  digest: DigestData;
  savedPlaceNames: Set<string>;
  onAddPlace: (place: DigestRecommendation) => Promise<void>;
  onLoadMore: () => Promise<DigestRecommendation[]>;
  onAskSpot: () => void;
}

function getWeatherIcon(icon: string) {
  if (icon.startsWith('01') || icon.startsWith('02')) return <Sun className="w-5 h-5 text-yellow-400" />;
  if (icon.startsWith('09') || icon.startsWith('10')) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (icon.startsWith('13')) return <Snowflake className="w-5 h-5 text-blue-200" />;
  return <Cloud className="w-5 h-5 text-slate-400" />;
}

export function DigestCarousel({ 
  digest, 
  savedPlaceNames, 
  onAddPlace, 
  onLoadMore,
  onAskSpot 
}: DigestCarouselProps) {
  // Start with first 15 recommendations
  const [visibleRecs, setVisibleRecs] = useState(digest.recommendations.slice(0, 15));
  // Preloaded next batch (from the digest)
  const [preloadedBatch, setPreloadedBatch] = useState<DigestRecommendation[]>(digest.next_batch || []);
  // Track all shown IDs to avoid duplicates
  const [shownIds, setShownIds] = useState<Set<string>>(new Set(digest.recommendations.slice(0, 15).map(r => r.id)));
  const [isLoading, setIsLoading] = useState(false);
  const [addingPlaces, setAddingPlaces] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleShowMore = async () => {
    // Save the index where new cards will appear (where "Show More" card currently is)
    const firstNewCardIndex = visibleRecs.length;
    
    // First, use preloaded batch if available (instant)
    if (preloadedBatch.length > 0) {
      const newRecs = preloadedBatch.filter(rec => !shownIds.has(rec.id));
      if (newRecs.length > 0) {
        setVisibleRecs(prev => [...prev, ...newRecs]);
        setShownIds(prev => {
          const next = new Set(prev);
          newRecs.forEach(r => next.add(r.id));
          return next;
        });
        setPreloadedBatch([]); // Clear preloaded batch
        
        // Scroll to the first new card (which replaces "Show More" position)
        setTimeout(() => {
          if (scrollRef.current) {
            // Find the first new card element and scroll it into view
            const container = scrollRef.current;
            const cards = container.querySelectorAll('[data-digest-card]');
            const firstNewCard = cards[firstNewCardIndex];
            if (firstNewCard) {
              firstNewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }
          }
        }, 100);
        
        // Preload more in background (for next click)
        onLoadMore().then(more => {
          if (more.length > 0) {
            setPreloadedBatch(more);
          } else {
            setHasMore(false);
          }
        }).catch(() => {});
        
        return; // Don't show loading since it was instant
      }
    }
    
    // No preloaded batch, fetch now
    setIsLoading(true);
    try {
      const more = await onLoadMore();
      if (more.length > 0) {
        const newRecs = more.filter(rec => !shownIds.has(rec.id));
        if (newRecs.length > 0) {
          setVisibleRecs(prev => [...prev, ...newRecs]);
          setShownIds(prev => {
            const next = new Set(prev);
            newRecs.forEach(r => next.add(r.id));
            return next;
          });
          
          // Scroll to the first new card (which replaces "Show More" position)
          setTimeout(() => {
            if (scrollRef.current) {
              const container = scrollRef.current;
              const cards = container.querySelectorAll('[data-digest-card]');
              const firstNewCard = cards[firstNewCardIndex];
              if (firstNewCard) {
                firstNewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
              }
            }
          }, 100);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlace = async (place: DigestRecommendation) => {
    if (savedPlaceNames.has(place.name.toLowerCase())) return;
    
    setAddingPlaces(prev => new Set(prev).add(place.id));
    try {
      await onAddPlace(place);
    } finally {
      setAddingPlaces(prev => {
        const next = new Set(prev);
        next.delete(place.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Header: Greeting + Weather */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{digest.greeting}</h1>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {getWeatherIcon(digest.weather.icon)}
          <span className="text-sm font-medium">{digest.weather.temp}°</span>
        </div>
      </div>

      {/* Intro - more compact */}
      <p className="text-sm text-muted-foreground leading-snug">{digest.intro_text}</p>

      {/* Carousel */}
      <div className="relative w-screen -ml-4">
        <DraggableScrollContainer
          ref={scrollRef}
          className="pb-2 flex gap-3 px-4 snap-x snap-mandatory scroll-smooth scrollbar-hide"
        >
          {visibleRecs.map((place, idx) => {
            const isSaved = savedPlaceNames.has(place.name.toLowerCase());
            const isAdding = addingPlaces.has(place.id);

            return (
              <div key={place.id || idx} data-digest-card className="min-w-[70%] sm:min-w-[260px] sm:w-[260px] bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all snap-center flex flex-col">
                {/* Image Area */}
                <div className="h-32 w-full bg-muted relative overflow-hidden group">
                  {place.imageUrl ? (
                    <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                      <MapPin className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                    {place.location}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm leading-tight text-foreground line-clamp-2">{place.name}</h3>
                    {place.rating && (
                      <div className="flex items-center gap-0.5 bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ml-1">
                        <span>★</span>
                        <span>{place.rating}</span>
                      </div>
                    )}
                  </div>

                  {place.isEvent && place.startDate && (
                    <p className="text-[11px] text-primary font-medium mb-1">
                      📅 {new Date(place.startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground flex-1 mb-2">
                    {place.description}
                  </p>

                  {place.recommendedDishes && place.recommendedDishes.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/80 mb-1.5">
                      <span className="font-medium">Try:</span> {place.recommendedDishes.slice(0, 2).join(' · ')}
                    </p>
                  )}

                  {place.sources && place.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-muted-foreground/60">via</span>
                      {place.sources.slice(0, 2).map((source, i) => {
                        const domain = typeof source === 'string' ? source : source.domain;
                        const url = typeof source === 'string' ? `https://${source}` : source.url;
                        return (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={domain}>
                            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt={domain} className="w-3.5 h-3.5 rounded-sm opacity-70 hover:opacity-100" />
                          </a>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto">
                    {place.website && (
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-[11px] py-2 rounded-lg font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Website
                      </a>
                    )}
                    <button
                      onClick={() => handleAddPlace(place)}
                      disabled={isSaved || isAdding}
                      className={`${place.website ? 'flex-1' : 'w-full'} flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg font-medium ${
                        isSaved ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : isSaved ? <><Check className="w-3 h-3" /> Saved</> : <><Plus className="w-3 h-3" /> Add</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show More Card */}
          {hasMore && (
            <div className="min-w-[60%] sm:min-w-[200px] sm:w-[200px] bg-secondary/10 border border-border/50 rounded-xl flex flex-col items-center justify-center p-5 snap-center">
              <RefreshCw className={`w-7 h-7 text-muted-foreground/40 mb-3 ${isLoading ? 'animate-spin' : ''}`} />
              <p className="text-xs text-muted-foreground text-center mb-3">More options?</p>
              <button
                onClick={handleShowMore}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Show More'}
              </button>
            </div>
          )}
        </DraggableScrollContainer>
      </div>

      {/* CTA */}
      <p className="text-xs text-muted-foreground">
        Ask me to plan, find, or add food, places and events
        <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full ml-1 align-middle" style={{ animation: 'pulse-fast 0.4s ease-in-out infinite' }} />
      </p>
    </div>
  );
}
