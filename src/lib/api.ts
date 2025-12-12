// API client using Supabase for data + serverless functions for AI/scraping
import { supabase } from './supabase';

// Use relative URL for Vercel, localhost for development
const API_BASE = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

// User session management (simple token = userId for our custom auth)
let currentUserId: string | null = null;

export const setCurrentUser = (userId: string | null) => {
    currentUserId = userId;
    if (userId) {
        localStorage.setItem('spot_user_id', userId);
    } else {
        localStorage.removeItem('spot_user_id');
    }
};

export const getCurrentUserId = (): string | null => {
    if (currentUserId) return currentUserId;
    currentUserId = localStorage.getItem('spot_user_id');
    return currentUserId;
};

export interface User {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    avatarUrl: string;
    preferences: {
        dietaryRestrictions: string[];
        interests: string[];
        foodPreferences: string[];
    };
}

export interface Place {
    id: string;
    name: string;
    // Legacy type field - kept for backwards compatibility
    type: 'restaurant' | 'activity' | 'cafe' | 'bar' | 'attraction';
    // New category system
    mainCategory: 'eat' | 'see';
    subtype: string;
    subtypes?: string[];
    // Legacy cuisine field - now migrated to subtype
    cuisine?: string;
    address: string;
    description?: string;
    imageUrl?: string;
    sourceUrl?: string;
    coordinates?: { lat: number; lng: number } | null;
    isVisited: boolean;
    isFavorite: boolean;
    notes?: string;
    review?: string;
    rating?: number;
    createdAt: string;
    startDate?: string;
    endDate?: string;
    isEvent?: boolean;
    // Instagram integration
    needsEnhancement?: boolean;
    instagramPostUrl?: string;
}

// Helper to convert DB user to API user format
const dbUserToUser = (dbUser: any): User => ({
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email || '',
    isAdmin: dbUser.is_admin,
    avatarUrl: dbUser.avatar_url || '',
    preferences: {
        dietaryRestrictions: dbUser.dietary_restrictions || [],
        interests: dbUser.interests || [],
        foodPreferences: dbUser.food_preferences || [],
    },
});

// Helper to convert DB place to API place format
const dbPlaceToPlace = (dbPlace: any): Place => ({
    id: dbPlace.id,
    name: dbPlace.name,
    type: dbPlace.type,
    // New category fields with fallback for unmigrated data
    mainCategory: dbPlace.main_category || (
        ['restaurant', 'cafe', 'bar'].includes(dbPlace.type) ? 'eat' : 'see'
    ),
    subtype: dbPlace.subtype || dbPlace.cuisine || dbPlace.type || 'Other',
    subtypes: dbPlace.subtypes || [],
    cuisine: dbPlace.cuisine,
    address: dbPlace.address,
    description: dbPlace.description,
    imageUrl: dbPlace.image_url,
    sourceUrl: dbPlace.source_url,
    coordinates: dbPlace.coordinates,
    isVisited: dbPlace.is_visited,
    isFavorite: dbPlace.is_favorite,
    notes: dbPlace.notes,
    review: dbPlace.review,
    rating: dbPlace.rating,
    createdAt: dbPlace.created_at,
    startDate: dbPlace.start_date,
    endDate: dbPlace.end_date,
    isEvent: dbPlace.is_event,
    // Instagram integration
    needsEnhancement: dbPlace.needs_enhancement || false,
    instagramPostUrl: dbPlace.instagram_post_url,
});

// Auth API - uses Supabase for user lookup but simple password matching
export const authApi = {
    async login(password: string): Promise<{ token: string; user: User }> {
        // Find user by password
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error('Invalid password');
        }

        setCurrentUser(data.id);
        return {
            token: data.id, // Simple: use userId as token
            user: dbUserToUser(data),
        };
    },

    async logout(): Promise<void> {
        setCurrentUser(null);
    },

    async getUser(): Promise<User | null> {
        const userId = getCurrentUserId();
        if (!userId) return null;

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) return null;
        return dbUserToUser(data);
    },

    async updateUser(updates: Partial<User> & { password?: string }): Promise<User> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
        if (updates.password !== undefined) dbUpdates.password = updates.password;

        const { data, error } = await supabase
            .from('users')
            .update(dbUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error('Failed to update user');
        return dbUserToUser(data);
    },

    async updatePreferences(preferences: Partial<User['preferences']>): Promise<User> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const dbUpdates: any = {};
        if (preferences.dietaryRestrictions !== undefined) {
            dbUpdates.dietary_restrictions = preferences.dietaryRestrictions;
        }
        if (preferences.interests !== undefined) {
            dbUpdates.interests = preferences.interests;
        }
        if (preferences.foodPreferences !== undefined) {
            dbUpdates.food_preferences = preferences.foodPreferences;
        }

        const { data, error } = await supabase
            .from('users')
            .update(dbUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error('Failed to update preferences');
        return dbUserToUser(data);
    },
};

