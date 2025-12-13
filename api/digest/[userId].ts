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

        // Look for any digest in the last 12 hours (simpler, avoids timezone issues)
        const now = new Date();
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

        console.log(`[Digest Fetch] User: ${userId}, looking for digests since ${twelveHoursAgo.toISOString()}`);

        // Fetch the most recent digest for this user - use limit(1) not single()
        const { data: digests, error } = await db
            .from('daily_digests')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', twelveHoursAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[Digest Fetch] Database error:', error);
            return res.status(500).json({ error: 'Failed to fetch digest' });
        }

        console.log(`[Digest Fetch] Query returned ${digests?.length || 0} digests`);

        const digest = digests && digests.length > 0 ? digests[0] : null;

        if (!digest) {
            console.log(`[Digest Fetch] ❌ No digest found for ${userId} today`);
            return res.status(200).json({
                hasDigest: false,
                message: 'No digest available for today'
            });
        }

        console.log(`[Digest Fetch] ✅ Found digest ID: ${digest.id}, created: ${digest.created_at}`);

        const allRecs = digest.recommendations || [];
        console.log(`[Digest Fetch] Found digest with ${allRecs.length} total recommendations`);

        // If recommendations are empty, this is a placeholder still generating
        if (allRecs.length === 0) {
            // Check if placeholder is stale (older than 5 minutes = failed generation)
            const createdAt = new Date(digest.created_at);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            if (createdAt < fiveMinutesAgo) {
                // Stale placeholder - generation failed. Delete it so frontend can regenerate
                console.log(`[Digest Fetch] ❌ Stale placeholder (created ${createdAt.toISOString()}), deleting...`);
                await db.from('daily_digests').delete().eq('id', digest.id);
                return res.status(200).json({
                    hasDigest: false,
                    message: 'Digest generation timed out, please regenerate'
                });
            }

            console.log(`[Digest Fetch] ⏳ Digest is a placeholder (still generating), returning generating status`);
            return res.status(200).json({
                hasDigest: false,
                generating: true,
                message: 'Digest is being generated...'
            });
        }

        // Split into first 15 (shown) and next 6 (preloaded)
        const recommendations = allRecs.slice(0, 15);
        const next_batch = allRecs.slice(15, 21);

        console.log(`[Digest Fetch] Returning ${recommendations.length} recommendations + ${next_batch.length} preloaded`);

        // Fix stale greeting if it's still "Generating..." but we have recommendations
        let greeting = digest.greeting;
        let intro_text = digest.intro_text;
        if (greeting === 'Generating...' || intro_text === 'Curating your personalized recommendations...') {
            // Generate proper greeting based on time of day
            const nycTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
            const hour = new Date(nycTime).getHours();
            const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
            greeting = `Good ${timeOfDay}`;
            intro_text = intro_text === 'Curating your personalized recommendations...'
                ? "While you were away, I found some gems for your NYC adventures..."
                : intro_text;
            console.log(`[Digest Fetch] Fixed stale greeting: ${greeting}`);
        }

        // Return formatted digest with split recommendations
        return res.status(200).json({
            hasDigest: true,
            digest: {
                id: digest.id,
                greeting: greeting,
                weather: digest.weather,
                intro_text: intro_text,
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

