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
                } catch { }
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
    // Get current date info for the prompt
    const now = new Date();
    const nycTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dayName = nycTime.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = nycTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Match the same subreddits used in chat.ts
    const eventSubs = ['nyc', 'AskNYC', 'NYCbitcheswithtaste'];
    const foodSubs = ['FoodNYC', 'AskNYC', 'NYCbitcheswithtaste', 'nyc'];

    // Parallel: Reddit searches + Event site scrapes
    const [
        // Event Reddit searches
        eventSearch1,
        eventSearch2,
        eventSearch3,
        // Food Reddit searches
        foodSearch1,
        foodSearch2,
        foodSearch3,
        // Event site scrapes
        skintScrape,
        timeoutScrape,
        ohmyrocknessScrape
    ] = await Promise.all([
        // Events - use r/subreddit pattern like chat.ts
        geminiSearchWithSources(`NYC events this weekend ${dateStr} concerts shows r/${eventSubs[0]}`),
        geminiSearchWithSources(`things to do NYC this weekend ${dayName} r/${eventSubs[1]}`),
        geminiSearchWithSources(`NYC events happening now ${dayName} r/${eventSubs[2]}`),
        // Food - use r/subreddit pattern like chat.ts
        geminiSearchWithSources(`best restaurants NYC hidden gems highly rated r/${foodSubs[0]}`),
        geminiSearchWithSources(`NYC restaurant recommendations r/${foodSubs[1]}`),
        geminiSearchWithSources(`where to eat NYC this weekend r/${foodSubs[2]}`),
        // Scrape event sites
        scrapeWithJina('https://theskint.com/'),
        scrapeWithJina('https://www.timeout.com/newyork/things-to-do/this-weekend'),
        scrapeWithJina('https://www.ohmyrockness.com/features.atom')
    ]);

    // Merge event sources
    const eventSources = [
        ...eventSearch1.sources,
        ...eventSearch2.sources,
        ...eventSearch3.sources
    ];
    const eventText = [eventSearch1.text, eventSearch2.text, eventSearch3.text].join('\n\n');

    // Merge food sources
    const foodSources = [
        ...foodSearch1.sources,
        ...foodSearch2.sources,
        ...foodSearch3.sources
    ];
    const foodText = [foodSearch1.text, foodSearch2.text, foodSearch3.text].join('\n\n');

    // Build scraped content with clear source labels
    const scraped = `=== THESKINT.COM (Events ${dateStr}) ===
${skintScrape}

=== TIMEOUT.COM (This Weekend) ===
${timeoutScrape}

=== OHMYROCKNESS.COM (Live Music) ===
${ohmyrocknessScrape}

TODAY IS: ${dayName}, ${dateStr}
Use ONLY events with dates that match today, tomorrow, or this weekend.`;

    return {
        events: { text: eventText, sources: eventSources },
        food: { text: foodText, sources: foodSources },
        scraped
    };
}

// ============= TASTE ANALYSIS =============

interface TasteProfile {
    cuisinePreferences: string[];
    vibePreferences: string[];
    priceRange: string;
    neighborhoods: string[];
    eventTypes: string[];
    interests: string[]; // For "see" places: history, science, art, etc.
}

