import {
  addStacks,
  cloneGridItems,
  cloneStacks,
  gridItemsToStacks,
  insertGridStacks,
  validateGrid,
} from '../game/inventory';
import { MAP_REGISTRY, normalizeMapEntry } from '../game/maps';
import { getArmorMaximum, ITEMS } from '../game/items';
import type {
  ActiveRaid,
  BackpackInventory,
  GridItem,
  GridSize,
  ItemStack,
  GearSlot,
  Loadout,
  PlayerProfile,
} from '../types/game';

const SAVE_KEY = 'sui-echoes-below.save.v1';
const LEGACY_ITEM_IDS: Record<string, string> = {
  survey_lens: 'blue_hood',
};

function canonicalItemId(itemId: unknown): string | null {
  if (typeof itemId !== 'string') return null;
  const canonical = LEGACY_ITEM_IDS[itemId] ?? itemId;
  return ITEMS[canonical] ? canonical : null;
}

function canonicalGearItem(itemId: unknown, slot: GearSlot): string | null {
  const canonical = canonicalItemId(itemId);
  return canonical && ITEMS[canonical].category === slot ? canonical : null;
}

export const EMPTY_DEATH_LOADOUT: Loadout = {
  weapon: null,
  armor: null,
  head: null,
  shoes: null,
  backpack: null,
};

function normalizeLoadout(raw: Partial<Loadout> | null | undefined): Loadout | null {
  if (!raw || typeof raw !== 'object') return null;
  const loadout: Loadout = {
    weapon: canonicalGearItem(raw.weapon, 'weapon'),
    armor: canonicalGearItem(raw.armor, 'armor'),
    head: canonicalGearItem(raw.head, 'head'),
    shoes: canonicalGearItem(raw.shoes, 'shoes'),
    backpack: canonicalGearItem(raw.backpack, 'backpack'),
  };
  return Object.values(loadout).some(Boolean) ? loadout : null;
}

function canonicalizeStacks(raw: readonly ItemStack[]): ItemStack[] {
  return raw.flatMap((stack) => {
    const itemId = canonicalItemId(stack.itemId);
    return itemId ? [{ ...stack, itemId }] : [];
  });
}

interface LegacyProfile {
  version?: number;
  updatedAt?: string;
  stashCapacity?: number;
  backpackCapacity?: number;
  stash?: ItemStack[];
  loadout?: Partial<Loadout>;
  lastDeployedLoadout?: Partial<Loadout> | null;
  armorCondition?: number;
  raidsStarted?: number;
  successfulExtractions?: number;
  deaths?: number;
  mapUnlocked?: boolean;
  shortcutUnlocked?: boolean;
  bossDefeated?: boolean;
  endingUnlocked?: boolean;
  endingSeen?: boolean;
  lostEcho?: PlayerProfile['lostEcho'];
  activeRaid?: Omit<ActiveRaid, 'backpack'> & { backpack?: ItemStack[] | GridItem[] };
}

function now(): string {
  return new Date().toISOString();
}

function getPackSize(loadout: Loadout): GridSize {
  const pack = loadout.backpack ? ITEMS[loadout.backpack] : null;
  return {
    width: pack?.stats?.gridWidth ?? 0,
    height: pack?.stats?.gridHeight ?? 0,
  };
}

function packStacks(stacks: readonly ItemStack[], size: GridSize): GridItem[] {
  return insertGridStacks([], size, stacks) ?? [];
}

function normalizeGrid(raw: unknown, size: GridSize): GridItem[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.filter((entry): entry is GridItem => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Partial<GridItem>;
    return typeof candidate.uid === 'string'
      && typeof candidate.itemId === 'string'
      && Boolean(canonicalItemId(candidate.itemId))
      && Number.isFinite(candidate.quantity)
      && Number.isFinite(candidate.x)
      && Number.isFinite(candidate.y);
  }).map((item) => {
    const itemId = canonicalItemId(item.itemId)!;
    return {
      ...item,
      itemId,
      quantity: Math.min(ITEMS[itemId].stackLimit, Math.max(1, Math.floor(item.quantity))),
      x: Math.max(0, Math.floor(item.x)),
      y: Math.max(0, Math.floor(item.y)),
      rotated: Boolean(item.rotated),
    };
  });
  if (validateGrid(items, size)) return cloneGridItems(items);
  return packStacks(gridItemsToStacks(items), size);
}

