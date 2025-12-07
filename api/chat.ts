import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============= LAZY INITIALIZATION =============

let supabase: SupabaseClient;
function getSupabase(token?: string) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzxmplnrozabftmmuchx.supabase.co';
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eG1wbG5yb3phYmZ0bW11Y2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjQ5NTIsImV4cCI6MjA4MDcwMDk1Mn0.ZvX-wGttZr5kWNP_Svxqfvl7Vyd2_L6MW8-Wy7j_ANg';

    if (token) {
        return createClient(url, key, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
    }

    if (!supabase) {
        supabase = createClient(url, key);
    }
    return supabase;
}

// ============= HELPER FUNCTIONS =============

function extractAction(text: string): { action: any; match: string } | null {
    const match = text.match(/\{\s*"action":/);
    if (!match || match.index === undefined) return null;

    const startIndex = match.index;
    let braceCount = 0;
    let endIndex = -1;

    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        else if (text[i] === '}') braceCount--;

        if (braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }

    if (endIndex !== -1) {
        try {
            const jsonStr = text.substring(startIndex, endIndex);
            const action = JSON.parse(jsonStr);
            return { action, match: jsonStr };
        } catch (e) {
            console.error("[extractAction] Failed to parse JSON", e);
        }
    }
    return null;
}

function stripAllActions(text: string): string {
    let currentText = text;
    let extracted;
    do {
        extracted = extractAction(currentText);
        if (extracted) {
            currentText = currentText.replace(extracted.match, '').trim();
        }
    } while (extracted);

    currentText = currentText.replace(/```json\s*```/g, '');
    currentText = currentText.replace(/```\s*```/g, '');
    currentText = currentText.replace(/```json\s*$/g, '');
    currentText = currentText.replace(/```\s*$/g, '');

    return currentText.trim();
}

// ============= SCRAPE WITH FIRECRAWL =============

async function scrapeWithFirecrawl(url: string) {
    console.log(`[Firecrawl] Scraping URL: ${url}`);
    try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
                url,
                formats: ['markdown', 'extract'],
                extract: {
                    schema: {
                        type: 'object',
                        properties: {
                            place_name: { type: 'string', description: 'Name of the restaurant, park, museum, or place mentioned' },
                            cuisine_type: { type: 'string', description: 'Type of cuisine or category (e.g. Italian, Park, Museum)' },
                            address: { type: 'string', description: 'Full address if available' },
                            description: { type: 'string', description: 'Description or review of the place' },
                            rating: { type: 'number', description: 'Rating out of 5' },
                            image_url: { type: 'string', description: 'URL of main image' },
                        },
                    },
                },
            }),
        });
        const result = await response.json();
        console.log(`[Firecrawl] Result success: ${result.success}`);
        if (!result.success) {
            console.error(`[Firecrawl] Error:`, result.error || result.message);
        } else {
            console.log(`[Firecrawl] Markdown length: ${result.data?.markdown?.length}`);
        }
        return result;
    } catch (error: any) {
        console.error(`[Firecrawl] Exception:`, error);
        return { success: false, error: error.message };
    }
}

// ============= REDDIT API =============

async function searchRedditMultiQuery(queries: string[], subreddits: string[] = ['foodnyc', 'AskNYC']) {
    const results: any[] = [];

    console.log(`[Reddit] Running ${queries.length} queries across ${subreddits.length} subreddits`);

    for (const subreddit of subreddits) {
        for (const query of queries) {
            try {
                const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=5&sort=relevance`;
                console.log(`[Reddit] Searching r/${subreddit} for: ${query}`);

                const response = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.log(`[Reddit] r/${subreddit} returned ${response.status}`);
                    continue;
                }

                const data = await response.json();
                const posts = data?.data?.children || [];

                for (const post of posts) {
                    const p = post.data;
                    if (!results.find(r => r.url === `https://reddit.com${p.permalink}`)) {
                        results.push({
                            title: p.title,
                            url: `https://reddit.com${p.permalink}`,
                            subreddit: p.subreddit,
                            author: p.author,
                            upvotes: p.ups,
                            text: p.selftext?.slice(0, 500) || '',
                            numComments: p.num_comments
                        });
                    }
                }

                console.log(`[Reddit] Found ${posts.length} posts`);
            } catch (error: any) {
                console.error(`[Reddit] Error:`, error.message);
            }
        }
    }

    results.sort((a, b) => (b.upvotes + b.numComments) - (a.upvotes + a.numComments));
    return results.slice(0, 15);
}

async function getRedditComments(postUrl: string) {
    try {
        const jsonUrl = postUrl.replace(/\/?$/, '.json');
        console.log(`[Reddit] Fetching comments from: ${jsonUrl}`);

        const response = await fetch(jsonUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) return [];

        const data = await response.json();
        const comments = data[1]?.data?.children || [];

        return comments.slice(0, 15).map((c: any) => ({
            author: c.data?.author,
            text: c.data?.body?.slice(0, 500),
            upvotes: c.data?.ups || 0
        })).filter((c: any) => c.text && c.upvotes >= 0).sort((a: any, b: any) => b.upvotes - a.upvotes);
    } catch (error: any) {
        console.error(`[Reddit] Error fetching comments:`, error.message);
        return [];
    }
}

