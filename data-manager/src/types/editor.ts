export type CollectionRecord = {
  id: string;
  displayName: string;
  sortOrder: number;
  isLimitedTime: boolean;
  isActive: boolean;
  notes: string;
};

export type CollectionInput = {
  displayName: string;
  sortOrder: number;
  isLimitedTime: boolean;
  isActive: boolean;
  notes: string;
};

export type CharacterRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  displayName: string;
  maxLevel: number;
  sortOrder: number;
  isPremium: boolean;
  isLimitedTime: boolean;
  isActive: boolean;
  notes: string;
};

export type CharacterInput = {
  collectionId: string;
  displayName: string;
  sortOrder: number;
  isPremium: boolean;
  isLimitedTime: boolean;
  isActive: boolean;
  notes: string;
};