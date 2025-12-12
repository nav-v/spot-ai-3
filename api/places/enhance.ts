import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Type mapping for eat/see categorization
const EAT_TYPES = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_delivery', 'meal_takeaway', 'food'];
const SEE_TYPES = ['museum', 'art_gallery', 'tourist_attraction', 'park', 'amusement_park', 'aquarium', 'zoo', 'stadium', 'movie_theater', 'night_club'];

// Cuisine mapping
const CUISINE_KEYWORDS: Record<string, string> = {
    pizza: 'Pizza', italian: 'Italian', pasta: 'Italian',
    sushi: 'Sushi', japanese: 'Japanese', ramen: 'Ramen',
    chinese: 'Chinese', dim_sum: 'Chinese', dumpling: 'Chinese',
    mexican: 'Mexican', taco: 'Mexican', burrito: 'Mexican',
    indian: 'Indian', curry: 'Indian',
    thai: 'Thai', korean: 'Korean', vietnamese: 'Vietnamese', pho: 'Vietnamese',
    french: 'French', mediterranean: 'Mediterranean', greek: 'Greek',
    american: 'American', burger: 'American', bbq: 'BBQ',
    cafe: 'Coffee', coffee: 'Coffee', bakery: 'Bakery',
    bar: 'Bar', cocktail: 'Cocktails', wine: 'Wine Bar',
    seafood: 'Seafood', steakhouse: 'Steakhouse',
    deli: 'Deli', sandwich: 'Deli',
    dessert: 'Dessert', ice_cream: 'Dessert',
    brunch: 'Brunch', breakfast: 'Brunch',
};

function categorizePlace(types: string[], name: string, description: string): { mainCategory: 'eat' | 'see', subtype: string } {
    const allText = `${types.join(' ')} ${name} ${description}`.toLowerCase();
    
    // Check for eat types
    if (types.some(t => EAT_TYPES.includes(t))) {
        // Try to determine cuisine
        for (const [keyword, cuisine] of Object.entries(CUISINE_KEYWORDS)) {
            if (allText.includes(keyword)) {
                return { mainCategory: 'eat', subtype: cuisine };
            }
        }
        return { mainCategory: 'eat', subtype: 'Restaurant' };
    }
    
    // Check for see types
    if (types.some(t => SEE_TYPES.includes(t))) {
        if (types.includes('museum')) return { mainCategory: 'see', subtype: 'Museum' };
        if (types.includes('art_gallery')) return { mainCategory: 'see', subtype: 'Gallery' };
        if (types.includes('park')) return { mainCategory: 'see', subtype: 'Park' };
        if (types.includes('night_club')) return { mainCategory: 'see', subtype: 'Nightlife' };
        return { mainCategory: 'see', subtype: 'Activity' };
    }
    
    // Default to eat/Restaurant
    return { mainCategory: 'eat', subtype: 'Restaurant' };
}

