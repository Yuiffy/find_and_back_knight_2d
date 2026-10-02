import type { ItemId } from './model';
export interface Obstacle {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: 'container' | 'wall' | 'tank' | 'crate';
  color: string;
}
export const OBSTACLES: Obstacle[] = [
  { x: -23, z: 28, w: 12, d: 4, h: 3.2, kind: 'container', color: '#667b73' },
  { x: -39, z: 16, w: 4, d: 12, h: 3.2, kind: 'container', color: '#a1734f' },
  { x: -19, z: 12, w: 12, d: 4, h: 3.2, kind: 'container', color: '#466968' },
  { x: -23, z: -2, w: 4, d: 12, h: 3.2, kind: 'container', color: '#ac784c' },
  { x: -36, z: -9, w: 10, d: 4, h: 3.2, kind: 'container', color: '#576960' },
  { x: -10, z: -15, w: 5, d: 5, h: 2, kind: 'crate', color: '#91805f' },
  { x: 4, z: 18, w: 4, d: 9, h: 1.6, kind: 'wall', color: '#8e958a' },
  { x: 13, z: 3, w: 6, d: 3, h: 1.4, kind: 'wall', color: '#8e958a' },
  { x: 25, z: 21, w: 17, d: 1.2, h: 3.4, kind: 'wall', color: '#b1b2a3' },
  { x: 17, z: 13, w: 1.2, d: 15, h: 3.4, kind: 'wall', color: '#b1b2a3' },
  { x: 34, z: 9, w: 1.2, d: 25, h: 3.4, kind: 'wall', color: '#b1b2a3' },
  { x: 26, z: -3, w: 17, d: 1.2, h: 3.4, kind: 'wall', color: '#b1b2a3' },
  { x: 23, z: 10, w: 3, d: 2, h: 1, kind: 'crate', color: '#87998c' },
  { x: -3, z: -31, w: 1.4, d: 18, h: 2.4, kind: 'wall', color: '#8d938b' },
  { x: 14, z: -40, w: 34, d: 1.4, h: 2.4, kind: 'wall', color: '#8d938b' },
  { x: 31, z: -31, w: 1.4, d: 18, h: 2.4, kind: 'wall', color: '#8d938b' },
  { x: 5, z: -21, w: 8, d: 1.4, h: 1.8, kind: 'wall', color: '#8d938b' },
  { x: 24, z: -21, w: 8, d: 1.4, h: 1.8, kind: 'wall', color: '#8d938b' },
  { x: -32, z: -29, w: 6, d: 6, h: 5, kind: 'tank', color: '#728580' },
  { x: -22, z: -29, w: 6, d: 6, h: 5, kind: 'tank', color: '#728580' },
  { x: 12, z: -31, w: 5, d: 5, h: 2.3, kind: 'crate', color: '#5c706d' },
  { x: 39, z: -15, w: 3, d: 5, h: 1.8, kind: 'crate', color: '#948463' },
];
export const SECTORS = [
  {
    name: '南岸码头',
    tag: '01 / INFILTRATION',
    x: -29,
    z: 36,
    danger: '低威胁',
  },
  {
    name: '集装货场',
    tag: '02 / FREIGHT YARD',
    x: -28,
    z: -6,
    danger: '中威胁',
  },
  {
    name: '雨蚀医疗站',
    tag: '03 / MEDICAL',
    x: 25,
    z: 12,
    danger: '样本存放处',
  },
  {
    name: '北境雷达',
    tag: '04 / SIGNAL ARRAY',
    x: 15,
    z: -30,
    danger: '精英驻守',
  },
];
export const EXITS = [
  { id: 'south', name: '南岸接应艇', x: -32, z: 42, requiresPower: false },
  { id: 'north', name: '北侧货运升降机', x: 39, z: -38, requiresPower: true },
];
export const POWER = { x: -18, z: -17 };
export const RADAR = { x: 21, z: -33 };
export const CRATES: {
  id: string;
  name: string;
  x: number;
  z: number;
  loot: ItemId[];
}[] = [
  {
    id: 'dock',
    name: '码头补给箱',
    x: -29,
    z: 34,
    loot: ['scrap', 'medicine', 'electronics'],
  },
  {
    id: 'dock2',
    name: '遗弃工具箱',
    x: -40,
    z: 30,
    loot: ['scrap', 'electronics'],
  },
  {
    id: 'freight',
    name: '货运密封箱',
    x: -29,
    z: 4,
    loot: ['electronics', 'scrap', 'gold'],
  },
  {
    id: 'freight2',
    name: '工程物资',
    x: -36,
    z: -17,
    loot: ['electronics', 'medicine'],
  },
  { id: 'road', name: '路障急救箱', x: 8, z: 24, loot: ['medicine', 'scrap'] },
  {
    id: 'med',
    name: '医疗冷藏柜',
    x: 27,
    z: 14,
    loot: ['sample', 'medicine', 'medicine'],
  },
  {
    id: 'med2',
    name: '研究员保险箱',
    x: 28,
    z: 2,
    loot: ['gold', 'electronics'],
  },
  {
    id: 'north',
    name: '军用储备箱',
    x: 4,
    z: -35,
    loot: ['electronics', 'gold', 'medicine'],
  },
  {
    id: 'east',
    name: '废弃运输箱',
    x: 42,
    z: -8,
    loot: ['scrap', 'electronics'],
  },
];
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export function collides(x: number, z: number, radius = 0.55) {
  return (
    Math.abs(x) > 46 ||
    Math.abs(z) > 46 ||
    OBSTACLES.some(
      (o) =>
        x > o.x - o.w / 2 - radius &&
        x < o.x + o.w / 2 + radius &&
        z > o.z - o.d / 2 - radius &&
        z < o.z + o.d / 2 + radius,
    )
  );
}
export function blocked(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  // Slab test: continuous line of sight, independent of frame rate or distance.
  return OBSTACLES.some((o) => {
    let lo = 0,
      hi = 1;
    for (const [a, d, min, max] of [
      [ax, bx - ax, o.x - o.w / 2, o.x + o.w / 2],
      [az, bz - az, o.z - o.d / 2, o.z + o.d / 2],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (a < min || a > max) return false;
      } else {
        const t1 = (min - a) / d,
          t2 = (max - a) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
        if (lo > hi) return false;
      }
    }
    return true;
  });
}
