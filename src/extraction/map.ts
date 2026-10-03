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
    danger: '零食 / 日常补给',
  },
  {
    name: '集装货场',
    tag: '02 / FREIGHT YARD',
    x: -28,
    z: -6,
    danger: '数码快递 / 中威胁',
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
  bonus?: ItemId[];
}[] = [
  {
    id: 'dock',
    name: '码头零食冷藏箱',
    x: -29,
    z: 34,
    loot: ['beef_jerky', 'dq_pistachio', 'sicily_lemon'],
  },
  {
    id: 'dock2',
    name: '养猫人的补货箱',
    x: -40,
    z: 30,
    loot: ['cat_food', 'cat_litter', 'biscuit_note'],
  },
  {
    id: 'freight',
    name: '二手数码快递',
    x: -29,
    z: 4,
    loot: ['rtx_3050', 'cpu_12400f'],
    bonus: ['tarnished_camera', 'sichuan_hotpot', 'biscuit_note'],
  },
  {
    id: 'freight2',
    name: '主机升级快递',
    x: -36,
    z: -17,
    loot: ['rtx_5070ti', 'cpu_9800x3d'],
    bonus: ['rtx_3050', 'biscuit_note', 'tarnished_camera'],
  },
  { id: 'road', name: '下播宵夜袋', x: 8, z: 24, loot: ['sichuan_hotpot', 'beef_jerky', 'biscuit_note'] },
  {
    id: 'med',
    name: '医疗冷藏柜',
    x: 27,
    z: 14,
    loot: ['sample', 'medicine', 'dq_pistachio'],
  },
  {
    id: 'med2',
    name: '更衣室的卡包',
    x: 28,
    z: 2,
    loot: ['swim_pass', 'gym_pass', 'tarnished_camera'],
  },
  {
    id: 'north',
    name: '雷达员的装机箱',
    x: 4,
    z: -35,
    loot: ['cpu_9800x3d', 'rtx_3050', 'medicine'],
    bonus: ['rtx_5070ti', 'gym_pass', 'sicily_lemon'],
  },
  {
    id: 'east',
    name: '宠物用品快递',
    x: 42,
    z: -8,
    loot: ['cat_food', 'cat_litter'],
    bonus: ['biscuit_note', 'swim_pass', 'beef_jerky'],
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
  return obstacleHit(ax, az, bx, bz) !== null;
}
/** Earliest contact along a complete segment, including a shot starting in cover. */
function obstacleHit(ax: number, az: number, bx: number, bz: number, radius = 0) {
  let earliest: number | null = null;
  for (const o of OBSTACLES) {
    let lo = 0,
      hi = 1, intersects = true;
    for (const [a, d, min, max] of [
      [ax, bx - ax, o.x - o.w / 2 - radius, o.x + o.w / 2 + radius],
      [az, bz - az, o.z - o.d / 2 - radius, o.z + o.d / 2 + radius],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (a < min || a > max) { intersects = false; break; }
      } else {
        const t1 = (min - a) / d,
          t2 = (max - a) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
        if (lo > hi) { intersects = false; break; }
      }
    }
    if (intersects && (earliest === null || lo < earliest)) earliest = lo;
  }
  return earliest;
}
export function bulletWallHit(ax: number, az: number, bx: number, bz: number) {
  let first = obstacleHit(ax, az, bx, bz, .035);
  for (const [a, b] of [[ax, bx], [az, bz]]) {
    if (Math.abs(a) >= 46) return 0;
    if (Math.abs(b) > 46) {
      const t = ((b > 0 ? 46 : -46) - a) / (b - a);
      if (first === null || t < first) first = t;
    }
  }
  return first;
}
/** Swept circle, used on relative segments to also account for moving targets. */
export function segmentCircleHit(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, radius: number) {
  const x = ax - cx, z = az - cz, dx = bx - ax, dz = bz - az;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz, b = 2 * (x * dx + z * dz);
  const discriminant = b * b - 4 * a * c;
  if (a < 1e-12 || discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
