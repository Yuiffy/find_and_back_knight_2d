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
  red_hood: {
    id: 'red_hood',
    name: '小红帽',
    icon: '🔴',
    category: 'head',
    rarity: 'common',
    description: '初次下井时戴的红兜帽。击败敌人后可间隔恢复 1 点生命。',
    stackLimit: 1,
    sellPrice: 18,
    size: { width: 2, height: 2 },
    stats: { headEffect: 'kill-heal' },
  },
  blue_hood: {
    id: 'blue_hood',
    name: '小蓝帽',
    icon: '🔵',
    category: 'head',
    rarity: 'uncommon',
    description: '测绘员留下的蓝兜帽，让目标、宝箱与遗失回声更醒目。',
    stackLimit: 1,
    buyPrice: 95,
    sellPrice: 38,
    size: { width: 2, height: 2 },
    stats: { headEffect: 'scout' },
  },
  flower_hat: {
    id: 'flower_hat',
    name: '小花帽',
    icon: '🌼',
    category: 'head',
    rarity: 'rare',
    description: '在温室遗迹中生长的帽子，使回声糖浆额外恢复 1 点生命。',
    stackLimit: 1,
    sellPrice: 58,
    size: { width: 2, height: 2 },
    stats: { headEffect: 'tonic-boost' },
  },
  cat_cap: {
    id: 'cat_cap',
    name: '小猫帽',
    icon: '🐱',
    category: 'head',
    rarity: 'rare',
    description: '受伤后短暂加速。帽子不会承认这是逃跑。',
    stackLimit: 1,
    sellPrice: 64,
    size: { width: 2, height: 2 },
    stats: { headEffect: 'panic-haste' },
  },
  soft_boots: {
    id: 'soft_boots',
    name: '软羽靴',
    icon: '🪶',
    category: 'shoes',
    rarity: 'common',
    description: '移动速度提升 12%，并解锁普通冲刺；普通冲刺不能免疫伤害。',
    stackLimit: 1,
    buyPrice: 45,
    sellPrice: 18,
    size: { width: 2, height: 2 },
    stats: { speedMultiplier: 1.12, dashEnabled: true, dashMode: 'normal' },
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
    stats: { dashEnabled: true, dashMode: 'shadow' },
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
  echo_tonic: {
    id: 'echo_tonic',
    name: '回声糖浆',
    icon: '🧃',
    category: 'consumable',
    rarity: 'uncommon',
    description: '远征中按 H 恢复 2 点生命；小花帽会把恢复量提高到 3。',
    stackLimit: 3,
    buyPrice: 24,
    sellPrice: 10,
    size: { width: 1, height: 2 },
    stats: { healAmount: 2 },
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
  'echo_tonic',
  'rust_nail',
  'stream_shell',
  'field_pack',
  'echo_lance',
  'blue_hood',
  'storm_feather',
  'survey_pack',
] as const;

// These discoveries can guide the current expedition, but only become permanent
// after a safe extraction. Keeping the rule here makes both settlement paths
// agree and prevents a failed relay run from quietly advancing the finale.
export const EXTRACTION_CONFIRMED_CLUE_IDS = new Set([
  'relay-west-calibrated',
  'relay-east-calibrated',
]);

export function getDeathPersistentClues(current: readonly string[], discoveredDuringRaid: readonly string[]): string[] {
  const existing = new Set(current);
  return discoveredDuringRaid.filter((clueId) => !EXTRACTION_CONFIRMED_CLUE_IDS.has(clueId) || existing.has(clueId));
}

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
    title: '天线深场的双向坐标',
    text: profile.endingSeen
      ? '已回应：东西阵列同时锁定，直播频道重新连通。'
      : '回声核心恢复了一张新地图：天线深场。必须校准东西阵列，再从冠顶终端发出回答。',
    resolved: profile.endingSeen,
    tag: '天线深场',
  });
  const lore: Record<string, Omit<ClueRecord, 'id' | 'resolved'>> = {
    'foyer-manifest': { icon: '⌁', title: '褪色的入井名册', text: '“听见自己声音的人，不要回答。” 名册最后一页只留下了这句话。', tag: '环境回声' },
    'archive-recorder': { icon: '⌁', title: '一百七十年前的评论', text: '无主记录器仍在滚动评论，而那些账号早已停止活动。', tag: '环境回声' },
    'cistern-bell': { icon: '⌁', title: '被水淹没的钟', text: '蓄水池不是为了储水，而是为了淹没一口不该再响起的钟。', tag: '环境回声' },
    'graveyard-terminal': { icon: '⌁', title: '朝向故乡的旧终端', text: '断开的终端把更远的深场坐标写入了核心。', tag: '环境回声' },
    'conservatory-log': { icon: '⌁', title: '温室培育日志', text: '蓝帽负责找路，花帽负责疗伤，猫帽负责在一切失控时跑得够快。', tag: '沉眠温室' },
    'conservatory-gate': { icon: '⌁', title: '风道试验记录', text: '先学会借风冲过断桥，再去寻找能穿过黑暗的影步。', tag: '沉眠温室' },
    'relay-arrival-log': { icon: '⌁', title: '深场值守日志', text: '东阵列听见过去，西阵列听见未来。', tag: '天线深场' },
    'relay-cookie-call': { icon: '⌁', title: '断续的饼干岁呼叫', text: '先把两边都调亮。留言在东边的箱子里。', tag: '天线深场' },
    'relay-last-watch': { icon: '⌁', title: '最后一班守望', text: '终端需要两束相反方向的信号。', tag: '天线深场' },
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

export interface ObjectiveStep {
  id: string;
  label: string;
  destination: string;
  done: boolean;
}

export function getObjectiveSteps(profile: PlayerProfile): ObjectiveStep[] {
  const clues = profile.discoveredClues ?? [];
  return [
    { id: 'first-extraction', label: '完成首次安全撤离', destination: '寂羽空洞 · 前庭撤离点', done: profile.successfulExtractions > 0 },
    { id: 'map-feather', label: '带回导航羽片', destination: '寂羽空洞 · 荧菌裂谷', done: profile.mapUnlocked },
    { id: 'lift', label: '启动维护电梯', destination: '寂羽空洞 · 裂谷中层', done: profile.shortcutUnlocked },
    { id: 'warden-core', label: '击败守卫并带回回声核心', destination: '寂羽空洞 · 静默机房', done: profile.bossDefeated },
    { id: 'relay-west', label: '校准西向阵列', destination: '天线深场 · 西向阵列', done: clues.includes('relay-west-calibrated') },
    { id: 'relay-east', label: '校准东向阵列', destination: '天线深场 · 东向阵列', done: clues.includes('relay-east-calibrated') },
    { id: 'terminal', label: '在归航终端锁定频道', destination: '天线深场 · 冠顶终端', done: profile.endingSeen },
  ];
}

export function getCurrentObjective(profile: PlayerProfile): string {
  const next = getObjectiveSteps(profile).find((step) => !step.done);
  return next ? `${next.label} · ${next.destination}` : '频道仍然开着。空洞里还有没有被听见的回声。';
}
