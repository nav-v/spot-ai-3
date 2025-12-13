import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= RESEARCH TOOL CONFIGURATION =============

// Base subreddits that are ALWAYS searched for each tool type
const TOOL_SUBREDDITS = {
    research_food: ['nyc', 'AskNYC', 'FoodNYC', 'NYCbitcheswithtaste', 'newyorkcity'],
    research_places: ['nyc', 'AskNYC', 'NYCbitcheswithtaste', 'newyorkcity'],
    research_events: ['nyc', 'AskNYC', 'NYCbitcheswithtaste', 'newyorkcity']
};

// Food sites to scrape directly as backup
const FOOD_SCRAPE_SITES = [
    'https://ny.eater.com/maps/best-new-restaurants-nyc',
    'https://www.theinfatuation.com/new-york/guides/best-new-restaurants-nyc'
];

// Event sites to SCRAPE with Jina.ai (handles JS rendering)
const EVENT_SCRAPE_SITES = [
    'https://theskint.com/',
    'https://www.ohmyrockness.com/features.atom',  // RSS feed - cleaner structured data
    'https://edmtrain.com/new-york-city-ny',
    'https://www.timeout.com/newyork/things-to-do/this-weekend',
    'https://ny-event-radar.com'  // Art exhibitions, jazz, markets
];

// Location-specific subreddits - AI picks from these based on query
const LOCATION_SUBREDDITS: Record<string, string[]> = {
    // Manhattan neighborhoods
    manhattan: ['manhattan'],
    harlem: ['Harlem'],
    east_village: ['EastVillage'],
    upper_east_side: ['TheUpperEastSide'],
    upper_west_side: ['Upperwestside'],
    washington_heights: ['WashingtonHeights'],
    inwood: ['Inwood'],
    west_village: ['WestVillage'],
    chelsea: ['ChelseaNYC'],

    // Brooklyn - borough-wide + neighborhoods
    brooklyn: ['Brooklyn', 'BayRidge', 'BedStuy', 'Bushwick', 'CarrollGardens', 'ConeyIsland', 'DitmasPark', 'DowntownBrooklyn', 'DUMBO', 'Flatbush', 'fortgreene', 'Greenpoint', 'ParkSlope', 'Williamsburg'],
    bay_ridge: ['BayRidge'],
    bed_stuy: ['BedStuy'],
    bushwick: ['Bushwick'],
    carroll_gardens: ['CarrollGardens'],
    coney_island: ['ConeyIsland'],
    ditmas_park: ['DitmasPark'],
    downtown_brooklyn: ['DowntownBrooklyn'],
    dumbo: ['DUMBO'],
    flatbush: ['Flatbush'],
    fort_greene: ['fortGreene'],
    greenpoint: ['Greenpoint'],
    park_slope: ['ParkSlope'],
    williamsburg: ['Williamsburg'],

    // Queens - borough-wide + neighborhoods
    queens: ['Queens', 'astoria', 'Bayside', 'Flushing', 'ForestHills', 'jacksonheights', 'longislandcity', 'ridgewood', 'Woodhaven', 'woodside'],
    astoria: ['astoria'],
    bayside: ['Bayside'],
    flushing: ['Flushing'],
    forest_hills: ['ForestHills'],
    jackson_heights: ['jacksonheights'],
    lic: ['longislandcity'],
    long_island_city: ['longislandcity'],
    ridgewood: ['ridgewood'],
    woodhaven: ['Woodhaven'],
    woodside: ['woodside'],

    // Bronx
    bronx: ['Bronx']
};

// Flatten all location subreddits for validation
const ALL_LOCATION_SUBREDDITS = [...new Set(Object.values(LOCATION_SUBREDDITS).flat())];

// ============= LAZY INITIALIZATION =============

let supabase: SupabaseClient;
function getSupabase(token?: string) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzxmplnrozabftmmuchx.supabase.co';
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eG1wbG5yb3phYmZ0bW11Y2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjQ5NTIsImV4cCI6MjA4MDcwMDk1Mn0.ZvX-wGttZr5kWNP_Svxqfvl7Vyd2_L6MW8-Wy7j_ANg';

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

let ai: GoogleGenAI;
function getAI() {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    return ai;
}

// ============= HELPER FUNCTIONS =============

// Extract single JSON action from text
function extractAction(text: string): { action: any; match: string } | null {
    const match = text.match(/\{\s*"action":/);
    if (!match || match.index === undefined) return null;

    const startIndex = match.index;
    let braceCount = 0;
    let endIndex = -1;

    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        else if (text[i] === '}') braceCount--;

        if (braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }

    if (endIndex !== -1) {
        try {
            const jsonStr = text.substring(startIndex, endIndex);
            const action = JSON.parse(jsonStr);
            return { action, match: jsonStr };
        } catch (e) {
            console.error("[extractAction] Failed to parse JSON", e);
        }
    }
    return null;
}

// Extract ALL JSON actions from text (for multiple tool calls)
function extractAllActions(text: string): { action: any; match: string }[] {
    const actions: { action: any; match: string }[] = [];
    let remainingText = text;
    let safety = 0;

    while (safety < 10) { // Prevent infinite loops
        safety++;
        const extracted = extractAction(remainingText);
        if (!extracted) break;

        actions.push(extracted);
        // Remove the found action from remaining text
        const idx = remainingText.indexOf(extracted.match);
        if (idx === -1) break;
        remainingText = remainingText.substring(idx + extracted.match.length);
    }

    console.log(`[extractAllActions] Found ${actions.length} actions in text`);
    return actions;
}

// Interface for research tools
interface ResearchTool {
    tool: 'research_food' | 'research_places' | 'research_events' | 'analyse_saved_food' | 'analyse_saved_see';
    query?: string;
    subreddits?: string[];
    dates?: string;
}

// Interface for taste profile from analysis
interface TasteProfile {
    inferences: string[];
    cuisinePreferences: string[];
    priceRange: string;
    vibePreferences: string[];
    locationPreferences: string[];
    interests?: string[]; // For "see" places: history, science, art, music, nature, architecture, etc.
}

// Count categories from user's saved places for explicit preference matching
function countUserPreferences(places: any[]): {
    cuisineCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    neighborhoodCounts: Record<string, number>;
    topCuisines: string[];
    topTypes: string[];
    topNeighborhoods: string[];
} {
    const cuisineCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const neighborhoodCounts: Record<string, number> = {};

    for (const p of places) {
        // Count cuisines
        if (p.cuisine) {
            const cuisine = p.cuisine.toLowerCase();
            cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
        }
        // Count types
        if (p.type) {
            const type = p.type.toLowerCase();
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        // Extract neighborhood from address
        if (p.address) {
            const neighborhoods = ['williamsburg', 'east village', 'west village', 'soho', 'tribeca',
                'lower east side', 'upper east side', 'upper west side', 'chelsea', 'midtown',
                'brooklyn', 'queens', 'harlem', 'bushwick', 'greenpoint', 'dumbo', 'park slope',
                'astoria', 'flushing', 'jackson heights', 'crown heights', 'bed-stuy', 'cobble hill'];
            for (const n of neighborhoods) {
                if (p.address.toLowerCase().includes(n)) {
                    neighborhoodCounts[n] = (neighborhoodCounts[n] || 0) + 1;
                    break;
                }
            }
        }
    }

    // Sort and get top preferences
    const sortByCount = (obj: Record<string, number>) =>
        Object.entries(obj).sort((a, b) => b[1] - a[1]);

    return {
        cuisineCounts,
        typeCounts,
        neighborhoodCounts,
        topCuisines: sortByCount(cuisineCounts).slice(0, 5).map(([k, v]) => `${k} (${v})`),
        topTypes: sortByCount(typeCounts).slice(0, 5).map(([k, v]) => `${k} (${v})`),
        topNeighborhoods: sortByCount(neighborhoodCounts).slice(0, 5).map(([k, v]) => `${k} (${v})`)
    };
}

// Interface for place mentions with cross-corroboration scoring
interface PlaceMention {
    name: string;
    normalizedName: string;
    sources: string[];
    quotes: string[];
    mentionCount: number;
    score: number;
    location?: string;
    type?: string;
}

// Normalize place names for comparison
function normalizePlaceName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[''`]/g, "'")
        .replace(/[^a-z0-9\s']/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^the\s+/, '')
        .trim();
}

// Build cross-corroboration map from multiple sources
function buildCrossCorroborationMap(
    redditResults: any[],
    webSources: { text: string; source: string }[]
): Map<string, PlaceMention> {
    const mentionMap = new Map<string, PlaceMention>();

    // Process Reddit results
    for (const post of redditResults) {
        // Extract potential place names from title and text (simple heuristic)
        const textToAnalyze = `${post.title} ${post.text}`.toLowerCase();
        const source = post.source || `r/${post.subreddit}`;

        // This is a simplified extraction - the full AI will do better
        // For now, just track the post as a potential source
        const normalizedTitle = normalizePlaceName(post.title);

        if (!mentionMap.has(normalizedTitle)) {
            mentionMap.set(normalizedTitle, {
                name: post.title,
                normalizedName: normalizedTitle,
                sources: [source],
                quotes: [post.text?.slice(0, 200) || ''],
                mentionCount: 1,
                score: 10 + Math.log(post.upvotes + 1) * 2
            });
        } else {
            const existing = mentionMap.get(normalizedTitle)!;
            if (!existing.sources.includes(source)) {
                existing.sources.push(source);
                existing.mentionCount++;
                existing.score += 15; // Bonus for cross-source mention
            }
            if (post.text) {
                existing.quotes.push(post.text.slice(0, 200));
            }
        }
    }

    console.log(`[Cross-Corroboration] Built map with ${mentionMap.size} unique mentions`);

    // Calculate final scores
    for (const [key, mention] of mentionMap) {
        // Score = mentionCount * 10 + uniqueSourceCount * 5
        mention.score = mention.mentionCount * 10 + mention.sources.length * 5;
    }

    return mentionMap;
}

// Get top cross-corroborated places
function getTopCorroboratedPlaces(mentionMap: Map<string, PlaceMention>, limit: number = 15): PlaceMention[] {
    return Array.from(mentionMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// ============= PARALLEL RESEARCH EXECUTION ENGINE =============

interface ResearchResults {
    webResults: { text: string; textWithCitations: string; sources: any[]; citations: any[] };
    eventScrapedContent: string;
    tasteProfile: TasteProfile | null;
    toolsUsed: string[];
}

async function executeSmartResearch(
    tools: ResearchTool[],
    userPlaces: any[],
    userPreferences: any,
    userId?: string
): Promise<ResearchResults> {
    console.log(`[Smart Research] Executing ${tools.length} research tools in parallel`);

    const results: ResearchResults = {
        webResults: { text: '', textWithCitations: '', sources: [], citations: [] },
        eventScrapedContent: '',
        tasteProfile: null,
        toolsUsed: []
    };

    // Group tools by type for efficient execution
    const foodTools = tools.filter(t => t.tool === 'research_food');
    const placesTools = tools.filter(t => t.tool === 'research_places');
    const eventsTools = tools.filter(t => t.tool === 'research_events');
    const analyseFoodTools = tools.filter(t => t.tool === 'analyse_saved_food');
    const analyseSeeTools = tools.filter(t => t.tool === 'analyse_saved_see');

    // Build parallel execution promises
    const promises: Promise<void>[] = [];

    // Helper to add a Gemini search promise
    const addSearch = (searchQuery: string, label: string) => {
        promises.push(
            (async () => {
                try {
                    console.log(`[Smart Research] ${label}: ${searchQuery.substring(0, 70)}...`);
                    const searchResult = await singleGeminiSearch(searchQuery);
                    results.webResults.text += `\n=== ${label} ===\n${searchResult.text}\n`;
                    results.webResults.textWithCitations += `\n=== ${label} ===\n${searchResult.textWithCitations}\n`;
                    results.webResults.sources.push(...searchResult.sources);
                    results.webResults.citations.push(...searchResult.citations);
                    console.log(`[Smart Research] ${label} returned ${searchResult.sources.length} sources`);
                } catch (e: any) {
                    console.error(`[Smart Research] ${label} failed:`, e.message);
                }
            })()
        );
    };

    // RESEARCH_FOOD: Subreddit searches + Gemini search for food publications
    if (foodTools.length > 0) {
        results.toolsUsed.push('research_food');
        const tool = foodTools[0];
        const query = tool.query || 'best food';
        const locationSubs = tool.subreddits || [];

        console.log(`[Smart Research] research_food: query="${query}", location subreddits: ${locationSubs.join(', ') || 'none'}`);

        // Base subreddits - one Gemini search each
        const baseFoodSubs = TOOL_SUBREDDITS.research_food;
        for (const sub of baseFoodSubs) {
            addSearch(`${query} NYC r/${sub}`, `r/${sub}`);
        }

        // Location-specific subreddits - one Gemini search each
        for (const sub of locationSubs) {
            addSearch(`${query} r/${sub}`, `r/${sub}`);
        }

        // Food publications via Gemini search (articles/reviews, not lists - so search is better than scraping)
        addSearch(`${query} NYC Eater`, 'Eater NY');
        addSearch(`${query} NYC NY Times food`, 'NY Times Food');
        addSearch(`${query} NYC The Infatuation`, 'The Infatuation NYC');
    }

    // RESEARCH_PLACES: Subreddit searches + scrape TimeOut
    if (placesTools.length > 0) {
        results.toolsUsed.push('research_places');
        const tool = placesTools[0];
        const query = tool.query || 'things to do';
        const locationSubs = tool.subreddits || [];

        console.log(`[Smart Research] research_places: query="${query}", location subreddits: ${locationSubs.join(', ') || 'none'}`);

        // Base subreddits - Gemini search
        const basePlacesSubs = TOOL_SUBREDDITS.research_places;
        for (const sub of basePlacesSubs) {
            addSearch(`${query} NYC r/${sub}`, `r/${sub}`);
        }

        // Location-specific subreddits - Gemini search
        for (const sub of locationSubs) {
            addSearch(`${query} r/${sub}`, `r/${sub}`);
        }

        // Scrape TimeOut directly
        promises.push(
            (async () => {
                try {
                    const url = `https://www.timeout.com/newyork/search?q=${encodeURIComponent(query)}`;
                    const result = await scrapeWebsite(url);
                    if (result.success && result.content) {
                        results.webResults.text += `\n=== timeout.com ===\n${result.content}\n`;
                        console.log(`[Smart Research] Scraped TimeOut: ${result.content.length} chars`);
                    }
                } catch (e: any) {
                    console.error(`[Smart Research] TimeOut scrape failed:`, e.message);
                }
            })()
        );
    }

    // RESEARCH_EVENTS: Subreddit searches + direct scraping (no duplicate Gemini searches for scraped sites)
    if (eventsTools.length > 0) {
        results.toolsUsed.push('research_events');
        const tool = eventsTools[0];
        const query = tool.query || 'things to do december 2025';
        const dateFilter = tool.dates || '';
        const fullQuery = `${query} ${dateFilter}`.trim();

        console.log(`[Smart Research] research_events: query="${fullQuery}"`);

        // Subreddit searches via Gemini (these can't be scraped)
        const baseEventsSubs = TOOL_SUBREDDITS.research_events;
        for (const sub of baseEventsSubs) {
            addSearch(`${fullQuery} r/${sub}`, `r/${sub}`);
        }

        // Scrape all event sites directly
        promises.push(
            (async () => {
                try {
                    const eventScrape = await scrapeEventSites(dateFilter);
                    console.log(`[Smart Research] Event scrape returned ${eventScrape.rawContent.length} chars`);
                    results.eventScrapedContent = eventScrape.rawContent;
                } catch (e: any) {
                    console.error(`[Smart Research] Event scrape failed:`, e.message);
                }
            })()
        );
    }

    // ANALYSE_SAVED_FOOD: Taste analysis (Gemini 2.5 Pro)
    if (analyseFoodTools.length > 0) {
        results.toolsUsed.push('analyse_saved_food');
        console.log(`[Smart Research] analyse_saved_food: analyzing ${userPlaces.length} places`);

        promises.push(
            (async () => {
                try {
                    results.tasteProfile = await analyseSavedPlaces(userPlaces, 'food', userPreferences, userId);
                    console.log(`[Smart Research] Food taste analysis: ${results.tasteProfile?.inferences?.length || 0} inferences`);
                } catch (e: any) {
                    console.error(`[Smart Research] Food taste analysis failed:`, e.message);
                }
            })()
        );
    }

    // ANALYSE_SAVED_SEE: Taste analysis for non-food
    if (analyseSeeTools.length > 0) {
        results.toolsUsed.push('analyse_saved_see');
        console.log(`[Smart Research] analyse_saved_see: analyzing ${userPlaces.length} places`);

        promises.push(
            (async () => {
                try {
                    const seeProfile = await analyseSavedPlaces(userPlaces, 'see', userPreferences, userId);
                    console.log(`[Smart Research] See taste analysis: ${seeProfile?.inferences?.length || 0} inferences`);
                    // Merge with existing taste profile or set as new
                    if (results.tasteProfile) {
                        results.tasteProfile.inferences.push(...seeProfile.inferences);
                        results.tasteProfile.vibePreferences.push(...seeProfile.vibePreferences);
                        // Merge interests if available
                        if (seeProfile.interests && seeProfile.interests.length > 0) {
                            results.tasteProfile.interests = [
                                ...(results.tasteProfile.interests || []),
                                ...seeProfile.interests
                            ];
                        }
                    } else {
                        results.tasteProfile = seeProfile;
                    }
                } catch (e: any) {
                    console.error(`[Smart Research] See taste analysis failed:`, e.message);
                }
            })()
        );
    }

    // Execute all in parallel
    console.log(`[Smart Research] Starting ${promises.length} parallel tasks...`);
    await Promise.all(promises);

    console.log(`[Smart Research] Completed. Web sources: ${results.webResults.sources.length}, Event content: ${results.eventScrapedContent.length} chars, Taste inferences: ${results.tasteProfile?.inferences?.length || 0}`);

    return results;
}

