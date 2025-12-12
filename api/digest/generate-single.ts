import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= CONFIGURATION =============

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';

// Event sites to scrape
const EVENT_SCRAPE_SITES = [
    'https://theskint.com/',
    'https://www.timeout.com/newyork/things-to-do/this-weekend',
];

// Subreddits for research
const EVENT_SUBREDDITS = ['nyc', 'AskNYC', 'NYCbitcheswithtaste'];
const FOOD_SUBREDDITS = ['FoodNYC', 'nyc', 'AskNYC'];

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
        
        // Generate quick weather quip
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
                parts: [{ text: `Generate a short, fun NYC weather one-liner. ${temp}°F, ${conditions}. Max 12 words. Be playful.` }]
            }]
        });
        return response.text?.trim() || `It's ${temp}°F out there - go explore!`;
    } catch {
        return `It's ${temp}°F and ${conditions} - perfect for adventure!`;
    }
}

// ============= FAST RESEARCH =============

async function scrapeWithJina(url: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
        
        const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
            headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (!response.ok) return '';
        const text = await response.text();
        return text.substring(0, 3000);
    } catch {
        return '';
    }
}

async function quickGeminiSearch(query: string): Promise<string> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: { tools: [{ googleSearch: {} }] }
        });
        return response.text || '';
    } catch {
        return '';
    }
}

async function fastResearch(): Promise<{ eventContent: string; foodContent: string }> {
    console.log('[Fast Research] Starting parallel research...');
    
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Run minimal parallel searches for speed
    const [events1, events2, food1, scrape1] = await Promise.all([
        quickGeminiSearch(`NYC events ${dayOfWeek} this weekend concerts shows r/nyc`),
        quickGeminiSearch(`things to do NYC today this week r/AskNYC`),
        quickGeminiSearch(`best restaurants NYC hidden gems must try r/FoodNYC`),
        scrapeWithJina('https://theskint.com/')
    ]);
    
    return {
        eventContent: `${events1}\n${events2}\n=== THESKINT.COM ===\n${scrape1}`,
        foodContent: food1
    };
}

// ============= TASTE ANALYSIS =============

interface TasteProfile {
    cuisinePreferences: string[];
    vibePreferences: string[];
    neighborhoods: string[];
    eventTypes: string[];
}

async function quickTasteAnalysis(places: any[]): Promise<TasteProfile> {
    if (!places || places.length === 0) {
        return { cuisinePreferences: [], vibePreferences: [], neighborhoods: [], eventTypes: [] };
    }
    
    const summary = places.slice(0, 20).map(p => 
        `${p.name}${p.cuisine ? ` (${p.cuisine})` : ''}${p.subtype ? ` [${p.subtype}]` : ''}`
    ).join(', ');
    
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{ text: `Quick taste analysis of these saved places: ${summary}

Return JSON only: {"cuisinePreferences":[],"vibePreferences":[],"neighborhoods":[],"eventTypes":[]}` }]
            }]
        });
        
        const jsonMatch = (response.text || '{}').match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    
    return { cuisinePreferences: [], vibePreferences: [], neighborhoods: [], eventTypes: [] };
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

