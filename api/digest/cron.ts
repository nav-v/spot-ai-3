import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= CONFIGURATION =============
const CRON_SECRET = process.env.CRON_SECRET || '';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const JINA_API_KEY = process.env.JINA_API_KEY || '';

const EVENT_SCRAPE_SITES = [
    'https://theskint.com/',
    'https://www.ohmyrockness.com/features.atom',
    'https://edmtrain.com/new-york-city-ny',
    'https://www.timeout.com/newyork/things-to-do/this-weekend'
];

const EVENT_SUBREDDITS = ['nyc', 'AskNYC', 'NYCbitcheswithtaste'];
const FOOD_SUBREDDITS = ['FoodNYC', 'AskNYC', 'NYCbitcheswithtaste'];

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

// ============= HELPERS =============

async function fetchNYCWeather() {
    if (!OPENWEATHER_API_KEY) return { temp: 45, feels_like: 42, conditions: 'clear', icon: '01d', spot_quip: 'Perfect exploring weather!' };
    
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=New%20York,US&appid=${OPENWEATHER_API_KEY}&units=imperial`);
        const data = await res.json();
        
        const temp = Math.round(data.main?.temp || 45);
        const feels = Math.round(data.main?.feels_like || temp);
        const conditions = data.weather?.[0]?.main || 'Clear';
        const icon = data.weather?.[0]?.icon || '01d';
        
        // Generate weather quip
        let quip = "Perfect day to explore!";
        if (temp < 32) quip = "Bundle up buttercup – it's freezing, but cozy cafes await!";
        else if (temp < 50) quip = "Crisp and cool – layer up and let's go!";
        else if (temp > 85) quip = "Hot one today – seek shade and cold drinks!";
        else if (conditions.includes('Rain')) quip = "Grab an umbrella, but don't let rain stop the fun!";
        else if (conditions.includes('Snow')) quip = "Snow day vibes – time for hot cocoa spots!";
        
        return { temp, feels_like: feels, conditions, icon, spot_quip: quip };
    } catch {
        return { temp: 45, feels_like: 42, conditions: 'clear', icon: '01d', spot_quip: 'Get out there!' };
    }
}

async function scrapeWithJina(url: string): Promise<string> {
    if (!JINA_API_KEY) return '';
    try {
        const res = await fetch(`https://r.jina.ai/${url}`, {
            headers: { 'Authorization': `Bearer ${JINA_API_KEY}`, 'X-Return-Format': 'markdown' }
        });
        const text = await res.text();
        return text.substring(0, 3000);
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

async function researchForDigest() {
    const now = new Date();
    const nycTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dayName = nycTime.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = nycTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const [eventSearch1, eventSearch2, foodSearch1, foodSearch2, scrape1, scrape2] = await Promise.all([
        geminiSearchWithSources(`NYC events this weekend ${dateStr} r/${EVENT_SUBREDDITS[0]}`),
        geminiSearchWithSources(`things to do NYC ${dayName} r/${EVENT_SUBREDDITS[1]}`),
        geminiSearchWithSources(`best restaurants NYC r/${FOOD_SUBREDDITS[0]}`),
        geminiSearchWithSources(`NYC food recommendations r/${FOOD_SUBREDDITS[1]}`),
        scrapeWithJina('https://theskint.com/'),
        scrapeWithJina('https://www.timeout.com/newyork/things-to-do/this-weekend')
    ]);
    
    const scraped = `=== THESKINT.COM (${dateStr}) ===
${scrape1}

=== TIMEOUT.COM ===
${scrape2}

TODAY IS: ${dayName}, ${dateStr}`;
    
    return {
        scraped,
        events: { 
            text: [eventSearch1.text, eventSearch2.text].join('\n\n').substring(0, 3000),
            sources: [...eventSearch1.sources, ...eventSearch2.sources]
        },
        food: { 
            text: [foodSearch1.text, foodSearch2.text].join('\n\n').substring(0, 3000),
            sources: [...foodSearch1.sources, ...foodSearch2.sources]
        }
    };
}