// Waitlist API - uses Supabase
export const waitlistApi = {
    async join(email: string): Promise<{ success: boolean; message: string }> {
        const { error } = await supabase
            .from('waitlist')
            .insert({ email });

        if (error) {
            if (error.code === '23505') { // Unique violation
                return { success: true, message: 'Already on waitlist' };
            }
            throw new Error('Failed to join waitlist');
        }
        return { success: true, message: 'Added to waitlist' };
    },
};

// Places API - uses Supabase
export const placesApi = {
    async getAll(): Promise<Place[]> {
        const userId = getCurrentUserId();
        if (!userId) return [];

        const { data, error } = await supabase
            .from('places')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching places:', error);
            return [];
        }
        return (data || []).map(dbPlaceToPlace);
    },

    async create(place: Partial<Place>): Promise<Place> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        // Determine mainCategory with fallback logic
        const mainCategory = place.mainCategory || (
            ['restaurant', 'cafe', 'bar'].includes(place.type || '') ? 'eat' : 'see'
        );
        // Determine subtype with fallback logic
        const subtype = place.subtype || place.cuisine || 
            (place.type === 'cafe' ? 'Coffee' : place.type === 'bar' ? 'Bar' : 'Restaurant');

        const dbPlace = {
            id: Date.now().toString(),
            user_id: userId,
            name: place.name,
            type: place.type || 'restaurant',
            main_category: mainCategory,
            subtype: subtype,
            subtypes: place.subtypes || [],
            cuisine: place.cuisine,
            address: place.address || '',
            description: place.description,
            image_url: place.imageUrl,
            source_url: place.sourceUrl,
            coordinates: place.coordinates,
            is_visited: place.isVisited || false,
            is_favorite: place.isFavorite !== false,
            notes: place.notes,
            review: place.review,
            rating: place.rating,
            start_date: place.startDate,
            end_date: place.endDate,
            is_event: place.isEvent || false,
            // Instagram integration
            needs_enhancement: place.needsEnhancement || false,
            instagram_post_url: place.instagramPostUrl,
        };

        const { data, error } = await supabase
            .from('places')
            .insert(dbPlace)
            .select()
            .single();

        if (error) throw new Error('Failed to create place');
        return dbPlaceToPlace(data);
    },

    async update(id: string, updates: Partial<Place>): Promise<Place> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.mainCategory !== undefined) dbUpdates.main_category = updates.mainCategory;
        if (updates.subtype !== undefined) dbUpdates.subtype = updates.subtype;
        if (updates.subtypes !== undefined) dbUpdates.subtypes = updates.subtypes;
        if (updates.cuisine !== undefined) dbUpdates.cuisine = updates.cuisine;
        if (updates.address !== undefined) dbUpdates.address = updates.address;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
        if (updates.sourceUrl !== undefined) dbUpdates.source_url = updates.sourceUrl;
        if (updates.coordinates !== undefined) dbUpdates.coordinates = updates.coordinates;
        if (updates.isVisited !== undefined) dbUpdates.is_visited = updates.isVisited;
        if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.review !== undefined) dbUpdates.review = updates.review;
        if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
        if (updates.isEvent !== undefined) dbUpdates.is_event = updates.isEvent;
        // Instagram integration
        if (updates.needsEnhancement !== undefined) dbUpdates.needs_enhancement = updates.needsEnhancement;
        if (updates.instagramPostUrl !== undefined) dbUpdates.instagram_post_url = updates.instagramPostUrl;

        const { data, error } = await supabase
            .from('places')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error('Failed to update place');
        return dbPlaceToPlace(data);
    },

    async delete(id: string): Promise<void> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('places')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error('Failed to delete place');
    },

    // Enhance a place by searching for it and updating with real data
    async enhance(id: string, searchName: string): Promise<Place> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        // Call the enhance endpoint
        const res = await fetch(`${API_BASE}/places/enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeId: id, searchName, userId }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to enhance place');
        }

        return res.json();
    },

    // Search Google Places without saving
    async searchPlaces(query: string, location: string = 'New York, NY'): Promise<any[]> {
        const res = await fetch(`${API_BASE}/places/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, location }),
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    },
};

