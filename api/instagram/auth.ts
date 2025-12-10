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

// ============= FACEBOOK/INSTAGRAM OAUTH CONFIG =============
// Using Facebook Login for Business to get Instagram account access

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://spot-ai-3.vercel.app/api/instagram/auth';

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

async function exchangeCodeForToken(code: string): Promise<{ access_token: string } | null> {
    try {
        // Use Facebook OAuth token endpoint
        const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        url.searchParams.set('client_id', FACEBOOK_APP_ID);
        url.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
        url.searchParams.set('redirect_uri', REDIRECT_URI);
        url.searchParams.set('code', code);
        
        console.log('[IG Auth] Exchanging code for token...');
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[IG Auth] Token exchange failed:', errorText);
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
        // First get Facebook Pages the user manages
        const pagesUrl = new URL('https://graph.facebook.com/v19.0/me/accounts');
        pagesUrl.searchParams.set('fields', 'id,name,instagram_business_account');
        pagesUrl.searchParams.set('access_token', accessToken);
        
        console.log('[IG Auth] Getting Facebook Pages...');
        const pagesResponse = await fetch(pagesUrl.toString());
        
        if (!pagesResponse.ok) {
            console.error('[IG Auth] Get pages failed:', await pagesResponse.text());
            return null;
        }
        
        const pagesData = await pagesResponse.json();
        console.log('[IG Auth] Pages data:', JSON.stringify(pagesData));
        
        // Find a page with an Instagram Business Account
        const pageWithIG = pagesData.data?.find((page: any) => page.instagram_business_account);
        
        if (!pageWithIG || !pageWithIG.instagram_business_account) {
            console.error('[IG Auth] No Instagram Business Account found on any Page');
            // Try getting Instagram account directly for personal accounts
            const igUrl = new URL('https://graph.instagram.com/me');
            igUrl.searchParams.set('fields', 'id,username');
            igUrl.searchParams.set('access_token', accessToken);
            
            const igResponse = await fetch(igUrl.toString());
            if (igResponse.ok) {
                return await igResponse.json();
            }
            return null;
        }
        
        // Get Instagram account details
        const igAccountId = pageWithIG.instagram_business_account.id;
        const igUrl = new URL(`https://graph.facebook.com/v19.0/${igAccountId}`);
        igUrl.searchParams.set('fields', 'id,username');
        igUrl.searchParams.set('access_token', accessToken);
        
        console.log('[IG Auth] Getting Instagram account details...');
        const igResponse = await fetch(igUrl.toString());
        
        if (!igResponse.ok) {
            console.error('[IG Auth] Get IG account failed:', await igResponse.text());
            return null;
        }
        
        return await igResponse.json();
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
        
        // Step 1: Exchange code for access token
        const tokenResponse = await exchangeCodeForToken(code);
        if (!tokenResponse) {
            return res.redirect(`/?ig_error=${encodeURIComponent('Failed to exchange authorization code')}`);
        }
        
        console.log(`[IG Auth] Got access token`);
        
        // Step 2: Try to get long-lived token (optional, fails gracefully)
        let finalToken = tokenResponse.access_token;
        let expiresIn = 60 * 60; // Default 1 hour
        
        const longLivedToken = await exchangeForLongLivedToken(tokenResponse.access_token);
        if (longLivedToken) {
            finalToken = longLivedToken.access_token;
            expiresIn = longLivedToken.expires_in;
            console.log(`[IG Auth] Got long-lived token, expires in: ${expiresIn}s`);
        } else {
            console.log(`[IG Auth] Using short-lived token (long-lived exchange failed)`);
        }
        
        // Step 3: Get Instagram user info
        const igUser = await getInstagramUser(finalToken);
        if (!igUser) {
            return res.redirect(`/?ig_error=${encodeURIComponent('No Instagram Business account found. Make sure your Instagram is connected to a Facebook Page.')}`);
        }
        
        console.log(`[IG Auth] Instagram user: @${igUser.username} (${igUser.id})`);
        
        // Step 4: Store in database
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        
        const { error: dbError } = await getSupabase()
            .from('instagram_accounts')
            .upsert({
                user_id: spotUserId,
                ig_user_id: igUser.id,
                ig_username: igUser.username,
                access_token: finalToken,
                token_expires_at: expiresAt.toISOString(),
                scopes: ['instagram_basic', 'instagram_manage_messages', 'pages_messaging'],
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
        
        if (!FACEBOOK_APP_ID) {
            return res.status(500).json({ error: 'Instagram integration not configured. Missing FACEBOOK_APP_ID.' });
        }
        
        // Encode user ID in state for callback
        const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
        
        // Build Facebook OAuth URL (gets access to Instagram Business accounts)
        const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
        authUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        // Request permissions for Instagram messaging and pages
        authUrl.searchParams.set('scope', 'instagram_basic,instagram_manage_messages,pages_show_list,pages_messaging,pages_read_engagement');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', state);
        
        console.log('[IG Auth] Generated OAuth URL for user:', userId);
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

