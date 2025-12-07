import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Supabase client for backend - use environment variables with fallback
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kzxmplnrozabftmmuchx.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eG1wbG5yb3phYmZ0bW11Y2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMjQ5NTIsImV4cCI6MjA4MDcwMDk1Mn0.ZvX-wGttZr5kWNP_Svxqfvl7Vyd2_L6MW8-Wy7j_ANg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Simple file-based database
const DB_PATH = path.join(__dirname, 'data', 'places.json');
const USERS_PATH = path.join(__dirname, 'data', 'users.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ places: [] }, null, 2));
}

// ============= AUTH HELPERS =============
// Simple in-memory session store (maps token -> userId)
const sessions = new Map();

// Helper to read/write users database
const getUsersDB = () => {
    if (!fs.existsSync(USERS_PATH)) {
        return { users: [], waitlist: [] };
    }
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
};
const saveUsersDB = (data) => fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));

// Helper to get user-specific places file path
const getUserPlacesPath = (userId) => {
    return path.join(__dirname, 'data', `places_${userId}.json`);
};

// Helper to read/write user-specific places database
const getUserDB = (userId) => {
    const userPath = getUserPlacesPath(userId);
    if (!fs.existsSync(userPath)) {
        // Create empty places file for new user
        fs.writeFileSync(userPath, JSON.stringify({ places: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(userPath, 'utf-8'));
};
const saveUserDB = (userId, data) => {
    const userPath = getUserPlacesPath(userId);
    fs.writeFileSync(userPath, JSON.stringify(data, null, 2));
};

// Legacy helper (fallback for backward compatibility)
const getDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// Auth middleware - extracts user from token
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.userId = null;
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];
    const userId = sessions.get(token);

    if (!userId) {
        req.userId = null;
        req.user = null;
        return next();
    }

    const usersDB = getUsersDB();
    const user = usersDB.users.find(u => u.id === userId);

    req.userId = userId;
    req.user = user || null;
    next();
};

// Apply auth middleware to all routes
app.use(authMiddleware);

// ============= AUTH API =============

// Login with password only
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const usersDB = getUsersDB();
    const user = usersDB.users.find(u => u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, user.id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        sessions.delete(token);
    }
    res.json({ success: true });
});

// Get current user
app.get('/api/user', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
});

// Update user profile
app.patch('/api/user', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, email, password, avatarUrl } = req.body;
    const usersDB = getUsersDB();
    const userIndex = usersDB.users.findIndex(u => u.id === req.userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (name !== undefined) usersDB.users[userIndex].name = name;
    if (email !== undefined) usersDB.users[userIndex].email = email;
    if (password !== undefined) usersDB.users[userIndex].password = password;
    if (avatarUrl !== undefined) usersDB.users[userIndex].avatarUrl = avatarUrl;

    saveUsersDB(usersDB);

    const { password: _, ...userWithoutPassword } = usersDB.users[userIndex];
    res.json(userWithoutPassword);
});

// Update user preferences
app.patch('/api/user/preferences', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { dietaryRestrictions, interests, foodPreferences } = req.body;
    const usersDB = getUsersDB();
    const userIndex = usersDB.users.findIndex(u => u.id === req.userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!usersDB.users[userIndex].preferences) {
        usersDB.users[userIndex].preferences = {};
    }

    if (dietaryRestrictions !== undefined) {
        usersDB.users[userIndex].preferences.dietaryRestrictions = dietaryRestrictions;
    }
    if (interests !== undefined) {
        usersDB.users[userIndex].preferences.interests = interests;
    }
    if (foodPreferences !== undefined) {
        usersDB.users[userIndex].preferences.foodPreferences = foodPreferences;
    }

    saveUsersDB(usersDB);

    const { password: _, ...userWithoutPassword } = usersDB.users[userIndex];
    res.json(userWithoutPassword);
});

// Add to waitlist
app.post('/api/waitlist', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const usersDB = getUsersDB();

    // Check if already on waitlist
    if (usersDB.waitlist.includes(email)) {
        return res.json({ success: true, message: 'Already on waitlist' });
    }

    usersDB.waitlist.push(email);
    saveUsersDB(usersDB);

    res.json({ success: true, message: 'Added to waitlist' });
});

// Gemini client - matches official docs exactly
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============= PLACES API =============

// Get all places (user-scoped)
app.get('/api/places', (req, res) => {
    // If user is authenticated, get their places; otherwise fallback to legacy
    if (req.userId) {
        const db = getUserDB(req.userId);
        res.json(db.places);
    } else {
        const db = getDB();
        res.json(db.places);
    }
});

// Add a new place - enriches with Google Places data for coordinates
app.post('/api/places', async (req, res) => {
    try {
        // Use user-scoped DB if authenticated
        const db = req.userId ? getUserDB(req.userId) : getDB();
        let placeData = req.body;

        // Try to enrich with Google Places data (for coordinates, rating, etc.)
        if (placeData.name) {
            const location = placeData.address || placeData.location || 'New York, NY';
            console.log(`[Add Place] Enriching "${placeData.name}" with Google Places data...`);

            // Import dynamically since the function is defined below
            const googleData = await searchGooglePlaces(placeData.name, location);

            if (googleData) {
                console.log(`[Add Place] Got coordinates: ${googleData.coordinates?.lat}, ${googleData.coordinates?.lng}`);
                // Merge Google Places data but keep original description and image if better
                placeData = {
                    ...placeData,
                    address: googleData.address || placeData.address,
                    coordinates: googleData.coordinates,
                    rating: googleData.rating || placeData.rating,
                    // Keep existing imageUrl if provided, otherwise use Google's
                    imageUrl: placeData.imageUrl || googleData.imageUrl
                };
            }
        }

        const newPlace = {
            id: Date.now().toString(),
            ...placeData,
            createdAt: new Date().toISOString(),
            isVisited: false,
            isFavorite: true,
        };
        db.places.unshift(newPlace);

        // Save to user-scoped DB if authenticated
        if (req.userId) {
            saveUserDB(req.userId, db);
        } else {
            saveDB(db);
        }
        res.json(newPlace);
    } catch (error) {
        console.error('[Add Place] Error:', error);
        // Still add the place even if enrichment fails
        const db = req.userId ? getUserDB(req.userId) : getDB();
        const newPlace = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString(),
            isVisited: false,
            isFavorite: true,
        };
        db.places.unshift(newPlace);
        if (req.userId) {
            saveUserDB(req.userId, db);
        } else {
            saveDB(db);
        }
        res.json(newPlace);
    }
});

