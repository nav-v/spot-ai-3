import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= LAZY INITIALIZATION =============

let supabase: SupabaseClient;
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
        supabase = createClient(url, key);
    }
    return supabase;
}

// ============= INSTAGRAM OAUTH CONFIG =============

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://your-app.vercel.app/api/instagram/auth';

// ============= TYPES =============

interface InstagramTokenResponse {
    access_token: string;
    user_id: number;
}

interface InstagramLongLivedTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface InstagramUserResponse {
    id: string;
    username: string;
}

// ============= HELPERS =============

async function exchangeCodeForToken(code: string): Promise<InstagramTokenResponse | null> {
    try {
        const response = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: INSTAGRAM_APP_ID,
                client_secret: INSTAGRAM_APP_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code: code,
            }),
        });
        
        if (!response.ok) {
            console.error('[IG Auth] Token exchange failed:', await response.text());
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('[IG Auth] Token exchange error:', error);
        return null;
    }
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<InstagramLongLivedTokenResponse | null> {
    try {
        const url = new URL('https://graph.instagram.com/access_token');
        url.searchParams.set('grant_type', 'ig_exchange_token');
        url.searchParams.set('client_secret', INSTAGRAM_APP_SECRET);
        url.searchParams.set('access_token', shortLivedToken);
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            console.error('[IG Auth] Long-lived token exchange failed:', await response.text());
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('[IG Auth] Long-lived token error:', error);
        return null;
    }
}

async function getInstagramUser(accessToken: string): Promise<InstagramUserResponse | null> {
    try {
        const url = new URL('https://graph.instagram.com/me');
        url.searchParams.set('fields', 'id,username');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            console.error('[IG Auth] Get user failed:', await response.text());
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('[IG Auth] Get user error:', error);
        return null;
    }
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

    // ============= GET: OAuth Callback =============
    if (req.method === 'GET') {
        const { code, state, error, error_reason, error_description } = req.query;
        
        // Handle OAuth errors
        if (error) {
            console.error('[IG Auth] OAuth error:', { error, error_reason, error_description });
            return res.redirect(`/?ig_error=${encodeURIComponent(error_description as string || 'Authorization failed')}`);
        }
        
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Missing authorization code' });
        }
        
        // Parse state to get Spot user ID
        let spotUserId: string | null = null;
        try {
            if (state && typeof state === 'string') {
                const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
                spotUserId = stateData.userId;
            }
        } catch (e) {
            console.error('[IG Auth] Failed to parse state:', e);
        }
        
        if (!spotUserId) {
            return res.status(400).json({ error: 'Missing user state' });
        }
        
        console.log(`[IG Auth] Processing OAuth callback for Spot user: ${spotUserId}`);
        
        // Step 1: Exchange code for short-lived token
        const tokenResponse = await exchangeCodeForToken(code);
        if (!tokenResponse) {
            return res.redirect(`/?ig_error=${encodeURIComponent('Failed to exchange authorization code')}`);
        }
        
        console.log(`[IG Auth] Got short-lived token for IG user: ${tokenResponse.user_id}`);
        
        // Step 2: Exchange for long-lived token (60 days)
        const longLivedToken = await exchangeForLongLivedToken(tokenResponse.access_token);
        if (!longLivedToken) {
            return res.redirect(`/?ig_error=${encodeURIComponent('Failed to get long-lived token')}`);
        }
        
        console.log(`[IG Auth] Got long-lived token, expires in: ${longLivedToken.expires_in}s`);
        
        // Step 3: Get Instagram user info
        const igUser = await getInstagramUser(longLivedToken.access_token);
        if (!igUser) {
            return res.redirect(`/?ig_error=${encodeURIComponent('Failed to get Instagram user info')}`);
        }
        
        console.log(`[IG Auth] Instagram user: @${igUser.username} (${igUser.id})`);
        
        // Step 4: Store in database
        const expiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000);
        
        const { error: dbError } = await getSupabase()
            .from('instagram_accounts')
            .upsert({
                user_id: spotUserId,
                ig_user_id: igUser.id,
                ig_username: igUser.username,
                access_token: longLivedToken.access_token,
                token_expires_at: expiresAt.toISOString(),
                scopes: ['instagram_basic', 'instagram_manage_messages'],
                is_active: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'ig_user_id',
            });
        
        if (dbError) {
            console.error('[IG Auth] Database error:', dbError);
            return res.redirect(`/?ig_error=${encodeURIComponent('Failed to save Instagram link')}`);
        }
        
        console.log(`[IG Auth] Successfully linked @${igUser.username} to Spot user ${spotUserId}`);
        
        // Redirect to app with success message
        return res.redirect(`/?ig_success=true&ig_username=${encodeURIComponent(igUser.username)}`);
    }
    
    // ============= POST: Generate OAuth URL =============
    if (req.method === 'POST') {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        
        // Encode user ID in state for callback
        const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
        
        // Build Instagram OAuth URL
        const authUrl = new URL('https://api.instagram.com/oauth/authorize');
        authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('scope', 'instagram_basic,instagram_manage_messages');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', state);
        
        return res.status(200).json({ authUrl: authUrl.toString() });
    }
    
    // ============= DELETE: Unlink Instagram =============
    if (req.method === 'DELETE') {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        
        const { error: dbError } = await getSupabase()
            .from('instagram_accounts')
            .update({ is_active: false })
            .eq('user_id', userId);
        
        if (dbError) {
            console.error('[IG Auth] Unlink error:', dbError);
            return res.status(500).json({ error: 'Failed to unlink Instagram' });
        }
        
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

