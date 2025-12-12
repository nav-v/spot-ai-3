// Place Category Constants
// Two-tier categorization: main_category (eat/see) and subtype

export type MainCategory = 'eat' | 'see';

// Eat subtypes - cuisine and food venue types
export const EAT_SUBTYPES = [
  'Pizza',
  'Indian',
  'Chinese',
  'Italian',
  'American',
  'Japanese',
  'Mexican',
  'Thai',
  'Korean',
  'Vietnamese',
  'Mediterranean',
  'Middle Eastern',
  'French',
  'Greek',
  'Spanish',
  'Seafood',
  'BBQ',
  'Burgers',
  'Sushi',
  'Ramen',
  'Dessert',
  'Coffee',
  'Bakery',
  'Bar',
  'Cocktails',
  'Wine Bar',
  'Brunch',
  'Deli',
  'Fast Casual',
  'Fine Dining',
  'Food Truck',
  'Vegetarian',
  'Vegan',
  'Other',
] as const;

// See subtypes - places and activities
export const SEE_SUBTYPES = [
  'Museum',
  'Park',
  'Historic Site',
  'Theater',
  'Gallery',
  'Landmark',
  'Shopping',
  'Entertainment',
  'Nightlife',
  'Rooftop',
  'Beach',
  'Garden',
  'Zoo',
  'Aquarium',
  'Observation Deck',
  'Walking Tour',
  'Neighborhood',
  'Market',
  'Library',
  'Other',
] as const;

// Event subtypes - time-limited activities (subset of See with isEvent=true)
export const EVENT_SUBTYPES = [
  'Concert',
  'Festival',
  'Pop-up',
  'Show',
  'Market',
  'Exhibition',
  'Comedy',
  'Sports',
  'Workshop',
  'Theater',
  'Dance',
  'Film',
  'Talk',
  'Party',
  'Other',
] as const;

export type EatSubtype = typeof EAT_SUBTYPES[number];
export type SeeSubtype = typeof SEE_SUBTYPES[number];
export type EventSubtype = typeof EVENT_SUBTYPES[number];

// Helper to get subtypes based on main category
export function getSubtypesForCategory(mainCategory: MainCategory, isEvent?: boolean): readonly string[] {
  if (mainCategory === 'eat') {
    return EAT_SUBTYPES;
  }
  // For See category, combine SEE_SUBTYPES with EVENT_SUBTYPES if showing events
  if (isEvent) {
    return EVENT_SUBTYPES;
  }
  return SEE_SUBTYPES;
}

// Helper to determine main category from legacy type
export function mainCategoryFromLegacyType(legacyType: string): MainCategory {
  const eatTypes = ['restaurant', 'cafe', 'bar'];
  return eatTypes.includes(legacyType.toLowerCase()) ? 'eat' : 'see';
}

// Helper to infer subtype from legacy data
export function subtypeFromLegacyData(legacyType: string, cuisine?: string): string {
  // If cuisine is set and valid, use it
  if (cuisine && cuisine.trim()) {
    return cuisine.trim();
  }
  
  // Map legacy types to subtypes
  const typeMap: Record<string, string> = {
    restaurant: 'Restaurant',
    cafe: 'Coffee',
    bar: 'Bar',
    attraction: 'Landmark',
    activity: 'Activity',
    museum: 'Museum',
    park: 'Park',
    theater: 'Theater',
    shopping: 'Shopping',
  };
  
  return typeMap[legacyType.toLowerCase()] || 'Other';
}

// Check if a subtype is valid for a category
export function isValidSubtype(mainCategory: MainCategory, subtype: string, isEvent?: boolean): boolean {
  const validSubtypes = getSubtypesForCategory(mainCategory, isEvent);
  // Allow custom subtypes (not in predefined list) - they're always valid
  return true; // User can type custom values
}

// Get display label for main category
export function getCategoryLabel(mainCategory: MainCategory): string {
  return mainCategory === 'eat' ? 'Eat' : 'See';
}

