import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= SPOT MESSAGE VARIATIONS =============
// All messages written in Spot's voice: warm, funny, slightly dramatic

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

const NOT_LINKED_MESSAGES = [
    `Hey! 👋 I'm Spot – basically that friend who always "knows a place" except I actually remember them all.\n\nIf you've got a Spot account, head to Settings → Link Instagram to connect us!\n\nNo account yet? Join the waitlist at https://spot-ai-3.vercel.app/ ✨`,
    `Oh hey! 👋 I don't recognize you yet, but that's very fixable.\n\nI'm Spot – I help you save all those restaurants and spots you see on Instagram (and actually go to them someday).\n\nGot an account? Settings → Link Instagram\nNeed one? https://spot-ai-3.vercel.app/ ✨`,
    `Hey there! I'm Spot – think of me as your personal restaurant memory bank 🧠✨\n\nRight now I don't know who you are though! If you have an account, go to Settings → Link Instagram.\n\nNo account? Get on the waitlist: https://spot-ai-3.vercel.app/`,
    `Oh hi! 👋 I'm Spot. I save places so you don't have to screenshot them and never look at them again. (We've all been there.)\n\nTo connect: Settings → Link Instagram in the app.\nNew here? https://spot-ai-3.vercel.app/ ✨`,
    `Hey! 👋 Spot here – the AI that makes sure "we should totally try this place" actually happens.\n\nI don't recognize you yet! Link up: Settings → Link Instagram\n\nOr join the waitlist: https://spot-ai-3.vercel.app/ ✨`,
];

const CANT_CHAT_MESSAGES = [
    `I can't really chat here 😅 (Instagram DMs are not my strong suit)\n\nBut! If you want to talk, plan something, or get recommendations – I'm way more helpful at https://spot-ai-3.vercel.app/ ✨\n\nSend me a post or Reel though and I'll save it! 📍`,
    `Ah, I wish I could chat here but Instagram keeps me limited 😅\n\nFor the full Spot experience (recommendations, planning, roasting your saved places) – head to https://spot-ai-3.vercel.app/\n\nBut if you send me a post, I'll save it for you! 📍`,
    `DMs aren't really my thing 😅 (I'm more of an "in-app" conversationalist)\n\nCome chat with me properly at https://spot-ai-3.vercel.app/ – I'm way more fun there!\n\nBut send me a Reel or post and I'll add it to your list! 📍`,
    `Ooh I'd love to chat but Instagram won't let me be my full self here 😅\n\nThe real magic happens at https://spot-ai-3.vercel.app/ – recommendations, planning, the whole thing!\n\nI CAN save posts though – just send one over! 📍`,
    `I'd chat but Instagram has me on read-only mode basically 😅\n\nThe full Spot experience lives at https://spot-ai-3.vercel.app/ – come through!\n\nSend me a post though and I'll save it instantly 📍`,
];

const SAVED_SUCCESS_MESSAGES = [
    (name: string) => `✅ Saved! "${name}" is officially on your list. Future you is gonna be so grateful.`,
    (name: string) => `✅ Got it! "${name}" is saved. One day you'll actually go and it'll be worth it.`,
    (name: string) => `✅ Done! "${name}" is on your list. The "I need to try this" energy is strong with this one.`,
    (name: string) => `✅ Saved! "${name}" – added to the collection. Your taste is immaculate, as usual.`,
    (name: string) => `✅ "${name}" is now on your list! Saved and ready for whenever you're feeling it.`,
    (name: string) => `✅ Boom! "${name}" saved. Another one for the "we should go there" pile.`,
    (name: string) => `✅ Got it! "${name}" is locked in. Present you is really looking out for future you.`,
    (name: string) => `✅ Saved! "${name}" – your list is looking good. 📍`,
    (name: string) => `✅ "${name}" saved! Your future self just high-fived you.`,
    (name: string) => `✅ Saved! "${name}" is on the list. The collection grows. 📍`,
];

const SAVED_MULTIPLE_MESSAGES = [
    (count: number) => `✅ Saved ${count} places from that post! Your list is really getting impressive.`,
    (count: number) => `✅ Got ${count} places from that one! Someone's doing their research. 📍`,
    (count: number) => `✅ ${count} places saved! You really know how to pick 'em.`,
    (count: number) => `✅ Boom! ${count} spots added to your list. Efficient. I respect it.`,
    (count: number) => `✅ Saved ${count} places! Future you has a lot of options now.`,
];

const UNKNOWN_PLACE_MESSAGES = [
    (name: string) => `🤔 I couldn't quite figure out what place that is.\n\nSaved it as "${name}" for now – reply with the real name and I'll update it!\n\nOr edit it in the app whenever 📱`,
    (name: string) => `Hmm, couldn't crack this one 🤔\n\nI've saved it as "${name}" – send me the actual name and I'll fix it!\n\nOr update it in the app 📱`,
    (name: string) => `🤔 This one's tricky – couldn't find the place info.\n\nSaved as "${name}" for now. Reply with the name and I'll update it!\n\nOr fix it in the app whenever 📱`,
    (name: string) => `I'm stumped on this one 🤔\n\nSaved it as "${name}" – tell me the real name and I'll sort it out!\n\nOr edit it in the app 📱`,
    (name: string) => `This one's a mystery 🤔\n\nI've saved it as "${name}" – reply with the actual name and I'll fix it!\n\nOr update in the app 📱`,
];

const LINKED_SUCCESS_MESSAGES = [
    `You're in! 🎉 We're officially connected.\n\nNow just send me any food post, Reel, or restaurant link and I'll save it to your Spot list!\n\nThis is gonna be beautiful ✨`,
    `Let's go! 🎉 We're linked!\n\nSend me posts and Reels and I'll save them to your list. Easy.\n\nWelcome to the Spot life ✨`,
    `We're connected! 🎉 The bond is sealed.\n\nNow just forward me posts and I'll add them to your list!\n\nThis is the start of something beautiful ✨`,
    `Boom! 🎉 You're all set!\n\nSend me restaurant posts and Reels – I'll save them for you.\n\nLet's build that list ✨`,
    `Nice! 🎉 We're officially linked.\n\nJust forward me any food post and I'll add it to your Spot list!\n\nThe saving begins ✨`,
];

