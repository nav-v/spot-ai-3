import React, { useState, useRef } from 'react';
import { Cloud, CloudRain, Sun, Snowflake, Wind, CloudSun, RefreshCw, Plus, Check, Calendar, MapPin, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
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
  timeframe?: 'today' | 'tomorrow' | 'weekend' | 'week';
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
  const iconMap: Record<string, React.ReactNode> = {
    '01d': <Sun className="w-8 h-8 text-yellow-400" />,
    '01n': <Sun className="w-8 h-8 text-yellow-200" />,
    '02d': <CloudSun className="w-8 h-8 text-yellow-300" />,
    '02n': <CloudSun className="w-8 h-8 text-slate-300" />,
    '03d': <Cloud className="w-8 h-8 text-slate-400" />,
    '03n': <Cloud className="w-8 h-8 text-slate-400" />,
    '04d': <Cloud className="w-8 h-8 text-slate-500" />,
    '04n': <Cloud className="w-8 h-8 text-slate-500" />,
    '09d': <CloudRain className="w-8 h-8 text-blue-400" />,
    '09n': <CloudRain className="w-8 h-8 text-blue-400" />,
    '10d': <CloudRain className="w-8 h-8 text-blue-500" />,
    '10n': <CloudRain className="w-8 h-8 text-blue-500" />,
    '11d': <Wind className="w-8 h-8 text-purple-400" />,
    '11n': <Wind className="w-8 h-8 text-purple-400" />,
    '13d': <Snowflake className="w-8 h-8 text-blue-200" />,
    '13n': <Snowflake className="w-8 h-8 text-blue-200" />,
    '50d': <Cloud className="w-8 h-8 text-slate-300" />,
    '50n': <Cloud className="w-8 h-8 text-slate-300" />,
  };
  return iconMap[icon] || <Sun className="w-8 h-8 text-yellow-400" />;
}

function getTimeframeBadge(timeframe?: string) {
  switch (timeframe) {
    case 'today':
      return { label: 'Today', className: 'bg-green-500/90 text-white' };
    case 'tomorrow':
      return { label: 'Tomorrow', className: 'bg-blue-500/90 text-white' };
    case 'weekend':
      return { label: 'This Weekend', className: 'bg-purple-500/90 text-white' };
    case 'week':
      return { label: 'This Week', className: 'bg-orange-500/90 text-white' };
    default:
      return null;
  }
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
        // Scroll back to start
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
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

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Greeting + Weather */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground mb-1">{digest.greeting}</h1>
          <p className="text-muted-foreground text-sm">{digest.weather.spot_quip}</p>
        </div>
        <div className="flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-2xl px-4 py-2 border border-border/50">
          {getWeatherIcon(digest.weather.icon)}
          <div className="text-right">
            <div className="text-2xl font-semibold text-foreground">{digest.weather.temp}°</div>
            <div className="text-xs text-muted-foreground capitalize">{digest.weather.conditions}</div>
          </div>
        </div>
      </div>

      {/* Spot's Intro */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <p className="text-foreground/90 text-sm leading-relaxed">
          {digest.intro_text}
        </p>
      </div>

      {/* Carousel */}
      <div className="relative">
        {/* Navigation Arrows - Hidden on mobile */}
        <button
          onClick={() => scrollCarousel('left')}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 bg-background/90 backdrop-blur-md border border-border rounded-full items-center justify-center shadow-lg hover:bg-background transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => scrollCarousel('right')}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 bg-background/90 backdrop-blur-md border border-border rounded-full items-center justify-center shadow-lg hover:bg-background transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Scrollable Container */}
        <DraggableScrollContainer
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
        >
          {recommendations.map((rec, idx) => {
            const isSaved = savedPlaceNames.has(rec.name.toLowerCase());
            const isAdding = addingPlaces.has(rec.id);
            const timeframeBadge = getTimeframeBadge(rec.timeframe);

            return (
              <div
                key={rec.id || idx}
                className="min-w-[75%] sm:min-w-[260px] sm:w-[260px] bg-background border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all snap-center flex flex-col"
              >
                {/* Image Area */}
                <div className="h-36 w-full bg-muted relative overflow-hidden group">
                  {rec.imageUrl ? (
                    <img 
                      src={rec.imageUrl} 
                      alt={rec.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <MapPin className="w-12 h-12 text-primary/30" />
                    </div>
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {rec.isBumped && (
                      <span className="bg-yellow-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                        📌 Saved
                      </span>
                    )}
                    {timeframeBadge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${timeframeBadge.className}`}>
                        {timeframeBadge.label}
                      </span>
                    )}
                  </div>

                  {/* Location Badge */}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-full font-medium">
                    {rec.location}
                  </div>

                  {/* Category Badge */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      rec.mainCategory === 'eat' 
                        ? 'bg-orange-500/90 text-white' 
                        : 'bg-blue-500/90 text-white'
                    }`}>
                      {rec.mainCategory === 'eat' ? '🍽️' : '👀'} {rec.subtype}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-1">
                    {rec.name}
                  </h3>
                  
                  {rec.isEvent && rec.startDate && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(rec.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-3">
                    {rec.description}
                  </p>

                  {/* Sources */}
                  {rec.sources && rec.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-muted-foreground/60">via</span>
                      {rec.sources.slice(0, 3).map((source, i) => (
                        <a
                          key={i}
                          href={source.url || `https://${source.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={source.domain}
                          className="flex items-center justify-center"
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
                    onClick={() => handleAddPlace(rec)}
                    disabled={isSaved || isAdding}
                    className={`w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-colors font-medium ${
                      isSaved
                        ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {isAdding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Add to List
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Refresh Card */}
          <div className="min-w-[75%] sm:min-w-[260px] sm:w-[260px] bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 snap-center">
            <RefreshCw className={`w-10 h-10 text-primary/60 mb-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <h3 className="font-semibold text-sm text-foreground mb-1 text-center">
              Want more options?
            </h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
              I'll find fresh picks just for you
            </p>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? 'Finding more...' : 'Refresh Feed'}
            </button>
          </div>
        </DraggableScrollContainer>
      </div>

      {/* Ask Spot CTA */}
      <div className="text-center pt-2">
        <p className="text-muted-foreground text-sm mb-3">
          Not what you're looking for? Tell me what you want!
        </p>
        <button
          onClick={onAskSpot}
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm font-medium"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Ask Spot anything...
        </button>
      </div>
    </div>
  );
}

