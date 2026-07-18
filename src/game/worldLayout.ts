export type TerrainStyle = 'foyer' | 'shaft' | 'archive' | 'fungal' | 'cistern' | 'machine' | 'graveyard' | 'relay';

export interface TerrainSegment {
  x: number;
  y: number;
  width: number;
  style: TerrainStyle;
  massDepth?: number;
  edge?: 'left' | 'right' | 'both';
}

export interface HazardDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
}

export interface SpawnClusterDefinition {
  entryId: string;
  positions: Array<{ x: number; y: number }>;
}

export interface StoryEchoDefinition {
  id: string;
  x: number;
  y: number;
  title: string;
  message: string;
  color: number;
}

export interface MapRoomShape {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

export interface RelayInteractionDefinition {
  id: 'relay-west-calibrated' | 'relay-east-calibrated';
  x: number;
  y: number;
  name: string;
}

export interface WorldLayoutDefinition {
  terrain: TerrainSegment[];
  hazards: HazardDefinition[];
  spawnClusters: SpawnClusterDefinition[];
  storyEchoes: StoryEchoDefinition[];
  roomShapes: MapRoomShape[];
  routes: Array<Array<{ x: number; y: number }>>;
  extractionPoints: Array<{ x: number; y: number; label: string }>;
  relayInteractions?: RelayInteractionDefinition[];
  terminal?: { x: number; y: number; name: string };
}

/** Broad solid terrain masses; painted boundaries and physics agree. */
export const TERRAIN_SEGMENTS: TerrainSegment[] = [
  { x: 500, y: 2080, width: 1000, style: 'foyer', massDepth: 220, edge: 'left' },
  { x: 1220, y: 2080, width: 360, style: 'foyer', massDepth: 220 },
  { x: 1570, y: 1940, width: 520, style: 'foyer', massDepth: 260 },
  { x: 2000, y: 1990, width: 320, style: 'foyer', massDepth: 240 },
  { x: 760, y: 1970, width: 340, style: 'shaft', massDepth: 300, edge: 'left' },
  { x: 1250, y: 1785, width: 400, style: 'shaft', massDepth: 260, edge: 'right' },
  { x: 570, y: 1600, width: 580, style: 'shaft', massDepth: 240, edge: 'left' },
  { x: 600, y: 1320, width: 500, style: 'archive', massDepth: 130 },
  { x: 250, y: 1120, width: 360, style: 'archive', massDepth: 120, edge: 'left' },
  { x: 600, y: 930, width: 500, style: 'archive', massDepth: 130 },
  { x: 1050, y: 1040, width: 400, style: 'archive', massDepth: 110 },
  { x: 1450, y: 1420, width: 620, style: 'fungal', massDepth: 140 },
  { x: 2000, y: 1235, width: 400, style: 'fungal', massDepth: 120 },
  { x: 2450, y: 1050, width: 400, style: 'fungal', massDepth: 120 },
  { x: 2700, y: 930, width: 450, style: 'fungal', massDepth: 150 },
  { x: 2290, y: 1840, width: 400, style: 'cistern', massDepth: 140 },
  { x: 2700, y: 1660, width: 440, style: 'cistern', massDepth: 140 },
  { x: 3050, y: 1480, width: 340, style: 'cistern', massDepth: 150, edge: 'right' },
  { x: 2660, y: 1300, width: 480, style: 'cistern', massDepth: 140 },
  { x: 3300, y: 830, width: 700, style: 'machine', massDepth: 100 },
  { x: 3925, y: 620, width: 550, style: 'graveyard', massDepth: 240, edge: 'right' },
  // 针林上方的可选跳跳乐支路；窄台最终通向隐藏补给。
  { x: 300, y: 760, width: 190, style: 'archive', massDepth: 80 },
  { x: 590, y: 620, width: 170, style: 'archive', massDepth: 76 },
  { x: 875, y: 485, width: 160, style: 'archive', massDepth: 72 },
  { x: 1150, y: 610, width: 180, style: 'archive', massDepth: 80 },
];

export const STORY_ECHOES: StoryEchoDefinition[] = [
  {
    id: 'foyer-manifest',
    // Open floor beside the first extraction, clear of the foyer husk patrol.
    x: 350,
    y: 1995,
    title: '褪色的入井名册',
    message: '回声：名册最后一页只有一句——“听见自己声音的人，不要回答。”',
    color: 0xe0bc72,
  },
  { id: 'archive-recorder', x: 650, y: 865, title: '无主记录器', message: '回声：屏幕仍在滚动评论，但那些账号早在一百七十年前就停止活动了。', color: 0x78d9c4 },
  { id: 'cistern-bell', x: 2500, y: 1230, title: '沉钟铭牌', message: '回声：蓄水池不是为了储水，而是为了淹没一口不该再次响起的钟。', color: 0x70b7d2 },
  { id: 'graveyard-terminal', x: 3900, y: 550, title: '朝向故乡的旧终端', message: '回声：这里的线路已经断开。核心把一组更远的坐标写入基地终端。', color: 0xb99cff },
];

export const MAP_ROOM_SHAPES: MapRoomShape[] = [
  { id: 'foyer', name: '失落前庭', x: 70, y: 1770, width: 1120, height: 350, color: 0x315d61 },
  { id: 'shaft', name: '回声竖井', x: 610, y: 1360, width: 540, height: 720, color: 0x315d61 },
  { id: 'archive', name: '遗忘档案窟', x: 40, y: 850, width: 1040, height: 570, color: 0x4b6670 },
  { id: 'rift', name: '荧菌裂谷', x: 1040, y: 850, width: 1220, height: 590, color: 0x397e73 },
  { id: 'cistern', name: '沉钟蓄水池', x: 1860, y: 1120, width: 1320, height: 980, color: 0x315d72 },
  { id: 'machine', name: '静默机房', x: 2850, y: 520, width: 800, height: 430, color: 0x5f4e7d },
  { id: 'graveyard', name: '天线墓园', x: 3650, y: 420, width: 550, height: 340, color: 0x68557f },
];

export const MAP_ROUTES: Array<Array<{ x: number; y: number }>> = [
  [{ x: 240, y: 1990 }, { x: 760, y: 1970 }, { x: 1250, y: 1785 }, { x: 570, y: 1600 }, { x: 1450, y: 1420 }, { x: 2000, y: 1235 }, { x: 2450, y: 1050 }, { x: 2700, y: 930 }, { x: 3250, y: 830 }, { x: 3925, y: 620 }],
  [{ x: 1450, y: 1420 }, { x: 600, y: 1320 }, { x: 250, y: 1120 }, { x: 600, y: 930 }, { x: 1050, y: 1040 }, { x: 1450, y: 1420 }],
  [{ x: 2000, y: 1990 }, { x: 2290, y: 1840 }, { x: 2700, y: 1660 }, { x: 3050, y: 1480 }, { x: 2660, y: 1300 }, { x: 2000, y: 1235 }],
];

const RELAY_TERRAIN: TerrainSegment[] = [
  { x: 500, y: 1600, width: 1000, style: 'relay', massDepth: 230, edge: 'left' },
  { x: 1125, y: 1460, width: 350, style: 'relay', massDepth: 220 },
  { x: 1575, y: 1320, width: 500, style: 'relay', massDepth: 230 },
  { x: 2100, y: 1450, width: 430, style: 'relay', massDepth: 220 },
  { x: 2525, y: 1240, width: 420, style: 'relay', massDepth: 220 },
  { x: 2930, y: 1050, width: 390, style: 'relay', massDepth: 220 },
  { x: 3310, y: 860, width: 580, style: 'relay', massDepth: 260, edge: 'right' },
  { x: 760, y: 1160, width: 400, style: 'relay', massDepth: 180 },
  { x: 1370, y: 980, width: 430, style: 'relay', massDepth: 180 },
];

const RELAY_ECHOES: StoryEchoDefinition[] = [
  { id: 'relay-arrival-log', x: 470, y: 1515, title: '深场值守日志', message: '回声：东阵列听见过去，西阵列听见未来。不要让它们同时沉默。', color: 0x78d9c4 },
  { id: 'relay-cookie-call', x: 1840, y: 1245, title: '断续的饼干岁呼叫', message: '回声：岁己？如果这是你，先把两边都调亮。留言在东边的箱子里。', color: 0xe0bc72 },
  { id: 'relay-last-watch', x: 3080, y: 975, title: '最后一班守望', message: '回声：终端需要两束相反方向的信号，频道才能穿过深场。', color: 0xb99cff },
];

const RELAY_ROOMS: MapRoomShape[] = [
  { id: 'west-array', name: '西向阵列', x: 50, y: 1100, width: 1000, height: 600, color: 0x315d61 },
  { id: 'relay-trench', name: '回波沟槽', x: 1080, y: 900, width: 960, height: 780, color: 0x315d72 },
  { id: 'east-array', name: '东向阵列', x: 2070, y: 760, width: 900, height: 900, color: 0x4f607c },
  { id: 'terminal-crown', name: '冠顶终端', x: 3020, y: 430, width: 550, height: 1050, color: 0x68557f },
];

export const WORLD_LAYOUTS: Record<string, WorldLayoutDefinition> = {
  hollow_01: {
    terrain: TERRAIN_SEGMENTS,
    hazards: [
      { id: 'foyer-spikes', x: 1160, y: 2047, width: 120 },
      { id: 'archive-spike-bed', x: 760, y: 911, width: 220 },
      { id: 'cistern-spikes', x: 2460, y: 1826, width: 150 },
      { id: 'machine-spikes', x: 3560, y: 797, width: 140 },
    ],
    spawnClusters: [
      {
        entryId: 'foyer',
        positions: [
          { x: 240, y: 1960 },
          { x: 620, y: 1900 },
          { x: 1760, y: 1860 },
        ],
      },
    ],
    storyEchoes: STORY_ECHOES,
    roomShapes: MAP_ROOM_SHAPES,
    routes: MAP_ROUTES,
    extractionPoints: [
      { x: 520, y: 1995, label: '前庭撤离点' },
      { x: 3010, y: 1415, label: '沉钟应急浮标' },
      { x: 3620, y: 745, label: '机房信号井' },
      { x: 4000, y: 535, label: '墓园远距天线' },
    ],
  },
  relay_01: {
    terrain: RELAY_TERRAIN,
    hazards: [
      { id: 'relay-trench-spikes', x: 1320, y: 1427, width: 160 },
      { id: 'relay-east-spikes', x: 2310, y: 1417, width: 150 },
    ],
    spawnClusters: [
      {
        entryId: 'west',
        positions: [
          { x: 230, y: 1510 },
          { x: 680, y: 1510 },
          { x: 850, y: 1190 },
        ],
      },
    ],
    storyEchoes: RELAY_ECHOES,
    roomShapes: RELAY_ROOMS,
    routes: [[{ x: 230, y: 1510 }, { x: 1125, y: 1400 }, { x: 1575, y: 1260 }, { x: 2100, y: 1390 }, { x: 2525, y: 1180 }, { x: 2930, y: 990 }, { x: 3310, y: 800 }], [{ x: 500, y: 1510 }, { x: 760, y: 1100 }, { x: 1370, y: 920 }, { x: 1840, y: 1260 }]],
    extractionPoints: [
      { x: 350, y: 1515, label: '西侧返航信标' },
      { x: 2920, y: 985, label: '东侧返航信标' },
    ],
    relayInteractions: [
      { id: 'relay-west-calibrated', x: 760, y: 1515, name: '西向阵列校准台' },
      { id: 'relay-east-calibrated', x: 2525, y: 1155, name: '东向阵列校准台' },
    ],
    terminal: { x: 3310, y: 775, name: '深场归航终端' },
  },
};

export function getWorldLayout(mapId: string): WorldLayoutDefinition {
  return WORLD_LAYOUTS[mapId] ?? WORLD_LAYOUTS.hollow_01;
}
