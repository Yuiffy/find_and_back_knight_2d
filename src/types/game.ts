export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'head'
  | 'shoes'
  | 'backpack'
  | 'material'
  | 'collectible'
  | 'consumable';

export type GearSlot = 'weapon' | 'armor' | 'head' | 'shoes' | 'backpack';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'relic';

export interface ItemStats {
  attack?: number;
  range?: number;
  attackCooldown?: number;
  armor?: number;
  speedMultiplier?: number;
  dashEnabled?: boolean;
  gridWidth?: number;
  gridHeight?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  icon: string;
  category: ItemCategory;
  rarity: Rarity;
  description: string;
  stackLimit: number;
  size: { width: number; height: number };
  stats?: ItemStats;
}

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export interface GridItem extends ItemStack {
  uid: string;
  x: number;
  y: number;
}

export interface GridSize {
  width: number;
  height: number;
}

export interface BackpackInventory extends GridSize {
  items: GridItem[];
}

export type Loadout = Record<GearSlot, string | null>;

export interface LostEcho {
  mapId: string;
  x: number;
  y: number;
  items: ItemStack[];
  createdAtRaid: number;
}

export interface ActiveRaid {
  raidId: number;
  mapId: string;
  startedAt: string;
  backpack: GridItem[];
  entryId?: 'foyer' | 'lift';
}

export interface PlayerProfile {
  version: 2;
  updatedAt: string;
  warehouseSize: GridSize;
  warehouse: GridItem[];
  backpack: BackpackInventory;
  loadout: Loadout;
  armorCondition: number;
  raidsStarted: number;
  successfulExtractions: number;
  deaths: number;
  mapUnlocked: boolean;
  shortcutUnlocked: boolean;
  bossDefeated: boolean;
  endingUnlocked: boolean;
  endingSeen: boolean;
  lostEcho: LostEcho | null;
  activeRaid: ActiveRaid | null;
}

export interface TextGameState {
  mode: 'base' | 'raid' | 'ending';
  coordinateSystem?: string;
  objective: string;
  player?: {
    x: number;
    y: number;
    collisionX?: number;
    collisionY?: number;
    velocityX: number;
    velocityY: number;
    health: number;
    maxHealth: number;
    armor: number;
    maxArmor: number;
    bodyWidth: number;
    bodyHeight: number;
    facing: 'left' | 'right';
    grounded: boolean;
  };
  zone?: string;
  backpack?: GridItem[];
  loadout?: Loadout;
  nearbyLoot?: Array<{ id: string; itemId: string; quantity: number; distance: number }>;
  nearbyTerrain?: Array<{ left: number; right: number; top: number; bottom: number }>;
  visibleEnemies?: Array<{ id: string; kind: string; x: number; y: number; health: number }>;
  visibleLoot?: Array<{ id: string; itemId: string; x: number; y: number }>;
  nearbyInteraction?: string | null;
  flags?: Record<string, boolean>;
}

export interface RaidResult {
  outcome: 'extracted' | 'died';
  backpack: GridItem[];
  loadout: Loadout;
  recoveredItems: ItemStack[];
  deathPosition?: { x: number; y: number };
  armorCondition: number;
  mapUnlocked: boolean;
  shortcutUnlocked: boolean;
  bossDefeated: boolean;
  recoveredEcho: boolean;
}
