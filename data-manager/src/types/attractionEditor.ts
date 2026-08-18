export type AttractionGroupRecord = {
  id: string;
  displayName: string;
  collectionId: string | null;
  collectionName: string | null;
  sortOrder: number;
  isActive: boolean;
  notes: string;
};

export type AttractionRecord = {
  id: string;
  groupId: string;
  groupName: string;
  groupCollectionId: string | null;
  displayName: string;
  sortOrder: number;
  maxEnchantmentLevel: number;
  relicCollectionId: string | null;
  relicCollectionName: string | null;
  obtainSourceText: string;
  obtainMagicCost: number | null;
  obtainElixirCost: number | null;
  obtainGemCost: number | null;
  requirementType: string | null;
  unlockQuestSourceName: string;
  requiredCharacterId: string | null;
  requiredCharacterName: string | null;
  requiredCharacterCollectionName: string | null;
  requiredCharacterLevel: number | null;
  buildQuestSourceName: string;
  otherRequirementText: string;
  isActive: boolean;
  notes: string;
};

export type AttractionInput = {
  groupId: string;
  displayName: string;
  sortOrder: number;
  maxEnchantmentLevel: number;
  relicCollectionId: string | null;
  obtainSourceText: string;
  obtainMagicCost: number | null;
  obtainElixirCost: number | null;
  obtainGemCost: number | null;
  requirementType: string | null;
  unlockQuestSourceName: string;
  requiredCharacterId: string | null;
  requiredCharacterLevel: number | null;
  buildQuestSourceName: string;
  otherRequirementText: string;
  isActive: boolean;
  notes: string;
};

export type AttractionEnchantmentDefaultRecord = {
  targetLevel: number;
  blueprintRarity: string;
  blueprintQuantity: number;
  relicQuantity: number;
  magicCost: number;
  levelTimeSeconds: number;
  notes: string;
};