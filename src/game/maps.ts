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
    worldWidth: 3200,
    worldHeight: 2200,
    entries: {
      foyer: { id: 'foyer', name: '失落前庭入口', x: 240, y: 1960 },
      lift: { id: 'lift', name: '维护电梯中层站', x: 1450, y: 1280, unlockedBy: 'shortcutUnlocked' },
    },
    zones: [
      { id: 'machine', name: '静默机房', risk: 'III', bounds: { x: 2050, y: 0, width: 1150, height: 930 } },
      { id: 'rift', name: '荧菌裂谷', risk: 'II', bounds: { x: 500, y: 720, width: 1950, height: 960 } },
      { id: 'foyer', name: '失落前庭', risk: 'I', bounds: { x: 0, y: 1380, width: 1800, height: 820 } },
    ],
  },
};

export const DEMO_MAP = MAP_REGISTRY.hollow_01;