const INVALID_CODE_MESSAGES = [
    `Hmm, that code doesn't look right 🤔\n\nMake sure you're using the one from Settings → Link Instagram (format: SPOT-XXXX).\n\nThey expire after 30 mins!`,
    `That code isn't working 🤔\n\nCheck Settings → Link Instagram for the right one (SPOT-XXXX format).\n\nCodes expire after 30 minutes!`,
    `Oops, code not recognized 🤔\n\nGrab a fresh one from Settings → Link Instagram.\n\nThey're only valid for 30 mins!`,
];

const CODE_USED_MESSAGES = [
    `That code's already been used! 🔄\n\nGenerate a new one in Settings → Link Instagram.`,
    `This code was already claimed! 🔄\n\nGet a fresh one from Settings → Link Instagram.`,
    `Already used that one! 🔄\n\nHead to Settings → Link Instagram for a new code.`,
];

const CODE_EXPIRED_MESSAGES = [
    `That code expired ⏰\n\nGrab a fresh one from Settings → Link Instagram!`,
    `Code timed out ⏰\n\nGet a new one from Settings → Link Instagram!`,
    `This code has expired ⏰\n\nGenerate a new one in Settings → Link Instagram!`,
];

const FETCH_FAILED_MESSAGES = [
    `😅 Couldn't grab that content – might be private or unavailable.\n\nTry a different post!`,
    `Hmm, couldn't access that one 😅 It might be private.\n\nSend me another!`,
    `That one didn't work 😅 Could be private or expired.\n\nTry a different post!`,
    `Couldn't fetch that content 😅 Might be a private account.\n\nSend another one!`,
    `😅 That post isn't accessible – maybe it's private?\n\nTry sending a different one!`,
];

const ENHANCE_SUCCESS_MESSAGES = [
    (name: string, address: string) => `Found it! ✨ Updated to "${name}" at ${address}.\n\nCheck it out in the app!`,
    (name: string, address: string) => `Got it! ✨ "${name}" is all set now. ${address}\n\nLooking good in the app!`,
    (name: string, address: string) => `Nice! ✨ Updated to "${name}" – ${address}\n\nGo check your list!`,
    (name: string, address: string) => `Boom! ✨ "${name}" locked in. ${address}\n\nYour list is looking great!`,
];

const ENHANCE_UPDATE_FAILED_MESSAGES = [
    (name: string) => `Found "${name}" but something went wrong updating it 😅\n\nTry editing it directly in the app! 📱`,
    (name: string) => `Got "${name}" but couldn't save the update 😅\n\nHead to the app to fix it! 📱`,
];

const ENHANCE_NOT_FOUND_MESSAGES = [
    (query: string) => `Hmm, I couldn't find "${query}" 🤔\n\nTry being more specific (like "Lucali Brooklyn") or edit it directly in the app! 📱`,
    (query: string) => `No luck finding "${query}" 🤔\n\nTry the full name + neighborhood, or edit in the app! 📱`,
    (query: string) => `Couldn't find "${query}" 🤔\n\nBe more specific (name + area) or fix it in the app! 📱`,
];

// ============= LAZY INITIALIZATION =============

// Direct REST API calls to avoid client library issues
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// ============= INSTAGRAM ID TO SHORTCODE =============
// Convert Instagram media ID to shortcode for constructing URLs
// Based on: https://github.com/slang800/instagram-id-to-url-segment
// and https://stackoverflow.com/questions/24437823/get-instagram-post-url-from-media-id
function mediaIdToShortcode(instagramId: string | number): string {
    // Ensure we have a string and handle underscore-separated IDs (e.g. "12345_6789")
    let idStr = String(instagramId);
    
    // If the ID contains underscore, take only the first part (the actual media ID)
    if (idStr.includes('_')) {
        idStr = idStr.substring(0, idStr.indexOf('_'));
    }
    
    console.log(`[Shortcode] Converting media ID: "${idStr}" (original: "${instagramId}")`);
    
    // BigInt is required because Instagram IDs are too large for JavaScript Number
    // (they can be 19+ digits, but Number only handles up to ~15 digits precisely)
    try {
        let bigId = BigInt(idStr);
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let shortcode = '';
        
        // Convert Base10 ID to Base64 Shortcode
        while (bigId > 0n) {
            const remainder = bigId % 64n;
            bigId = bigId / 64n;
            shortcode = alphabet.charAt(Number(remainder)) + shortcode;
        }
        
        console.log(`[Shortcode] Result: "${shortcode}"`);
        return shortcode;
    } catch (error) {
        console.error(`[Shortcode] Failed to convert "${idStr}":`, error);
        // Return the original as fallback (might work for newer format IDs)
        return idStr;
    }
}

// ============= GOOGLE PLACES API =============
// Same as chat.ts - search and enrich place data
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

