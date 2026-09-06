export const LANTERN_SAVE_KEY = 'sui-lantern-run.save.v1';
export const WORLD_WIDTH = 5120;
export const RETURN_WINDOW = 120_000;
export const MAX_HEALTH = 6;
export type Weapon = 'blade' | 'feather';
export const WEAPONS: Record<Weapon, { name: string; category: string; cooldownMs: number; traits: string }> = {
  blade: { name: '羽刃', category: '近战挥击', cooldownMs: 340, traits: '下劈反弹 · 弹体反射' },
  feather: { name: '回旋羽', category: '远程投掷', cooldownMs: 750, traits: '去程与回程各命中一次' },
};
export type Phase = 'home' | 'outbound' | 'returning' | 'won' | 'lost';
export type Control = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash' | 'interact';
export type RelicId = 'bell' | 'letter' | 'seed';
export const CONTROL_LESSONS = ['move', 'attack', 'jump', 'dash', 'interact'] as const;
export type ControlLesson = typeof CONTROL_LESSONS[number];

export const RELICS: Record<RelicId, { name: string; story: string; color: string }> = {
  bell: { name: '雨停风铃', story: '灯亮起来时，它终于又响了一次。', color: '#efbe66' },
  letter: { name: '没有寄出的信', story: '“晚一点回来也没关系。我们给你留着灯。”', color: '#e88885' },
  seed: { name: '玻璃花种', story: '温室里最后一粒花种，在窗边发了芽。', color: '#8cc7a3' },
};

export interface Progress {
  version: 1;
  attempts: number;
  returns: number;
  relics: RelicId[];
  weapon: Weapon;
  muted: boolean;
  controlsVisible: boolean;
  learnedControls: ControlLesson[];
  bestTimeMs: number | null;
}

export interface RunResult {
  outcome: 'won' | 'lost';
  relic: RelicId | null;
  durationMs: number;
  kills: number;
  damageTaken: number;
  reason: string;
}

export interface Terrain {
  id: string;
  x: number;
  top: number;
  width: number;
  height: number;
  garden?: boolean;
}

export const TERRAIN: Terrain[] = [
  { id: 'home-ground', x: 0, top: 700, width: 810, height: 740, garden: true },
  { id: 'court-ground', x: 810, top: 700, width: 810, height: 740, garden: true },
  { id: 'court-step', x: 1260, top: 610, width: 230, height: 90, garden: true },
  { id: 'gallery-floor', x: 1620, top: 820, width: 1030, height: 620 },
  { id: 'gallery-west', x: 1660, top: 650, width: 270, height: 170, garden: true },
  { id: 'gallery-crown', x: 2010, top: 520, width: 250, height: 300 },
  { id: 'gallery-east', x: 2340, top: 630, width: 310, height: 190, garden: true },
  { id: 'heart-ground', x: 2650, top: 700, width: 1110, height: 740, garden: true },
  { id: 'heart-shelf', x: 3330, top: 600, width: 230, height: 100 },
  { id: 'belfry-floor', x: 3760, top: 820, width: 1360, height: 620 },
  { id: 'belfry-west', x: 3770, top: 650, width: 220, height: 170 },
  { id: 'belfry-step', x: 4060, top: 530, width: 200, height: 290, garden: true },
  { id: 'belfry-recovery', x: 4260, top: 720, width: 70, height: 100 },
  { id: 'belfry-arena', x: 4330, top: 620, width: 720, height: 200 },
  { id: 'belfry-east-step', x: 5050, top: 720, width: 70, height: 100 },
];

export const ROOMS = [
  { id: 'home', name: '归灯站', from: 0, to: 800 },
  { id: 'court', name: '雨庭', from: 800, to: 1620 },
  { id: 'gallery', name: '玻璃廊', from: 1620, to: 2650 },
  { id: 'heart', name: '灯芯温室', from: 2650, to: 3760 },
  { id: 'belfry', name: '钟楼', from: 3760, to: WORLD_WIDTH },
];

export const POINTS = {
  home: { x: 245, y: 666 },
  rest: { x: 2470, y: 602 },
  core: { x: 3180, y: 649 },
  relic: { x: 4860, y: 575 },
};

