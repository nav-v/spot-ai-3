import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallback to the main project
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kzxmplnrozabftmmuchx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eG1wbG5yb3phYmZ0bW11Y2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjQ5NTIsImV4cCI6MjA4MDcwMDk1Mn0.ZvX-wGttZr5kWNP_Svxqfvl7Vyd2_L6MW8-Wy7j_ANg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database tables
export interface DbUser {
    id: string;
    name: string;
    email: string;
    password: string;
    is_admin: boolean;
    avatar_url: string;
    dietary_restrictions: string[];
    interests: string[];
    food_preferences: string[];
    created_at: string;
}

export interface DbPlace {
    id: string;
    user_id: string;
    name: string;
    type: string;
    cuisine: string | null;
    address: string;
    description: string | null;
    image_url: string | null;
    source_url: string | null;
    coordinates: { lat: number; lng: number } | null;
    is_visited: boolean;
    is_favorite: boolean;
    notes: string | null;
    review: string | null;
    rating: number | null;
    start_date: string | null;
    end_date: string | null;
    is_event: boolean;
    created_at: string;
}

export interface DbWaitlist {
    id: string;
    email: string;
    created_at: string;
}