// Scrape API - still uses Express backend (needs server for external requests)
export const scrapeApi = {
    async scrapeUrl(url: string, location?: string): Promise<any> {
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, location }),
        });
        return res.json();
    },

    async searchPlace(placeName: string, location?: string): Promise<any> {
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeName, location }),
        });
        return res.json();
    },
};

// Chat API - still uses Express backend (needs Gemini API key on server)
export const chatApi = {
    async send(messages: { role: string; content: string }[], userName?: string, userPreferences?: User['preferences']): Promise<any> {
        const userId = getCurrentUserId();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ messages, userName, userPreferences, userId }),
        });
        return res.json();
    },
};

// ============= INSTAGRAM API =============

export interface InstagramAccount {
    id: string;
    igUserId: string;
    username: string;
    linkedAt: string;
}

export interface VerificationCode {
    code: string;
    expiresAt: string;
    instructions: string;
}

export interface IngestedLink {
    id: string;
    url: string;
    urlType: 'ig_reel' | 'ig_post' | 'ig_story' | 'external';
    status: 'pending' | 'processing' | 'saved' | 'error_unfetchable' | 'error_private' | 'error_other';
    metadata?: {
        title?: string;
        caption?: string;
        thumbnail?: string;
        author?: string;
    };
    savedPlaceId?: string;
    createdAt: string;
}

