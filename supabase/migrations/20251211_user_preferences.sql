-- User Preferences table for onboarding data
-- Stores user selections and computed tags/personas

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Raw selections (arrays of option IDs from each question)
    food_outing_types TEXT[] DEFAULT '{}',
    food_cuisines TEXT[] DEFAULT '{}',
    food_rules TEXT[] DEFAULT '{}',
    event_types TEXT[] DEFAULT '{}',
    event_energy TEXT[] DEFAULT '{}',
    event_timing TEXT[] DEFAULT '{}',
    place_types TEXT[] DEFAULT '{}',
    explore_style TEXT[] DEFAULT '{}',
    
    -- Computed tags (flattened from all selections)
    all_tags TEXT[] DEFAULT '{}',
    
    -- Dietary flags (for hard filtering - extracted from tags)
    dietary_vegetarian BOOLEAN DEFAULT false,
    dietary_vegan BOOLEAN DEFAULT false,
    dietary_halal BOOLEAN DEFAULT false,
    dietary_gluten_free BOOLEAN DEFAULT false,
    dietary_dairy_free BOOLEAN DEFAULT false,
    dietary_no_pork BOOLEAN DEFAULT false,
    
    -- Computed persona
    primary_persona TEXT,
    secondary_persona TEXT,
    
    -- Meta
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_skipped BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching existing app pattern)
CREATE POLICY "allow_all_preferences" ON public.user_preferences FOR ALL USING (true);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

