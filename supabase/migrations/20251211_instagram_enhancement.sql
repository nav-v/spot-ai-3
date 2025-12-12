-- Instagram Enhancement Migration
-- Adds fields for unknown place enhancement and Instagram post embedding

-- Add needs_enhancement flag for places that need user input
ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS needs_enhancement BOOLEAN DEFAULT false;

-- Add instagram_post_url for embedding the original post
ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS instagram_post_url TEXT;

-- Create index for quick lookup of places needing enhancement
CREATE INDEX IF NOT EXISTS idx_places_needs_enhancement 
ON public.places(needs_enhancement) 
WHERE needs_enhancement = true;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

