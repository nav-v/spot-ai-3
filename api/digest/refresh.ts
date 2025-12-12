import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

let supabase: ReturnType<typeof createClient>;
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
        supabase = createClient(url, key);
    }
    return supabase;
}

let ai: GoogleGenAI;
function getAI() {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    return ai;
}

// Same Google Places function as generate-single.ts
async function searchGooglePlaces(placeName: string, location: string = 'New York, NY') {
    if (!GOOGLE_PLACES_API_KEY) return null;

    try {
        const searchResponse = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.photos,places.editorialSummary'
            },
            body: JSON.stringify({
                textQuery: `${placeName} ${location}`,
                maxResultCount: 1
            })
        });

        const searchData = await searchResponse.json();
        if (!searchData.places?.[0]) return null;

        const place = searchData.places[0];
        let imageUrl = '';
        if (place.photos?.[0]?.name) {
            imageUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=400&key=${GOOGLE_PLACES_API_KEY}`;
        }

        return {
            name: place.displayName?.text || placeName,
            address: place.formattedAddress || location,
            description: place.editorialSummary?.text || '',
            website: place.websiteUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`,
            imageUrl,
            rating: place.rating || null
        };
    } catch {
        return null;
    }
}

async function geminiSearch(query: string): Promise<{ text: string; sources: any[] }> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: { tools: [{ googleSearch: {} }] }
        });
        
        const sources: any[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of chunks) {
            if (chunk.web?.uri) {
                try {
                    sources.push({ domain: new URL(chunk.web.uri).hostname.replace('www.', ''), url: chunk.web.uri });
                } catch {}
            }
        }
        
        return { text: response.text || '', sources };
    } catch {
        return { text: '', sources: [] };
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { userId, excludedNames = [] } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    
    console.log(`[Refresh] Generating fresh recommendations, excluding ${excludedNames.length} names`);
    const start = Date.now();
    
    try {
        // Quick parallel research
        const [eventsRes, foodRes] = await Promise.all([
            geminiSearch(`NYC events this weekend concerts shows markets NOT ${excludedNames.slice(0, 10).join(' NOT ')} r/nyc`),
            geminiSearch(`best restaurants NYC hidden gems NOT ${excludedNames.slice(0, 10).join(' NOT ')} r/FoodNYC`)
        ]);
        
        const prompt = `Generate 15 NEW recommendations for NYC (2:1 pattern: event, event, food, repeat).

=== EVENTS ===
${eventsRes.text.substring(0, 3000)}

=== FOOD ===
${foodRes.text.substring(0, 2000)}

EXCLUDE (already shown): ${excludedNames.join(', ')}

Return JSON array - 10 events, 5 food in 2:1 pattern:
[
    {"name": "Event Name", "type": "event", "description": "Why great", "location": "Venue", "isEvent": true, "startDate": "2024-12-14", "mainCategory": "see", "subtype": "Concert", "sources": [{"domain": "reddit.com", "url": ""}]},
    {"name": "Event 2", "type": "event", "description": "Why", "location": "Venue", "isEvent": true, "startDate": "2024-12-14", "mainCategory": "see", "subtype": "Market", "sources": []},
    {"name": "Restaurant", "type": "restaurant", "description": "Amazing food", "location": "Neighborhood", "isEvent": false, "mainCategory": "eat", "subtype": "Italian", "recommendedDishes": ["Pasta"], "sources": []}
]

CRITICAL: Do NOT include any place from EXCLUDE list!`;

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const jsonMatch = (response.text || '[]').match(/\[[\s\S]*\]/);
        let recommendations: any[] = [];
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const allSources = [...eventsRes.sources, ...foodRes.sources];
            
            // Enrich with Google Places
            recommendations = await Promise.all(parsed.slice(0, 15).map(async (rec: any, i: number) => {
                const placeData = await searchGooglePlaces(rec.name, rec.location || 'New York');
                return {
                    id: `refresh-${i}-${Date.now()}`,
                    ...rec,
                    imageUrl: placeData?.imageUrl,
                    website: placeData?.website,
                    rating: placeData?.rating,
                    sources: rec.sources?.length ? rec.sources : allSources.slice(0, 2)
                };
            }));
        }
        
        console.log(`[Refresh] Done in ${Date.now() - start}ms with ${recommendations.length} recs`);
        
        return res.status(200).json({
            success: true,
            recommendations
        });
        
    } catch (error: any) {
        console.error('[Refresh] Error:', error);
        return res.status(500).json({ error: error.message, recommendations: [] });
    }
}