// Remove ALL JSON actions from text
function stripAllActions(text: string): string {
    let currentText = text;
    let extracted;
    do {
        extracted = extractAction(currentText);
        if (extracted) {
            currentText = currentText.replace(extracted.match, '').trim();
        }
    } while (extracted);

    // Clean up markdown artifacts
    currentText = currentText.replace(/```json\s*```/g, '');
    currentText = currentText.replace(/```\s*```/g, '');
    currentText = currentText.replace(/```json\s*$/g, '');
    currentText = currentText.replace(/```\s*$/g, '');

    return currentText.trim();
}

// ============= GOOGLE PLACES API =============

async function searchGooglePlaces(placeName: string, location: string = 'New York, NY') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
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
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.types,places.photos,places.editorialSummary,places.location'
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
        console.log(`[Google Places] Found: ${place.displayName?.text}`);

        // Get photo URL if available
        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoName = place.photos[0].name;
            imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${apiKey}`;
        }

        // Determine type
        let type = 'restaurant';
        const types = place.types || [];
        if (types.some((t: string) => t.includes('bar'))) type = 'bar';
        else if (types.some((t: string) => t.includes('cafe'))) type = 'cafe';
        else if (types.some((t: string) => t.includes('museum') || t.includes('art_gallery'))) type = 'attraction';
        else if (types.some((t: string) => t.includes('park'))) type = 'attraction';

        return {
            name: place.displayName?.text || placeName,
            type,
            address: place.formattedAddress || location,
            description: place.editorialSummary?.text || '',
            sourceUrl: place.websiteUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
            imageUrl,
            rating: place.rating || null,
            coordinates: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null
        };
    } catch (error) {
        console.error('[Google Places] API error:', error);
        return null;
    }
}

// ============= TASTE ANALYSIS (Gemini 2.5 Pro) =============

async function analyseSavedPlaces(
    places: any[],
    type: 'food' | 'see',
    userPreferences?: any,
    userId?: string
): Promise<TasteProfile> {
    console.log(`[Taste Analysis] Analyzing ${places.length} places for type: ${type}`);

    // Fetch user preferences from database if not provided and userId is available
    let dbPreferences = null;
    if (!userPreferences && userId) {
        try {
            const { data } = await getSupabase()
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();
            dbPreferences = data;
        } catch (error) {
            console.log(`[Taste Analysis] Could not fetch user preferences for ${userId}`);
        }
    }

    // Use provided preferences or database preferences
    const prefs = userPreferences || dbPreferences;

    // Filter places by type
    const foodTypes = ['restaurant', 'bar', 'cafe', 'food', 'drinks'];
    const seeTypes = ['activity', 'attraction', 'museum', 'park', 'entertainment'];

    const filtered = type === 'food'
        ? places.filter(p => foodTypes.includes((p.type || 'restaurant').toLowerCase()))
        : places.filter(p => seeTypes.includes((p.type || '').toLowerCase()) || p.is_event);

    if (filtered.length === 0) {
        console.log(`[Taste Analysis] No ${type} places found, returning empty profile`);
        return {
            inferences: [],
            cuisinePreferences: [],
            priceRange: 'moderate',
            vibePreferences: [],
            locationPreferences: [],
            interests: []
        };
    }

    // Build a summary of saved places for analysis
    const placesSummary = filtered.slice(0, 30).map(p => {
        const parts = [p.name];
        if (p.cuisine) parts.push(`(${p.cuisine})`);
        if (p.type) parts.push(`[${p.type}]`);
        if (p.subtype) parts.push(`{${p.subtype}}`);
        if (p.address) parts.push(`@ ${p.address}`);
        if (p.rating) parts.push(`Rating: ${p.rating}`);
        if (p.notes) parts.push(`Notes: ${p.notes}`);
        if (p.is_favorite) parts.push('★ FAVORITE');
        if (p.is_visited) parts.push('✓ VISITED');
        return parts.join(' ');
    }).join('\n');

    // Build user preferences text from database format
    const userPrefsText = prefs ? `
User's stated preferences from onboarding:
- Food cuisines: ${prefs.food_cuisines?.join(', ') || prefs.foodPreferences?.join(', ') || 'Not specified'}
- Event types: ${prefs.event_types?.join(', ') || prefs.eventTypes?.join(', ') || 'Not specified'}
- Place types: ${prefs.place_types?.join(', ') || prefs.placeTypes?.join(', ') || 'Not specified'}
- All tags: ${prefs.all_tags?.slice(0, 10).join(', ') || 'None'}
- Dietary: ${prefs.dietary_vegetarian ? 'Vegetarian' : ''} ${prefs.dietary_vegan ? 'Vegan' : ''} ${prefs.dietary_halal ? 'Halal' : ''} ${prefs.dietary_gluten_free ? 'Gluten-free' : ''}
` : '';

    const prompt = `You are a taste analyst creating a deep psychological profile. Based on these saved ${type === 'food' ? 'restaurants/food spots' : 'places/activities'}, infer 10-25 DETAILED observations about this person's tastes, preferences, and personality.

${userPrefsText}

SAVED ${type.toUpperCase()} PLACES:
${placesSummary}

Analyze patterns and return a JSON object with:
{
  "inferences": [
    "DETAILED inference 1 - at least 2-3 sentences explaining the observation with reasoning",
    "DETAILED inference 2 - at least 2-3 sentences...",
    ...
  ],
  "cuisinePreferences": ["Italian", "Japanese", ...], // for food, or ["Museums", "Outdoor activities", ...] for see
  "priceRange": "budget" | "moderate" | "upscale" | "mixed",
  "vibePreferences": ["cozy", "trendy", "casual", ...],
  "locationPreferences": ["Williamsburg", "East Village", ...], // neighborhoods they seem to favor
  ${type === 'see' ? '"interests": ["history", "science", "art", "music", "nature", "architecture", etc], // Subject interests inferred from saved museums/attractions' : ''}
}

INFERENCE RULES:
- Each inference MUST be 2-3 sentences minimum, not just a phrase
- Explain the WHY behind the observation - what does this say about them?
- Go deep into psychology: what motivates them? what do they value?
- Connect multiple data points when possible ("They saved X and Y, which suggests...")
- Be specific about patterns, not generic observations
- Include insights about: decision-making style, social preferences, adventure level, authenticity vs convenience, nostalgia, cultural curiosity
${type === 'see' ? '- For "interests": Analyze their saved museums, attractions, and events to infer subject interests\n  Examples: If they saved history museums → "history", science museums → "science", art galleries → "art", music venues → "music"\n  Look for patterns: multiple art places = "art", multiple history places = "history", nature parks = "nature", etc.' : ''}
- Combine user's stated preferences (from onboarding) with patterns from saved places
- If user stated preferences exist, prioritize those but also validate against saved places

Example good inference:
"This person appears to value depth over breadth in their cultural experiences. Rather than checking off famous landmarks, they gravitate toward specialized museums (Transit Museum, Philip Williams Posters) that offer niche expertise. This suggests someone who researches thoroughly before visiting and wants to learn something specific, not just 'see the sights.'"