// Update a place
app.patch('/api/places/:id', (req, res) => {
    const db = req.userId ? getUserDB(req.userId) : getDB();
    const index = db.places.findIndex(p => p.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Place not found' });
    }
    db.places[index] = { ...db.places[index], ...req.body };
    if (req.userId) {
        saveUserDB(req.userId, db);
    } else {
        saveDB(db);
    }
    res.json(db.places[index]);
});

// Delete a place
app.delete('/api/places/:id', (req, res) => {
    const db = req.userId ? getUserDB(req.userId) : getDB();
    db.places = db.places.filter(p => p.id !== req.params.id);
    if (req.userId) {
        saveUserDB(req.userId, db);
    } else {
        saveDB(db);
    }
    res.json({ success: true });
});

// ============= SCRAPE API =============

// Scrape with Firecrawl
async function scrapeWithFirecrawl(url) {
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
                            latitude: { type: 'number', description: 'Latitude coordinate of the place' },
                            longitude: { type: 'number', description: 'Longitude coordinate of the place' },
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
    } catch (error) {
        console.error(`[Firecrawl] Exception:`, error);
        return { success: false, error: error.message };
    }
}

// ============= REDDIT API =============
// Uses Reddit's public JSON API (no auth needed) to search r/foodnyc and r/AskNYC

