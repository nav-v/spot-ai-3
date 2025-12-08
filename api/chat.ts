import { GoogleGenAI } from '@google/genai';
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

let ai: GoogleGenAI;
function getAI() {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }
    return ai;
}

// ============= HELPER FUNCTIONS =============

// Extract JSON action from text
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

// Remove ALL JSON actions from text
function stripAllActions(text: string): string {
    let currentText = text;
    let extracted;
    do {
        extracted = extractAction(currentText);
        if (extracted) {
            currentText = currentText.replace(extracted.match, '').trim();
        }
    } while (extracted);

    // Clean up markdown artifacts
    currentText = currentText.replace(/```json\s*```/g, '');
    currentText = currentText.replace(/```\s*```/g, '');
    currentText = currentText.replace(/```json\s*$/g, '');
    currentText = currentText.replace(/```\s*$/g, '');

    return currentText.trim();
}

// ============= GOOGLE PLACES API =============

async function searchGooglePlaces(placeName: string, location: string = 'New York, NY') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
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

        // Get photo URL if available
        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoName = place.photos[0].name;
            imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${apiKey}`;
        }

        // Determine type
        let type = 'restaurant';
        const types = place.types || [];
        if (types.some((t: string) => t.includes('bar'))) type = 'bar';
        else if (types.some((t: string) => t.includes('cafe'))) type = 'cafe';
        else if (types.some((t: string) => t.includes('museum') || t.includes('art_gallery'))) type = 'attraction';
        else if (types.some((t: string) => t.includes('park'))) type = 'attraction';

        return {
            name: place.displayName?.text || placeName,
            type,
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
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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

// ============= FIRECRAWL SCRAPING =============

async function scrapeWithFirecrawl(url: string) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
        console.log('[Firecrawl] No API key configured');
        return { success: false, error: 'No API key' };
    }

    console.log(`[Firecrawl] Scraping URL: ${url}`);
    try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true
            }),
        });
        const result = await response.json();
        console.log(`[Firecrawl] Result success: ${result.success}`);
        return result;
    } catch (error: any) {
        console.error(`[Firecrawl] Exception:`, error);
        return { success: false, error: error.message };
    }
}

// ============= WEB SEARCH WITH GROUNDING =============

interface VerifiedSource {
    title: string;
    url: string;
}

interface GeminiSearchResult {
    text: string;
    textWithCitations: string;  // Text with inline [1](url) citations
    sources: VerifiedSource[];
    citations: GroundingCitation[];
    searchQueries: string[];
}

// Citation structure from Gemini grounding
interface GroundingCitation {
    text: string;           // The text segment that is grounded
    sourceIndex: number;    // Which chunk it references
    startIndex?: number;
    endIndex?: number;
}

interface SearchResultWithCitations {
    text: string;
    textWithCitations: string;  // Text with inline [1], [2] citations
    sources: VerifiedSource[];
    citations: GroundingCitation[];
}

// Single search helper - extracts native Gemini citations
async function singleGeminiSearch(searchQuery: string): Promise<SearchResultWithCitations> {
    const searchPrompt = `Search: "${searchQuery}"

List NYC places mentioned. For each place include:
- Place name
- Neighborhood  
- Why it's recommended