async function analyzeTasteProfile(places: any[], userPreferences?: any): Promise<TasteProfile> {
    if (!places || places.length === 0) {
        return {
            cuisinePreferences: [],
            vibePreferences: [],
            priceRange: 'moderate',
            neighborhoods: [],
            eventTypes: [],
            interests: []
        };
    }

    const placesSummary = places.slice(0, 30).map(p => {
        const parts = [p.name];
        if (p.cuisine) parts.push(`(${p.cuisine})`);
        if (p.type) parts.push(`[${p.type}]`);
        if (p.subtype) parts.push(`{${p.subtype}}`);
        if (p.address) parts.push(`@${p.address.split(',')[0]}`);
        return parts.join(' ');
    }).join('\n');

    // Build user preferences text if available
    const userPrefsText = userPreferences ? `
User's stated preferences from onboarding:
- Food cuisines: ${userPreferences.food_cuisines?.join(', ') || 'Not specified'}
- Event types: ${userPreferences.event_types?.join(', ') || 'Not specified'}
- Place types: ${userPreferences.place_types?.join(', ') || 'Not specified'}
- All tags: ${userPreferences.all_tags?.slice(0, 10).join(', ') || 'None'}
` : '';

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Analyze this user's saved places and extract their taste profile:

${userPrefsText}

SAVED PLACES:
${placesSummary}

Return JSON only:
{
    "cuisinePreferences": ["cuisine1", "cuisine2"],
    "vibePreferences": ["cozy", "upscale", "casual", etc],
    "priceRange": "budget|moderate|upscale|mixed",
    "neighborhoods": ["neighborhood1", "neighborhood2"],
    "eventTypes": ["concerts", "comedy", "art", etc],
    "interests": ["history", "science", "art", "music", "nature", "architecture", etc]
}

IMPORTANT:
- For "interests": Analyze their saved museums, attractions, and events to infer subject interests
  Examples: If they saved history museums → "history", science museums → "science", art galleries → "art"
  Look for patterns: multiple art places = "art", multiple history places = "history", etc.
- Combine user's stated preferences (from onboarding) with patterns from saved places
- If user stated preferences exist, prioritize those but also validate against saved places` }]
            }]
        });

        const text = response.text || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('[Taste Analysis] Failed:', error);
    }

    return {
        cuisinePreferences: [],
        vibePreferences: [],
        priceRange: 'moderate',
        neighborhoods: [],
        eventTypes: [],
        interests: []
    };
}

// ============= DIGEST GENERATION =============

function getTimeOfDay(): string {
    // Use NYC timezone (Eastern Time)
    const nycTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const hour = new Date(nycTime).getHours();
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
    research: Awaited<ReturnType<typeof researchForDigest>>,
    userPreferences?: any
): Promise<{ intro_text: string; recommendations: DigestRec[]; next_batch: DigestRec[] }> {

    // Get old saved food spots to bump (sorted by oldest first)
    const savedFood = userPlaces
        .filter(p => ['restaurant', 'bar', 'cafe'].includes(p.type?.toLowerCase() || ''))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, 5);

    const savedNames = new Set(userPlaces.map(p => p.name.toLowerCase()));

    // Analyze taste profile using AI (same as generate.ts) - includes user preferences
    const tasteProfile = await analyzeTasteProfile(userPlaces, userPreferences);
    const cuisineList = tasteProfile.cuisinePreferences.length > 0
        ? tasteProfile.cuisinePreferences.join(', ')
        : 'varied cuisines';
    const vibeList = tasteProfile.vibePreferences.length > 0
        ? tasteProfile.vibePreferences.join(', ')
        : '';
    const tasteHint = `${cuisineList}${vibeList ? `, ${vibeList}` : ''}` || 'varied tastes';

    // Get user personas
    const primaryPersona = userPreferences?.primary_persona || '';
    const secondaryPersona = userPreferences?.secondary_persona || '';
    const personaText = primaryPersona ? `${primaryPersona}${secondaryPersona ? ` with ${secondaryPersona} tendencies` : ''}` : '';

    // Build available sources list for the AI to cite
    const availableSources = [
        ...research.events.sources.map(s => `${s.domain}: ${s.url}`),
        ...research.food.sources.map(s => `${s.domain}: ${s.url}`),
        'theskint.com: https://theskint.com/',
        'timeout.com: https://www.timeout.com/newyork/things-to-do/this-weekend',
        'ohmyrockness.com: https://www.ohmyrockness.com/'
    ].slice(0, 20).join('\n');

    const prompt = `You are Spot. Generate a daily digest for ${userName}.

USER PERSONA: ${personaText || 'Adventurous explorer'}

TASTE PROFILE (in order of importance):
1. INTERESTS & PASSIONS: ${tasteProfile.interests?.join(', ') || 'varied interests'}
2. CUISINE PREFERENCES: ${tasteProfile.cuisinePreferences.join(', ') || 'varied cuisines'}
3. VIBE PREFERENCES: ${tasteProfile.vibePreferences.join(', ') || 'flexible vibes'}
4. PRICE RANGE: ${tasteProfile.priceRange || 'moderate'}
5. NEIGHBORHOODS (least important): ${tasteProfile.neighborhoods.join(', ') || 'all NYC'}

=== AVAILABLE SOURCES (cite these!) ===
${availableSources}

=== EVENTS ===
${research.events.text.substring(0, 4000)}
${research.scraped.substring(0, 3000)}

=== FOOD ===
${research.food.text.substring(0, 3000)}

DO NOT RECOMMEND (already saved): ${Array.from(savedNames).slice(0, 30).join(', ')}

Generate exactly 21 recommendations in 2:1 pattern (EVENT, EVENT, FOOD, repeat 7 times).
So 14 events + 7 food items.

CRITICAL - DATES:
- ONLY use dates that appear in the scraped content above
- If an event says "Saturday December 14" use that EXACT date
- If you can't find the date in the sources, DON'T include the event
- Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}