// ============= GOOGLE PLACES API =============

async function searchGooglePlaces(placeName: string, location: string = 'New York, NY') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_PLACES_API_KEY not set.');
        return null;
    }

    try {
        const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
        console.log(`[Google Places] Searching for: "${placeName}" in ${location}`);

        const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
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

        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoName = place.photos[0].name;
            imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${apiKey}`;
        }

        let type = 'restaurant';
        const types = place.types || [];
        if (types.some((t: string) => t.includes('bar'))) type = 'bar';
        else if (types.some((t: string) => t.includes('cafe'))) type = 'cafe';
        else if (types.some((t: string) => t.includes('museum') || t.includes('art_gallery'))) type = 'attraction';
        else if (types.some((t: string) => t.includes('park'))) type = 'attraction';

        let cuisine = 'General';
        const cuisineTypes = types.filter((t: string) =>
            t.includes('_restaurant') || t.includes('_food') || t.includes('cuisine')
        );
        if (cuisineTypes.length > 0) {
            cuisine = cuisineTypes[0].replace(/_restaurant|_food/g, '').replace(/_/g, ' ');
            cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
        }

        return {
            name: place.displayName?.text || placeName,
            type,
            cuisine,
            address: place.formattedAddress || location,
            description: place.editorialSummary?.text || '',
            sourceUrl: place.websiteUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
            imageUrl,
            rating: place.rating || null,
            coordinates: place.location ? { lat: place.location.latitude, lng: place.location.longitude } : null
        };
    } catch (error) {
        console.error('[Google Places] API error:', error);
        return null;
    }
}

// ============= GEMINI API =============

const callGemini = async (prompt: string) => {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': process.env.GEMINI_API_KEY || '',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
        }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const callGeminiWithSearch = async (query: string, queryType: string = 'food') => {
    console.log(`[Gemini Search] Query: "${query}" (type: ${queryType})`);

    const searchPrompt = `Find the best ${queryType === 'food' ? 'restaurants and food spots' : 'events and activities'} for: ${query} in NYC.

Provide a consolidated list of top 5 recommendations.
For each recommendation, include:
- Name
- Location (neighborhood)
- Brief, concise description
- Citation: Which source mentioned it?
- Source URL

IMPORTANT: 
- Only recommend places found in the search results.
- Keep descriptions concise.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY || '',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: searchPrompt }] }],
                    tools: [{ google_search: {} }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 3000
                    }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.error) {
            console.error(`[Gemini Search] API Error:`, data.error);
            return `Gemini search error: ${data.error.message || 'Unknown error'}`;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const groundingMetadata = data.candidates?.[0]?.groundingMetadata;

        let result = text;
        if (groundingMetadata?.groundingChunks?.length > 0) {
            result += '\n\n=== VERIFIED SOURCES ===\n';
            groundingMetadata.groundingChunks.forEach((chunk: any, i: number) => {
                if (chunk.web) {
                    result += `[${i + 1}] ${chunk.web.title}: ${chunk.web.uri}\n`;
                }
            });
        }

        console.log(`[Gemini Search] Got ${result.length} chars with ${groundingMetadata?.groundingChunks?.length || 0} verified sources`);
        return result;
    } catch (error: any) {
        console.error(`[Gemini Search] Error:`, error.message);
        return `Gemini search failed: ${error.message}`;
    }
};

// ============= WEB SEARCH =============

