import { Place } from '@/lib/api';
import { Star, CheckCircle, Camera, Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaceCardProps {
  place: Place;
  isSelected?: boolean;
  onToggleFavorite: (id: string) => void;
  onToggleVisited: (id: string) => void;
  onEnhance?: (place: Place) => void;
}

export const PlaceCard = ({
  place,
  isSelected,
  onToggleFavorite,
  onToggleVisited,
  onEnhance,
}: PlaceCardProps) => {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl bg-card border transition-all',
        isSelected ? 'border-primary shadow-md' : 'border-border hover:border-primary/50',
        place.needsEnhancement && 'border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-950/20'
      )}
    >
      {/* Image */}
      <div className="w-16 h-16 rounded-lg bg-secondary flex-shrink-0 flex items-center justify-center overflow-hidden relative">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-6 h-6 text-muted-foreground opacity-50" />
        )}
        {/* Enhance indicator */}
        {place.needsEnhancement && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground truncate">{place.name}</h3>
          {place.needsEnhancement && onEnhance && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEnhance(place);
              }}
              className="flex-shrink-0 px-2 py-0.5 text-xs bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Enhance
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{place.subtype || place.cuisine || place.type}</p>
        {place.isEvent && (place.startDate || place.endDate) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" />
            <span className={cn(
              place.endDate && new Date(place.endDate) < new Date(Date.now() + 7 * 86400000) && "text-orange-500 font-medium"
            )}>
              {place.startDate && place.endDate
                ? `${new Date(place.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(place.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : place.endDate
                  ? `Ends ${new Date(place.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : `Starts ${new Date(place.startDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              }
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(place.id);
          }}
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center transition-all',
            place.isFavorite ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
          )}
        >
          <Star className={cn('w-5 h-5', place.isFavorite && 'fill-current')} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisited(place.id);
          }}
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center transition-all',
            place.isVisited ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'
          )}
        >
          <CheckCircle className={cn('w-5 h-5', place.isVisited && 'fill-current')} />
        </button>
      </div>
    </div>
  );
};