Return ONLY the JSON object, no other text.`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash', // Fast pattern extraction (Pro not needed)
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const text = response.text || '';
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const profile = JSON.parse(cleanJson);

        console.log(`[Taste Analysis] Generated ${profile.inferences?.length || 0} inferences`);
        return profile;
    } catch (error: any) {
        console.error('[Taste Analysis] Error:', error.message);
        return {
            inferences: [],
            cuisinePreferences: [],
            priceRange: 'moderate',
            vibePreferences: [],
            locationPreferences: [],
            interests: []
        };
    }
}

// ============= REDDIT API =============

async function searchRedditMultiQuery(
    queries: string[],
    baseSubreddits: string[] = ['foodnyc', 'AskNYC'],
    locationSubreddits: string[] = []
) {
    const results: any[] = [];

    // Merge base subreddits with location-specific ones, removing duplicates
    const allSubreddits = [...new Set([...baseSubreddits, ...locationSubreddits])];

    console.log(`[Reddit] Running ${queries.length} queries across ${allSubreddits.length} subreddits`);
    console.log(`[Reddit] Base: ${baseSubreddits.join(', ')}`);
    if (locationSubreddits.length > 0) {
        console.log(`[Reddit] Location-specific: ${locationSubreddits.join(', ')}`);
    }

    for (const subreddit of allSubreddits) {
        for (const query of queries) {
            try {
                const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=5&sort=relevance`;
                console.log(`[Reddit] Searching r/${subreddit} for: ${query}`);

                const response = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive',
                    }
                });

                if (!response.ok) {
                    console.log(`[Reddit] r/${subreddit} returned ${response.status}`);
                    // If rate limited, wait a bit
                    if (response.status === 429) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                    continue;
                }

                const data = await response.json();
                const posts = data?.data?.children || [];

                for (const post of posts) {
                    const p = post.data;
                    if (!results.find(r => r.url === `https://reddit.com${p.permalink}`)) {
                        results.push({
                            title: p.title,
                            url: `https://reddit.com${p.permalink}`,
                            subreddit: p.subreddit,
                            author: p.author,
                            upvotes: p.ups,
                            text: p.selftext?.slice(0, 500) || '',
                            numComments: p.num_comments,
                            source: `r/${p.subreddit}`
                        });
                    }
                }

                console.log(`[Reddit] Found ${posts.length} posts`);
            } catch (error: any) {
                console.error(`[Reddit] Error:`, error.message);
            }
        }
    }

    results.sort((a, b) => (b.upvotes + b.numComments) - (a.upvotes + a.numComments));
    return results.slice(0, 20); // Increased limit for more options
}

async function getRedditComments(postUrl: string) {
    try {
        const jsonUrl = postUrl.replace(/\/?$/, '.json');
        console.log(`[Reddit] Fetching comments from: ${jsonUrl}`);

        const response = await fetch(jsonUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) return [];

        const data = await response.json();
        const comments = data[1]?.data?.children || [];

        return comments.slice(0, 15).map((c: any) => ({
            author: c.data?.author,
            text: c.data?.body?.slice(0, 500),
            upvotes: c.data?.ups || 0
        })).filter((c: any) => c.text && c.upvotes >= 0).sort((a: any, b: any) => b.upvotes - a.upvotes);
    } catch (error: any) {
        console.error(`[Reddit] Error fetching comments:`, error.message);
        return [];
    }
}

// ============= FIRECRAWL SCRAPING =============

// ============= SIMPLE WEB SCRAPER (no external API needed) =============

async function scrapeWebsite(url: string): Promise<{ success: boolean; content: string; error?: string }> {
    console.log(`[Jina] Scraping: ${url}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 20s timeout

        // Use Jina.ai Reader API - handles JS rendering, returns clean markdown
        const jinaUrl = `https://r.jina.ai/${url}`;

        const response = await fetch(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.log(`[Jina] HTTP ${response.status} for ${url}`);
            return { success: false, content: '', error: `HTTP ${response.status}` };
        }

        let text = await response.text();

        // Limit content length
        if (text.length > 10000) {
            text = text.substring(0, 10000) + '...';
        }

        console.log(`[Jina] SUCCESS for ${url}: ${text.length} chars`);
        return { success: true, content: text };

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log(`[Jina] TIMEOUT for ${url}`);
            return { success: false, content: '', error: 'Timeout' };
        }
        console.error(`[Jina] ERROR for ${url}:`, error.message);
        return { success: false, content: '', error: error.message };
    }
}

// Scraper function - uses Jina.ai directly (faster than Firecrawl)
async function scrapeWithFirecrawl(url: string) {
    // Skip Firecrawl entirely - go straight to Jina for speed
    const result = await scrapeWebsite(url);
    return {
        success: result.success,
        data: { markdown: result.content },
        error: result.error
    };
}

// Placeholder to match old structure
async function _unusedFirecrawl(url: string) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        const result = await scrapeWebsite(url);
        return {
            success: result.success,
            data: { markdown: result.content },
            error: result.error
        };
    }

    console.log(`[Firecrawl] Scraping URL: ${url}`);
    try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                timeout: 30000
            }),
        });
        const result = await response.json();

        if (!result.success) {
            console.log(`[Firecrawl] FAILED for ${url}: ${result.error || 'Unknown error'}`);
            console.log(`[Firecrawl] Falling back to simple scraper...`);
            const fallbackResult = await scrapeWebsite(url);
            return {
                success: fallbackResult.success,
                data: { markdown: fallbackResult.content },
                error: fallbackResult.error
            };
        }

        console.log(`[Firecrawl] SUCCESS for ${url}: ${result.data?.markdown?.length || 0} chars`);
        return result;
    } catch (error: any) {
        console.error(`[Firecrawl] Exception for ${url}:`, error.message);
        // Fallback to simple scraper on exception
        const fallbackResult = await scrapeWebsite(url);
        return {
            success: fallbackResult.success,
            data: { markdown: fallbackResult.content },
            error: fallbackResult.error
        };
    }
}

// ============= EVENT SITE SCRAPER =============

interface ScrapedEvent {
    name: string;
    venue?: string;
    date?: string;
    description?: string;
    url?: string;
    source: string;
}

async function scrapeEventSites(dateFilter?: string): Promise<{ events: ScrapedEvent[]; rawContent: string }> {
    console.log(`[Event Scraper] Scraping ${EVENT_SCRAPE_SITES.length} event sites in parallel...`);
    if (dateFilter) {
        console.log(`[Event Scraper] Date filter: ${dateFilter}`);
    }

    const scrapePromises = EVENT_SCRAPE_SITES.map(async (url) => {
        try {
            console.log(`[Event Scraper] Scraping: ${url}`);
            const result = await scrapeWithFirecrawl(url);

            if (result.success && result.data?.markdown) {
                const content = result.data.markdown.slice(0, 4000); // Increased limit for event data
                const sourceName = new URL(url).hostname.replace('www.', '');
                console.log(`[Event Scraper] Got ${content.length} chars from ${sourceName}`);

                return {
                    content: `\n--- ${sourceName.toUpperCase()} ---\n${content}\n`,
                    source: sourceName,
                    url
                };
            }
        } catch (e: any) {
            console.error(`[Event Scraper] Error scraping ${url}:`, e.message);
        }
        return null;
    });

    const results = await Promise.all(scrapePromises);
    const validResults = results.filter(r => r !== null);

    // Combine all raw content for AI parsing
    const rawContent = validResults.map(r => r!.content).join('\n');

    console.log(`[Event Scraper] Successfully scraped ${validResults.length}/${EVENT_SCRAPE_SITES.length} sites`);
    console.log(`[Event Scraper] Total content: ${rawContent.length} chars`);

    // Return raw content - the recommender AI will parse it
    return {
        events: [], // Will be parsed by the recommender
        rawContent
    };
}

// ============= WEB SEARCH WITH GROUNDING =============

interface VerifiedSource {
    title: string;
    url: string;
}

interface GeminiSearchResult {
    text: string;
    textWithCitations: string;  // Text with inline [1](url) citations
    sources: VerifiedSource[];
    citations: GroundingCitation[];
    searchQueries: string[];
}

// Citation structure from Gemini grounding
interface GroundingCitation {
    text: string;           // The text segment that is grounded
    sourceIndex: number;    // Which chunk it references
    startIndex?: number;
    endIndex?: number;
}

interface SearchResultWithCitations {
    text: string;
    textWithCitations: string;  // Text with inline [1], [2] citations
    sources: VerifiedSource[];
    citations: GroundingCitation[];
}

// Single search helper - extracts native Gemini citations
async function singleGeminiSearch(searchQuery: string): Promise<SearchResultWithCitations> {
    const searchPrompt = `Find information about: ${searchQuery}

Based on your search results, write a helpful summary of the NYC places, events, or restaurants mentioned. 

For each place you find, include:
- The place name
- The neighborhood/location
- Why people recommend it (summarize the sentiment)

Write in a natural, readable format - NOT as raw search results or JSON. 
Synthesize the information into a cohesive response.
Only mention places that actually appear in the search results.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY || '',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: searchPrompt }] }],
                    tools: [{ google_search: {} }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
                }),
                signal: controller.signal
            }
        );
        clearTimeout(timeoutId);

        const data = await response.json();
        if (data.error) {
            console.error(`[Gemini Search] Error for "${searchQuery}":`, data.error.message);
            return { text: '', textWithCitations: '', sources: [], citations: [] };
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const groundingMetadata = data.candidates?.[0]?.groundingMetadata;

        // Extract sources from groundingChunks
        const sources: VerifiedSource[] = [];
        if (groundingMetadata?.groundingChunks) {
            for (const chunk of groundingMetadata.groundingChunks) {
                if (chunk.web?.uri) {
                    // Use title if available, otherwise try to extract from URI or use placeholder
                    let title = chunk.web.title || '';

                    // Log what we're getting
                    console.log(`[Grounding] Chunk: title="${title}", uri="${chunk.web.uri?.substring(0, 60)}..."`);

                    // If title is just a domain or empty, try to make it more useful
                    if (!title || title.length < 10 || title === 'reddit.com') {
                        // Will be enriched later with citation text
                        title = `Source ${sources.length + 1}`;
                    }

                    sources.push({ title, url: chunk.web.uri });
                }
            }
        }

        // Enrich source titles with citation text where possible
        if (groundingMetadata?.groundingSupports && sources.length > 0) {
            for (const support of groundingMetadata.groundingSupports) {
                if (support.segment?.text && support.groundingChunkIndices?.length > 0) {
                    const idx = support.groundingChunkIndices[0];
                    if (sources[idx] && sources[idx].title.startsWith('Source ')) {
                        // Use first 80 chars of citation as title
                        sources[idx].title = support.segment.text.substring(0, 80) + (support.segment.text.length > 80 ? '...' : '');
                    }
                }
            }
        }

        // Extract citations from groundingSupports - this tells us which text is backed by which source!
        const citations: GroundingCitation[] = [];
        if (groundingMetadata?.groundingSupports) {
            for (const support of groundingMetadata.groundingSupports) {
                if (support.segment?.text && support.groundingChunkIndices?.length > 0) {
                    citations.push({
                        text: support.segment.text,
                        sourceIndex: support.groundingChunkIndices[0],
                        startIndex: support.segment.startIndex,
                        endIndex: support.segment.endIndex
                    });
                }
            }
        }

        // Build text with inline citations [1], [2], etc.
        let textWithCitations = text;
        // Sort citations by position (reverse order to not mess up indices)
        const sortedCitations = [...citations].sort((a, b) => (b.endIndex || 0) - (a.endIndex || 0));
        for (const citation of sortedCitations) {
            if (citation.endIndex && sources[citation.sourceIndex]) {
                const sourceNum = citation.sourceIndex + 1;
                const url = sources[citation.sourceIndex].url;
                // Insert citation link after the grounded text
                const insertPos = citation.endIndex;
                textWithCitations = textWithCitations.slice(0, insertPos) +
                    ` [${sourceNum}](${url})` +
                    textWithCitations.slice(insertPos);
            }
        }

        console.log(`[Gemini Search] "${searchQuery}" → ${sources.length} sources, ${citations.length} citations`);
        return { text, textWithCitations, sources, citations };
    } catch (e: any) {
        console.error(`[Gemini Search] Failed "${searchQuery}":`, e.message);
        return { text: '', textWithCitations: '', sources: [], citations: [] };
    }
}

async function callGeminiWithSearch(query: string, queryType: string = 'food'): Promise<GeminiSearchResult> {
    console.log(`[Gemini Search] Running parallel searches for: "${query}" (type: ${queryType})`);

    let searchQueries: string[];

    if (queryType === 'food') {
        // Food: Reddit food communities + trusted food publications
        searchQueries = [
            `${query} r/AskNYC`,
            `${query} r/foodnyc`,
            `${query} r/nyc`,
            `${query} site:ny.eater.com`,
            `${query} site:theinfatuation.com/new-york`
        ];
    } else if (queryType === 'event' || queryType === 'show') {
        // Events: Reddit + event publications
        searchQueries = [
            `${query} r/AskNYC`,
            `${query} r/nyc`,
            `${query} site:timeout.com/newyork`,
            `${query} site:secretnyc.co`,
            `${query} site:theskint.com`
        ];
    } else {
        // General: Mix of Reddit and publications
        searchQueries = [
            `${query} r/AskNYC`,
            `${query} r/nyc`,
            `${query} site:timeout.com/newyork`,
            `${query} site:ny.eater.com`
        ];
    }

    console.log(`[Gemini Search] Queries:`, searchQueries);

    // Run all searches in parallel
    const results = await Promise.all(searchQueries.map(q => singleGeminiSearch(q)));

    // Combine results with citations
    let combinedText = '';
    let combinedTextWithCitations = '';
    let allSources: VerifiedSource[] = [];
    let allCitations: GroundingCitation[] = [];

    results.forEach((result, i) => {
        if (result.text) {
            combinedText += `\n=== FROM: ${searchQueries[i]} ===\n${result.text}\n`;
            combinedTextWithCitations += `\n=== FROM: ${searchQueries[i]} ===\n${result.textWithCitations}\n`;
        }
        // Track source offset for combined citations
        const sourceOffset = allSources.length;
        allSources = [...allSources, ...result.sources];
        // Adjust citation indices for combined list
        allCitations = [...allCitations, ...result.citations.map(c => ({
            ...c,
            sourceIndex: c.sourceIndex + sourceOffset
        }))];
    });

    console.log(`[Gemini Search] Combined: ${combinedText.length} chars, ${allSources.length} sources, ${allCitations.length} citations`);

    return {
        text: combinedText,
        textWithCitations: combinedTextWithCitations,
        sources: allSources,
        citations: allCitations,
        searchQueries
    };
}

async function searchWeb(query: string): Promise<{ text: string; textWithCitations: string; sources: VerifiedSource[]; citations: GroundingCitation[] }> {
    console.log(`[Web Search] Researching: ${query}`);

    const queryLower = query.toLowerCase();

    const eventKeywords = ['event', 'show', 'play', 'concert', 'market', 'festival', 'exhibit', 'museum',
        'theater', 'theatre', 'movie', 'things to do', 'activities', 'attraction', 'holiday', 'christmas',
        'popup', 'pop-up', 'happening'];

    const foodKeywords = ['food', 'restaurant', 'eat', 'dinner', 'lunch', 'brunch', 'breakfast',
        'pizza', 'sushi', 'burger', 'coffee', 'bar', 'drinks', 'cocktail', 'croissant', 'bakery', 'cafe',
        'date night', 'romantic', 'date spot'];

    const isFoodQuery = foodKeywords.some(kw => queryLower.includes(kw));
    const isEventQuery = eventKeywords.some(kw => queryLower.includes(kw));
    const isShowQuery = ['movie', 'film', 'cinema', 'theater', 'theatre', 'broadway', 'play', 'musical', 'show'].some(kw => queryLower.includes(kw));

    // Detect mixed intent (both food and event)
    const isMixed = isFoodQuery && (isEventQuery || isShowQuery);

    // Decide primary type for logging; mixed triggers both searches
    let queryType = 'food';
    if (isMixed) queryType = 'mixed';
    else if (isShowQuery) queryType = 'show';
    else if (isEventQuery) queryType = 'event';
    else if (isFoodQuery) queryType = 'food';

    console.log(`[Web Search] Query type: ${queryType} (food=${isFoodQuery}, event=${isEventQuery}, show=${isShowQuery})`);

    let allText = '';
    let allSources: VerifiedSource[] = [];

    // DISABLED: Legacy event scraping - smart research now handles all event sites
    // Event sites are scraped in executeSmartResearch via scrapeEventSites()
    console.log('[Web Search] Skipping legacy event scraping - smart research handles it');

    // DISABLED: General Gemini searches - smart research now handles everything with targeted site: queries
    // All searches are now done in executeSmartResearch with specific site: operators
    console.log('[Web Search] Skipping general Gemini search - smart research handles all targeted searches');

    let allTextWithCitations = allText;
    let allCitations: GroundingCitation[] = [];

    return {
        text: allText || "No results found.",
        textWithCitations: allTextWithCitations || "No results found.",
        sources: allSources,
        citations: allCitations
    };
}

// ============= SOCIAL MEDIA SCRAPING =============

async function scrapeSocialMetadata(url: string) {
    console.log(`[Metadata Scraper] Fetching: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            },
            redirect: 'follow'
        });

        const html = await response.text();

        const patterns = [
            /<meta\s+property="og:description"\s+content="([^"]*)"/i,
            /<meta\s+content="([^"]*)"\s+property="og:description"/i,
            /<meta\s+name="description"\s+content="([^"]*)"/i,
            /<meta\s+content="([^"]*)"\s+name="description"/i,
            /<meta\s+property="og:title"\s+content="([^"]*)"/i,
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[1].length > 10) {
                console.log(`[Metadata Scraper] Found description: ${match[1].substring(0, 100)}...`);
                return match[1];
            }
        }

        // Fallback to Firecrawl
        const firecrawlResult = await scrapeWithFirecrawl(url);
        if (firecrawlResult.success && firecrawlResult.data?.markdown) {
            return firecrawlResult.data.markdown.substring(0, 500);
        }

    } catch (error) {
        console.error(`[Metadata Scraper] Error:`, error);
    }
    return null;
}

