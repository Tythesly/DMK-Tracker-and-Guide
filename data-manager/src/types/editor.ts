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

export type TokenRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "unknown";

export type TokenRecord = {
  id: string;
  displayName: string;
  tokenType: string;
  rarity: TokenRarity | null;

  associatedCharacterId:
    string | null;

  associatedCharacterName:
    string | null;

  associatedCollectionId:
    string | null;

  associatedCollectionName:
    string | null;

  sortOrder: number;
  isActive: boolean;
  notes: string;
};

export type TokenInput = {
  displayName: string;
  tokenType: string;
  rarity: TokenRarity | null;

  associatedCharacterId:
    string | null;

  associatedCollectionId:
    string | null;

  sortOrder: number;
  isActive: boolean;
  notes: string;
};

export type CharacterLevelTokenRequirementRecord = {
  tokenId: string;
  tokenName: string;
  tokenType: string;
  rarity: TokenRarity | null;
  quantity: number;
};

export type CharacterLevelRecord = {
  characterId: string;
  targetLevel: number;
  magicCost: number | null;
  levelTimeSeconds: number | null;

  requirements:
    CharacterLevelTokenRequirementRecord[];
};

export type CharacterLevelRequirementInput = {
  tokenId: string;
  quantity: number;
};

export type CharacterLevelInput = {
  characterId: string;
  targetLevel: number;
  magicCost: number | null;
  levelTimeSeconds: number | null;

  requirements:
    CharacterLevelRequirementInput[];
};