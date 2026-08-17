export type Character = {
  id: string;
  display_name: string;
  max_level: number;
  collection_name: string;
};

export type Token = {
  id: string;
  display_name: string;
  token_type: string;
};

export type LevelRequirement = {
  target_level: number;
  token_id: string;
  token_name: string;
  quantity: number;
};

export type CharacterLevel = {
  target_level: number;
  magic_cost: number | null;
  level_time_seconds: number | null;
};

export type CharacterProgressRow = {
  is_unlocked: number;
  current_level: number;
};

export type TokenInventoryRow = {
  token_id: string;
  quantity: number;
};

export type PlayerResourceRow = {
  resource_id: string;
  quantity: number;
};

export type TokenQuantities = Record<string, number>;

export type SaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";