// ============= RESERVATION FINDER =============

async function findReservationOptions(restaurantName: string, location: string) {
    const searchDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const partySize = 2;

    const bookingLinks: any = {};
    bookingLinks.google = `https://www.google.com/maps/search/${encodeURIComponent(restaurantName + ' ' + location)}`;
    bookingLinks.openTable = `https://www.opentable.com/s?dateTime=${searchDate}T19%3A00&covers=${partySize}&term=${encodeURIComponent(restaurantName)}`;
    bookingLinks.resy = `https://resy.com/cities/ny?date=${searchDate}&seats=${partySize}&query=${encodeURIComponent(restaurantName)}`;

    return { bookingLinks, date: searchDate, partySize };
}

// ============= FIND AND ADD PLACE =============

async function findAndAddPlace(placeName: string, location: string = 'New York, NY', extraData: any = {}, userId: string | null = null, token?: string) {
    if (!userId) {
        return { added: false, message: 'No user ID provided' };
    }

    // Check if already exists
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
            description: '',
            sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(placeName + ' ' + location)}`,
            imageUrl: '',
            coordinates: null,
            rating: null
        };
    }

    // CATEGORIZATION LOGIC - determines Eat vs See tab
    const isEvent = extraData.isEvent || false;
    let mainCategory: 'eat' | 'see' = (place as any).mainCategory || 'eat';
    let subtype = (place as any).subtype || 'Restaurant';

    if (isEvent) { mainCategory = 'see'; subtype = 'Event'; }
    const seeTypes = ['activity', 'attraction', 'museum', 'park', 'theater', 'shopping', 'landmark', 'gallery', 'entertainment', 'show', 'concert', 'festival'];
    if (extraData.type && seeTypes.includes(extraData.type.toLowerCase())) { mainCategory = 'see'; subtype = extraData.type.charAt(0).toUpperCase() + extraData.type.slice(1); }

    let startDate = extraData.startDate || null;
    let endDate = extraData.endDate || null;
    if (isEvent && !startDate) startDate = new Date().toISOString().split('T')[0];
    if (isEvent && !endDate) endDate = startDate;

    const newPlace = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        name: place.name,
        type: place.type || 'restaurant',
        main_category: mainCategory,
        subtype: subtype,
        subtypes: [],
        cuisine: extraData.cuisine || null,
        address: place.address || '',
        description: place.description || extraData.description || null,
        image_url: place.imageUrl || null,
        source_url: place.sourceUrl || null,
        coordinates: place.coordinates || null,
        is_visited: false,
        is_favorite: true,
        notes: null,
        review: null,
        rating: place.rating || null,
        start_date: startDate,
        end_date: endDate,
        is_event: isEvent,
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

// ============= SPEED MODE (3-CALL FAST FLOW) =============

// Call 1: Decide if research is needed, and if so, which sources to use
async function decideAndPrepareSearch(userMessage: string): Promise<{
    needsResearch: boolean;
    directResponse?: string;
    query?: string;
    subreddits?: string[]
}> {
    const availableSubs = [
        ...TOOL_SUBREDDITS.research_food,
        ...TOOL_SUBREDDITS.research_places,
        ...TOOL_SUBREDDITS.research_events,
        ...ALL_LOCATION_SUBREDDITS
    ];
    const uniqueSubs = [...new Set(availableSubs)];

    const prompt = `You are Spot, an NYC recommendation assistant. Given a user message, decide if you need to search for information.

USER MESSAGE: "${userMessage}"

AVAILABLE SUBREDDITS: ${uniqueSubs.join(', ')}

DECIDE:
- If this is a greeting, simple question, or something you can answer directly → respond directly
- If this asks for specific places, restaurants, events, or recommendations → you need to search

Output JSON only:
{
  "needsResearch": true/false,
  "directResponse": "Your friendly response if no research needed",
  "query": "search query if research needed",
  "subreddits": ["sub1", "sub2"] 
}

RULES for subreddits (if research needed):
- Pick 2-4 max from the AVAILABLE SUBREDDITS list
- Always include at least one base sub (AskNYC, FoodNYC, nyc)
- Add location-specific subs if query mentions a neighborhood`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const match = (response.text || '{}').match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            console.log(`[SpeedMode] Decision: needsResearch=${parsed.needsResearch}`);

            if (!parsed.needsResearch) {
                return {
                    needsResearch: false,
                    directResponse: parsed.directResponse || "Hey! How can I help you find something today?"
                };
            }

            return {
                needsResearch: true,
                query: parsed.query || userMessage,
                subreddits: (parsed.subreddits || ['AskNYC', 'FoodNYC']).slice(0, 4)
            };
        }
    } catch (e) {
        console.error('[SpeedMode] decideAndPrepareSearch error:', e);
    }

    // Default: assume research is needed
    return { needsResearch: true, query: userMessage, subreddits: ['AskNYC', 'FoodNYC', 'nyc'] };
}

// Call 2: Targeted Gemini grounding search with specific subreddits
async function targetedGeminiSearch(query: string, subreddits: string[]): Promise<{ text: string; sources: Array<{ domain: string; url: string }> }> {
    const subPattern = subreddits.map(s => `r/${s}`).join(' ');
    const searchQuery = `${query} NYC ONLY results from ${subPattern}`;

    console.log(`[SpeedMode] Searching: "${searchQuery}"`);

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: searchQuery }] }],
            config: { tools: [{ googleSearch: {} }] }
        });

        const sources: Array<{ domain: string; url: string }> = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of chunks) {
            if (chunk.web?.uri) {
                try {
                    const domain = new URL(chunk.web.uri).hostname.replace('www.', '');
                    if (!domain.includes('vertexaisearch') && !domain.includes('googleapis')) {
                        sources.push({ domain, url: chunk.web.uri });
                    }
                } catch { }
            }
        }

        console.log(`[SpeedMode] Search returned ${sources.length} sources`);
        return { text: response.text || '', sources };
    } catch (e) {
        console.error('[SpeedMode] targetedGeminiSearch error:', e);
        return { text: '', sources: [] };
    }
}

// Get cached taste profile from daily_digests (generated at 3am)
async function getCachedTasteProfile(userId: string, token?: string): Promise<TasteProfile | null> {
    try {
        const { data, error } = await getSupabase(token)
            .from('daily_digests')
            .select('taste_profile')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data?.taste_profile) {
            console.log('[SpeedMode] No cached taste profile found');
            return null;
        }

        console.log(`[SpeedMode] Using cached taste profile with ${data.taste_profile.inferences?.length || 0} inferences`);
        return data.taste_profile as TasteProfile;
    } catch (e) {
        console.error('[SpeedMode] getCachedTasteProfile error:', e);
        return null;
    }
}

// Call 3: Generate recommendations using search results + cached taste profile
async function generateSpeedRecommendations(
    searchResults: { text: string; sources: Array<{ domain: string; url: string }> },
    tasteProfile: TasteProfile | null,
    userName: string,
    userMessage: string
): Promise<{ text: string; places: any[] }> {
    const tasteContext = tasteProfile?.inferences?.length
        ? `USER TASTE PROFILE:\n${tasteProfile.inferences.slice(0, 5).join('\n')}`
        : '';

    const prompt = `You are Spot, a friendly NYC recommendation assistant.

${tasteContext}

USER ASKED: "${userMessage}"

SEARCH RESULTS:
${searchResults.text.substring(0, 4000)}

Based on the search results, give ${userName} 3-5 specific recommendations.

Write a SHORT intro (1-2 sentences), then output JSON:
{
  "action": "recommendPlaces",
  "places": [
    {"name": "Place Name", "type": "restaurant", "description": "Why it's great", "location": "Neighborhood", "sources": [{"domain": "reddit.com", "url": "..."}]}
  ]
}

