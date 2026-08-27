import { ITEMS } from './items';
import type {
  GridItem,
  PlayerProfile,
  RaidContractId,
  RaidGrade,
  RaidOnboardingProgress,
  RaidReport,
  RaidTelemetry,
} from '../types/game';

export interface RaidContractDefinition {
  id: RaidContractId;
  icon: string;
  name: string;
  brief: string;
  condition: string;
  target: number;
  creditReward: number;
  xpReward: number;
  progress: (telemetry: RaidTelemetry) => number;
}

export const EMPTY_RAID_TELEMETRY: RaidTelemetry = {
  enemiesDefeated: 0,
  searchedContainerIds: [],
  itemsRecovered: 0,
  rareFinds: 0,
  zonesVisited: [],
  damageTaken: 0,
  surgesTriggered: 0,
  elapsedMs: 0,
};

export const EMPTY_ONBOARDING_PROGRESS: RaidOnboardingProgress = {
  moved: false,
  jumped: false,
  attacked: false,
  searched: false,
  looted: false,
};

export const RAID_CONTRACTS: Record<RaidContractId, RaidContractDefinition> = {
  first_signal: {
    id: 'first_signal',
    icon: '◇',
    name: '初次回传',
    brief: '先学会活着带回一件东西。',
    condition: '带回至少 1 件远征物资并安全撤离',
    target: 1,
    creditReward: 30,
    xpReward: 55,
    progress: (telemetry) => telemetry.itemsRecovered,
  },
  salvage: {
    id: 'salvage',
    icon: '▣',
    name: '封箱清点',
    brief: '搜索容器，带走值得占背包格子的东西。',
    condition: '搜索 2 个容器',
    target: 2,
    creditReward: 48,
    xpReward: 60,
    progress: (telemetry) => telemetry.searchedContainerIds.length,
  },
  hunter: {
    id: 'hunter',
    icon: '✦',
    name: '静默清场',
    brief: '主动清除巡逻体，为下一次深入打出空间。',
    condition: '击破 4 个敌人',
    target: 4,
    creditReward: 62,
    xpReward: 68,
    progress: (telemetry) => telemetry.enemiesDefeated,
  },
  pathfinder: {
    id: 'pathfinder',
    icon: '⌁',
    name: '深场测绘',
    brief: '走出投放区，让未知房间进入基地记录。',
    condition: '踏足 3 个不同区域',
    target: 3,
    creditReward: 54,
    xpReward: 66,
    progress: (telemetry) => telemetry.zonesVisited.length,
  },
};

const FIELD_LEVEL_THRESHOLDS = [0, 90, 220, 420, 700, 1050] as const;
const GRADE_ORDER: RaidGrade[] = ['D', 'C', 'B', 'A', 'S'];

export function cloneRaidTelemetry(value?: Partial<RaidTelemetry> | null): RaidTelemetry {
  return {
    enemiesDefeated: Math.max(0, Math.floor(Number(value?.enemiesDefeated) || 0)),
    searchedContainerIds: Array.from(new Set(Array.isArray(value?.searchedContainerIds)
      ? value.searchedContainerIds.filter((id): id is string => typeof id === 'string')
      : [])),
    itemsRecovered: Math.max(0, Math.floor(Number(value?.itemsRecovered) || 0)),
    rareFinds: Math.max(0, Math.floor(Number(value?.rareFinds) || 0)),
    zonesVisited: Array.from(new Set(Array.isArray(value?.zonesVisited)
      ? value.zonesVisited.filter((id): id is string => typeof id === 'string')
      : [])),
    damageTaken: Math.max(0, Math.floor(Number(value?.damageTaken) || 0)),
    surgesTriggered: Math.max(0, Math.floor(Number(value?.surgesTriggered) || 0)),
    elapsedMs: Math.max(0, Math.floor(Number(value?.elapsedMs) || 0)),
  };
}

export function normalizeContractId(value: unknown, successfulExtractions = 0): RaidContractId {
  if (typeof value === 'string' && value in RAID_CONTRACTS) return value as RaidContractId;
  return successfulExtractions > 0 ? 'salvage' : 'first_signal';
}

export function getAvailableContracts(profile: Pick<PlayerProfile, 'successfulExtractions'>): RaidContractDefinition[] {
  return profile.successfulExtractions > 0
    ? [RAID_CONTRACTS.salvage, RAID_CONTRACTS.hunter, RAID_CONTRACTS.pathfinder]
    : [RAID_CONTRACTS.first_signal];
}

export function getDefaultContract(profile: Pick<PlayerProfile, 'successfulExtractions' | 'raidsStarted'>): RaidContractDefinition {
  const available = getAvailableContracts(profile);
  return available[Math.max(0, profile.raidsStarted) % available.length];
}

