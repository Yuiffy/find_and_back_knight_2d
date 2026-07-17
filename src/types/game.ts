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
  buyPrice?: number;
  sellPrice?: number;
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
  rotated?: boolean;
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
  entryId?: string;
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
  credits: number;
  discoveredItems: string[];
  discoveredClues: string[];
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
  mapId?: string;
  zoneId?: string | null;
  zoneReveal?: {
    candidateZoneId: string | null;
    candidateSince: number | null;
    revealedZoneIds: string[];
    lastRevealAt: number | null;
    visible: boolean;
  };
  render?: {
    logicalWidth: number;
    logicalHeight: number;
    backingWidth: number;
    backingHeight: number;
    renderScale: 1 | 1.5 | 2;
  };
  visibleStoryEchoes?: Array<{
    id: string;
    x: number;
    y: number;
    heard: boolean;
    pulsing: boolean;
  }>;
  backpack?: GridItem[];
  loadout?: Loadout;
  nearbyLoot?: Array<{ id: string; itemId: string; quantity: number; distance: number }>;
  nearbyTerrain?: Array<{ left: number; right: number; top: number; bottom: number }>;
  visibleEnemies?: Array<{
    id: string;
    kind: string;
    x: number;
    y: number;
    health: number;
    state?: 'patrol' | 'telegraph' | 'charge';
  }>;
  visibleLoot?: Array<{ id: string; itemId: string; x: number; y: number }>;
  nearbyInteraction?: string | null;
  flags?: Record<string, boolean>;
}

export interface RaidResult {
  outcome: 'extracted' | 'died';
  mapId: string;
  entryId: string;
  backpack: GridItem[];
  loadout: Loadout;
  recoveredItems: ItemStack[];
  deathPosition?: { x: number; y: number };
  armorCondition: number;
  mapUnlocked: boolean;
  shortcutUnlocked: boolean;
  bossDefeated: boolean;
  recoveredEcho: boolean;
  discoveredItems?: string[];
  discoveredClues?: string[];
  endingTriggered?: boolean;
}
