// Persona Calculator - Determines user persona from their tag selections

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  spotComment: string; // What Spot says when revealing this persona
  tags: string[]; // Tags that contribute to this persona
}

export const PERSONAS: Persona[] = [
  {
    id: 'nightlife_explorer',
    name: 'Nightlife Explorer',
    emoji: '🌃',
    description: 'You live for the night. Concerts, clubs, rooftop bars — that\'s your scene.',
    spotComment: "Okay I see you — you're definitely a night owl. Concerts, clubs, late-night eats... I got you.",
    tags: ['club', 'dj', 'dancing', 'late_night', 'after_hours', 'high_energy', 'party', 'club_energy', 'loud', 'drinks_focused', 'cocktails', 'weekend_night', 'prime_time', 'nightlife', 'live_music', 'concerts', 'music'],
  },
  {
    id: 'culture_arts',
    name: 'Culture & Arts Lover',
    emoji: '🎨',
    description: 'Museums, galleries, theatre — you\'re all about that cultural immersion.',
    spotComment: "A cultured one! Museums, galleries, theatre... you appreciate the finer things. Love that for you.",
    tags: ['museum', 'cultural', 'institution', 'gallery', 'indie_art', 'theatre', 'broadway', 'performing_arts', 'art', 'talks', 'intellectual', 'learning', 'historic', 'landmark', 'architecture'],
  },
  {
    id: 'food_adventurer',
    name: 'Food-First Adventurer',
    emoji: '🍣',
    description: 'You\'ll travel anywhere for good food. New spots, pop-ups, food markets — you\'re there.',
    spotComment: "Food is your love language, clearly. New openings, hidden gems, street food... we're gonna get along great.",
    tags: ['street_food', 'cheap_eats', 'adventurous', 'trendy', 'upscale', 'variety_lover', 'open_minded', 'fine_dining', 'premium', 'special_occasion', 'splurge'],
  },
  {
    id: 'chill_local',
    name: 'Chill Local',
    emoji: '☕',
    description: 'Cozy cafés, quiet parks, easy neighborhood walks — you keep it chill.',
    spotComment: "You're giving low-key local vibes. Cozy cafés, chill walks, no rush. Honestly? Iconic energy.",
    tags: ['cafe', 'chill', 'coffee', 'casual', 'comfort', 'budget_friendly', 'brunch', 'weekend', 'park', 'garden', 'nature', 'outdoor', 'quiet', 'relaxed', 'peaceful', 'work_friendly', 'wanderer', 'spontaneous', 'no_plan', 'cafe_hopper', 'people_watching', 'relaxed'],
  },
  {
    id: 'family_planner',
    name: 'Family Planner',
    emoji: '👨‍👩‍👧‍👦',
    description: 'Planning for the crew? You need kid-friendly, daytime-friendly, everyone-friendly.',
    spotComment: "Family mode activated! I'll keep things kid-friendly, daytime, and stress-free. You got this.",
    tags: ['family_friendly', 'kid_friendly', 'daytime', 'family', 'kids', 'all_ages', 'weekend_day', 'markets', 'landmarks', 'tourist', 'iconic'],
  },
  {
    id: 'hidden_gems',
    name: 'Hidden Gems Hunter',
    emoji: '🕵️',
    description: 'You skip the tourist traps and find the spots only locals know about.',
    spotComment: "Ooh you're one of those 'I don't go where tourists go' types. Say less — I know all the secret spots.",
    tags: ['hidden_gems', 'local', 'off_beaten_path', 'indie', 'underground', 'experimental', 'quirky', 'immersive', 'interactive', 'unique', 'small_venue', 'cozy', 'intimate'],
  },
  {
    id: 'curious_learner',
    name: 'Curious Mind',
    emoji: '🧠',
    description: 'Talks, workshops, book events — you\'re always learning something new.',
    spotComment: "Big brain energy! You like talks, workshops, book stuff... I respect it. Let's find you some cool events.",
    tags: ['talks', 'intellectual', 'learning', 'museum', 'cultural', 'historic', 'landmark', 'architecture'],
  },
];

// Calculate persona scores from user tags
export function calculatePersonaScores(userTags: string[]): Map<string, number> {
  const scores = new Map<string, number>();
  
  for (const persona of PERSONAS) {
    let score = 0;
    for (const tag of userTags) {
      if (persona.tags.includes(tag)) {
        score++;
      }
    }
    scores.set(persona.id, score);
  }
  
  return scores;
}

// Get top personas (primary and secondary)
export function getTopPersonas(userTags: string[]): { primary: Persona; secondary: Persona | null } {
  const scores = calculatePersonaScores(userTags);
  
  // Sort personas by score
  const sortedPersonas = [...PERSONAS].sort((a, b) => {
    const scoreA = scores.get(a.id) || 0;
    const scoreB = scores.get(b.id) || 0;
    return scoreB - scoreA;
  });
  
  const primary = sortedPersonas[0];
  const secondaryScore = scores.get(sortedPersonas[1]?.id) || 0;
  
  // Only include secondary if it has at least 2 matching tags
  const secondary = secondaryScore >= 2 ? sortedPersonas[1] : null;
  
  return { primary, secondary };
}

// Get persona by ID
export function getPersonaById(id: string): Persona | undefined {
  return PERSONAS.find(p => p.id === id);
}

// Get recommendation guidance based on persona
export function getPersonaGuidance(personaId: string): string {
  const guidance: Record<string, string> = {
    nightlife_explorer: 'Prioritize concerts, club nights, late-night food spots, rooftop bars, high-energy venues',
    culture_arts: 'Prioritize exhibitions, theatre, book events, galleries, cultural districts, museums',
    food_adventurer: 'Prioritize new openings, pop-ups, food markets, trendy restaurants, hidden gems',
    chill_local: 'Prioritize brunch spots, cozy cafés, calm museums, easy neighborhood walks, parks',
    family_planner: 'Prioritize family-friendly events, kid-friendly spots, parks, daytime activities, accessible venues',
    hidden_gems: 'Prioritize offbeat events, small venues, unusual places, local favorites, non-touristy spots',
    curious_learner: 'Prioritize lectures, workshops, historic tours, educational exhibits, book events',
  };
  
  return guidance[personaId] || 'Use your best judgment based on their preferences';
}

// Format persona for display
export function formatPersonaDisplay(primary: Persona, secondary: Persona | null): string {
  if (secondary) {
    return `${primary.emoji} ${primary.name} + ${secondary.emoji} ${secondary.name}`;
  }
  return `${primary.emoji} ${primary.name}`;
}

