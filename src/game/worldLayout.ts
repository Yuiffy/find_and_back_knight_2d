export type TerrainStyle = 'foyer' | 'shaft' | 'archive' | 'fungal' | 'cistern' | 'machine' | 'graveyard';

export interface TerrainSegment {
  x: number;
  y: number;
  width: number;
  style: TerrainStyle;
  massDepth?: number;
  edge?: 'left' | 'right' | 'both';
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

/**
 * Traversable surfaces are broad, fully solid terrain masses rather than
 * pass-through jump boards. The renderer gives every collider a visible side
 * wall so its physical boundary and the painted world always agree.
 */
export const TERRAIN_SEGMENTS: TerrainSegment[] = [
  // 失落前庭：连续地面、断桥和有明确侧壁的抬升岩台。
  { x: 500, y: 2080, width: 1000, style: 'foyer', massDepth: 220, edge: 'left' },
  { x: 1220, y: 2080, width: 360, style: 'foyer', massDepth: 220 },
  { x: 1570, y: 1940, width: 520, style: 'foyer', massDepth: 260 },
  { x: 2000, y: 1990, width: 320, style: 'foyer', massDepth: 240 },

  // 回声竖井：三块交错的实体悬崖接入裂谷，必须从左右侧跳上去。
  { x: 760, y: 1970, width: 340, style: 'shaft', massDepth: 300, edge: 'left' },
  { x: 1250, y: 1785, width: 400, style: 'shaft', massDepth: 260, edge: 'right' },
  { x: 570, y: 1600, width: 580, style: 'shaft', massDepth: 240, edge: 'left' },

  // 遗忘档案窟：三处大型残垣构成的左侧回环。
  { x: 600, y: 1320, width: 500, style: 'archive', massDepth: 130 },
  { x: 250, y: 1120, width: 360, style: 'archive', massDepth: 120, edge: 'left' },
  { x: 600, y: 930, width: 500, style: 'archive', massDepth: 130 },
  { x: 1050, y: 1040, width: 400, style: 'archive', massDepth: 110 },

  // 荧菌裂谷：宽阔洞室中的三层天然崖台，而非连续跳板。
  { x: 1450, y: 1420, width: 620, style: 'fungal', massDepth: 140 },
  { x: 2000, y: 1235, width: 400, style: 'fungal', massDepth: 120 },
  { x: 2450, y: 1050, width: 400, style: 'fungal', massDepth: 120 },
  { x: 2700, y: 930, width: 450, style: 'fungal', massDepth: 150 },

  // 沉钟蓄水池：五座交错水塔组成可选长回环。
  { x: 2290, y: 1840, width: 400, style: 'cistern', massDepth: 140 },
  { x: 2700, y: 1660, width: 440, style: 'cistern', massDepth: 140 },
  { x: 3050, y: 1480, width: 340, style: 'cistern', massDepth: 150, edge: 'right' },
  { x: 2660, y: 1300, width: 480, style: 'cistern', massDepth: 140 },

  // 静默机房与 Boss 大厅：一整块厚重机器基座作为竞技场地面。
  { x: 3250, y: 830, width: 800, style: 'machine', massDepth: 100 },

  // 天线墓园：Boss 大厅外的一整段世界边界。
  { x: 3925, y: 620, width: 550, style: 'graveyard', massDepth: 240, edge: 'right' },
];

export const STORY_ECHOES: StoryEchoDefinition[] = [
  {
    id: 'foyer-manifest',
    x: 1120,
    y: 2010,
    title: '褪色的入井名册',
    message: '回声：名册最后一页只有一句——“听见自己声音的人，不要回答。”',
    color: 0xe0bc72,
  },
  {
    id: 'archive-recorder',
    x: 650,
    y: 865,
    title: '无主记录器',
    message: '回声：屏幕仍在滚动评论，但那些账号早在一百七十年前就停止活动了。',
    color: 0x78d9c4,
  },
  {
    id: 'cistern-bell',
    x: 2500,
    y: 1230,
    title: '沉钟铭牌',
    message: '回声：蓄水池不是为了储水，而是为了淹没一口不该再次响起的钟。',
    color: 0x70b7d2,
  },
  {
    id: 'graveyard-terminal',
    x: 3900,
    y: 550,
    title: '朝向故乡的终端',
    message: '回声：所有天线都指向同一颗看不见的星。那里或许正是饼干岛。',
    color: 0xb99cff,
  },
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
  [
    { x: 240, y: 1990 }, { x: 760, y: 1970 }, { x: 1250, y: 1785 }, { x: 570, y: 1600 },
    { x: 1450, y: 1420 }, { x: 2000, y: 1235 }, { x: 2450, y: 1050 },
    { x: 2700, y: 930 }, { x: 3250, y: 830 }, { x: 3925, y: 620 },
  ],
  [
    { x: 1450, y: 1420 }, { x: 600, y: 1320 }, { x: 250, y: 1120 }, { x: 600, y: 930 },
    { x: 1050, y: 1040 }, { x: 1450, y: 1420 },
  ],
  [
    { x: 2000, y: 1990 }, { x: 2290, y: 1840 }, { x: 2700, y: 1660 }, { x: 3050, y: 1480 },
    { x: 2660, y: 1300 }, { x: 2000, y: 1235 },
  ],
];