async function generateDigest(
    userId: string,
    userName: string,
    userPlaces: any[],
    weather: WeatherData,
    research: { eventContent: string; foodContent: string }
): Promise<{
    greeting: string;
    intro_text: string;
    recommendations: DigestRecommendation[];
}> {
    const timeOfDay = getTimeOfDay();
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Find saved events happening soon
    const savedEvents = userPlaces.filter(p => p.is_event);
    const bumpedEvents = savedEvents.filter(p => {
        if (!p.start_date && !p.end_date) return false;
        const eventDate = new Date(p.start_date || p.end_date);
        const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 3;
    });
    
    const savedNames = new Set(userPlaces.map(p => p.name.toLowerCase()));
    const tasteProfile = await quickTasteAnalysis(userPlaces);
    
    const prompt = `You are Spot, generating a daily digest for ${userName}.

TODAY: ${dayOfWeek}, ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
WEATHER: ${weather.temp}°F, ${weather.conditions}

USER'S TASTE: ${tasteProfile.cuisinePreferences.join(', ') || 'varied'} food, ${tasteProfile.vibePreferences.join(', ') || 'mixed'} vibes

SAVED EVENTS HAPPENING SOON (BUMP THESE):
${bumpedEvents.map(e => `- ${e.name}`).join('\n') || 'None'}

DO NOT RECOMMEND (already saved):
${Array.from(savedNames).slice(0, 30).join(', ')}

=== EVENTS RESEARCH ===
${research.eventContent.substring(0, 6000)}

=== FOOD RESEARCH ===
${research.foodContent.substring(0, 3000)}

Generate 15 recommendations (10 events, 5 food - 2:1 ratio):
- FIRST: Bumped saved events (isBumped: true)
- 3-4 events for TODAY
- 3-4 events for THIS WEEKEND  
- 2-3 events for this week
- 5 food spots (NOT in saved list!)

Return JSON only:
{
    "intro_text": "While you were [doing something], I found...",
    "recommendations": [
        {"id": "unique-id", "name": "Name", "type": "event|restaurant|bar|cafe", "description": "Why perfect for them", "location": "Venue, Neighborhood", "isEvent": true, "startDate": "YYYY-MM-DD", "mainCategory": "see|eat", "subtype": "Concert|Comedy|Italian|etc", "sources": [{"domain": "theskint.com", "url": ""}], "isBumped": false, "timeframe": "today|tomorrow|weekend|week"}
    ]
}`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const jsonMatch = (response.text || '{}').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                greeting: `Good ${timeOfDay} ${userName}`,
                intro_text: parsed.intro_text || "Here's what's happening in the city!",
                recommendations: parsed.recommendations || []
            };
        }
    } catch (error) {
        console.error('[Digest] Generation failed:', error);
    }
    
    return {
        greeting: `Good ${timeOfDay} ${userName}`,
        intro_text: "Here's what's happening in NYC today!",
        recommendations: []
    };
}

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { userId } = req.body || {};
    
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    
    console.log(`[Digest Single] Generating on-demand for user: ${userId}`);
    const startTime = Date.now();
    
    try {
        const db = getSupabase();
        
        // Get user info
        const { data: user } = await db
            .from('users')
            .select('name')
            .eq('id', userId)
            .single();
        
        const userName = user?.name || 'there';
        
        // Run weather + research + places fetch in parallel
        const [weather, research, placesResult] = await Promise.all([
            fetchNYCWeather(),
            fastResearch(),
            db.from('places').select('*').eq('user_id', userId)
        ]);
        
        const places = placesResult.data || [];
        
        // Generate the digest
        const digest = await generateDigest(userId, userName, places, weather, research);
        
        // Store in database for caching
        const { data: savedDigest, error: insertError } = await db
            .from('daily_digests')
            .insert({
                user_id: userId,
                weather,
                greeting: digest.greeting,
                intro_text: digest.intro_text,
                recommendations: digest.recommendations,
                shown_ids: []
            })
            .select()
            .single();
        
        if (insertError) {
            console.error('[Digest Single] Failed to save:', insertError);
        }
        
        const duration = Date.now() - startTime;
        console.log(`[Digest Single] Complete in ${duration}ms with ${digest.recommendations.length} recommendations`);
        
        return res.status(200).json({
            success: true,
            hasDigest: true,
            digest: {
                id: savedDigest?.id || 'temp',
                greeting: digest.greeting,
                weather,
                intro_text: digest.intro_text,
                recommendations: digest.recommendations,
                shown_ids: [],
                created_at: new Date().toISOString()
            },
            duration_ms: duration
        });
        
    } catch (error: any) {
        console.error('[Digest Single] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

