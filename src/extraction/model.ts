import { ITEMS, type ItemId } from './items.ts';
import { bagGrid, stashGrid, cellCapacity, normalizeInventory, findSpace, type ItemPlacement } from './inventory.ts';
export { ITEMS, type ItemId } from './items.ts';
export type WeaponId = 'kestrel' | 'shrike' | 'heron';
export const SAVE_KEY = 'sui-fogharbor.save.v1';
export const WEAPONS: Record<
  WeaponId,
  {
    name: string;
    type: string;
    price: number;
    damage: number;
    interval: number;
    mag: number;
    reserve: number;
    range: number;
    reload: number;
    spread: number;
    description: string;
  }
> = {
  kestrel: {
    name: 'K-12 游隼',
    type: '突击步枪',
    price: 500,
    damage: 26,
    interval: 0.17,
    mag: 24,
    reserve: 120,
    range: 26,
    reload: 1.8,
    spread: 0.045,
    description: '均衡 / 中距离控制 / 24 发弹匣',
  },
  shrike: {
    name: 'S-9 伯劳',
    type: '冲锋枪',
    price: 360,
    damage: 17,
    interval: 0.09,
    mag: 32,
    reserve: 160,
    range: 18,
    reload: 1.35,
    spread: 0.085,
    description: '近战压制 / 快速换弹 / 32 发弹匣',
  },
  heron: {
    name: 'H-7 苍鹭',
    type: '精确步枪',
    price: 850,
    damage: 64,
    interval: 0.65,
    mag: 8,
    reserve: 48,
    range: 38,
    reload: 2.4,
    spread: 0.014,
    description: '远距穿甲 / 高单发伤害 / 8 发弹匣',
  },
};
export const CONTRACTS = [
  {
    title: '01 / 建立补给线',
    text: '成功撤离，带回至少 2 件任意物资。',
    reward: 650,
  },
  {
    title: '02 / 雨中的样本',
    text: '深入东侧医疗站，安全带回 1 份密封样本。',
    reward: 1000,
  },
  {
    title: '03 / 给世界一个回音',
    text: '恢复供电、启动北部雷达，带回归航信号核心。',
    reward: 1800,
  },
];
export interface Loadout {
  weapon: WeaponId;
  armor: boolean;
  meds: number;
  suppressor: boolean;
}
export interface LostPack {
  x: number;
  z: number;
  items: ItemId[];
  weapon: WeaponId;
}
export interface Report {
  id: number;
  success: boolean;
  reason: string;
  items: ItemId[];
  kills: number;
  seconds: number;
  reward: number;
  contract: boolean;
  recovered: boolean;
}
export interface Profile {
  version: 1;
  credits: number;
  stash: ItemId[];
  stashLayout: ItemPlacement[];
  guns: Record<WeaponId, number>;
  armors: number;
  meds: number;
  suppressors: number;
  packLevel: number;
  stashLevel: number;
  contract: number;
  raids: number;
  wins: number;
  kills: number;
  lost: LostPack | null;
  active: { id: number; loadout: Loadout } | null;
  last: Report | null;
  settings: { muted: boolean; quality: 'high' | 'low'; reducedMotion: boolean };
}
export function freshProfile(): Profile {
  return {
    version: 1,
    credits: 1200,
    stash: [],
    stashLayout: [],
    guns: { kestrel: 1, shrike: 0, heron: 0 },
    armors: 1,
    meds: 3,
    suppressors: 0,
    packLevel: 0,
    stashLevel: 0,
    contract: 0,
    raids: 0,
    wins: 0,
    kills: 0,
    lost: null,
    active: null,
    last: null,
    settings: { muted: false, quality: 'high', reducedMotion: false },
  };
}
const count = (v: unknown, max = 1e7) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.floor(v)))
    : 0;
export const validItems = (v: unknown): ItemId[] =>
  Array.isArray(v)
    ? v
        .filter(
          (i): i is ItemId => typeof i === 'string' && Object.hasOwn(ITEMS, i),
        )
        .slice(0, 200)
    : [];
