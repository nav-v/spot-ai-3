// Onboarding Schema - All questions in Spot's voice
// Each option maps to tags used by the recommendation engine

export interface OnboardingOption {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

export interface OnboardingQuestion {
  id: string;
  category: 'food' | 'events' | 'places';
  question: string;
  subtext?: string;
  maxPicks: number;
  options: OnboardingOption[];
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  // ============ FOOD QUESTIONS (3) ============
  {
    id: 'food_outing_type',
    category: 'food',
    question: "When you're going out for food, what's the vibe?",
    subtext: "Pick up to 3 that feel like you",
    maxPicks: 3,
    options: [
      { id: 'brunch_spots', emoji: '🥞', label: 'Cozy brunch spots', tags: ['brunch', 'weekend', 'casual'] },
      { id: 'cafes', emoji: '☕', label: 'Cute cafés to sit & hang', tags: ['cafe', 'chill', 'coffee'] },
      { id: 'comfort_food', emoji: '🍕', label: 'Casual comfort food (pizza, burgers, wings)', tags: ['casual', 'comfort', 'budget_friendly'] },
      { id: 'trendy', emoji: '🍣', label: 'Trendy spots (sushi bars, small plates)', tags: ['trendy', 'upscale', 'date_spot'] },
      { id: 'street_food', emoji: '🌯', label: 'Street food & food trucks', tags: ['street_food', 'cheap_eats', 'adventurous'] },
      { id: 'wine_bars', emoji: '🍷', label: 'Wine bars & cocktails with bites', tags: ['drinks_focused', 'date_spot', 'upscale'] },
      { id: 'healthy', emoji: '🥗', label: 'Healthy-ish bowls & salads', tags: ['healthy', 'light', 'quick'] },
      { id: 'desserts', emoji: '🍰', label: 'Dessert cafés & bakeries', tags: ['bakery', 'dessert', 'sweet_tooth'] },
      { id: 'fine_dining', emoji: '🍽️', label: 'Fancy tasting menus for special nights', tags: ['fine_dining', 'premium', 'special_occasion'] },
    ],
  },
  {
    id: 'food_cuisines',
    category: 'food',
    question: "If I only showed you food you actually love, what would that look like?",
    subtext: "Pick your top 3 (or just vibe with everything)",
    maxPicks: 3,
    options: [
      { id: 'italian', emoji: '🍝', label: 'Italian (pasta, pizza, aperitivo vibes)', tags: ['italian', 'pasta', 'pizza'] },
      { id: 'american', emoji: '🍔', label: 'American comfort (burgers, BBQ, diners)', tags: ['american', 'burgers', 'bbq'] },
      { id: 'japanese', emoji: '🍣', label: 'Japanese (sushi, ramen, izakaya)', tags: ['japanese', 'sushi', 'ramen'] },
      { id: 'chinese', emoji: '🥟', label: 'Chinese (dumplings, noodles, regional)', tags: ['chinese', 'dumplings', 'noodles'] },
      { id: 'mexican', emoji: '🌮', label: 'Mexican & Latin (tacos, arepas, ceviche)', tags: ['mexican', 'tacos', 'latin'] },
      { id: 'indian', emoji: '🥘', label: 'Indian & South Asian', tags: ['indian', 'south_asian', 'curry'] },
      { id: 'middle_eastern', emoji: '🧆', label: 'Middle Eastern & Mediterranean', tags: ['middle_eastern', 'mediterranean', 'falafel'] },
      { id: 'plant_based', emoji: '🥗', label: 'Plant-based / vegetarian-first', tags: ['vegetarian', 'vegan_friendly', 'plant_based'] },
      { id: 'bakeries', emoji: '🍞', label: 'Bakeries, pastries, croissants', tags: ['bakery', 'pastry', 'breakfast'] },
      { id: 'variety', emoji: '🍜', label: 'Honestly, a bit of everything', tags: ['variety_lover', 'adventurous', 'open_minded'] },
    ],
  },
  {
    id: 'food_rules',
    category: 'food',
    question: "Any food rules I should know about?",
    subtext: "So I don't recommend the wrong stuff",
    maxPicks: 3,
    options: [
      { id: 'vegetarian', emoji: '🌱', label: 'Vegetarian', tags: ['dietary:vegetarian'] },
      { id: 'vegan', emoji: '🌿', label: 'Vegan', tags: ['dietary:vegan'] },
      { id: 'no_pork', emoji: '🚫', label: 'No pork', tags: ['dietary:no_pork'] },
      { id: 'halal', emoji: '✓', label: 'Halal only', tags: ['dietary:halal'] },
      { id: 'gluten_free', emoji: '🌾', label: 'Gluten-free', tags: ['dietary:gluten_free'] },
      { id: 'dairy_free', emoji: '🥛', label: 'Dairy-free / lactose-free', tags: ['dietary:dairy_free'] },
      { id: 'spicy_lover', emoji: '🔥', label: 'I love spicy food', tags: ['spicy_lover'] },
      { id: 'mild_only', emoji: '❄️', label: 'Keep it mild please', tags: ['spice_avoid'] },
      { id: 'cheap_eats', emoji: '💸', label: 'Prefer cheap eats most of the time', tags: ['cheap_eats', 'budget'] },
      { id: 'premium', emoji: '💳', label: 'Happy to pay more for great food', tags: ['premium', 'splurge'] },
      { id: 'drinks_matter', emoji: '🍹', label: 'Drinks matter (cocktails, wine, etc.)', tags: ['drinks_focused', 'cocktails'] },
    ],
  },