export function createDefaultProfile(): PlayerProfile {
  const warehouseSize = { width: 9, height: 10 };
  const loadout: Loadout = {
    weapon: 'rust_nail',
    armor: 'stream_shell',
    head: 'red_hood',
    shoes: 'soft_boots',
    backpack: 'field_pack',
  };
  return {
    version: 2,
    updatedAt: now(),
    warehouseSize,
    warehouse: packStacks([
      { itemId: 'echo_dust', quantity: 2 },
      { itemId: 'repair_patch', quantity: 1 },
      { itemId: 'echo_tonic', quantity: 1 },
    ], warehouseSize),
    loadout,
    lastDeployedLoadout: null,
    backpack: { ...getPackSize(loadout), items: [] },
    armorCondition: 2,
    raidsStarted: 0,
    successfulExtractions: 0,
    deaths: 0,
    credits: 45,
    warehouseLevel: 1,
    workshopLevel: 1,
    collectionItems: [],
    discoveredItems: ['rust_nail', 'stream_shell', 'red_hood', 'soft_boots', 'field_pack', 'echo_dust', 'repair_patch', 'echo_tonic'],
    discoveredClues: ['arrival'],
    mapUnlocked: false,
    shortcutUnlocked: false,
    bossDefeated: false,
    endingUnlocked: false,
    endingSeen: false,
    lostEcho: null,
    activeRaid: null,
  };
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') throw new Error('存档内容不是有效对象');
  const candidate = value as LegacyProfile & Partial<PlayerProfile>;
  if (!candidate.loadout) throw new Error('存档版本不受支持');

  const defaults = createDefaultProfile();
  const isLegacy = candidate.version !== 2;
  const loadout: Loadout = {
    weapon: candidate.loadout.weapon === null
      ? null
      : (canonicalGearItem(candidate.loadout.weapon, 'weapon') ?? (isLegacy ? defaults.loadout.weapon : null)),
    armor: candidate.loadout.armor === null ? null : canonicalGearItem(candidate.loadout.armor, 'armor'),
    head: candidate.loadout.head === null ? null : canonicalGearItem(candidate.loadout.head, 'head'),
    shoes: candidate.loadout.shoes === null
      ? null
      : (canonicalGearItem(candidate.loadout.shoes, 'shoes') ?? (isLegacy ? defaults.loadout.shoes : null)),
    backpack: candidate.loadout.backpack === null
      ? null
      : (canonicalGearItem(candidate.loadout.backpack, 'backpack') ?? (isLegacy ? 'field_pack' : null)),
  };
  const warehouseSize = candidate.version === 2 && candidate.warehouseSize
    ? {
      width: Math.max(9, Math.min(12, Math.floor(candidate.warehouseSize.width))),
      height: Math.max(10, Math.min(14, Math.floor(candidate.warehouseSize.height))),
    }
    : { width: candidate.stashCapacity && candidate.stashCapacity >= 16 ? 10 : 9, height: 10 };

  const warehouse = candidate.version === 2
    ? normalizeGrid(candidate.warehouse, warehouseSize)
    : packStacks(canonicalizeStacks(candidate.stash ?? []), warehouseSize);
  const packSize = getPackSize(loadout);
  const backpackItems = candidate.version === 2
    ? normalizeGrid(candidate.backpack?.items, packSize)
    : [];

  const rawLostEcho = candidate.lostEcho;
  const lostEchoMap = rawLostEcho && typeof rawLostEcho.mapId === 'string'
    ? MAP_REGISTRY[rawLostEcho.mapId]
    : null;
  const hasValidLostEchoPosition = Boolean(rawLostEcho && lostEchoMap
    && Number.isFinite(rawLostEcho.x)
    && Number.isFinite(rawLostEcho.y)
    && rawLostEcho.x >= 0
    && rawLostEcho.x <= lostEchoMap.worldWidth
    && rawLostEcho.y >= 0
    && rawLostEcho.y <= lostEchoMap.worldHeight);

  const normalized: PlayerProfile = {
    ...defaults,
    version: 2,
    updatedAt: now(),
    warehouseSize,
    warehouse,
    loadout,
    lastDeployedLoadout: normalizeLoadout(candidate.lastDeployedLoadout),
    backpack: { ...packSize, items: backpackItems },
    armorCondition: Math.max(0, Number(candidate.armorCondition ?? defaults.armorCondition)),
    raidsStarted: Math.max(0, Number(candidate.raidsStarted ?? 0)),
    successfulExtractions: Math.max(0, Number(candidate.successfulExtractions ?? 0)),
    deaths: Math.max(0, Number(candidate.deaths ?? 0)),
    credits: Math.max(0, Math.floor(Number(candidate.credits ?? 45))),
    warehouseLevel: Math.max(1, Math.min(3, Math.floor(Number(candidate.warehouseLevel ?? (warehouseSize.width >= 10 ? 2 : 1))))),
    workshopLevel: Math.max(1, Math.min(3, Math.floor(Number(candidate.workshopLevel ?? 1)))),
    collectionItems: Array.from(new Set(
      (Array.isArray(candidate.collectionItems) ? candidate.collectionItems : [])
        .map(canonicalItemId)
        .filter((itemId): itemId is string => Boolean(itemId && ITEMS[itemId].category === 'collectible')),
    )),
    discoveredItems: Array.from(new Set(
      (Array.isArray(candidate.discoveredItems) ? candidate.discoveredItems : defaults.discoveredItems)
        .map(canonicalItemId)
        .filter((itemId): itemId is string => Boolean(itemId)),
    )),
    discoveredClues: Array.from(new Set(
      (Array.isArray(candidate.discoveredClues) ? candidate.discoveredClues : defaults.discoveredClues)
        .filter((clueId): clueId is string => typeof clueId === 'string'),
    )),
    mapUnlocked: Boolean(candidate.mapUnlocked),
    shortcutUnlocked: Boolean(candidate.shortcutUnlocked),
    bossDefeated: Boolean(candidate.bossDefeated),
    endingUnlocked: Boolean(candidate.endingUnlocked),
    endingSeen: Boolean(candidate.endingSeen),
    lostEcho: rawLostEcho && hasValidLostEchoPosition && canonicalizeStacks(cloneStacks(rawLostEcho.items ?? [])).length > 0 ? {
      mapId: lostEchoMap!.id,
      x: Math.round(rawLostEcho.x),
      y: Math.round(rawLostEcho.y),
      items: canonicalizeStacks(cloneStacks(rawLostEcho.items ?? [])),
      createdAtRaid: Math.max(0, Math.floor(Number(rawLostEcho.createdAtRaid) || 0)),
    } : null,
    activeRaid: null,
  };
  normalized.armorCondition = Math.min(normalized.armorCondition, getArmorMaximum(normalized));

  if (candidate.activeRaid) {
    const { map, entry } = normalizeMapEntry(candidate.activeRaid.mapId, candidate.activeRaid.entryId);
    const activeItems = candidate.version === 2
      ? gridItemsToStacks(normalizeGrid(candidate.activeRaid.backpack, packSize))
      : canonicalizeStacks(cloneStacks((candidate.activeRaid.backpack ?? []) as ItemStack[]));
    const abandonedGear = Object.values(normalized.loadout)
      .filter((itemId): itemId is string => Boolean(itemId))
      .map((itemId) => ({ itemId, quantity: 1 }));
    normalized.lostEcho = {
      mapId: map.id,
      x: entry.x,
      y: entry.y,
      items: addStacks(activeItems, abandonedGear),
      createdAtRaid: Math.max(0, Math.floor(Number(candidate.activeRaid.raidId) || 0)),
    };
    normalized.loadout = { ...EMPTY_DEATH_LOADOUT };
    normalized.backpack = { width: 0, height: 0, items: [] };
    normalized.armorCondition = 0;
    normalized.deaths += 1;
  }
  return normalized;
}

export const saveRepository = {
  load(): PlayerProfile {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const fresh = createDefaultProfile();
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeProfile(parsed);
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      console.warn('存档损坏，已创建新档。', error);
      const fresh = createDefaultProfile();
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(fresh));
      return fresh;
    }
  },

  save(profile: PlayerProfile): PlayerProfile {
    const saved = normalizeProfile({ ...profile, version: 2 as const, activeRaid: null });
    saved.activeRaid = profile.activeRaid ? {
      ...profile.activeRaid,
      ...(() => {
        const normalized = normalizeMapEntry(profile.activeRaid?.mapId, profile.activeRaid?.entryId);
        return { mapId: normalized.map.id, entryId: normalized.entry.id };
      })(),
      backpack: cloneGridItems(profile.activeRaid.backpack),
    } : null;
    saved.updatedAt = now();
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    return saved;
  },

  export(profile: PlayerProfile): void {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sui-echoes-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  async import(file: File): Promise<PlayerProfile> {
    const text = await file.text();
    return this.save(normalizeProfile(JSON.parse(text)));
  },

  reset(): PlayerProfile {
    window.localStorage.removeItem(SAVE_KEY);
    return this.save(createDefaultProfile());
  },
};
