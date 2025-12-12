// Category definitions for filtering and AI classification

export const eatCategories = [
    // Cuisines
    { id: 'Pizza', label: 'Pizza', icon: 'Pizza' },
    { id: 'Indian', label: 'Indian', icon: 'Flame' },
    { id: 'Chinese', label: 'Chinese', icon: 'Soup' },
    { id: 'Italian', label: 'Italian', icon: 'UtensilsCrossed' },
    { id: 'American', label: 'American', icon: 'Beef' },
    { id: 'Japanese', label: 'Japanese', icon: 'Fish' },
    { id: 'Mexican', label: 'Mexican', icon: 'Flame' },
    { id: 'Thai', label: 'Thai', icon: 'Leaf' },
    { id: 'Korean', label: 'Korean', icon: 'Soup' },
    { id: 'Vietnamese', label: 'Vietnamese', icon: 'Soup' },
    { id: 'Mediterranean', label: 'Mediterranean', icon: 'Salad' },
    { id: 'Middle Eastern', label: 'Middle Eastern', icon: 'Flame' },
    { id: 'French', label: 'French', icon: 'Croissant' },
    { id: 'Greek', label: 'Greek', icon: 'Salad' },
    { id: 'Spanish', label: 'Spanish', icon: 'UtensilsCrossed' },
    { id: 'Seafood', label: 'Seafood', icon: 'Fish' },
    { id: 'Sushi', label: 'Sushi', icon: 'Fish' },
    { id: 'Ramen', label: 'Ramen', icon: 'Soup' },
    { id: 'BBQ', label: 'BBQ', icon: 'Flame' },
    { id: 'Burgers', label: 'Burgers', icon: 'Sandwich' },
    // Venue types
    { id: 'Dessert', label: 'Dessert', icon: 'IceCream' },
    { id: 'Coffee', label: 'Coffee', icon: 'Coffee' },
    { id: 'Bakery', label: 'Bakery', icon: 'Croissant' },
    { id: 'Bar', label: 'Bar', icon: 'Wine' },
    { id: 'Cocktails', label: 'Cocktails', icon: 'Martini' },
    { id: 'Wine Bar', label: 'Wine Bar', icon: 'Wine' },
    { id: 'Brunch', label: 'Brunch', icon: 'Egg' },
    { id: 'Deli', label: 'Deli', icon: 'Sandwich' },
    { id: 'Fast Casual', label: 'Fast Casual', icon: 'Zap' },
    { id: 'Fine Dining', label: 'Fine Dining', icon: 'Star' },
    { id: 'Food Truck', label: 'Food Truck', icon: 'Truck' },
    { id: 'Vegetarian', label: 'Vegetarian', icon: 'Carrot' },
    { id: 'Vegan', label: 'Vegan', icon: 'Leaf' },
    { id: 'Restaurant', label: 'Restaurant', icon: 'Utensils' },
    { id: 'Other', label: 'Other', icon: 'Utensils' },
];

export const seeCategories = [
    // Cultural
    { id: 'Museum', label: 'Museum', icon: 'Building' },
    { id: 'Gallery', label: 'Gallery', icon: 'Image' },
    { id: 'Theater', label: 'Theater', icon: 'Drama' },
    { id: 'Historic Site', label: 'Historic Site', icon: 'Clock' },
    { id: 'Landmark', label: 'Landmark', icon: 'Landmark' },
    // Nature & Outdoors
    { id: 'Park', label: 'Park', icon: 'Trees' },
    { id: 'Garden', label: 'Garden', icon: 'Flower' },
    { id: 'Beach', label: 'Beach', icon: 'Waves' },
    { id: 'Zoo', label: 'Zoo', icon: 'Dog' },
    { id: 'Aquarium', label: 'Aquarium', icon: 'Fish' },
    // Views & Lookouts
    { id: 'Rooftop', label: 'Rooftop', icon: 'Building' },
    { id: 'Observation Deck', label: 'Observation Deck', icon: 'Eye' },
    // Shopping & Markets
    { id: 'Shopping', label: 'Shopping', icon: 'ShoppingCart' },
    { id: 'Market', label: 'Market', icon: 'ShoppingBag' },
    // Entertainment
    { id: 'Entertainment', label: 'Entertainment', icon: 'Sparkles' },
    { id: 'Nightlife', label: 'Nightlife', icon: 'Moon' },
    // Tours & Activities
    { id: 'Walking Tour', label: 'Walking Tour', icon: 'Footprints' },
    { id: 'Neighborhood', label: 'Neighborhood', icon: 'Map' },
    { id: 'Library', label: 'Library', icon: 'BookOpen' },
    // Events (for places saved as events)
    { id: 'Concert', label: 'Concert', icon: 'Music' },
    { id: 'Festival', label: 'Festival', icon: 'PartyPopper' },
    { id: 'Pop-up', label: 'Pop-up', icon: 'Sparkles' },
    { id: 'Show', label: 'Show', icon: 'Drama' },
    { id: 'Exhibition', label: 'Exhibition', icon: 'Image' },
    { id: 'Comedy', label: 'Comedy', icon: 'Smile' },
    { id: 'Sports', label: 'Sports', icon: 'Trophy' },
    { id: 'Workshop', label: 'Workshop', icon: 'GraduationCap' },
    { id: 'Event', label: 'Event', icon: 'Calendar' },
    { id: 'Other', label: 'Other', icon: 'MapPin' },
];

// All categories combined for AI classification prompt
export const allCategoriesForAI = `
FOOD/DRINK CATEGORIES: ${eatCategories.map(c => c.id).join(', ')}
ACTIVITY/ATTRACTION CATEGORIES: ${seeCategories.map(c => c.id).join(', ')}
`;
