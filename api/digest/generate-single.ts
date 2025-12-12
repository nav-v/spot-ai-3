import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= CONFIG =============

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

const EVENT_SUBREDDITS = ['nyc', 'AskNYC', 'NYCbitcheswithtaste', 'newyorkcity'];
const FOOD_SUBREDDITS = ['nyc', 'AskNYC', 'FoodNYC', 'NYCbitcheswithtaste'];

// ============= LAZY INIT =============

let supabase: ReturnType<typeof createClient>;
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
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

// ============= WEATHER =============

interface WeatherData {
    temp: number;
    feels_like: number;
    conditions: string;
    icon: string;
    spot_quip: string;
}

async function fetchNYCWeather(): Promise<WeatherData> {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=New York&appid=${OPENWEATHER_API_KEY}&units=imperial`
        );
        const data = await response.json();
        
        const temp = Math.round(data.main?.temp || 50);
        const conditions = data.weather?.[0]?.description || 'clear';
        const icon = data.weather?.[0]?.icon || '01d';
        
        let quip = `${temp}°F and ${conditions} - perfect for exploring!`;
        if (temp < 35) quip = `${temp}°F - bundle up, but the city awaits!`;
        else if (temp > 80) quip = `${temp}°F - find some AC or a rooftop!`;
        else if (conditions.includes('rain')) quip = `${temp}°F with rain - cozy indoor vibes today`;
        
        return { temp, feels_like: temp, conditions, icon, spot_quip: quip };
    } catch {
        return { temp: 50, feels_like: 50, conditions: 'clear', icon: '01d', spot_quip: "Perfect day to explore!" };
    }
}

// ============= GOOGLE PLACES (NEW API - same as chat.ts) =============

async function searchGooglePlaces(placeName: string, location: string = 'New York, NY') {
    if (!GOOGLE_PLACES_API_KEY) {
        console.log('[Google Places] No API key configured');
        return null;
    }

    try {
        const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
        console.log(`[Google Places] Searching for: "${placeName}" in ${location}`);

        const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.types,places.photos,places.editorialSummary'
            },
            body: JSON.stringify({
                textQuery: `${placeName} ${location}`,
                maxResultCount: 1
            })
        });

        const searchData = await searchResponse.json();

        if (!searchData.places || searchData.places.length === 0) {
            console.log(`[Google Places] No results found for "${placeName}"`);
            return null;
        }

        const place = searchData.places[0];
        console.log(`[Google Places] Found: ${place.displayName?.text}, rating: ${place.rating}`);

        // Get photo URL if available
        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoName = place.photos[0].name;
            imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${GOOGLE_PLACES_API_KEY}`;
        }

        return {
            name: place.displayName?.text || placeName,
            address: place.formattedAddress || location,
            description: place.editorialSummary?.text || '',
            website: place.websiteUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' ' + location)}`,
            imageUrl,
            rating: place.rating || null
        };
    } catch (error) {
        console.error('[Google Places] API error:', error);
        return null;
    }
}

// ============= RESEARCH (same pattern as chat.ts) =============

async function scrapeWithJina(url: string): Promise<string> {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 6000);
        
        const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
            headers: { 'Accept': 'text/plain' },
            signal: controller.signal
        });
        if (!response.ok) return '';
        return (await response.text()).substring(0, 3000);
    } catch {
        return '';
    }
}

interface SearchResult {
    text: string;
    sources: Array<{ domain: string; url: string }>;
}

async function geminiSearchWithSources(query: string): Promise<SearchResult> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: { tools: [{ googleSearch: {} }] }
        });
        
        const sources: Array<{ domain: string; url: string }> = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of chunks) {
            if (chunk.web?.uri) {
                try {
                    const domain = new URL(chunk.web.uri).hostname.replace('www.', '');
                    sources.push({ domain, url: chunk.web.uri });
                } catch {}
            }
        }
        
        return { text: response.text || '', sources };
    } catch {
        return { text: '', sources: [] };
    }
}

async function researchForDigest(): Promise<{
    events: SearchResult;
    food: SearchResult;
    scraped: string;
}> {
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    const [eventsRes, foodRes, scrape1, scrape2] = await Promise.all([
        geminiSearchWithSources(`NYC events happening ${dayName} this weekend concerts shows markets festivals r/nyc r/AskNYC`),
        geminiSearchWithSources(`best restaurants NYC must try hidden gems highly rated r/FoodNYC r/nyc`),
        scrapeWithJina('https://theskint.com/'),
        scrapeWithJina('https://www.timeout.com/newyork/things-to-do/this-weekend'),
    ]);
    
    return {
        events: eventsRes,
        food: foodRes,
        scraped: `=== THESKINT.COM ===\n${scrape1}\n\n=== TIMEOUT.COM ===\n${scrape2}`
    };
}

// ============= DIGEST GENERATION =============

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

interface DigestRec {
    id: string;
    name: string;
    type: string;
    description: string;
    location: string;
    imageUrl?: string;
    website?: string;
    rating?: number;
    isEvent: boolean;
    startDate?: string;
    mainCategory: 'eat' | 'see';
    subtype: string;
    recommendedDishes?: string[];
    sources: Array<{ domain: string; url: string }>;
    isFromSaved?: boolean;
}

async function generateDigest(
    userName: string,
    userPlaces: any[],
    research: Awaited<ReturnType<typeof researchForDigest>>
): Promise<{ intro_text: string; recommendations: DigestRec[]; next_batch: DigestRec[] }> {
    
    // Get old saved food spots to bump (sorted by oldest first)
    const savedFood = userPlaces
        .filter(p => ['restaurant', 'bar', 'cafe'].includes(p.type?.toLowerCase() || ''))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, 5);
    
    const savedNames = new Set(userPlaces.map(p => p.name.toLowerCase()));
    
    // Get user's taste for personalized descriptions
    const tasteHint = userPlaces
        .filter(p => p.cuisine || p.subtype)
        .map(p => p.cuisine || p.subtype)
        .slice(0, 5)
        .join(', ') || 'varied tastes';
    
    const prompt = `You are Spot. Generate a daily digest for ${userName} who likes: ${tasteHint}.

