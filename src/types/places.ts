export interface Place {
  id: string;
  name: string;
  type: 'restaurant' | 'activity' | 'cafe' | 'bar' | 'attraction';
  cuisine?: string;
  address: string;
  description?: string;
  imageUrl?: string;
  instagramUrl?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
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

export type TabType = 'todo' | 'eat' | 'completed';
export type FilterType = 'all' | 'restaurant' | 'cafe' | 'bar' | 'activity' | 'attraction';
