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

// ============= CONSTANTS FROM ENV =============
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://spot-ai-3.vercel.app/api/instagram/auth';

// ============= VERIFICATION CODE SYSTEM =============
// Simple code-based linking: User gets a code from Spot, DMs it to @save.this.spot

function generateVerificationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    let code = 'SPOT-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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
                is_active: true,
                linked_at: new Date().toISOString(),
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
    
    // ============= POST: Handle Various Actions =============
    if (req.method === 'POST') {
        const { userId, action } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        
        // Generate a verification code for DM-based linking
        if (action === 'generate_code' || !action) {
            const code = generateVerificationCode();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
            
            // Store the pending verification
            const { error: insertError } = await getSupabase()
                .from('instagram_verification_codes')
                .upsert({
                    user_id: userId,
                    code: code,
                    expires_at: expiresAt.toISOString(),
                    used: false,
                }, {
                    onConflict: 'user_id',
                });
            
            if (insertError) {
                console.error('[IG Auth] Failed to store verification code:', insertError);
                // If table doesn't exist, just return the code anyway (for testing)
                console.log('[IG Auth] Returning code anyway for user:', userId);
            }
            
            console.log(`[IG Auth] Generated code ${code} for user ${userId}`);
            
            return res.status(200).json({ 
                code,
                expiresAt: expiresAt.toISOString(),
                instructions: `DM this code to @save.this.spot on Instagram to link your account!`
            });
        }
        
        // Check if user's Instagram is linked - returns ALL linked accounts
        if (action === 'check_status') {
            const { data: accounts, error: statusError } = await getSupabase()
                .from('instagram_accounts')
                .select('id, ig_user_id, ig_username, linked_at')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('linked_at', { ascending: false });
            
            console.log(`[IG Auth] check_status for user ${userId} - accounts:`, JSON.stringify(accounts), 'error:', statusError);
            
            if (accounts && accounts.length > 0) {
                const mapped = accounts.map(a => ({
                    id: a.id,
                    igUserId: a.ig_user_id,
                    username: a.ig_username,
                    linkedAt: a.linked_at
                }));
                console.log('[IG Auth] Returning accounts:', JSON.stringify(mapped));
                return res.status(200).json({ 
                    linked: true, 
                    accounts: mapped
                });
            }
            
            return res.status(200).json({ linked: false, accounts: [] });
        }
        
        // Unlink a specific Instagram account
        if (action === 'unlink') {
            const { igUserId, accountId } = req.body;
            
            console.log(`[IG Auth] Unlink request - userId: ${userId}, accountId: ${accountId}, igUserId: ${igUserId}`);
            
            if (!igUserId && !accountId) {
                console.log('[IG Auth] Missing igUserId and accountId');
                return res.status(400).json({ error: 'Missing igUserId or accountId' });
            }
            
            let query = getSupabase()
                .from('instagram_accounts')
                .update({ is_active: false })
                .eq('user_id', userId);
            
            if (accountId) {
                query = query.eq('id', accountId);
            } else if (igUserId) {
                query = query.eq('ig_user_id', igUserId);
            }
            
            const { data: unlinkResult, error: unlinkError } = await query.select();
            
            console.log(`[IG Auth] Unlink result - data:`, JSON.stringify(unlinkResult), 'error:', JSON.stringify(unlinkError));
            
            if (unlinkError) {
                console.error('[IG Auth] Unlink error:', unlinkError);
                return res.status(500).json({ error: 'Failed to unlink account' });
            }
            
            console.log(`[IG Auth] Unlinked Instagram account for user ${userId}`);
            return res.status(200).json({ success: true });
        }
        
        return res.status(400).json({ error: 'Invalid action' });
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

