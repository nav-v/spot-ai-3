import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supabase - create lazily to ensure env vars are loaded
let supabase: SupabaseClient;
function getSupabase(token?: string) {
    const url = process.env.SUPABASE_URL || 'https://kzxmplnrozabftmmuchx.supabase.co';
    const key = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eG1wbG5yb3phYmZ0bW11Y2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjQ5NTIsImV4cCI6MjA4MDcwMDk1Mn0.ZvX-wGttZr5kWNP_Svxqfvl7Vyd2_L6MW8-Wy7j_ANg';

    if (token) {
        return createClient(url, key, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
    }

    if (!supabase) {
        supabase = createClient(url, key);
    }
    return supabase;
}

// Gemini client - also lazy
let ai: GoogleGenAI;
function getAI() {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    return ai;
}

// Google Places API helper
async function searchGooglePlaces(query: string, location: string = 'New York, NY') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.log('[Google Places] No API key configured');
        return null;
    }

    try {
        const searchQuery = `${query} ${location}`;
        const url = `https://places.googleapis.com/v1/places:searchText`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.photos'
            },
            body: JSON.stringify({
                textQuery: searchQuery,
                maxResultCount: 1
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const place = data.places?.[0];

        if (!place) return null;

        let imageUrl = '';
        if (place.photos?.[0]?.name) {
            imageUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=400&key=${apiKey}`;
        }

        return {
            name: place.displayName?.text || query,
            address: place.formattedAddress || location,
            coordinates: place.location ? {
                lat: place.location.latitude,
                lng: place.location.longitude
            } : null,
            rating: place.rating || null,
            type: place.types?.[0] || 'restaurant',
            imageUrl
        };
    } catch (error) {
        console.error('[Google Places] Error:', error);
        return null;
    }
}

// Helper to find and add a place to Supabase
async function findAndAddPlace(placeName: string, location: string = 'New York, NY', extraData: any = {}, userId: string | null = null, token?: string) {
    if (!userId) {
        return { added: false, message: 'No user ID provided' };
    }

    // Check if already exists in Supabase
    const { data: existingPlaces } = await getSupabase(token)
        .from('places')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${placeName}%`);

    if (existingPlaces && existingPlaces.length > 0) {
        return { added: false, message: 'Already on list', place: existingPlaces[0] };
    }

    // Get place data from Google Places
    let place = await searchGooglePlaces(placeName, location);

    if (!place) {
        place = {
            name: placeName,
            type: extraData.isEvent ? 'activity' : 'restaurant',
            address: location,
            coordinates: null,
            rating: null,
            imageUrl: ''
        };
    }

    const newPlace = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        name: place.name,
        type: place.type || 'restaurant',
        cuisine: extraData.cuisine || null,
        address: place.address || '',
        description: extraData.description || null,
        image_url: place.imageUrl || null,
        source_url: null,
        coordinates: place.coordinates || null,
        is_visited: false,
        is_favorite: true,
        notes: null,
        review: null,
        rating: place.rating || null,
        start_date: extraData.startDate || null,
        end_date: extraData.endDate || null,
        is_event: extraData.isEvent || false,
        created_at: new Date().toISOString(),
    };

    const { error } = await getSupabase(token).from('places').insert(newPlace);

    if (error) {
        console.error('[addPlace] Supabase error:', error);
        return { added: false, message: 'Failed to save' };
    }

    console.log('[addPlace] Saved to Supabase:', newPlace.name);
    return { added: true, place: newPlace };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, userName, userPreferences, userId } = req.body;
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

        const today = new Date().toISOString().split('T')[0];

        // Fetch user's places from Supabase
        let userPlaces: any[] = [];
        console.log(`[Chat API] Received userId: ${userId}`);

        if (userId) {
            const { data, error } = await getSupabase(token)
                .from('places')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Chat API] Supabase error:', error);
            }

            if (data) {
                console.log(`[Chat API] Found ${data.length} places for user`);
                userPlaces = data;
            } else {
                console.log('[Chat API] No data returned from Supabase');
            }
        } else {
            console.log('[Chat API] No userId provided');
        }

        // Build places context
        const placesContext = userPlaces.length > 0
            ? userPlaces.map((p: any) => {
                const status = p.is_visited ? 'VISITED' : 'Not visited';
                const fav = p.is_favorite ? ', FAVORITED' : '';
                const rating = p.rating ? `, Rating: ${p.rating}/5` : '';
                return `- ${p.name} (${p.cuisine || p.type}) at ${p.address} - ${status}${fav}${rating}`;
            }).join('\n')
            : '- No places saved yet!';

        // Build user context
        const userContext = userName ? `\n\nUSER INFO:\n- Name: ${userName}${userPreferences?.dietaryRestrictions?.length ? `\n- Dietary Restrictions: ${userPreferences.dietaryRestrictions.join(', ')}` : ''}${userPreferences?.interests?.length ? `\n- Interests: ${userPreferences.interests.join(', ')}` : ''}${userPreferences?.foodPreferences?.length ? `\n- Food Preferences: ${userPreferences.foodPreferences.join(', ')}` : ''}\n\nIMPORTANT: Address the user by their name (${userName}) occasionally.` : '';

        const systemPrompt = `You are Spot – a warm, funny, slightly dramatic AI that helps people track and discover places. You talk like that slightly extra friend who is weirdly good at remembering places.

Current Date: ${today}${userContext}

USER'S SAVED PLACES:
${placesContext}

CORE CAPABILITIES:
1. RECOMMEND places based on user preferences and saved places
2. ADD places to user's list when they ask
3. PROVIDE helpful, personalized responses

When recommending, provide 3-5 specific place names with brief descriptions.

ACTIONS - Output JSON in this format when taking action:
{"action": "addPlace", "placeName": "Place Name", "location": "City, State", "cuisine": "optional"}
{"action": "addMultiplePlaces", "places": [{"name": "Place1", "location": "City"}, ...]}
{"action": "recommend", "places": [{"name": "Place Name", "description": "Why it's great", "cuisine": "Italian"}]}

For recommendations, always include the action JSON at the end of your response.
For adding places, include the action JSON and confirm to the user.

Respond conversationally first, then add the JSON action if needed.`;

        const response = await getAI().models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'Got it! I\'m Spot, ready to help discover and save amazing places.' }] },
                ...messages.map((m: any) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }))
            ]
        });

        const content = response.text || '';

        // Extract JSON action if present
        let actionResult = null;
        const jsonMatch = content.match(/\{[\s\S]*?"action"[\s\S]*?\}/);

        if (jsonMatch) {
            try {
                const action = JSON.parse(jsonMatch[0]);

                if (action.action === 'addPlace' && action.placeName) {
                    const result = await findAndAddPlace(action.placeName, action.location, action, userId, token);
                    if (result.added) {
                        actionResult = { added: true, place: result.place };
                    }
                } else if (action.action === 'addMultiplePlaces' && action.places) {
                    const results = [];
                    for (const p of action.places) {
                        const result = await findAndAddPlace(p.name, p.location, p, userId, token);
                        results.push({
                            name: p.name,
                            status: result.added ? 'added' : 'skipped',
                            place: result.place
                        });
                    }
                    actionResult = { type: 'batch_add', results };
                } else if (action.action === 'recommend') {
                    actionResult = { type: 'recommendations', places: action.places };
                }
            } catch (e) {
                console.log('Failed to parse action JSON');
            }
        }

        // Clean the content (remove JSON from visible response)
        const cleanContent = content.replace(/```json[\s\S]*?```/g, '').replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '').trim();

        return res.status(200).json({
            content: cleanContent || content,
            actionResult
        });

    } catch (error) {
        console.error('[Chat API] Error:', error);
        return res.status(500).json({ error: 'Failed to process chat' });
    }
}