CRITICAL - SOURCES:
- For each recommendation, include the source where you found it
- Use the FULL grounding URL from the AVAILABLE SOURCES section above
- Format: "sources": [{"domain": "reddit.com", "url": "https://vertexaisearch..."}]
- If from scraped sites: {"domain": "theskint.com", "url": "https://theskint.com/"}

Return JSON:
{
    "intro_text": "While you were [something fun], I found some gems...",
    "recommendations": [
        {"name": "Event Name", "type": "event", "description": "Perfect for you because...", "location": "Venue, Neighborhood", "isEvent": true, "startDate": "2024-12-15", "mainCategory": "see", "subtype": "Concert", "sources": [{"domain": "theskint.com", "url": "https://theskint.com/"}]},
        {"name": "Restaurant", "type": "restaurant", "description": "Since you love Italian...", "location": "Neighborhood", "isEvent": false, "mainCategory": "eat", "subtype": "Italian", "recommendedDishes": ["Pasta"], "sources": [{"domain": "reddit.com", "url": "https://vertexaisearch..."}]}
    ]
}

CRITICAL FORMATTING:
- NEVER use underscores in descriptions! Write naturally: "budget friendly" not "budget_friendly"
- All text should be human-readable, conversational prose

PERSONALIZATION PRIORITY (match to their persona: ${personaText || 'explorer'}):
1. FIRST reference their INTERESTS: ${tasteProfile.interests?.join(', ') || 'exploration, culture'}
2. THEN reference CUISINE/VIBE preferences: ${tasteProfile.cuisinePreferences.join(', ') || 'varied'}
3. ONLY mention location if it's a strong match

