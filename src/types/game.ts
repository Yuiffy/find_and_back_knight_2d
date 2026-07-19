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
// 白、绿、蓝、紫、金、红六级品阶；红色只留给极少数顶级藏品。
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'relic';
export type CollectibleKind = 'food' | 'homeware' | 'electronics' | 'craft' | 'memory';

export interface ItemStats {
  attack?: number;
  range?: number;
  attackCooldown?: number;
  armor?: number;
  speedMultiplier?: number;
  dashEnabled?: boolean;
  dashMode?: 'normal' | 'shadow';
  headEffect?: 'kill-heal' | 'scout' | 'tonic-boost' | 'panic-haste';
  healAmount?: number;
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
  /** Only collectibles use this; it drives container loot tables and the display room. */
  collectibleKind?: CollectibleKind;
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

export interface RaidContainerState {
  drops: Array<ItemStack & { rotated?: boolean }>;
  revealed: boolean[];
}

export interface RaidRunState {
  backpack: GridItem[];
  loadout: Loadout;
  armorCondition: number;
  health: number;
  /** Remaining item stacks in the one active lost-corpse container, if this run opened it. */
  remainingLostEchoItems: ItemStack[] | null;
  mapUnlocked: boolean;
  shortcutUnlocked: boolean;
  bossDefeated: boolean;
  discoveredItems: string[];
  discoveredClues: string[];
  openedCrateIds: string[];
  containerStates?: Record<string, RaidContainerState>;
  defeatedEnemyIds: string[];
}

export interface RaidTransition {
  targetMapId: string;
  targetEntryId: string;
  runState: RaidRunState;
}

export interface PlayerProfile {
  version: 2;
  updatedAt: string;
  warehouseSize: GridSize;
  warehouse: GridItem[];
  backpack: BackpackInventory;
  loadout: Loadout;
  /** Equipment worn when the most recently started expedition began. */
  lastDeployedLoadout: Loadout | null;
  armorCondition: number;
  raidsStarted: number;
  successfulExtractions: number;
  deaths: number;
  /** Small-bird coins are the permanent currency earned from valuables. */
  credits: number;
  warehouseLevel: number;
  workshopLevel: number;
  /** Collectibles that were safely extracted and placed in the home display room. */
  collectionItems: string[];
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
  spawn?: { x: number; y: number };
  lastAttack?: {
    direction: 'left' | 'right' | 'up' | 'down';
    connected: boolean;
    bounced: boolean;
  } | null;
  dash?: {
    mode: 'normal' | 'shadow' | null;
    active: boolean;
    ready: boolean;
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
  visibleHazards?: Array<{ id: string; x: number; y: number; width: number }>;
  visibleEnemies?: Array<{
    id: string;
    kind: string;
    x: number;
    y: number;
    health: number;
    state?: 'patrol' | 'telegraph' | 'charge' | 'aim' | 'burst';
  }>;
  visibleLoot?: Array<{ id: string; itemId: string; x: number; y: number }>;
  outpost?: {
    spawn: { x: number; y: number } | null;
    targetExtraction: { x: number; y: number };
    scavengersAlive: number;
  };
  nearbyInteraction?: string | null;
  containerSearch?: {
    crateId: string;
    label: string;
    activeIndex: number;
    searching: boolean;
    revealed: Array<{ itemId: string | null; quantity?: number; rotated?: boolean; revealed: boolean; active: boolean }>;
  } | null;
  flags?: Record<string, boolean>;
}

export interface RaidResult {
  outcome: 'extracted' | 'died';
  mapId: string;
  entryId: string;
  backpack: GridItem[];
  loadout: Loadout;
  /** Remaining item stacks in the original corpse after this raid's looting. */
  remainingLostEchoItems: ItemStack[] | null;
  deathPosition?: { x: number; y: number };
  armorCondition: number;
  mapUnlocked: boolean;
  shortcutUnlocked: boolean;
  bossDefeated: boolean;
  discoveredItems?: string[];
  discoveredClues?: string[];
  endingTriggered?: boolean;
}
