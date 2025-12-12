import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= CONFIGURATION =============

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

// Event sites to scrape
const EVENT_SCRAPE_SITES = [
    'https://theskint.com/',
    'https://www.ohmyrockness.com/features.atom',
    'https://edmtrain.com/new-york-city-ny',
    'https://www.timeout.com/newyork/things-to-do/this-weekend',
    'https://ny-event-radar.com'
];

// Subreddits for research
const EVENT_SUBREDDITS = ['nyc', 'AskNYC', 'NYCbitcheswithtaste', 'newyorkcity'];
const FOOD_SUBREDDITS = ['nyc', 'AskNYC', 'FoodNYC', 'NYCbitcheswithtaste', 'newyorkcity'];

// ============= LAZY INITIALIZATION =============

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
        const feels_like = Math.round(data.main?.feels_like || temp);
        const conditions = data.weather?.[0]?.description || 'clear';
        const icon = data.weather?.[0]?.icon || '01d';
        
        // Generate Spot-style weather quip
        const quip = await generateWeatherQuip(temp, conditions);
        
        return { temp, feels_like, conditions, icon, spot_quip: quip };
    } catch (error) {
        console.error('[Weather] Failed to fetch:', error);
        return {
            temp: 50,
            feels_like: 50,
            conditions: 'partly cloudy',
            icon: '02d',
            spot_quip: "Weather's being mysterious today, but don't let that stop you!"
        };
    }
}

async function generateWeatherQuip(temp: number, conditions: string): Promise<string> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{ text: `Generate a short, fun, encouraging one-liner about NYC weather. Temperature: ${temp}°F, Conditions: ${conditions}. Be playful and encourage exploring. Max 15 words. Examples:
- "28°F and sunny - perfect excuse for hot cocoa and window shopping!"
- "45°F and drizzling - cozy bar weather if you ask me"
- "Freezing? Sure. But hey, at least it's not raining!"
- "72°F and gorgeous - if you're inside, you're doing it wrong"

Now generate one for ${temp}°F and ${conditions}:` }]
            }]
        });
        return response.text?.trim() || `It's ${temp}°F out there - go explore!`;
    } catch {
        return `It's ${temp}°F and ${conditions} - perfect day for an adventure!`;
    }
}

// ============= SCRAPING =============

async function scrapeWithJina(url: string): Promise<string> {
    try {
        const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
        const response = await fetch(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
                'X-Return-Format': 'markdown'
            }
        });
        
        if (!response.ok) return '';
        
        const text = await response.text();
        // Limit to first 4000 chars per site
        return text.substring(0, 4000);
    } catch (error) {
        console.error(`[Jina] Failed to scrape ${url}:`, error);
        return '';
    }
}

async function scrapeEventSites(): Promise<string> {
    console.log('[Digest] Scraping event sites...');
    
    const results = await Promise.all(
        EVENT_SCRAPE_SITES.map(async (url) => {
            const content = await scrapeWithJina(url);
            const domain = new URL(url).hostname.replace('www.', '');
            return content ? `\n=== ${domain.toUpperCase()} ===\n${content}\n` : '';
        })
    );
    
    return results.filter(Boolean).join('\n');
}

// ============= GEMINI SEARCH =============

async function geminiSearch(query: string): Promise<{ text: string; sources: any[] }> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        
        const text = response.text || '';
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        return { text, sources };
    } catch (error) {
        console.error('[Gemini Search] Failed:', error);
        return { text: '', sources: [] };
    }
}

async function researchForDigest(): Promise<{ eventContent: string; foodContent: string; sources: any[] }> {
    console.log('[Digest] Starting research...');
    
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    const promises: Promise<any>[] = [];
    let allSources: any[] = [];
    let eventTexts: string[] = [];
    let foodTexts: string[] = [];
    
    // Scrape event sites
    promises.push(
        scrapeEventSites().then(content => {
            eventTexts.push(content);
        })
    );
    
    // Event subreddit searches
    for (const sub of EVENT_SUBREDDITS.slice(0, 3)) {
        promises.push(
            geminiSearch(`things to do NYC ${dayOfWeek} ${dateStr} this weekend r/${sub}`).then(result => {
                eventTexts.push(`\n=== r/${sub} ===\n${result.text}`);
                allSources.push(...result.sources);
            })
        );
    }
    
    // Food subreddit searches
    for (const sub of FOOD_SUBREDDITS.slice(0, 3)) {
        promises.push(
            geminiSearch(`best restaurants NYC must try r/${sub}`).then(result => {
                foodTexts.push(`\n=== r/${sub} ===\n${result.text}`);
                allSources.push(...result.sources);
            })
        );
    }
    
    await Promise.all(promises);
    
    return {
        eventContent: eventTexts.join('\n'),
        foodContent: foodTexts.join('\n'),
        sources: allSources
    };
}