- Follow the 2:1 pattern (event, event, food, event, event, food...)
- Events MUST have accurate dates from the research
- Food needs recommendedDishes`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-pro',
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

        // FIRST: Check if digest already exists - look for ANY digest in the last 12 hours
        // This is more reliable than date-based checks which can fail due to timezone issues
        const now = new Date();
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

        console.log(`[Digest] Checking for existing digest for user ${userId} since ${twelveHoursAgo.toISOString()}`);

        const { data: existingDigests, error: checkError } = await db
            .from('daily_digests')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', twelveHoursAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (checkError) {
            console.error(`[Digest] Error checking for existing digest:`, checkError);
        }

        console.log(`[Digest] Query returned ${existingDigests?.length || 0} digests`);

        const existingDigest = existingDigests && existingDigests.length > 0 ? existingDigests[0] : null;

        if (existingDigest) {
            const allRecs = existingDigest.recommendations || [];
            console.log(`[Digest] Found existing digest ID: ${existingDigest.id}, created: ${existingDigest.created_at}, recs: ${allRecs.length}`);

            // If it has recommendations, return it
            if (allRecs.length > 0) {
                console.log(`[Digest] ✅ Returning existing digest with ${allRecs.length} recommendations`);
                const recommendations = allRecs.slice(0, 15);
                const next_batch = allRecs.slice(15, 21);

                return res.status(200).json({
                    success: true,
                    hasDigest: true,
                    digest: {
                        id: existingDigest.id,
                        greeting: existingDigest.greeting,
                        weather: existingDigest.weather,
                        intro_text: existingDigest.intro_text,
                        recommendations: recommendations,
                        next_batch: next_batch,
                        shown_ids: existingDigest.shown_ids,
                        created_at: existingDigest.created_at
                    }
                });
            }

            // It's a placeholder (empty recs) - check if stale
            const createdAt = new Date(existingDigest.created_at);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            if (createdAt < fiveMinutesAgo) {
                // Stale placeholder - delete it and regenerate
                console.log(`[Digest] ⚠️ Stale placeholder (${createdAt.toISOString()}), deleting and regenerating...`);
                await db.from('daily_digests').delete().eq('id', existingDigest.id);
                // Fall through to create new digest
            } else {
                // Recent placeholder - another request is generating
                console.log(`[Digest] ⏳ Another request is generating (placeholder age: ${(Date.now() - createdAt.getTime()) / 1000}s), returning generating status`);
                return res.status(202).json({
                    success: true,
                    hasDigest: false,
                    generating: true,
                    message: 'Digest is being generated, please wait...'
                });
            }
        }

        console.log(`[Digest] 🚀 Starting new digest generation...`);

        // IMMEDIATELY create a placeholder digest to prevent race conditions
        // Other requests will find this and wait or see "generating" status
        console.log(`[Digest] Creating placeholder...`);
        const { data: placeholder, error: placeholderError } = await db
            .from('daily_digests')
            .insert({
                user_id: userId,
                weather: null,
                greeting: 'Generating...',
                intro_text: 'Curating your personalized recommendations...',
                recommendations: [], // Empty - signals "still generating"
                shown_ids: []
            })
            .select()
            .single();

        if (placeholderError) {
            // If insert failed, another request might have just created one - check again
            console.log(`[Digest] Placeholder insert failed:`, placeholderError.message);
            const { data: raceCheck } = await db
                .from('daily_digests')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', twelveHoursAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            if (raceCheck && raceCheck.length > 0) {
                const existing = raceCheck[0];
                // If it has recommendations, return it; otherwise, tell frontend to wait
                if (existing.recommendations && existing.recommendations.length > 0) {
                    console.log(`[Digest] Found completed digest from race condition`);
                    const allRecs = existing.recommendations || [];
                    return res.status(200).json({
                        success: true,
                        hasDigest: true,
                        digest: {
                            id: existing.id,
                            greeting: existing.greeting,
                            weather: existing.weather,
                            intro_text: existing.intro_text,
                            recommendations: allRecs.slice(0, 15),
                            next_batch: allRecs.slice(15, 21),
                            shown_ids: existing.shown_ids,
                            created_at: existing.created_at
                        }
                    });
                } else {
                    // Another request is generating, tell frontend to wait
                    console.log(`[Digest] Another request is generating, returning generating status`);
                    return res.status(202).json({
                        success: true,
                        hasDigest: false,
                        generating: true,
                        message: 'Digest is being generated, please wait...'
                    });
                }
            }
        }

        const placeholderId = placeholder?.id;
        console.log(`[Digest] ✅ Created placeholder with ID: ${placeholderId}`);

        // Now do the expensive generation
        console.log(`[Digest] 📡 Fetching weather, research, user data in parallel...`);
        const [weather, research, userResult, placesResult, prefsResult] = await Promise.all([
            fetchNYCWeather(),
            researchForDigest(),
            db.from('users').select('name').eq('id', userId).single(),
            db.from('places').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
            db.from('user_preferences').select('*').eq('user_id', userId).single()
        ]);

        console.log(`[Digest] ✅ Data fetched: weather=${weather?.temp}°F, user=${userResult.data?.name}, places=${placesResult.data?.length || 0}`);
        console.log(`[Digest] 📝 Research: events=${research.events.sources.length} sources, food=${research.food.sources.length} sources`);

        const userName = userResult.data?.name || 'there';
        const places = placesResult.data || [];
        const userPreferences = prefsResult.data || null;

        // Generate digest with AI
        console.log(`[Digest] 🤖 Calling Gemini to generate digest...`);
        const digest = await generateDigest(userName, places, research, userPreferences);
        console.log(`[Digest] ✅ AI generated ${digest.recommendations.length} + ${digest.next_batch.length} recommendations`);

        // UPDATE the placeholder with real data (instead of inserting new)
        const allRecs = [...digest.recommendations, ...digest.next_batch];
        console.log(`[Digest] 💾 Updating placeholder ${placeholderId} with ${allRecs.length} recs...`);

        const { data: saved, error: updateError } = await db
            .from('daily_digests')
            .update({
                weather,
                greeting: `Good ${getTimeOfDay()} ${userName}`,
                intro_text: digest.intro_text,
                recommendations: allRecs, // Store all 21
                shown_ids: []
            })
            .eq('id', placeholderId)
            .select()
            .single();

        if (updateError) {
            console.error(`[Digest] ❌ Failed to update placeholder:`, updateError);
            // Still return the digest even if DB save fails (user can still see it)
        } else {
            console.log(`[Digest] ✅ DB updated successfully!`);
        }

        console.log(`[Digest] 🎉 Done in ${Date.now() - start}ms with ${digest.recommendations.length} + ${digest.next_batch.length} recs`);

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
