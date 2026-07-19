export type TerrainStyle = 'foyer' | 'shaft' | 'archive' | 'fungal' | 'cistern' | 'machine' | 'graveyard' | 'conservatory' | 'relay';

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

export interface GateDefinition {
  id: string;
  x: number;
  y: number;
  name: string;
  targetMapId: string;
  targetEntryId: string;
}

/** A walk-through border passage: crossing the map edge changes area without an E prompt. */
export interface BoundaryPassageDefinition {
  id: string;
  edge: 'left' | 'right';
  centerY: number;
  height: number;
  name: string;
  targetMapId: string;
  targetEntryId: string;
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
  gates?: GateDefinition[];
  boundaryPassages?: BoundaryPassageDefinition[];
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
  // A real stepping stone between the right shelf and the upper cistern; the
  // former near-overlap offered no run-up against full solid collision masses.
  { x: 2960, y: 1385, width: 150, style: 'cistern', massDepth: 72 },
  { x: 3300, y: 830, width: 700, style: 'machine', massDepth: 100 },
  { x: 3925, y: 620, width: 550, style: 'graveyard', massDepth: 240 },
  // 档案窟的短跳教学支路，避开主线和撤离点。
  // Broad first step and a low approach ledge keep this optional cache route
  // reachable without relying on edge correction against a solid wall.
  { x: 450, y: 850, width: 170, style: 'archive', massDepth: 72 },
  { x: 345, y: 760, width: 250, style: 'archive', massDepth: 80 },
  { x: 590, y: 620, width: 170, style: 'archive', massDepth: 76 },
  { x: 875, y: 485, width: 160, style: 'archive', massDepth: 72 },
  { x: 1150, y: 610, width: 180, style: 'archive', massDepth: 80 },
  // 新区域「沉眠温室」：墓园之后继续向东，形成普通冲刺教学与进阶挑战。
  { x: 4520, y: 760, width: 520, style: 'conservatory', massDepth: 180 },
  { x: 4930, y: 620, width: 240, style: 'conservatory', massDepth: 130 },
  { x: 5260, y: 520, width: 220, style: 'conservatory', massDepth: 120 },
  { x: 5590, y: 690, width: 260, style: 'conservatory', massDepth: 160 },
  { x: 5920, y: 510, width: 230, style: 'conservatory', massDepth: 120 },
  { x: 6200, y: 350, width: 320, style: 'conservatory', massDepth: 140, edge: 'right' },
  { x: 4750, y: 1120, width: 280, style: 'conservatory', massDepth: 150 },
  { x: 5140, y: 1260, width: 260, style: 'conservatory', massDepth: 150 },
  { x: 5530, y: 1140, width: 270, style: 'conservatory', massDepth: 150 },
  { x: 5920, y: 1320, width: 300, style: 'conservatory', massDepth: 170 },
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
  { id: 'conservatory-log', x: 4540, y: 685, title: '温室培育日志', message: '回声：蓝帽负责找路，花帽负责疗伤，猫帽负责在一切失控时跑得够快。', color: 0x9de6a7 },
  { id: 'conservatory-gate', x: 6080, y: 285, title: '风道试验记录', message: '回声：先学会借风冲过断桥，再去寻找能穿过黑暗的影步。', color: 0xf0cb75 },
];

export const MAP_ROOM_SHAPES: MapRoomShape[] = [
  { id: 'foyer', name: '失落前庭', x: 70, y: 1770, width: 1120, height: 350, color: 0x315d61 },
  { id: 'shaft', name: '回声竖井', x: 610, y: 1360, width: 540, height: 720, color: 0x315d61 },
  { id: 'archive', name: '遗忘档案窟', x: 40, y: 850, width: 1040, height: 570, color: 0x4b6670 },
  { id: 'rift', name: '荧菌裂谷', x: 1040, y: 850, width: 1220, height: 590, color: 0x397e73 },
  { id: 'cistern', name: '沉钟蓄水池', x: 1860, y: 1120, width: 1320, height: 980, color: 0x315d72 },
  { id: 'machine', name: '静默机房', x: 2850, y: 520, width: 800, height: 430, color: 0x5f4e7d },
  { id: 'graveyard', name: '天线墓园', x: 3650, y: 420, width: 550, height: 340, color: 0x68557f },
  { id: 'conservatory', name: '沉眠温室', x: 4210, y: 180, width: 2190, height: 1280, color: 0x3f7866 },
];

