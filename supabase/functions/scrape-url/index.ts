import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlaceData {
    name: string;
    type: string;
    cuisine?: string;
    address: string;
    description?: string;
    source_url?: string;
    image_url?: string;
    yelp_rating?: number;
    coordinates?: { lat: number; lng: number };
}

// Geocode address using Nominatim (free)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            { headers: { 'User-Agent': 'SpotApp/1.0' } }
        );
        const data = await response.json();
        if (data && data[0]) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    return null;
}

// Scrape with Firecrawl
async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<any> {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            url,
            formats: ['markdown', 'extract'],
            extract: {
                schema: {
                    type: 'object',
                    properties: {
                        place_name: { type: 'string', description: 'Name of the restaurant, cafe, bar, or place' },
                        cuisine_type: { type: 'string', description: 'Type of cuisine or category' },
                        address: { type: 'string', description: 'Full address of the place' },
                        description: { type: 'string', description: 'Description or review of the place' },
                        rating: { type: 'number', description: 'Rating out of 5' },
                        image_url: { type: 'string', description: 'URL of main image' },
                    },
                },
            },
        }),
    });
    return response.json();
}

// Search Google Maps for a place name (fallback)
async function searchGoogleMaps(placeName: string, location: string, apiKey: string): Promise<PlaceData | null> {
    try {
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(placeName + ' ' + location)}`;
        console.log(`Searching Google Maps: ${searchUrl}`);

        const result = await scrapeWithFirecrawl(searchUrl, apiKey);

        if (result.success && result.data?.extract) {
            const extract = result.data.extract;
            const coords = extract.address ? await geocodeAddress(extract.address) : null;

            return {
                name: extract.place_name || placeName,
                type: 'restaurant',
                cuisine: extract.cuisine_type,
                address: extract.address || location,
                description: extract.description,
                image_url: extract.image_url,
                coordinates: coords || undefined,
            };
        }
    } catch (error) {
        console.error('Google Maps search error:', error);
    }
    return null;
}

// Main search function: Google Maps first, Yelp fallback
async function searchPlace(placeName: string, location: string, apiKey: string): Promise<PlaceData | null> {
    // Try Google Maps first
    console.log(`Searching Google Maps for: ${placeName}`);
    const googleResult = await searchGoogleMaps(placeName, location, apiKey);
    if (googleResult) {
        console.log('Found on Google Maps!');
        return googleResult;
    }

    // Fallback to Yelp
    console.log('Google Maps failed, trying Yelp...');
    try {
        const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(placeName)}&find_loc=${encodeURIComponent(location)}`;
        console.log(`Searching Yelp: ${searchUrl}`);

        const searchResult = await scrapeWithFirecrawl(searchUrl, apiKey);

        if (searchResult.success && searchResult.data?.extract?.place_name) {
            const extract = searchResult.data.extract;
            const coords = extract.address ? await geocodeAddress(extract.address) : null;

            return {
                name: extract.place_name || placeName,
                type: 'restaurant',
                cuisine: extract.cuisine_type,
                address: extract.address || `${location}`,
                description: extract.description,
                yelp_rating: extract.rating,
                image_url: extract.image_url,
                coordinates: coords || undefined,
            };
        }

        // If extraction didn't work, try to find first result URL and scrape that
        if (searchResult.data?.markdown) {
            const yelpLinkMatch = searchResult.data.markdown.match(/\(https:\/\/www\.yelp\.com\/biz\/[^\)]+\)/);
            if (yelpLinkMatch) {
                const bizUrl = yelpLinkMatch[0].slice(1, -1);
                const bizResult = await scrapeYelpBiz(bizUrl, apiKey);
                if (bizResult) return bizResult;
            }
        }
    } catch (error) {
        console.error('Yelp search error:', error);
    }

    return null;
}

// Scrape a Yelp business page directly
async function scrapeYelpBiz(url: string, apiKey: string): Promise<PlaceData | null> {
    try {
        const result = await scrapeWithFirecrawl(url, apiKey);

        if (result.success && result.data?.extract) {
            const extract = result.data.extract;
            const coords = extract.address ? await geocodeAddress(extract.address) : null;

            return {
                name: extract.place_name || 'Unknown Place',
                type: 'restaurant',
                cuisine: extract.cuisine_type,
                address: extract.address || '',
                description: extract.description,
                source_url: url,
                yelp_rating: extract.rating,
                image_url: extract.image_url,
                coordinates: coords || undefined,
            };
        }
    } catch (error) {
        console.error('Yelp biz scrape error:', error);
    }
    return null;
}