async function searchGooglePlaces(placeName: string, location: string = 'New York, NY') {
    if (!GOOGLE_PLACES_API_KEY) {
        console.log('[Google Places] No API key configured');
        return null;
    }

    try {
        const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
        console.log(`[Google Places] Searching for: "${placeName}" in ${location}`);

        const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.websiteUri,places.types,places.photos,places.editorialSummary,places.location'
            },
            body: JSON.stringify({
                textQuery: `${placeName} ${location}`,
                maxResultCount: 1
            })
        });

        const searchData = await searchResponse.json();

        if (!searchData.places || searchData.places.length === 0) {
            console.log(`[Google Places] No results found for "${placeName}"`);
            return null;
        }

        const place = searchData.places[0];
        console.log(`[Google Places] Found: ${place.displayName?.text}`);

        // Get photo URL if available
        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoName = place.photos[0].name;
            imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${GOOGLE_PLACES_API_KEY}`;
        }

        // Determine main_category and subtype from Google Places types
        const types = place.types || [];
        let mainCategory: 'eat' | 'see' = 'eat';
        let subtype = 'Restaurant';
        let legacyType = 'restaurant';

        // Check for Eat types
        if (types.some((t: string) => t.includes('restaurant') || t.includes('food'))) {
            mainCategory = 'eat';
            legacyType = 'restaurant';
            if (types.includes('italian_restaurant')) subtype = 'Italian';
            else if (types.includes('chinese_restaurant')) subtype = 'Chinese';
            else if (types.includes('japanese_restaurant')) subtype = 'Japanese';
            else if (types.includes('indian_restaurant')) subtype = 'Indian';
            else if (types.includes('mexican_restaurant')) subtype = 'Mexican';
            else if (types.includes('pizza_restaurant')) subtype = 'Pizza';
            else if (types.includes('seafood_restaurant')) subtype = 'Seafood';
            else if (types.includes('american_restaurant')) subtype = 'American';
            else if (types.includes('thai_restaurant')) subtype = 'Thai';
            else if (types.includes('vietnamese_restaurant')) subtype = 'Vietnamese';
            else if (types.includes('korean_restaurant')) subtype = 'Korean';
            else subtype = 'Restaurant';
        } else if (types.some((t: string) => t.includes('bar') || t.includes('night_club'))) {
            mainCategory = 'eat';
            legacyType = 'bar';
            subtype = 'Bar';
        } else if (types.some((t: string) => t.includes('cafe') || t.includes('coffee'))) {
            mainCategory = 'eat';
            legacyType = 'cafe';
            subtype = 'Coffee';
        } else if (types.some((t: string) => t.includes('bakery'))) {
            mainCategory = 'eat';
            legacyType = 'restaurant';
            subtype = 'Bakery';
        } else if (types.some((t: string) => t.includes('museum'))) {
            mainCategory = 'see';
            legacyType = 'attraction';
            subtype = 'Museum';
        } else if (types.some((t: string) => t.includes('art_gallery'))) {
            mainCategory = 'see';
            legacyType = 'attraction';
            subtype = 'Gallery';
        } else if (types.some((t: string) => t.includes('park'))) {
            mainCategory = 'see';
            legacyType = 'attraction';
            subtype = 'Park';
        } else if (types.some((t: string) => t.includes('theater') || t.includes('movie_theater'))) {
            mainCategory = 'see';
            legacyType = 'attraction';
            subtype = 'Theater';
        } else if (types.some((t: string) => t.includes('tourist_attraction') || t.includes('landmark'))) {
            mainCategory = 'see';
            legacyType = 'attraction';
            subtype = 'Landmark';
        } else if (types.some((t: string) => t.includes('shopping') || t.includes('store'))) {
            mainCategory = 'see';
            legacyType = 'activity';
            subtype = 'Shopping';
        }

        return {
            name: place.displayName?.text || placeName,
            type: legacyType,
            mainCategory,
            subtype,
            address: place.formattedAddress || location,
            description: place.editorialSummary?.text || '',
            sourceUrl: place.websiteUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
            imageUrl,
            rating: place.rating || null,
            coordinates: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null,
            googleTypes: types
        };
    } catch (error) {
        console.error('[Google Places] API error:', error);
        return null;
    }
}

// ============= GEMINI CATEGORIZATION FALLBACK =============

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function categorizePlaceWithAI(
    placeName: string, 
    description: string, 
    googleTypes: string[]
): Promise<{ mainCategory: 'eat' | 'see'; subtype: string }> {
    if (!GEMINI_API_KEY) {
        console.log('[AI Categorize] No API key, using defaults');
        return { mainCategory: 'eat', subtype: 'Restaurant' };
    }

    try {
        console.log(`[AI Categorize] Categorizing: "${placeName}"`);
        
        const prompt = `You are a place categorization expert. Categorize this place into one of two main categories and a specific subtype.

PLACE: "${placeName}"
DESCRIPTION: "${description || 'No description'}"
GOOGLE TYPES: ${googleTypes.length > 0 ? googleTypes.join(', ') : 'None'}

CATEGORIES:
1. "eat" - Restaurants, cafes, bars, bakeries, food trucks, any place primarily for eating/drinking
2. "see" - Museums, parks, attractions, landmarks, theaters, galleries, activities, events

Respond with ONLY valid JSON: {"mainCategory": "eat" or "see", "subtype": "specific subtype"}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
                })
            }
        );

        if (!response.ok) {
            return { mainCategory: 'eat', subtype: 'Restaurant' };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`[AI Categorize] Result: ${parsed.mainCategory}/${parsed.subtype}`);
            return {
                mainCategory: parsed.mainCategory === 'see' ? 'see' : 'eat',
                subtype: parsed.subtype || 'Other'
            };
        }
        
        return { mainCategory: 'eat', subtype: 'Restaurant' };
    } catch (error) {
        console.error('[AI Categorize] Error:', error);
        return { mainCategory: 'eat', subtype: 'Restaurant' };
    }
}

function isAmbiguousType(googleTypes: string[]): boolean {
    if (!googleTypes || googleTypes.length === 0) return true;
    const ambiguousTypes = ['point_of_interest', 'establishment', 'premise', 'street_address', 'route', 'locality'];
    const hasSpecificType = googleTypes.some(t => 
        !ambiguousTypes.includes(t) && 
        (t.includes('restaurant') || t.includes('cafe') || t.includes('bar') || 
         t.includes('museum') || t.includes('park') || t.includes('theater') ||
         t.includes('gallery') || t.includes('attraction'))
    );
    return !hasSpecificType;
}

// Use Gemini AI to extract ALL place names from Instagram caption
// Same approach as chat.ts - returns array of places

interface ExtractedPlace {
    name: string;
    location: string;
    isEvent?: boolean;
}