const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(1_000_000, Math.max(0, Math.floor(value))) : 0;

export function normalizeProgress(raw: unknown): Progress {
  const value = raw && typeof raw === 'object' ? raw as Partial<Progress> : {};
  const returns = count(value.returns);
  return {
    version: 1,
    attempts: count(value.attempts),
    returns,
    relics: [...new Set(Array.isArray(value.relics) ? value.relics.filter((id): id is RelicId =>
      id === 'bell' || id === 'letter' || id === 'seed') : [])],
    weapon: value.weapon === 'feather' && returns > 0 ? 'feather' : 'blade',
    muted: value.muted === true,
    controlsVisible: value.controlsVisible !== false,
    learnedControls: [...new Set(Array.isArray(value.learnedControls)
      ? value.learnedControls.filter((id): id is ControlLesson => CONTROL_LESSONS.includes(id)) : [])],
    bestTimeMs: typeof value.bestTimeMs === 'number' && Number.isFinite(value.bestTimeMs) && value.bestTimeMs > 0
      ? Math.round(value.bestTimeMs) : null,
  };
}

export function loadProgress(): Progress {
  try { return normalizeProgress(JSON.parse(localStorage.getItem(LANTERN_SAVE_KEY) ?? 'null')); }
  catch { return normalizeProgress(null); }
}

export function saveProgress(progress: Progress): boolean {
  try { localStorage.setItem(LANTERN_SAVE_KEY, JSON.stringify(normalizeProgress(progress))); return true; }
  catch { return false; }
}

export function settleProgress(progress: Progress, result: RunResult): Progress {
  if (result.outcome !== 'won') return { ...progress };
  return normalizeProgress({
    ...progress,
    returns: progress.returns + 1,
    relics: result.relic ? [...progress.relics, result.relic] : progress.relics,
    bestTimeMs: Math.min(progress.bestTimeMs ?? Infinity, result.durationMs),
  });
}

export function nextRelic(progress: Progress): RelicId {
  const ids: RelicId[] = ['bell', 'letter', 'seed'];
  return ids.find((id) => !progress.relics.includes(id)) ?? ids[progress.returns % ids.length];
}

export function roomAt(x: number) {
  return ROOMS.find((room) => x >= room.from && x < room.to) ?? ROOMS[0];
}

export function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function getTeaRestoration(health: number, coreTaken: boolean, lightMs: number) {
  return {
    healthGained: Math.max(0, Math.min(2, MAX_HEALTH - health)),
    lightGained: coreTaken ? Math.max(0, Math.min(10_000, RETURN_WINDOW - lightMs)) : 0,
  };
}

export interface GuidanceContext {
  phase: Phase;
  learned: ReadonlySet<ControlLesson>;
  x: number;
  footY: number;
  facing: number;
  grounded: boolean;
  canInteract: boolean;
  enemyNearby: boolean;
  enemyWindingUp: boolean;
}

export function getControlLesson(context: GuidanceContext): ControlLesson | null {
  const { phase, learned, x, footY, facing, grounded } = context;
  if (phase === 'won' || phase === 'lost') return null;
  if (!learned.has('interact') && context.canInteract) return 'interact';
  if (!learned.has('jump') && grounded) {
    const raisedLedge = TERRAIN.some((tile) => {
      const gap = facing > 0 ? tile.x - x : x - (tile.x + tile.width);
      const rise = footY - tile.top;
      return gap >= -15 && gap < 180 && rise > 25 && rise <= 215;
    });
    const support = TERRAIN.find((tile) => x >= tile.x && x <= tile.x + tile.width && Math.abs(tile.top - footY) < 8);
    const edge = support && (facing > 0 ? support.x + support.width : support.x);
    const openEdge = typeof edge === 'number' && Math.abs(edge - x) < 95
      && !TERRAIN.some((tile) => edge + facing * 25 > tile.x && edge + facing * 25 < tile.x + tile.width && Math.abs(tile.top - footY) < 25);
    if (raisedLedge || openEdge) return 'jump';
  }
  if (!learned.has('move')) return 'move';
  if (!learned.has('attack') && (phase === 'home' || context.enemyNearby)) return 'attack';
  if (!learned.has('dash') && context.enemyWindingUp) return 'dash';
  return null;
}
