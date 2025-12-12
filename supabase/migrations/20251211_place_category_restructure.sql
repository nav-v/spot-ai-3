-- Place Category Restructure Migration
-- Adds main_category (eat/see) and subtype fields for better categorization

-- Step 1: Add new columns
ALTER TABLE public.places 
ADD COLUMN IF NOT EXISTS main_category TEXT,
ADD COLUMN IF NOT EXISTS subtype TEXT,
ADD COLUMN IF NOT EXISTS subtypes TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing data based on type field
-- Eat categories: restaurant, cafe, bar
UPDATE public.places 
SET main_category = 'eat',
    subtype = CASE 
        WHEN cuisine IS NOT NULL AND cuisine != '' THEN cuisine
        WHEN type = 'cafe' THEN 'Coffee'
        WHEN type = 'bar' THEN 'Bar'
        ELSE 'Restaurant'
    END
WHERE type IN ('restaurant', 'cafe', 'bar');

-- See categories: attraction, activity, museum, park, theater, shopping, other
UPDATE public.places 
SET main_category = 'see',
    subtype = CASE 
        WHEN type = 'attraction' THEN 'Landmark'
        WHEN type = 'activity' THEN 
            CASE 
                WHEN is_event = true THEN 'Event'
                ELSE 'Activity'
            END
        WHEN type = 'museum' THEN 'Museum'
        WHEN type = 'park' THEN 'Park'
        WHEN type = 'theater' THEN 'Theater'
        WHEN type = 'shopping' THEN 'Shopping'
        ELSE 'Other'
    END
WHERE type IN ('attraction', 'activity', 'museum', 'park', 'theater', 'shopping', 'other')
   OR type NOT IN ('restaurant', 'cafe', 'bar');

-- Step 3: Handle any remaining NULL main_category (fallback to eat/Restaurant)
UPDATE public.places 
SET main_category = 'eat', subtype = 'Restaurant'
WHERE main_category IS NULL;

-- Step 4: Add check constraint for main_category
ALTER TABLE public.places 
ADD CONSTRAINT places_main_category_check 
CHECK (main_category IN ('eat', 'see'));

-- Step 5: Make main_category NOT NULL now that all rows have values
ALTER TABLE public.places 
ALTER COLUMN main_category SET NOT NULL;

-- Step 6: Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_places_main_category ON public.places(main_category);
CREATE INDEX IF NOT EXISTS idx_places_subtype ON public.places(subtype);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