Keep descriptions concise. Reference the taste profile if available.`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
        let places: any[] = [];

        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                places = parsed.places || [];
                // Attach sources from search if not present
                for (const place of places) {
                    if (!place.sources?.length && searchResults.sources.length > 0) {
                        place.sources = searchResults.sources.slice(0, 2);
                    }
                }
            } catch { }
        }

        // Extract intro text (before the JSON)
        const introMatch = text.match(/^([\s\S]*?)(?=\{)/);
        const intro = introMatch ? introMatch[1].trim() : text.split('{')[0].trim();

        console.log(`[SpeedMode] Generated ${places.length} recommendations`);
        return { text: intro, places };
    } catch (e) {
        console.error('[SpeedMode] generateSpeedRecommendations error:', e);
        return { text: "I found some options for you!", places: [] };
    }
}

// Main speed mode handler
async function handleSpeedMode(
    userMessage: string,
    userName: string,
    userId: string,
    token?: string
): Promise<{ response: string; recommendations: any[] }> {
    console.log('[SpeedMode] ========== SPEED MODE START ==========');
    const startTime = Date.now();

    // Call 1: Decide if research is needed
    const decision = await decideAndPrepareSearch(userMessage);
    console.log(`[SpeedMode] Call 1 done: ${Date.now() - startTime}ms`);

    // If no research needed, return direct response
    if (!decision.needsResearch) {
        console.log(`[SpeedMode] ========== NO RESEARCH NEEDED: ${Date.now() - startTime}ms ==========`);
        return { response: decision.directResponse || "Hey! How can I help?", recommendations: [] };
    }

    // Call 2: Targeted search
    const searchResults = await targetedGeminiSearch(decision.query || userMessage, decision.subreddits || ['AskNYC', 'FoodNYC']);
    console.log(`[SpeedMode] Call 2 done: ${Date.now() - startTime}ms`);

    // Get cached taste profile (don't generate new one - that's slow!)
    const tasteProfile = await getCachedTasteProfile(userId, token);

    // Call 3: Generate recommendations
    const result = await generateSpeedRecommendations(searchResults, tasteProfile, userName, userMessage);
    console.log(`[SpeedMode] Call 3 done: ${Date.now() - startTime}ms`);
    console.log(`[SpeedMode] ========== SPEED MODE COMPLETE: ${Date.now() - startTime}ms ==========`);

    return { response: result.text, recommendations: result.places };
}

// ============= MAIN HANDLER =============

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
        const { messages, userName, userPreferences, userId, speedMode } = req.body;
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

        const today = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();

        // Get the last user message
        const lastUserMessage = messages?.filter((m: any) => m.role === 'user').pop()?.content || '';

        console.log(`[Chat API] ========== REQUEST START ==========`);
        console.log(`[Chat API] userId: "${userId}", userName: "${userName}", speedMode: ${speedMode}`);

        // ============= SPEED MODE (3-call fast flow) =============
        if (speedMode && lastUserMessage && userId) {
            try {
                const result = await handleSpeedMode(lastUserMessage, userName || 'friend', userId, token);

                // Format response like regular chat
                const responseText = result.recommendations.length > 0
                    ? `${result.response}\n\n${JSON.stringify({ action: 'recommendPlaces', places: result.recommendations })}`
                    : result.response;

                return res.status(200).json({
                    content: result.response,
                    recommendations: result.recommendations,
                    speedMode: true
                });
            } catch (e) {
                console.error('[SpeedMode] Error, falling back to normal mode:', e);
                // Fall through to normal mode
            }
        }

        // Fetch user's places from Supabase (for non-speed mode)
        let userPlaces: any[] = [];
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
            }
        }

        // Build places context
        const placesContext = userPlaces.length > 0
            ? userPlaces.map((p: any) => {
                const status = p.is_visited ? 'VISITED' : 'Not visited';
                const fav = p.is_favorite ? ', FAVORITED' : '';
                const rating = p.rating ? `, Rating: ${p.rating}/5` : '';
                const dateAdded = p.created_at ? ` | Added: ${p.created_at.split('T')[0]}` : '';
                return `- ${p.name} (${p.cuisine || p.type}) at ${p.address} - ${status}${fav}${rating}${dateAdded}`;
            }).join('\n')
            : '- No places saved yet!';

        // Build user context
        const userContext = userName ? `\n\nUSER INFO:\n- Name: ${userName}${userPreferences?.dietaryRestrictions?.length ? `\n- Dietary Restrictions: ${userPreferences.dietaryRestrictions.join(', ')}` : ''}${userPreferences?.interests?.length ? `\n- Interests: ${userPreferences.interests.join(', ')}` : ''}${userPreferences?.foodPreferences?.length ? `\n- Food Preferences: ${userPreferences.foodPreferences.join(', ')}` : ''}\n\nIMPORTANT: Address the user by their name (${userName}) occasionally.` : '';

        const systemPrompt = `You are Spot – a warm, funny, slightly dramatic AI that helps people track and discover places. You talk like that slightly extra friend who is weirdly good at remembering places and always "knows a spot."

Current Date: ${today}${userContext}

PERSONALITY:
- Casual, playful, a little dramatic (in a fun way)
- Make quick jokes and mini roasts about situations (never about the user)
- Self-aware about planning chaos: "We both know 'early dinner' means you'll show up at 8:15"
- Celebrate small outings: "Tiny outing? Still counts. Coffee + walk = main character energy ☕"
- Use emojis naturally but not excessively - i.e. only to denote categories, bulletpoints etc (✨, 🍕, 🍜, ☕, 😏)

SAMPLE LINES:
- Greeting: "Hey, it's Spot! Ready to 'just check a few places' and end up with a full plan?"
- Saved places: "You saved this back in March... officially in 'are we ever going or not?' territory"
- Adding: "Saved. Future you will thank present you for this"
- Indecisive user: "Totally normal to have no idea what you want. I'll throw out three vibes and you point at one like a menu."

RECOMMENDATION STYLE:
1. Give clear, neutral reasoning FIRST (location, cuisine, vibe, reviews, fit with their tastes)
2. Add ONE playful line AFTER the explanation – never let humor override clarity
3. **QUANTITY:** Always provide **up to 10 recommendations** (aim for 7-10) unless the user asks for a specific number.
Example: "This works for a small group: takes reservations, not too loud, strong 'we'll be here for three hours without noticing' energy."

HONESTY POLICY:
- Include BOTH positives AND negatives found in reviews - do NOT sugarcoat
- If a place has common complaints (slow service, small portions, cash only, loud, long waits), MENTION THEM
- Use phrases like "heads up:", "fair warning:", "some reviewers note...", "one caveat:"
- Example: "Amazing pasta, but heads up - it's cash only and the wait can hit 2 hours on weekends"
- Users trust honest recommendations. Being real about downsides builds credibility.

PLANNING / ITINERARIES (ANY PLAN, NOT JUST DATE NIGHT):
- Use clear sections with headings (flexible: Activities/Things to do, Food/Drinks, Dessert/Late-night). Pick only the sections that make sense for the request.
- For each section:
  1) Short, helpful intro (1-2 sentences) that explains WHY these fit the user (reference saved places/preferences/location/theme).
  2) Saved options first: brief line → cards (mark as "Saved pick", sourceName: "Saved list", sourceUrl: "").
  3) Found-online options next: brief line → cards from research.
- Make it obvious which cards are saved vs found online. Cards should appear inline right after the intro.
- Be slightly more verbose than before: a mini paragraph per section is fine; keep cards concise.
- COHESION: Prefer options clustered in the requested neighborhood/theme; avoid scattering across distant areas unless asked.

MUST-VISIT format: "This one's a Must-Visit for the neighborhood – locals swear by it. Not going at least once is basically illegal. (Not actually. But you know.)"

PERSONALIZATION:
- Analyze SAVED PLACES to understand taste ("You have a strong pasta theme... I respect the commitment to carbs 🍝")
- When giving recommendations:
  1. Prioritize places that match their saved preferences (e.g. "Since you like pizza...").
  2. ALWAYS include one "Neighborhood Icon" or "Unmissable Classic" for that specific area, even if it's a different cuisine. Label it as a "Must-Visit" for the neighborhood.
  3. Avoid random "wildcards" - only suggest places with high ratings or strong local reputation.
- Explicitly mention WHY you chose a place based on their list.
- If you have saved places that fit the ask, include them FIRST (mark as "Saved pick") before external research picks.

⚠️ ANTI-HALLUCINATION RULES (CRITICAL - READ CAREFULLY):
- **NEVER make up sources, quotes, or URLs.** If you don't have real data from a research action, you MUST use the research tool FIRST.
- **NEVER cite TimeOut, Secret NYC, Eater, Infatuation, etc. unless you have ACTUAL quotes from research results.**
- **ALWAYS RESEARCH FIRST:** If the user asks for recommendations of ANY kind (restaurants, things to do, attractions, events), you MUST output a research action FIRST. This applies even for well-known places!
- Do NOT recommend places until you have real data from research. Even if you "know" about famous places like AMNH or Central Park, RESEARCH FIRST to find current, relevant info.
- Use ONLY information returned by the research tool. If research returns nothing relevant, say so honestly.
- It's better to say "Let me look that up for you" than to make up information.
- The ONLY exception: If recommending places that are ALREADY on the user's saved list, you don't need to research those.

📅 DATE AWARENESS FOR EVENTS:
- Current date is ${today}.
- For EVENTS (holiday markets, plays, shows, pop-ups, movies): Only recommend events that are CURRENTLY HAPPENING or happening SOON (within the next 2 weeks).
- Do NOT recommend events from previous years or events that have already ended.
- When researching events, include the current year (${new Date().getFullYear()}) in your search query.
- If asked about "what's happening this week/month", filter results to that time frame.
- **EVENT NAMING:** If recommending an event (play, movie, market), name the item after the EVENT, not the location.
- **EVENTS MUST HAVE DATES:** When adding or recommending an event, ALWAYS include startDate and endDate if known. Set isEvent: true.
- If you don't know exact dates, estimate based on context (e.g., "holiday market" in December = startDate around early December).

SAVED PLACES:
${placesContext}

TOOLS & ACTIONS:
You have access to these tools. Output JSON actions ONLY when needed.

1. ADD PLACE / EVENT (NO RESEARCH NEEDED - just use this action directly):
If user says "Add [Place/Event Name] to my list":
{"action": "addPlace", "placeName": "NAME", "location": "CITY/NEIGHBORHOOD", "isEvent": boolean, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}
- **DO NOT RESEARCH** when adding a known place - just output the addPlace action immediately
- For EVENTS: Set isEvent: true. Name it after the EVENT.
- If you don't know the location, just put "New York, NY" - Google Places will find it.

2. ADD MULTIPLE PLACES / EVENTS:
If user provides a list or caption with multiple places/events and asks to add them:
{"action": "addMultiplePlaces", "places": [{"name": "Event/Place Name", "location": "Venue/Neighborhood", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "isEvent": true}]}
- For EVENTS (movies, plays, markets): Name it after the EVENT (e.g. "Sleep No More"), not the venue. Set isEvent: true.
- If it's a permanent place, omit startDate/endDate/isEvent.

