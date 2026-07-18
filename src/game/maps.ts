export interface MapZoneDefinition {
  id: string;
  name: string;
  risk: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface MapEntryDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  zoneId: string;
  unlockedBy?: 'shortcutUnlocked';
  requiredClues?: string[];
}

export interface MapDefinition {
  id: string;
  name: string;
  subtitle: string;
  worldWidth: number;
  worldHeight: number;
  entries: Record<string, MapEntryDefinition>;
  zones: MapZoneDefinition[];
  unlockedBy?: 'bossDefeated';
}

export const MAP_REGISTRY: Record<string, MapDefinition> = {
  hollow_01: {
    id: 'hollow_01',
    name: '寂羽空洞',
    subtitle: '前庭、裂谷、静默机房与沉眠温室',
    worldWidth: 6400,
    worldHeight: 2200,
    entries: {
      foyer: { id: 'foyer', name: '失落前庭随机投放', x: 240, y: 1960, zoneId: 'foyer' },
      lift: { id: 'lift', name: '维护电梯深层站', x: 2780, y: 850, zoneId: 'rift', unlockedBy: 'shortcutUnlocked' },
    },
    // Bounds intentionally leave narrow transition gaps. Region resolution must
    // preserve the previous zone briefly instead of inventing a foyer fallback.
    zones: [
      { id: 'conservatory', name: '沉眠温室', risk: 'III', bounds: { x: 4200, y: 0, width: 2200, height: 1600 } },
      { id: 'graveyard', name: '天线墓园', risk: 'IV', bounds: { x: 3700, y: 0, width: 500, height: 800 } },
      { id: 'machine', name: '静默机房', risk: 'III', bounds: { x: 2850, y: 0, width: 800, height: 1000 } },
      { id: 'archive', name: '遗忘档案窟', risk: 'II', bounds: { x: 0, y: 760, width: 1040, height: 680 } },
      { id: 'shaft', name: '回声竖井', risk: 'II', bounds: { x: 430, y: 1280, width: 790, height: 460 } },
      { id: 'rift', name: '荧菌裂谷', risk: 'II', bounds: { x: 1240, y: 720, width: 1580, height: 760 } },
      { id: 'cistern', name: '沉钟蓄水池', risk: 'II', bounds: { x: 1850, y: 1500, width: 1350, height: 700 } },
      { id: 'foyer', name: '失落前庭', risk: 'I', bounds: { x: 0, y: 1780, width: 1820, height: 420 } },
    ],
  },
  relay_01: {
    id: 'relay_01',
    name: '天线深场',
    subtitle: '双向校准与归航终端',
    worldWidth: 3600,
    worldHeight: 1800,
    unlockedBy: 'bossDefeated',
    entries: {
      west: { id: 'west', name: '西侧随机接驳', x: 230, y: 1510, zoneId: 'west-array', requiredClues: ['home-trace'] },
      crown: { id: 'crown', name: '冠顶终端接驳', x: 3200, y: 800, zoneId: 'terminal-crown', requiredClues: ['home-trace', 'relay-west-calibrated', 'relay-east-calibrated'] },
    },
    zones: [
      { id: 'west-array', name: '西向阵列', risk: 'III', bounds: { x: 0, y: 1120, width: 1050, height: 680 } },
      { id: 'relay-trench', name: '回波沟槽', risk: 'III', bounds: { x: 1090, y: 900, width: 960, height: 900 } },
      { id: 'east-array', name: '东向阵列', risk: 'IV', bounds: { x: 2090, y: 780, width: 900, height: 1020 } },
      { id: 'terminal-crown', name: '冠顶终端', risk: 'IV', bounds: { x: 3030, y: 420, width: 570, height: 1380 } },
    ],
  },
};

export const DEMO_MAP = MAP_REGISTRY.hollow_01;
export const DEFAULT_MAP_ID = 'hollow_01';
export const DEFAULT_ENTRY_ID = 'foyer';

export function getMapDefinition(mapId: string | null | undefined): MapDefinition {
  return (mapId && MAP_REGISTRY[mapId]) || MAP_REGISTRY[DEFAULT_MAP_ID];
}

export function isMapUnlocked(map: MapDefinition, profile: Record<string, unknown>): boolean {
  return !map.unlockedBy || Boolean(profile[map.unlockedBy]);
}

export function isEntryUnlocked(entry: MapEntryDefinition, profile: Record<string, unknown>): boolean {
  if (entry.unlockedBy && !profile[entry.unlockedBy]) return false;
  const clues = Array.isArray(profile.discoveredClues) ? profile.discoveredClues : [];
  return !entry.requiredClues || entry.requiredClues.every((clueId) => clues.includes(clueId));
}

export function normalizeMapEntry(
  mapId: string | null | undefined,
  entryId: string | null | undefined,
): { map: MapDefinition; entry: MapEntryDefinition } {
  const map = getMapDefinition(mapId);
  const entry = (entryId && map.entries[entryId]) || Object.values(map.entries)[0];
  return { map, entry };
}

export function containsPoint(
  zone: MapZoneDefinition,
  x: number,
  y: number,
  expansion = 0,
): boolean {
  return x >= zone.bounds.x - expansion
    && x < zone.bounds.x + zone.bounds.width + expansion
    && y >= zone.bounds.y - expansion
    && y < zone.bounds.y + zone.bounds.height + expansion;
}

export function findZoneAt(map: MapDefinition, x: number, y: number): MapZoneDefinition | null {
  return map.zones.find((zone) => containsPoint(zone, x, y)) ?? null;
}
