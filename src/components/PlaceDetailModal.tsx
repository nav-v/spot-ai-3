
import { useState } from 'react';
import { Place, placesApi } from '@/lib/api';
import { X, Star, CheckCircle, MapPin, Camera, Upload, ExternalLink, Trash2, Sparkles, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PlaceDetailModalProps {
    place: Place;
    onClose: () => void;
    onToggleFavorite: (id: string) => void;
    onToggleVisited: (id: string) => void;
    onUpdate?: () => void;
}

export const PlaceDetailModal = ({
    place,
    onClose,
    onToggleFavorite,
    onToggleVisited,
    onUpdate,
}: PlaceDetailModalProps) => {
    const [name, setName] = useState(place.name);
    const [type, setType] = useState(place.type);
    const [cuisine, setCuisine] = useState(place.cuisine || '');
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
            if (place.id === 'new') {
                await placesApi.create({
                    name: name || 'New Place',
                    type: type as any,
                    cuisine,
                    description,
                    rating,
                    notes,
                    review,
                    imageUrl: uploadedImage || undefined,
                    address: address || '',
                    sourceUrl: '',
                    isEvent,
                    startDate: isEvent ? startDate : undefined,
                    endDate: isEvent ? endDate : undefined,
                });
            } else {
                await placesApi.update(place.id, {
                    name,
                    type: type as any,
                    cuisine,
                    description,
                    rating,
                    notes,
                    review,
                    imageUrl: uploadedImage || undefined,
                    address: address,
                    isEvent,
                    startDate: isEvent ? startDate : undefined,
                    endDate: isEvent ? endDate : undefined,
                });
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
                            <div className="flex gap-2">
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as any)}
                                    className="text-sm text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors cursor-pointer"
                                >
                                    <option value="restaurant">Restaurant</option>
                                    <option value="cafe">Cafe</option>
                                    <option value="bar">Bar</option>
                                    <option value="activity">Activity</option>
                                    <option value="attraction">Attraction</option>
                                    <option value="museum">Museum</option>
                                    <option value="park">Park</option>
                                    <option value="shopping">Shopping</option>
                                    <option value="theater">Theater</option>
                                    <option value="other">Other</option>
                                </select>
                                <span className="text-muted-foreground">•</span>
                                <input
                                    value={cuisine}
                                    onChange={(e) => setCuisine(e.target.value)}
                                    className="text-sm text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-colors w-full"
                                    placeholder="Filter (e.g. Italian)"
                                />
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

                    {/* Event Details */}
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

                    {/* Photo Upload - Moved Here */}
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

                    {/* Delete Button */}
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

