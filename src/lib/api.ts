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
    type: 'restaurant' | 'activity' | 'cafe' | 'bar' | 'attraction';
    cuisine?: string;
    address: string;
    description?: string;
    imageUrl?: string;
    sourceUrl?: string;
    coordinates?: { lat: number; lng: number };
    isVisited: boolean;
    isFavorite: boolean;
    notes?: string;
    review?: string;
    rating?: number;
    createdAt: string;
    startDate?: string;
    endDate?: string;
    isEvent?: boolean;
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

        const dbPlace = {
            id: Date.now().toString(),
            user_id: userId,
            name: place.name,
            type: place.type || 'restaurant',
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
    userId: string;
    igUserId: string;
    igUsername: string;
    isActive: boolean;
    linkedAt: string;
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
    // Get the OAuth URL to link Instagram account
    async getAuthUrl(): Promise<{ authUrl: string }> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/instagram/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        
        if (!res.ok) throw new Error('Failed to get Instagram auth URL');
        return res.json();
    },

    // Get linked Instagram account for current user
    async getLinkedAccount(): Promise<InstagramAccount | null> {
        const userId = getCurrentUserId();
        if (!userId) return null;

        const { data, error } = await supabase
            .from('instagram_accounts')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            userId: data.user_id,
            igUserId: data.ig_user_id,
            igUsername: data.ig_username,
            isActive: data.is_active,
            linkedAt: data.linked_at,
        };
    },

    // Unlink Instagram account
    async unlinkAccount(): Promise<void> {
        const userId = getCurrentUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/instagram/auth`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
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

// Legacy exports for compatibility
export const setAuthToken = setCurrentUser;
export const getAuthToken = getCurrentUserId;
