import {
  addStacks,
  cloneGridItems,
  cloneStacks,
  gridItemsToStacks,
  insertGridStacks,
  validateGrid,
} from '../game/inventory';
import { getArmorMaximum, ITEMS } from '../game/items';
import type {
  ActiveRaid,
  BackpackInventory,
  GridItem,
  GridSize,
  ItemStack,
  Loadout,
  PlayerProfile,
} from '../types/game';

const SAVE_KEY = 'sui-echoes-below.save.v1';

interface LegacyProfile {
  version?: number;
  updatedAt?: string;
  stashCapacity?: number;
  backpackCapacity?: number;
  stash?: ItemStack[];
  loadout?: Partial<Loadout>;
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
      && Boolean(ITEMS[candidate.itemId])
      && Number.isFinite(candidate.quantity)
      && Number.isFinite(candidate.x)
      && Number.isFinite(candidate.y);
  }).map((item) => ({
    ...item,
    quantity: Math.max(1, Math.floor(item.quantity)),
    x: Math.max(0, Math.floor(item.x)),
    y: Math.max(0, Math.floor(item.y)),
  }));
  if (validateGrid(items, size)) return cloneGridItems(items);
  return packStacks(gridItemsToStacks(items), size);
}

export function createDefaultProfile(): PlayerProfile {
  const warehouseSize = { width: 9, height: 10 };
  const loadout: Loadout = {
    weapon: 'rust_nail',
    armor: 'stream_shell',
    head: 'cat_cap',
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
    ], warehouseSize),
    loadout,
    backpack: { ...getPackSize(loadout), items: [] },
    armorCondition: 2,
    raidsStarted: 0,
    successfulExtractions: 0,
    deaths: 0,
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
  const loadout: Loadout = {
    ...defaults.loadout,
    ...candidate.loadout,
    backpack: candidate.version === 2
      ? (candidate.loadout.backpack ?? null)
      : (candidate.loadout.backpack ?? 'field_pack'),
  };
  const warehouseSize = candidate.version === 2 && candidate.warehouseSize
    ? {
      width: Math.max(9, Math.min(12, Math.floor(candidate.warehouseSize.width))),
      height: Math.max(10, Math.min(14, Math.floor(candidate.warehouseSize.height))),
    }
    : { width: candidate.stashCapacity && candidate.stashCapacity >= 16 ? 10 : 9, height: 10 };

  const warehouse = candidate.version === 2
    ? normalizeGrid(candidate.warehouse, warehouseSize)
    : packStacks(candidate.stash ?? [], warehouseSize);
  const packSize = getPackSize(loadout);
  const backpackItems = candidate.version === 2
    ? normalizeGrid(candidate.backpack?.items, packSize)
    : [];

  const normalized: PlayerProfile = {
    ...defaults,
    version: 2,
    updatedAt: now(),
    warehouseSize,
    warehouse,
    loadout,
    backpack: { ...packSize, items: backpackItems },
    armorCondition: Math.max(0, Number(candidate.armorCondition ?? defaults.armorCondition)),
    raidsStarted: Math.max(0, Number(candidate.raidsStarted ?? 0)),
    successfulExtractions: Math.max(0, Number(candidate.successfulExtractions ?? 0)),
    deaths: Math.max(0, Number(candidate.deaths ?? 0)),
    mapUnlocked: Boolean(candidate.mapUnlocked),
    shortcutUnlocked: Boolean(candidate.shortcutUnlocked),
    bossDefeated: Boolean(candidate.bossDefeated),
    endingUnlocked: Boolean(candidate.endingUnlocked),
    endingSeen: Boolean(candidate.endingSeen),
    lostEcho: candidate.lostEcho ? {
      ...candidate.lostEcho,
      items: cloneStacks(candidate.lostEcho.items ?? []),
    } : null,
    activeRaid: null,
  };
  normalized.armorCondition = Math.min(normalized.armorCondition, getArmorMaximum(normalized));

  if (candidate.activeRaid) {
    const activeItems = candidate.version === 2
      ? gridItemsToStacks(normalizeGrid(candidate.activeRaid.backpack, packSize))
      : cloneStacks((candidate.activeRaid.backpack ?? []) as ItemStack[]);
    const abandonedGear = Object.values(normalized.loadout)
      .filter((itemId): itemId is string => Boolean(itemId))
      .map((itemId) => ({ itemId, quantity: 1 }));
    normalized.lostEcho = {
      mapId: candidate.activeRaid.mapId,
      x: candidate.activeRaid.entryId === 'lift' ? 1500 : 240,
      y: candidate.activeRaid.entryId === 'lift' ? 1270 : 1940,
      items: addStacks(activeItems, abandonedGear),
      createdAtRaid: candidate.activeRaid.raidId,
    };
    normalized.loadout = {
      weapon: 'rust_nail',
      armor: null,
      head: null,
      shoes: 'soft_boots',
      backpack: 'field_pack',
    };
    normalized.backpack = { width: 4, height: 5, items: [] };
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
    const saved = { ...profile, version: 2 as const, updatedAt: now() };
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
