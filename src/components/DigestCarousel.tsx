import React, { useState, useRef } from 'react';
import { Sun, Cloud, CloudRain, Snowflake, RefreshCw, Plus, Check, Calendar, MapPin, Loader2, Sparkles } from 'lucide-react';
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
  isEvent: boolean;
  startDate?: string;
  endDate?: string;
  mainCategory: 'eat' | 'see';
  subtype: string;
  sources?: Array<{ domain: string; url: string }>;
  isBumped?: boolean;
  timeframe?: 'today' | 'tomorrow' | 'weekend';
}

interface DigestData {
  id: string;
  greeting: string;
  weather: WeatherData;
  intro_text: string;
  recommendations: DigestRecommendation[];
  shown_ids: string[];
  created_at: string;
}

interface DigestCarouselProps {
  digest: DigestData;
  savedPlaceNames: Set<string>;
  onAddPlace: (place: DigestRecommendation) => Promise<void>;
  onRefresh: (excludedIds: string[], excludedNames: string[]) => Promise<DigestRecommendation[]>;
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
  onRefresh,
  onAskSpot 
}: DigestCarouselProps) {
  const [recommendations, setRecommendations] = useState(digest.recommendations);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addingPlaces, setAddingPlaces] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const excludedIds = recommendations.map(r => r.id);
      const excludedNames = recommendations.map(r => r.name);
      const newRecs = await onRefresh(excludedIds, excludedNames);
      if (newRecs.length > 0) {
        setRecommendations(newRecs);
        scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      }
    } finally {
      setIsRefreshing(false);
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
    <div className="space-y-5 pb-4">
      {/* Compact Header: Greeting + Weather inline */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{digest.greeting}</h1>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {getWeatherIcon(digest.weather.icon)}
          <span className="text-sm font-medium">{digest.weather.temp}°</span>
        </div>
      </div>

      {/* Spot's one-liner */}
      <p className="text-sm text-muted-foreground">{digest.intro_text}</p>

      {/* Simple Carousel */}
      <DraggableScrollContainer
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
      >
        {recommendations.map((rec, idx) => {
          const isSaved = savedPlaceNames.has(rec.name.toLowerCase());
          const isAdding = addingPlaces.has(rec.id);

          return (
            <div
              key={rec.id || idx}
              className="min-w-[70%] sm:min-w-[220px] sm:w-[220px] bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all snap-center flex flex-col"
            >
              {/* Image */}
              <div className="h-32 w-full bg-muted relative overflow-hidden">
                {rec.imageUrl ? (
                  <img 
                    src={rec.imageUrl} 
                    alt={rec.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <MapPin className="w-8 h-8 text-primary/20" />
                  </div>
                )}
                
                {/* Single location badge */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                  {rec.location}
                </div>
              </div>

              {/* Content */}
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-medium text-sm text-foreground line-clamp-1 mb-0.5">
                  {rec.name}
                </h3>
                
                {/* Date for events OR subtype for food */}
                <p className="text-[11px] text-muted-foreground mb-2">
                  {rec.isEvent && rec.startDate ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(rec.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  ) : (
                    rec.subtype
                  )}
                </p>
                
                <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-2">
                  {rec.description}
                </p>

                {/* Sources */}
                {rec.sources && rec.sources.length > 0 && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[9px] text-muted-foreground/50">via</span>
                    {rec.sources.slice(0, 3).map((source, i) => (
                      <a
                        key={i}
                        href={source.url || `https://${source.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`}
                          alt={source.domain}
                          className="w-3 h-3 rounded-sm opacity-60 hover:opacity-100"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {/* Add Button */}
                <button
                  onClick={() => handleAddPlace(rec)}
                  disabled={isSaved || isAdding}
                  className={`w-full flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg font-medium transition-colors ${
                    isSaved
                      ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {isAdding ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isSaved ? (
                    <><Check className="w-3 h-3" /> Saved</>
                  ) : (
                    <><Plus className="w-3 h-3" /> Add</>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Refresh Card */}
        <div className="min-w-[70%] sm:min-w-[220px] sm:w-[220px] bg-gradient-to-br from-primary/5 to-transparent border border-border/50 rounded-xl flex flex-col items-center justify-center p-5 snap-center">
          <RefreshCw className={`w-8 h-8 text-primary/40 mb-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          <p className="text-xs text-muted-foreground text-center mb-3">More options?</p>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isRefreshing ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </DraggableScrollContainer>

      {/* Ask Spot CTA */}
      <div className="text-center">
        <button
          onClick={onAskSpot}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
          </span>
          Not what you're looking for? Ask me anything
        </button>
      </div>
    </div>
  );
}
