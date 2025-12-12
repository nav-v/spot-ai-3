import { useState } from 'react';
import { Place, placesApi } from '@/lib/api';
import { X, Search, Loader2, MapPin, Star, Check, Sparkles, Plus, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface EnhanceModalProps {
  place: Place;
  isOpen: boolean;
  onClose: () => void;
  onEnhanced: (updatedPlace: Place) => void;
  // Optional: for multi-add (like from a "Top 10" reel)
  onAddMultiple?: (places: SearchResult[]) => void;
}

interface SearchResult {
  name: string;
  address: string;
  rating?: number;
  type?: string;
  imageUrl?: string;
}

export const EnhanceModal = ({ place, isOpen, onClose, onEnhanced, onAddMultiple }: EnhanceModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<SearchResult[]>([]); // Multi-select!
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedPlaces, setAddedPlaces] = useState<string[]>([]); // Track what we've added

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    
    try {
      const results = await placesApi.searchPlaces(searchQuery, 'New York, NY');
      setSearchResults(results);
      if (results.length === 0) {
        setError('No places found. Try a different search term.');
      }
    } catch (err) {
      setError('Failed to search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle selection of a result
  const toggleSelection = (result: SearchResult) => {
    const isSelected = selectedResults.some(r => r.name === result.name && r.address === result.address);
    if (isSelected) {
      setSelectedResults(selectedResults.filter(r => r.name !== result.name || r.address !== result.address));
    } else {
      setSelectedResults([...selectedResults, result]);
    }
  };

  // Check if a result is selected
  const isSelected = (result: SearchResult) => {
    return selectedResults.some(r => r.name === result.name && r.address === result.address);
  };

  // Check if a result was already added
  const isAdded = (result: SearchResult) => {
    return addedPlaces.includes(`${result.name}|${result.address}`);
  };

  const handleEnhance = async () => {
    if (selectedResults.length === 0) return;
    
    setIsEnhancing(true);
    setError(null);
    
    try {
      // If only one selected, enhance the current place
      if (selectedResults.length === 1) {
        const updatedPlace = await placesApi.enhance(place.id, selectedResults[0].name);
        onEnhanced(updatedPlace);
        onClose();
      } else {
        // Multiple selected - enhance first one, add others as new places
        const [first, ...rest] = selectedResults;
        const updatedPlace = await placesApi.enhance(place.id, first.name);
        onEnhanced(updatedPlace);
        
        // If onAddMultiple is provided, use it to add the rest
        if (onAddMultiple && rest.length > 0) {
          onAddMultiple(rest);
        }
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enhance place. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Add a single place without closing the modal
  const handleAddOne = async (result: SearchResult) => {
    if (isAdded(result)) return;
    
    try {
      // Create a new place with this result
      await placesApi.create({
        name: result.name,
        address: result.address,
        type: 'restaurant',
        mainCategory: 'eat',
        subtype: result.type || 'Restaurant',
        subtypes: [],
        isVisited: false,
        isFavorite: true,
        imageUrl: result.imageUrl,
        rating: result.rating,
      });
      
      setAddedPlaces([...addedPlaces, `${result.name}|${result.address}`]);
    } catch (err: any) {
      setError(`Failed to add ${result.name}`);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResults([]);
    setAddedPlaces([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Enhance Place</h2>
                <p className="text-xs text-muted-foreground">Find the real info for this place</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Current place info */}
          <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border-b border-border">
            <p className="text-sm text-muted-foreground mb-1">Currently saved as:</p>
            <p className="font-medium text-foreground">{place.name}</p>
            {place.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                Original caption: {place.notes.replace('Original caption: ', '').replace('Original mention: ', '')}
              </p>
            )}
            <p className="text-xs text-primary mt-2 font-medium">
              💡 Tip: Search for each place and tap + to add multiple from a "Top 10" reel!
            </p>
          </div>

          {/* Search input */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter the real restaurant name..."
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Tap a place to select, or tap + to add it immediately:
                </p>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-xl border transition-all',
                      isSelected(result)
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : isAdded(result)
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt={result.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <button 
                        onClick={() => toggleSelection(result)}
                        className="flex-1 min-w-0 text-left"
                        disabled={isAdded(result)}
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground truncate">{result.name}</h4>
                          {isSelected(result) && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                          {isAdded(result) && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {result.rating && (
                            <span className="flex items-center gap-1 text-xs">
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              {result.rating}
                            </span>
                          )}
                          {result.type && (
                            <span className="text-xs text-muted-foreground">{result.type}</span>
                          )}
                        </div>
                      </button>
                      
                      {/* Quick Add Button */}
                      {!isAdded(result) && (
                        <button
                          onClick={() => handleAddOne(result)}
                          className="flex-shrink-0 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors"
                          title="Add this place"
                        >
                          <Plus className="w-5 h-5 text-primary-foreground" />
                        </button>
                      )}
                      {isAdded(result) && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSearching && searchResults.length === 0 && !error && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Search for the real name of this place</p>
                <p className="text-xs mt-1">e.g., "Lucali Brooklyn" or "Joe's Pizza"</p>
              </div>
            )}
          </div>

          {/* Footer - shows count of added places */}
          <div className="p-4 border-t border-border bg-secondary/30">
            {addedPlaces.length > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 mb-3">
                <CheckCircle2 className="w-4 h-4" />
                {addedPlaces.length} place{addedPlaces.length > 1 ? 's' : ''} added!
              </div>
            )}
            
            {selectedResults.length > 0 ? (
              <button
                onClick={handleEnhance}
                disabled={isEnhancing}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {selectedResults.length === 1 
                      ? `Use "${selectedResults[0].name}"`
                      : `Save ${selectedResults.length} selected places`
                    }
                  </>
                )}
              </button>
            ) : addedPlaces.length > 0 ? (
              <button
                onClick={handleClose}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium"
              >
                Done
              </button>
            ) : (
              <p className="text-xs text-center text-muted-foreground">
                Search for places and tap + to add them
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