async function extractPlacesWithAI(caption: string): Promise<ExtractedPlace[]> {
    if (!GEMINI_API_KEY) {
        console.log('[AI Extract] No Gemini API key, falling back to regex');
        const single = extractPlaceNameFromCaptionRegex(caption);
        return single ? [{ name: single.placeName, location: single.location }] : [];
    }
    
    try {
        console.log(`[AI Extract] Analyzing caption: "${caption.substring(0, 100)}..."`);
        
        // Same prompt as chat.ts for consistency
        const prompt = `Identify all restaurant/place/event names mentioned in this social media caption: "${caption}". 
Return ONLY a JSON object: { "places": [{ "name": "...", "location": "...", "isEvent": boolean }] }
If no places found, return { "places": [] }.

Look for:
- @mentions (often the restaurant's Instagram handle like @fontysdeli -> "Fonty's Deli")
- Hashtags with place names (like #fontysdeli -> "Fonty's Deli")
- Direct mentions in the text
- Multiple places if mentioned

Default location to "New York, NY" if not specified.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500,
                    }
                }),
            }
        );
        
        if (!response.ok) {
            console.log(`[AI Extract] Gemini API error: ${response.status}`);
            const single = extractPlaceNameFromCaptionRegex(caption);
            return single ? [{ name: single.placeName, location: single.location }] : [];
        }
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`[AI Extract] Gemini response: ${text}`);
        
        // Parse JSON response - handle markdown code blocks
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.places && parsed.places.length > 0) {
                console.log(`[AI Extract] Found ${parsed.places.length} places:`, parsed.places.map((p: any) => p.name));
                return parsed.places.map((p: any) => ({
                    name: p.name,
                    location: p.location || 'New York, NY',
                    isEvent: p.isEvent || false
                }));
            }
        }
        
        return [];
    } catch (error) {
        console.error('[AI Extract] Error:', error);
        const single = extractPlaceNameFromCaptionRegex(caption);
        return single ? [{ name: single.placeName, location: single.location }] : [];
    }
}

// Generate a descriptive placeholder name for unknown places
async function generatePlaceholderName(caption: string): Promise<{ name: string; category: 'eat' | 'see'; subtype: string }> {
    if (!GEMINI_API_KEY) {
        return { name: 'Mystery Restaurant', category: 'eat', subtype: 'Restaurant' };
    }
    
    try {
        console.log(`[AI Placeholder] Generating name for: "${caption.substring(0, 100)}..."`);
        
        const prompt = `Based on this Instagram caption, generate a SHORT placeholder name for a place we couldn't identify.
Caption: "${caption}"

Rules:
- Start with "Mystery" or "Unknown" or "Secret"
- Include a clue from the caption (cuisine type, vibe, neighborhood hint)
- Keep it under 30 characters
- Also determine if this is a food place (eat) or activity/attraction (see)
- Suggest a subtype (e.g., "Italian", "Sushi", "Bar", "Cafe" for eat; "Museum", "Show", "Event" for see)

Examples:
- "Mystery Indian Spot"
- "Unknown Cocktail Bar"
- "Secret Sushi Place"
- "Mystery Brooklyn Cafe"

Return JSON only: { "name": "...", "category": "eat" or "see", "subtype": "..." }`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 200,
                    }
                }),
            }
        );
        
        if (!response.ok) {
            console.log(`[AI Placeholder] Gemini API error: ${response.status}`);
            return { name: 'Mystery Restaurant', category: 'eat', subtype: 'Restaurant' };
        }
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`[AI Placeholder] Gemini response: ${text}`);
        
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                name: parsed.name?.substring(0, 50) || 'Mystery Restaurant',
                category: parsed.category === 'see' ? 'see' : 'eat',
                subtype: parsed.subtype || (parsed.category === 'see' ? 'Activity' : 'Restaurant')
            };
        }
        
        return { name: 'Mystery Restaurant', category: 'eat', subtype: 'Restaurant' };
    } catch (error) {
        console.error('[AI Placeholder] Error:', error);
        return { name: 'Mystery Restaurant', category: 'eat', subtype: 'Restaurant' };
    }
}

// Fallback regex-based extraction
function extractPlaceNameFromCaptionRegex(caption: string): { placeName: string; location: string } | null {
    // Try to find @mentions (often the restaurant's handle)
    const mentionMatch = caption.match(/@([a-zA-Z0-9_]+)/);
    if (mentionMatch) {
        const handle = mentionMatch[1]
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2');
        console.log(`[Regex Extract] Found @mention: ${mentionMatch[1]} -> "${handle}"`);
        return { placeName: handle, location: 'New York, NY' };
    }
    
    // Try hashtags
    const hashtagMatches = caption.match(/#([a-zA-Z0-9]+)/g) || [];
    const genericTags = ['food', 'foodie', 'nyc', 'eats', 'yum', 'delicious', 'restaurant', 'cafe', 'bar'];
    for (const tag of hashtagMatches) {
        const cleanTag = tag.slice(1).toLowerCase();
        if (!genericTags.some(g => cleanTag.includes(g)) && cleanTag.length > 3) {
            const placeName = cleanTag.replace(/([a-z])([A-Z])/g, '$1 $2');
            console.log(`[Regex Extract] Found hashtag: ${tag} -> "${placeName}"`);
            return { placeName, location: 'New York, NY' };
        }
    }
    
    return null;
}

// Construct Instagram URL from attachment data
function getInstagramUrlFromAttachment(attachment: any): string | null {
    const payload = attachment.payload as any;
    const attachmentType = attachment.type;
    
    // Extensive debug logging
    console.log(`[Webhook] ========== ATTACHMENT DEBUG ==========`);
    console.log(`[Webhook] Attachment type: "${attachmentType}"`);
    console.log(`[Webhook] Payload keys: ${payload ? Object.keys(payload).join(', ') : 'null'}`);
    console.log(`[Webhook] Full payload: ${JSON.stringify(payload)?.substring(0, 1000)}`);
    
    // Check if Instagram provides a shortcode directly
    if (payload?.shortcode) {
        console.log(`[Webhook] Found shortcode directly in payload: ${payload.shortcode}`);
        const isReel = attachmentType?.includes('reel') || payload?.media_type === 'REEL';
        const url = isReel 
            ? `https://www.instagram.com/reel/${payload.shortcode}/`
            : `https://www.instagram.com/p/${payload.shortcode}/`;
        return url;
    }
    
    // 1. Check if a direct Instagram URL is provided (NOT CDN URLs)
    // CDN URLs look like: lookaside.fbsbx.com or scontent.cdninstagram.com
    if (payload?.url && payload.url.includes('instagram.com/') && 
        !payload.url.includes('lookaside') && !payload.url.includes('cdninstagram')) {
        console.log(`[Webhook] Using direct Instagram URL from payload.url: ${payload.url}`);
        return payload.url;
    }
    
    // Check for link field (some attachments have this)
    if (payload?.link && payload.link.includes('instagram.com/') && 
        !payload.link.includes('lookaside') && !payload.link.includes('cdninstagram')) {
        console.log(`[Webhook] Using direct Instagram URL from payload.link: ${payload.link}`);
        return payload.link;
    }
    
    // 2. For Reels - check multiple possible field names
    if (attachmentType === 'ig_reel' || attachmentType === 'reel') {
        const mediaId = payload?.reel_video_id || payload?.id || payload?.media_id;
        console.log(`[Webhook] Reel detected. reel_video_id=${payload?.reel_video_id}, id=${payload?.id}, media_id=${payload?.media_id}`);
        if (mediaId) {
            const shortcode = mediaIdToShortcode(String(mediaId));
            const url = `https://www.instagram.com/reel/${shortcode}/`;
            console.log(`[Webhook] Reel: Converted ID "${mediaId}" to shortcode "${shortcode}" -> ${url}`);
            return url;
        }
        console.log(`[Webhook] Reel attachment but no media ID found in any field`);
    }
    
    // 3. For shares/posts - check multiple possible field names  
    if (attachmentType === 'share' || attachmentType === 'media_share' || attachmentType === 'ig_post') {
        // Instagram uses different field names in different contexts
        const mediaId = payload?.ig_post_media_id || payload?.media_id || payload?.id;
        console.log(`[Webhook] Share detected. ig_post_media_id=${payload?.ig_post_media_id}, media_id=${payload?.media_id}, id=${payload?.id}`);
        if (mediaId) {
            const shortcode = mediaIdToShortcode(String(mediaId));
            const url = `https://www.instagram.com/p/${shortcode}/`;
            console.log(`[Webhook] Post: Converted ID "${mediaId}" to shortcode "${shortcode}"`);
            return url;
        }
        console.log(`[Webhook] Share attachment but no media ID found`);
    }
    
    // 4. For stories
    if (attachmentType === 'ig_story' || attachmentType === 'story') {
        const storyId = payload?.story_id || payload?.id;
        if (storyId) {
            // Stories don't have permanent URLs, but we can try
            console.log(`[Webhook] Story detected with ID: ${storyId} (stories are ephemeral)`);
            return null; // Stories aren't accessible via URL
        }
    }
    
    // 5. Fallback: Try to find ANY media ID in the payload
    const possibleIdFields = ['reel_video_id', 'ig_post_media_id', 'media_id', 'id', 'post_id'];
    for (const field of possibleIdFields) {
        if (payload?.[field]) {
            const mediaId = String(payload[field]);
            console.log(`[Webhook] Fallback: Found ID in field "${field}": ${mediaId}`);
            
            // Determine if it's a reel based on:
            // 1. Attachment type contains 'reel'
            // 2. Field name is 'reel_video_id'
            // 3. media_product_type is 'REELS'
            const isReel = attachmentType?.includes('reel') || 
                           field === 'reel_video_id' ||
                           payload?.media_product_type === 'REELS';
            
            const shortcode = mediaIdToShortcode(mediaId);
            const url = isReel 
                ? `https://www.instagram.com/reel/${shortcode}/`
                : `https://www.instagram.com/p/${shortcode}/`;
            console.log(`[Webhook] Fallback: Converted to ${url} (isReel: ${isReel})`);
            return url;
        }
    }
    
    // 6. Last resort: If we have a CDN URL, try to extract media ID from it
    if (payload?.url && (payload.url.includes('lookaside') || payload.url.includes('cdninstagram'))) {
        // CDN URLs sometimes contain asset_id parameter
        const assetMatch = payload.url.match(/asset_id=(\d+)/);
        if (assetMatch) {
            const assetId = assetMatch[1];
            console.log(`[Webhook] Extracted asset_id from CDN URL: ${assetId}`);
            const shortcode = mediaIdToShortcode(assetId);
            // Assume reel if it's an ig_reel type, otherwise post
            const isReel = attachmentType === 'ig_reel';
            const url = isReel
                ? `https://www.instagram.com/reel/${shortcode}/`
                : `https://www.instagram.com/p/${shortcode}/`;
            console.log(`[Webhook] CDN URL extracted: ${url}`);
            return url;
        }
    }
    
    console.log(`[Webhook] ========== COULD NOT EXTRACT URL ==========`);
    console.log(`[Webhook] Attachment type: ${attachmentType}`);
    console.log(`[Webhook] Available payload: ${JSON.stringify(payload)}`);
    return null;
}

