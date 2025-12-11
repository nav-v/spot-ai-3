import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LogOut, User, Settings, Loader2, Check, X, Camera, Instagram, Link2, Unlink, Sparkles, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { instagramApi, preferencesApi, InstagramAccount, UserPreferences } from '@/lib/api';
import { OnboardingFlow } from '@/components/Onboarding';
import { getPersonaById, PERSONAS } from '@/lib/personaCalculator';

interface UserProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


export function UserProfileSheet({ open, onOpenChange }: UserProfileSheetProps) {
    const { user, updateUser, logout } = useAuth();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [newPassword, setNewPassword] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');


    // Instagram linking state - now supports multiple accounts
    const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
    const [igLoading, setIgLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState<string | null>(null);
    const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);

    // Onboarding quiz state
    const [showQuiz, setShowQuiz] = useState(false);
    const [onboardingPrefs, setOnboardingPrefs] = useState<UserPreferences | null>(null);
    const [prefsLoading, setPrefsLoading] = useState(false);

    // Sync form state when user data changes
    React.useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setAvatarUrl(user.avatarUrl || '');
        }
    }, [user]);

    // Load Instagram accounts and onboarding prefs when sheet opens
    useEffect(() => {
        if (open && user) {
            loadInstagramAccounts();
            loadOnboardingPrefs();
        }
    }, [open, user]);

    const loadOnboardingPrefs = async () => {
        setPrefsLoading(true);
        try {
            const prefs = await preferencesApi.get();
            setOnboardingPrefs(prefs);
        } catch (error) {
            console.error('Failed to load onboarding prefs:', error);
        }
        setPrefsLoading(false);
    };

    const handleQuizComplete = async () => {
        setShowQuiz(false);
        // Reload preferences after quiz completion
        await loadOnboardingPrefs();
        toast({ title: 'Preferences updated!', description: 'Your recommendations will now be more personalized.' });
    };

    const loadInstagramAccounts = async () => {
        try {
            const accounts = await instagramApi.getLinkedAccounts();
            setIgAccounts(accounts);
        } catch (error) {
            console.error('Failed to load Instagram accounts:', error);
        }
    };

    const handleGenerateCode = async () => {
        setIgLoading(true);
        try {
            const result = await instagramApi.generateCode();
            setVerificationCode(result.code);
            setCodeExpiry(new Date(result.expiresAt));
            toast({ title: 'Code generated!', description: 'DM this code to @save.this.spot on Instagram' });
        } catch (error: any) {
            toast({ title: 'Error', description: 'Could not generate code', variant: 'destructive' });
        }
        setIgLoading(false);
    };

    const handleUnlinkInstagram = async (accountId: string, username: string) => {
        setIgLoading(true);
        try {
            await instagramApi.unlinkAccount(accountId);
            setIgAccounts(igAccounts.filter(a => a.id !== accountId));
            toast({ title: 'Instagram unlinked', description: `@${username} has been disconnected.` });
        } catch (error: any) {
            toast({ title: 'Error', description: 'Could not unlink Instagram', variant: 'destructive' });
        }
        setIgLoading(false);
    };

    const copyCodeToClipboard = () => {
        if (verificationCode) {
            navigator.clipboard.writeText(verificationCode);
            toast({ title: 'Copied!', description: 'Code copied to clipboard' });
        }
    };

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


    const handleLogout = async () => {
        await logout();
        onOpenChange(false);
    };

    if (!user) return null;

    // Show quiz fullscreen when active
    if (showQuiz) {
        return (
            <OnboardingFlow
                onComplete={handleQuizComplete}
                onSkip={() => setShowQuiz(false)}
            />
        );
    }

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

                    {/* Your Vibe Section - Onboarding Quiz Results */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Your Vibe
                            </h3>
                        </div>

                        {prefsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : onboardingPrefs?.onboardingCompleted ? (
                            // Show persona results
                            <div className="space-y-4">
                                {/* Primary Persona */}
                                {onboardingPrefs.primaryPersona && (
                                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-3xl">
                                                {getPersonaById(onboardingPrefs.primaryPersona)?.emoji || '✨'}
                                            </span>
                                            <div>
                                                <p className="font-semibold text-foreground">
                                                    {getPersonaById(onboardingPrefs.primaryPersona)?.name || 'Explorer'}
                                                </p>
                                                {onboardingPrefs.secondaryPersona && (
                                                    <p className="text-xs text-muted-foreground">
                                                        + {getPersonaById(onboardingPrefs.secondaryPersona)?.emoji} {getPersonaById(onboardingPrefs.secondaryPersona)?.name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {getPersonaById(onboardingPrefs.primaryPersona)?.description}
                                        </p>
                                    </div>
                                )}

                                {/* Key tags */}
                                {onboardingPrefs.allTags && onboardingPrefs.allTags.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Your preferences:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {onboardingPrefs.allTags
                                                .filter(tag => !tag.startsWith('dietary:'))
                                                .slice(0, 12)
                                                .map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground"
                                                    >
                                                        {tag.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dietary */}
                                {(onboardingPrefs.dietaryVegetarian || onboardingPrefs.dietaryVegan || 
                                  onboardingPrefs.dietaryHalal || onboardingPrefs.dietaryGlutenFree) && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">Dietary:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {onboardingPrefs.dietaryVegetarian && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">🌱 Vegetarian</span>
                                            )}
                                            {onboardingPrefs.dietaryVegan && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">🌿 Vegan</span>
                                            )}
                                            {onboardingPrefs.dietaryHalal && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">✓ Halal</span>
                                            )}
                                            {onboardingPrefs.dietaryGlutenFree && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">🌾 Gluten-free</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Retake Quiz Button */}
                                <button
                                    onClick={() => setShowQuiz(true)}
                                    className="w-full py-2.5 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Retake Quiz
                            </button>
                        </div>
                        ) : (
                            // No quiz taken yet
                            <div className="text-center py-6 space-y-4">
                                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-primary" />
                                </div>
                        <div>
                                    <p className="font-medium text-foreground mb-1">Personalize your experience</p>
                                    <p className="text-sm text-muted-foreground">
                                        Take a quick quiz so Spot can learn your vibe and give better recommendations.
                                    </p>
                                </div>
                                    <button
                                    onClick={() => setShowQuiz(true)}
                                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Take the Quiz
                                    </button>
                            </div>
                        )}
                    </div>

                    {/* Instagram Linking */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <Instagram className="w-4 h-4" />
                                Instagram Integration
                            </h3>
                        </div>

                        <p className="text-sm text-muted-foreground">
                            Link your Instagram to save places by DM. Send any Reel or restaurant link to @save.this.spot!
                        </p>

                        {/* Linked Accounts */}
                        {igAccounts.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Linked accounts:</p>
                                {igAccounts.map((account) => (
                                    <div key={account.id} className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                                                <Instagram className="w-4 h-4 text-white" />
                                            </div>
                        <div>
                                                <p className="font-medium text-foreground text-sm">@{account.username || 'Instagram'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Linked {new Date(account.linkedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    <button
                                            onClick={() => handleUnlinkInstagram(account.id, account.username)}
                                            disabled={igLoading}
                                            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                            title="Unlink"
                                        >
                                            <Unlink className="w-4 h-4" />
                                    </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Verification Code */}
                        {verificationCode ? (
                            <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-xl p-4 space-y-3 border border-purple-500/20">
                                <p className="text-sm font-medium text-foreground">Your verification code:</p>
                                <div 
                                    onClick={copyCodeToClipboard}
                                    className="bg-background rounded-lg p-4 text-center cursor-pointer hover:bg-secondary transition-colors"
                                >
                                    <p className="text-2xl font-mono font-bold tracking-wider text-foreground">{verificationCode}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Tap to copy</p>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>📱 Open Instagram and DM this code to <strong>@save.this.spot</strong></p>
                                    {codeExpiry && (
                                        <p className="text-orange-500">⏰ Expires {codeExpiry.toLocaleTimeString()}</p>
                                    )}
                        </div>
                                    <button
                                    onClick={handleGenerateCode}
                                    disabled={igLoading}
                                    className="w-full py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors text-sm"
                                >
                                    Generate new code
                                    </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleGenerateCode}
                                disabled={igLoading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                {igLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Link2 className="w-4 h-4" />
                                        {igAccounts.length > 0 ? 'Link Another Instagram' : 'Link Instagram'}
                                    </>
                                )}
                            </button>
                        )}

                        <div className="text-xs text-muted-foreground space-y-1">
                            <p><strong>How it works:</strong></p>
                            <ol className="list-decimal list-inside space-y-0.5">
                                <li>Click "Link Instagram" to get a code</li>
                                <li>DM the code to @save.this.spot</li>
                                <li>Then send any restaurant link to save it!</li>
                            </ol>
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

