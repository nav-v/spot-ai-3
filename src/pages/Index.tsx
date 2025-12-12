import { useState, useEffect } from 'react';
import { MapView } from '@/components/MapView';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceDetailModal } from '@/components/PlaceDetailModal';
import { ChatInterface } from '@/components/ChatInterface';
import { EnhanceModal } from '@/components/EnhanceModal';
import { placesApi, preferencesApi, Place } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { eatCategories, seeCategories } from '@/data/categories';
import { useAuth } from '@/components/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { UserAvatar } from '@/components/UserAvatar';
import { UserProfileSheet } from '@/components/UserProfileSheet';
import { OnboardingFlow } from '@/components/Onboarding';
import {
  Search, MessageCircle, MapPin, Utensils, Heart, CheckCircle, Plus, Loader2,
  // Food icons
  Pizza, Fish, Sandwich, IceCream, Salad, Coffee, Flame, Soup, Beef, Croissant,
  Egg, Wine, Star, Zap, Truck, UtensilsCrossed, Apple, Carrot, Leaf,
  // Activity icons
  Building, Building2, Trees, Landmark, Image, Music, ShoppingBag, ShoppingCart,
  Eye, Clock, Waves, Map, Trophy, Dog, BookOpen, Moon, GraduationCap, Lock,
  Gamepad2, Circle, Flower2, Telescope, Footprints, Ship, Theater, Laugh,
  // Additional icons
  Sparkles, Calendar, PartyPopper, Smile, Drama
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'spot' | 'see' | 'eat';

// Icon mapping for dynamic rendering
const iconMap: Record<string, any> = {
  // Food icons
  Pizza, Fish, Sandwich, IceCream, Salad, Coffee, Flame, Soup, Beef, Croissant,
  Egg, Wine, Star, Zap, Truck, UtensilsCrossed, Apple, Carrot, Leaf, Utensils,
  Taco: Flame, Pasta: UtensilsCrossed, Bowl: Soup, Martini: Wine,
  // Default food
  Plate: Utensils,

  // Activity icons
  Building, Building2, Trees, Landmark, Image, Music, ShoppingBag, ShoppingCart,
  Eye, Clock, Waves, Map, Trophy, Dog, BookOpen, Moon, GraduationCap, Lock,
  Gamepad2, Circle, Flower: Flower2, Telescope, Footprints, Ship,
  Drama, Theater, Laugh, Bridge: Landmark, Heart,
  // Event & additional icons
  Sparkles, Calendar, PartyPopper, Smile, MapPin,
  // Default activity
  Target: Circle,
};

const Index = () => {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailModalPlace, setDetailModalPlace] = useState<Place | null>(null);
  const [enhanceModalPlace, setEnhanceModalPlace] = useState<Place | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('spot');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { toast } = useToast();

  // Check if user needs onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      if (isAuthenticated) {
        try {
          const needsOnboarding = await preferencesApi.needsOnboarding();
          setShowOnboarding(needsOnboarding);
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          setShowOnboarding(false); // Don't block on error
        }
      }
    };
    checkOnboarding();
  }, [isAuthenticated]);

  // Get categories that actually have matching places
  const getAvailableCategories = () => {
    // Filter places by mainCategory (with fallback to legacy type)
    const tabPlaces = places.filter((place) => {
      if (activeTab === 'eat') {
        return place.mainCategory === 'eat' || ['restaurant', 'cafe', 'bar'].includes(place.type);
      }
      if (activeTab === 'todo') {
        return place.mainCategory === 'see' || !['restaurant', 'cafe', 'bar'].includes(place.type);
      }
      return true;
    });

    const allCategories = activeTab === 'eat' ? eatCategories : seeCategories;

    // Match by subtype (primary), then fallback to cuisine/type/name
    return allCategories.filter((category) =>
      tabPlaces.some((place) =>
        place.subtype?.toLowerCase() === category.id.toLowerCase() ||
        place.cuisine?.toLowerCase() === category.id.toLowerCase() ||
        place.type?.toLowerCase() === category.id.toLowerCase()
      )
    );
  };

  const currentCategories = getAvailableCategories();

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          // Validate coordinates before setting
          if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
            setUserLocation({ lat, lng });
          toast({ title: 'Location found!', description: 'Showing spots near you' });
          } else {
            toast({ title: 'Location error', description: 'Invalid coordinates received', variant: 'destructive' });
          }
        },
        (error) => {
          toast({ title: 'Location error', description: error.message, variant: 'destructive' });
        }
      );
    }
  };

  const fetchPlaces = async () => {
    try {
      const data = await placesApi.getAll();
      setPlaces(data);
    } catch (error) {
      console.error('Error fetching places:', error);
      toast({ title: 'Error loading places', description: 'Make sure the server is running on port 3001', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlaces();
    getUserLocation();

    // Poll for updates every 5 seconds (simple alternative to real-time)
    const interval = setInterval(fetchPlaces, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter places based on tab and filters
  const filteredPlaces = places.filter((place) => {
    // Filter by mainCategory (with fallback to legacy type)
    if (activeTab === 'eat') {
      const isEat = place.mainCategory === 'eat' || ['restaurant', 'cafe', 'bar'].includes(place.type);
      if (!isEat) return false;
    }
    if (activeTab === 'see') {
      const isSee = place.mainCategory === 'see' || !['restaurant', 'cafe', 'bar'].includes(place.type);
      if (!isSee) return false;
    }
    
    // Filter by visited status
    if (showCompleted && !place.isVisited) return false;
    if (!showCompleted && place.isVisited) return false;
    
    // Filter by category (subtype matching)
    if (activeFilter) {
      const filterLower = activeFilter.toLowerCase();
      const matchesSubtype = place.subtype?.toLowerCase() === filterLower;
      const matchesCuisine = place.cuisine?.toLowerCase() === filterLower;
      const matchesType = place.type?.toLowerCase() === filterLower;
      // Also match if subtype contains the filter (for partial matches)
      const subtypeContains = place.subtype?.toLowerCase().includes(filterLower);
      if (!matchesSubtype && !matchesCuisine && !matchesType && !subtypeContains) return false;
    }
    
    // Filter by search query
    if (searchQuery && !place.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleToggleFavorite = async (id: string) => {
    const place = places.find((p) => p.id === id);
    if (!place) return;

    await placesApi.update(id, { isFavorite: !place.isFavorite });
    setPlaces((prev) => prev.map((p) => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  };

  const handleToggleVisited = async (id: string) => {
    const place = places.find((p) => p.id === id);
    if (!place) return;

    await placesApi.update(id, { isVisited: !place.isVisited });
    setPlaces((prev) => prev.map((p) => p.id === id ? { ...p, isVisited: !p.isVisited } : p));
    toast({ title: place.isVisited ? 'Marked as not visited' : 'Marked as visited!' });
  };

  const handleAddPlace = () => {
    const newPlace: Place = {
      id: 'new',
      name: '',
      type: activeTab === 'eat' ? 'restaurant' : 'activity',
      address: '',
      isFavorite: true,
      isVisited: false,
      createdAt: new Date().toISOString(),
      description: '',
      cuisine: '',
      imageUrl: '',
      sourceUrl: '',
      notes: '',
      review: '',
      rating: 0,
    };
    setDetailModalPlace(newPlace);
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show onboarding if needed (null = still checking)
  if (showOnboarding === null) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
        onLinkInstagram={() => setProfileSheetOpen(true)}
      />
    );
  }

  return (
    <>
      {/* User Profile Sheet */}
      <UserProfileSheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen} />

      {/* Spot View - Persisted */}
      <div className={cn("h-[100dvh] flex flex-col overflow-hidden bg-background", activeTab !== 'spot' && "hidden")}>
        <div className="bg-card border-b border-border px-3 sm:px-4 py-3 flex-shrink-0" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('spot')}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition-all bg-primary text-primary-foreground whitespace-nowrap min-w-0"
            >
              <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">Spot</span>
            </button>
            <button
              onClick={() => setActiveTab('see')}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:bg-secondary whitespace-nowrap min-w-0"
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate hidden xs:inline">Things to </span><span className="truncate">See</span>
            </button>
            <button
              onClick={() => setActiveTab('eat')}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:bg-secondary whitespace-nowrap min-w-0"
            >
              <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate hidden xs:inline">Things to </span><span className="truncate">Eat</span>
            </button>
            <UserAvatar onClick={() => setProfileSheetOpen(true)} />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatInterface onPlaceAdded={fetchPlaces} />
        </div>
      </div>

      {/* List View */}
      <div className={cn("min-h-[100dvh] bg-background flex flex-col", activeTab === 'spot' && "hidden")}>
        {/* Top Navigation */}
        <div className="bg-card border-b border-border px-3 sm:px-4 py-3 sticky top-0 z-50" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
            <button
              onClick={() => setActiveTab('spot')}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:bg-secondary whitespace-nowrap min-w-0"
            >
              <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">Spot</span>
            </button>
            <button
              onClick={() => setActiveTab('see')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-w-0',
                activeTab === 'see' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate hidden xs:inline">Things to </span><span className="truncate">See</span>
            </button>
            <button
              onClick={() => setActiveTab('eat')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-w-0',
                activeTab === 'eat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate hidden xs:inline">Things to </span><span className="truncate">Eat</span>
            </button>
            <UserAvatar onClick={() => setProfileSheetOpen(true)} />
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search your liked..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
        </div>

        {/* Map Section */}
        <div className="h-[375px] relative z-0">
          <MapView
            places={filteredPlaces}
            selectedPlaceId={selectedPlace?.id}
            onPinClick={(place) => setDetailModalPlace(place)}
            userLocation={userLocation}
            onLocateMe={getUserLocation}
          />
        </div>

        {/* Liked/Completed Toggle */}
        <div className="bg-card border-t border-border px-4 py-3 rounded-t-3xl -mt-6 relative z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex gap-2">
            <button
              onClick={() => setShowCompleted(false)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium transition-all',
                !showCompleted ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              )}
            >
              <Heart className="w-4 h-4" />
              <span>Liked</span>
            </button>
            <button
              onClick={() => setShowCompleted(true)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium transition-all',
                showCompleted ? 'bg-green-500 text-white' : 'bg-secondary text-muted-foreground'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Completed</span>
            </button>
            <button
              onClick={handleAddPlace}
              className="w-10 h-10 flex-shrink-0 rounded-full bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        {currentCategories.length > 0 && (
          <div className="bg-card border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">
              {activeTab === 'eat' ? 'Cuisine Type' : 'Activity Type'}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {currentCategories.map((category) => {
                const defaultIcon = activeTab === 'eat' ? Utensils : Circle;
                const IconComponent = iconMap[category.icon] || defaultIcon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveFilter(activeFilter === category.id ? null : category.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 min-w-[55px] transition-all',
                      activeFilter === category.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      activeFilter === category.id ? 'bg-primary/20' : 'bg-secondary'
                    )}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-center">{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Places Section */}
        <div className="bg-card border-t border-border px-4 py-3 flex-1 overflow-y-auto">
          <p className="text-sm font-medium text-foreground mb-3">
            {showCompleted ? 'Visited Places' : 'Liked Spots Near You'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              {showCompleted ? 'No completed places yet' : 'No liked places found'}
            </p>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredPlaces.map((place) => (
                <div
                  key={place.id}
                  onClick={() => setDetailModalPlace(place)}
                  className="cursor-pointer"
                >
                  <PlaceCard
                    place={place}
                    isSelected={selectedPlace?.id === place.id}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleVisited={handleToggleVisited}
                    onEnhance={(p) => setEnhanceModalPlace(p)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {detailModalPlace && (
          <PlaceDetailModal
            place={detailModalPlace}
            onClose={() => setDetailModalPlace(null)}
            onToggleFavorite={handleToggleFavorite}
            onToggleVisited={handleToggleVisited}
            onUpdate={fetchPlaces}
            onEnhance={(place) => {
              setDetailModalPlace(null); // Close detail modal
              setEnhanceModalPlace(place); // Open enhance modal
            }}
          />
        )}

        {/* Enhance Modal */}
        {enhanceModalPlace && (
          <EnhanceModal
            place={enhanceModalPlace}
            isOpen={!!enhanceModalPlace}
            onClose={() => setEnhanceModalPlace(null)}
            onEnhanced={(updatedPlace) => {
              // Update the place in the list
              setPlaces(prev => prev.map(p => 
                p.id === updatedPlace.id ? updatedPlace : p
              ));
              setEnhanceModalPlace(null);
              toast({
                title: 'Place enhanced!',
                description: `Updated to "${updatedPlace.name}"`,
              });
            }}
          />
        )}
      </div>
    </>
  );
};

export default Index;
