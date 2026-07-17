export interface MapZoneDefinition {
  id: string;
  name: string;
  risk: string;
  startX: number;
  endX: number;
}

export interface MapDefinition {
  id: string;
  name: string;
  worldWidth: number;
  worldHeight: number;
  entries: Record<string, { id: string; name: string; x: number; unlockedBy?: string }>;
  zones: MapZoneDefinition[];
}

export const MAP_REGISTRY: Record<string, MapDefinition> = {
  hollow_01: {
    id: 'hollow_01',
    name: '寂羽空洞',
    worldWidth: 4800,
    worldHeight: 720,
    entries: {
      foyer: { id: 'foyer', name: '失落前庭入口', x: 180 },
      lift: { id: 'lift', name: '维护电梯深层入口', x: 3200, unlockedBy: 'shortcutUnlocked' },
    },
    zones: [
      { id: 'foyer', name: '失落前庭', risk: 'I', startX: 0, endX: 1650 },
      { id: 'rift', name: '荧菌裂谷', risk: 'II', startX: 1650, endX: 3300 },
      { id: 'machine', name: '静默机房', risk: 'III', startX: 3300, endX: 4800 },
    ],
  },
};

export const DEMO_MAP = MAP_REGISTRY.hollow_01;
