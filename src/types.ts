export interface Animal {
  id: string; // Document ID
  earTag: string;
  name?: string;
  species: string;
  gender?: string;
  dateOfBirth: string;
  breed?: string;
  healthStatus: string;
  motherId?: string;
  fatherId?: string;
  photoUrl?: string;
  userId: string;
  currentWeight?: number;
  lastLocation?: { lat: number; lng: number };
  gpsTagId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Geozone {
  id: string;
  name: string;
  type: 'polygon' | 'circle';
  bounds: { lat: number; lng: number }[]; // For polygons
  center?: { lat: number; lng: number }; // For circles
  radius?: number; // In meters, for circles
  userId: string;
  createdAt: number;
}

export interface Treatment {
  id: string; // Document ID
  date: string;
  type: string; // 'vaccine', 'medication', 'checkup'
  description: string;
  medicine?: string;
  nextDueDate?: string;
  userId: string;
  createdAt: number;
}

export interface WeightRecord {
  id: string; // Document ID
  date: string;
  weight: number;
  userId: string;
  createdAt: number;
}

export interface FeedStock {
  id: string;
  name: string;
  quantity: number;
  threshold: number;
  unit: string;
  userId: string;
  createdAt: number;
}

export interface FeedTransaction {
  id: string;
  feedId: string;
  date: string;
  type: 'purchase' | 'consumption';
  amount: number;
  notes?: string;
  relatedEntityId?: string; // group or animal
  userId: string;
  createdAt: number;
}

export interface MilkRecord {
  id: string;
  animalId: string;
  date: string;
  yieldAmount: number;
  userId: string;
  createdAt: number;
}

export interface CustomAlert {
  id: string;
  date: string;
  title: string;
  message: string;
  type: 'vaccine' | 'birth' | 'estrus' | 'other' | 'feed';
  animalId?: string;
  isRead: boolean;
  userId: string;
  createdAt: number;
}
