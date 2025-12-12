import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= LAZY INITIALIZATION =============

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

// ============= QUICK REFRESH =============

// Fast search for new recommendations
async function quickSearch(query: string): Promise<string> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        return response.text || '';
    } catch {
        return '';
    }
}

interface RefreshRecommendation {
    id: string;
    name: string;
    type: string;
    description: string;
    location: string;
    isEvent: boolean;
    startDate?: string;
    endDate?: string;
    mainCategory: 'eat' | 'see';
    subtype: string;
    sources: Array<{ domain: string; url: string }>;
    timeframe?: 'today' | 'tomorrow' | 'weekend' | 'week';
}

async function generateQuickRefresh(
    excludedNames: string[],
    excludedIds: string[],
    tasteHints: string
): Promise<RefreshRecommendation[]> {
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Quick parallel searches
    const [eventsResult, foodResult] = await Promise.all([
        quickSearch(`NYC events happening ${dayOfWeek} this weekend concerts shows markets r/nyc`),
        quickSearch(`best restaurants NYC hidden gems must try r/FoodNYC`)
    ]);
    
    const prompt = `Generate 15 NEW recommendations for NYC (10 events, 5 food - 2:1 ratio).

TODAY: ${dayOfWeek}, ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}

ALREADY SHOWN (DO NOT INCLUDE THESE):
${excludedNames.slice(0, 30).join(', ')}

USER PREFERENCES: ${tasteHints || 'varied tastes'}

RESEARCH:
=== EVENTS ===
${eventsResult.substring(0, 3000)}

=== FOOD ===
${foodResult.substring(0, 2000)}

Return JSON array only - 10 events, 5 food spots (2:1 ratio):
[
    {
        "id": "refresh-unique-id",
        "name": "Event or Place Name",
        "type": "event|restaurant|bar|cafe",
        "description": "Brief description",
        "location": "Venue, Neighborhood",
        "isEvent": true,
        "startDate": "YYYY-MM-DD",
        "mainCategory": "see|eat",
        "subtype": "Concert|Comedy|Italian|etc",
        "sources": [{"domain": "reddit.com", "url": ""}],
        "timeframe": "today|tomorrow|weekend|week"
    }
]

CRITICAL: Do NOT include any place from the "ALREADY SHOWN" list!`;

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const text = response.text || '[]';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('[Refresh] Generation failed:', error);
    }
    
    return [];
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
    
    const { userId, excludedIds = [], excludedNames = [], tasteHints = '' } = req.body || {};
    
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    
    console.log(`[Refresh] Quick refresh for user: ${userId}, excluding ${excludedIds.length} items`);
    const startTime = Date.now();
    
    try {
        const db = getSupabase();
        
        // Generate new recommendations quickly
        const newRecs = await generateQuickRefresh(excludedNames, excludedIds, tasteHints);
        
        console.log(`[Refresh] Generated ${newRecs.length} new recommendations`);
        
        // Update the digest's shown_ids
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: digest } = await db
            .from('daily_digests')
            .select('id, shown_ids')
            .eq('user_id', userId)
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (digest) {
            const newShownIds = [...new Set([...(digest.shown_ids || []), ...excludedIds, ...newRecs.map(r => r.id)])];
            
            await db
                .from('daily_digests')
                .update({ shown_ids: newShownIds })
                .eq('id', digest.id);
        }
        
        const duration = Date.now() - startTime;
        console.log(`[Refresh] Complete in ${duration}ms`);
        
        return res.status(200).json({
            success: true,
            recommendations: newRecs,
            duration_ms: duration
        });
        
    } catch (error: any) {
        console.error('[Refresh] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