// AI-powered categorization for ambiguous cases
async function categorizePlaceWithAI(name: string, description: string, types: string[]): Promise<{ mainCategory: 'eat' | 'see', subtype: string }> {
    if (!GEMINI_API_KEY) {
        return { mainCategory: 'eat', subtype: 'Restaurant' };
    }
    
    try {
        const prompt = `Categorize this place:
Name: "${name}"
Description: "${description}"
Google Types: ${types.join(', ')}

Return JSON only: { "mainCategory": "eat" or "see", "subtype": "specific type" }
- "eat" for restaurants, cafes, bars, food places
- "see" for attractions, activities, events, entertainment
- subtype should be specific like "Pizza", "Sushi", "Museum", "Park", etc.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
                }),
            }
        );
        
        if (!response.ok) return { mainCategory: 'eat', subtype: 'Restaurant' };
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                mainCategory: parsed.mainCategory === 'see' ? 'see' : 'eat',
                subtype: parsed.subtype || 'Restaurant'
            };
        }
    } catch (e) {
        console.error('[AI Categorize] Error:', e);
    }
    
    return { mainCategory: 'eat', subtype: 'Restaurant' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { placeId, searchName, userId } = req.body;

    if (!placeId || !searchName || !userId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!GOOGLE_PLACES_API_KEY) {
        return res.status(500).json({ error: 'Google Places API key not configured' });
    }

    try {
        // Verify the place belongs to the user and needs enhancement
        const { data: existingPlace, error: fetchError } = await supabase
            .from('places')
            .select('*')
            .eq('id', placeId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !existingPlace) {
            return res.status(404).json({ error: 'Place not found' });
        }

        // Search Google Places
        const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
        
        const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.types,places.photos,places.editorialSummary,places.location'
            },
            body: JSON.stringify({
                textQuery: `${searchName} New York, NY`,
                maxResultCount: 1
            })
        });

        const searchData = await searchResponse.json();

        if (!searchData.places || searchData.places.length === 0) {
            return res.status(404).json({ error: `Could not find "${searchName}" on Google Places` });
        }

        const googlePlace = searchData.places[0];
        
        // Get photo URL
        let imageUrl = existingPlace.image_url;
        if (googlePlace.photos && googlePlace.photos.length > 0) {
            const photoRef = googlePlace.photos[0].name;
            imageUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=800&key=${GOOGLE_PLACES_API_KEY}`;
        }

        // Categorize the place
        const types = googlePlace.types || [];
        let category = categorizePlace(types, googlePlace.displayName?.text || '', googlePlace.editorialSummary?.text || '');
        
        // Use AI for ambiguous types
        const ambiguousTypes = ['establishment', 'point_of_interest', 'store', 'local_business'];
        if (types.every((t: string) => ambiguousTypes.includes(t) || !EAT_TYPES.includes(t) && !SEE_TYPES.includes(t))) {
            category = await categorizePlaceWithAI(
                googlePlace.displayName?.text || '',
                googlePlace.editorialSummary?.text || '',
                types
            );
        }

        // Update the place
        const updates = {
            name: googlePlace.displayName?.text || existingPlace.name,
            address: googlePlace.formattedAddress || existingPlace.address,
            description: googlePlace.editorialSummary?.text || existingPlace.description,
            image_url: imageUrl,
            source_url: googlePlace.websiteUri || existingPlace.source_url,
            rating: googlePlace.rating || existingPlace.rating,
            coordinates: googlePlace.location ? {
                lat: googlePlace.location.latitude,
                lng: googlePlace.location.longitude
            } : existingPlace.coordinates,
            main_category: category.mainCategory,
            subtype: category.subtype,
            type: category.mainCategory === 'eat' ? 'restaurant' : 'activity',
            needs_enhancement: false,
        };

        const { data: updatedPlace, error: updateError } = await supabase
            .from('places')
            .update(updates)
            .eq('id', placeId)
            .select()
            .single();

        if (updateError) {
            console.error('[Enhance] Update error:', updateError);
            return res.status(500).json({ error: 'Failed to update place' });
        }

        // Return the updated place in API format
        return res.status(200).json({
            id: updatedPlace.id,
            name: updatedPlace.name,
            type: updatedPlace.type,
            mainCategory: updatedPlace.main_category,
            subtype: updatedPlace.subtype,
            subtypes: updatedPlace.subtypes || [],
            cuisine: updatedPlace.cuisine,
            address: updatedPlace.address,
            description: updatedPlace.description,
            imageUrl: updatedPlace.image_url,
            sourceUrl: updatedPlace.source_url,
            coordinates: updatedPlace.coordinates,
            isVisited: updatedPlace.is_visited,
            isFavorite: updatedPlace.is_favorite,
            notes: updatedPlace.notes,
            review: updatedPlace.review,
            rating: updatedPlace.rating,
            createdAt: updatedPlace.created_at,
            startDate: updatedPlace.start_date,
            endDate: updatedPlace.end_date,
            isEvent: updatedPlace.is_event,
            needsEnhancement: updatedPlace.needs_enhancement,
            instagramPostUrl: updatedPlace.instagram_post_url,
        });
    } catch (error) {
        console.error('[Enhance] Error:', error);
        return res.status(500).json({ error: 'Failed to enhance place' });
    }
}