// ============= TASTE ANALYSIS =============

interface TasteProfile {
    cuisinePreferences: string[];
    vibePreferences: string[];
    priceRange: string;
    neighborhoods: string[];
    eventTypes: string[];
}

async function analyzeTasteProfile(places: any[]): Promise<TasteProfile> {
    if (!places || places.length === 0) {
        return {
            cuisinePreferences: [],
            vibePreferences: [],
            priceRange: 'moderate',
            neighborhoods: [],
            eventTypes: []
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
    
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{ text: `Analyze this user's saved places and extract their taste profile:

${placesSummary}

Return JSON only:
{
    "cuisinePreferences": ["cuisine1", "cuisine2"],
    "vibePreferences": ["cozy", "upscale", "casual", etc],
    "priceRange": "budget|moderate|upscale|mixed",
    "neighborhoods": ["neighborhood1", "neighborhood2"],
    "eventTypes": ["concerts", "comedy", "art", etc]
}` }]
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
        eventTypes: []
    };
}

// ============= DIGEST GENERATION =============

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

interface DigestRecommendation {
    id: string;
    name: string;
    type: string;
    description: string;
    location: string;
    imageUrl?: string;
    isEvent: boolean;
    startDate?: string;
    endDate?: string;
    mainCategory: 'eat' | 'see';
    subtype: string;
    sources: Array<{ domain: string; url: string }>;
    isBumped?: boolean;
    timeframe?: 'today' | 'tomorrow' | 'weekend' | 'week';
}