async function searchWeb(query: string) {
    console.log(`[Web Search] Researching: ${query}`);

    const queryLower = query.toLowerCase();

    const eventKeywords = ['event', 'show', 'play', 'concert', 'market', 'festival', 'exhibit', 'museum',
        'theater', 'theatre', 'movie', 'things to do', 'activities', 'attraction', 'holiday', 'christmas',
        'popup', 'pop-up', 'happening', 'weekend', 'tonight', 'this week', 'date night', 'date'];

    const foodKeywords = ['food', 'restaurant', 'eat', 'dinner', 'lunch', 'brunch', 'breakfast',
        'pizza', 'sushi', 'burger', 'coffee', 'bar', 'drinks', 'cocktail', 'croissant', 'bakery', 'cafe'];

    const isEventQuery = eventKeywords.some(kw => queryLower.includes(kw));
    const isShowQuery = ['movie', 'film', 'cinema', 'theater', 'theatre', 'broadway', 'play', 'musical', 'show'].some(kw => queryLower.includes(kw));

    let queryType = 'food';
    if (isShowQuery) queryType = 'show';
    else if (isEventQuery) queryType = 'event';

    let allResults = '';

    // For events: scrape specific pages
    if (queryType === 'event' || queryType === 'show') {
        console.log('[Web Search] Event query detected - scraping TimeOut & Secret NYC...');
        const eventScrapeSources = [
            { name: 'TimeOut NY This Week', url: 'https://www.timeout.com/newyork/things-to-do/things-to-do-in-new-york-this-week' },
            { name: 'Secret NYC Weekend Guide', url: 'https://secretnyc.co/what-to-do-this-weekend-nyc/' },
            { name: 'The Skint', url: 'https://theskint.com/' }
        ];

        for (const source of eventScrapeSources) {
            try {
                console.log(`[Web Search] Scraping ${source.name}...`);
                const result = await scrapeWithFirecrawl(source.url);
                if (result.success && result.data?.markdown) {
                    const content = result.data.markdown.slice(0, 4000);
                    console.log(`[Web Search] Got ${content.length} chars from ${source.name}`);
                    allResults += `\n--- ${source.name} ---\nSource URL: ${source.url}\n${content}\n`;
                }
            } catch (error: any) {
                console.error(`[Web Search] Error with ${source.name}:`, error.message);
            }
        }
    }

    // Use Gemini with Google Search grounding
    const geminiResults = await callGeminiWithSearch(query, queryType);
    if (geminiResults) {
        allResults += `\n\n=== GENERAL WEB SEARCH RESULTS (Gemini) ===\n${geminiResults}`;
    }

    return allResults || "Could not find information from web sources.";
}

// ============= SOCIAL MEDIA SCRAPING =============

async function scrapeSocialMetadata(url: string) {
    console.log(`[Metadata Scraper] Fetching: ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            },
            redirect: 'follow'
        });

        const finalUrl = response.url;
        if (finalUrl !== url) {
            console.log(`[Metadata Scraper] Redirected to: ${finalUrl}`);
        }

        const html = await response.text();

        const patterns = [
            /<meta\s+property="og:description"\s+content="([^"]*)"/i,
            /<meta\s+content="([^"]*)"\s+property="og:description"/i,
            /<meta\s+name="description"\s+content="([^"]*)"/i,
            /<meta\s+content="([^"]*)"\s+name="description"/i,
            /<meta\s+property="og:title"\s+content="([^"]*)"/i,
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[1].length > 10) {
                console.log(`[Metadata Scraper] Found description: ${match[1].substring(0, 100)}...`);
                return match[1];
            }
        }

        console.log(`[Metadata Scraper] No meta description found, trying Firecrawl...`);
        const firecrawlResult = await scrapeWithFirecrawl(finalUrl);
        if (firecrawlResult.success && firecrawlResult.data?.markdown) {
            const content = firecrawlResult.data.markdown.substring(0, 500);
            console.log(`[Metadata Scraper] Firecrawl content: ${content.substring(0, 100)}...`);
            return content;
        }

    } catch (error) {
        console.error(`[Metadata Scraper] Error:`, error);
    }
    return null;
}

// ============= RESERVATION FINDER =============

async function findReservationOptions(restaurantName: string, location: string) {
    const searchDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const partySize = 2;

    const bookingLinks: any = {};
    bookingLinks.google = `https://www.google.com/maps/search/${encodeURIComponent(restaurantName + ' ' + location)}`;
    bookingLinks.openTable = `https://www.opentable.com/s?dateTime=${searchDate}T19%3A00&covers=${partySize}&term=${encodeURIComponent(restaurantName)}`;
    bookingLinks.resy = `https://resy.com/cities/ny?date=${searchDate}&seats=${partySize}&query=${encodeURIComponent(restaurantName)}`;
    bookingLinks.yelp = `https://www.yelp.com/search?find_desc=${encodeURIComponent(restaurantName)}&find_loc=${encodeURIComponent(location)}`;

    return { bookingLinks, date: searchDate, partySize };
}

// ============= FIND AND ADD PLACE =============

async function findAndAddPlace(placeName: string, location: string = 'New York, NY', extraData: any = {}, userId: string | null = null, token?: string) {
    if (!userId) {
        return { added: false, message: 'No user ID provided' };
    }

    // Check if already exists
    const { data: existingPlaces } = await getSupabase(token)
        .from('places')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${placeName}%`);

    if (existingPlaces && existingPlaces.length > 0) {
        return { added: false, message: 'Already on list', place: existingPlaces[0] };
    }

    // Try Google Places API first
    let place = await searchGooglePlaces(placeName, location);

    if (!place) {
        console.log(`[addPlace] Google Places failed for "${placeName}". Saving with basic info.`);
        place = {
            name: placeName,
            type: extraData.isEvent ? 'activity' : 'restaurant',
            cuisine: extraData.cuisine || null,
            address: location,
            description: '',
            sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(placeName + ' ' + location)}`,
            imageUrl: '',
            coordinates: null,
            rating: null
        };
    }

    const newPlace = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        name: place.name,
        type: place.type || 'restaurant',
        cuisine: place.cuisine || extraData.cuisine || null,
        address: place.address || '',
        description: place.description || extraData.description || null,
        image_url: place.imageUrl || null,
        source_url: place.sourceUrl || null,
        coordinates: place.coordinates || null,
        is_visited: false,
        is_favorite: true,
        notes: null,
        review: null,
        rating: place.rating || null,
        start_date: extraData.startDate || null,
        end_date: extraData.endDate || null,
        is_event: extraData.isEvent || false,
        created_at: new Date().toISOString(),
    };

    const { error } = await getSupabase(token).from('places').insert(newPlace);

    if (error) {
        console.error('[addPlace] Supabase error:', error);
        return { added: false, message: 'Failed to save' };
    }

    console.log('[addPlace] Saved to Supabase:', newPlace.name);
    return { added: true, place: newPlace };
}

