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

// ============= CONFIG =============

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'spot_instagram_verify_token';
const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';

// ============= TYPES =============

interface WebhookMessage {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
            type: string;
            payload?: { url?: string };
        }>;
    };
}

interface WebhookEntry {
    id: string;
    time: number;
    messaging?: WebhookMessage[];
}

interface WebhookPayload {
    object: string;
    entry: WebhookEntry[];
}

interface UrlClassification {
    type: 'ig_reel' | 'ig_post' | 'ig_story' | 'external';
    url: string;
    shortcode?: string;
}

interface UrlMetadata {
    title?: string;
    caption?: string;
    thumbnail?: string;
    author?: string;
    authorUrl?: string;
}

// ============= URL CLASSIFICATION =============

function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    return text.match(urlRegex) || [];
}

function classifyUrl(url: string): UrlClassification {
    const urlLower = url.toLowerCase();
    
    // Instagram Reel
    if (urlLower.includes('instagram.com/reel/') || urlLower.includes('instagram.com/reels/')) {
        const match = url.match(/instagram\.com\/reels?\/([A-Za-z0-9_-]+)/);
        return {
            type: 'ig_reel',
            url,
            shortcode: match?.[1],
        };
    }
    
    // Instagram Post
    if (urlLower.includes('instagram.com/p/')) {
        const match = url.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
        return {
            type: 'ig_post',
            url,
            shortcode: match?.[1],
        };
    }
    
    // Instagram Story (usually not scrapable but we track it)
    if (urlLower.includes('instagram.com/stories/')) {
        return { type: 'ig_story', url };
    }
    
    // Any other instagram.com URL treated as post
    if (urlLower.includes('instagram.com')) {
        return { type: 'ig_post', url };
    }
    
    // External URL
    return { type: 'external', url };
}

// ============= METADATA FETCHING =============

async function fetchInstagramOEmbed(url: string): Promise<UrlMetadata | null> {
    try {
        // Use Facebook's oEmbed endpoint for Instagram
        const oembedUrl = new URL('https://graph.facebook.com/v19.0/instagram_oembed');
        oembedUrl.searchParams.set('url', url);
        oembedUrl.searchParams.set('access_token', `${process.env.INSTAGRAM_APP_ID}|${INSTAGRAM_APP_SECRET}`);
        oembedUrl.searchParams.set('fields', 'title,author_name,thumbnail_url');
        
        console.log(`[oEmbed] Fetching: ${url}`);
        
        const response = await fetch(oembedUrl.toString());
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[oEmbed] Error:', errorText);
            return null;
        }
        
        const data = await response.json();
        console.log(`[oEmbed] Got metadata:`, data);
        
        return {
            title: data.title,
            caption: data.title,  // oEmbed returns caption as title
            thumbnail: data.thumbnail_url,
            author: data.author_name,
            authorUrl: `https://instagram.com/${data.author_name}`,
        };
    } catch (error) {
        console.error('[oEmbed] Exception:', error);
        return null;
    }
}