function getTimeOfDay(): string {
    // Use NYC timezone (Eastern Time)
    const nycTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const hour = new Date(nycTime).getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

async function generateDigestForUser(userId: string, userName: string, places: any[], research: any, weather: any, userPreferences: any) {
    const db = getSupabase();
    
    // Analyze taste
    const savedNames = new Set(places.map(p => p.name?.toLowerCase()));
    const cuisines = places.filter(p => p.main_category === 'eat').map(p => p.subtype).filter(Boolean);
    const vibes = places.map(p => p.description?.match(/cozy|trendy|casual|upscale|intimate|lively/gi)?.[0]).filter(Boolean);
    
    const tasteProfile = {
        cuisinePreferences: [...new Set(cuisines)].slice(0, 5),
        vibePreferences: [...new Set(vibes)].slice(0, 3),
        priceRange: 'moderate',
        neighborhoods: [...new Set(places.map(p => p.address?.split(',')[1]?.trim()).filter(Boolean))].slice(0, 3),
        interests: userPreferences?.all_tags?.filter((t: string) => t.startsWith('interest:'))?.map((t: string) => t.replace('interest:', '')) || []
    };
    
    // Get user personas
    const primaryPersona = userPreferences?.primary_persona || '';
    const secondaryPersona = userPreferences?.secondary_persona || '';
    const personaText = primaryPersona ? `${primaryPersona}${secondaryPersona ? ` with ${secondaryPersona} tendencies` : ''}` : '';

    // Build available sources for citation
    const availableSources = [
        ...(research.events.sources || []).map((s: any) => `${s.domain}: ${s.url}`),
        ...(research.food.sources || []).map((s: any) => `${s.domain}: ${s.url}`),
        'theskint.com: https://theskint.com/',
        'timeout.com: https://www.timeout.com/newyork/'
    ].slice(0, 15).join('\n');
    
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

    const prompt = `You are Spot. Generate a daily digest for ${userName}.

USER PERSONA: ${personaText || 'Adventurous explorer'}

TASTE PROFILE (in order of importance):
1. INTERESTS & PASSIONS: ${tasteProfile.interests.join(', ') || 'varied interests'}
2. CUISINE PREFERENCES: ${tasteProfile.cuisinePreferences.join(', ') || 'varied cuisines'}
3. VIBE PREFERENCES: ${tasteProfile.vibePreferences.join(', ') || 'flexible vibes'}
4. PRICE RANGE: ${tasteProfile.priceRange || 'moderate'}
5. NEIGHBORHOODS (least important): ${tasteProfile.neighborhoods.join(', ') || 'all NYC'}

Weather: ${weather.temp}°F, ${weather.conditions}

=== AVAILABLE SOURCES (cite these!) ===
${availableSources}

=== EVENTS ===
${research.scraped.substring(0, 2000)}
${research.events.text.substring(0, 2000)}

=== FOOD ===
${research.food.text.substring(0, 2000)}

DO NOT RECOMMEND (already saved): ${Array.from(savedNames).slice(0, 20).join(', ')}

TODAY IS: ${todayStr}

Generate exactly 21 recommendations in 2:1 pattern (EVENT, EVENT, FOOD, repeat 7 times = 14 events + 7 food).

CRITICAL - DATES:
- ONLY use dates that appear in the scraped content
- If you can't find the exact date, DON'T include the event
- Use format: YYYY-MM-DD

CRITICAL - SOURCES:
- Include the FULL URL from the AVAILABLE SOURCES section
- Format: "sources": [{"domain": "reddit.com", "url": "https://vertexaisearch..."}]

CRITICAL FORMATTING:
- NEVER use underscores! Write: "budget friendly" not "budget_friendly"

PERSONALIZATION PRIORITY:
1. FIRST reference INTERESTS: ${tasteProfile.interests.join(', ') || 'exploration'}
2. THEN reference CUISINE/VIBE: ${tasteProfile.cuisinePreferences.join(', ') || 'varied'}
3. ONLY mention location if it's a strong match

Return JSON:
{
    "intro_text": "While you were sleeping, I found some gems...",
    "recommendations": [
        {"id": "unique-id", "name": "Name", "type": "event", "description": "Perfect for you...", "location": "Venue, Neighborhood", "isEvent": true, "startDate": "2024-12-15", "mainCategory": "see", "subtype": "Concert", "sources": [{"domain": "theskint.com", "url": "https://theskint.com/"}]},
        ...
    ]
}`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const jsonMatch = (response.text || '{}').match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        
        const result = JSON.parse(jsonMatch[0]);
        
        // Fetch images for top recommendations
        for (const rec of (result.recommendations || []).slice(0, 10)) {
            if (!rec.imageUrl && GOOGLE_PLACES_API_KEY) {
                try {
                    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                            'X-Goog-FieldMask': 'places.photos'
                        },
                        body: JSON.stringify({ textQuery: `${rec.name} NYC`, maxResultCount: 1 })
                    });
                    const searchData = await searchRes.json();
                    const photoRef = searchData.places?.[0]?.photos?.[0]?.name;
                    if (photoRef) {
                        rec.imageUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${GOOGLE_PLACES_API_KEY}`;
                    }
                } catch {}
            }
            rec.id = rec.id || `${rec.name}-${Date.now()}`.replace(/\s/g, '-').toLowerCase();
        }
        
        // Save to database
        const allRecs = result.recommendations || [];
        await db.from('daily_digests').insert({
            user_id: userId,
            weather,
            greeting: `Good ${getTimeOfDay()} ${userName}`,
            intro_text: result.intro_text || "I found some things you might like...",
            recommendations: allRecs,
            shown_ids: []
        });
        
        console.log(`[Cron] ✅ Generated digest for ${userName} (${userId}) with ${allRecs.length} recs`);
        return true;
    } catch (error) {
        console.error(`[Cron] ❌ Failed to generate for ${userId}:`, error);
        return false;
    }
}

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Verify cron secret
    const secret = req.query.secret || req.headers['x-cron-secret'];
    if (secret !== CRON_SECRET) {
        console.log('[Cron] Unauthorized request');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log('[Cron] Starting daily digest generation...');
    const start = Date.now();
    const db = getSupabase();
    
    try {
        // Get all active users
        const { data: users, error: usersError } = await db
            .from('users')
            .select('id, name')
            .limit(100);
        
        if (usersError || !users) {
            console.error('[Cron] Failed to fetch users:', usersError);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }
        
        console.log(`[Cron] Found ${users.length} users`);
        
        // Check which users need a digest (none in last 12 hours)
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        
        const { data: existingDigests } = await db
            .from('daily_digests')
            .select('user_id')
            .gte('created_at', twelveHoursAgo);
        
        const usersWithDigest = new Set((existingDigests || []).map(d => d.user_id));
        const usersNeedingDigest = users.filter(u => !usersWithDigest.has(u.id));
        
        console.log(`[Cron] ${usersNeedingDigest.length} users need a digest`);
        
        if (usersNeedingDigest.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: 'All users have digests',
                totalUsers: users.length,
                generated: 0 
            });
        }
        
        // Fetch shared data once
        const [weather, research] = await Promise.all([
            fetchNYCWeather(),
            researchForDigest()
        ]);
        
        // Generate for each user (limit to 5 per cron run to avoid timeout)
        let generated = 0;
        for (const user of usersNeedingDigest.slice(0, 5)) {
            // Get user's places and preferences
            const [placesResult, prefsResult] = await Promise.all([
                db.from('places').select('*').eq('user_id', user.id).limit(50),
                db.from('user_preferences').select('*').eq('user_id', user.id).single()
            ]);
            
            const success = await generateDigestForUser(
                user.id,
                user.name || 'there',
                placesResult.data || [],
                research,
                weather,
                prefsResult.data
            );
            
            if (success) generated++;
        }
        
        console.log(`[Cron] Done in ${Date.now() - start}ms. Generated ${generated}/${usersNeedingDigest.length} digests`);
        
        return res.status(200).json({
            success: true,
            totalUsers: users.length,
            needed: usersNeedingDigest.length,
            generated,
            duration: Date.now() - start
        });
        
    } catch (error: any) {
        console.error('[Cron] Fatal error:', error);
        return res.status(500).json({ error: error.message });
    }
}