export const instagramApi = {
    // Generate a verification code for DM-based linking
    async generateCode(): Promise<VerificationCode> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/instagram/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, action: 'generate_code' }),
        });
        
        if (!res.ok) throw new Error('Failed to generate verification code');
        return res.json();
    },

    // Get all linked Instagram accounts for current user
    async getLinkedAccounts(): Promise<InstagramAccount[]> {
        const userId = getCurrentUserId();
        if (!userId) return [];

        const res = await fetch(`${API_BASE}/instagram/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, action: 'check_status' }),
        });
        
        if (!res.ok) return [];
        
        const data = await res.json();
        return data.accounts || [];
    },

    // Unlink a specific Instagram account
    async unlinkAccount(accountId: string): Promise<void> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/instagram/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, action: 'unlink', accountId }),
        });
        
        if (!res.ok) throw new Error('Failed to unlink Instagram');
    },

    // Get ingested links for current user
    async getIngestedLinks(limit: number = 50): Promise<IngestedLink[]> {
        const userId = getCurrentUserId();
        if (!userId) return [];

        const { data, error } = await supabase
            .from('ingested_links')
            .select('*')
            .eq('spot_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching ingested links:', error);
            return [];
        }

        return (data || []).map((link: any) => ({
            id: link.id,
            url: link.url,
            urlType: link.url_type,
            status: link.status,
            metadata: link.metadata,
            savedPlaceId: link.saved_place_id,
            createdAt: link.created_at,
        }));
    },
};

// ============= ONBOARDING PREFERENCES API =============

export interface UserPreferences {
    userId: string;
    // Raw selections
    foodOutingTypes: string[];
    foodCuisines: string[];
    foodRules: string[];
    eventTypes: string[];
    eventEnergy: string[];
    eventTiming: string[];
    placeTypes: string[];
    exploreStyle: string[];
    // Computed
    allTags: string[];
    primaryPersona: string | null;
    secondaryPersona: string | null;
    // Dietary flags
    dietaryVegetarian: boolean;
    dietaryVegan: boolean;
    dietaryHalal: boolean;
    dietaryGlutenFree: boolean;
    dietaryDairyFree: boolean;
    dietaryNoPork: boolean;
    // Meta
    onboardingCompleted: boolean;
    onboardingSkipped: boolean;
}

export const preferencesApi = {
    // Get preferences for current user
    async get(): Promise<UserPreferences | null> {
        const userId = getCurrentUserId();
        if (!userId) return null;

        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;

        return {
            userId: data.user_id,
            foodOutingTypes: data.food_outing_types || [],
            foodCuisines: data.food_cuisines || [],
            foodRules: data.food_rules || [],
            eventTypes: data.event_types || [],
            eventEnergy: data.event_energy || [],
            eventTiming: data.event_timing || [],
            placeTypes: data.place_types || [],
            exploreStyle: data.explore_style || [],
            allTags: data.all_tags || [],
            primaryPersona: data.primary_persona,
            secondaryPersona: data.secondary_persona,
            dietaryVegetarian: data.dietary_vegetarian || false,
            dietaryVegan: data.dietary_vegan || false,
            dietaryHalal: data.dietary_halal || false,
            dietaryGlutenFree: data.dietary_gluten_free || false,
            dietaryDairyFree: data.dietary_dairy_free || false,
            dietaryNoPork: data.dietary_no_pork || false,
            onboardingCompleted: data.onboarding_completed || false,
            onboardingSkipped: data.onboarding_skipped || false,
        };
    },

    // Save onboarding preferences
    async save(
        selections: Record<string, string[]>,
        allTags: string[],
        primaryPersona: string,
        secondaryPersona: string | null
    ): Promise<UserPreferences> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        // Extract dietary flags from tags
        const dietaryVegetarian = allTags.includes('dietary:vegetarian');
        const dietaryVegan = allTags.includes('dietary:vegan');
        const dietaryHalal = allTags.includes('dietary:halal');
        const dietaryGlutenFree = allTags.includes('dietary:gluten_free');
        const dietaryDairyFree = allTags.includes('dietary:dairy_free');
        const dietaryNoPork = allTags.includes('dietary:no_pork');

        const dbRecord = {
            user_id: userId,
            food_outing_types: selections.food_outing_type || [],
            food_cuisines: selections.food_cuisines || [],
            food_rules: selections.food_rules || [],
            event_types: selections.event_types || [],
            event_energy: selections.event_energy || [],
            event_timing: selections.event_timing || [],
            place_types: selections.place_types || [],
            explore_style: selections.explore_style || [],
            all_tags: allTags,
            primary_persona: primaryPersona,
            secondary_persona: secondaryPersona,
            dietary_vegetarian: dietaryVegetarian,
            dietary_vegan: dietaryVegan,
            dietary_halal: dietaryHalal,
            dietary_gluten_free: dietaryGlutenFree,
            dietary_dairy_free: dietaryDairyFree,
            dietary_no_pork: dietaryNoPork,
            onboarding_completed: true,
            onboarding_skipped: false,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('user_preferences')
            .upsert(dbRecord, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw new Error('Failed to save preferences');

        return {
            userId: data.user_id,
            foodOutingTypes: data.food_outing_types || [],
            foodCuisines: data.food_cuisines || [],
            foodRules: data.food_rules || [],
            eventTypes: data.event_types || [],
            eventEnergy: data.event_energy || [],
            eventTiming: data.event_timing || [],
            placeTypes: data.place_types || [],
            exploreStyle: data.explore_style || [],
            allTags: data.all_tags || [],
            primaryPersona: data.primary_persona,
            secondaryPersona: data.secondary_persona,
            dietaryVegetarian: data.dietary_vegetarian || false,
            dietaryVegan: data.dietary_vegan || false,
            dietaryHalal: data.dietary_halal || false,
            dietaryGlutenFree: data.dietary_gluten_free || false,
            dietaryDairyFree: data.dietary_dairy_free || false,
            dietaryNoPork: data.dietary_no_pork || false,
            onboardingCompleted: data.onboarding_completed || false,
            onboardingSkipped: data.onboarding_skipped || false,
        };
    },

    // Mark onboarding as skipped
    async skip(): Promise<void> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('user_preferences')
            .upsert({
                user_id: userId,
                onboarding_skipped: true,
                onboarding_completed: false,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) throw new Error('Failed to skip onboarding');
    },

    // Check if user needs onboarding
    async needsOnboarding(): Promise<boolean> {
        const userId = getCurrentUserId();
        if (!userId) return false;

        const { data, error } = await supabase
            .from('user_preferences')
            .select('onboarding_completed, onboarding_skipped')
            .eq('user_id', userId)
            .single();

        if (error || !data) return true; // No record = needs onboarding
        return !data.onboarding_completed && !data.onboarding_skipped;
    },
};

// Legacy exports for compatibility
export const setAuthToken = setCurrentUser;
export const getAuthToken = getCurrentUserId;
