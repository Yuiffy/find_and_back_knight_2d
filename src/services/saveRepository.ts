import { addStacks, cloneStacks } from '../game/inventory';
import { getArmorMaximum } from '../game/items';
import type { PlayerProfile } from '../types/game';

const SAVE_KEY = 'sui-echoes-below.save.v1';

function now(): string {
  return new Date().toISOString();
}

export function createDefaultProfile(): PlayerProfile {
  const profile: PlayerProfile = {
    version: 1,
    updatedAt: now(),
    stashCapacity: 12,
    backpackCapacity: 6,
    stash: [
      { itemId: 'echo_dust', quantity: 2 },
      { itemId: 'repair_patch', quantity: 1 },
    ],
    loadout: {
      weapon: 'rust_nail',
      armor: 'stream_shell',
      head: 'cat_cap',
      shoes: 'soft_boots',
    },
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
  return profile;
}

function normalizeProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== 'object') throw new Error('存档内容不是有效对象');
  const candidate = value as Partial<PlayerProfile>;
  if (candidate.version !== 1 || !candidate.loadout || !Array.isArray(candidate.stash)) {
    throw new Error('存档版本不受支持');
  }

  const defaults = createDefaultProfile();
  const normalized: PlayerProfile = {
    ...defaults,
    ...candidate,
    version: 1,
    updatedAt: now(),
    stash: cloneStacks(candidate.stash),
    loadout: { ...defaults.loadout, ...candidate.loadout },
    activeRaid: null,
  };
  normalized.armorCondition = Math.min(
    Math.max(0, normalized.armorCondition),
    getArmorMaximum(normalized),
  );
  if (candidate.activeRaid) {
    const abandonedGear = Object.values(normalized.loadout)
      .filter((itemId): itemId is string => Boolean(itemId))
      .map((itemId) => ({ itemId, quantity: 1 }));
    normalized.lostEcho = {
      mapId: candidate.activeRaid.mapId,
      x: candidate.activeRaid.entryId === 'lift' ? 3200 : 180,
      y: 560,
      items: addStacks(candidate.activeRaid.backpack ?? [], abandonedGear),
      createdAtRaid: candidate.activeRaid.raidId,
    };
    normalized.loadout = {
      weapon: 'rust_nail',
      armor: null,
      head: null,
      shoes: 'soft_boots',
    };
    normalized.armorCondition = 0;
    normalized.deaths += 1;
    normalized.activeRaid = null;
  }
  return normalized;
}

export const saveRepository = {
  load(): PlayerProfile {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultProfile();
    try {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const normalized = normalizeProfile(parsed);
      if (parsed.activeRaid) {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (error) {
      console.warn('存档损坏，已创建新档。', error);
      return createDefaultProfile();
    }
  },

  save(profile: PlayerProfile): PlayerProfile {
    const saved = { ...profile, updatedAt: now() };
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