export function normalizeProfile(value: unknown): Profile {
  if (!value || typeof value !== 'object' || (value as Profile).version !== 1)
    throw new Error('不是有效的雾港行动存档');
  const v = value as Profile,
    p = freshProfile();
  for (const k of [
    'credits',
    'armors',
    'meds',
    'suppressors',
    'raids',
    'wins',
    'kills',
  ] as const)
    p[k] = count(v[k]);
  for (const k of Object.keys(WEAPONS) as WeaponId[])
    p.guns[k] = count(v.guns?.[k], 999);
  p.packLevel = count(v.packLevel, 2);
  p.stashLevel = count(v.stashLevel, 2);
  p.contract = count(v.contract, 3);
  const storage = normalizeInventory(validItems(v.stash), stashGrid(p), v.stashLayout);
  p.stash = storage.inventory.items;
  p.stashLayout = storage.inventory.slots;
  p.credits += storage.overflow.reduce((sum, item) => sum + ITEMS[item].value, 0);
  if (
    v.lost &&
    Number.isFinite(v.lost.x) &&
    Number.isFinite(v.lost.z) &&
    Object.hasOwn(WEAPONS, v.lost.weapon)
  )
    p.lost = {
      x: Math.max(-47, Math.min(47, v.lost.x)),
      z: Math.max(-47, Math.min(47, v.lost.z)),
      items: validItems(v.lost.items),
      weapon: v.lost.weapon,
    };
  if (v.active && Object.hasOwn(WEAPONS, v.active.loadout?.weapon))
    p.active = {
      id: count(v.active.id),
      loadout: {
        weapon: v.active.loadout.weapon,
        armor: v.active.loadout.armor === true,
        meds: count(v.active.loadout.meds, 3),
        suppressor: v.active.loadout.suppressor === true,
      },
    };
  if (v.last && typeof v.last.reason === 'string')
    p.last = {
      id: count(v.last.id),
      success: v.last.success === true,
      reason: v.last.reason.slice(0, 160),
      items: validItems(v.last.items),
      kills: count(v.last.kills),
      seconds: count(v.last.seconds),
      reward: count(v.last.reward),
      contract: v.last.contract === true,
      recovered: v.last.recovered === true,
    };
  p.settings = {
    muted: v.settings?.muted === true,
    quality: v.settings?.quality === 'low' ? 'low' : 'high',
    reducedMotion: v.settings?.reducedMotion === true,
  };
  return p;
}
export function readProfile(): { profile: Profile; warning: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return {
      profile: raw ? normalizeProfile(JSON.parse(raw)) : freshProfile(),
      warning: '',
    };
  } catch {
    return {
      profile: freshProfile(),
      warning:
        '本地存档无法读取。当前使用临时新档；导出备份或确认保存后再继续。',
    };
  }
}
export function writeProfile(p: Profile) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export const stashCapacity = (p: Profile) => cellCapacity(stashGrid(p));
export const packCapacity = (p: Profile) => cellCapacity(bagGrid(p));
export const weight = (items: ItemId[]) =>
  items.reduce((sum, i) => sum + ITEMS[i].weight, 0);
export function canDeploy(p: Profile, l: Loadout): boolean {
  return (
    !p.active &&
    p.guns[l.weapon] > 0 &&
    (!l.armor || p.armors > 0) &&
    p.meds >= l.meds &&
    (!l.suppressor || p.suppressors > 0)
  );
}
export function deploy(p: Profile, l: Loadout): Profile {
  if (!canDeploy(p, l)) throw new Error('装备不足，请调整整备');
  const n = structuredClone(p);
  n.raids++;
  n.guns[l.weapon]--;
  if (l.armor) n.armors--;
  n.meds -= l.meds;
  if (l.suppressor) n.suppressors--;
  n.active = { id: n.raids, loadout: { ...l } };
  return n;
}
export interface Settlement {
  success: boolean;
  reason: string;
  bag: ItemId[];
  secure: ItemId | null;
  kills: number;
  elapsed: number;
  x: number;
  z: number;
  meds: number;
  armor: number;
  powered: boolean;
  radar: boolean;
  recovered: boolean;
}
export function settle(p: Profile, r: Settlement): Profile {
  if (!p.active) return p;
  const n = structuredClone(p),
    active = n.active!;
  const items = r.success
    ? [...r.bag, ...(r.secure ? [r.secure] : [])]
    : r.secure
      ? [r.secure]
      : [];
  const completed =
    r.success &&
    (p.contract === 0
      ? items.length >= 2
      : p.contract === 1
        ? items.includes('sample')
        : p.contract === 2
          ? r.radar && items.includes('core')
          : false);
  let reward = completed ? CONTRACTS[p.contract].reward : 0;
  if (completed) n.contract++;
  if (r.success) {
    n.wins++;
    n.guns[active.loadout.weapon]++;
    n.meds += r.meds;
    if (r.armor > 0) n.armors++;
    if (active.loadout.suppressor) n.suppressors++;
    reward += 120 + r.kills * 35;
    n.lost = null;
  } else
    n.lost = {
      x: r.x,
      z: r.z,
      items: [...r.bag],
      weapon: active.loadout.weapon,
    };
  const storage = normalizeInventory(n.stash, stashGrid(n), n.stashLayout);
  reward += storage.overflow.reduce((sum, item) => sum + ITEMS[item].value, 0);
  for (const item of items) {
    const slot = findSpace(storage.inventory, item);
    if (slot) {
      storage.inventory.items.push(item); storage.inventory.slots.push(slot); storage.inventory.known.push(true);
    } else reward += ITEMS[item].value;
  }
  n.stash = storage.inventory.items;
  n.stashLayout = storage.inventory.slots;
  if (r.recovered) {
    const oldWeapon = p.lost?.weapon;
    if (r.success && oldWeapon) n.guns[oldWeapon]++;
  }
  n.credits += reward;
  n.kills += r.kills;
  n.last = {
    id: active.id,
    success: r.success,
    reason: r.reason,
    items,
    kills: r.kills,
    seconds: Math.floor(r.elapsed),
    reward,
    contract: completed,
    recovered: r.recovered && r.success,
  };
  n.active = null;
  return n;
}
export function recoverInterrupted(p: Profile): Profile {
  if (!p.active) return p;
  return settle(p, {
    success: false,
    reason: '行动中断 · 已部署装备遗失',
    bag: [],
    secure: null,
    kills: 0,
    elapsed: 0,
    x: -32,
    z: 38,
    meds: 0,
    armor: 0,
    powered: false,
    radar: false,
    recovered: false,
  });
}
