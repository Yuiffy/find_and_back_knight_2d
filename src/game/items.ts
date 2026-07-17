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
    buyPrice: 35,
    sellPrice: 14,
    size: { width: 1, height: 3 },
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
    buyPrice: 110,
    sellPrice: 45,
    size: { width: 1, height: 4 },
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
    buyPrice: 180,
    sellPrice: 72,
    size: { width: 2, height: 2 },
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
    buyPrice: 65,
    sellPrice: 26,
    size: { width: 2, height: 3 },
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
    sellPrice: 55,
    size: { width: 3, height: 3 },
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
    sellPrice: 24,
    size: { width: 2, height: 2 },
  },
  survey_lens: {
    id: 'survey_lens',
    name: '测绘镜',
    icon: '🔭',
    category: 'head',
    rarity: 'uncommon',
    description: '让未知地图上的目标和遗失回声更醒目。',
    stackLimit: 1,
    buyPrice: 95,
    sellPrice: 38,
    size: { width: 2, height: 2 },
  },
  soft_boots: {
    id: 'soft_boots',
    name: '软羽靴',
    icon: '🪶',
    category: 'shoes',
    rarity: 'common',
    description: '移动速度提升 12%。轻得像根本没穿。',
    stackLimit: 1,
    buyPrice: 45,
    sellPrice: 18,
    size: { width: 2, height: 2 },
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
    sellPrice: 80,
    size: { width: 2, height: 2 },
    stats: { dashEnabled: true },
  },
  field_pack: {
    id: 'field_pack',
    name: '折羽背包',
    icon: '🎒',
    category: 'backpack',
    rarity: 'common',
    description: '4×5 格随身背包。装进去的物品会随远征一起承担风险。',
    stackLimit: 1,
    buyPrice: 75,
    sellPrice: 30,
    size: { width: 2, height: 3 },
    stats: { gridWidth: 4, gridHeight: 5 },
  },
  survey_pack: {
    id: 'survey_pack',
    name: '测绘员背架',
    icon: '🧰',
    category: 'backpack',
    rarity: 'rare',
    description: '5×6 格扩展背包。预留给后续区域的高级掉落。',
    stackLimit: 1,
    buyPrice: 210,
    sellPrice: 84,
    size: { width: 3, height: 3 },
    stats: { gridWidth: 5, gridHeight: 6 },
  },
  echo_dust: {
    id: 'echo_dust',
    name: '空响尘',
    icon: '✨',
    category: 'material',
    rarity: 'common',
    description: '修理护甲和扩建饼干台的通用材料。',
    stackLimit: 99,
    buyPrice: 8,
    sellPrice: 3,
    size: { width: 1, height: 1 },
  },
  repair_patch: {
    id: 'repair_patch',
    name: '便携修补片',
    icon: '🩹',
    category: 'consumable',
    rarity: 'uncommon',
    description: '远征中恢复 1 点蓝甲。',
    stackLimit: 5,
    buyPrice: 22,
    sellPrice: 9,
    size: { width: 1, height: 2 },
  },
  map_feather: {
    id: 'map_feather',
    name: '导航羽片',
    icon: '🗺️',
    category: 'collectible',
    rarity: 'rare',
    description: '记录寂羽空洞的完整房间、捷径和撤离点。',
    stackLimit: 1,
    sellPrice: 60,
    size: { width: 2, height: 2 },
  },
  biscuit_note: {
    id: 'biscuit_note',
    name: '饼干岁留言',
    icon: '🍪',
    category: 'collectible',
    rarity: 'uncommon',
    description: '“收到请回答！以及不要舔洞里的蘑菇！”',
    stackLimit: 1,
    sellPrice: 1,
    size: { width: 2, height: 1 },
  },
  echo_core: {
    id: 'echo_core',
    name: '回声核心',
    icon: '💠',
    category: 'collectible',
    rarity: 'relic',
    description: '静默机房仍在跳动的信号核心。可以修复直播信标。',
    stackLimit: 1,
    size: { width: 3, height: 3 },
  },
};

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'head', 'shoes', 'backpack'];

export const SLOT_NAMES: Record<GearSlot, string> = {
  weapon: '武器',
  armor: '护甲',
  head: '头部',
  shoes: '鞋',
  backpack: '背包',
};

export const RARITY_NAMES = {
  common: '常见',
  uncommon: '改良',
  rare: '稀有',
  relic: '遗物',
} as const;

export const MARKET_ITEM_IDS = [
  'echo_dust',
  'repair_patch',
  'rust_nail',
  'stream_shell',
  'field_pack',
  'echo_lance',
  'survey_lens',
  'storm_feather',
  'survey_pack',
] as const;

export interface ClueRecord {
  id: string;
  icon: string;
  title: string;
  text: string;
  resolved: boolean;
  tag: string;
}