async function searchReddit(query, subreddits = ['foodnyc', 'AskNYC']) {
    const results = [];

    // Generate multiple query variations for better coverage
    // Reddit supports: AND, OR, NOT, "exact phrase", title:
    const queryVariations = generateQueryVariations(query);
    console.log(`[Reddit] Query variations:`, queryVariations);

    for (const subreddit of subreddits) {
        for (const searchQuery of queryVariations) {
            try {
                // Use Reddit's relevance sorting
                const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(searchQuery)}&restrict_sr=1&limit=5&sort=relevance`;
                console.log(`[Reddit] Searching r/${subreddit} for: ${searchQuery}`);

                const response = await fetch(searchUrl, {
                    headers: {
                        'User-Agent': 'SpotAI/1.0 (place recommendation bot)'
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
                    // Deduplicate by URL
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

                console.log(`[Reddit] Found ${posts.length} posts in r/${subreddit}`);
            } catch (error) {
                console.error(`[Reddit] Error searching r/${subreddit}:`, error.message);
            }
        }
    }

    // Sort by relevance score (upvotes + comments)
    results.sort((a, b) => (b.upvotes + b.numComments) - (a.upvotes + a.numComments));
    return results.slice(0, 12); // Return top 12
}

// Search Reddit with multiple LLM-provided queries (uses boolean operators directly)
async function searchRedditMultiQuery(queries, subreddits = ['foodnyc', 'AskNYC']) {
    const results = [];

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
                    // Deduplicate by URL
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
            } catch (error) {
                console.error(`[Reddit] Error:`, error.message);
            }
        }
    }

    // Sort by engagement
    results.sort((a, b) => (b.upvotes + b.numComments) - (a.upvotes + a.numComments));
    return results.slice(0, 15);
}

// Get top comments from a Reddit post
async function getRedditComments(postUrl) {
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

        // Get top 15 comments with more text (500 chars)
        return comments.slice(0, 15).map(c => ({
            author: c.data?.author,
            text: c.data?.body?.slice(0, 500),
            upvotes: c.data?.ups || 0
        })).filter(c => c.text && c.upvotes >= 0).sort((a, b) => b.upvotes - a.upvotes);
    } catch (error) {
        console.error(`[Reddit] Error fetching comments:`, error.message);
        return [];
    }
}

// ============= GOOGLE PLACES API =============
// Uses official Google Places API for reliable place lookups

async function searchGooglePlaces(placeName, location = 'New York, NY') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_PLACES_API_KEY not set. Falling back to Gemini.');
        return null;
    }

    try {
        // Step 1: Text Search to find the place
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

        // Step 2: Get photo URL if available
        let imageUrl = '';
        if (place.photos && place.photos.length > 0) {
            const photoName = place.photos[0].name;
            // Photo URL format: https://places.googleapis.com/v1/{photoName}/media?maxHeightPx=400&key={apiKey}
            imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${apiKey}`;
            console.log(`[Google Places] Photo URL generated`);
        }

        // Determine type from Google's types array
        let type = 'other';
        const types = place.types || [];
        if (types.some(t => t.includes('restaurant') || t.includes('food') || t.includes('cafe'))) {
            type = 'restaurant';
        } else if (types.some(t => t.includes('bar'))) {
            type = 'bar';
        } else if (types.some(t => t.includes('museum') || t.includes('art_gallery'))) {
            type = 'museum';
        } else if (types.some(t => t.includes('park'))) {
            type = 'park';
        } else if (types.some(t => t.includes('store') || t.includes('shopping'))) {
            type = 'shopping';
        }

        // Extract cuisine from types (for restaurants)
        let cuisine = 'General';
        const cuisineTypes = types.filter(t =>
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

// Search Google for Place Details (Knowledge Graph) - LEGACY, now using searchGooglePlaces
async function searchGoogleMaps(placeName, location) {
    // Search Google directly to get the Knowledge Graph result
    // Removed "restaurant" keyword to allow for museums, parks, etc.
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(placeName + ' ' + location)}`;
    console.log(`Searching Google: ${searchUrl}`);

    let result = await scrapeWithFirecrawl(searchUrl);
    let extract = result.success ? result.data?.extract : null;

    // Check for CAPTCHA or bad data
    const isCaptcha = extract && (
        (extract.description && extract.description.includes('unusual traffic')) ||
        (extract.description && extract.description.includes('not a robot')) ||
        (extract.description && extract.description.includes('violation of the Terms of Service')) ||
        (extract.description && extract.description.includes('automatically detects requests')) ||
        !extract.place_name // If no place name found
    );

    // Fallback: Ask Gemini if scraping fails
    if (!extract || isCaptcha) {
        console.log('Scraping failed or CAPTCHA detected. Asking Gemini for details...');
        const prompt = `I need details for a place called "${placeName}" in "${location}".
        Return a JSON object with:
        {
            "name": "${placeName}",
            "type": "restaurant" | "bar" | "park" | "museum" | "store",
            "cuisine": "Specific Cuisine (if restaurant)",
            "address": "Full Address (Street, City, Zip)",
            "website": "Official Website or Google Maps URL",
            "description": "Short description",
            "rating": 4.5,
            "coordinates": { "lat": 0, "lng": 0 }
        }
        If you don't know the exact address, provide the best known location.`;

        try {
            const aiResponse = await callGemini(prompt);
            const extracted = extractAction(aiResponse)?.action || JSON.parse(aiResponse.replace(/```json|```/g, '').trim());

            if (extracted) {
                // Try to find an image separately since Gemini can't browse for images directly here easily
                // We'll use the same image search logic as before if we can, or just leave it blank for now
                // Actually, let's try to get an image with a specific search
                let imageUrl = '';
                try {
                    const imageSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(placeName + ' ' + location + ' interior food')}&tbm=isch`;
                    const imageResult = await scrapeWithFirecrawl(imageSearchUrl);
                    if (imageResult.success && imageResult.data?.markdown) {
                        const imgMatch = imageResult.data.markdown.match(/https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|webp)/i);
                        if (imgMatch) imageUrl = imgMatch[0];
                    }
                } catch (e) {
                    console.error('Image fallback search failed:', e);
                }

                return {
                    name: extracted.name,
                    type: extracted.type,
                    cuisine: extracted.cuisine,
                    address: extracted.address,
                    description: extracted.description,
                    sourceUrl: extracted.website,
                    imageUrl: imageUrl,
                    rating: extracted.rating,
                    coordinates: extracted.coordinates
                };
            }
        } catch (e) {
            console.error('Gemini fallback failed:', e);
        }
        const lowerCat = category.toLowerCase();

        let type = 'other';
        if (lowerCat.includes('restaurant') || lowerCat.includes('food') || lowerCat.includes('kitchen') || lowerCat.includes('bar') || lowerCat.includes('cafe')) {
            type = 'restaurant';
        } else if (lowerCat.includes('museum') || lowerCat.includes('gallery')) {
            type = 'museum';
        } else if (lowerCat.includes('park') || lowerCat.includes('garden')) {
            type = 'park';
        } else if (lowerCat.includes('store') || lowerCat.includes('shop')) {
            type = 'shopping';
        }

        const coords = extract.address ? await geocodeAddress(extract.address) : null;

        // Filter out bad images (logos, doodles)
        let imageUrl = extract.image_url;
        if (imageUrl && (imageUrl.includes('logo') || imageUrl.includes('doodle') || imageUrl.includes('gstatic'))) {
            imageUrl = ''; // Clear bad image
        }

        return {
            name: name,
            type: type,
            cuisine: category,
            address: extract.address || location,
            description: extract.description || `A popular spot in ${location}`,
            imageUrl: imageUrl,
            rating: extract.rating,
            coordinates: coords,
        };
    }
    return null;
}

// Extract place from Instagram/TikTok
function extractPlaceFromCaption(content) {
    const patterns = [
        /📍\s*([^,\n📍@#]+)/i,
        /(?:^|\n)\s*at\s+([A-Z][^,\n]+)/m,
        /location[:\s]+([^,\n]+)/i,
        /@([a-zA-Z0-9_.]+(?:nyc|restaurant|cafe|bar|eatery|kitchen))/i,
        /at\s+@([a-zA-Z0-9_.]+)/i,
        /(?:dinner|lunch|brunch|breakfast)\s+(?:at\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            const extracted = match[1].trim();
            const blacklist = ['the', 'this', 'that', 'here', 'there', 'our', 'my', 'your'];
            if (!blacklist.includes(extracted.toLowerCase()) && extracted.length > 2 && extracted.length < 50) {
                return extracted;
            }
        }
    }
    return null;
}

// Scrape endpoint
app.post('/api/scrape', async (req, res) => {
    try {
        const { url, placeName, location = 'New York, NY' } = req.body;

        // If just a place name, search for it
        if (placeName && !url) {
            console.log(`Searching for: ${placeName}`);
            const place = await searchGoogleMaps(placeName, location);

            if (place) {
                return res.json({ success: true, place });
            }
            return res.json({ success: false, error: 'Could not find place' });
        }

        // Handle Instagram/TikTok
        const isSocialMedia = /instagram\.com|tiktok\.com/i.test(url);

        if (isSocialMedia) {
            console.log(`Scraping social media: ${url}`);

            // 1. Try Lightweight Metadata Scraper first
            const metadataDescription = await scrapeSocialMetadata(url);
            if (metadataDescription) {
                console.log(`Metadata found: ${metadataDescription}`);
                const extractedName = extractPlaceFromCaption(metadataDescription);
                if (extractedName) {
                    console.log(`Found place from metadata: ${extractedName}`);
                    const place = await searchGoogleMaps(extractedName, location);
                    if (place) {
                        place.sourceUrl = url;
                        return res.json({ success: true, place });
                    }
                } else {
                    // Try Gemini extraction on metadata
                    const prompt = `I have a social media caption: "${metadataDescription}".
Can you identify the place name and type (e.g. restaurant, park) mentioned?
Return ONLY a JSON object: { "name": "...", "type": "...", "cuisine": "...", "location": "...", "description": "..." } or null if not found.`;
                    try {
                        const aiResponse = await callGemini(prompt);
                        const extracted = extractAction(aiResponse)?.action || JSON.parse(aiResponse.replace(/```json|```/g, '').trim());
                        if (extracted && extracted.name) {
                            const place = await searchGoogleMaps(extracted.name, extracted.location || location);
                            if (place) {
                                place.sourceUrl = url;
                                return res.json({ success: true, place });
                            }
                        }
                    } catch (e) { console.error('Gemini metadata extraction failed', e); }
                }
            }

            // 2. Fallback to Firecrawl
            let result = await scrapeWithFirecrawl(url);

            // 3. Fallback: Google Search
            if (!result.success) {
                console.log(`Direct scraping failed. Trying Google Search fallback for: ${url}`);
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
                result = await scrapeWithFirecrawl(searchUrl);

                if (result.success && result.data?.markdown) {
                    console.log('Google Search fallback successful. Extracting with Gemini...');
                    const prompt = `I have a social media URL that I couldn't scrape directly: ${url}. 
Here are the Google Search results for it:
${result.data.markdown.slice(0, 8000)}

Can you identify the place name and type (e.g. restaurant, park) mentioned in this post? 
Return ONLY a JSON object: { "name": "...", "type": "...", "cuisine": "...", "location": "...", "description": "..." } or null if not found.`;

                    try {
                        const aiResponse = await callGemini(prompt);
                        const extracted = extractAction(aiResponse)?.action || JSON.parse(aiResponse.replace(/```json|```/g, '').trim());

                        if (extracted && extracted.name) {
                            const place = await searchGoogleMaps(extracted.name, extracted.location || location);
                            if (place) {
                                place.sourceUrl = url;
                                return res.json({ success: true, place });
                            }
                        }
                    } catch (e) {
                        console.error('Gemini extraction failed:', e);
                    }
                }
            }

            if (result.success && result.data?.markdown) {
                const extractedName = extractPlaceFromCaption(result.data.markdown);

                if (extractedName) {
                    console.log(`Found: ${extractedName}`);
                    const place = await searchGoogleMaps(extractedName, location);

                    if (place) {
                        place.sourceUrl = url;
                        return res.json({ success: true, place });
                    }
                }

                return res.json({
                    success: false,
                    needsPlaceName: true,
                    message: "I found the post but couldn't identify the place. What's the name and type? (e.g. 'Adda, Indian food')"
                });
            }

            return res.json({
                success: false,
                needsPlaceName: true,
                message: "I couldn't access that post. What's the name and type of place?"
            });
        }

        // Handle regular URLs (Google Maps, Yelp, etc)
        console.log(`Scraping: ${url}`);
        const result = await scrapeWithFirecrawl(url);

        if (result.success && result.data?.extract) {
            const extract = result.data.extract;
            const coords = extract.address ? await geocodeAddress(extract.address) : null;

            const place = {
                name: extract.place_name || 'Unknown Place',
                type: 'restaurant',
                cuisine: extract.cuisine_type,
                address: extract.address || '',
                description: extract.description,
                sourceUrl: url,
                imageUrl: extract.image_url,
                rating: extract.rating,
                coordinates: coords,
            };

            return res.json({ success: true, place });
        }

        res.json({ success: false, error: 'Could not extract place info' });

    } catch (error) {
        console.error('Scrape error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= RESERVATIONS API =============

// ============= RESERVATIONS API =============

// Search Google to find the actual reservation platform
async function findReservationOptions(restaurantName, location) {
    const searchUrl = `https://www.google.com/search?q=reservations+${encodeURIComponent(restaurantName + ' ' + location)}`;
    console.log(`Searching for reservation options: ${searchUrl}`);

    try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
                url: searchUrl,
                formats: ['extract'],
                extract: {
                    schema: {
                        type: 'object',
                        properties: {
                            platforms: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'List of reservation platforms found (e.g. OpenTable, Resy, Tock, Yelp, SevenRooms)'
                            },
                            google_reserve_link: { type: 'string', description: 'Link to Google Maps or Google Reserve if present' }
                        },
                    },
                },
            }),
        });
        const result = await response.json();
        return result.success ? result.data?.extract : null;
    } catch (error) {
        console.error('Reservation search error:', error);
        return null;
    }
}

