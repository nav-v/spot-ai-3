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

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId is required' });
    }
    
    console.log(`[Digest Fetch] Getting digest for user: ${userId}`);
    
    try {
        const db = getSupabase();
        
        // Get today's date (start of day in UTC)
        const now = new Date();
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        
        console.log(`[Digest Fetch] Looking for digests since: ${todayUTC.toISOString()}`);
        
        // Fetch the most recent digest for this user from today (UTC)
        const { data: digest, error } = await db
            .from('daily_digests')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', todayUTC.toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('[Digest Fetch] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch digest' });
        }
        
        if (!digest) {
            console.log(`[Digest Fetch] No digest found for ${userId} today`);
            return res.status(404).json({ 
                error: 'No digest available',
                hasDigest: false 
            });
        }
        
        const allRecs = digest.recommendations || [];
        console.log(`[Digest Fetch] Found digest with ${allRecs.length} total recommendations`);
        
        // Split into first 15 (shown) and next 6 (preloaded)
        const recommendations = allRecs.slice(0, 15);
        const next_batch = allRecs.slice(15, 21);
        
        console.log(`[Digest Fetch] Returning ${recommendations.length} recommendations + ${next_batch.length} preloaded`);
        
        // Return formatted digest with split recommendations
        return res.status(200).json({
            hasDigest: true,
            digest: {
                id: digest.id,
                greeting: digest.greeting,
                weather: digest.weather,
                intro_text: digest.intro_text,
                recommendations: recommendations, // First 15
                next_batch: next_batch, // Preloaded 6
                shown_ids: digest.shown_ids,
                created_at: digest.created_at
            }
        });
        
    } catch (error: any) {
        console.error('[Digest Fetch] Fatal error:', error);
        return res.status(500).json({ error: error.message });
    }
}