Only include real places from search results.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 }
                }),
                signal: controller.signal
            }
        );
        clearTimeout(timeoutId);

        const data = await response.json();
        if (data.error) {
            console.error(`[Gemini Search] Error for "${searchQuery}":`, data.error.message);
            return { text: '', textWithCitations: '', sources: [], citations: [] };
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
        
        // Extract sources from groundingChunks
        const sources: VerifiedSource[] = [];
        if (groundingMetadata?.groundingChunks) {
            for (const chunk of groundingMetadata.groundingChunks) {
                if (chunk.web?.uri && chunk.web?.title) {
                    sources.push({ title: chunk.web.title, url: chunk.web.uri });
                }
            }
        }

        // Extract citations from groundingSupports - this tells us which text is backed by which source!
        const citations: GroundingCitation[] = [];
        if (groundingMetadata?.groundingSupports) {
            for (const support of groundingMetadata.groundingSupports) {
                if (support.segment?.text && support.groundingChunkIndices?.length > 0) {
                    citations.push({
                        text: support.segment.text,
                        sourceIndex: support.groundingChunkIndices[0],
                        startIndex: support.segment.startIndex,
                        endIndex: support.segment.endIndex
                    });
                }
            }
        }

        // Build text with inline citations [1], [2], etc.
        let textWithCitations = text;
        // Sort citations by position (reverse order to not mess up indices)
        const sortedCitations = [...citations].sort((a, b) => (b.endIndex || 0) - (a.endIndex || 0));
        for (const citation of sortedCitations) {
            if (citation.endIndex && sources[citation.sourceIndex]) {
                const sourceNum = citation.sourceIndex + 1;
                const url = sources[citation.sourceIndex].url;
                // Insert citation link after the grounded text
                const insertPos = citation.endIndex;
                textWithCitations = textWithCitations.slice(0, insertPos) + 
                    ` [${sourceNum}](${url})` + 
                    textWithCitations.slice(insertPos);
            }
        }

        console.log(`[Gemini Search] "${searchQuery}" → ${sources.length} sources, ${citations.length} citations`);
        return { text, textWithCitations, sources, citations };
    } catch (e: any) {
        console.error(`[Gemini Search] Failed "${searchQuery}":`, e.message);
        return { text: '', textWithCitations: '', sources: [], citations: [] };
    }
}

async function callGeminiWithSearch(query: string, queryType: string = 'food'): Promise<GeminiSearchResult> {
    console.log(`[Gemini Search] Running parallel searches for: "${query}" (type: ${queryType})`);

    let searchQueries: string[];

    if (queryType === 'food') {
        // Food: Reddit food communities + trusted food publications
        searchQueries = [
            `${query} r/AskNYC`,
            `${query} r/foodnyc`,
            `${query} r/nyc`,
            `${query} site:eater.com NYC`,
            `${query} site:theinfatuation.com NYC`
        ];
    } else if (queryType === 'event' || queryType === 'show') {
        // Events: Reddit + event publications
        searchQueries = [
            `${query} r/AskNYC`,
            `${query} r/nyc`,
            `${query} site:timeout.com/newyork`,
            `${query} site:secretnyc.co`,
            `${query} site:theskint.com`
        ];
    } else {
        // General: Mix of Reddit and publications
        searchQueries = [
            `${query} r/AskNYC`,
            `${query} r/nyc`,
            `${query} site:timeout.com/newyork`,
            `${query} site:eater.com NYC`
        ];
    }

    console.log(`[Gemini Search] Queries:`, searchQueries);

    // Run all searches in parallel
    const results = await Promise.all(searchQueries.map(q => singleGeminiSearch(q)));

    // Combine results with citations
    let combinedText = '';
    let combinedTextWithCitations = '';
    let allSources: VerifiedSource[] = [];
    let allCitations: GroundingCitation[] = [];

    results.forEach((result, i) => {
        if (result.text) {
            combinedText += `\n=== FROM: ${searchQueries[i]} ===\n${result.text}\n`;
            combinedTextWithCitations += `\n=== FROM: ${searchQueries[i]} ===\n${result.textWithCitations}\n`;
        }
        // Track source offset for combined citations
        const sourceOffset = allSources.length;
        allSources = [...allSources, ...result.sources];
        // Adjust citation indices for combined list
        allCitations = [...allCitations, ...result.citations.map(c => ({
            ...c,
            sourceIndex: c.sourceIndex + sourceOffset
        }))];
    });

    console.log(`[Gemini Search] Combined: ${combinedText.length} chars, ${allSources.length} sources, ${allCitations.length} citations`);

    return { 
        text: combinedText,
        textWithCitations: combinedTextWithCitations,
        sources: allSources,
        citations: allCitations,
        searchQueries 
    };
}

