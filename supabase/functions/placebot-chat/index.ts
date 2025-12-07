import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Detect URLs in text
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Check if URL is from social media
function isSocialMediaUrl(url: string): boolean {
  return /instagram\.com|tiktok\.com/i.test(url);
}

// Build dynamic system prompt with saved places
function buildSystemPrompt(places: any[]): string {
  const placesList = places.length > 0
    ? places.map(p => {
      const status = p.is_visited ? 'VISITED' : 'Not visited yet';
      const fav = p.is_favorite ? ', FAVORITED' : '';
      const rating = p.rating ? `, Rating: ${p.rating}/5` : '';
      const notes = p.notes ? ` | Notes: "${p.notes}"` : '';
      const review = p.review ? ` | Review: "${p.review}"` : '';
      return `- ${p.name} (${p.cuisine || p.type}) at ${p.address} - ${status}${fav}${rating}${notes}${review}`;
    }).join('\n')
    : '- No places saved yet!';

  return `You are Spot, a friendly AI assistant that helps users track and discover places to visit in New York City.

YOUR CORE PURPOSE:
- Help users remember and find places they've saved
- Answer questions like "what was that Indian place I went to?" by searching their saved places
- When users share Instagram/TikTok URLs, ask for the place name so you can save it

SAVED PLACES DATABASE:
${placesList}

WHEN ANSWERING QUESTIONS ABOUT PLACES:
- If user asks about a specific cuisine (e.g., "Indian place"), search the list above for matching places
- If they mention "liked" or "favorited", look for places marked as FAVORITED
- If they mention "visited" or "went to", look for places marked as VISITED  
- Be specific - mention the place name, address, and any relevant details
- If multiple places match, list them all

WHEN USER SHARES A URL:
- If it's Instagram/TikTok: "I see that's from Instagram! What's the name of the place? I'll save it for you."
- If it's Yelp/Google: "Let me look that up for you..."

Keep responses conversational and helpful. Be enthusiastic about helping them explore NYC!`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch saved places from Supabase for context
    let places: any[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await supabase.from("places").select("*").order("created_at", { ascending: false });
      places = data || [];
    }

    const systemPrompt = buildSystemPrompt(places);

    // Check the last user message for URLs
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const urls = extractUrls(lastUserMessage);

    let additionalContext = "";
    if (urls.length > 0) {
      const url = urls[0];
      if (isSocialMediaUrl(url)) {
        additionalContext = "\n\n[System: User shared a social media URL. Ask for the place name.]";
      } else {
        additionalContext = "\n\n[System: User shared a scrapeable URL. Acknowledge you're looking it up.]";
      }
    }

    console.log("Processing chat with", messages.length, "messages,", places.length, "saved places");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + additionalContext },
          ...messages,
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that. Please try again.";

    // Check if we should trigger scraping (non-social URL detected)
    let scrapeResult = null;
    if (urls.length > 0 && !isSocialMediaUrl(urls[0])) {
      scrapeResult = { url: urls[0], shouldScrape: true };
    }

    return new Response(
      JSON.stringify({ content, scrapeResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in placebot-chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