// Reservation search endpoint
app.post('/api/reservations', async (req, res) => {
    try {
        const { restaurantName, location = 'New York, NY', date, partySize = 2 } = req.body;
        const searchDate = date || new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // Find valid platforms
        const info = await findReservationOptions(restaurantName, location);
        const platforms = info?.platforms || [];

        // Generate smart links based on detected platforms
        const bookingLinks = {};

        // Always include Google Maps as the aggregator
        bookingLinks.google = `https://www.google.com/maps/search/${encodeURIComponent(restaurantName + ' ' + location)}`;

        if (platforms.some(p => p.toLowerCase().includes('opentable'))) {
            bookingLinks.openTable = `https://www.opentable.com/s?dateTime=${searchDate}T19%3A00&covers=${partySize}&term=${encodeURIComponent(restaurantName)}`;
        }

        if (platforms.some(p => p.toLowerCase().includes('resy'))) {
            bookingLinks.resy = `https://resy.com/cities/ny?date=${searchDate}&seats=${partySize}&query=${encodeURIComponent(restaurantName)}`;
        }

        if (platforms.some(p => p.toLowerCase().includes('yelp'))) {
            bookingLinks.yelp = `https://www.yelp.com/search?find_desc=${encodeURIComponent(restaurantName)}&find_loc=${encodeURIComponent(location)}`;
        }

        if (platforms.some(p => p.toLowerCase().includes('tock'))) {
            bookingLinks.tock = `https://www.exploretock.com/search?date=${searchDate}&size=${partySize}&query=${encodeURIComponent(restaurantName)}`;
        }

        res.json({
            success: true,
            restaurantName,
            date: searchDate,
            partySize,
            detectedPlatforms: platforms,
            bookingLinks,
        });

    } catch (error) {
        console.error('Reservation search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= CHAT API (Gemini 2.5 Pro) =============

// Search Web for Research - scrape relevant sites based on query type
async function searchWeb(query) {
    console.log(`[Web Search] Researching: ${query}`);

    // Detect query type based on keywords
    const queryLower = query.toLowerCase();

    // Event/activity keywords
    const eventKeywords = ['event', 'show', 'play', 'concert', 'market', 'festival', 'exhibit', 'museum',
        'theater', 'theatre', 'movie', 'things to do', 'activities', 'attraction', 'holiday', 'christmas',
        'popup', 'pop-up', 'happening', 'weekend', 'tonight', 'this week', 'date night', 'date'];

    // Food keywords
    const foodKeywords = ['food', 'restaurant', 'eat', 'dinner', 'lunch', 'brunch', 'breakfast',
        'pizza', 'sushi', 'burger', 'coffee', 'bar', 'drinks', 'cocktail'];

    const isEventQuery = eventKeywords.some(kw => queryLower.includes(kw));
    const isFoodQuery = foodKeywords.some(kw => queryLower.includes(kw));

    // Show-specific keywords for movies/theater
    const isShowQuery = ['movie', 'film', 'cinema', 'theater', 'theatre', 'broadway', 'play', 'musical', 'show'].some(kw => queryLower.includes(kw));

    let sources = [];

    // Event/Activity sources
    const eventSources = [
        { name: 'DoNYC', url: `https://donyc.com/` },
        { name: 'TimeOut NY Things To Do', url: `https://www.timeout.com/newyork/things-to-do` },
        { name: 'The Skint', url: `https://theskint.com/` },
        { name: 'Secret NYC', url: `https://secretnyc.co/?s=${encodeURIComponent(query)}` },
        { name: 'Atlas Obscura NYC', url: `https://www.atlasobscura.com/things-to-do/new-york?q=${encodeURIComponent(query)}` },
    ];

    // Show/Entertainment sources (movies + theater)
    const showSources = [
        { name: 'Fandango Manhattan', url: `https://www.fandango.com/manhattan_ny_movietimes` },
        { name: 'NY Theatre Guide', url: `https://www.newyorktheatreguide.com/whats-on/all-events` },
        { name: 'DoNYC', url: `https://donyc.com/` },
    ];

    // Food/Restaurant sources
    const foodSources = [
        { name: 'Eater NY', url: `https://ny.eater.com/search?q=${encodeURIComponent(query)}` },
        { name: 'The Infatuation', url: `https://www.theinfatuation.com/new-york/search?query=${encodeURIComponent(query)}` },
        { name: 'TimeOut NY Food', url: `https://www.timeout.com/newyork/restaurants/search?q=${encodeURIComponent(query)}` },
    ];

    if (isShowQuery) {
        // Movie/Theater queries - prioritize show sources
        console.log('[Web Search] Detected SHOW query (movies/theater) - using show sources');
        sources = showSources;
    } else if (isEventQuery && isFoodQuery) {
        // BOTH event and food - mix sources
        console.log('[Web Search] Detected MIXED query (event + food) - using both sources');
        sources = [eventSources[0], eventSources[1], foodSources[0], foodSources[1]];
    } else if (isEventQuery) {
        console.log('[Web Search] Detected EVENT query - using event sources');
        sources = eventSources;
    } else {
        // Default to food (most common)
        console.log('[Web Search] Detected FOOD query - using food sources');
        sources = foodSources;
    }

    // Determine query type for Gemini search
    let queryType = 'food';
    if (isShowQuery) queryType = 'show';
    else if (isEventQuery) queryType = 'event';

    let allResults = '';

    // FOR EVENTS: Hard scrape specific "This Week/Weekend" pages
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
                const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
                    },
                    body: JSON.stringify({
                        url: source.url,
                        formats: ['markdown'],
                    }),
                });
                const result = await response.json();
                if (result.success && result.data?.markdown) {
                    const content = result.data.markdown.slice(0, 4000);
                    console.log(`[Web Search] Got ${content.length} chars from ${source.name}`);
                    allResults += `\n--- ${source.name} ---\nSource URL: ${source.url}\n${content}\n`;
                }
            } catch (error) {
                console.error(`[Web Search] Error with ${source.name}:`, error.message);
            }
        }
    }

    // Use Gemini with Google Search grounding as a SUPPLEMENT
    const geminiResults = await callGeminiWithSearch(query, queryType);

    if (geminiResults) {
        allResults += `\n\n=== GENERAL WEB SEARCH RESULTS (Gemini) ===\n${geminiResults}`;
    }

    return allResults || "Could not find information from web sources.";
}

