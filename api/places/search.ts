import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, location = 'New York, NY' } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
    }

    if (!GOOGLE_PLACES_API_KEY) {
        return res.status(500).json({ error: 'Google Places API key not configured' });
    }

    try {
        const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
        
        const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.types,places.photos,places.editorialSummary,places.location'
            },
            body: JSON.stringify({
                textQuery: `${query} ${location}`,
                maxResultCount: 5
            })
        });

        const searchData = await searchResponse.json();

        if (!searchData.places || searchData.places.length === 0) {
            return res.status(200).json({ results: [] });
        }

        // Format results
        const results = await Promise.all(
            searchData.places.map(async (place: any) => {
                let imageUrl = null;
                
                // Try to get a photo
                if (place.photos && place.photos.length > 0) {
                    const photoRef = place.photos[0].name;
                    imageUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${GOOGLE_PLACES_API_KEY}`;
                }

                return {
                    name: place.displayName?.text || 'Unknown',
                    address: place.formattedAddress || '',
                    rating: place.rating,
                    type: place.types?.[0]?.replace(/_/g, ' '),
                    imageUrl,
                    website: place.websiteUri,
                    description: place.editorialSummary?.text,
                    coordinates: place.location ? {
                        lat: place.location.latitude,
                        lng: place.location.longitude
                    } : null
                };
            })
        );

        return res.status(200).json({ results });
    } catch (error) {
        console.error('[Places Search] Error:', error);
        return res.status(500).json({ error: 'Failed to search places' });
    }
}