async function searchWeb(query: string): Promise<{ text: string; textWithCitations: string; sources: VerifiedSource[]; citations: GroundingCitation[] }> {
    console.log(`[Web Search] Researching: ${query}`);

    const queryLower = query.toLowerCase();

    const eventKeywords = ['event', 'show', 'play', 'concert', 'market', 'festival', 'exhibit', 'museum',
        'theater', 'theatre', 'movie', 'things to do', 'activities', 'attraction', 'holiday', 'christmas',
        'popup', 'pop-up', 'happening'];

    const foodKeywords = ['food', 'restaurant', 'eat', 'dinner', 'lunch', 'brunch', 'breakfast',
        'pizza', 'sushi', 'burger', 'coffee', 'bar', 'drinks', 'cocktail', 'croissant', 'bakery', 'cafe',
        'date night', 'romantic', 'date spot'];

    const isFoodQuery = foodKeywords.some(kw => queryLower.includes(kw));
    const isEventQuery = eventKeywords.some(kw => queryLower.includes(kw));
    const isShowQuery = ['movie', 'film', 'cinema', 'theater', 'theatre', 'broadway', 'play', 'musical', 'show'].some(kw => queryLower.includes(kw));

    // Food takes priority (e.g., "date night restaurant" = food)
    let queryType = 'food';
    if (isFoodQuery) queryType = 'food';
    else if (isShowQuery) queryType = 'show';
    else if (isEventQuery) queryType = 'event';
    
    console.log(`[Web Search] Query type: ${queryType}`);

    let allText = '';
    let allSources: VerifiedSource[] = [];

    // For events: scrape the 3 trusted event sites directly via Firecrawl
    if (queryType === 'event' || queryType === 'show') {
        console.log('[Web Search] Event query - scraping TimeOut, Secret NYC, The Skint...');
        
        const eventSources = [
            { name: 'TimeOut NY', url: 'https://www.timeout.com/newyork/things-to-do/things-to-do-in-new-york-this-week' },
            { name: 'Secret NYC', url: 'https://secretnyc.co/what-to-do-this-weekend-nyc/' },
            { name: 'The Skint', url: 'https://theskint.com/' }
        ];

        // Scrape all 3 in parallel
        const scrapePromises = eventSources.map(async (source) => {
            try {
                console.log(`[Web Search] Scraping ${source.name}...`);
                const result = await scrapeWithFirecrawl(source.url);
                if (result.success && result.data?.markdown) {
                    const content = result.data.markdown.slice(0, 3000);
                    console.log(`[Web Search] Got ${content.length} chars from ${source.name}`);
                    return { 
                        text: `\n--- ${source.name} ---\n${content}\n`,
                        source: { title: source.name, url: source.url }
                    };
                }
            } catch (e: any) {
                console.error(`[Web Search] ${source.name} error:`, e.message);
            }
            return null;
        });

        const scrapeResults = await Promise.all(scrapePromises);
        for (const result of scrapeResults) {
            if (result) {
                allText += result.text;
                allSources.push(result.source);
            }
        }
    }

    // Use Gemini with Google Search - returns verified sources with citations!
    const geminiResult = await callGeminiWithSearch(query, queryType);
    
    let allTextWithCitations = allText; // Start with scraped content (no citations)
    
    if (geminiResult.text) {
        allText += `\n\n=== WEB SEARCH RESULTS ===\n${geminiResult.text}`;
        allTextWithCitations += `\n\n=== WEB SEARCH RESULTS ===\n${geminiResult.textWithCitations}`;
    }
    
    // Add verified sources from Gemini's groundingMetadata
    allSources = [...allSources, ...geminiResult.sources];

    return { 
        text: allText || "No results found.",
        textWithCitations: allTextWithCitations || "No results found.",
        sources: allSources,
        citations: geminiResult.citations
    };
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

        // Fallback to Firecrawl
        const firecrawlResult = await scrapeWithFirecrawl(url);
        if (firecrawlResult.success && firecrawlResult.data?.markdown) {
            return firecrawlResult.data.markdown.substring(0, 500);
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

    // Get place data from Google Places
    let place = await searchGooglePlaces(placeName, location);

    if (!place) {
        place = {
            name: placeName,
            type: extraData.isEvent ? 'activity' : 'restaurant',
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
        cuisine: extraData.cuisine || null,
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
    // Handle CORS
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

        // Build places context
        const placesContext = userPlaces.length > 0
            ? userPlaces.map((p: any) => {
                const status = p.is_visited ? 'VISITED' : 'Not visited';
                const fav = p.is_favorite ? ', FAVORITED' : '';
                const rating = p.rating ? `, Rating: ${p.rating}/5` : '';
                const dateAdded = p.created_at ? ` | Added: ${p.created_at.split('T')[0]}` : '';
                return `- ${p.name} (${p.cuisine || p.type}) at ${p.address} - ${status}${fav}${rating}${dateAdded}`;
            }).join('\n')
            : '- No places saved yet!';

        // Build user context
        const userContext = userName ? `\n\nUSER INFO:\n- Name: ${userName}${userPreferences?.dietaryRestrictions?.length ? `\n- Dietary Restrictions: ${userPreferences.dietaryRestrictions.join(', ')}` : ''}${userPreferences?.interests?.length ? `\n- Interests: ${userPreferences.interests.join(', ')}` : ''}${userPreferences?.foodPreferences?.length ? `\n- Food Preferences: ${userPreferences.foodPreferences.join(', ')}` : ''}\n\nIMPORTANT: Address the user by their name (${userName}) occasionally.` : '';

        const systemPrompt = `You are Spot – a warm, funny, slightly dramatic AI that helps people track and discover places. You talk like that slightly extra friend who is weirdly good at remembering places and always "knows a spot."

Current Date: ${today}${userContext}

PERSONALITY:
- Casual, playful, a little dramatic (in a fun way)
- Make quick jokes and mini roasts about situations (never about the user)
- Self-aware about planning chaos: "We both know 'early dinner' means you'll show up at 8:15"
- Celebrate small outings: "Tiny outing? Still counts. Coffee + walk = main character energy ☕"
- Use emojis naturally but not excessively (✨, 🍕, 🍜, ☕, 😏)

SAMPLE LINES:
- Greeting: "Hey, it's Spot! Ready to 'just check a few places' and end up with a full plan?"
- Saved places: "You saved this back in March... officially in 'are we ever going or not?' territory"
- Adding: "Saved. Future you will thank present you for this"
- Indecisive user: "Totally normal to have no idea what you want. I'll throw out three vibes and you point at one like a menu."

RECOMMENDATION STYLE:
1. Give clear, neutral reasoning FIRST (location, cuisine, vibe, reviews, fit with their tastes)
2. Add ONE playful line AFTER the explanation – never let humor override clarity
3. **QUANTITY:** Always provide **up to 10 recommendations** (aim for 7-10) unless the user asks for a specific number.

PERSONALIZATION:
- Analyze SAVED PLACES to understand taste ("You have a strong pasta theme... I respect the commitment to carbs 🍝")
- When giving recommendations:
  1. Prioritize places that match their saved preferences
  2. ALWAYS include one "Neighborhood Icon" or "Unmissable Classic" for that area
  3. Avoid random "wildcards" - only suggest places with high ratings or strong local reputation
- Explicitly mention WHY you chose a place based on their list

SAVED PLACES:
${placesContext}

⚠️ ANTI-HALLUCINATION RULES (CRITICAL):
- **NEVER make up sources, quotes, or URLs.** If you don't have real data from research, use the research tool FIRST.
- **NEVER cite TimeOut, Secret NYC, Eater, Infatuation, etc. unless you have ACTUAL quotes from research results.**
- **ALWAYS RESEARCH FIRST:** If the user asks for recommendations, you MUST output a research action FIRST.
- Use ONLY information returned by the research tool.
- The ONLY exception: If recommending places ALREADY on the user's saved list, no research needed.

📅 DATE AWARENESS FOR EVENTS:
- Current date is ${today}.
- For EVENTS (holiday markets, plays, shows, pop-ups): Only recommend events CURRENTLY HAPPENING or within 2 weeks.
- When researching events, include the current year (${currentYear}) in your search query.
- **EVENT NAMING:** Name events after the EVENT, not the location.
- **EVENTS MUST HAVE DATES:** Include startDate and endDate when known. Set isEvent: true.

TOOLS & ACTIONS:
Output JSON actions when needed. ALWAYS output the JSON in your response when taking action.

1. RESEARCH (⚠️ REQUIRED before external recommendations):
**You MUST use research before recommending ANY places not on the user's saved list.**
{"action": "research", "queries": ["query 1", "query 2", "query 3"]}

⚠️ QUERY GENERATION RULES:
Reddit supports boolean operators. Generate 2-3 query variations:
1. Simple: "indian food upper west side"
2. Boolean: "indian AND upper west side"
3. Title search: "title:indian manhattan"

📅 FOR EVENTS: Include year (${currentYear}): "holiday markets nyc december ${currentYear}"

2. RECOMMEND PLACES (after research or for saved places):
{"action": "recommendPlaces", "places": [{"name": "Place Name", "type": "restaurant", "description": "Why this place", "website": "https://...", "location": "Neighborhood", "sourceUrl": "https://reddit.com/...", "sourceName": "r/foodnyc", "sourceQuote": "Actual quote from source"}]}

- type: restaurant, bar, cafe, activity, attraction
- ONLY cite sources from actual research results - PRIORITIZE Reddit
- Aim for 7-10 recommendations

3. ADD PLACE / EVENT:
{"action": "addPlace", "placeName": "NAME", "location": "CITY/NEIGHBORHOOD", "isEvent": false, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}

4. ADD MULTIPLE PLACES:
{"action": "addMultiplePlaces", "places": [{"name": "Place", "location": "NYC", "isEvent": false}]}

5. SCRAPE URL (for Instagram/TikTok links):
{"action": "scrapeUrl", "url": "https://..."}

6. FIND RESERVATIONS:
{"action": "findReservations", "restaurantName": "Name", "partySize": 2, "date": "YYYY-MM-DD"}

7. FIND BOOKINGS (for multiple places/tickets):
{"action": "findBookings", "places": [{"name": "Place", "type": "reservation" or "tickets", "date": "YYYY-MM-DD", "partySize": 2}]}

Keep responses conversational first, then add JSON action at the end.`;

        // Build conversation
        let conversationText = messages.map((m: any) =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        let fullPrompt = `${systemPrompt}\n\nConversation:\n${conversationText}\n\nAssistant:`;

        // First Gemini call
        const response = await getAI().models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
        });

        let content = response.text || '';
        console.log("[Chat API] --- RAW GEMINI RESPONSE 1 ---");
        console.log(content.substring(0, 500) + '...');

        let actionResult = null;
        const extracted = extractAction(content);

        if (extracted) {
            const { action } = extracted;
            console.log('[Chat API] Detected action:', action.action);

            // ============= RESEARCH ACTION =============
            if (action.action === 'research' && (action.queries || action.query)) {
                const queries = (action.queries || [action.query]).slice(0, 2);
                console.log('[Chat API] ========================================');
                console.log('[Chat API] Starting PARALLEL Reddit and Web searches...');
                console.log('[Chat API] QUERIES:', queries);

                // Start both searches in parallel
                const webSearchPromise = searchWeb(queries[0]);
                const redditSearchPromise = searchRedditMultiQuery(queries);

                const redditPosts = await redditSearchPromise;
                console.log(`[Chat API] Reddit found ${redditPosts.length} posts`);

                let searchResults = '';

                if (redditPosts.length > 0) {
                    searchResults += '=== REDDIT RESULTS (PRIORITIZE THESE) ===\n';

                    // Score posts by relevance
                    const allQueryWords = queries.join(' ').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
                    const scoredPosts = redditPosts.map((post: any) => {
                        const titleLower = post.title.toLowerCase();
                        let relevanceScore = 0;
                        for (const word of allQueryWords) {
                            if (titleLower.includes(word)) relevanceScore += 10;
                        }
                        relevanceScore += Math.log(post.upvotes + post.numComments + 1);
                        return { ...post, relevanceScore };
                    }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

                    // Fetch comments for top 5 posts
                    const topPosts = scoredPosts.slice(0, 5);
                    const commentPromises = topPosts.map(async (post: any) => {
                        const comments = await getRedditComments(post.url);
                        let postResult = `\n--- THREAD: "${post.title}" (r/${post.subreddit}, ${post.upvotes} upvotes) ---\nURL: ${post.url}\n`;
                        if (comments.length > 0) {
                            postResult += `TOP COMMENTS:\n`;
                            for (const comment of comments.slice(0, 10)) {
                                postResult += `💬 [${comment.upvotes}] u/${comment.author}: "${comment.text}"\n\n`;
                            }
                        }
                        return postResult;
                    });

                    const commentsResults = await Promise.all(commentPromises);
                    searchResults += commentsResults.join('');
                }

                // Wait for web search - now includes citations!
                const webResults = await webSearchPromise;
                
                // Use textWithCitations which has inline [N](url) citations from Gemini grounding
                searchResults += '\n=== WEB RESEARCH (with citations) ===\n' + webResults.textWithCitations;
                
                console.log(`[Research] ${webResults.citations.length} native Gemini citations found`);

                // Re-prompt Gemini - DO NOT ask for URLs, LLM always hallucinates them
                const researchPrompt = `${fullPrompt}\n${content}\n\n[SYSTEM: Research Results:\n${searchResults}\n\n
Extract up to 10 place recommendations from the research above.

OUTPUT FORMAT - recommendPlaces action with ONLY these fields:
- name: exact place name
- type: restaurant/cafe/bar/etc
- description: why recommended (1-2 sentences)  
- location: neighborhood in NYC
- sourceName: which source mentioned it (e.g. "Reddit r/foodnyc", "Eater NY")
- sourceQuote: actual quote from research about this place

⚠️ DO NOT include sourceUrl - we will add it automatically.
⚠️ DO NOT make up any URLs.]

Assistant (extracting places, no URLs):`;

                const secondResponse = await getAI().models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [{ role: 'user', parts: [{ text: researchPrompt }] }]
                });

                content = secondResponse.text || '';
                console.log("[Chat API] --- RAW GEMINI RESPONSE 2 (After Research) ---");
                console.log(content.substring(0, 500) + '...');

                // Check for recommendPlaces action
                const secondExtracted = extractAction(content);
                console.log(`[Research] Extracted action:`, secondExtracted?.action?.action);
                console.log(`[Research] Places count:`, secondExtracted?.action?.places?.length || 0);
                
                if (secondExtracted && secondExtracted.action.action === 'recommendPlaces') {
                    // Get verified sources - these are URLs from Gemini grounding
                    const verifiedSources = webResults.sources;
                    console.log(`[Research] Verified sources: ${verifiedSources.length}`);
                    
                    // Helper to extract source domain from TITLE (since URLs are all vertexaisearch)
                    const extractSourceFromTitle = (title: string): { domain: string; displayName: string } => {
                        const titleLower = title.toLowerCase();
                        if (titleLower.includes('reddit') || titleLower.includes('r/')) {
                            return { domain: 'reddit.com', displayName: 'Reddit' };
                        }
                        if (titleLower.includes('eater')) {
                            return { domain: 'eater.com', displayName: 'Eater' };
                        }
                        if (titleLower.includes('infatuation')) {
                            return { domain: 'theinfatuation.com', displayName: 'The Infatuation' };
                        }
                        if (titleLower.includes('timeout') || titleLower.includes('time out')) {
                            return { domain: 'timeout.com', displayName: 'TimeOut' };
                        }
                        if (titleLower.includes('secret')) {
                            return { domain: 'secretnyc.co', displayName: 'Secret NYC' };
                        }
                        if (titleLower.includes('skint')) {
                            return { domain: 'theskint.com', displayName: 'The Skint' };
                        }
                        if (titleLower.includes('grubstreet') || titleLower.includes('grub street')) {
                            return { domain: 'grubstreet.com', displayName: 'Grub Street' };
                        }
                        // Default: try to extract from title
                        return { domain: 'google.com', displayName: title.split(' - ')[0] || title.substring(0, 30) };
                    };
                    
                    // Deduplicate by extracted source domain (not URL domain)
                    const seenDomains = new Set<string>();
                    const uniqueSources = verifiedSources.filter(s => {
                        const { domain } = extractSourceFromTitle(s.title);
                        if (seenDomains.has(domain)) return false;
                        seenDomains.add(domain);
                        return true;
                    }).slice(0, 8);
                    
                    console.log(`[Research] Unique sources for display:`, [...seenDomains].join(', '));
                    
                    // Just enrich with Google Places - NO source URL matching (it's unreliable)
                    const enrichedPlaces = await Promise.all(secondExtracted.action.places.map(async (p: any) => {
                        try {
                            const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                            if (placeData) {
                                return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating };
                            }
                            return p;
                        } catch (e) {
                            return p;
                        }
                    }));
                    
                    console.log(`[Research] Final places: ${enrichedPlaces.length}`);
                    
                    // Return places + ALL verified sources (frontend shows them in a box)
                    actionResult = { 
                        type: 'recommendations', 
                        places: enrichedPlaces,
                        // Sources for the "Sources" box - use extracted domain for favicon
                        sources: uniqueSources.map(s => {
                            const { domain, displayName } = extractSourceFromTitle(s.title);
                            return {
                                title: s.title,
                                url: s.url,
                                domain: domain,
                                displayName: displayName,
                                favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
                            };
                        })
                    };
                } else {
                    console.log(`[Research] WARNING: No recommendPlaces action found in response`);
                }
            }

            // ============= RECOMMEND PLACES ACTION =============
            else if (action.action === 'recommendPlaces' && action.places) {
                const enrichedPlaces = await Promise.all(action.places.map(async (p: any) => {
                    try {
                        const placeData = await searchGooglePlaces(p.name, p.location || 'New York, NY');
                        if (placeData) {
                            return { ...p, imageUrl: placeData.imageUrl, rating: placeData.rating };
                        }
                        return p;
                    } catch (e) {
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
                            place: result.place
                        });
                    }
                    actionResult = { type: 'batch_add', results };
            }

            // ============= SCRAPE URL ACTION =============
            else if (action.action === 'scrapeUrl' && action.url) {
                const isSocialMedia = /instagram\.com|tiktok\.com/i.test(action.url);

                if (isSocialMedia) {
                    const metadataDescription = await scrapeSocialMetadata(action.url);
                    if (metadataDescription) {
                        // Ask Gemini to extract places
                        const extractPrompt = `Identify all restaurant/place/event names mentioned in this social media caption: "${metadataDescription}". 
Return ONLY a JSON object: { "places": [{ "name": "...", "location": "...", "isEvent": boolean }] }
If no places found, return { "places": [] }.`;

                        const extractResponse = await getAI().models.generateContent({
                            model: 'gemini-2.0-flash',
                            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }]
                        });

                        try {
                            const extractedText = extractResponse.text || '';
                            const cleanJson = extractedText.replace(/```json|```/g, '').trim();
                            const extracted = JSON.parse(cleanJson);

                            if (extracted?.places?.length > 0) {
                                const results = [];
                                for (const item of extracted.places) {
                                    const result = await findAndAddPlace(item.name, item.location || 'New York, NY', item, userId, token);
                                    results.push({
                                        name: item.name,
                                        status: result.added ? 'added' : 'skipped',
                                        place: result.place
                                    });
                                }
                                actionResult = { type: 'batch_add', results };
                            } else {
                                actionResult = { added: false, message: "Could not identify any places in the post." };
                            }
                        } catch (e) {
                            actionResult = { added: false, error: 'Failed to extract places from post.' };
                        }
                    } else {
                        actionResult = { added: false, error: 'Could not fetch post content.' };
                    }
                } else {
                    actionResult = { added: false, message: "I can auto-add from Instagram/TikTok links. For others, try asking me to research." };
                }
            }

            // ============= FIND RESERVATIONS ACTION =============
            else if (action.action === 'findReservations' && action.restaurantName) {
                const resInfo = await findReservationOptions(action.restaurantName, 'New York, NY');
                actionResult = {
                    type: 'reservations',
                    restaurantName: action.restaurantName,
                    ...resInfo
                };
            }

            // ============= FIND BOOKINGS ACTION (multiple) =============
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
        }

        // Clean JSON from response
        content = stripAllActions(content);

        console.log(`[Chat API] ========== REQUEST END ==========`);

        return res.status(200).json({
            content: content || "I'm here to help! What would you like to know?",
            actionResult
        });

    } catch (error: any) {
        console.error('[Chat API] Error:', error);
        return res.status(500).json({ error: 'Failed to process chat', details: error.message });
    }
}