=== EVENTS ===
${research.events.text.substring(0, 4000)}
${research.scraped.substring(0, 3000)}

=== FOOD ===
${research.food.text.substring(0, 3000)}

DO NOT RECOMMEND (already saved): ${Array.from(savedNames).slice(0, 30).join(', ')}

Generate exactly 21 recommendations in 2:1 pattern (EVENT, EVENT, FOOD, repeat 7 times).
So 14 events + 7 food items.

Return JSON:
{
    "intro_text": "While you were [something fun], I found some gems...",
    "recommendations": [
        {"name": "Event Name", "type": "event", "description": "Perfect for you because [reference their taste]...", "location": "Venue, Neighborhood", "isEvent": true, "startDate": "2024-12-13", "mainCategory": "see", "subtype": "Concert", "sources": [{"domain": "theskint.com", "url": ""}]},
        {"name": "Restaurant", "type": "restaurant", "description": "Since you love ${tasteHint}, you'll enjoy...", "location": "Neighborhood", "isEvent": false, "mainCategory": "eat", "subtype": "Italian", "recommendedDishes": ["Pasta"], "sources": []}
    ]
}

CRITICAL:
- PERSONALIZE descriptions: explain WHY this rec fits ${userName}'s taste (${tasteHint})
- Example: "Since you love Italian, this spot's fresh pasta will be right up your alley"
- Example: "Given your love for live music, this intimate jazz club is a must"
- Follow the 2:1 pattern (event, event, food, event, event, food...)
- Events need real dates from research
- Food needs recommendedDishes`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const jsonMatch = (response.text || '{}').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const recs = parsed.recommendations || [];
            
            // Merge sources from research
            const allSources = [...research.events.sources, ...research.food.sources];
            
            // Insert 2 saved food items at food positions (positions 2, 5 - 0-indexed)
            const savedToInsert = savedFood.slice(0, 2);
            
            // Enrich with Google Places data
            console.log(`[Digest] Enriching ${recs.length} recommendations...`);
            const enriched: DigestRec[] = [];
            
            let savedIdx = 0;
            for (let i = 0; i < recs.length && enriched.length < 21; i++) {
                const rec = recs[i];
                
                // At food positions (2, 5, 8, 11, 14), check if we should insert saved
                const isFoodPosition = (i + 1) % 3 === 0;
                if (isFoodPosition && savedIdx < savedToInsert.length) {
                    // Insert saved food item
                    const saved = savedToInsert[savedIdx];
                    const placeData = await searchGooglePlaces(saved.name, saved.address || 'New York');
                    enriched.push({
                        id: `saved-${savedIdx}`,
                        name: saved.name,
                        type: saved.type || 'restaurant',
                        description: saved.description || `One of your saved spots - haven't visited in a while?`,
                        location: saved.address?.split(',')[0] || 'NYC',
                        imageUrl: placeData?.imageUrl || saved.image_url,
                        website: placeData?.website || saved.source_url,
                        rating: placeData?.rating || saved.rating,
                        isEvent: false,
                        mainCategory: 'eat',
                        subtype: saved.subtype || saved.cuisine || 'Restaurant',
                        recommendedDishes: saved.recommended_dishes || [],
                        sources: [],
                        isFromSaved: true
                    });
                    savedIdx++;
                }
                
                // Add the AI recommendation
                const placeData = await searchGooglePlaces(rec.name, rec.location || 'New York');
                
                enriched.push({
                    id: `digest-${i}`,
                    name: rec.name,
                    type: rec.type || 'event',
                    description: rec.description,
                    location: rec.location,
                    imageUrl: placeData?.imageUrl,
                    website: placeData?.website,
                    rating: placeData?.rating,
                    isEvent: rec.isEvent ?? rec.type === 'event',
                    startDate: rec.startDate,
                    mainCategory: rec.mainCategory || (rec.isEvent ? 'see' : 'eat'),
                    subtype: rec.subtype || 'Event',
                    recommendedDishes: rec.recommendedDishes,
                    sources: rec.sources?.length ? rec.sources : allSources.slice(0, 2)
                });
            }
            
            console.log(`[Digest] Enriched ${enriched.filter(r => r.imageUrl).length}/${enriched.length} with images`);
            
            return {
                intro_text: parsed.intro_text || "Here's what's happening in NYC!",
                recommendations: enriched.slice(0, 15),
                next_batch: enriched.slice(15, 21)
            };
        }
    } catch (error) {
        console.error('[Digest] Generation failed:', error);
    }
    
    return { intro_text: "Here's what's happening in NYC!", recommendations: [], next_batch: [] };
}

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    
    console.log(`[Digest] Generating for ${userId}...`);
    const start = Date.now();
    
    try {
        const db = getSupabase();
        
        // Parallel: weather, research, user data
        const [weather, research, userResult, placesResult] = await Promise.all([
            fetchNYCWeather(),
            researchForDigest(),
            db.from('users').select('name').eq('id', userId).single(),
            db.from('places').select('*').eq('user_id', userId).order('created_at', { ascending: true })
        ]);
        
        const userName = userResult.data?.name || 'there';
        const places = placesResult.data || [];
        
        // Generate digest
        const digest = await generateDigest(userName, places, research);
        
        // Save to DB
        // Store all recommendations (15 + 6) for retrieval
        const allRecs = [...digest.recommendations, ...digest.next_batch];
        
        const { data: saved, error: insertError } = await db.from('daily_digests').insert({
            user_id: userId,
            weather,
            greeting: `Good ${getTimeOfDay()} ${userName}`,
            intro_text: digest.intro_text,
            recommendations: allRecs, // Store all 21
            shown_ids: []
        }).select().single();
        
        if (insertError) {
            console.error(`[Digest] ❌ Failed to save to database:`, insertError);
            console.error(`[Digest] Error details:`, JSON.stringify(insertError, null, 2));
            // Still return the digest even if DB save fails (user can still see it)
        } else {
            console.log(`[Digest] ✅ Saved to database with ID: ${saved?.id}`);
        }
        
        console.log(`[Digest] Done in ${Date.now() - start}ms with ${digest.recommendations.length} + ${digest.next_batch.length} recs`);
        
        return res.status(200).json({
            success: true,
            hasDigest: true,
            digest: {
                id: saved?.id || 'temp',
                greeting: `Good ${getTimeOfDay()} ${userName}`,
                weather,
                intro_text: digest.intro_text,
                recommendations: digest.recommendations, // First 15
                next_batch: digest.next_batch, // Preloaded 6
                shown_ids: [],
                created_at: new Date().toISOString()
            }
        });
        
    } catch (error: any) {
        console.error('[Digest] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