export function getContractProgress(contractId: RaidContractId, telemetry: RaidTelemetry): { progress: number; target: number; complete: boolean } {
  const contract = RAID_CONTRACTS[contractId];
  const progress = Math.max(0, contract.progress(telemetry));
  return { progress, target: contract.target, complete: progress >= contract.target };
}

export function getFieldLevel(fieldXp: number): number {
  const xp = Math.max(0, fieldXp);
  let level = 1;
  for (let index = 1; index < FIELD_LEVEL_THRESHOLDS.length; index += 1) {
    if (xp >= FIELD_LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}

export function getFieldLevelProgress(fieldXp: number): { level: number; current: number; required: number; ratio: number; capped: boolean } {
  const level = getFieldLevel(fieldXp);
  const currentThreshold = FIELD_LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = FIELD_LEVEL_THRESHOLDS[level];
  if (nextThreshold === undefined) return { level, current: fieldXp - currentThreshold, required: 0, ratio: 1, capped: true };
  const current = Math.max(0, fieldXp - currentThreshold);
  const required = nextThreshold - currentThreshold;
  return { level, current, required, ratio: Math.min(1, current / required), capped: false };
}

export const FIELD_LEVEL_BONUSES = [
  { level: 1, name: '落点保护', description: '投放后获得短暂无敌，先看清周围再行动。' },
  { level: 2, name: '熟练搜索', description: '容器内每件物品的识别速度提高 12%。' },
  { level: 3, name: '协议加成', description: '契约小鸟币奖励提高 10%。' },
  { level: 4, name: '稳态共鸣', description: '受到伤害时损失的共鸣减少。' },
  { level: 5, name: '快速回传', description: '普通撤离的信号上传时间缩短 0.35 秒。' },
  { level: 6, name: '深场许可', description: '契约小鸟币奖励总加成提高至 20%。' },
] as const;

export function getExtractedValue(backpack: readonly GridItem[]): number {
  return backpack.reduce((total, stack) => total + (ITEMS[stack.itemId]?.sellPrice ?? 0) * stack.quantity, 0);
}

function gradeFromScore(score: number): RaidGrade {
  if (score >= 88) return 'S';
  if (score >= 72) return 'A';
  if (score >= 55) return 'B';
  if (score >= 36) return 'C';
  return 'D';
}

export function getBetterGrade(left: RaidGrade, right: RaidGrade): RaidGrade {
  return GRADE_ORDER.indexOf(right) > GRADE_ORDER.indexOf(left) ? right : left;
}

export function createRaidReport(options: {
  raidId: number;
  mapId: string;
  outcome: 'extracted' | 'died';
  contractId: RaidContractId;
  telemetry: RaidTelemetry;
  backpack: readonly GridItem[];
  fieldXp: number;
}): RaidReport {
  const telemetry = cloneRaidTelemetry(options.telemetry);
  const contract = RAID_CONTRACTS[options.contractId];
  const contractCompleted = options.outcome === 'extracted' && getContractProgress(options.contractId, telemetry).complete;
  const extractedItemCount = options.outcome === 'extracted'
    ? options.backpack.reduce((total, stack) => total + stack.quantity, 0)
    : 0;
  const extractedValue = options.outcome === 'extracted' ? getExtractedValue(options.backpack) : 0;
  const activityScore = Math.min(25,
    telemetry.enemiesDefeated * 3
      + telemetry.searchedContainerIds.length * 4
      + telemetry.zonesVisited.length * 2
      + telemetry.rareFinds * 4
      + telemetry.surgesTriggered * 3);
  const gradeScore = (options.outcome === 'extracted' ? 42 : 0)
    + (contractCompleted ? 24 : 0)
    + activityScore
    + (telemetry.damageTaken === 0 ? 9 : Math.max(0, 6 - telemetry.damageTaken * 2));
  const level = getFieldLevel(options.fieldXp);
  const contractCreditMultiplier = level >= 6 ? 1.2 : level >= 3 ? 1.1 : 1;
  const baseCredits = options.outcome === 'extracted'
    ? 8 + Math.min(28, Math.floor(activityScore * 0.8))
    : 0;
  const creditsEarned = baseCredits + (contractCompleted ? Math.round(contract.creditReward * contractCreditMultiplier) : 0);
  const participationXp = 12
    + telemetry.enemiesDefeated * 3
    + telemetry.searchedContainerIds.length * 4
    + telemetry.zonesVisited.length * 2
    + telemetry.rareFinds * 5
    + telemetry.surgesTriggered * 6;
  const xpEarned = participationXp
    + (options.outcome === 'extracted' ? 18 : 0)
    + (contractCompleted ? contract.xpReward : 0);
  return {
    raidId: options.raidId,
    mapId: options.mapId,
    outcome: options.outcome,
    contractId: options.contractId,
    contractCompleted,
    grade: gradeFromScore(gradeScore),
    creditsEarned,
    xpEarned,
    extractedItemCount,
    extractedValue,
    telemetry,
    completedAt: new Date().toISOString(),
  };
}
