import { useState } from 'react';
import { Place, placesApi } from '@/lib/api';
import { X, Search, Loader2, MapPin, Star, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface EnhanceModalProps {
  place: Place;
  isOpen: boolean;
  onClose: () => void;
  onEnhanced: (updatedPlace: Place) => void;
}

interface SearchResult {
  name: string;
  address: string;
  rating?: number;
  type?: string;
  imageUrl?: string;
}

export const EnhanceModal = ({ place, isOpen, onClose, onEnhanced }: EnhanceModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleEnhance = async () => {
    if (!selectedResult) return;
    
    setIsEnhancing(true);
    setError(null);
    
    try {
      const updatedPlace = await placesApi.enhance(place.id, selectedResult.name);
      onEnhanced(updatedPlace);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to enhance place. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResult(null);
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
              <p className="text-xs text-muted-foreground mt-1 italic">{place.notes}</p>
            )}
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
                  Select the correct place:
                </p>
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedResult(result)}
                    className={cn(
                      'w-full p-3 rounded-xl border text-left transition-all',
                      selectedResult === result
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground truncate">{result.name}</h4>
                          {selectedResult === result && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
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
                      </div>
                    </div>
                  </button>
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

          {/* Footer */}
          {selectedResult && (
            <div className="p-4 border-t border-border bg-secondary/30">
              <button
                onClick={handleEnhance}
                disabled={isEnhancing}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Use "{selectedResult.name}"
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

