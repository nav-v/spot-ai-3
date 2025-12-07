import React, { useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LogOut, User, Settings, Heart, Utensils, Loader2, Check, X, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DIETARY_OPTIONS = [
    'Vegetarian',
    'Vegan',
    'Halal',
    'Kosher',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Pescatarian',
];

const INTEREST_OPTIONS = [
    'Art & Museums',
    'Music & Concerts',
    'History',
    'Outdoors & Parks',
    'Nightlife',
    'Shopping',
    'Food Tours',
    'Sports',
    'Theater & Shows',
    'Architecture',
];

const FOOD_PREFERENCE_OPTIONS = [
    'Spicy',
    'Sweet',
    'Savory',
    'Healthy',
    'Indulgent',
    'Adventurous',
    'Comfort Food',
    'Fine Dining',
    'Casual',
    'Street Food',
];

export function UserProfileSheet({ open, onOpenChange }: UserProfileSheetProps) {
    const { user, updateUser, updatePreferences, logout } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

    const [dietary, setDietary] = useState<string[]>(user?.preferences?.dietaryRestrictions || []);
    const [interests, setInterests] = useState<string[]>(user?.preferences?.interests || []);
    const [foodPrefs, setFoodPrefs] = useState<string[]>(user?.preferences?.foodPreferences || []);

    // Sync form state when user data changes
    React.useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setAvatarUrl(user.avatarUrl || '');
            setDietary(user.preferences?.dietaryRestrictions || []);
            setInterests(user.preferences?.interests || []);
            setFoodPrefs(user.preferences?.foodPreferences || []);
        }
    }, [user]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast({ title: 'Image too large', description: 'Please choose an image under 2MB', variant: 'destructive' });
            return;
        }

        // Convert to base64 for storage
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            setAvatarUrl(base64);

            // Auto-save avatar immediately
            try {
                await updateUser({ avatarUrl: base64 });
                toast({ title: 'Profile photo updated!' });
            } catch (error) {
                console.error('Failed to save avatar:', error);
                toast({ title: 'Failed to save photo', variant: 'destructive' });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const updates: any = { name, email, avatarUrl };
            if (newPassword.trim()) {
                updates.password = newPassword;
            }
            await updateUser(updates);
            setNewPassword('');
            setIsEditing(false);
            toast({ title: 'Profile updated!' });
        } catch (error) {
            toast({ title: 'Error saving profile', variant: 'destructive' });
        }
        setIsSaving(false);
    };

    const handleSavePreferences = async () => {
        setIsSaving(true);
        try {
            await updatePreferences({
                dietaryRestrictions: dietary,
                interests: interests,
                foodPreferences: foodPrefs,
            });
            toast({ title: 'Preferences saved!' });
        } catch (error) {
            toast({ title: 'Error saving preferences', variant: 'destructive' });
        }
        setIsSaving(false);
    };

    const toggleItem = (item: string, list: string[], setList: (items: string[]) => void) => {
        if (list.includes(item)) {
            setList(list.filter((i) => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const handleLogout = async () => {
        await logout();
        onOpenChange(false);
    };

    if (!user) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Your Profile
                    </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Profile Photo */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 overflow-hidden flex items-center justify-center">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={user.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-3xl font-semibold text-primary">
                                        {user.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">Tap to change photo</p>
                    </div>

                    {/* Profile Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Account Settings
                            </h3>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-sm text-primary hover:underline"
                                >
                                    Edit
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="p-1 rounded hover:bg-secondary"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="p-1 rounded hover:bg-secondary text-primary"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-sm text-muted-foreground">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground disabled:opacity-70"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="Add your email"
                                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground disabled:opacity-70"
                                />
                            </div>
                            {isEditing && (
                                <div>
                                    <label className="text-sm text-muted-foreground">
                                        New Password (leave blank to keep current)
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preferences Section */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <Heart className="w-4 h-4" />
                                Your Preferences
                            </h3>
                            <button
                                onClick={handleSavePreferences}
                                disabled={isSaving}
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    'Save'
                                )}
                            </button>
                        </div>

                        {/* Dietary Restrictions */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">
                                Dietary Restrictions
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {DIETARY_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => toggleItem(option, dietary, setDietary)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${dietary.includes(option)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Interests */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">
                                Interests (for events & things to see)
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {INTEREST_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => toggleItem(option, interests, setInterests)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${interests.includes(option)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Food Preferences */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-1">
                                <Utensils className="w-3 h-3" />
                                Food Preferences
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {FOOD_PREFERENCE_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => toggleItem(option, foodPrefs, setFoodPrefs)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${foodPrefs.includes(option)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <div className="pt-4 border-t border-border">
                        <button
                            onClick={handleLogout}
                            className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Log Out
                        </button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