// ============= CHAT API (Gemini 2.5 Pro) =============

// Helper to extract JSON action from text
function extractAction(text) {
    // Match {"action": or { "action": or {\n"action":
    const match = text.match(/\{\s*"action":/);
    if (!match) return null;

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
            console.error("Failed to parse extracted JSON", e);
        }
    }
    return null;
}

// Helper to remove ALL JSON actions from text
function stripAllActions(text) {
    let currentText = text;
    let extracted;
    do {
        extracted = extractAction(currentText);
        if (extracted) {
            currentText = currentText.replace(extracted.match, '').trim();
        }
    } while (extracted);

    // Also remove markdown code block wrappers that might be left behind
    currentText = currentText.replace(/```json\s*```/g, '');
    currentText = currentText.replace(/```\s*```/g, '');
    currentText = currentText.replace(/```json\s*$/g, '');
    currentText = currentText.replace(/```\s*$/g, '');

    return currentText.trim();
}

// Helper to call Gemini
const callGemini = async (prompt) => {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
        }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// Helper to call Gemini WITH Google Search grounding
// Acts as a supplementary search for general info (Reddit API handles the main Reddit search)
const callGeminiWithSearch = async (query, queryType = 'food') => {
    console.log(`[Gemini Search] Query: "${query}" (type: ${queryType})`);

    // Simplified prompt - let Gemini handle the searching naturally
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
- Keep descriptions concise to save time.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: searchPrompt }] }],
                    tools: [{ google_search: {} }],
                    generationConfig: {
                        temperature: 0.3, // Lower temperature for faster, focused results
                        maxOutputTokens: 3000 // Limit output length
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

        // Format the results with ACTUAL sources from grounding metadata
        let result = text;
        if (groundingMetadata?.groundingChunks?.length > 0) {
            result += '\n\n=== VERIFIED SOURCES ===\n';
            groundingMetadata.groundingChunks.forEach((chunk, i) => {
                if (chunk.web) {
                    result += `[${i + 1}] ${chunk.web.title}: ${chunk.web.uri}\n`;
                }
            });
        }

        console.log(`[Gemini Search] Got ${result.length} chars with ${groundingMetadata?.groundingChunks?.length || 0} verified sources`);
        return result;
    } catch (error) {
        console.error(`[Gemini Search] Error:`, error.message);
        return `Gemini search failed: ${error.message}`;
    }
};

