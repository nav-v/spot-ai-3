import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= CONFIG (same as chat.ts) =============

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

// Same subreddits as chat.ts
const EVENT_SUBREDDITS = ['nyc', 'AskNYC', 'NYCbitcheswithtaste', 'newyorkcity'];
const FOOD_SUBREDDITS = ['nyc', 'AskNYC', 'FoodNYC', 'NYCbitcheswithtaste'];

// Same event sites as chat.ts
const EVENT_SCRAPE_SITES = [
    'https://theskint.com/',
    'https://www.ohmyrockness.com/features.atom',
    'https://www.timeout.com/newyork/things-to-do/this-weekend',
];

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
        
        // Simple weather quip
        let quip = `${temp}°F and ${conditions} - perfect for exploring!`;
        if (temp < 35) quip = `${temp}°F - bundle up, but the city awaits!`;
        else if (temp > 80) quip = `${temp}°F - find some AC or a rooftop!`;
        else if (conditions.includes('rain')) quip = `${temp}°F with rain - cozy indoor vibes today`;
        
        return { temp, feels_like: temp, conditions, icon, spot_quip: quip };
    } catch {
        return { temp: 50, feels_like: 50, conditions: 'clear', icon: '01d', spot_quip: "Perfect day to explore!" };
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

async function geminiSearchWithSources(query: string): Promise<{ text: string; sources: Array<{ domain: string; url: string }> }> {
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

// 3 separate time-based searches
async function researchByTimeframe(): Promise<{
    today: { text: string; sources: any[] };
    tomorrow: { text: string; sources: any[] };
    weekend: { text: string; sources: any[] };
    food: { text: string; sources: any[] };
    scraped: string;
}> {
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const tomorrowName = new Date(today.getTime() + 86400000).toLocaleDateString('en-US', { weekday: 'long' });
    
    // Run all searches in parallel
    const [todayRes, tomorrowRes, weekendRes, foodRes, scrape1, scrape2] = await Promise.all([
        // TODAY search
        geminiSearchWithSources(`NYC events happening today ${dayName} r/nyc r/AskNYC`),
        // TOMORROW search
        geminiSearchWithSources(`NYC events happening tomorrow ${tomorrowName} r/nyc r/AskNYC`),
        // WEEKEND search
        geminiSearchWithSources(`NYC events this weekend Saturday Sunday r/nyc r/AskNYC`),
        // FOOD search
        geminiSearchWithSources(`best restaurants NYC must try hidden gems r/FoodNYC r/nyc`),
        // Event site scrapes
        scrapeWithJina('https://theskint.com/'),
        scrapeWithJina('https://www.timeout.com/newyork/things-to-do/this-weekend'),
    ]);
    
    return {
        today: todayRes,
        tomorrow: tomorrowRes,
        weekend: weekendRes,
        food: foodRes,
        scraped: `=== THESKINT.COM ===\n${scrape1}\n\n=== TIMEOUT.COM ===\n${scrape2}`
    };
}

// ============= GOOGLE PLACES (for images) =============

async function searchGooglePlaces(name: string, location: string = 'New York'): Promise<{ imageUrl?: string; address?: string }> {
    if (!GOOGLE_PLACES_API_KEY) return {};
    
    try {
        const query = `${name} ${location}`;
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.results?.[0]) {
            const place = data.results[0];
            let imageUrl;
            
            if (place.photos?.[0]?.photo_reference) {
                imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
            }
            
            return { imageUrl, address: place.formatted_address };
        }
    } catch {}
    
    return {};
}

// ============= TASTE ANALYSIS =============

async function quickTasteAnalysis(places: any[]): Promise<string> {
    if (!places || places.length === 0) return 'varied tastes';
    
    const cuisines = places.filter(p => p.cuisine).map(p => p.cuisine).slice(0, 5);
    const types = places.filter(p => p.subtype).map(p => p.subtype).slice(0, 5);
    
    return `Likes: ${[...cuisines, ...types].join(', ') || 'varied'}`;
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
    isEvent: boolean;
    startDate?: string;
    mainCategory: 'eat' | 'see';
    subtype: string;
    sources: Array<{ domain: string; url: string }>;
    timeframe: 'today' | 'tomorrow' | 'weekend';
}

async function generateDigest(
    userName: string,
    userPlaces: any[],
    research: Awaited<ReturnType<typeof researchByTimeframe>>
): Promise<{ intro_text: string; recommendations: DigestRec[] }> {
    
    const tasteHint = await quickTasteAnalysis(userPlaces);
    const savedNames = userPlaces.map(p => p.name.toLowerCase()).join(', ');
    
    const prompt = `You are Spot. Generate a daily digest for ${userName} who ${tasteHint}.

=== TODAY'S EVENTS ===
${research.today.text.substring(0, 2500)}

=== TOMORROW'S EVENTS ===
${research.tomorrow.text.substring(0, 2500)}

=== WEEKEND EVENTS ===
${research.weekend.text.substring(0, 2500)}
${research.scraped.substring(0, 3000)}

=== FOOD SPOTS ===
${research.food.text.substring(0, 2000)}

DO NOT RECOMMEND (already saved): ${savedNames.substring(0, 500)}

Generate 15 recommendations (10 events, 5 food):
- 3-4 for TODAY (timeframe: "today")
- 3-4 for TOMORROW (timeframe: "tomorrow") 
- 3-4 for WEEKEND (timeframe: "weekend")
- 5 food spots (timeframe: "today" since restaurants are always available)

Return JSON:
{
    "intro_text": "While you were [something fun], I found some gems for your week...",
    "recommendations": [
        {"id": "1", "name": "Name", "type": "event|restaurant|bar|cafe", "description": "Brief why it's great", "location": "Neighborhood", "isEvent": true, "startDate": "2024-12-13", "mainCategory": "see", "subtype": "Concert", "sources": [{"domain": "reddit.com", "url": ""}], "timeframe": "today"}
    ]
}

Be specific about dates. Events need real dates from the research.`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const jsonMatch = (response.text || '{}').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Merge sources from research
            const allSources = [...research.today.sources, ...research.tomorrow.sources, ...research.weekend.sources, ...research.food.sources];
            
            // Enrich recommendations with sources and images
            const enriched = await Promise.all((parsed.recommendations || []).slice(0, 15).map(async (rec: any, i: number) => {
                // Try to get image from Google Places
                const placeData = await searchGooglePlaces(rec.name, rec.location || 'New York');
                
                return {
                    ...rec,
                    id: rec.id || `digest-${i}`,
                    imageUrl: placeData.imageUrl,
                    sources: rec.sources?.length ? rec.sources : allSources.slice(0, 2)
                };
            }));
            
            return {
                intro_text: parsed.intro_text || "Here's what's happening in NYC!",
                recommendations: enriched
            };
        }
    } catch (error) {
        console.error('[Digest] Generation failed:', error);
    }
    
    return { intro_text: "Here's what's happening in NYC!", recommendations: [] };
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
            researchByTimeframe(),
            db.from('users').select('name').eq('id', userId).single(),
            db.from('places').select('name, cuisine, subtype, is_event, start_date').eq('user_id', userId)
        ]);
        
        const userName = userResult.data?.name || 'there';
        const places = placesResult.data || [];
        
        // Generate digest
        const digest = await generateDigest(userName, places, research);
        
        // Save to DB
        const { data: saved } = await db.from('daily_digests').insert({
            user_id: userId,
            weather,
            greeting: `Good ${getTimeOfDay()} ${userName}`,
            intro_text: digest.intro_text,
            recommendations: digest.recommendations,
            shown_ids: []
        }).select().single();
        
        console.log(`[Digest] Done in ${Date.now() - start}ms with ${digest.recommendations.length} recs`);
        
        return res.status(200).json({
            success: true,
            hasDigest: true,
            digest: {
                id: saved?.id || 'temp',
                greeting: `Good ${getTimeOfDay()} ${userName}`,
                weather,
                intro_text: digest.intro_text,
                recommendations: digest.recommendations,
                shown_ids: [],
                created_at: new Date().toISOString()
            }
        });
        
    } catch (error: any) {
        console.error('[Digest] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
