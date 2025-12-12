-- Add recommended_dishes column to places table
ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS recommended_dishes TEXT[];

-- Add comment
COMMENT ON COLUMN public.places.recommended_dishes IS 'AI-extracted recommended dishes from reviews (e.g., ["Spicy Vodka Rigatoni", "Tiramisu"])';

