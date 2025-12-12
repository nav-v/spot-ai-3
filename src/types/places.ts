import type { MainCategory } from '@/lib/placeCategories';

export interface Place {
  id: string;
  name: string;
  // Legacy type field - kept for backwards compatibility during migration
  type: 'restaurant' | 'activity' | 'cafe' | 'bar' | 'attraction';
  // New category system
  mainCategory: MainCategory;
  subtype: string;
  subtypes?: string[];
  // Legacy cuisine field - now migrated to subtype
  cuisine?: string;
  address: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
  instagramUrl?: string;
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
  isVisited: boolean;
  isFavorite: boolean;
  notes?: string;
  review?: string;
  rating?: number;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  isEvent?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  link?: string;
}

// Tab types for the main navigation
export type TabType = 'eat' | 'todo' | 'completed';

// Filter types - now based on subtypes within each category
export type FilterType = 'all' | string;