// Extract place name from Instagram/TikTok content
async function extractPlaceFromCaption(content: string): Promise<string | null> {
    // Instagram/TikTok location tags and common patterns
    const patterns = [
        // Location pin emoji followed by text
        /📍\s*([^,\n📍@#]+)/i,

        // Instagram location tag format (often appears as "at Location Name")
        /(?:^|\n)\s*at\s+([A-Z][^,\n]+)/m,

        // "Location: Place Name" format
        /location[:\s]+([^,\n]+)/i,

        // Tagged location (Instagram shows as link text)
        /\[([^\]]+)\]\(https?:\/\/www\.instagram\.com\/explore\/locations/i,

        // @restaurant mentions (common for restaurants)
        /@([a-zA-Z0-9_.]+(?:nyc|restaurant|cafe|bar|eatery|kitchen|bistro|pizzeria|bakery))/i,

        // "at @placename" pattern
        /at\s+@([a-zA-Z0-9_.]+)/i,

        // Generic @mention at start of line (often the place)
        /^@([a-zA-Z0-9_.]+)/m,

        // "visiting Place Name" or "visited Place Name"
        /visit(?:ed|ing)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i,

        // "dinner at Place" / "lunch at Place" / "brunch at Place"  
        /(?:dinner|lunch|brunch|breakfast|drinks?|coffee)\s+(?:at\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,

        // "Place Name NYC" or "Place Name New York" pattern
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:NYC|NY|New York|Brooklyn|Manhattan)/i,

        // Caption starting with restaurant name (common pattern)
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[-–—:]/m,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            const extracted = match[1].trim();
            // Filter out common false positives
            const blacklist = ['the', 'this', 'that', 'here', 'there', 'our', 'my', 'your', 'new', 'best', 'amazing'];
            if (!blacklist.includes(extracted.toLowerCase()) && extracted.length > 2 && extracted.length < 50) {
                console.log(`Extracted place name: "${extracted}" using pattern: ${pattern}`);
                return extracted;
            }
        }
    }

    return null;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { url, placeName, location = "New York, NY" } = await req.json();
        const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

        if (!FIRECRAWL_API_KEY) {
            throw new Error("FIRECRAWL_API_KEY not configured");
        }

        // If just a place name is provided, search Yelp
        if (placeName && !url) {
            console.log(`Searching Yelp for: ${placeName}`);
            const place = await searchPlace(placeName, location, FIRECRAWL_API_KEY);

            if (place) {
                return new Response(JSON.stringify({ success: true, place }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            return new Response(JSON.stringify({
                success: false,
                error: "Could not find place details"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Handle Instagram/TikTok URLs
        const isSocialMedia = /instagram\.com|tiktok\.com/i.test(url);

        if (isSocialMedia) {
            console.log(`Scraping social media: ${url}`);

            // Try to scrape the social media page
            const result = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);

            if (result.success && result.data?.markdown) {
                const caption = result.data.markdown;
                console.log('Got caption, extracting place name...');

                // Try to extract place name from caption
                const extractedName = await extractPlaceFromCaption(caption);

                if (extractedName) {
                    console.log(`Found place name: ${extractedName}, searching Yelp...`);
                    const place = await searchPlace(extractedName, location, FIRECRAWL_API_KEY);

                    if (place) {
                        place.source_url = url;
                        return new Response(JSON.stringify({ success: true, place }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }
                }

                // Couldn't extract place name automatically
                return new Response(JSON.stringify({
                    success: false,
                    needsPlaceName: true,
                    caption: caption.slice(0, 500), // Return first 500 chars of caption
                    message: "I found the post but couldn't identify the place. What's the name and what type of food/activity is it? (e.g. 'Adda, Indian food')"
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Scraping failed - ask for place name
            return new Response(JSON.stringify({
                success: false,
                needsPlaceName: true,
                message: "I couldn't access that post directly. What's the name of the place and what type is it? (e.g. 'Carbone, Italian restaurant')"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Handle regular URLs (Yelp, Google, restaurant websites)
        console.log(`Scraping URL: ${url}`);

        // Check if it's a Yelp URL
        if (/yelp\.com\/biz/i.test(url)) {
            const place = await scrapeYelpBiz(url, FIRECRAWL_API_KEY);
            if (place) {
                return new Response(JSON.stringify({ success: true, place }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        // Generic scrape
        const result = await scrapeWithFirecrawl(url, FIRECRAWL_API_KEY);

        if (result.success && result.data?.extract) {
            const extract = result.data.extract;
            const coords = extract.address ? await geocodeAddress(extract.address) : null;

            const place: PlaceData = {
                name: extract.place_name || 'Unknown Place',
                type: 'restaurant',
                cuisine: extract.cuisine_type,
                address: extract.address || '',
                description: extract.description,
                source_url: url,
                image_url: extract.image_url,
                coordinates: coords || undefined,
            };

            return new Response(JSON.stringify({ success: true, place }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({
            success: false,
            error: "Could not extract place information from URL"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error('Scrape error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