// Scrape Instagram/TikTok metadata (Lightweight with redirect support)
async function scrapeSocialMetadata(url) {
    console.log(`[Metadata Scraper] Fetching: ${url}`);
    try {
        // Follow redirects to get final URL
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            },
            redirect: 'follow'
        });

        // Log final URL after redirects
        const finalUrl = response.url;
        if (finalUrl !== url) {
            console.log(`[Metadata Scraper] Redirected to: ${finalUrl}`);
        }

        const html = await response.text();

        // Try multiple meta tag patterns
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
        // Fallback to Firecrawl for TikTok which may need JS rendering
        const firecrawlResult = await scrapeWithFirecrawl(finalUrl);
        if (firecrawlResult.success && firecrawlResult.data?.markdown) {
            // Take first 500 chars of content as description
            const content = firecrawlResult.data.markdown.substring(0, 500);
            console.log(`[Metadata Scraper] Firecrawl content: ${content.substring(0, 100)}...`);
            return content;
        }

    } catch (error) {
        console.error(`[Metadata Scraper] Error:`, error);
    }
    return null;
}

// Cleanup expired events
function cleanupExpiredEvents(db) {
    const now = new Date().toISOString().split('T')[0];
    const initialCount = db.places.length;
    db.places = db.places.filter(p => {
        if (p.isEvent && p.endDate && p.endDate < now) {
            console.log(`[Cleanup] Removing expired event: ${p.name} (Ended: ${p.endDate})`);
            return false;
        }
        return true;
    });
    if (db.places.length !== initialCount) {
        saveDB(db);
        console.log(`[Cleanup] Removed ${initialCount - db.places.length} expired events.`);
    }
}