async function supabaseQuery(table: string, params: { 
    select?: string; 
    eq?: Record<string, string>;
    single?: boolean;
}): Promise<{ data: any; error: any }> {
    try {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
        if (params.select) url.searchParams.set('select', params.select);
        if (params.eq) {
            for (const [key, value] of Object.entries(params.eq)) {
                url.searchParams.set(key, `eq.${value}`);
            }
        }
        
        console.log(`[DB] Query: ${table}, params: ${JSON.stringify(params)}`);
        console.log(`[DB] URL: ${url.toString().substring(0, 80)}...`);
        console.log(`[DB] Key present: ${SUPABASE_KEY ? 'yes' : 'NO'}`);
        
        // Try with a Promise.race timeout
        const fetchPromise = fetch(url.toString(), {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
        });
        
        const timeoutPromise = new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('Fetch timeout after 4s')), 4000);
        });
        
        console.log(`[DB] Starting fetch race...`);
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        console.log(`[DB] Got response: ${response.status}`);
        
        const data = await response.json();
        console.log(`[DB] Response data: ${JSON.stringify(data).substring(0, 200)}`);
        
        if (!response.ok) {
            return { data: null, error: data };
        }
        
        if (params.single) {
            return { data: Array.isArray(data) ? data[0] || null : data, error: null };
        }
        return { data, error: null };
    } catch (error: any) {
        console.error(`[DB] Error:`, error.message || error);
        return { data: null, error: { message: error.message || 'Unknown error' } };
    }
}