export function getClueRecords(profile: PlayerProfile): ClueRecord[] {
  const discoveredClues = profile.discoveredClues ?? [];
  const records: ClueRecord[] = [{
    id: 'arrival',
    icon: '⌂',
    title: '绿色信号圈',
    text: profile.successfulExtractions > 0
      ? '已确认：站在绿色信号圈内保持 2.5 秒，可以把身上的东西安全带回饼干台。'
      : '前庭有一圈稳定的绿光，也许能把我送回那个临时落脚点。先带一点东西试试看。',
    resolved: profile.successfulExtractions > 0,
    tag: '失落前庭',
  }];
  if (profile.successfulExtractions > 0 || discoveredClues.includes('map-trace')) records.push({
    id: 'map-trace',
    icon: '🗺️',
    title: '裂谷里的导航残片',
    text: profile.mapUnlocked
      ? '已找回：导航羽片恢复了房间轮廓、捷径和撤离点。'
      : '撤离信号里混进一段破碎坐标，来源在前庭上方的荧菌裂谷。那里像是藏着一块导航羽片。',
    resolved: profile.mapUnlocked,
    tag: '荧菌裂谷',
  });
  if (profile.mapUnlocked || discoveredClues.includes('lift-trace')) records.push({
    id: 'lift-trace',
    icon: '⇣',
    title: '沉睡的维护电梯',
    text: profile.shortcutUnlocked
      ? '已启动：下次远征可以直接从中层站进入裂谷。'
      : '地图标出一台停在裂谷中层的维护电梯。若能在现场恢复供电，它会成为新的远征入口。',
    resolved: profile.shortcutUnlocked,
    tag: '裂谷中层',
  });
  if (profile.shortcutUnlocked || discoveredClues.includes('warden-trace')) records.push({
    id: 'warden-trace',
    icon: '💠',
    title: '机房仍在跳动',
    text: profile.bossDefeated
      ? '已取得：失频守卫停止活动，回声核心已经安全带回。'
      : '电梯日志不断重复“核心仍在线”。静默机房里有东西守着那枚可以让信标复苏的核心。',
    resolved: profile.bossDefeated,
    tag: '静默机房',
  });
  if (profile.bossDefeated || discoveredClues.includes('home-trace')) records.push({
    id: 'home-trace',
    icon: '📡',
    title: '所有天线朝向故乡',
    text: profile.endingSeen
      ? '已回应：直播频道重新连通，但岁己仍没有离开空洞。'
      : '回声核心能让天线墓园最深处的终端重新工作。真正的回答，应该在空洞里亲手发出去。',
    resolved: profile.endingSeen,
    tag: '天线墓园',
  });
  const lore: Record<string, Omit<ClueRecord, 'id' | 'resolved'>> = {
    'foyer-manifest': { icon: '⌁', title: '褪色的入井名册', text: '“听见自己声音的人，不要回答。” 名册最后一页只留下了这句话。', tag: '环境回声' },
    'archive-recorder': { icon: '⌁', title: '一百七十年前的评论', text: '无主记录器仍在滚动评论，而那些账号早已停止活动。', tag: '环境回声' },
    'cistern-bell': { icon: '⌁', title: '被水淹没的钟', text: '蓄水池不是为了储水，而是为了淹没一口不该再响起的钟。', tag: '环境回声' },
    'graveyard-terminal': { icon: '⌁', title: '朝向故乡的终端', text: '所有天线都指向同一颗看不见的星——那里也许就是饼干岛。', tag: '环境回声' },
  };
  for (const id of discoveredClues) {
    const clue = lore[id];
    if (clue && !records.some((record) => record.id === id)) records.push({ id, ...clue, resolved: true });
  }
  return records;
}

export function countItem(stacks: readonly ItemStack[], itemId: string): number {
  return stacks
    .filter((stack) => stack.itemId === itemId)
    .reduce((total, stack) => total + stack.quantity, 0);
}

export function getArmorMaximum(profile: Pick<PlayerProfile, 'loadout'>): number {
  const armorId = profile.loadout.armor;
  return armorId ? (ITEMS[armorId]?.stats?.armor ?? 0) : 0;
}

export function getCurrentObjective(profile: PlayerProfile): string {
  if (profile.successfulExtractions === 0) return '前庭的绿色信号很稳定，也许能送回捡到的东西。';
  if (!profile.mapUnlocked) return '破碎坐标指向前庭上方，一片发光的裂谷。';
  if (!profile.shortcutUnlocked) return '地图上有一台沉睡的电梯，靠近它也许能恢复供电。';
  if (!profile.bossDefeated) return '电梯日志反复提到：静默机房的核心仍在跳动。';
  if (!profile.endingSeen) return '核心在回应天线墓园。真正的信号必须从现场发出。';
  return '频道仍然开着。空洞里还有没有被听见的回声。';
}