// ============= MAIN HANDLER =============

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, userName, userPreferences, userId } = req.body;
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

        const today = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();

        // Fetch user's places from Supabase
        let userPlaces: any[] = [];
        console.log(`[Chat API] ========== REQUEST START ==========`);
        console.log(`[Chat API] userId: "${userId}", userName: "${userName}"`);

        if (userId) {
            const { data, error } = await getSupabase(token)
                .from('places')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Chat API] Supabase error:', error);
            }
            if (data) {
                console.log(`[Chat API] Found ${data.length} places for user`);
                userPlaces = data;
            }
        }

        // Build places context with Date Added
        const placesContext = userPlaces.length > 0
            ? userPlaces.map((p: any) => {
                const status = p.is_visited ? 'VISITED' : 'Not visited';
                const fav = p.is_favorite ? ', FAVORITED' : '';
                const rating = p.rating ? `, Rating: ${p.rating}/5` : '';
                const notes = p.description ? ` - ${p.description.slice(0, 50)}...` : '';
                const dateAdded = p.created_at ? ` | Added on: ${p.created_at.split('T')[0]}` : '';
                return `- ${p.name} (${p.cuisine || p.type}) at ${p.address} - ${status}${fav}${rating}${notes}${dateAdded}`;
            }).join('\n')
            : '- No places saved yet!';

        // Build user context
        const userContext = userName ? `\n\nUSER INFO:\n- Name: ${userName}${userPreferences?.dietaryRestrictions?.length ? `\n- Dietary Restrictions: ${userPreferences.dietaryRestrictions.join(', ')}` : ''}${userPreferences?.interests?.length ? `\n- Interests: ${userPreferences.interests.join(', ')}` : ''}${userPreferences?.foodPreferences?.length ? `\n- Food Preferences: ${userPreferences.foodPreferences.join(', ')}` : ''}\n\nIMPORTANT: Address the user by their name (${userName}) occasionally to make the conversation feel personal. Don't overdo it - use their name naturally, like a friend would.` : '';

        const systemPrompt = `You are Spot – a warm, funny, slightly dramatic AI that helps people track and discover places. You talk like that slightly extra friend who is weirdly good at remembering places and always "knows a spot."

Current Date: ${today}${userContext}

PERSONALITY:
- Casual, playful, a little dramatic (in a fun way)
- Make quick jokes and mini roasts about situations (never about the user)
- Self-aware about planning chaos: "We both know 'early dinner' means you'll show up at 8:15"
- Celebrate small outings: "Tiny outing? Still counts. Coffee + walk = main character energy ☕"
- Use emojis naturally but not excessively - i.e. only to denote categories, bulletpoints etc (✨, 🍕, 🍜, ☕, 😏)

SAMPLE LINES:
- Greeting: "Hey, it's Spot! Ready to 'just check a few places' and end up with a full plan?"
- Saved places: "You saved this back in March... officially in 'are we ever going or not?' territory"
- Adding: "Saved. Future you will thank present you for this"
- Indecisive user: "Totally normal to have no idea what you want. I'll throw out three vibes and you point at one like a menu."

RECOMMENDATION STYLE:
1. Give clear, neutral reasoning FIRST (location, cuisine, vibe, reviews, fit with their tastes)
2. Add ONE playful line AFTER the explanation – never let humor override clarity
3. **QUANTITY:** Always provide **up to 10 recommendations** (aim for 7-10) unless the user asks for a specific number.
Example: "This works for a small group: takes reservations, not too loud, strong 'we'll be here for three hours without noticing' energy."

MUST-VISIT format: "This one's a Must-Visit for the neighborhood – locals swear by it. Not going at least once is basically illegal. (Not actually. But you know.)"

PERSONALIZATION:
- Analyze SAVED PLACES to understand taste ("You have a strong pasta theme... I respect the commitment to carbs 🍝")
- When giving recommendations:
  1. Prioritize places that match their saved preferences (e.g. "Since you like pizza...").
  2. ALWAYS include one "Neighborhood Icon" or "Unmissable Classic" for that specific area, even if it's a different cuisine. Label it as a "Must-Visit" for the neighborhood.
  3. Avoid random "wildcards" - only suggest places with high ratings or strong local reputation.
- Explicitly mention WHY you chose a place based on their list.

⚠️ ANTI-HALLUCINATION RULES (CRITICAL - READ CAREFULLY):
- **NEVER make up sources, quotes, or URLs.** If you don't have real data from a research action, you MUST use the research tool FIRST.
- **NEVER cite TimeOut, Secret NYC, Eater, Infatuation, etc. unless you have ACTUAL quotes from research results.**
- **ALWAYS RESEARCH FIRST:** If the user asks for recommendations of ANY kind (restaurants, things to do, attractions, events), you MUST output a research action FIRST. This applies even for well-known places!
- Do NOT recommend places until you have real data from research. Even if you "know" about famous places like AMNH or Central Park, RESEARCH FIRST to find current, relevant info.
- Use ONLY information returned by the research tool. If research returns nothing relevant, say so honestly.
- It's better to say "Let me look that up for you" than to make up information.
- The ONLY exception: If recommending places that are ALREADY on the user's saved list, you don't need to research those.

📅 DATE AWARENESS FOR EVENTS:
- Current date is ${today}.
- For EVENTS (holiday markets, plays, shows, pop-ups, movies): Only recommend events that are CURRENTLY HAPPENING or happening SOON (within the next 2 weeks).
- Do NOT recommend events from previous years or events that have already ended.
- When researching events, include the current year (${currentYear}) in your search query.
- If asked about "what's happening this week/month", filter results to that time frame.
- **EVENT NAMING:** If recommending an event (play, movie, market), name the item after the EVENT, not the location.
- **EVENTS MUST HAVE DATES:** When adding or recommending an event, ALWAYS include startDate and endDate if known. Set isEvent: true.
- If you don't know exact dates, estimate based on context (e.g., "holiday market" in December = startDate around early December).

SAVED PLACES:
${placesContext}

TOOLS & ACTIONS:
You have access to these tools. output the JSON action ONLY when needed.

1. ADD PLACE / EVENT:
If user says "Add [Place/Event Name] to my list":
{"action": "addPlace", "placeName": "NAME", "location": "CITY/NEIGHBORHOOD", "isEvent": boolean, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}
- **CRITICAL:** If you don't know the location/venue for an event, **DO NOT ASK THE USER**. Use the \`research\` tool to find it first!
- For EVENTS: Set isEvent: true. Name it after the EVENT.

2. ADD MULTIPLE PLACES / EVENTS:
If user provides a list or caption with multiple places/events and asks to add them:
{"action": "addMultiplePlaces", "places": [{"name": "Event/Place Name", "location": "Venue/Neighborhood", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "isEvent": true}]}
- For EVENTS (movies, plays, markets): Name it after the EVENT (e.g. "Sleep No More"), not the venue. Set isEvent: true.
- If it's a permanent place, omit startDate/endDate/isEvent.

3. FIND RESERVATIONS:
- **BE HELPFUL WITH LINKS**: If you tell the user to "check the website" or "book tickets", you MUST provide the actual URL if you have it (e.g., from the place details). Don't just say "check their site" without giving the link.
- **RESERVATIONS**: If asked for reservations, use the \`findReservations\` action.
- **NO CANCELLATIONS**: You cannot cancel reservations.
⚠️ IMPORTANT: You CANNOT see actual availability or time slots. NEVER make up specific times.
Response: "I can't check availability directly, but I've found the booking links for you! Check these out:"
{"action": "findReservations", "restaurantName": "NAME", "partySize": 2, "date": "YYYY-MM-DD"}

4. RESEARCH / PLAN (⚠️ REQUIRED BEFORE EXTERNAL RECOMMENDATIONS):
**You MUST use research before recommending ANY places not already on the user's saved list.**
This includes: restaurants, events, activities, anything external.

⚠️ CRITICAL: When you need to research, OUTPUT THE ACTION IMMEDIATELY in your response. Do NOT just say "let me search" without including the actual JSON action. Your response MUST contain the action like this:

Let me look that up for you! {"action": "research", "queries": ["things to do williamsburg brooklyn", "williamsburg activities", "title:williamsburg"]}

⚠️ QUERY GENERATION RULES:
Reddit supports boolean operators. Generate 2-3 query variations for better results:
1. Simple query: "indian food upper west side" (basic keywords)
2. Boolean AND with exact phrase: "indian AND \\"upper west side\\"" (forces both terms)
3. Title search: "title:indian manhattan" (searches only post titles)

⚠️ JSON SAFETY: If using double quotes INSIDE a query string, you MUST escape them (e.g. "term AND \\"exact phrase\\"").
Alternatively, use single quotes inside the query string (e.g. "term AND 'exact phrase'").

Other operators: OR, NOT, quotes for exact phrase

📅 FOR EVENTS/ACTIVITIES:
- ALWAYS include the current year (${currentYear}) in at least one query
- Include keywords like: "event", "show", "things to do", "happening", "market", etc.
- Examples: "holiday markets nyc december ${currentYear}", "things to do this weekend nyc", "title:concert december"

Keep each query SHORT (3-6 words). Do NOT output recommendPlaces together with research.

5. SCRAPE URL:
If user shares a link:
{"action": "scrapeUrl", "url": "THE_URL"}

6. RECOMMEND PLACES (⚠️ ALWAYS USE THIS whenever you mention ANY place in the chat):
**CRITICAL: Whenever you recommend ANY places to the user, you MUST output them as a recommendPlaces action. NEVER just list places as plain text. The user expects to see interactive cards with photos, not text lists.**

Format:
{"action": "recommendPlaces", "places": [{"name": "Place Name", "type": "restaurant", "description": "Short reason why you picked it...", "website": "https://placewebsite.com", "location": "Neighborhood/City", "sourceUrl": "https://reddit.com/r/foodnyc/...", "sourceName": "r/foodnyc", "sourceQuote": "This place is fire, try the spicy miso ramen"}]}

- name: The place name
- type: One of "restaurant", "bar", "cafe", "activity", "attraction"
- description: 1-2 sentences why you chose this for them
- website: The place's website URL
- location: Neighborhood (e.g. "Upper East Side")
- sourceUrl: **MUST be a REAL URL from research results** - use Reddit links when available! NEVER make up URLs.
- sourceName: Who recommended it - PRIORITIZE Reddit (r/foodnyc, r/AskNYC) over other sources. Must be from actual research.
- sourceQuote: The actual quote from that Reddit post or article. NEVER fabricate quotes.

⚠️ CRITICAL: 
- You may ONLY cite sources that were returned by the research tool.
- If you haven't done research, do NOT include sourceUrl/sourceName/sourceQuote - leave them empty.
- NEVER make up quotes from TimeOut, Eater, Secret NYC, etc. unless you have actual research data.
- It's okay to recommend places without source citations if they're from the user's saved list.

Keep responses conversational`;

        // Build conversation for Gemini
        let conversationText = messages.map((m: any) =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        let fullPrompt = `${systemPrompt}\n\nConversation:\n${conversationText}\n\nAssistant:`;

        // First Call
        let content = await callGemini(fullPrompt);
        console.log("--- RAW GEMINI RESPONSE 1 ---");
        console.log(content);
        console.log("-----------------------------");

        let actionResult = null;

        // Check for action
        const extracted = extractAction(content);

        if (extracted) {
            try {
                const { action, match } = extracted;
                console.log('[Chat API] Detected action:', action.action);

                // ============= RESEARCH ACTION =============
                if (action.action === 'research' && (action.queries || action.query)) {
                    const allQueries = action.queries || [action.query];
                    const queries = allQueries.slice(0, 2);

                    console.log('========================================');
                    console.log('[Research] Starting PARALLEL Reddit and Web searches...');
                    console.log('[Research] QUERIES FROM LLM (limited to 2):', queries);
                    console.log('========================================');

                    // Start BOTH Reddit and Web searches concurrently
                    const webSearchPromise = searchWeb(queries[0]);
                    const redditSearchPromise = searchRedditMultiQuery(queries);

                    const redditPosts = await redditSearchPromise;

                    console.log('[Research] Reddit threads found:');
                    redditPosts.forEach((p: any, i: number) => console.log(`  ${i + 1}. "${p.title}" (${p.upvotes} upvotes)`));

                    let searchResults = '';

                    if (redditPosts.length > 0) {
                        searchResults += '=== REDDIT RESULTS (PRIORITIZE THESE - LOOK AT ALL COMMENTS FOR RECOMMENDATIONS) ===\n';

                        const allQueryWords = queries.join(' ').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3 && !['and', 'the', 'for', 'reddit'].includes(w));

                        const scoredPosts = redditPosts.map((post: any) => {
                            const titleLower = post.title.toLowerCase();
                            let relevanceScore = 0;
                            for (const word of allQueryWords) {
                                if (titleLower.includes(word)) {
                                    relevanceScore += 10;
                                }
                            }
                            relevanceScore += Math.log(post.upvotes + post.numComments + 1);

                            if (post.title.includes('2024') || post.title.includes('2025')) {
                                relevanceScore += 5;
                            }

                            return { ...post, relevanceScore };
                        }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

                        console.log('[Research] Prioritized threads by relevance:');
                        scoredPosts.slice(0, 5).forEach((p: any, i: number) => console.log(`  ${i + 1}. [score=${p.relevanceScore.toFixed(1)}] "${p.title}"`));

                        // Fetch comments for top 5 most relevant threads IN PARALLEL
                        const topPosts = scoredPosts.slice(0, 5);
                        const commentPromises = topPosts.map(async (post: any) => {
                            console.log(`[Research] Fetching comments from: ${post.title}`);
                            const comments = await getRedditComments(post.url);
                            let postResult = `\n--- THREAD: "${post.title}" (r/${post.subreddit}, ${post.upvotes} upvotes) ---\nURL: ${post.url}\n`;

                            if (comments.length > 0) {
                                postResult += `   \n   TOP COMMENTS (sorted by upvotes - extract place names from these!):\n`;
                                for (const comment of comments.slice(0, 12)) {
                                    postResult += `   💬 [${comment.upvotes} upvotes] u/${comment.author}: "${comment.text}"\n\n`;
                                }
                            }
                            return postResult;
                        });

                        const commentsResults = await Promise.all(commentPromises);
                        searchResults += commentsResults.join('');

                        if (redditPosts.length > 3) {
                            searchResults += '\n   OTHER RELEVANT THREADS:\n';
                            for (const post of redditPosts.slice(3)) {
                                searchResults += `   - r/${post.subreddit}: "${post.title}" (${post.upvotes} upvotes)\n`;
                            }
                        }
                        searchResults += '\n';
                    }

                    // Wait for Web Search to complete
                    console.log('[Research] Waiting for Web Search to complete...');
                    const webResults = await webSearchPromise;
                    searchResults += '\n=== OTHER SOURCES ===\n' + webResults;

                    // Re-prompt Gemini with research results
                    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

                    const isFoodQuery = queries.some((q: string) => /food|restaurant|eat|dinner|lunch|breakfast|brunch|cafe|bakery|bar|pizza|burger|sushi|steak|tacos|bagel|coffee|dessert|ice cream|pastry|croissant/i.test(q));
                    const redditTarget = isFoodQuery ? "70%" : "55%";

                    const researchPrompt = `${fullPrompt}\n${content}\n\n[SYSTEM: Research Results for "${queries[0]}":\n${searchResults}\n\n⚠️ IMPORTANT: Extract up to 10 place recommendations from the research above:
 
SOURCE PRIORITY:
1. REDDIT IS KING: You MUST prioritize recommendations found in Reddit comments.
2. BALANCE: Aim for at least ${redditTarget} of your recommendations to come from Reddit threads if available.
3. ONLY use Web articles if you cannot find enough high-quality recommendations on Reddit.

EXTRACTION RULES:
- For Reddit: extract place names from highly-upvoted comments. Use the Reddit thread URL as the sourceUrl.
- For Web articles: extract place names and recommendations from the article summaries.
- Use the source URL as sourceUrl and quote the relevant text.

OUTPUT FORMAT:
- Output a recommendPlaces action with up to 10 places
- Use REAL URLs from the research. Do NOT make up URLs.
- If this is about EVENTS: Only include events happening in ${currentMonth} ${currentYear} or later.

⚠️ DO NOT say "the search came up empty" if there are web results available. Use them!
Do NOT ask for clarification - give all recommendations NOW.]

Assistant (extracting places from research and outputting recommendPlaces):`;

                    content = await callGemini(researchPrompt);
                    console.log("--- RAW GEMINI RESPONSE 2 (After Research) ---");
                    console.log(content);
                    console.log("----------------------------------------------");

                    // Check for recommendation action in the second response
                    const secondExtracted = extractAction(content);
                    if (secondExtracted) {
                        const { action: secondAction } = secondExtracted;
                        if (secondAction.action === 'recommendPlaces') {
                            // Enrich with images from Google Places API
                            const enrichedPlaces = await Promise.all(secondAction.places.map(async (p: any) => {
                                try {
                                    const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                                    if (placeData) {
                                        console.log(`[Recommendation] Got data for ${p.name}: rating=${placeData.rating}`);
                                        return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating };
                                    }
                                    return p;
                                } catch (e) {
                                    console.error(`Failed to fetch image for ${p.name}:`, e);
                                    return p;
                                }
                            }));
                            actionResult = { type: 'recommendations', places: enrichedPlaces };
                        }
                    } else {
                        console.log("No action detected in second response.");
                    }
                }

                // ============= RECOMMEND PLACES ACTION =============
                else if (action.action === 'recommendPlaces') {
                    const enrichedPlaces = await Promise.all(action.places.map(async (p: any) => {
                        try {
                            const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                            if (placeData) {
                                console.log(`[Recommendation] Got data for ${p.name}: rating=${placeData.rating}`);
                                return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating };
                            }
                            return p;
                        } catch (e) {
                            console.error(`Failed to fetch image for ${p.name}:`, e);
                            return p;
                        }
                    }));
                    actionResult = { type: 'recommendations', places: enrichedPlaces };
                }

                // ============= ADD PLACE ACTION =============
                else if (action.action === 'addPlace' && action.placeName) {
                    const result = await findAndAddPlace(action.placeName, action.location, action, userId, token);
                    if (result.added) {
                        actionResult = { added: true, place: result.place };
                        console.log(`✅ Added place: ${result.place.name}`);
                    } else {
                        actionResult = { added: false, message: result.message };
                    }
                }

                // ============= ADD MULTIPLE PLACES ACTION =============
                else if (action.action === 'addMultiplePlaces' && action.places) {
                    const results = [];
                    for (const p of action.places) {
                        const result = await findAndAddPlace(p.name, p.location, p, userId, token);
                        results.push({
                            name: p.name,
                            status: result.added ? 'added' : 'skipped',
                            reason: result.message,
                            place: result.place
                        });
                    }
                    actionResult = { type: 'batch_add', results };
                }

                // ============= FIND BOOKINGS ACTION =============
                else if (action.action === 'findBookings' && action.places) {
                    const bookings = [];
                    for (const place of action.places) {
                        const searchDate = place.date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
                        const partySize = place.partySize || 2;

                        const bookingLinks: any = {};
                        bookingLinks.google = `https://www.google.com/maps/search/${encodeURIComponent(place.name + ' New York, NY')}`;

                        if (place.type === 'tickets') {
                            bookingLinks.website = `https://www.google.com/search?q=${encodeURIComponent(place.name + ' tickets')}`;
                        } else {
                            bookingLinks.openTable = `https://www.opentable.com/s?dateTime=${searchDate}T19%3A00&covers=${partySize}&term=${encodeURIComponent(place.name)}`;
                            bookingLinks.resy = `https://resy.com/cities/ny?date=${searchDate}&seats=${partySize}&query=${encodeURIComponent(place.name)}`;
                            bookingLinks.yelp = `https://www.yelp.com/search?find_desc=${encodeURIComponent(place.name)}&find_loc=New+York,+NY`;
                        }

                        bookings.push({
                            name: place.name,
                            type: place.type || 'reservation',
                            date: searchDate,
                            partySize,
                            bookingLinks
                        });
                    }

                    actionResult = { type: 'bookings', bookings };
                }

                // ============= FIND RESERVATIONS ACTION =============
                else if (action.action === 'findReservations') {
                    const resInfo = await findReservationOptions(action.restaurantName, 'New York, NY');
                    actionResult = {
                        type: 'reservations',
                        restaurantName: action.restaurantName,
                        ...resInfo
                    };
                }

                // ============= SCRAPE URL ACTION =============
                else if (action.action === 'scrapeUrl' && action.url) {
                    console.log(`Scraping URL: ${action.url}`);

                    const isSocialMedia = /instagram\.com|tiktok\.com/i.test(action.url);

                    if (isSocialMedia) {
                        const metadataDescription = await scrapeSocialMetadata(action.url);
                        if (metadataDescription) {
                            console.log(`[Scrape] Got metadata: ${metadataDescription.slice(0, 100)}...`);

                            const prompt = `Identify all restaurant/place/event names mentioned in this social media caption: "${metadataDescription}". 
                            Return a JSON object with a "places" array. Each item should have:
                            - "name": The name of the place or EVENT (e.g. "Sleep No More").
                            - "location": The venue or neighborhood.
                            - "isEvent": boolean (true if it's a temporary event like a movie, play, market).
                            - "startDate": "YYYY-MM-DD" (if mentioned/inferable, else null).
                            - "endDate": "YYYY-MM-DD" (if mentioned/inferable, else null).
                            
                            Example: { "places": [{ "name": "Holiday Market", "location": "Union Square", "isEvent": true, "startDate": "2023-11-01", "endDate": "2023-12-24" }] }
                            If no places are found, return { "places": [] }.`;

                            try {
                                const aiResponse = await callGemini(prompt);
                                const extracted = JSON.parse(aiResponse.replace(/```json|```/g, '').trim());

                                if (extracted && extracted.places && extracted.places.length > 0) {
                                    console.log(`[Scrape] Extracted items: ${extracted.places.map((p: any) => p.name).join(', ')}`);
                                    const results = [];
                                    for (const item of extracted.places) {
                                        const result = await findAndAddPlace(item.name, item.location, item, userId, token);
                                        results.push({
                                            name: item.name,
                                            status: result.added ? 'added' : 'skipped',
                                            reason: result.message,
                                            place: result.place
                                        });
                                    }
                                    actionResult = { type: 'batch_add', results };
                                } else {
                                    actionResult = { added: false, message: "Could not identify any places in the post." };
                                }
                            } catch (e) {
                                console.error('Gemini extraction failed:', e);
                                actionResult = { added: false, error: 'Failed to extract places from post.' };
                            }
                        } else {
                            actionResult = { added: false, error: 'Could not fetch post content.' };
                        }
                    } else {
                        actionResult = { added: false, message: "I can currently only auto-add from Instagram/TikTok links. For others, try asking me to 'research this link'." };
                    }
                }

            } catch (e) {
                console.error('Error processing action:', e);
            }
        }

        // Clean ALL JSON actions from the final content before sending
        content = stripAllActions(content);

        console.log(`[Chat API] ========== REQUEST END ==========`);

        return res.status(200).json({ content, actionResult });

    } catch (error: any) {
        console.error('[Chat API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