async function fetchOpenGraphMetadata(url: string): Promise<UrlMetadata | null> {
    try {
        console.log(`[OG] Fetching: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            },
            redirect: 'follow',
        });
        
        if (!response.ok) {
            console.error('[OG] Fetch failed:', response.status);
            return null;
        }
        
        const html = await response.text();
        
        // Extract Open Graph tags
        const ogTitle = html.match(/<meta\s+(?:property="og:title"|name="og:title")\s+content="([^"]+)"/i)?.[1]
            || html.match(/<meta\s+content="([^"]+)"\s+(?:property="og:title"|name="og:title")/i)?.[1];
        
        const ogDescription = html.match(/<meta\s+(?:property="og:description"|name="description")\s+content="([^"]+)"/i)?.[1]
            || html.match(/<meta\s+content="([^"]+)"\s+(?:property="og:description"|name="description")/i)?.[1];
        
        const ogImage = html.match(/<meta\s+(?:property="og:image")\s+content="([^"]+)"/i)?.[1]
            || html.match(/<meta\s+content="([^"]+)"\s+(?:property="og:image")/i)?.[1];
        
        const ogSiteName = html.match(/<meta\s+(?:property="og:site_name")\s+content="([^"]+)"/i)?.[1]
            || html.match(/<meta\s+content="([^"]+)"\s+(?:property="og:site_name")/i)?.[1];
        
        console.log(`[OG] Got metadata: title="${ogTitle?.substring(0, 50)}..."`);
        
        return {
            title: ogTitle || ogSiteName || new URL(url).hostname,
            caption: ogDescription,
            thumbnail: ogImage,
        };
    } catch (error) {
        console.error('[OG] Exception:', error);
        return null;
    }
}

async function fetchMetadata(classification: UrlClassification): Promise<UrlMetadata | null> {
    if (classification.type === 'ig_reel' || classification.type === 'ig_post') {
        // Try Instagram oEmbed first
        const oembedData = await fetchInstagramOEmbed(classification.url);
        if (oembedData) return oembedData;
        
        // Fall back to Open Graph scraping (less reliable for IG)
        return await fetchOpenGraphMetadata(classification.url);
    }
    
    if (classification.type === 'ig_story') {
        // Stories are usually not accessible
        return { title: 'Instagram Story', caption: 'Story content is not accessible via API' };
    }
    
    // External URL - use Open Graph
    return await fetchOpenGraphMetadata(classification.url);
}

// ============= INSTAGRAM SEND API =============

async function sendInstagramMessage(recipientId: string, text: string): Promise<boolean> {
    if (!PAGE_ACCESS_TOKEN) {
        console.error('[IG Send] No PAGE_ACCESS_TOKEN configured');
        return false;
    }
    
    try {
        console.log(`[IG Send] Sending message to ${recipientId}: "${text.substring(0, 50)}..."`);
        
        const response = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
                }),
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[IG Send] Failed:', errorText);
            return false;
        }
        
        console.log('[IG Send] Message sent successfully');
        return true;
    } catch (error) {
        console.error('[IG Send] Exception:', error);
        return false;
    }
}

// ============= CORE PROCESSING =============

async function processIncomingMessage(message: WebhookMessage, rawPayload: any): Promise<void> {
    const senderId = message.sender.id;
    const messageId = message.message?.mid;
    const messageText = message.message?.text || '';
    
    console.log(`[Webhook] Processing message from ${senderId}: "${messageText.substring(0, 100)}..."`);
    
    // ============= CHECK FOR VERIFICATION CODE =============
    // Format: SPOT-XXXX (case insensitive)
    const codeMatch = messageText.toUpperCase().match(/SPOT-[A-Z0-9]{4}/);
    
    if (codeMatch) {
        const code = codeMatch[0];
        console.log(`[Webhook] Detected verification code: ${code}`);
        
        // Look up the verification code
        const { data: verification, error: verifyError } = await getSupabase()
            .from('instagram_verification_codes')
            .select('user_id, expires_at, used')
            .eq('code', code)
            .single();
        
        if (verifyError || !verification) {
            console.log(`[Webhook] Invalid verification code: ${code}`);
            await sendInstagramMessage(
                senderId,
                `Hmm, that code doesn't look right. 🤔\n\nMake sure you're using the code from the Spot app (format: SPOT-XXXX). Codes expire after 30 minutes!`
            );
            return;
        }
        
        if (verification.used) {
            await sendInstagramMessage(
                senderId,
                `That code has already been used! Generate a new one in the Spot app. 🔄`
            );
            return;
        }
        
        if (new Date(verification.expires_at) < new Date()) {
            await sendInstagramMessage(
                senderId,
                `That code has expired. ⏰\n\nGenerate a new one in the Spot app and try again!`
            );
            return;
        }
        
        // Get sender's Instagram username (we'll try to fetch it)
        let igUsername = `ig_${senderId}`;
        
        // Link the Instagram account to the Spot user
        const { error: linkError } = await getSupabase()
            .from('instagram_accounts')
            .insert({
                user_id: verification.user_id,
                ig_user_id: senderId,
                ig_username: igUsername,
                is_active: true,
                linked_at: new Date().toISOString(),
            });
        
        if (linkError) {
            // Check if already linked
            if (linkError.code === '23505') { // Unique violation
                await sendInstagramMessage(
                    senderId,
                    `This Instagram account is already linked to Spot! 🎉\n\nYou can start sending me restaurant links to save.`
                );
            } else {
                console.error('[Webhook] Link error:', linkError);
                await sendInstagramMessage(
                    senderId,
                    `Oops, something went wrong linking your account. Please try again! 😅`
                );
            }
            return;
        }
        
        // Mark code as used
        await getSupabase()
            .from('instagram_verification_codes')
            .update({ used: true })
            .eq('code', code);
        
        console.log(`[Webhook] Successfully linked IG ${senderId} to Spot user ${verification.user_id}`);
        
        await sendInstagramMessage(
            senderId,
            `You're all set! 🎉✨\n\nYour Instagram is now linked to Spot. Just send me any restaurant Reel, post, or link and I'll save it to your list!\n\nTry it now - send me a link! 📍`
        );
        return;
    }
    
    // ============= REGULAR MESSAGE PROCESSING =============
    
    // Look up Spot user by Instagram ID
    const { data: igAccount, error: lookupError } = await getSupabase()
        .from('instagram_accounts')
        .select('user_id, ig_username')
        .eq('ig_user_id', senderId)
        .eq('is_active', true)
        .single();
    
    if (lookupError || !igAccount) {
        console.log(`[Webhook] No linked Spot account for IG user ${senderId}`);
        
        // Send message asking them to link their account
        await sendInstagramMessage(
            senderId,
            `Hey! 👋 I don't recognize you yet.\n\nTo save places to Spot:\n1. Open the Spot app\n2. Go to Profile → Link Instagram\n3. You'll get a code like SPOT-XXXX\n4. Send that code here!\n\nThen you can DM me any restaurant link to save it! 📍`
        );
        return;
    }
    
    const spotUserId = igAccount.user_id;
    console.log(`[Webhook] Found Spot user ${spotUserId} for @${igAccount.ig_username}`);
    
    // Extract URLs from message
    const urls = extractUrls(messageText);
    
    // Also check attachments for URLs
    if (message.message?.attachments) {
        for (const attachment of message.message.attachments) {
            if (attachment.payload?.url) {
                urls.push(attachment.payload.url);
            }
        }
    }
    
    if (urls.length === 0) {
        console.log('[Webhook] No URLs found in message');
        await sendInstagramMessage(
            senderId,
            `I didn't see any links in that message! Send me an Instagram post, Reel, or restaurant link and I'll save it to your Spot list. 📍`
        );
        return;
    }
    
    console.log(`[Webhook] Found ${urls.length} URLs: ${urls.join(', ')}`);
    
    // Process each URL
    const results: Array<{ url: string; success: boolean; name?: string; error?: string }> = [];
    
    for (const url of urls) {
        const classification = classifyUrl(url);
        console.log(`[Webhook] URL classified as: ${classification.type}`);
        
        // Store the ingested link
        const ingestedLink = {
            spot_user_id: spotUserId,
            ig_user_id: senderId,
            source_channel: 'instagram_dm',
            url: classification.url,
            url_type: classification.type,
            status: 'processing',
            webhook_message_id: messageId,
            raw_webhook_payload: rawPayload,
        };
        
        const { data: insertedLink, error: insertError } = await getSupabase()
            .from('ingested_links')
            .insert(ingestedLink)
            .select()
            .single();
        
        if (insertError) {
            console.error('[Webhook] Failed to insert ingested_link:', insertError);
            results.push({ url, success: false, error: 'Database error' });
            continue;
        }
        
        // Fetch metadata
        const metadata = await fetchMetadata(classification);
        
        if (!metadata) {
            // Update status to error
            await getSupabase()
                .from('ingested_links')
                .update({ 
                    status: classification.type === 'ig_story' ? 'error_private' : 'error_unfetchable',
                    error_message: 'Could not fetch metadata',
                    processed_at: new Date().toISOString(),
                })
                .eq('id', insertedLink.id);
            
            results.push({ url, success: false, error: 'Could not fetch content' });
            continue;
        }
        
        // Update ingested_link with metadata
        await getSupabase()
            .from('ingested_links')
            .update({ 
                metadata,
                status: 'pending',  // Ready for place creation
            })
            .eq('id', insertedLink.id);
        
        // Create a saved place
        const placeName = metadata.author 
            ? `${metadata.title || 'Saved from IG'} (via @${metadata.author})`
            : metadata.title || 'Saved from Instagram';
        
        const newPlace = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            user_id: spotUserId,
            name: placeName.substring(0, 200),  // Limit length
            type: 'restaurant',  // Default type
            address: 'New York, NY',  // Default location
            description: metadata.caption?.substring(0, 500) || null,
            image_url: metadata.thumbnail || null,
            source_url: url,
            is_visited: false,
            is_favorite: true,
            notes: `Saved from Instagram DM`,
            created_at: new Date().toISOString(),
        };
        
        const { data: savedPlace, error: placeError } = await getSupabase()
            .from('places')
            .insert(newPlace)
            .select()
            .single();
        
        if (placeError) {
            console.error('[Webhook] Failed to create place:', placeError);
            
            await getSupabase()
                .from('ingested_links')
                .update({ 
                    status: 'error_other',
                    error_message: 'Failed to create place',
                    processed_at: new Date().toISOString(),
                })
                .eq('id', insertedLink.id);
            
            results.push({ url, success: false, error: 'Failed to save place' });
            continue;
        }
        
        // Update ingested_link as saved
        await getSupabase()
            .from('ingested_links')
            .update({ 
                status: 'saved',
                saved_place_id: savedPlace.id,
                processed_at: new Date().toISOString(),
            })
            .eq('id', insertedLink.id);
        
        console.log(`[Webhook] Successfully saved place: ${savedPlace.name}`);
        results.push({ url, success: true, name: savedPlace.name });
    }
    
    // Send acknowledgment DM
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    let responseMessage = '';
    
    if (successCount > 0 && failCount === 0) {
        if (successCount === 1) {
            responseMessage = `✅ Saved! "${results[0].name}" is now on your Spot list.`;
        } else {
            responseMessage = `✅ Saved ${successCount} places to your Spot list!`;
        }
    } else if (successCount === 0 && failCount > 0) {
        responseMessage = `😅 Couldn't fetch that content - it might be private or unavailable. Try sending a different link!`;
    } else {
        responseMessage = `✅ Saved ${successCount} place${successCount > 1 ? 's' : ''}! ` +
            `(${failCount} link${failCount > 1 ? 's' : ''} couldn't be fetched)`;
    }
    
    await sendInstagramMessage(senderId, responseMessage);
}

async function addToDeadLetterQueue(payload: any, errorMessage: string): Promise<void> {
    try {
        await getSupabase()
            .from('instagram_webhook_dlq')
            .insert({
                webhook_payload: payload,
                error_message: errorMessage,
            });
        console.log('[DLQ] Added failed webhook to dead letter queue');
    } catch (e) {
        console.error('[DLQ] Failed to add to DLQ:', e);
    }
}

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ============= GET: Webhook Verification =============
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        console.log('[Webhook] Verification request:', { mode, token: token?.toString().substring(0, 5) + '...' });
        
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Webhook] Verification successful');
            return res.status(200).send(challenge);
        }
        
        console.error('[Webhook] Verification failed');
        return res.status(403).send('Verification failed');
    }
    
    // ============= POST: Incoming Webhook Events =============
    if (req.method === 'POST') {
        const payload = req.body as WebhookPayload;
        
        console.log('[Webhook] Received event:', JSON.stringify(payload).substring(0, 500));
        
        // Must respond 200 quickly to Meta
        res.status(200).send('EVENT_RECEIVED');
        
        // Process asynchronously
        try {
            if (payload.object !== 'instagram') {
                console.log('[Webhook] Ignoring non-Instagram event:', payload.object);
                return;
            }
            
            for (const entry of payload.entry) {
                if (!entry.messaging) continue;
                
                for (const message of entry.messaging) {
                    if (message.message) {
                        await processIncomingMessage(message, payload);
                    }
                }
            }
        } catch (error: any) {
            console.error('[Webhook] Processing error:', error);
            await addToDeadLetterQueue(payload, error.message || 'Unknown error');
        }
        
        return;
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