async function supabaseInsert(table: string, record: Record<string, any>): Promise<{ error: any }> {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${table}`;
        console.log(`[DB] Insert into ${table}:`, JSON.stringify(record).substring(0, 100));
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify(record),
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error(`[DB] Insert error:`, error);
            return { error };
        }
        
        console.log(`[DB] Insert success`);
        return { error: null };
    } catch (error: any) {
        console.error(`[DB] Insert exception:`, error.message);
        return { error: { message: error.message } };
    }
}

async function supabaseUpdate(table: string, updates: Record<string, any>, eq: Record<string, string>): Promise<{ error: any }> {
    try {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
        for (const [key, value] of Object.entries(eq)) {
            url.searchParams.set(key, `eq.${value}`);
        }
        
        console.log(`[DB] Update ${table}:`, JSON.stringify(updates));
        
        const response = await fetch(url.toString(), {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify(updates),
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error(`[DB] Update error:`, error);
            return { error };
        }
        
        console.log(`[DB] Update success`);
        return { error: null };
    } catch (error: any) {
        console.error(`[DB] Update exception:`, error.message);
        return { error: { message: error.message } };
    }
}

// Keep old client for compatibility but we'll use REST API
let supabase: SupabaseClient;
function getSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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
        
        // Use Instagram Graph API endpoint for sending DMs
        const response = await fetch(
            `https://graph.instagram.com/v21.0/me/messages`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PAGE_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text },
                }),
            }
        );
        
        const responseText = await response.text();
        console.log(`[IG Send] Response status: ${response.status}, body: ${responseText}`);
        
        if (!response.ok) {
            console.error('[IG Send] Failed:', responseText);
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
        
        // Look up the verification code using REST API
        console.log(`[Webhook] Looking up code in database: ${code}`);
        const { data: verification, error: verifyError } = await supabaseQuery('instagram_verification_codes', {
            select: 'user_id,expires_at,used',
            eq: { code },
            single: true,
        });
        
        console.log(`[Webhook] Lookup result - data: ${JSON.stringify(verification)}, error: ${JSON.stringify(verifyError)}`);
        
        if (verifyError || !verification) {
            console.log(`[Webhook] Invalid verification code: ${code}, error: ${JSON.stringify(verifyError)}`);
            await sendInstagramMessage(senderId, pickRandom(INVALID_CODE_MESSAGES));
            return;
        }
        
        if (verification.used) {
            await sendInstagramMessage(senderId, pickRandom(CODE_USED_MESSAGES));
            return;
        }
        
        if (new Date(verification.expires_at) < new Date()) {
            await sendInstagramMessage(senderId, pickRandom(CODE_EXPIRED_MESSAGES));
            return;
        }
        
        // Get sender's Instagram username (we'll try to fetch it)
        let igUsername = `ig_${senderId}`;
        
        console.log(`[Webhook] Code valid! Linking IG ${senderId} to Spot user ${verification.user_id}`);
        
        // Link the Instagram account to the Spot user using REST API
        const { error: linkError } = await supabaseInsert('instagram_accounts', {
            user_id: verification.user_id,
            ig_user_id: senderId,
            ig_username: igUsername,
            is_active: true,
            linked_at: new Date().toISOString(),
        });
        
        console.log(`[Webhook] Insert result - error: ${JSON.stringify(linkError)}`);
        
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
        await supabaseUpdate('instagram_verification_codes', { used: true }, { code });
        
        console.log(`[Webhook] Successfully linked IG ${senderId} to Spot user ${verification.user_id}`);
        
        await sendInstagramMessage(senderId, pickRandom(LINKED_SUCCESS_MESSAGES));
        return;
    }
    
    // ============= REGULAR MESSAGE PROCESSING =============
    
    // Look up Spot user by Instagram ID using REST API
    console.log(`[Webhook] Looking up account for IG user ${senderId}...`);
    const { data: igAccount, error: lookupError } = await supabaseQuery('instagram_accounts', {
        select: 'user_id,ig_username',
        eq: { ig_user_id: senderId, is_active: 'true' },
        single: true,
    });
    
    console.log(`[Webhook] Account lookup result - data: ${JSON.stringify(igAccount)}, error: ${JSON.stringify(lookupError)}`);
    
    if (lookupError || !igAccount) {
        console.log(`[Webhook] No linked Spot account for IG user ${senderId}`);
        
        // Not linked - send them to the app to link or join waitlist
        await sendInstagramMessage(senderId, pickRandom(NOT_LINKED_MESSAGES));
        return;
    }
    
    const spotUserId = igAccount.user_id;
    console.log(`[Webhook] Found Spot user ${spotUserId} for @${igAccount.ig_username}`);
    
    // Extract URLs from message - convert Instagram attachments to real URLs
    const urls: string[] = [];
    
    // Get URLs from text
    for (const url of extractUrls(messageText)) {
        urls.push(url);
    }
    
    // Convert Instagram attachments to real Instagram URLs, also capture titles
    interface UrlWithTitle { url: string; title?: string; }
    const urlsWithTitles: UrlWithTitle[] = urls.map(u => ({ url: u }));
    
    if (message.message?.attachments) {
        for (const attachment of message.message.attachments) {
            const instagramUrl = getInstagramUrlFromAttachment(attachment);
            if (instagramUrl) {
                console.log(`[Webhook] Converted attachment to URL: ${instagramUrl}`);
                const payload = attachment.payload as any;
                urlsWithTitles.push({ 
                    url: instagramUrl, 
                    title: payload?.title // Instagram provides the title!
                });
            }
        }
    }
    
    // Clear the original urls array since we're using urlsWithTitles
    urls.length = 0;
    
    if (urlsWithTitles.length === 0) {
        console.log('[Webhook] No URLs found in message - checking if this is an enhancement reply');
        
        // Check if user has any places needing enhancement (saved in the last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: unknownPlaces, error: unknownError } = await getSupabase()
            .from('places')
            .select('id, name, notes')
            .eq('user_id', spotUserId)
            .eq('needs_enhancement', true)
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (!unknownError && unknownPlaces && unknownPlaces.length > 0 && messageText.trim().length > 2) {
            // User has recent unknown places and sent a text - try to enhance!
            console.log(`[Webhook] User has ${unknownPlaces.length} recent unknown places, treating "${messageText}" as place name`);
            
            // Search Google Places with the user's message
            const placeData = await searchGooglePlaces(messageText.trim(), 'New York, NY');
            
            if (placeData) {
                // Found the place! Update the most recent unknown one
                const placeToUpdate = unknownPlaces[0];
                console.log(`[Webhook] Found "${placeData.name}" - updating place ${placeToUpdate.id}`);
                
                // Get category
                let mainCategory: 'eat' | 'see' = placeData.mainCategory || 'eat';
                let subtype = placeData.subtype || 'Restaurant';
                
                if (placeData.googleTypes && isAmbiguousType(placeData.googleTypes)) {
                    const aiCategory = await categorizePlaceWithAI(
                        placeData.name, 
                        placeData.description || '', 
                        placeData.googleTypes || []
                    );
                    mainCategory = aiCategory.mainCategory;
                    subtype = aiCategory.subtype;
                }
                
                const { error: updateError } = await getSupabase()
                    .from('places')
                    .update({
                        name: placeData.name,
                        type: placeData.type,
                        main_category: mainCategory,
                        subtype: subtype,
                        address: placeData.address,
                        description: placeData.description,
                        image_url: placeData.imageUrl,
                        source_url: placeData.sourceUrl,
                        coordinates: placeData.coordinates,
                        rating: placeData.rating,
                        needs_enhancement: false,
                    })
                    .eq('id', placeToUpdate.id);
                
                if (updateError) {
                    console.error('[Webhook] Failed to update place:', updateError);
                    await sendInstagramMessage(senderId, pickRandom(ENHANCE_UPDATE_FAILED_MESSAGES)(placeData.name));
                } else {
                    console.log(`[Webhook] Successfully enhanced place to "${placeData.name}"`);
                    await sendInstagramMessage(senderId, pickRandom(ENHANCE_SUCCESS_MESSAGES)(placeData.name, placeData.address));
                }
                return;
            } else {
                // Couldn't find place with that name
                console.log(`[Webhook] Couldn't find place matching "${messageText}"`);
                await sendInstagramMessage(senderId, pickRandom(ENHANCE_NOT_FOUND_MESSAGES)(messageText.trim()));
                return;
            }
        }
        
        // No recent unknown places or empty message - send "can't chat here"
        console.log('[Webhook] No recent unknown places or not an enhancement request');
        await sendInstagramMessage(senderId, pickRandom(CANT_CHAT_MESSAGES));
        return;
    }
    
    console.log(`[Webhook] Found ${urlsWithTitles.length} URLs to process`);
    
    // Process each URL through the scrape pipeline
    const results: Array<{ url: string; success: boolean; name?: string; error?: string; needsEnhancement?: boolean }> = [];
    
    for (const { url, title: attachmentTitle } of urlsWithTitles) {
        console.log(`[Webhook] Processing URL: ${url}, attachment title: "${attachmentTitle?.substring(0, 50) || 'none'}..."`);
        
        // Try Instagram oEmbed API first (free, no API key needed)
        let title: string | null = null;
        let author: string | null = null;
        let thumbnail: string | null = null;
        
        if (url.includes('instagram.com')) {
            try {
                const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
                console.log(`[Webhook] Fetching oEmbed: ${oembedUrl}`);
                
                const oembedResponse = await fetch(oembedUrl);
                if (oembedResponse.ok) {
                    const oembedData = await oembedResponse.json();
                    title = oembedData.title;
                    author = oembedData.author_name;
                    thumbnail = oembedData.thumbnail_url;
                    console.log(`[Webhook] oEmbed success: title="${title?.substring(0, 50)}...", author="${author}"`);
                } else {
                    console.log(`[Webhook] oEmbed failed: ${oembedResponse.status}`);
                }
            } catch (oembedError) {
                console.error(`[Webhook] oEmbed error:`, oembedError);
            }
        }
        
        // Fallback to attachment title if oEmbed failed
        if (!title && attachmentTitle) {
            title = attachmentTitle;
            console.log(`[Webhook] Using attachment title as fallback: "${title?.substring(0, 50)}..."`);
        }
        
        // Fallback to Firecrawl scrape for non-Instagram URLs
        if (!title && !url.includes('instagram.com')) {
            try {
                const scrapeResponse = await fetch(`https://spot-ai-3.vercel.app/api/scrape`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                });
                
                if (scrapeResponse.ok) {
                    const scrapeResult = await scrapeResponse.json();
                    title = scrapeResult.data?.title;
                    console.log(`[Webhook] Scraped: title="${title?.substring(0, 50)}..."`);
                }
            } catch (scrapeError) {
                console.error(`[Webhook] Scrape error:`, scrapeError);
            }
        }
        
        if (!title) {
            console.log('[Webhook] No title found, skipping');
            results.push({ url, success: false, error: 'Could not fetch content' });
            continue;
        }
        
        // Step 1: Use AI to extract ALL places from caption (same as chat.ts)
        console.log(`[Webhook] Extracting places from caption with AI...`);
        const extractedPlaces = await extractPlacesWithAI(title);
        
        if (extractedPlaces.length === 0) {
            // Couldn't extract any places - generate a placeholder name
            console.log(`[Webhook] Couldn't extract any places, generating placeholder...`);
            
            const placeholder = await generatePlaceholderName(title);
            console.log(`[Webhook] Generated placeholder: "${placeholder.name}"`);
            
            const newPlace = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                user_id: spotUserId,
                name: placeholder.name,
                type: 'restaurant',
                main_category: placeholder.category,
                subtype: placeholder.subtype,
                subtypes: [],
                address: 'Location TBD',
                description: `Couldn't identify this place. ${author ? `Shared by @${author} on Instagram.` : 'Saved from Instagram.'} Reply with the real name to update!`,
                image_url: thumbnail || null,
                source_url: url,
                is_visited: false,
                is_favorite: true,
                notes: `Original caption: ${title.substring(0, 200)}`,
                created_at: new Date().toISOString(),
                // Instagram integration - needs enhancement!
                instagram_post_url: url,
                needs_enhancement: true,
            };
            
            const { data: savedPlace, error: placeError } = await getSupabase()
                .from('places')
                .insert(newPlace)
                .select()
                .single();
            
            if (placeError) {
                results.push({ url, success: false, error: 'Failed to save place', needsEnhancement: true });
            } else {
                results.push({ url, success: true, name: savedPlace.name, needsEnhancement: true });
            }
            continue;
        }
        
        // Step 2: Process EACH extracted place (like chat.ts)
        console.log(`[Webhook] Processing ${extractedPlaces.length} extracted places...`);
        
        for (const extracted of extractedPlaces) {
            // Search Google Places with the extracted name
            console.log(`[Webhook] Searching Google Places for: "${extracted.name}" in ${extracted.location}`);
            const placeData = await searchGooglePlaces(extracted.name, extracted.location);
            
            let newPlace: any;
            
            if (placeData) {
                // Use enriched data from Google Places
                console.log(`[Webhook] Found on Google Places: "${placeData.name}" at ${placeData.address}`);
                const isEvent = extracted.isEvent || false;
                
                // Check if types are ambiguous and need AI categorization
                let mainCategory: 'eat' | 'see' = isEvent ? 'see' : (placeData.mainCategory || 'eat');
                let subtype = isEvent ? 'Event' : (placeData.subtype || 'Restaurant');
                
                if (!isEvent && placeData.googleTypes && isAmbiguousType(placeData.googleTypes)) {
                    console.log(`[Webhook] Ambiguous type for "${placeData.name}", using Gemini categorization`);
                    const aiCategory = await categorizePlaceWithAI(
                        placeData.name, 
                        placeData.description || '', 
                        placeData.googleTypes || []
                    );
                    mainCategory = aiCategory.mainCategory;
                    subtype = aiCategory.subtype;
                }
                
                newPlace = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    user_id: spotUserId,
                    name: placeData.name,
                    type: isEvent ? 'activity' : placeData.type,
                    main_category: mainCategory,
                    subtype: subtype,
                    subtypes: [],
                    address: placeData.address,
                    description: placeData.description || (author ? `Shared by @${author} on Instagram` : `Saved from Instagram`),
                    image_url: placeData.imageUrl || thumbnail || null,
                    source_url: placeData.sourceUrl || url,
                    coordinates: placeData.coordinates,
                    rating: placeData.rating,
                    is_visited: false,
                    is_favorite: true,
                    is_event: isEvent,
                    notes: `Saved from Instagram DM${author ? ` (via @${author})` : ''}`,
                    created_at: new Date().toISOString(),
                    // Instagram integration
                    instagram_post_url: url,
                    needs_enhancement: false,
                };
            } else {
                // Google Places didn't find it - save as unknown and ask for details
                console.log(`[Webhook] Not found on Google Places, generating placeholder name...`);
                const isEvent = extracted.isEvent || false;
                
                // Generate a descriptive placeholder name
                const placeholder = await generatePlaceholderName(title || extracted.name);
                console.log(`[Webhook] Generated placeholder: "${placeholder.name}" (${placeholder.category}/${placeholder.subtype})`);
                
                newPlace = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    user_id: spotUserId,
                    name: placeholder.name,
                    type: isEvent ? 'activity' : 'restaurant',
                    main_category: isEvent ? 'see' : placeholder.category,
                    subtype: isEvent ? 'Event' : placeholder.subtype,
                    subtypes: [],
                    address: extracted.location || 'Location TBD',
                    description: `Originally mentioned as "${extracted.name}". ${author ? `Shared by @${author} on Instagram.` : 'Saved from Instagram.'} Reply with the real name to update!`,
                    image_url: thumbnail || null,
                    source_url: url,
                    is_visited: false,
                    is_favorite: true,
                    is_event: isEvent,
                    notes: `Original mention: ${extracted.name}`,
                    // Instagram integration - needs enhancement!
                    instagram_post_url: url,
                    needs_enhancement: true,
                    created_at: new Date().toISOString(),
                };
            }
            
            console.log(`[Webhook] Creating place: "${newPlace.name}" at "${newPlace.address}"`);
            
            const { data: savedPlace, error: placeError } = await getSupabase()
                .from('places')
                .insert(newPlace)
                .select()
                .single();
            
            if (placeError) {
                console.error('[Webhook] Failed to create place:', placeError);
                results.push({ url, success: false, name: extracted.name, error: 'Failed to save place' });
            } else {
                console.log(`[Webhook] Successfully saved place: ${savedPlace.name} (needs_enhancement: ${savedPlace.needs_enhancement})`);
                results.push({ 
                    url, 
                    success: true, 
                    name: savedPlace.name,
                    needsEnhancement: savedPlace.needs_enhancement || false
                });
            }
        }
    }
    
    // Send acknowledgment DM with Spot personality
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const needsEnhancementCount = results.filter(r => r.success && (r as any).needsEnhancement).length;
    const fullyIdentifiedCount = successCount - needsEnhancementCount;
    
    let responseMessage = '';
    
    if (successCount === 0 && failCount > 0) {
        // Complete failure
        responseMessage = pickRandom(FETCH_FAILED_MESSAGES);
    } else if (needsEnhancementCount > 0 && fullyIdentifiedCount === 0) {
        // All places need enhancement
        if (needsEnhancementCount === 1) {
            const place = results.find(r => (r as any).needsEnhancement);
            responseMessage = pickRandom(UNKNOWN_PLACE_MESSAGES)(place?.name || 'Unknown Place');
        } else {
            responseMessage = `🤔 I couldn't identify ${needsEnhancementCount} places from that post.\n\nI've saved them with placeholder names – reply with the real names and I'll update them, or edit them in the app! 📱`;
        }
    } else if (needsEnhancementCount > 0) {
        // Mix of identified and unidentified
        const savedMsg = fullyIdentifiedCount === 1 
            ? pickRandom(SAVED_SUCCESS_MESSAGES)(results.find(r => r.success && !r.needsEnhancement)?.name || 'Unknown')
            : pickRandom(SAVED_MULTIPLE_MESSAGES)(fullyIdentifiedCount);
        responseMessage = `${savedMsg}\n\n🤔 ${needsEnhancementCount} place${needsEnhancementCount > 1 ? 's' : ''} couldn't be identified – reply with ${needsEnhancementCount > 1 ? 'their names' : 'the name'} and I'll try to find ${needsEnhancementCount > 1 ? 'them' : 'it'}!`;
    } else if (successCount > 0 && failCount === 0) {
        // All successful
        if (successCount === 1) {
            responseMessage = pickRandom(SAVED_SUCCESS_MESSAGES)(results[0].name || 'Unknown');
        } else {
            responseMessage = pickRandom(SAVED_MULTIPLE_MESSAGES)(successCount);
        }
    } else {
        // Partial success
        const savedMsg = fullyIdentifiedCount === 1 
            ? pickRandom(SAVED_SUCCESS_MESSAGES)(results.find(r => r.success)?.name || 'Unknown')
            : pickRandom(SAVED_MULTIPLE_MESSAGES)(successCount);
        responseMessage = `${savedMsg}\n\n(${failCount} link${failCount > 1 ? 's' : ''} couldn't be fetched)`;
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
        
        // Process BEFORE responding (Vercel kills function after response)
        try {
            if (payload.object === 'instagram') {
                for (const entry of payload.entry) {
                    if (!entry.messaging) continue;
                    
                    for (const message of entry.messaging) {
                        if (message.message) {
                            await processIncomingMessage(message, payload);
                        }
                    }
                }
            } else {
                console.log('[Webhook] Ignoring non-Instagram event:', payload.object);
            }
        } catch (error: any) {
            console.error('[Webhook] Processing error:', error);
            // Don't await DLQ - just log
            addToDeadLetterQueue(payload, error.message || 'Unknown error').catch(console.error);
        }
        
        // Respond AFTER processing
        console.log('[Webhook] Processing complete, responding 200');
        return res.status(200).send('EVENT_RECEIVED');
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

