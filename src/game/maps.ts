export interface MapZoneDefinition {
  id: string;
  name: string;
  risk: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface MapDefinition {
  id: string;
  name: string;
  worldWidth: number;
  worldHeight: number;
  entries: Record<string, { id: string; name: string; x: number; y: number; unlockedBy?: string }>;
  zones: MapZoneDefinition[];
}

export const MAP_REGISTRY: Record<string, MapDefinition> = {
  hollow_01: {
    id: 'hollow_01',
    name: '寂羽空洞',
    worldWidth: 4200,
    worldHeight: 2200,
    entries: {
      foyer: { id: 'foyer', name: '失落前庭入口', x: 240, y: 1960 },
      lift: { id: 'lift', name: '维护电梯中层站', x: 1450, y: 1280, unlockedBy: 'shortcutUnlocked' },
    },
    zones: [
      { id: 'graveyard', name: '天线墓园', risk: 'IV', bounds: { x: 3650, y: 0, width: 550, height: 980 } },
      { id: 'machine', name: '静默机房', risk: 'III', bounds: { x: 2850, y: 0, width: 800, height: 1120 } },
      { id: 'archive', name: '遗忘档案窟', risk: 'II', bounds: { x: 0, y: 760, width: 1050, height: 720 } },
      { id: 'rift', name: '荧菌裂谷', risk: 'II', bounds: { x: 900, y: 720, width: 2025, height: 1060 } },
      { id: 'cistern', name: '沉钟蓄水池', risk: 'II', bounds: { x: 1850, y: 1080, width: 1350, height: 1120 } },
      { id: 'foyer', name: '失落前庭', risk: 'I', bounds: { x: 0, y: 1450, width: 1850, height: 750 } },
    ],
  },
};

export const DEMO_MAP = MAP_REGISTRY.hollow_01;
