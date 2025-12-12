
import { useState, useMemo } from 'react';
import { Place, placesApi } from '@/lib/api';
import { X, Star, CheckCircle, MapPin, Camera, Upload, Trash2, Sparkles, Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { 
    EAT_SUBTYPES, 
    SEE_SUBTYPES, 
    EVENT_SUBTYPES,
    type MainCategory 
} from '@/lib/placeCategories';
import { InstagramEmbed } from './InstagramEmbed';

interface PlaceDetailModalProps {
    place: Place;
    onClose: () => void;
    onToggleFavorite: (id: string) => void;
    onToggleVisited: (id: string) => void;
    onUpdate?: () => void;
    onEnhance?: (place: Place) => void;
}

export const PlaceDetailModal = ({
    place,
    onClose,
    onToggleFavorite,
    onToggleVisited,
    onUpdate,
    onEnhance,
}: PlaceDetailModalProps) => {
    const [name, setName] = useState(place.name);
    // New category system
    const [mainCategory, setMainCategory] = useState<MainCategory>(place.mainCategory || 'eat');
    const [subtype, setSubtype] = useState(place.subtype || '');
    const [customSubtype, setCustomSubtype] = useState('');
    const [showSubtypeDropdown, setShowSubtypeDropdown] = useState(false);
    
    const [description, setDescription] = useState(place.description || '');
    const [address, setAddress] = useState(place.address || '');
    const [rating, setRating] = useState<number>(place.rating || 0);
    const [notes, setNotes] = useState<string>(place.notes || '');
    const [review, setReview] = useState<string>(place.review || '');
    const [isEvent, setIsEvent] = useState(place.isEvent || false);
    const [startDate, setStartDate] = useState(place.startDate || '');
    const [endDate, setEndDate] = useState(place.endDate || '');

    // Filter out invalid images (logos, tiny images, etc.)
    const isValidImage = (url: string | null | undefined): boolean => {
        if (!url) return false;
        const invalidPatterns = ['logo', 'branding', 'favicon', '1x/', 'icon'];
        return !invalidPatterns.some(pattern => url.toLowerCase().includes(pattern));
    };

    const [uploadedImage, setUploadedImage] = useState<string | null>(
        isValidImage(place.imageUrl) ? place.imageUrl! : null
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const { toast } = useToast();

    // Get available subtypes based on main category and event status
    const availableSubtypes = useMemo(() => {
        if (mainCategory === 'eat') {
            return EAT_SUBTYPES;
        }
        if (isEvent) {
            return EVENT_SUBTYPES;
        }
        return SEE_SUBTYPES;
    }, [mainCategory, isEvent]);

    // Filter subtypes based on custom input
    const filteredSubtypes = useMemo(() => {
        if (!customSubtype) return availableSubtypes;
        return availableSubtypes.filter(s => 
            s.toLowerCase().includes(customSubtype.toLowerCase())
        );
    }, [availableSubtypes, customSubtype]);

    const handleMainCategoryChange = (newCategory: MainCategory) => {
        setMainCategory(newCategory);
        // Reset subtype when category changes
        setSubtype('');
        setCustomSubtype('');
        // If switching to Eat, turn off event mode
        if (newCategory === 'eat') {
            setIsEvent(false);
        }
    };

    const handleSubtypeSelect = (selected: string) => {
        setSubtype(selected);
        setCustomSubtype('');
        setShowSubtypeDropdown(false);
    };

    const handleCustomSubtypeChange = (value: string) => {
        setCustomSubtype(value);
        setSubtype(value); // Use custom value directly
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Determine legacy type for backwards compatibility
            const legacyType = mainCategory === 'eat' 
                ? (subtype === 'Coffee' ? 'cafe' : subtype === 'Bar' ? 'bar' : 'restaurant')
                : 'activity';

            const placeData = {
                    name: name || 'New Place',
                type: legacyType as any,
                mainCategory,
                subtype: subtype || 'Other',
                    description,
                    rating,
                    notes,
                    review,
                    imageUrl: uploadedImage || undefined,
                    address: address || '',
                    isEvent,
                    startDate: isEvent ? startDate : undefined,
                    endDate: isEvent ? endDate : undefined,
            };

            if (place.id === 'new') {
                await placesApi.create(placeData);
            } else {
                await placesApi.update(place.id, placeData);
            }
            toast({ title: 'Changes saved! ✨' });
            onUpdate?.();
            onClose();
        } catch (error) {
            console.error(error);
            toast({ title: 'Error saving changes', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (isConfirmingDelete) {
            try {
                await placesApi.delete(place.id);
                toast({ title: 'Place deleted 🗑️' });
                onUpdate?.();
                onClose();
            } catch (error) {
                toast({ title: 'Error deleting place', variant: 'destructive' });
            }
        } else {
            setIsConfirmingDelete(true);
            setTimeout(() => setIsConfirmingDelete(false), 3000);
        }
    };

    const handleMarkComplete = () => {
        onToggleVisited(place.id);
        if (!place.isVisited) {
            toast({ title: 'Marked as visited! 🎉', description: `You visited ${name} ` });
        }
    };

    const openInMaps = () => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-[2001] bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-xl animate-slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Image Section */}
                <div className="relative h-48 bg-secondary flex items-center justify-center">
                    {uploadedImage ? (
                        <img
                            src={uploadedImage}
                            alt={name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No photo yet</p>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex-1 space-y-2">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-xl font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none w-full transition-colors"
                                placeholder="Place Name"
                            />
                            
                            {/* Two-dropdown category system */}
                            <div className="flex gap-2 items-center">
                                {/* Main Category Dropdown (Eat/See) */}
                                <select
                                    value={mainCategory}
                                    onChange={(e) => handleMainCategoryChange(e.target.value as MainCategory)}
                                    className="text-sm font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-full outline-none cursor-pointer hover:bg-primary/20 transition-colors"
                                >
                                    <option value="eat">🍽️ Eat</option>
                                    <option value="see">👀 See</option>
                                </select>

                                <span className="text-muted-foreground">•</span>

                                {/* Subtype Combo-box (predefined + custom) */}
                                <div className="relative flex-1">
                                    <div className="relative">
                                <input
                                            value={customSubtype || subtype}
                                            onChange={(e) => handleCustomSubtypeChange(e.target.value)}
                                            onFocus={() => setShowSubtypeDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowSubtypeDropdown(false), 200)}
                                            className="text-sm text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors w-full pr-6"
                                            placeholder={mainCategory === 'eat' ? 'Cuisine (e.g. Italian)' : 'Type (e.g. Museum)'}
                                        />
                                        <ChevronDown 
                                            className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer"
                                            onClick={() => setShowSubtypeDropdown(!showSubtypeDropdown)}
                                        />
                                    </div>
                                    
                                    {/* Dropdown */}
                                    {showSubtypeDropdown && filteredSubtypes.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {filteredSubtypes.map((option) => (
                                                <button
                                                    key={option}
                                                    onMouseDown={() => handleSubtypeSelect(option)}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors",
                                                        subtype === option && "bg-primary/10 text-primary"
                                                    )}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                onClick={() => onToggleFavorite(place.id)}
                                className={cn(
                                    "p-2 rounded-full transition-colors",
                                    place.isFavorite ? "text-yellow-500 bg-yellow-50" : "text-muted-foreground bg-secondary"
                                )}
                            >
                                <Star className={cn("w-5 h-5", place.isFavorite && "fill-current")} />
                            </button>
                            <button
                                onClick={openInMaps}
                                className="p-2 rounded-full text-blue-500 bg-blue-50 transition-colors"
                            >
                                <MapPin className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Address */}
                    <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="text-sm text-muted-foreground mb-4 bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none w-full transition-colors"
                        placeholder="Address"
                    />

                    {/* Event Details - Only show for See category */}
                    {mainCategory === 'see' && (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="isEvent"
                                checked={isEvent}
                                onChange={(e) => setIsEvent(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                            />
                            <label htmlFor="isEvent" className="text-sm font-medium text-foreground cursor-pointer select-none flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                This is a temporary event
                            </label>
                        </div>

                        {isEvent && (
                            <div className="grid grid-cols-2 gap-3 pl-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full text-sm bg-secondary/50 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full text-sm bg-secondary/50 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Description */}
                    <div className="mb-4 p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3 h-3 text-yellow-500" />
                            <span className="text-xs font-medium text-muted-foreground">AI Summary</span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full text-sm leading-relaxed bg-transparent border-none focus:ring-0 p-0 resize-none text-foreground placeholder:text-muted-foreground/50"
                            rows={3}
                            placeholder="Add a summary..."
                        />
                    </div>

                    {/* Rating */}
                    <div className="mb-4">
                        <p className="text-sm font-medium text-foreground mb-2">Your Rating</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                        rating >= star ? "text-yellow-500" : "text-muted-foreground/30"
                                    )}
                                >
                                    <Star className={cn("w-6 h-6", rating >= star && "fill-current")} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Review Box */}
                    <div className="mb-4">
                        <p className="text-sm font-medium text-foreground mb-2">Your Review</p>
                        <textarea
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            placeholder="Write a quick review of your experience..."
                            className="w-full p-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Notes Box */}
                    <div className="mb-4">
                        <p className="text-sm font-medium text-foreground mb-2">Personal Notes</p>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add personal notes (what to order, who to bring, etc.)..."
                            className="w-full p-3 rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
                            rows={2}
                        />
                    </div>

                    {/* Instagram Post Embed */}
                    {place.instagramPostUrl && (
                        <div className="mb-6">
                            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                                Original Instagram Post
                            </p>
                            <InstagramEmbed url={place.instagramPostUrl} />
                            
                            {/* Enhance Button - below video for places that need it */}
                            {place.needsEnhancement && onEnhance && (
                                <button
                                    onClick={() => onEnhance(place)}
                                    className="w-full mt-3 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Add Places from this Reel
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* Enhance button without Instagram post */}
                    {place.needsEnhancement && !place.instagramPostUrl && onEnhance && (
                        <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
                            <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                                ✨ This place needs more info! Search for the real name to enhance it.
                            </p>
                            <button
                                onClick={() => onEnhance(place)}
                                className="w-full py-2.5 bg-orange-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
                            >
                                <Sparkles className="w-4 h-4" />
                                Enhance Place
                            </button>
                        </div>
                    )}

                    {/* Photo Upload */}
                    <div className="mb-6">
                        <p className="text-sm font-medium text-foreground mb-2">Photos</p>
                        <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors group">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                                <Upload className="w-6 h-6" />
                                <span className="text-sm font-medium">Upload a photo</span>
                            </div>
                        </label>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-3 mb-3 rounded-full font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>

                    {/* Mark Complete Button */}
                    <button
                        onClick={handleMarkComplete}
                        className={cn(
                            'w-full py-3 mb-3 rounded-full font-medium transition-all flex items-center justify-center gap-2',
                            place.isVisited
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-secondary text-foreground hover:bg-secondary/80'
                        )}
                    >
                        <CheckCircle className="w-5 h-5" />
                        {place.isVisited ? 'Visited ✓' : 'Mark as Visited'}
                    </button>

                    {/* Delete Button - Only show for existing places */}
                    {place.id !== 'new' && (
                        <button
                            onClick={handleDelete}
                            className={cn(
                                "w-full py-3 rounded-full font-medium transition-all flex items-center justify-center gap-2",
                                isConfirmingDelete
                                    ? "bg-red-500 text-white hover:bg-red-600"
                                    : "text-red-500 hover:bg-red-50"
                            )}
                        >
                            <Trash2 className="w-4 h-4" />
                            {isConfirmingDelete ? 'Click again to confirm' : 'Delete Place'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