3. FIND RESERVATIONS:
- **BE HELPFUL WITH LINKS**: If you tell the user to "check the website" or "book tickets", you MUST provide the actual URL if you have it (e.g., from the place details). Don't just say "check their site" without giving the link.
- **RESERVATIONS**: If asked for reservations, use the \`findReservations\` action.
- **NO CANCELLATIONS**: You cannot cancel reservations.
⚠️ IMPORTANT: You CANNOT see actual availability or time slots. NEVER make up specific times.
Response: "I can't check availability directly, but I've found the booking links for you! Check these out:"
{\"action\": \"findReservations\", \"restaurantName\": \"NAME\", \"partySize\": 2, \"date\": \"YYYY-MM-DD\"}

4. SMART RESEARCH (⚠️ REQUIRED BEFORE EXTERNAL RECOMMENDATIONS):
**You MUST use research tools before recommending ANY places not already on the user's saved list.**

YOU CAN USE MULTIPLE TOOLS AT ONCE! Output them as an array:
{"action": "smartResearch", "tools": [...]}

AVAILABLE RESEARCH TOOLS:

a) research_food - For restaurants, cafes, bars, food spots
   {"tool": "research_food", "query": "best pizza", "subreddits": ["Williamsburg", "Greenpoint"]}
   - Base subreddits (always searched): nyc, AskNYC, FoodNYC, NYCbitcheswithtaste, newyorkcity
   - Also searches: Eater, NY Times food section
   - Add location-specific subreddits if the query mentions a neighborhood!

b) research_places - For attractions, museums, activities (NON-FOOD)
   {"tool": "research_places", "query": "hidden gems", "subreddits": ["EastVillage"]}
   - Base subreddits: nyc, AskNYC, NYCbitcheswithtaste, newyorkcity
   - Add location-specific subreddits if relevant!

c) research_events - For events, shows, concerts, markets, pop-ups
   {"tool": "research_events", "query": "things to do december ${currentYear}", "dates": "this weekend"}
   - Base subreddits: nyc, AskNYC, NYCbitcheswithtaste, newyorkcity
   - ALSO SCRAPES these event sites: theskint.com, happeningsnyc.io, ohmyrockness.com, timeout.com, ra.co, edmtrain.com
   - For date-specific queries, start with "things to do [month] [year]" then narrow down

d) analyse_saved_food - Analyze user's saved restaurants to understand their taste
   {"tool": "analyse_saved_food"}
   - Returns 10-25 taste inferences based on their saved food spots
   - Use this when you want to give PERSONALIZED recommendations

e) analyse_saved_see - Analyze user's saved places/events to understand preferences  
   {"tool": "analyse_saved_see"}
   - Returns 10-25 preference inferences based on their saved activities
   - Use this for personalized non-food recommendations

LOCATION-SPECIFIC SUBREDDITS (pick relevant ones based on query):
Manhattan: manhattan, Harlem, EastVillage, TheUpperEastSide, Upperwestside, WashingtonHeights, Inwood, WestVillage, ChelseaNYC
Brooklyn: Brooklyn, BayRidge, BedStuy, Bushwick, CarrollGardens, ConeyIsland, DitmasPark, DowntownBrooklyn, DUMBO, Flatbush, fortGreene, Greenpoint, ParkSlope, Williamsburg
Queens: Queens, astoria, Bayside, Flushing, ForestHills, jacksonheights, longislandcity, ridgewood, Woodhaven, woodside
Bronx: Bronx

EXAMPLE - Complex query "romantic dinner in williamsburg this weekend":
{"action": "smartResearch", "tools": [
  {"tool": "research_food", "query": "romantic dinner date night", "subreddits": ["Williamsburg", "Brooklyn"]},
  {"tool": "research_events", "query": "things to do december ${currentYear}", "dates": "this weekend"},
  {"tool": "analyse_saved_food"}
]}

EXAMPLE - Simple food query "best ramen":
{"action": "smartResearch", "tools": [
  {"tool": "research_food", "query": "best ramen"},
  {"tool": "analyse_saved_food"}
]}

EXAMPLE - Events only "what's happening this weekend":
{"action": "smartResearch", "tools": [
  {"tool": "research_events", "query": "things to do december ${currentYear}", "dates": "this weekend"}
]}

⚠️ CRITICAL RULES:
- OUTPUT THE ACTION IMMEDIATELY. Do NOT just say "let me search" without the JSON!
- You MUST specify location-specific subreddits if the query mentions a neighborhood
- For events, ALWAYS include current year (${currentYear}) in the query
- Keep each query SHORT (3-6 words)
- Do NOT output recommendPlaces together with research

5. SCRAPE URL:
If user shares a link:
{"action": "scrapeUrl", "url": "THE_URL"}

6. RECOMMEND PLACES (⚠️ ALWAYS USE THIS whenever you mention ANY place in the chat):
**CRITICAL: Whenever you recommend ANY places to the user, you MUST output them as a recommendPlaces action with SECTIONS. NEVER just list places as plain text. The user expects to see interactive cards with photos grouped by theme.**

Format - GROUP places into 2-4 logical sections. EACH SECTION MUST HAVE AN "intro" FIELD:
{"action": "recommendPlaces", "sections": [
  {"title": "🥐 Flaky Classics", "intro": "These are the spots where they do one thing and do it perfectly - pure, buttery croissants with zero gimmicks. If you want to taste what all the fuss is about, start here.", "places": [
    {"name": "Place Name", "type": "restaurant", "description": "Short reason why you picked it...", "location": "Neighborhood/City", "isEvent": false, "recommendedDishes": ["Dish 1", "Dish 2"], "sources": [{"domain": "reddit.com", "url": "https://vertexaisearch.cloud.google.com/..."}, {"domain": "eater.com", "url": "https://vertexaisearch.cloud.google.com/..."}]}
  ]},
  {"title": "✨ Creative & Over-the-Top", "intro": "For when a regular croissant just isn't dramatic enough. These bakeries go wild with flavors, fillings, and Instagram-worthy creations.", "places": [...]}
]}

SECTION RULES:
- Create 2-4 sections based on context (e.g., for croissants: "Experimental/Creative", "Classic French"; for dates: "Activities", "Dinner", "Dessert/Drinks")
- Section titles should be descriptive and fun (e.g., "🥐 Flaky Classics", "✨ Wild & Creative", "🍝 Cozy Dinner Vibes")
- **EACH SECTION MUST HAVE AN "intro" FIELD** - a short, personality-filled paragraph (2-3 sentences) that:
  - Sets the vibe for that category
  - Explains what these spots have in common
  - References user preferences or saved list when relevant
  - Uses your casual, slightly dramatic Spot personality
- Put saved places in their own section OR mark them clearly within a section
- **TOTAL MAX 10 places** across all sections - distribute as you see fit based on what makes sense

Place fields:
- name: For RESTAURANTS/BARS/CAFES: the venue name. For EVENTS/CONCERTS: the EVENT name (e.g. "iHeartRadio Jingle Ball", NOT "Madison Square Garden")
- type: One of "restaurant", "bar", "cafe", "activity", "attraction", "event"
- description: 1-2 sentences why you chose this + any caveats/warnings from reviews (e.g., "Amazing tacos, but cash only and expect a 30min wait")
- location: For places: Neighborhood. For events: "Venue Name, Neighborhood" (e.g. "Madison Square Garden, Midtown")
- recommendedDishes: (FOR RESTAURANTS/CAFES/BARS ONLY) Array of 2-3 specific dishes mentioned in reviews. Extract actual dish names like ["Spicy Vodka Rigatoni", "Tiramisu"]. Omit this field for non-food places or if no specific dishes are mentioned.
- sources: Array of source objects with domain AND the actual URL. Include ALL sources:
  * From Gemini citations: Look at [1](url), [2](url) etc. - include the FULL vertexaisearch URL!
  * From scraped sections: Use the section URL (theskint.com, timeout.com, etc.)
  * Format: [{"domain": "reddit.com", "url": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/..."}, {"domain": "theskint.com", "url": "https://theskint.com/"}]
  * CRITICAL: Include the ACTUAL citation URLs from the research - these redirect to the real source!
- startDate: (REQUIRED for events) Date in "YYYY-MM-DD" format, or "Dec 13" if exact date unknown
- DO NOT include sourceUrl - we attach verified URLs from research automatically.
- DO NOT include sourceName or sourceQuote - these often get hallucinated

⚠️ EVENT CARDS: The card name MUST be the event/concert/show name, NOT the venue! 
   ✅ CORRECT: {"name": "iHeartRadio Jingle Ball", "location": "Madison Square Garden, Midtown", "startDate": "2025-12-13"}
   ❌ WRONG: {"name": "Madison Square Garden", "location": "Midtown"}

⚠️ CRITICAL: 
- **ALWAYS use sections** - even for simple queries, group into at least 2 sections (e.g., "From Your List" + "New Finds")
- **FILTER OUT PAST EVENTS** - Do NOT recommend events where startDate is before today's date

Keep responses conversational`;

        // Build conversation
        let conversationText = messages.map((m: any) =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        let fullPrompt = `${systemPrompt}

REMINDER: You MUST output a smartResearch action JSON if the user asks for recommendations. Do NOT just say "let me search" without including the JSON!

Conversation:
${conversationText}`;

        // First Gemini call
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash', // Fast action detection
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
        });

        let content = response.text || '';
        console.log("[Chat API] --- RAW GEMINI RESPONSE 1 ---");
        console.log(content.substring(0, 500) + '...');

        let actionResult = null;
        const extracted = extractAction(content);

        if (extracted) {
            const { action } = extracted;
            console.log('[Chat API] Detected action:', action.action);

            // ============= RESEARCH ACTION =============
            if (action.action === 'research' && (action.queries || action.query)) {
                const queries = (action.queries || [action.query]).slice(0, 2);
                console.log('[Chat API] ========================================');
                console.log('[Chat API] Starting PARALLEL Gemini grounding searches...');
                console.log('[Chat API] QUERIES:', queries);

                // Use Gemini grounding with r/subreddit patterns instead of direct Reddit API (avoids rate limits)
                const subreddits = ['AskNYC', 'FoodNYC', 'NYCbitcheswithtaste'];
                const redditSearchPromises = queries.flatMap(query =>
                    subreddits.slice(0, 2).map(sub =>
                        searchWeb(`${query} r/${sub}`) // Uses Gemini grounding
                    )
                );

                const webSearchPromise = searchWeb(queries[0]);
                const redditResults = await Promise.all(redditSearchPromises);

                console.log(`[Chat API] Gemini grounding returned ${redditResults.length} search results`);

                let searchResults = '';

                // Combine Reddit-focused Gemini grounding results
                const validRedditResults = redditResults.filter(r => r.text && r.text.length > 50);
                if (validRedditResults.length > 0) {
                    searchResults += '=== REDDIT RESULTS (via Gemini grounding) ===\n';
                    for (const result of validRedditResults) {
                        searchResults += result.textWithCitations + '\n\n';
                    }
                }

                // Wait for web search - now includes citations!
                const webResults = await webSearchPromise;

                // Use textWithCitations which has inline [N](url) citations from Gemini grounding
                searchResults += '\n=== WEB RESEARCH (with citations) ===\n' + webResults.textWithCitations;

                console.log(`[Research] ${webResults.citations.length} native Gemini citations found`);

                // Re-prompt Gemini - DO NOT ask for URLs, LLM always hallucinates them
                const researchPrompt = `${fullPrompt}\n${content}\n\n[SYSTEM: Research complete. Extract recommendations.

OUTPUT: Write a SHORT intro (1-2 sentences), then output the JSON action with SECTIONS.
DO NOT list places in text - only in the JSON!

JSON FORMAT - recommendPlaces action with SECTIONS (intro is REQUIRED):
{
  "action": "recommendPlaces",
  "sections": [
    {
      "title": "🥐 Flaky Classics",
      "intro": "These are the spots where they do one thing and do it perfectly - pure, buttery, flaky croissants with zero gimmicks. If you want to taste what all the fuss is about, start here.",
      "places": [
        {
          "name": "Place Name",
          "type": "restaurant",
          "description": "Why it's recommended (1-2 sentences)",
          "location": "Neighborhood",
          "sourceName": "Reddit",
          "sourceQuote": "Actual quote from research"
        }
      ]
    }
  ]
}

SECTION RULES:
- Create 2-4 logical sections based on the query type
- For food queries: group by style (e.g., "Classic", "Creative", "Budget-Friendly")
- For plans/dates: group by activity type (e.g., "Activities", "Dinner Spots", "Dessert & Drinks")
- If user has saved places that fit, put them in a "From Your List" or "Saved Picks" section FIRST
- **TOTAL MAX 10 places** across all sections - distribute as makes sense for the query
- Section titles should be descriptive and can include emojis
- **EACH SECTION MUST HAVE AN "intro" FIELD** - a short, personality-filled paragraph (2-3 sentences) that sets the vibe

RULES:
- sourceName should be simple: "Reddit", "Eater", "The Infatuation", "Saved list", etc.
- DO NOT include URLs
- DO NOT list places in text, ONLY in JSON
- Keep text response SHORT - just a fun intro!]

Research data:\n${searchResults}\n
Assistant:`;

                const secondResponse = await getAI().models.generateContent({
                    model: 'gemini-2.5-flash', // faster extraction
                    contents: [{ role: 'user', parts: [{ text: researchPrompt }] }]
                });

                content = secondResponse.text || '';
                console.log("[Chat API] --- RAW GEMINI RESPONSE 2 (After Research) ---");
                console.log(content.substring(0, 500) + '...');

                // Check for recommendPlaces action
                const secondExtracted = extractAction(content);
                console.log(`[Research] Extracted action:`, secondExtracted?.action?.action);

                // Handle both old (places) and new (sections) format
                const hasSections = secondExtracted?.action?.sections?.length > 0;
                const hasPlaces = secondExtracted?.action?.places?.length > 0;
                console.log(`[Research] Has sections: ${hasSections}, Has places (legacy): ${hasPlaces}`);

                if (secondExtracted && secondExtracted.action.action === 'recommendPlaces' && (hasSections || hasPlaces)) {
                    // Get ALL verified sources - no deduplication, show everything
                    const verifiedSources = webResults.sources;
                    console.log(`[Research] All verified sources: ${verifiedSources.length}`);

                    // Helper to extract favicon domain from title
                    const extractDomainForFavicon = (title: string): string => {
                        const titleLower = title.toLowerCase();
                        if (titleLower.includes('eater')) return 'eater.com';
                        if (titleLower.includes('infatuation')) return 'theinfatuation.com';
                        if (titleLower.includes('timeout') || titleLower.includes('time out')) return 'timeout.com';
                        if (titleLower.includes('secretnyc') || titleLower.includes('secret nyc')) return 'secretnyc.co';
                        if (titleLower.includes('skint')) return 'theskint.com';
                        if (titleLower.includes('grubstreet')) return 'grubstreet.com';
                        if (titleLower.includes('reddit') || titleLower.includes('r/')) return 'reddit.com';
                        return 'google.com';
                    };

                    // Keep ALL sources (up to 25), no deduplication
                    const allSources = verifiedSources.slice(0, 25);
                    console.log(`[Research] Sources for display: ${allSources.length}`);

                    // Convert legacy flat places array to sections format if needed
                    let sections = hasSections
                        ? secondExtracted.action.sections
                        : [{ title: "Recommendations", places: secondExtracted.action.places }];

                    // Enrich all places in all sections with Google Places data
                    const enrichedSections = await Promise.all(sections.map(async (section: any) => {
                        const enrichedPlaces = await Promise.all((section.places || []).map(async (p: any) => {
                            try {
                                // For events, generate booking URL instead of venue website
                                const isEvent = p.type === 'event' || p.startDate || p.isEvent;

                                // Filter out past events
                                if (isEvent && p.startDate) {
                                    const eventDate = new Date(p.startDate + 'T12:00:00');
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    if (eventDate < today) {
                                        console.log(`[Filter] Skipping past event: ${p.name} (${p.startDate})`);
                                        return null; // Will be filtered out
                                    }
                                }

                                if (isEvent) {
                                    // Generate ticket search URL for events
                                    const eventQuery = encodeURIComponent(`${p.name} ${p.location || ''} tickets`);
                                    const bookingUrl = `https://www.google.com/search?q=${eventQuery}`;

                                    // Try to get venue image from Google Places
                                    const venueLocation = p.location?.split(',')[0] || p.location; // Extract venue name from "Venue, Neighborhood"
                                    const placeData = await searchGooglePlaces(venueLocation || p.name, 'New York, NY');

                                    return {
                                        ...p,
                                        imageUrl: placeData?.imageUrl || null,
                                        rating: null, // Events don't have ratings
                                        website: bookingUrl,
                                        isEvent: true
                                    };
                                }

                                // For regular places, use Google Places website
                                const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                                if (placeData) {
                                    return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating, website: placeData.sourceUrl };
                                }
                                return p;
                            } catch (e) {
                                return p;
                            }
                        }));
                        return { title: section.title, intro: section.intro, places: enrichedPlaces.filter((p: any) => p !== null) };
                    }));

                    // Count total food/drink items across all sections
                    const foodTypes = new Set(['restaurant', 'bar', 'cafe', 'food', 'drinks', 'drink']);
                    let totalFoodCount = 0;
                    for (const section of enrichedSections) {
                        totalFoodCount += (section.places || []).filter((p: any) => foodTypes.has((p.type || '').toLowerCase())).length;
                    }

                    // If no food/drink options, add a "From Your List" section with saved places
                    if (totalFoodCount === 0 && userPlaces && userPlaces.length > 0) {
                        const fallbackSaved = [...userPlaces]
                            .filter((p: any) => !p.is_event)
                            .sort((a: any, b: any) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
                            .slice(0, 2)
                            .map((p: any) => ({
                                name: p.name,
                                type: p.type || 'restaurant',
                                description: p.note || 'A saved pick you already loved.',
                                location: p.address || 'New York, NY',
                                sourceName: 'Saved list',
                                sourceQuote: 'From your saved places'
                            }));
                        if (fallbackSaved.length > 0) {
                            enrichedSections.unshift({
                                title: "🍽️ From Your List",
                                intro: "Since you asked about food, here are some spots you've already saved that might hit the spot.",
                                places: fallbackSaved
                            });
                        }
                    }

                    const totalPlaces = enrichedSections.reduce((acc: number, s: any) => acc + (s.places?.length || 0), 0);
                    console.log(`[Research] Final sections: ${enrichedSections.length}, Total places: ${totalPlaces}`);

                    // Return sections + ALL verified sources (frontend shows them in a box)
                    actionResult = {
                        type: 'recommendations',
                        sections: enrichedSections,
                        // ALL sources with title and favicon - no deduplication
                        sources: allSources.map(s => {
                            const domain = extractDomainForFavicon(s.title);
                            return {
                                title: s.title,  // Full title from Gemini grounding
                                url: s.url,      // Vertex URL (redirects to actual source)
                                domain: domain,
                                favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                            };
                        })
                    };
                } else {
                    console.log(`[Research] WARNING: No recommendPlaces action found in response`);
                }
            }

            // ============= SMART RESEARCH ACTION (NEW) =============
            else if (action.action === 'smartResearch' && action.tools && Array.isArray(action.tools)) {
                console.log('[Chat API] ========================================');
                console.log('[Chat API] Starting SMART RESEARCH with parallel tools...');
                console.log('[Chat API] Tools requested:', action.tools.map((t: any) => t.tool).join(', '));

                // Execute all research tools in parallel
                const researchResults = await executeSmartResearch(
                    action.tools as ResearchTool[],
                    userPlaces,
                    userPreferences,
                    userId
                );

                // Build comprehensive search results for the recommender
                let searchResults = '';

                // Add Gemini grounded search results (Reddit + publications via site: operators)
                if (researchResults.webResults.text) {
                    searchResults += '=== SEARCH RESULTS (Reddit, Eater, TimeOut, etc. via Gemini) ===\n';
                    searchResults += researchResults.webResults.textWithCitations;
                    searchResults += '\n';
                }

                // Add scraped event content (if Firecrawl worked)
                if (researchResults.eventScrapedContent) {
                    searchResults += '\n=== SCRAPED EVENT SITES ===\n' + researchResults.eventScrapedContent;
                }

                // Log what we got
                console.log(`[Smart Research] Final searchResults length: ${searchResults.length} chars`);
                console.log(`[Smart Research] Web sources: ${researchResults.webResults.sources.length}, Events scraped: ${researchResults.eventScrapedContent.length} chars`);

                // If no research data, add a note
                if (!searchResults.trim()) {
                    console.log('[Smart Research] WARNING: No research data collected!');
                    searchResults = '(No research data available - provide general NYC recommendations based on the query)';
                }

                // Build taste profile context for the recommender
                let tasteContext = '';
                if (researchResults.tasteProfile && researchResults.tasteProfile.inferences.length > 0) {
                    tasteContext = `
=== USER TASTE PROFILE (from analyzing their saved places) ===
Key Inferences:
${researchResults.tasteProfile.inferences.slice(0, 15).map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Cuisine/Category Preferences: ${(researchResults.tasteProfile.cuisinePreferences || []).join(', ') || 'Varied'}
Price Range: ${researchResults.tasteProfile.priceRange || 'Varied'}
Vibe Preferences: ${(researchResults.tasteProfile.vibePreferences || []).join(', ') || 'Flexible'}
Neighborhood Preferences: ${(researchResults.tasteProfile.locationPreferences || []).join(', ') || 'Open to exploring'}

⚠️ Use these insights to PERSONALIZE recommendations, but don't over-emphasize them. 
   Balance user taste with highly-recommended/cross-corroborated places from research.
`;
                }

                // Build LEAN recommender prompt - NO full system prompt!
                const userQuery = messages[messages.length - 1]?.content || 'recommendations';

                // Count explicit preferences from saved places
                const prefCounts = countUserPreferences(userPlaces);

                // Build saved places list for recommender to reference
                const savedPlacesList = userPlaces.slice(0, 30).map((p: any) => {
                    const type = p.cuisine || p.type || 'place';
                    const neighborhood = p.address?.split(',')[1]?.trim() || p.neighborhood || '';
                    return `• ${p.name} (${type}) - ${neighborhood}`;
                }).join('\n');

                // Build preference summary with counts
                const preferenceSummary = `
=== 🌟 USER'S SAVED PLACES - PRIORITIZE THESE! 🌟 ===
${savedPlacesList || '(No saved places yet)'}

=== USER PREFERENCE PROFILE ===
Based on ${userPlaces.length} saved places:
TOP CATEGORIES: ${prefCounts.topTypes.join(', ') || 'varied'}
TOP CUISINES: ${prefCounts.topCuisines.join(', ') || 'varied'}  
FAVORITE NEIGHBORHOODS: ${prefCounts.topNeighborhoods.join(', ') || 'exploring'}
${researchResults.tasteProfile ? `
INFERRED PREFERENCES:
- Vibes: ${researchResults.tasteProfile.vibePreferences?.slice(0, 5).join(', ') || 'flexible'}
- Price Range: ${researchResults.tasteProfile.priceRange || 'mixed'}
- Key Traits: ${researchResults.tasteProfile.inferences?.slice(0, 3).join('; ') || 'open-minded'}
${researchResults.tasteProfile.interests?.length ? `- Subject Interests: ${researchResults.tasteProfile.interests.slice(0, 5).join(', ')}` : ''}
` : ''}
=== END PROFILE ===`;

                const recommenderPrompt = `You are Spot, a fun NYC recommendation assistant using Chain of Thought reasoning.

USER ASKED: "${userQuery}"
${preferenceSummary}

=== RESEARCH DATA ===
${searchResults || '(No data found - use general NYC knowledge)'}
=== END ===

INTERNAL REASONING (do NOT output this - use it to think):
1. CHECK TIMING: Does query mention "weekend/tonight/tomorrow"? If YES → saved events go FIRST!
2. SCAN SAVED LIST CAREFULLY: Match saved places to the query - these are your PRIMARY recommendations!
   - "best pizza" → look for ALL pizza spots in saved list
   - "museums" → look for ALL museums/attractions in saved list
   - "date ideas" → look for romantic spots, events, activities in saved list
3. From research, find 2-3 NEW places to complement their saved picks
4. Group into 2-4 sections - SAVED PLACES should dominate the response (4-5 out of 7-10)

⚠️ SAVED PLACES ARE THE PRIORITY! The saved list IS their wishlist. They saved these for a reason!
- "pizza" query + saved pizza spots = THOSE ARE YOUR TOP PICKS (L'industrie, Ceres, Mama's TOO, etc.)
- "museum" query + saved museums = THOSE ARE YOUR TOP PICKS (The Met, MoMA, Whitney, Transit Museum, etc.)  
- "things to do" + saved attractions = SURFACE ALL OF THEM!
- "date ideas" + saved romantic spots or events = PUT THEM FRONT AND CENTER!

Your job is to remind them of amazing places they ALREADY saved, not just find new ones!

⏰ TIME-SENSITIVE = EVENTS FIRST: If user mentions "this weekend", "tonight", "tomorrow", "this week", etc. → 
PRIORITIZE EVENTS over permanent places! Events are date-specific and more urgent. Put event section FIRST.
- Holiday markets, concerts, shows, pop-ups = time-limited, push these!
- Restaurants/museums = always open, can wait

⚠️ DO NOT output your thinking process. Just output a brief intro and the JSON.

⚠️ OUTPUT RULES:
- Write a 1-2 sentence playful intro
- Then IMMEDIATELY output the JSON (no thinking, no headers, no markdown)
- DO NOT write "## Thinking Process" or explain your reasoning
- DO NOT write section headers in markdown - put them in the JSON

OUTPUT FORMAT:
{"action": "recommendPlaces", "sections": [
  {"title": "Section Title", "intro": "2-3 sentences explaining why these picks match the user...", "places": [
    {"name": "PLACE or EVENT name", "type": "restaurant|bar|cafe|activity|attraction|event", "description": "Why this fits them + key details", "location": "Neighborhood OR Venue, Neighborhood", "startDate": "YYYY-MM-DD (for events only)", "isEvent": true/false, "recommendedDishes": ["Dish 1", "Dish 2"], "sources": [{"domain": "reddit.com", "url": "https://vertexaisearch..."}, {"domain": "theskint.com", "url": "https://theskint.com/"}]}
  ]}
]}

SECTION GUIDELINES:
- 🌟 FIRST SECTION: Use "From Your Saved List" or "Already On Your Radar" for matching SAVED places
${researchResults.toolsUsed.includes('research_events') ? '- For EVENTS: "📅 This Weekend", "🎭 Shows & Performances", "🎪 Markets & Pop-ups"\n- Event names should be the EVENT, not the venue (e.g., "Jingle Ball" not "MSG")' : ''}
${researchResults.toolsUsed.includes('research_food') ? '- For FOOD: "🔥 Top Picks", "✨ Hidden Gems", "💜 Matches Your Vibe"\n- Reference their cuisine preferences in descriptions' : ''}
${researchResults.toolsUsed.includes('research_places') ? '- For PLACES: "🗽 Must-See", "🎨 Culture & Arts", "🌳 Outdoor Fun"\n- Match to their saved activity types' : ''}

💡 PRIORITIZE SAVED PLACES: If user asks for "pizza" → their saved pizza spots go FIRST!
💡 If asking for "museums" → include their saved museums! Surface saved matches before new finds.
📅 TIME-SENSITIVE QUERIES: If user says "this weekend/tonight/tomorrow" → EVENTS GO FIRST!
   - Concerts, shows, markets, pop-ups are date-specific → more urgent than restaurants
   - Put "📅 This Weekend" or "🎭 Happening Now" section FIRST before food/places
   - 🎯 PRIVILEGE SCRAPED EVENT SITES: For events, prioritize data from "=== THESKINT.COM ===" "=== EDMTRAIN.COM ===" "=== OHMYROCKNESS.COM ===" "=== TIMEOUT.COM ===" sections - these are curated, up-to-date event listings!

🔥 SAVED LIST = THEIR WISHLIST! At least HALF of recommendations should come from saved list if they match!
   - User saved pizza spots? → PUT THEM FIRST when they ask for food!
   - User saved museums/attractions? → PUT THEM FIRST when they ask for things to do!
   - User saved events? → PUT THEM FIRST when they ask about weekend plans!
   - The saved list is what they WANT to try - surface it!

⚠️ CRITICAL: Return 7-10 places. At least 4-5 should be from saved list if relevant!`;

                // Call Gemini 2.5 Pro as the recommender
                console.log('[Smart Research] Calling Gemini 2.5 Pro recommender...');
                const recommenderResponse = await getAI().models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: [{ role: 'user', parts: [{ text: recommenderPrompt }] }]
                });

                content = recommenderResponse.text || '';
                console.log("[Chat API] --- RECOMMENDER RESPONSE ---");
                console.log(content.substring(0, 500) + '...');

                // Extract recommendPlaces action from recommender response
                const recommenderExtracted = extractAction(content);
                console.log(`[Smart Research] Recommender action:`, recommenderExtracted?.action?.action);

                if (recommenderExtracted && recommenderExtracted.action.action === 'recommendPlaces') {
                    const hasSections = recommenderExtracted.action.sections?.length > 0;
                    const hasPlaces = recommenderExtracted.action.places?.length > 0;

                    let sections = hasSections
                        ? recommenderExtracted.action.sections
                        : hasPlaces
                            ? [{ title: "Recommendations", places: recommenderExtracted.action.places }]
                            : [];

                    // Enrich all places with Google Places data
                    const enrichedSections = await Promise.all(sections.map(async (section: any) => {
                        const enrichedPlaces = await Promise.all((section.places || []).map(async (p: any) => {
                            try {
                                // For events, generate booking URL instead of venue website
                                const isEvent = p.type === 'event' || p.startDate || p.isEvent;

                                // Filter out past events
                                if (isEvent && p.startDate) {
                                    const eventDate = new Date(p.startDate + 'T12:00:00');
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    if (eventDate < today) {
                                        console.log(`[Filter] Skipping past event: ${p.name} (${p.startDate})`);
                                        return null; // Will be filtered out
                                    }
                                }

                                if (isEvent) {
                                    // Generate ticket search URL for events
                                    const eventQuery = encodeURIComponent(`${p.name} ${p.location || ''} tickets`);
                                    const bookingUrl = `https://www.google.com/search?q=${eventQuery}`;

                                    // Try to get venue image from Google Places
                                    const venueLocation = p.location?.split(',')[0] || p.location; // Extract venue name from "Venue, Neighborhood"
                                    const placeData = await searchGooglePlaces(venueLocation || p.name, 'New York, NY');

                                    return {
                                        ...p,
                                        imageUrl: placeData?.imageUrl || null,
                                        rating: null, // Events don't have ratings
                                        website: bookingUrl,
                                        isEvent: true
                                    };
                                }

                                // For regular places, use Google Places website
                                const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                                if (placeData) {
                                    return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating, website: placeData.sourceUrl };
                                }
                                return p;
                            } catch (e) {
                                return p;
                            }
                        }));
                        return { title: section.title, intro: section.intro, places: enrichedPlaces.filter((p: any) => p !== null) };
                    }));

                    // Helper to extract favicon domain
                    const extractDomainForFavicon = (title: string): string => {
                        const titleLower = title.toLowerCase();
                        if (titleLower.includes('eater')) return 'eater.com';
                        if (titleLower.includes('infatuation')) return 'theinfatuation.com';
                        if (titleLower.includes('timeout') || titleLower.includes('time out')) return 'timeout.com';
                        if (titleLower.includes('secretnyc') || titleLower.includes('secret nyc')) return 'secretnyc.co';
                        if (titleLower.includes('skint')) return 'theskint.com';
                        if (titleLower.includes('reddit') || titleLower.includes('r/')) return 'reddit.com';
                        if (titleLower.includes('nytimes') || titleLower.includes('ny times')) return 'nytimes.com';
                        if (titleLower.includes('ra.co') || titleLower.includes('resident advisor')) return 'ra.co';
                        if (titleLower.includes('edmtrain')) return 'edmtrain.com';
                        if (titleLower.includes('ohmyrockness')) return 'ohmyrockness.com';
                        return 'google.com';
                    };

                    // Collect all sources
                    const allSources = researchResults.webResults.sources.slice(0, 25);

                    const totalPlaces = enrichedSections.reduce((acc: number, s: any) => acc + (s.places?.length || 0), 0);
                    console.log(`[Smart Research] Final: ${enrichedSections.length} sections, ${totalPlaces} places, ${allSources.length} sources`);

                    actionResult = {
                        type: 'recommendations',
                        sections: enrichedSections,
                        sources: allSources.map(s => ({
                            title: s.title,
                            url: s.url,
                            domain: extractDomainForFavicon(s.title),
                            favicon: `https://www.google.com/s2/favicons?domain=${extractDomainForFavicon(s.title)}&sz=32`
                        })),
                        tasteProfile: researchResults.tasteProfile ? {
                            inferences: researchResults.tasteProfile.inferences.slice(0, 5),
                            cuisines: researchResults.tasteProfile.cuisinePreferences.slice(0, 5)
                        } : null
                    };
                } else {
                    console.log('[Smart Research] WARNING: No recommendPlaces action in recommender response');
                }
            }

            // ============= RECOMMEND PLACES ACTION =============
            else if (action.action === 'recommendPlaces' && (action.sections || action.places)) {
                // Handle both new (sections) and legacy (places) format
                let sections = action.sections
                    ? action.sections
                    : [{ title: "Recommendations", places: action.places }];

                // Enrich all places in all sections
                const enrichedSections = await Promise.all(sections.map(async (section: any) => {
                    const enrichedPlaces = await Promise.all((section.places || []).map(async (p: any) => {
                        try {
                            // For events, generate booking URL instead of venue website
                            const isEvent = p.type === 'event' || p.startDate || p.isEvent;

                            // Filter out past events
                            if (isEvent && p.startDate) {
                                const eventDate = new Date(p.startDate + 'T12:00:00');
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                if (eventDate < today) {
                                    console.log(`[Filter] Skipping past event: ${p.name} (${p.startDate})`);
                                    return null;
                                }
                            }

                            if (isEvent) {
                                const eventQuery = encodeURIComponent(`${p.name} ${p.location || ''} tickets`);
                                const bookingUrl = `https://www.google.com/search?q=${eventQuery}`;
                                const venueLocation = p.location?.split(',')[0] || p.location;
                                const placeData = await searchGooglePlaces(venueLocation || p.name, 'New York, NY');

                                return {
                                    ...p,
                                    imageUrl: placeData?.imageUrl || null,
                                    rating: null,
                                    website: bookingUrl,
                                    isEvent: true
                                };
                            }

                            const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                            if (placeData) {
                                return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating, website: placeData.sourceUrl };
                            }
                            return p;
                        } catch (e) {
                            return p;
                        }
                    }));
                    return { title: section.title, intro: section.intro, places: enrichedPlaces.filter((p: any) => p !== null) };
                }));

                actionResult = { type: 'recommendations', sections: enrichedSections };
            }

            // ============= ADD PLACE ACTION =============
            else if (action.action === 'addPlace' && action.placeName) {
                const result = await findAndAddPlace(action.placeName, action.location, action, userId, token);
                if (result.added) {
                    actionResult = { added: true, place: result.place };
                } else {
                    actionResult = { added: false, message: result.message };
                }
            }

            // ============= ADD MULTIPLE PLACES ACTION =============
            else if (action.action === 'addMultiplePlaces' && action.places) {
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
            }

            // ============= SCRAPE URL ACTION =============
            else if (action.action === 'scrapeUrl' && action.url) {
                const isSocialMedia = /instagram\.com|tiktok\.com/i.test(action.url);

                if (isSocialMedia) {
                    const metadataDescription = await scrapeSocialMetadata(action.url);
                    if (metadataDescription) {
                        // Ask Gemini to extract places
                        const extractPrompt = `Identify all restaurant/place/event names mentioned in this social media caption: "${metadataDescription}". 
Return ONLY a JSON object: { "places": [{ "name": "...", "location": "...", "isEvent": boolean }] }
If no places found, return { "places": [] }.`;

                        const extractResponse = await getAI().models.generateContent({
                            model: 'gemini-2.5-flash', // faster extraction for social captions
                            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }]
                        });

                        try {
                            const extractedText = extractResponse.text || '';
                            const cleanJson = extractedText.replace(/```json|```/g, '').trim();
                            const extracted = JSON.parse(cleanJson);

                            if (extracted?.places?.length > 0) {
                                const results = [];
                                for (const item of extracted.places) {
                                    const result = await findAndAddPlace(item.name, item.location || 'New York, NY', item, userId, token);
                                    results.push({
                                        name: item.name,
                                        status: result.added ? 'added' : 'skipped',
                                        place: result.place
                                    });
                                }
                                actionResult = { type: 'batch_add', results };
                            } else {
                                actionResult = { added: false, message: "Could not identify any places in the post." };
                            }
                        } catch (e) {
                            actionResult = { added: false, error: 'Failed to extract places from post.' };
                        }
                    } else {
                        actionResult = { added: false, error: 'Could not fetch post content.' };
                    }
                } else {
                    // Non-social media URL - use Jina.ai to scrape and classify
                    console.log(`[URL Scrape] Scraping non-social URL: ${action.url}`);
                    const scrapeResult = await scrapeWebsite(action.url);

                    if (scrapeResult.success && scrapeResult.content) {
                        // Use AI to classify and extract
                        const classifyPrompt = `Analyze this webpage content and determine if it contains information about:
1. EVENTS (concerts, shows, performances, pop-ups, markets, festivals)
2. FOOD/RESTAURANTS (restaurants, cafes, bars, food spots)
3. PLACES/ACTIVITIES (attractions, museums, activities, things to do)
4. NOT RELEVANT (blog posts, articles without specific places, etc.)

Content from ${action.url}:
${scrapeResult.content.substring(0, 4000)}

Return ONLY a JSON object:
{
  "category": "event" | "food" | "place" | "not_relevant",
  "places": [{ "name": "...", "location": "...", "isEvent": boolean, "startDate": "YYYY-MM-DD or null", "description": "brief description" }],
  "summary": "One sentence summary of what this page is about"
}

If the page lists multiple events/places, include all of them (up to 10).
If not relevant, return empty places array.`;

                        const classifyResponse = await getAI().models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: [{ role: 'user', parts: [{ text: classifyPrompt }] }]
                        });

                        try {
                            const classifyText = classifyResponse.text || '';
                            const cleanJson = classifyText.replace(/```json|```/g, '').trim();
                            const classified = JSON.parse(cleanJson);

                            console.log(`[URL Scrape] Classified as: ${classified.category}, found ${classified.places?.length || 0} places`);

                            if (classified.category === 'not_relevant' || !classified.places?.length) {
                                actionResult = {
                                    added: false,
                                    message: `This doesn't seem to be about specific places I can save. ${classified.summary || ''}`
                                };
                            } else {
                                const results = [];
                                for (const item of classified.places.slice(0, 10)) {
                                    const placeData = {
                                        ...item,
                                        sourceUrl: action.url
                                    };
                                    const result = await findAndAddPlace(
                                        item.name,
                                        item.location || 'New York, NY',
                                        placeData,
                                        userId,
                                        token
                                    );
                                    results.push({
                                        name: item.name,
                                        status: result.added ? 'added' : 'skipped',
                                        place: result.place
                                    });
                                }
                                actionResult = {
                                    type: 'batch_add',
                                    results,
                                    category: classified.category,
                                    summary: classified.summary
                                };
                            }
                        } catch (e) {
                            console.error('[URL Scrape] Classification failed:', e);
                            actionResult = { added: false, error: 'Failed to analyze the page content.' };
                        }
                    } else {
                        actionResult = { added: false, error: `Couldn't fetch that page: ${scrapeResult.error || 'unknown error'}` };
                    }
                }
            }

            // ============= FIND RESERVATIONS ACTION =============
            else if (action.action === 'findReservations' && action.restaurantName) {
                const resInfo = await findReservationOptions(action.restaurantName, 'New York, NY');
                actionResult = {
                    type: 'reservations',
                    restaurantName: action.restaurantName,
                    ...resInfo
                };
            }

            // ============= FIND BOOKINGS ACTION (multiple) =============
            else if (action.action === 'findBookings' && action.places) {
                const bookings = [];
                for (const place of action.places) {
                    const searchDate = place.date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
                    const partySize = place.partySize || 2;

                    const bookingLinks: any = {};
                    bookingLinks.google = `https://www.google.com/maps/search/${encodeURIComponent(place.name + ' New York, NY')}`;

                    if (place.type === 'tickets') {
                        bookingLinks.website = `https://www.google.com/search?q=${encodeURIComponent(place.name + ' tickets')}`;
                    } else {
                        bookingLinks.openTable = `https://www.opentable.com/s?dateTime=${searchDate}T19%3A00&covers=${partySize}&term=${encodeURIComponent(place.name)}`;
                        bookingLinks.resy = `https://resy.com/cities/ny?date=${searchDate}&seats=${partySize}&query=${encodeURIComponent(place.name)}`;
                        bookingLinks.yelp = `https://www.yelp.com/search?find_desc=${encodeURIComponent(place.name)}&find_loc=New+York,+NY`;
                    }

                    bookings.push({
                        name: place.name,
                        type: place.type || 'reservation',
                        date: searchDate,
                        partySize,
                        bookingLinks
                    });
                }

                actionResult = { type: 'bookings', bookings };
            }
        }

        // Clean JSON from response
        content = stripAllActions(content);

        console.log(`[Chat API] ========== REQUEST END ==========`);

        return res.status(200).json({
            content: content || "I'm here to help! What would you like to know?",
            actionResult
        });

    } catch (error: any) {
        console.error('[Chat API] Error:', error);
        return res.status(500).json({ error: 'Failed to process chat', details: error.message });
    }
}