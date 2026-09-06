export type EnemyKind = 'guard' | 'sentry' | 'keeper';
export type EnemyPhase = 'idle' | 'windup' | 'strike' | 'recover' | 'stunned';
export interface EnemyBrain {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  home: number;
  facing: number;
  phase: EnemyPhase;
  until: number;
  readyAt: number;
  attackId: number;
  pattern: 'dash' | 'wave';
  aimX: number;
  aimY: number;
  lastHitAt: number;
  returnOnly?: boolean;
}

export interface EnemySpawn { id: string; kind: EnemyKind; x: number; floor: number; hp?: number }
export const ENEMY_SPAWNS: EnemySpawn[] = [
  { id: 'court-guard', kind: 'guard', x: 1050, floor: 700 },
  { id: 'gallery-guard', kind: 'guard', x: 1820, floor: 650 },
  { id: 'gallery-sentry', kind: 'sentry', x: 2150, floor: 520 },
  { id: 'heart-guard', kind: 'guard', x: 2850, floor: 700, hp: 4 },
  { id: 'heart-sentry', kind: 'sentry', x: 3460, floor: 600 },
  { id: 'bell-keeper', kind: 'keeper', x: 4620, floor: 620 },
];
export const RETURN_SPAWNS: EnemySpawn[] = [
  { id: 'return-heart', kind: 'guard', x: 2780, floor: 700 },
  { id: 'return-gallery', kind: 'guard', x: 1790, floor: 650 },
  { id: 'return-court', kind: 'sentry', x: 1350, floor: 610 },
];

export function createBrain(spawn: EnemySpawn): EnemyBrain {
  const hp = spawn.hp ?? (spawn.kind === 'keeper' ? 18 : 3);
  return {
    id: spawn.id, kind: spawn.kind, x: spawn.x, y: spawn.floor - (spawn.kind === 'keeper' ? 50 : 30),
    home: spawn.x, hp, maxHp: hp, facing: -1, phase: 'idle', until: 0, readyAt: 800,
    attackId: 0, pattern: 'dash', aimX: 0, aimY: 0, lastHitAt: -1000,
  };
}

export function stepEnemy(enemy: EnemyBrain, target: { x: number; y: number }, time: number): { vx: number; fire: boolean } {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const keeper = enemy.kind === 'keeper';
  if (enemy.hp <= 0) return { vx: 0, fire: false };
  if (enemy.phase === 'stunned' || enemy.phase === 'recover') {
    if (time < enemy.until) return { vx: 0, fire: false };
    enemy.phase = 'idle';
  }
  if (enemy.phase === 'windup') {
    if (time < enemy.until) return { vx: 0, fire: false };
    enemy.phase = 'strike';
    enemy.attackId += 1;
    enemy.until = time + (keeper ? 410 : 270);
    return { vx: enemy.kind === 'sentry' || enemy.pattern === 'wave' ? 0 : enemy.facing * (keeper ? 560 : 440), fire: true };
  }
  if (enemy.phase === 'strike') {
    if (time < enemy.until) return { vx: enemy.kind === 'sentry' || enemy.pattern === 'wave' ? 0 : enemy.facing * (keeper ? 560 : 440), fire: false };
    enemy.phase = 'recover';
    enemy.until = time + (keeper ? 950 : 850);
    enemy.readyAt = enemy.until + 250;
    return { vx: 0, fire: false };
  }
  const distance = enemy.kind === 'sentry' ? 560 : keeper ? 410 : 235;
  const sameLevel = Math.abs(dy) < (enemy.kind === 'sentry' ? 270 : 155);
  if (Math.abs(dx) < distance && sameLevel && time >= enemy.readyAt) {
    enemy.facing = dx < 0 ? -1 : 1;
    enemy.phase = 'windup';
    enemy.until = time + (keeper ? 900 : enemy.kind === 'sentry' ? 850 : 640);
    enemy.pattern = keeper && enemy.attackId % 2 === 1 ? 'wave' : 'dash';
    enemy.aimX = target.x;
    enemy.aimY = target.y;
    return { vx: 0, fire: false };
  }
  if (enemy.kind === 'sentry') return { vx: 0, fire: false };
  if (Math.abs(dx) < 470 && sameLevel) enemy.facing = dx < 0 ? -1 : 1;
  if (enemy.x < enemy.home - 125) enemy.facing = 1;
  if (enemy.x > enemy.home + 125) enemy.facing = -1;
  return { vx: enemy.facing * (keeper ? 70 : 46), fire: false };
}

export function strikeDamage(enemy: EnemyBrain, attackerX: number, empowered: boolean, downward: boolean): number {
  if (enemy.kind === 'keeper' && enemy.phase !== 'recover') return downward ? 1 : 0;
  const frontal = (attackerX - enemy.x) * enemy.facing > 0;
  if (enemy.kind !== 'sentry' && enemy.phase === 'windup' && frontal && !downward) return 0;
  return (empowered ? 2 : 1) + (enemy.phase === 'recover' ? 1 : 0);
}