  // ============ EVENTS QUESTIONS (3) ============
  {
    id: 'event_types',
    category: 'events',
    question: "When you think 'I wanna go to something' — what do you mean?",
    subtext: "Pick up to 3",
    maxPicks: 3,
    options: [
      { id: 'live_music', emoji: '🎵', label: 'Live music: small gigs, concerts', tags: ['live_music', 'concerts', 'music'] },
      { id: 'clubs', emoji: '🎧', label: 'Clubs / DJs / dance nights', tags: ['club', 'dj', 'dancing'] },
      { id: 'theatre', emoji: '🎭', label: 'Theatre, plays, musicals', tags: ['theatre', 'broadway', 'performing_arts'] },
      { id: 'comedy', emoji: '😂', label: 'Stand-up comedy, improv', tags: ['comedy', 'standup', 'improv'] },
      { id: 'art_shows', emoji: '🎨', label: 'Art shows, gallery openings', tags: ['art', 'gallery', 'cultural'] },
      { id: 'talks', emoji: '🎓', label: 'Talks, panels, book events', tags: ['talks', 'intellectual', 'learning'] },
      { id: 'festivals', emoji: '🎪', label: 'Festivals & big outdoor events', tags: ['festival', 'outdoor', 'big_event'] },
      { id: 'sports', emoji: '🏟️', label: 'Sports games / watch parties', tags: ['sports', 'games', 'watch_party'] },
      { id: 'social', emoji: '🧑‍🤝‍🧑', label: 'Social meetups, mixers', tags: ['social', 'meetup', 'networking'] },
    ],
  },
  {
    id: 'event_energy',
    category: 'events',
    question: "What kind of energy do you like at events?",
    subtext: "Be honest — no judgment here",
    maxPicks: 3,
    options: [
      { id: 'chill', emoji: '🕯️', label: 'Super chill, seated, low noise', tags: ['chill', 'quiet', 'relaxed'] },
      { id: 'intimate', emoji: '🛋️', label: 'Intimate & cozy (small venues)', tags: ['intimate', 'small_venue', 'cozy'] },
      { id: 'lively', emoji: '😊', label: 'Lively but not overwhelming', tags: ['lively', 'moderate_energy'] },
      { id: 'high_energy', emoji: '🎉', label: 'Big buzz, crowds, high energy', tags: ['high_energy', 'crowded', 'buzzy'] },
      { id: 'party', emoji: '🔊', label: 'Full-on party / club energy', tags: ['party', 'club_energy', 'loud'] },
      { id: 'family', emoji: '👨‍👩‍👧‍👦', label: 'Family-friendly vibes', tags: ['family_friendly', 'kid_friendly', 'daytime'] },
      { id: 'indie', emoji: '🎨', label: 'Indie / underground, experimental', tags: ['indie', 'underground', 'experimental'] },
    ],
  },
  {
    id: 'event_timing',
    category: 'events',
    question: "When & how do you actually go out?",
    subtext: "Real life, not aspirational",
    maxPicks: 3,
    options: [
      { id: 'weekend_day', emoji: '🌞', label: 'Weekend daytime (markets, fairs)', tags: ['weekend_day', 'daytime', 'markets'] },
      { id: 'weeknight', emoji: '🌅', label: 'Weeknight evenings (after work)', tags: ['weeknight', 'after_work', 'evening'] },
      { id: 'weekend_night', emoji: '🌙', label: 'Weekend nights (8pm–1am)', tags: ['weekend_night', 'prime_time', 'nightlife'] },
      { id: 'late_night', emoji: '🌃', label: 'Late-night (after midnight)', tags: ['late_night', 'after_hours'] },
      { id: 'solo', emoji: '🧍', label: "Happy going solo", tags: ['solo_friendly', 'independent'] },
      { id: 'date', emoji: '❤️', label: 'Usually a date / one other person', tags: ['date_night', 'romantic', 'couples'] },
      { id: 'friends', emoji: '🧑‍🤝‍🧑', label: 'Small friend group', tags: ['group_friendly', 'friends', 'social'] },
      { id: 'family_with', emoji: '👨‍👩‍👧‍👦', label: 'Mostly family / with kids', tags: ['family', 'kids', 'all_ages'] },
    ],
  },