// Helper to find and add a place (reused by addPlace and addMultiplePlaces)
// Now saves to Supabase instead of JSON
async function findAndAddPlace(db, placeName, location = 'New York, NY', extraData = {}, userId = null) {
    // Check if already exists in Supabase for this user
    if (userId) {
        const { data: existingPlaces } = await supabase
            .from('places')
            .select('*')
            .eq('user_id', userId)
            .ilike('name', `%${placeName}%`);

        if (existingPlaces && existingPlaces.length > 0) {
            return { added: false, message: 'Already on list', place: existingPlaces[0] };
        }
    }

    // Try Google Places API first (most reliable)
    let place = await searchGooglePlaces(placeName, location);

    // Fallback to scraping if API key not set or API failed
    if (!place) {
        console.log('[addPlace] Google Places API failed, trying Firecrawl scraping...');
        place = await searchGoogleMaps(placeName, location);
    }

    // If all lookups failed, create a basic entry with the info we have
    if (!place) {
        console.log(`[addPlace] All lookups failed for "${placeName}". Saving with basic info.`);
        place = {
            name: placeName,
            type: extraData.isEvent ? 'activity' : 'restaurant', // Default type
            address: location,
            description: '',
            sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(placeName + ' ' + location)}`,
            imageUrl: '',
        };
    }

    const newPlace = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        ...place,
        createdAt: new Date().toISOString(),
        isVisited: false,
        isFavorite: true,
        // Add event fields if present
        isEvent: extraData.isEvent || false,
        startDate: extraData.startDate || null,
        endDate: extraData.endDate || null,
    };

    // Save to Supabase if userId is provided
    if (userId) {
        const dbPlace = {
            id: newPlace.id,
            user_id: userId,
            name: newPlace.name,
            type: newPlace.type || 'restaurant',
            cuisine: newPlace.cuisine || null,
            address: newPlace.address || '',
            description: newPlace.description || null,
            image_url: newPlace.imageUrl || null,
            source_url: newPlace.sourceUrl || null,
            coordinates: newPlace.coordinates || null,
            is_visited: newPlace.isVisited || false,
            is_favorite: newPlace.isFavorite !== false,
            notes: newPlace.notes || null,
            review: newPlace.review || null,
            rating: newPlace.rating || null,
            start_date: newPlace.startDate || null,
            end_date: newPlace.endDate || null,
            is_event: newPlace.isEvent || false,
            created_at: newPlace.createdAt,
        };

        const { error } = await supabase
            .from('places')
            .insert(dbPlace);

        if (error) {
            console.error('[addPlace] Supabase error:', error);
            // Fallback to local JSON
            db.places.unshift(newPlace);
            saveDB(db);
        } else {
            console.log('[addPlace] Saved to Supabase:', newPlace.name);
        }
    } else {
        // Fallback to local JSON if no userId
        db.places.unshift(newPlace);
        saveDB(db);
    }

    return { added: true, place: newPlace };
}

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, userName, userPreferences, userId } = req.body;
        const db = getDB();
        const today = new Date().toISOString().split('T')[0];

        // Fetch user's places from Supabase
        let userPlaces = [];
        if (userId) {
            const { data, error } = await supabase
                .from('places')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                userPlaces = data.map(p => ({
                    name: p.name,
                    type: p.type,
                    cuisine: p.cuisine,
                    address: p.address,
                    description: p.description,
                    isVisited: p.is_visited,
                    isFavorite: p.is_favorite,
                    rating: p.rating,
                    createdAt: p.created_at,
                }));
            }
        }

        // Build places context with Date Added
        const placesContext = userPlaces.length > 0
            ? userPlaces.map(p => {
                const status = p.isVisited ? 'VISITED' : 'Not visited';
                const fav = p.isFavorite ? ', FAVORITED' : '';
                const rating = p.rating ? `, Rating: ${p.rating}/5` : '';
                const notes = p.description ? ` - ${p.description.slice(0, 50)}...` : '';
                const dateAdded = p.createdAt ? ` | Added on: ${p.createdAt.split('T')[0]}` : '';
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
- When researching events, include the current year (${new Date().getFullYear()}) in your search query.
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
{\"action\": \"findReservations\", \"restaurantName\": \"NAME\", \"partySize\": 2, \"date\": \"YYYY-MM-DD\"}

4. RESEARCH / PLAN (⚠️ REQUIRED BEFORE EXTERNAL RECOMMENDATIONS):
**You MUST use research before recommending ANY places not already on the user's saved list.**
This includes: restaurants, events, activities, anything external.

⚠️ CRITICAL: When you need to research, OUTPUT THE ACTION IMMEDIATELY in your response. Do NOT just say "let me search" without including the actual JSON action. Your response MUST contain the action like this:

Let me look that up for you! {"action": "research", "queries": ["things to do williamsburg brooklyn", "williamsburg activities", "title:williamsburg"]}

⚠️ QUERY GENERATION RULES:
Reddit supports boolean operators. Generate 2-3 query variations for better results:
1. Simple query: "indian food upper west side" (basic keywords)
2. Boolean AND with exact phrase: "indian AND \"upper west side\"" (forces both terms)
3. Title search: "title:indian manhattan" (searches only post titles)

⚠️ JSON SAFETY: If using double quotes INSIDE a query string, you MUST escape them (e.g. "term AND \"exact phrase\"").
Alternatively, use single quotes inside the query string (e.g. "term AND 'exact phrase'").

Other operators: OR, NOT, quotes for exact phrase

📅 FOR EVENTS/ACTIVITIES:
- ALWAYS include the current year (${new Date().getFullYear()}) in at least one query
- Include keywords like: "event", "show", "things to do", "happening", "market", etc.
- Examples: "holiday markets nyc december 2024", "things to do this weekend nyc", "title:concert december"

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
        let conversationText = messages.map(m =>
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
                console.log('Detected action:', action);

                // Support both 'queries' array (new) and 'query' string (backwards compat)
                if (action.action === 'research' && (action.queries || action.query)) {
                    // Get queries from LLM - limit to 2 to stay under Reddit's 10 req/min limit
                    const allQueries = action.queries || [action.query];
                    const queries = allQueries.slice(0, 2); // Max 2 queries to stay under rate limit

                    // STEP 1: Start BOTH Reddit and Web searches concurrently
                    console.log('========================================');
                    console.log('[Research] Starting PARALLEL Reddit and Web searches...');
                    console.log('[Research] QUERIES FROM LLM (limited to 2):', queries);
                    console.log('========================================');

                    // Start Web Search immediately (don't await yet)
                    const webSearchPromise = searchWeb(queries[0]);

                    // Start Reddit Search immediately
                    const redditSearchPromise = searchRedditMultiQuery(queries);

                    // Wait for Reddit results first to process them (we need to sort/filter before fetching comments)
                    const redditPosts = await redditSearchPromise;

                    // Log what threads were found
                    console.log('[Research] Reddit threads found:');
                    redditPosts.forEach((p, i) => console.log(`  ${i + 1}. "${p.title}" (${p.upvotes} upvotes)`));

                    let searchResults = '';

                    if (redditPosts.length > 0) {
                        searchResults += '=== REDDIT RESULTS (PRIORITIZE THESE - LOOK AT ALL COMMENTS FOR RECOMMENDATIONS) ===\n';

                        // IMPORTANT: Prioritize threads that actually contain search keywords in title
                        // Extract key search terms from all queries
                        const allQueryWords = queries.join(' ').toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['and', 'the', 'for', 'reddit'].includes(w));

                        // Score each post by relevance (title contains search terms)
                        const scoredPosts = redditPosts.map(post => {
                            const titleLower = post.title.toLowerCase();
                            let relevanceScore = 0;
                            for (const word of allQueryWords) {
                                if (titleLower.includes(word)) {
                                    relevanceScore += 10; // Big boost for title match
                                }
                            }
                            // Smaller boost for engagement
                            relevanceScore += Math.log(post.upvotes + post.numComments + 1);

                            // Boost recent threads (2024/2025)
                            if (post.title.includes('2024') || post.title.includes('2025')) {
                                relevanceScore += 5;
                            }

                            return { ...post, relevanceScore };
                        }).sort((a, b) => b.relevanceScore - a.relevanceScore);

                        console.log('[Research] Prioritized threads by relevance:');
                        scoredPosts.slice(0, 5).forEach((p, i) => console.log(`  ${i + 1}. [score=${p.relevanceScore.toFixed(1)}] "${p.title}"`));

                        // Fetch comments for top 5 most relevant threads IN PARALLEL (increased from 3)
                        const topPosts = scoredPosts.slice(0, 5);
                        const commentPromises = topPosts.map(async (post) => {
                            console.log(`[Research] Fetching comments from: ${post.title}`);
                            const comments = await getRedditComments(post.url);
                            let postResult = `\n--- THREAD: "${post.title}" (r/${post.subreddit}, ${post.upvotes} upvotes) ---\nURL: ${post.url}\n`;

                            if (comments.length > 0) {
                                postResult += `   \n   TOP COMMENTS (sorted by upvotes - extract place names from these!):\n`;
                                for (const comment of comments.slice(0, 12)) { // Increased from 8 to 12 comments
                                    postResult += `   💬 [${comment.upvotes} upvotes] u/${comment.author}: "${comment.text}"\n\n`;
                                }
                            }
                            return postResult;
                        });

                        const commentsResults = await Promise.all(commentPromises);
                        searchResults += commentsResults.join('');

                        // Also show other threads titles
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

                    // Re-prompt Gemini with research results - REQUIRE recommendPlaces action
                    const currentYear = new Date().getFullYear();
                    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

                    // Determine target Reddit percentage based on query type
                    const isFoodQuery = queries.some(q => /food|restaurant|eat|dinner|lunch|breakfast|brunch|cafe|bakery|bar|pizza|burger|sushi|steak|tacos|bagel|coffee|dessert|ice cream|pastry|croissant/i.test(q));
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
                        const { action: secondAction, match: secondMatch } = secondExtracted;
                        if (secondAction.action === 'recommendPlaces') {
                            // Enrich with images from Google Places API
                            const enrichedPlaces = await Promise.all(secondAction.places.map(async (p) => {
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
                else if (action.action === 'recommendPlaces') {
                    // Enrich recommendations with images from Google Places API
                    const enrichedPlaces = await Promise.all(action.places.map(async (p) => {
                        try {
                            // Use Google Places API for reliable images
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
                else if (action.action === 'addPlace' && action.placeName) {
                    const result = await findAndAddPlace(db, action.placeName, action.location, action, userId);
                    if (result.added) {
                        actionResult = { added: true, place: result.place };
                        console.log(`✅ Added place: ${result.place.name}`);
                    } else {
                        actionResult = { added: false, message: result.message };
                    }
                }
                else if (action.action === 'addMultiplePlaces' && action.places) {
                    const results = [];
                    for (const p of action.places) {
                        const result = await findAndAddPlace(db, p.name, p.location, p, userId);
                        results.push({
                            name: p.name,
                            status: result.added ? 'added' : 'skipped',
                            reason: result.message,
                            place: result.place
                        });
                    }
                    actionResult = { type: 'batch_add', results };
                }
                else if (action.action === 'findBookings') {
                    const bookings = [];
                    for (const place of action.places) {
                        const searchDate = place.date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
                        const partySize = place.partySize || 2;

                        const info = await findReservationOptions(place.name, 'New York, NY');
                        const platforms = info?.platforms || [];
                        const bookingLinks = {};

                        // Always add Google link
                        bookingLinks.google = `https://www.google.com/maps/search/${encodeURIComponent(place.name + ' New York, NY')}`;

                        if (place.type === 'tickets') {
                            // For tickets, try to find official site or generic ticket search
                            bookingLinks.website = `https://www.google.com/search?q=${encodeURIComponent(place.name + ' tickets')}`;
                        } else {
                            // Restaurant reservation links
                            if (platforms.some(p => p.toLowerCase().includes('opentable'))) bookingLinks.openTable = `https://www.opentable.com/s?dateTime=${searchDate}T19%3A00&covers=${partySize}&term=${encodeURIComponent(place.name)}`;
                            if (platforms.some(p => p.toLowerCase().includes('resy'))) bookingLinks.resy = `https://resy.com/cities/ny?date=${searchDate}&seats=${partySize}&query=${encodeURIComponent(place.name)}`;
                            if (platforms.some(p => p.toLowerCase().includes('yelp'))) bookingLinks.yelp = `https://www.yelp.com/search?find_desc=${encodeURIComponent(place.name)}&find_loc=New+York,+NY`;
                            if (platforms.some(p => p.toLowerCase().includes('tock'))) bookingLinks.tock = `https://www.exploretock.com/search?date=${searchDate}&size=${partySize}&query=${encodeURIComponent(place.name)}`;
                        }

                        bookings.push({
                            name: place.name,
                            type: place.type || 'reservation',
                            date: searchDate,
                            partySize,
                            bookingLinks
                        });
                    }

                    actionResult = {
                        type: 'bookings',
                        bookings
                    };
                }
                else if (action.action === 'findReservations') {

                }
                else if (action.action === 'scrapeUrl' && action.url) {
                    console.log(`Scraping URL: ${action.url}`);

                    const isSocialMedia = /instagram\.com|tiktok\.com/i.test(action.url);

                    if (isSocialMedia) {
                        // Try to get metadata from social media
                        const metadataDescription = await scrapeSocialMetadata(action.url);
                        if (metadataDescription) {
                            console.log(`[Scrape] Got metadata: ${metadataDescription.slice(0, 100)}...`);

                            // Ask Gemini to extract all places/events
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
                                    console.log(`[Scrape] Extracted items: ${extracted.places.map(p => p.name).join(', ')}`);
                                    const results = [];
                                    for (const item of extracted.places) {
                                        const result = await findAndAddPlace(db, item.name, item.location, item, userId);
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
                        // For non-social URLs, use Firecrawl to extract a single place (or multiple if we enhanced it)
                        // For now, keeping it simple or falling back to research
                        actionResult = { added: false, message: "I can currently only auto-add from Instagram/TikTok links. For others, try asking me to 'research this link'." };
                    }
                }

            } catch (e) {
                console.error('Error processing action:', e);
            }
        }

        // Clean ALL JSON actions from the final content before sending
        content = stripAllActions(content);

        res.json({ content, actionResult });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Spot API running on http://localhost:${PORT}`);
    console.log(`📁 Database: ${DB_PATH}`);
    console.log(`🤖 Using Gemini 2.5 Pro`);

    // Run cleanup on start
    const db = getDB();
    cleanupExpiredEvents(db);

    // Schedule cleanup every hour
    setInterval(() => {
        const db = getDB();
        cleanupExpiredEvents(db);
    }, 3600000);
});
