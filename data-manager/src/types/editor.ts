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