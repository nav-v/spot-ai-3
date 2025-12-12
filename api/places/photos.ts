import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { name, location } = req.body || {};
    
    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }

    if (!GOOGLE_PLACES_API_KEY) {
        return res.status(500).json({ error: 'Google Places API key not configured' });
    }

    try {
        console.log(`[Photos API] Fetching photos for: ${name} in ${location || 'New York'}`);
        
        // Search for place using new Google Places API
        const searchResponse = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.photos,places.displayName'
            },
            body: JSON.stringify({
                textQuery: `${name} ${location || 'New York'}`,
                maxResultCount: 1
            })
        });

        const searchData = await searchResponse.json();
        
        if (!searchData.places?.[0]) {
            console.log('[Photos API] No place found');
            return res.status(200).json({ photos: [] });
        }

        const place = searchData.places[0];
        const photoRefs = place.photos || [];
        
        // Get up to 5 photos
        const photos: string[] = [];
        for (const photo of photoRefs.slice(0, 5)) {
            if (photo.name) {
                // Construct the photo URL using the new API format
                const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=600&key=${GOOGLE_PLACES_API_KEY}`;
                photos.push(photoUrl);
            }
        }

        console.log(`[Photos API] Found ${photos.length} photos for ${name}`);
        
        return res.status(200).json({ 
            photos,
            placeName: place.displayName?.text || name
        });

    } catch (error: any) {
        console.error('[Photos API] Error:', error);
        return res.status(500).json({ error: error.message, photos: [] });
    }
}

