import React, { useState } from 'react';
import { Sun, Cloud, CloudRain, Snowflake, RefreshCw, Plus, Check, MapPin, Loader2 } from 'lucide-react';
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const excludedIds = recommendations.map(r => r.id);
      const excludedNames = recommendations.map(r => r.name);
      const newRecs = await onRefresh(excludedIds, excludedNames);
      if (newRecs.length > 0) {
        setRecommendations(newRecs);
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
    <div className="space-y-4">
      {/* Header: Greeting + Weather */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{digest.greeting}</h1>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {getWeatherIcon(digest.weather.icon)}
          <span className="text-sm font-medium">{digest.weather.temp}°</span>
        </div>
      </div>

      {/* Intro */}
      <p className="text-sm text-muted-foreground">{digest.intro_text}</p>

      {/* Carousel - EXACT same structure as ChatInterface */}
      <div className="relative w-screen -ml-4">
        <DraggableScrollContainer
          className="pb-3 flex gap-3 px-4 snap-x snap-mandatory scroll-smooth scrollbar-hide"
        >
          {recommendations.map((place, idx) => {
            const isSaved = savedPlaceNames.has(place.name.toLowerCase());
            const isAdding = addingPlaces.has(place.id);

            return (
              <div key={place.id || idx} className="min-w-[65%] sm:min-w-[240px] sm:w-[240px] bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all snap-center flex flex-col">
                {/* Image Area */}
                <div className="h-36 w-full bg-muted relative overflow-hidden group">
                  {place.imageUrl ? (
                    <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                      <MapPin className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-medium">
                    {place.location}
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-sm leading-tight text-foreground mb-1">{place.name}</h3>

                  {place.isEvent && place.startDate && (
                    <p className="text-[10px] text-primary font-medium mb-1">
                      📅 {new Date(place.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}

                  {!place.isEvent && place.subtype && (
                    <p className="text-[10px] text-muted-foreground mb-1">{place.subtype}</p>
                  )}

                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-2">
                    {place.description}
                  </p>

                  {/* Sources */}
                  {place.sources && place.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-muted-foreground/60">via</span>
                      {place.sources.slice(0, 3).map((source, i) => (
                        <a
                          key={i}
                          href={source.url || `https://${source.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={source.domain}
                        >
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`}
                            alt={source.domain}
                            className="w-3.5 h-3.5 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddPlace(place)}
                    disabled={isSaved || isAdding}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-2 rounded-lg transition-colors font-medium shadow-sm ${
                      isSaved
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {isAdding ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isSaved ? (
                      <><Check className="w-3 h-3" /> Saved</>
                    ) : (
                      <><Plus className="w-3 h-3" /> Add to List</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Refresh Card */}
          <div className="min-w-[65%] sm:min-w-[240px] sm:w-[240px] bg-secondary/20 border border-border rounded-xl flex flex-col items-center justify-center p-6 snap-center">
            <RefreshCw className={`w-8 h-8 text-muted-foreground/40 mb-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <p className="text-xs text-muted-foreground text-center mb-3">Want more options?</p>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isRefreshing ? 'Loading...' : 'Show More'}
            </button>
          </div>
        </DraggableScrollContainer>
      </div>

      {/* CTA - Left justified with orange dot at end */}
      <p className="text-sm text-muted-foreground">
        Ask me to plan, find, or add food, places and events
        <span
          className="inline-block w-2 h-2 bg-orange-500 rounded-full ml-1.5 align-middle"
          style={{ animation: 'pulse-fast 0.4s ease-in-out infinite' }}
        />
      </p>
    </div>
  );
}