async function generateDigestForUser(
    userId: string,
    userName: string,
    userPlaces: any[],
    weather: WeatherData,
    research: { eventContent: string; foodContent: string; sources: any[] }
): Promise<{
    greeting: string;
    intro_text: string;
    recommendations: DigestRecommendation[];
}> {
    const timeOfDay = getTimeOfDay();
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Find saved events happening today or closing soon
    const savedEvents = userPlaces.filter(p => p.is_event);
    const bumpedEvents = savedEvents.filter(p => {
        if (!p.start_date && !p.end_date) return false;
        const eventDate = new Date(p.start_date || p.end_date);
        const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 3; // Happening within 3 days
    });
    
    // Get saved place names to exclude from recommendations
    const savedNames = new Set(userPlaces.map(p => p.name.toLowerCase()));
    
    // Analyze taste profile
    const tasteProfile = await analyzeTasteProfile(userPlaces);
    
    const prompt = `You are Spot, generating a personalized daily digest for ${userName}.

TODAY: ${dayOfWeek}, ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
WEATHER: ${weather.temp}°F, ${weather.conditions}

USER'S TASTE PROFILE:
- Cuisine preferences: ${tasteProfile.cuisinePreferences.join(', ') || 'varied'}
- Vibe preferences: ${tasteProfile.vibePreferences.join(', ') || 'mixed'}
- Favorite neighborhoods: ${tasteProfile.neighborhoods.join(', ') || 'all around NYC'}
- Event interests: ${tasteProfile.eventTypes.join(', ') || 'open to anything'}

SAVED EVENTS HAPPENING SOON (MUST BUMP THESE):
${bumpedEvents.map(e => `- ${e.name} (${e.start_date || 'soon'})`).join('\n') || 'None'}

PLACES ALREADY SAVED (DO NOT RECOMMEND THESE):
${Array.from(savedNames).slice(0, 50).join(', ')}

=== RESEARCH: EVENTS ===
${research.eventContent.substring(0, 8000)}

=== RESEARCH: FOOD ===
${research.foodContent.substring(0, 4000)}

Generate a digest with:
1. A fun Spot-style intro (2-3 sentences, mention what you found while they slept)
2. 15 recommendations with 2:1 ratio (10 events, 5 food):
   - FIRST: Any bumped saved events (mark isBumped: true)
   - 3-4 events for TODAY
   - 3-4 events for THIS WEEKEND
   - 2-3 events for this week
   - 5 food spots matching their taste (NOT in saved list!)

Return JSON only:
{
    "intro_text": "While you were catching Z's, I was...",
    "recommendations": [
        {
            "id": "unique-id",
            "name": "Event or Place Name",
            "type": "event|restaurant|bar|cafe|activity",
            "description": "Why this is perfect for them + key details",
            "location": "Venue, Neighborhood",
            "isEvent": true,
            "startDate": "YYYY-MM-DD",
            "endDate": "YYYY-MM-DD",
            "mainCategory": "see",
            "subtype": "Concert|Comedy|Market|Restaurant|etc",
            "sources": [{"domain": "theskint.com", "url": "https://theskint.com/"}],
            "isBumped": false,
            "timeframe": "today|tomorrow|weekend|week"
        }
    ]
}

CRITICAL RULES:
- 10 events, 5 food recommendations (2:1 ratio)
- Events should be REAL events from the research, with actual dates
- Food spots must NOT be in saved list
- For events, use the actual event date from research
- timeframe: "today" for ${dayOfWeek}, "tomorrow" for next day, "weekend" for Sat/Sun, "week" for next 7 days
- isBumped: true ONLY for user's saved events happening soon
- Make descriptions personal and reference their taste profile`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const text = response.text || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                greeting: `Good ${timeOfDay} ${userName}`,
                intro_text: parsed.intro_text || "While you were sleeping, I found some gems for you!",
                recommendations: parsed.recommendations || []
            };
        }
    } catch (error) {
        console.error('[Digest Generation] Failed:', error);
    }
    
    return {
        greeting: `Good ${timeOfDay} ${userName}`,
        intro_text: "Here's what's happening in the city today!",
        recommendations: []
    };
}

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Verify cron secret (from cron-job.org) - optional if not set
    const authHeader = req.headers.authorization;
    const cronSecretParam = req.query.secret as string;
    
    // Allow if: no secret configured, OR secret matches via header, OR secret matches via query param
    if (CRON_SECRET && 
        authHeader !== `Bearer ${CRON_SECRET}` && 
        cronSecretParam !== CRON_SECRET) {
        console.log('[Digest] Unauthorized request - invalid or missing secret');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log('[Digest] ✅ Authorization passed');
    
    console.log('[Digest] Starting daily digest generation...');
    const startTime = Date.now();
    
    try {
        const db = getSupabase();
        
        // Fetch weather (used for all users)
        console.log('[Digest] Fetching NYC weather...');
        const weather = await fetchNYCWeather();
        console.log(`[Digest] Weather: ${weather.temp}°F, ${weather.conditions}`);
        
        // Research events and food (shared across users)
        console.log('[Digest] Researching events and food...');
        const research = await researchForDigest();
        console.log(`[Digest] Research complete: ${research.eventContent.length} event chars, ${research.foodContent.length} food chars`);
        
        // Get all users who have saved places (active users)
        const { data: users, error: usersError } = await db
            .from('users')
            .select('id, name');
        
        if (usersError) {
            console.error('[Digest] Failed to fetch users:', usersError);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        
        console.log(`[Digest] Found ${users?.length || 0} users`);
        
        // Get today's start for checking existing digests
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        // Generate digest for each user (skip if already has one today)
        for (const user of users || []) {
            try {
                // Check if user already has digest today
                const { data: existingDigest } = await db
                    .from('daily_digests')
                    .select('id')
                    .eq('user_id', user.id)
                    .gte('created_at', today.toISOString())
                    .limit(1)
                    .single();
                
                if (existingDigest) {
                    console.log(`[Digest] Skipping ${user.id} - already has digest today`);
                    skippedCount++;
                    continue;
                }
                
                console.log(`[Digest] Generating for user: ${user.id} (${user.name || 'Unknown'})`);
                
                // Fetch user's saved places
                const { data: places } = await db
                    .from('places')
                    .select('*')
                    .eq('user_id', user.id);
                
                // Generate personalized digest
                const digest = await generateDigestForUser(
                    user.id,
                    user.name || 'there',
                    places || [],
                    weather,
                    research
                );
                
                // Store in database
                const { error: insertError } = await db
                    .from('daily_digests')
                    .insert({
                        user_id: user.id,
                        weather,
                        greeting: digest.greeting,
                        intro_text: digest.intro_text,
                        recommendations: digest.recommendations,
                        shown_ids: []
                    });
                
                if (insertError) {
                    console.error(`[Digest] Failed to store for ${user.id}:`, insertError);
                    errorCount++;
                } else {
                    console.log(`[Digest] Stored digest for ${user.id} with ${digest.recommendations.length} recommendations`);
                    successCount++;
                }
            } catch (userError) {
                console.error(`[Digest] Error for user ${user.id}:`, userError);
                errorCount++;
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[Digest] Complete! ${successCount} generated, ${skippedCount} skipped (already had), ${errorCount} errors in ${duration}ms`);
        
        return res.status(200).json({
            success: true,
            generated: successCount,
            skipped: skippedCount,
            errors: errorCount,
            duration_ms: duration
        });
        
    } catch (error: any) {
        console.error('[Digest] Fatal error:', error);
        return res.status(500).json({ error: error.message });
    }
}

