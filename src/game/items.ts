import type { GearSlot, ItemDefinition, ItemStack, PlayerProfile } from '../types/game';

export const ITEMS: Record<string, ItemDefinition> = {
  rust_nail: {
    id: 'rust_nail',
    name: '旧羽钉',
    icon: '🪡',
    category: 'weapon',
    rarity: 'common',
    description: '陪岁己一起掉下来的旧道具。均衡、可靠。',
    stackLimit: 1,
    stats: { attack: 2, range: 84, attackCooldown: 340 },
  },
  echo_lance: {
    id: 'echo_lance',
    name: '回声长针',
    icon: '🗡️',
    category: 'weapon',
    rarity: 'uncommon',
    description: '攻击更慢，但可以在敌人靠近前刺中它。',
    stackLimit: 1,
    stats: { attack: 3, range: 118, attackCooldown: 470 },
  },
  storm_feather: {
    id: 'storm_feather',
    name: '雷羽短刃',
    icon: '⚡',
    category: 'weapon',
    rarity: 'rare',
    description: '范围很短，连击却像弹幕刷新一样快。',
    stackLimit: 1,
    stats: { attack: 2, range: 68, attackCooldown: 210 },
  },
  stream_shell: {
    id: 'stream_shell',
    name: '旧直播甲',
    icon: '🛡️',
    category: 'armor',
    rarity: 'common',
    description: '提供 2 点可修复蓝甲。贴着“户外直播专用”。',
    stackLimit: 1,
    stats: { armor: 2 },
  },
  miner_shell: {
    id: 'miner_shell',
    name: '矿工甲壳',
    icon: '🥌',
    category: 'armor',
    rarity: 'uncommon',
    description: '提供 4 点蓝甲，但沉重的壳会稍微拖慢脚步。',
    stackLimit: 1,
    stats: { armor: 4, speedMultiplier: 0.92 },
  },
  cat_cap: {
    id: 'cat_cap',
    name: '小猫帽',
    icon: '🐱',
    category: 'head',
    rarity: 'common',
    description: '受伤后短暂加速。帽子不会承认这是逃跑。',
    stackLimit: 1,
  },
  survey_lens: {
    id: 'survey_lens',
    name: '测绘镜',
    icon: '🔭',
    category: 'head',
    rarity: 'uncommon',
    description: '让未知地图上的目标和遗失回声更醒目。',
    stackLimit: 1,
  },
  soft_boots: {
    id: 'soft_boots',
    name: '软羽靴',
    icon: '🪶',
    category: 'shoes',
    rarity: 'common',
    description: '移动速度提升 12%。轻得像根本没穿。',
    stackLimit: 1,
    stats: { speedMultiplier: 1.12 },
  },
  shadow_boots: {
    id: 'shadow_boots',
    name: '影步靴',
    icon: '🌑',
    category: 'shoes',
    rarity: 'rare',
    description: '解锁能够穿过敌人的黑冲。',
    stackLimit: 1,
    stats: { dashEnabled: true },
  },
  echo_dust: {
    id: 'echo_dust',
    name: '空响尘',
    icon: '✨',
    category: 'material',
    rarity: 'common',
    description: '修理护甲和扩建饼干台的通用材料。',
    stackLimit: 99,
  },
  repair_patch: {
    id: 'repair_patch',
    name: '便携修补片',
    icon: '🩹',
    category: 'consumable',
    rarity: 'uncommon',
    description: '远征中恢复 1 点蓝甲。',
    stackLimit: 5,
  },
  map_feather: {
    id: 'map_feather',
    name: '导航羽片',
    icon: '🗺️',
    category: 'collectible',
    rarity: 'rare',
    description: '记录寂羽空洞的完整房间、捷径和撤离点。',
    stackLimit: 1,
  },
  biscuit_note: {
    id: 'biscuit_note',
    name: '饼干岁留言',
    icon: '🍪',
    category: 'collectible',
    rarity: 'uncommon',
    description: '“收到请回答！以及不要舔洞里的蘑菇！”',
    stackLimit: 1,
  },
  echo_core: {
    id: 'echo_core',
    name: '回声核心',
    icon: '💠',
    category: 'collectible',
    rarity: 'relic',
    description: '静默机房仍在跳动的信号核心。可以修复直播信标。',
    stackLimit: 1,
  },
};

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'head', 'shoes'];

export const SLOT_NAMES: Record<GearSlot, string> = {
  weapon: '武器',
  armor: '护甲',
  head: '头部',
  shoes: '鞋',
};

export const RARITY_NAMES = {
  common: '常见',
  uncommon: '改良',
  rare: '稀有',
  relic: '遗物',
} as const;

export function countItem(stacks: ItemStack[], itemId: string): number {
  return stacks.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
}

export function getArmorMaximum(profile: Pick<PlayerProfile, 'loadout'>): number {
  const armorId = profile.loadout.armor;
  return armorId ? (ITEMS[armorId]?.stats?.armor ?? 0) : 0;
}

export function getCurrentObjective(profile: PlayerProfile): string {
  if (profile.successfulExtractions === 0) return '带任意战利品从前庭撤离点安全返回';
  if (!profile.mapUnlocked) return '在荧菌裂谷找到导航羽片并安全带回';
  if (profile.stashCapacity < 16) return '收集 6 份空响尘，扩建一次仓库';
  if (!profile.shortcutUnlocked) return '深入裂谷，启动通往机房的维护电梯';
  if (!profile.bossDefeated) return '击败静默机房的失频守卫，夺取回声核心';
  if (!profile.endingSeen) return '在饼干台启动直播信标';
  return '信号已经连通。继续收集遗失的饼干岁留言';
}