  // ============ PLACES QUESTIONS (2) ============
  {
    id: 'place_types',
    category: 'places',
    question: "What kind of places should I surface for you?",
    subtext: "Think: 'I have a free afternoon, show me...'",
    maxPicks: 3,
    options: [
      { id: 'museums', emoji: '🖼️', label: 'Museums & big cultural institutions', tags: ['museum', 'cultural', 'institution'] },
      { id: 'galleries', emoji: '🧑‍🎨', label: 'Small galleries, indie art spaces', tags: ['gallery', 'indie_art', 'small_venue'] },
      { id: 'historic', emoji: '🏛️', label: 'Historical sites & landmarks', tags: ['historic', 'landmark', 'architecture'] },
      { id: 'viewpoints', emoji: '📸', label: 'Scenic viewpoints, rooftops, city views', tags: ['viewpoint', 'rooftop', 'scenic', 'photo_spot'] },
      { id: 'parks', emoji: '🌳', label: 'Parks, gardens, nice walking areas', tags: ['park', 'garden', 'nature', 'outdoor'] },
      { id: 'shopping', emoji: '🛍️', label: 'Cool streets, bookstores, record shops', tags: ['shopping', 'bookstore', 'browse', 'street'] },
      { id: 'quirky', emoji: '🧪', label: 'Quirky / immersive (VR, escape rooms)', tags: ['quirky', 'immersive', 'interactive', 'unique'] },
      { id: 'quiet', emoji: '🧘', label: 'Quiet places to read, think, or work', tags: ['quiet', 'peaceful', 'work_friendly'] },
    ],
  },
  {
    id: 'explore_style',
    category: 'places',
    question: "How do you like exploring a new neighborhood?",
    subtext: "There's no wrong answer here",
    maxPicks: 3,
    options: [
      { id: 'landmarks', emoji: '🗺️', label: "Hit the 'must-see' landmarks first", tags: ['landmarks', 'tourist', 'iconic'] },
      { id: 'wander', emoji: '🚶', label: 'Just walk with no plan and see what happens', tags: ['wanderer', 'spontaneous', 'no_plan'] },
      { id: 'hidden_gems', emoji: '🧭', label: 'Find hidden gems & local-only spots', tags: ['hidden_gems', 'local', 'off_beaten_path'] },
      { id: 'cafe_hop', emoji: '☕', label: 'Hop between cafés & people-watch', tags: ['cafe_hopper', 'people_watching', 'relaxed'] },
      { id: 'photo_spots', emoji: '📷', label: 'Walkable photo spots / street art', tags: ['photo_spots', 'street_art', 'aesthetic'] },
      { id: 'nature_walks', emoji: '🌿', label: 'Nature-y walks (rivers, greenery)', tags: ['nature', 'waterfront', 'greenery', 'walks'] },
      { id: 'compact', emoji: '🔁', label: 'Compact areas, minimal walking', tags: ['compact', 'low_mobility', 'accessible'] },
    ],
  },
];

// Splash screen content
export const SPLASH_CONTENT = {
  greeting: "Hey! I'm Spot ✨",
  intro: [
    "I'm basically that friend who always knows a place.",
    "But first, I need to get to know you a little.",
    "",
    "8 quick questions. Pick what vibes with you.",
    "Let's go?"
  ],
  ctaStart: "Let's do it",
  ctaSkip: "Maybe later",
};

// Helper to get all tags from selected options
export function getTagsFromSelections(
  selections: Record<string, string[]>
): string[] {
  const allTags: string[] = [];
  
  for (const question of ONBOARDING_QUESTIONS) {
    const selectedIds = selections[question.id] || [];
    for (const optionId of selectedIds) {
      const option = question.options.find(o => o.id === optionId);
      if (option) {
        allTags.push(...option.tags);
      }
    }
  }
  
  return [...new Set(allTags)]; // Remove duplicates
}

// Helper to get dietary tags (for hard filtering)
export function getDietaryTags(tags: string[]): string[] {
  return tags.filter(t => t.startsWith('dietary:'));
}

// Helper to get non-dietary tags
export function getPreferenceTags(tags: string[]): string[] {
  return tags.filter(t => !t.startsWith('dietary:'));
}

