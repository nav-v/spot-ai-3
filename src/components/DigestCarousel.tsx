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
  // Preloaded next batch (6 more)
  const [nextBatch, setNextBatch] = useState<DigestRecommendation[]>(digest.next_batch || []);
  const [isLoading, setIsLoading] = useState(false);
  const [addingPlaces, setAddingPlaces] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleShowMore = async () => {
    setIsLoading(true);
    try {
      if (nextBatch.length > 0) {
        // Use preloaded batch (instant)
        setVisibleRecs(prev => [...prev, ...nextBatch]);
        setNextBatch([]);
        // Scroll to show new cards
        setTimeout(() => {
          scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
        }, 100);
        // Preload more in background
        onLoadMore().then(more => {
          if (more.length > 0) {
            setNextBatch(more);
          } else {
            setHasMore(false);
          }
        });
      } else {
        // No preloaded batch, load now
        const more = await onLoadMore();
        if (more.length > 0) {
          setVisibleRecs(prev => [...prev, ...more]);
          setTimeout(() => {
            scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
          }, 100);
        } else {
          setHasMore(false);
        }
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
              <div key={place.id || idx} className="min-w-[65%] sm:min-w-[220px] sm:w-[220px] bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all snap-center flex flex-col">
                {/* Image Area - shorter for mobile fit */}
                <div className="h-28 w-full bg-muted relative overflow-hidden group">
                  {place.imageUrl ? (
                    <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                      <MapPin className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                    {place.location}
                  </div>
                </div>

                {/* Content Area - more compact */}
                <div className="p-2.5 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className="font-semibold text-xs leading-tight text-foreground line-clamp-1">{place.name}</h3>
                    {place.rating && (
                      <div className="flex items-center gap-0.5 bg-yellow-500/10 text-yellow-600 px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0">
                        <span>★</span>
                        <span>{place.rating}</span>
                      </div>
                    )}
                  </div>

                  {place.isEvent && place.startDate && (
                    <p className="text-[9px] text-primary font-medium mb-1">
                      📅 {new Date(place.startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}

                  <p className="text-[10px] text-muted-foreground line-clamp-2 flex-1 mb-1.5">
                    {place.description}
                  </p>

                  {place.recommendedDishes && place.recommendedDishes.length > 0 && (
                    <p className="text-[9px] text-muted-foreground/80 mb-1">
                      <span className="font-medium">Try:</span> {place.recommendedDishes.slice(0, 2).join(' · ')}
                    </p>
                  )}

                  {place.sources && place.sources.length > 0 && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[8px] text-muted-foreground/60">via</span>
                      {place.sources.slice(0, 2).map((source, i) => {
                        const domain = typeof source === 'string' ? source : source.domain;
                        const url = typeof source === 'string' ? `https://${source}` : source.url;
                        return (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={domain}>
                            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt={domain} className="w-3 h-3 rounded-sm opacity-70 hover:opacity-100" />
                          </a>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-1.5 mt-auto">
                    {place.website && (
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 bg-secondary/50 hover:bg-secondary text-secondary-foreground text-[9px] py-1.5 rounded-lg font-medium"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Website
                      </a>
                    )}
                    <button
                      onClick={() => handleAddPlace(place)}
                      disabled={isSaved || isAdding}
                      className={`${place.website ? 'flex-1' : 'w-full'} flex items-center justify-center gap-1 text-[9px] py-1.5 rounded-lg font-medium ${
                        isSaved ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {isAdding ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : isSaved ? <><Check className="w-2.5 h-2.5" /> Saved</> : <><Plus className="w-2.5 h-2.5" /> Add</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Show More Card */}
          {hasMore && (
            <div className="min-w-[50%] sm:min-w-[160px] sm:w-[160px] bg-secondary/10 border border-border/50 rounded-xl flex flex-col items-center justify-center p-4 snap-center">
              <RefreshCw className={`w-6 h-6 text-muted-foreground/40 mb-2 ${isLoading ? 'animate-spin' : ''}`} />
              <p className="text-[10px] text-muted-foreground text-center mb-2">More options?</p>
              <button
                onClick={handleShowMore}
                disabled={isLoading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : nextBatch.length > 0 ? 'Show More' : 'Load More'}
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
