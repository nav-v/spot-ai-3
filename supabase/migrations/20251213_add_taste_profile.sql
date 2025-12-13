-- Add taste_profile column to daily_digests for caching
ALTER TABLE public.daily_digests 
ADD COLUMN IF NOT EXISTS taste_profile JSONB DEFAULT NULL;

COMMENT ON COLUMN public.daily_digests.taste_profile IS 'Cached taste profile analysis for speed mode chat';