export const MAP_ROUTES: Array<Array<{ x: number; y: number }>> = [
  [{ x: 240, y: 1990 }, { x: 760, y: 1970 }, { x: 1250, y: 1785 }, { x: 570, y: 1600 }, { x: 1450, y: 1420 }, { x: 2000, y: 1235 }, { x: 2450, y: 1050 }, { x: 2700, y: 930 }, { x: 3250, y: 830 }, { x: 3925, y: 620 }],
  [{ x: 1450, y: 1420 }, { x: 600, y: 1320 }, { x: 250, y: 1120 }, { x: 600, y: 930 }, { x: 1050, y: 1040 }, { x: 1450, y: 1420 }],
  [{ x: 2000, y: 1990 }, { x: 2290, y: 1840 }, { x: 2700, y: 1660 }, { x: 3050, y: 1480 }, { x: 2960, y: 1385 }, { x: 2660, y: 1300 }, { x: 2000, y: 1235 }],
  [{ x: 450, y: 850 }, { x: 345, y: 760 }, { x: 590, y: 620 }, { x: 875, y: 485 }, { x: 1150, y: 610 }],
  [{ x: 3925, y: 620 }, { x: 4520, y: 760 }, { x: 4930, y: 620 }, { x: 5260, y: 520 }, { x: 5590, y: 690 }, { x: 5920, y: 510 }, { x: 6200, y: 350 }],
  [{ x: 4520, y: 760 }, { x: 4750, y: 1120 }, { x: 5140, y: 1260 }, { x: 5530, y: 1140 }, { x: 5920, y: 1320 }],
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

const OUTPOST_TERRAIN: TerrainSegment[] = [
  { x: 520, y: 2380, width: 1120, style: 'relay', massDepth: 240, edge: 'left' },
  { x: 1480, y: 2200, width: 720, style: 'relay', massDepth: 240 },
  { x: 2320, y: 2020, width: 720, style: 'relay', massDepth: 240 },
  { x: 3120, y: 1820, width: 720, style: 'machine', massDepth: 240 },
  { x: 3980, y: 1640, width: 850, style: 'machine', massDepth: 250 },
  // Arrival bridges overlap their neighbors so rotating spawns never fall through a collider seam.
  { x: 4478, y: 1640, width: 150, style: 'machine', massDepth: 120 },
  { x: 4900, y: 1430, width: 700, style: 'machine', massDepth: 250 },
  { x: 5680, y: 1240, width: 720, style: 'graveyard', massDepth: 260 },
  { x: 6075, y: 1240, width: 100, style: 'graveyard', massDepth: 120 },
  { x: 6500, y: 1040, width: 780, style: 'graveyard', massDepth: 260 },
  { x: 7350, y: 850, width: 700, style: 'relay', massDepth: 270, edge: 'right' },
  { x: 1080, y: 1900, width: 440, style: 'relay', massDepth: 180 },
  { x: 1900, y: 1700, width: 440, style: 'relay', massDepth: 180 },
  { x: 2720, y: 1500, width: 500, style: 'machine', massDepth: 180 },
  { x: 3580, y: 1300, width: 500, style: 'machine', massDepth: 180 },
  { x: 4460, y: 1100, width: 500, style: 'machine', massDepth: 180 },
  { x: 5340, y: 900, width: 480, style: 'graveyard', massDepth: 180 },
  { x: 6220, y: 700, width: 500, style: 'graveyard', massDepth: 180 },
  // Lower service road: a safer, longer route beneath the main combat corridor.
  { x: 1400, y: 2460, width: 700, style: 'relay', massDepth: 150 },
  { x: 2450, y: 2460, width: 760, style: 'relay', massDepth: 150 },
  { x: 3550, y: 2460, width: 800, style: 'relay', massDepth: 150 },
  { x: 4650, y: 2460, width: 800, style: 'machine', massDepth: 150 },
  { x: 5750, y: 2460, width: 820, style: 'machine', massDepth: 150 },
  { x: 6880, y: 2460, width: 900, style: 'graveyard', massDepth: 150 },
  // Upper catwalk: quick but exposed bypass over the central market.
  { x: 2700, y: 1120, width: 520, style: 'relay', massDepth: 150 },
  { x: 3450, y: 960, width: 520, style: 'machine', massDepth: 150 },
  { x: 4200, y: 820, width: 540, style: 'machine', massDepth: 150 },
  { x: 4950, y: 700, width: 520, style: 'graveyard', massDepth: 150 },
  { x: 5700, y: 600, width: 520, style: 'graveyard', massDepth: 150 },
  // Vertical connectors make it possible to swap routes after an encounter.
  { x: 1950, y: 2280, width: 240, style: 'relay', massDepth: 260 },
  // Climbable market recovery stairs: every rise is below the standard jump height.
  { x: 4200, y: 2240, width: 250, style: 'machine', massDepth: 280 },
  { x: 3980, y: 1920, width: 200, style: 'machine', massDepth: 180 },
  { x: 3750, y: 1640, width: 250, style: 'machine', massDepth: 180 },
  { x: 6450, y: 2100, width: 260, style: 'graveyard', massDepth: 420 },
];

const OUTPOST_ROOMS: MapRoomShape[] = [
  { id: 'south-docks', name: '南侧码头', x: 60, y: 1830, width: 1400, height: 650, color: 0x315d72 },
  { id: 'container-berth', name: '集装箱泊位', x: 1220, y: 1080, width: 1550, height: 1220, color: 0x4f607c },
  { id: 'market-ruins', name: '废弃集市', x: 2800, y: 780, width: 1820, height: 1220, color: 0x68557f },
  { id: 'relay-tower', name: '风暴中继塔', x: 4650, y: 120, width: 1250, height: 1100, color: 0x5a6d8d },
  { id: 'north-yard', name: '北侧货场', x: 5850, y: 80, width: 1900, height: 1150, color: 0x476b67 },
];

const OUTPOST_SPAWNS: Array<{ x: number; y: number }> = [
  { x: 420, y: 2260 }, { x: 1480, y: 2080 }, { x: 2900, y: 1700 }, { x: 4450, y: 1500 }, { x: 6100, y: 1090 }, { x: 7200, y: 700 },
];

export const WORLD_LAYOUTS: Record<string, WorldLayoutDefinition> = {
  outpost_01: {
    terrain: OUTPOST_TERRAIN,
    hazards: [
      { id: 'outpost-crane-spikes', x: 2070, y: 1681, width: 120 },
      { id: 'outpost-market-spikes', x: 3950, y: 1281, width: 150 },
      { id: 'outpost-yard-spikes', x: 6740, y: 681, width: 130 },
    ],
    spawnClusters: [{ entryId: 'infiltration', positions: OUTPOST_SPAWNS }],
    storyEchoes: [],
    roomShapes: OUTPOST_ROOMS,
    routes: [
      [{ x: 420, y: 2361 }, { x: 1480, y: 2181 }, { x: 2320, y: 2001 }, { x: 3120, y: 1801 }, { x: 3980, y: 1621 }, { x: 4478, y: 1621 }, { x: 4900, y: 1411 }, { x: 5680, y: 1221 }, { x: 6075, y: 1221 }, { x: 6500, y: 1021 }, { x: 7350, y: 831 }],
      [{ x: 420, y: 2361 }, { x: 1400, y: 2441 }, { x: 2450, y: 2441 }, { x: 3550, y: 2441 }, { x: 4650, y: 2441 }, { x: 5750, y: 2441 }, { x: 6880, y: 2441 }, { x: 7420, y: 790 }],
      [{ x: 2320, y: 2001 }, { x: 2700, y: 1101 }, { x: 3450, y: 941 }, { x: 4200, y: 801 }, { x: 4950, y: 681 }, { x: 5700, y: 581 }, { x: 6500, y: 1021 }],
      [{ x: 1900, y: 2181 }, { x: 1950, y: 2261 }, { x: 2450, y: 2441 }],
      [{ x: 4650, y: 2441 }, { x: 4200, y: 2221 }, { x: 3980, y: 1901 }, { x: 3750, y: 1621 }, { x: 3750, y: 1565 }],
      [{ x: 6500, y: 1021 }, { x: 6450, y: 2081 }, { x: 6880, y: 2441 }],
    ],
    extractionPoints: [
      { x: 350, y: 2300, label: '南码头撤离艇' },
      { x: 3750, y: 1565, label: '集市地下通道' },
      { x: 7420, y: 790, label: '北场吊机索降' },
    ],
  },
  hollow_01: {
    terrain: TERRAIN_SEGMENTS,
    hazards: [
      // 教学：主线平台中段的短刺床，左右都有充足起跳和落地空间。
      { id: 'archive-spike-bed', x: 760, y: 911, width: 150 },
      // 应用：蓄水池侧路的单段危险，撤离浮标周围保持完全安全。
      { id: 'cistern-spikes', x: 2460, y: 1821, width: 110 },
      // 掌握：温室高线连续冲刺房，危险只封住奖励路线而不堵主路。
      { id: 'conservatory-spikes-a', x: 5100, y: 601, width: 120 },
      { id: 'conservatory-spikes-b', x: 5430, y: 671, width: 100 },
      { id: 'conservatory-spikes-c', x: 5750, y: 671, width: 100 },
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
    gates: [
      { id: 'graveyard-relay-gate', x: 4040, y: 535, name: '深场折跃门', targetMapId: 'relay_01', targetEntryId: 'west' },
    ],
    boundaryPassages: [
      { id: 'hollow-east-passage', edge: 'right', centerY: 280, height: 260, name: '温室东侧风道', targetMapId: 'relay_01', targetEntryId: 'west' },
    ],
    extractionPoints: [
      { x: 520, y: 1995, label: '前庭撤离点' },
      { x: 3010, y: 1415, label: '沉钟应急浮标' },
      { x: 3620, y: 745, label: '机房信号井' },
      { x: 4000, y: 535, label: '墓园远距天线' },
      { x: 6200, y: 265, label: '温室风顶信标' },
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
      { entryId: 'crown', positions: [{ x: 3200, y: 800 }] },
    ],
    storyEchoes: RELAY_ECHOES,
    roomShapes: RELAY_ROOMS,
    routes: [[{ x: 230, y: 1510 }, { x: 1125, y: 1400 }, { x: 1575, y: 1260 }, { x: 2100, y: 1390 }, { x: 2525, y: 1180 }, { x: 2930, y: 990 }, { x: 3310, y: 800 }], [{ x: 500, y: 1510 }, { x: 760, y: 1100 }, { x: 1370, y: 920 }, { x: 1840, y: 1260 }]],
    gates: [
      { id: 'relay-hollow-gate', x: 620, y: 1515, name: '空洞折跃门', targetMapId: 'hollow_01', targetEntryId: 'relay_return' },
    ],
    boundaryPassages: [
      { id: 'relay-west-passage', edge: 'left', centerY: 1510, height: 700, name: '西侧接驳风道', targetMapId: 'hollow_01', targetEntryId: 'relay_return' },
    ],
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
