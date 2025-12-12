-- Daily Digests table for storing pre-generated personalized recommendations
CREATE TABLE IF NOT EXISTS public.daily_digests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Weather data
    weather JSONB NOT NULL DEFAULT '{}',
    -- Contains: temp, feels_like, conditions, icon, spot_quip
    
    -- Personalized greeting
    greeting TEXT NOT NULL,
    -- e.g., "Good morning Naveen"
    
    -- Spot's funny intro text
    intro_text TEXT NOT NULL,
    -- e.g., "While you were sleeping, I was scouring the internet..."
    
    -- Array of 15 recommendations (events + food)
    recommendations JSONB NOT NULL DEFAULT '[]',
    -- Each item: {id, name, type, description, location, imageUrl, isEvent, startDate, endDate, mainCategory, subtype, sources, isBumped}
    
    -- Track shown IDs for refresh exclusion
    shown_ids TEXT[] DEFAULT '{}',
    
    -- Index for quick lookups
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Index for fetching today's digest for a user
CREATE INDEX IF NOT EXISTS idx_daily_digests_user_date 
ON public.daily_digests (user_id, created_at DESC);

-- Only keep the last 7 days of digests per user (cleanup function)
CREATE OR REPLACE FUNCTION cleanup_old_digests()
RETURNS void AS $$
BEGIN
    DELETE FROM public.daily_digests
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.daily_digests IS 'Pre-generated daily personalized recommendations for each user';
COMMENT ON COLUMN public.daily_digests.weather IS 'NYC weather data with Spot personality quip';
COMMENT ON COLUMN public.daily_digests.recommendations IS 'Array of 15 places/events based on taste profile';
COMMENT ON COLUMN public.daily_digests.shown_ids IS 'IDs already shown to user, excluded from refresh';

