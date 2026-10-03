import {
  ITEMS,
  WEAPONS,
  packCapacity,
  weight,
  type ItemId,
  type Loadout,
  type Profile,
  type Settlement,
  type WeaponId,
} from './model';
import {
  CRATES,
  EXITS,
  POWER,
  RADAR,
  blocked,
  collides,
  distance,
  bulletWallHit,
  segmentCircleHit,
} from './map';
import { bagGrid, SECURE_GRID, normalizeInventory, containerInventory, planTransfer, arrange, occupiedCells, emptyInventory, findSpace, type GridInventory, type GridSize, type ItemPlacement } from './inventory';
export type InventoryZone = 'bag' | 'secure' | 'crate';

export interface Input {
  x: number;
  z: number;
  aimX: number;
  aimZ: number;
  fire: boolean;
  sprint: boolean;
  crouch: boolean;
  ads: boolean;
}
export interface Enemy {
  id: number;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  hp: number;
  armor: number;
  elite: boolean;
  mode: 'patrol' | 'investigate' | 'engage';
  angle: number;
  cooldown: number;
  windup: number;
  targetX: number;
  targetZ: number;
  alert: number;
  hurt: number;
  lastShot: number;
  killedAt: number;
}
export interface Crate {
  id: string;
  name: string;
  x: number;
  z: number;
  loot: ItemId[];
  revealed: number;
  searched: number;
  grid: GridSize;
  lootLayout: ItemPlacement[];
  identified: boolean[];
}
function makeCrate(c: Pick<Crate, 'id' | 'name' | 'x' | 'z' | 'loot'>, known = false): Crate {
  const inventory = containerInventory(c.loot, known);
  return { ...c, loot: inventory.items, grid: inventory.grid, lootLayout: inventory.slots, identified: inventory.known, revealed: known ? c.loot.length : 0, searched: 0 };
}
export interface Bullet {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
  enemy: boolean;
  weapon: WeaponId;
  travelled: number;
  trail: number;
  bornAt: number;
}
export interface Impact {
  x: number; z: number; life: number; kind: 'wall' | 'flesh' | 'armor' | 'kill';
}
export interface Casing {
  x: number; z: number; vx: number; vz: number; age: number;
}
export type SoundEvent =
  'shot' | 'enemyShot' | 'hit' | 'armorHit' | 'kill' | 'wallHit' | 'dryFire' | 'eat' | 'hurt' | 'loot' | 'reload' | 'extract';
export class Raid {
  phase: 'raid' | 'won' | 'lost' = 'raid';
  elapsed = 0;
  limit = 600;
  paused = false;
  player = {
    x: -32,
    z: 37,
    angle: 0,
    hp: 100,
    armor: 0,
    stamina: 100,
    bleed: false,
    hurt: 0,
    moving: false,
  };
  loadout: Loadout;
  mag: number;
  ammo: number;
  meds: number;
  reload = 0;
  healing = 0;
  cooldown = 0;
  lastShot = -99;
  shotCount = 0;
  recoil = 0;
  hitFeedback: { x: number; z: number; life: number; kind: 'flesh' | 'armor' | 'kill'; damage: number } | null = null;
  bag: ItemId[] = [];
  bagLayout: ItemPlacement[] = [];
  secure: ItemId | null = null;
  secureLayout: ItemPlacement | null = null;
  grid: GridSize;
  capacity: number;
  kills = 0;
  powered = false;
  radar = false;
  recovered = false;
  powerProgress = 0;
  radarProgress = 0;
  extraction = 0;
  extractionId = '';
  reason = '';
  noise = 0;
  search: string | null = null;
  crates: Crate[];
  enemies: Enemy[];
  bullets: Bullet[] = [];
  impacts: Impact[] = [];
  casings: Casing[] = [];
  events: SoundEvent[] = [];
  toast = '行动开始 · 前方码头冷藏箱有冰淇淋和零食';
  toastTime = 6;
  lost: Profile['lost'];
  seed: number;
  lastHit = -99;
  private dropSerial = 0;
  private bulletSerial = 0;
  input: Input = {
    x: 0,
    z: 0,
    aimX: -32,
    aimZ: 25,
    fire: false,
    sprint: false,
    crouch: false,
    ads: false,
  };
  constructor(profile: Profile, loadout: Loadout) {
    this.loadout = { ...loadout };
    this.mag = WEAPONS[loadout.weapon].mag;
    this.ammo = WEAPONS[loadout.weapon].reserve;
    this.meds = loadout.meds;
    this.player.armor = loadout.armor ? 75 : 0;
    this.capacity = packCapacity(profile);
    this.grid = bagGrid(profile);
    this.lost = profile.lost ? structuredClone(profile.lost) : null;
    this.seed = (profile.raids + 1) * 739 + 13;
    this.crates = CRATES.map(c => makeCrate({ ...c, loot: [...c.loot, ...(c.bonus ? [c.bonus[Math.floor(this.random() * c.bonus.length)]] : [])] }));
    const points = [
      [-32, 14],
      [-13, 4],
      [-31, -13],
      [7, 8],
      [26, 7],
      [39, 4],
      [8, -26],
      [23, -27],
      [38, -29],
    ];
    if (profile.contract >= 3) points.push([-12, 19], [9, -9], [39, 20]);
    this.enemies = points.map(([x, z], id) => ({
      id,
      x,
      z,
      homeX: x,
      homeZ: z,
      hp: id === 7 ? 200 : 78,
      armor: id === 7 ? 80 : id > 3 ? 25 : 0,
      elite: id === 7,
      mode: 'patrol',
      angle: 0,
      cooldown: 1.3 + id * 0.1,
      windup: 0,
      targetX: x,
      targetZ: z,
      alert: 0,
      hurt: 0,
      lastShot: -99,
      killedAt: -99,
    }));
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  notify(message: string) {
    this.toast = message;
    this.toastTime = 4;
  }
  get bagWeight() {
    return weight(this.bag);
  }
  get maxWeight() {
    return 14 + (this.capacity - 20) * 0.4;
  }
  get usedCells() { return occupiedCells(this.bag); }
  get inventories(): Record<InventoryZone, GridInventory | null> {
    this.bagLayout = normalizeInventory(this.bag, this.grid, this.bagLayout).inventory.slots;
    const bag: GridInventory = { grid: this.grid, items: this.bag, slots: this.bagLayout, known: this.bag.map(() => true) };
    const secure = emptyInventory(SECURE_GRID, true);
    if (this.secure) {
      const slot = this.secureLayout ?? findSpace(secure, this.secure);
      if (slot) { secure.items = [this.secure]; secure.slots = [slot]; secure.known = [true]; }
    }
    const c = this.crates.find(c => c.id === this.search);
    const crate = c ? { grid: c.grid, items: c.loot, slots: c.lootLayout, known: c.identified } : null;
    return { bag, secure, crate };
  }
  private transferPlan(from: InventoryZone, index: number, to: InventoryZone, slot?: ItemPlacement, rotated = false) {
    if (this.paused || this.phase !== 'raid') return null;
    if (from === 'crate' || to === 'crate') {
      const c = this.crates.find(c => c.id === this.search);
      if (!c || distance(c, this.player) > 3) return null;
    }
    const views = this.inventories, source = views[from], target = views[to];
    return source && target ? planTransfer(source, index, target, slot, rotated) : null;
  }
  canTransfer(from: InventoryZone, index: number, to: InventoryZone, slot: ItemPlacement) {
    return !!this.transferPlan(from, index, to, slot);
  }
  transfer(from: InventoryZone, index: number, to: InventoryZone, slot?: ItemPlacement, rotated = false): boolean {
    const before = this.inventories[from]?.items[index];
    const plan = this.transferPlan(from, index, to, slot, rotated);
    if (!plan) {
      this.notify(to === 'secure' ? '安全箱最多放一件 2×2 物资，替换物也需有空间放回' : '这里放不下 · 试试旋转、整理或腾出完整空间');
      return false;
    }
    const commit = (zone: InventoryZone, inventory: GridInventory) => {
      if (zone === 'bag') { this.bag = inventory.items; this.bagLayout = inventory.slots; }
      else if (zone === 'secure') { this.secure = inventory.items[0] ?? null; this.secureLayout = inventory.slots[0] ?? null; }
      else {
        const c = this.crates.find(c => c.id === this.search)!;
        c.loot = inventory.items; c.lootLayout = inventory.slots; c.identified = inventory.known; c.revealed = inventory.known.filter(Boolean).length;
      }
    };
    commit(from, plan.source);
    if (to !== from) commit(to, plan.target);
    if (from === 'crate' && to !== 'crate') this.events.push('loot');
    this.notify(from === to ? '已调整摆放' : to === 'secure' ? '已放入安全箱 · 失败仍保留（页面中断除外）' : to === 'crate' ? '已放回容器' : `已收纳 ${before ? ITEMS[before].name : '物资'}`);
    return true;
  }
  organize() {
    if (this.paused || this.phase !== 'raid') return;
    const next = arrange(this.inventories.bag!);
    if (!next) { this.notify('暂时无法整理 · 请先腾出空间'); return; }
    this.bagLayout = next.slots;
    this.notify('背包已整理');
  }
  get nearby(): {
    kind: 'crate' | 'power' | 'radar' | 'lost';
    id: string;
    name: string;
  } | null {
    const near = this.crates
      .filter(
        (c) =>
          distance(c, this.player) < 2.8 &&
          c.loot.length &&
          !blocked(c.x, c.z, this.player.x, this.player.z),
      )
      .sort((a, b) => distance(a, this.player) - distance(b, this.player));
    if (near.length)
      return { kind: 'crate', id: near[0].id, name: near[0].name };
    if (!this.powered && distance(POWER, this.player) < 3)
      return { kind: 'power', id: 'power', name: '恢复电站供电 · 3 秒' };
    if (!this.radar && distance(RADAR, this.player) < 3)
      return {
        kind: 'radar',
        id: 'radar',
        name: this.powered
          ? '启动归航雷达 · 4 秒'
          : '雷达离线 · 先恢复西侧供电',
      };
    if (this.lost && !this.recovered && distance(this.lost, this.player) < 3)
      return { kind: 'lost', id: 'lost', name: '回收上轮遗留装备' };
    return null;
  }
  interact() {
    if (this.paused || this.phase !== 'raid') return;
    const n = this.nearby;
    if (!n) return;
    if (n.kind === 'crate') this.search = n.id;
    if (n.kind === 'power') this.powerProgress = 0.01;
    if (n.kind === 'radar') {
      if (this.powered) this.radarProgress = 0.01;
      else this.notify('电力中断 · 电站位于货场北侧');
    }
    if (n.kind === 'lost' && this.lost) {
      this.recovered = true;
      this.crates.push(makeCrate({
        id: 'recovery',
        name: '上轮遗留背包',
        x: this.lost.x,
        z: this.lost.z,
        loot: [...this.lost.items],
      }, true));
      this.search = 'recovery';
      this.notify('已携带遗留武器 · 撤离后放回仓库');
    }
  }
  take(index: number, slot?: ItemPlacement, rotated = false) { return this.transfer('crate', index, 'bag', slot, rotated); }
  takeAll() {
    const c = this.crates.find((c) => c.id === this.search);
    if (!c) return;
    let taken = 0;
    for (let i = 0; i < c.loot.length;) {
      if (c.identified[i] && this.take(i)) taken++;
      else i++;
    }
    this.notify(taken ? `收纳了 ${taken} 件物资${c.revealed ? ' · 剩余物资需要更完整的空间' : ''}` : '没有可收纳的物资 · 等待识别或整理背包');
  }
  insure(index: number) {
    return this.transfer('bag', index, 'secure');
  }
  drop(index: number) {
    if (this.paused || this.phase !== 'raid' || !Number.isInteger(index) || index < 0 || !this.bag[index]) return;
    void this.inventories;
    const [item] = this.bag.splice(index, 1);
    this.bagLayout.splice(index, 1);
    if (!item) return;
    const id = `drop-${++this.dropSerial}`;
    this.crates.push(makeCrate({
      id,
      name: '地面物资',
      x: this.player.x + 0.8,
      z: this.player.z,
      loot: [item],
    }, true));
  }
  consume(zone: 'bag' | 'secure', index: number): boolean {
    if (this.paused || this.phase !== 'raid' || this.reload || this.healing || !Number.isInteger(index) || index < 0) return false;
    const inventory = this.inventories[zone]!, item = inventory.items[index], effect = item && ITEMS[item].consume;
    if (!effect) return false;
    const hp = Math.min(effect.hp, 100 - this.player.hp), stamina = Math.min(effect.stamina, 100 - this.player.stamina);
    if (hp <= 0 && stamina <= 0) { this.notify('现在不饿也不累 · 留着带回吧'); return false; }
    if (zone === 'bag') { this.bag.splice(index, 1); this.bagLayout.splice(index, 1); }
    else { this.secure = null; this.secureLayout = null; }
    this.player.hp += hp; this.player.stamina += stamina;
    this.events.push('eat'); this.notify(`${ITEMS[item].name} · 生命 +${Math.round(hp)} / 体力 +${Math.round(stamina)}`);
    return true;
  }
  startReload() {
    if (
      this.paused ||
      this.phase !== 'raid' ||
      this.reload ||
      this.healing ||
      this.mag === WEAPONS[this.loadout.weapon].mag ||
      !this.ammo
    )
      return;
    this.reload = WEAPONS[this.loadout.weapon].reload;
    this.events.push('reload');
  }
  heal() {
    if (
      this.paused ||
      this.phase !== 'raid' ||
      this.healing ||
      this.reload ||
      !this.meds
    )
      return;
    if (this.player.hp >= 100 && !this.player.bleed) {
      this.notify('状态良好 · 无需使用医疗包');
      return;
    }
    this.healing = 2.5;
    this.notify('正在包扎 · 移动或受击会打断');
  }
  move(
    entity: { x: number; z: number },
    dx: number,
    dz: number,
    radius = 0.55,
  ) {
    if (!collides(entity.x + dx, entity.z, radius)) entity.x += dx;
    if (!collides(entity.x, entity.z + dz, radius)) entity.z += dz;
  }
  fire() {
    const w = WEAPONS[this.loadout.weapon];
    if (this.paused || this.phase !== 'raid' || this.search || this.cooldown || this.reload || this.healing) return;
    if (this.mag <= 0) {
      if (this.ammo) this.startReload();
      else { this.cooldown = .25; this.events.push('dryFire'); }
      return;
    }
    this.mag--;
    this.cooldown = w.interval;
    this.events.push('shot');
    const p = this.player,
      spread = (w.spread + this.recoil * .015) * (this.input.ads ? 0.25 : 1) * (p.moving ? 1.5 : 1);
    // The local muzzle matches the character's rifle. Converge toward the aim
    // point from there, rather than sending a displaced barrel parallel to it.
    const barrel = Math.min(this.loadout.suppressor ? 1.5 : this.loadout.weapon === 'heron' ? 1.41 : this.loadout.weapon === 'shrike' ? 1.32 : 1.36,
      Math.max(.35, Math.hypot(this.input.aimX - p.x, this.input.aimZ - p.z) - .3));
    const mx = p.x + Math.sin(p.angle) * barrel + Math.cos(p.angle) * .19;
    const mz = p.z + Math.cos(p.angle) * barrel - Math.sin(p.angle) * .19;
    const aim = Math.hypot(this.input.aimX - p.x, this.input.aimZ - p.z) > barrel + .3
      ? Math.atan2(this.input.aimX - mx, this.input.aimZ - mz) : p.angle;
    const angle = aim + (this.random() - 0.5) * spread * 2,
      dx = Math.sin(angle),
      dz = Math.cos(angle);
    this.lastShot = this.elapsed; this.shotCount++;
    this.recoil = Math.min(1.6, this.recoil + w.kick * (this.input.ads ? .65 : 1));
    this.casings.push({ x: p.x + Math.cos(p.angle) * .35, z: p.z - Math.sin(p.angle) * .35,
      vx: Math.cos(p.angle) * 3.2, vz: -Math.sin(p.angle) * 3.2, age: 0 });
    const obstruction = bulletWallHit(p.x, p.z, mx, mz);
    if (obstruction !== null) this.impact(p.x + (mx - p.x) * obstruction, p.z + (mz - p.z) * obstruction, 'wall');
    else this.bullets.push({ id: ++this.bulletSerial, x: mx, z: mz, vx: dx * w.bulletSpeed, vz: dz * w.bulletSpeed,
      life: (w.range - barrel) / w.bulletSpeed, damage: w.damage, enemy: false, weapon: this.loadout.weapon, travelled: 0, trail: w.trail, bornAt: this.elapsed });
    const radius = this.loadout.suppressor ? 9 : 26;
    this.noise = this.loadout.suppressor ? 0.5 : 1;
    for (const e of this.enemies)
      if (e.hp > 0 && distance(e, p) < radius) {
        e.alert = 7;
        e.targetX = p.x;
        e.targetZ = p.z;
        if (e.mode !== 'engage') e.mode = 'investigate';
      }
  }
  private impact(x: number, z: number, kind: Impact['kind']) {
    this.impacts.push({ x, z, life: kind === 'kill' ? .3 : .18, kind });
    if (kind === 'wall') this.events.push('wallHit');
  }
  private hitEnemy(e: Enemy, b: Bullet) {
    const absorbed = Math.min(e.armor, b.damage * (b.weapon === 'heron' ? .15 : .5));
    e.armor -= absorbed; e.hp = Math.max(0, e.hp - (b.damage - absorbed));
    e.hurt = .22; e.alert = 8; e.mode = 'engage';
    const kind = e.hp <= 0 ? 'kill' : absorbed > 0 ? 'armor' : 'flesh';
    this.impact(b.x, b.z, kind);
    this.hitFeedback = { x: b.x, z: b.z, life: kind === 'kill' ? .32 : .2, kind, damage: Math.round(b.damage - absorbed) };
    this.events.push(kind === 'kill' ? 'kill' : kind === 'armor' ? 'armorHit' : 'hit');
    if (e.hp <= 0) {
      e.windup = 0; e.killedAt = this.elapsed; this.kills++;
      this.ammo += e.elite ? 24 : 12;
      this.crates.push(makeCrate({ id: `enemy-${e.id}`, name: e.elite ? '守望者随身箱' : '巡逻兵的口袋',
        x: e.x, z: e.z, loot: e.elite ? ['cpu_9800x3d', 'gym_pass'] : [e.id % 2 ? 'sicily_lemon' : 'beef_jerky', e.id % 3 ? 'biscuit_note' : 'medicine'] }));
      this.notify(e.elite ? '守望者已击破 · 雷达通路安全' : '目标已击破 · 补充弹药 +12');
    }
  }
  hurt(damage: number) {
    const p = this.player,
      absorbed = Math.min(p.armor, damage * 0.7);
    p.armor -= absorbed;
    p.hp -= damage - absorbed;
    if (p.armor <= 0 && this.random() < 0.22) p.bleed = true;
    p.hurt = 0.3;
    this.lastHit = this.elapsed;
    this.healing = 0;
    this.extraction = 0;
    this.events.push('hurt');
    if (p.hp <= 0) this.finish(false, '行动失败 · 生命信号丢失');
  }
  finish(success: boolean, reason: string) {
    if (this.phase !== 'raid') return;
    this.phase = success ? 'won' : 'lost';
    this.reason = reason;
    this.search = null;
    this.events.push('extract');
  }
  result(): Settlement {
    return {
      success: this.phase === 'won',
      reason: this.reason,
      bag: [...this.bag],
      secure: this.secure,
      kills: this.kills,
      elapsed: this.elapsed,
      x: this.player.x,
      z: this.player.z,
      meds: this.meds,
      armor: this.player.armor,
      powered: this.powered,
      radar: this.radar,
      recovered: this.recovered,
    };
  }
  update(dt: number) {
    if (this.paused || this.phase !== 'raid' || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    if (this.elapsed >= this.limit) {
      this.finish(false, '撤离窗口关闭 · 行动超时');
      return;
    }
    const p = this.player,
      i = this.input;
    const before = { x: p.x, z: p.z };
    const enemyBefore = new Map(this.enemies.map(e => [e.id, { x: e.x, z: e.z }]));
    this.impacts.forEach(f => f.life -= dt); this.impacts = this.impacts.filter(f => f.life > 0);
    this.casings.forEach(c => { c.age += dt; c.x += c.vx * dt * Math.exp(-c.age * 3); c.z += c.vz * dt * Math.exp(-c.age * 3); });
    this.casings = this.casings.filter(c => c.age < .65);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (this.hitFeedback) { this.hitFeedback.life -= dt; if (this.hitFeedback.life <= 0) this.hitFeedback = null; }
    this.toastTime = Math.max(0, this.toastTime - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    this.noise = Math.max(0, this.noise - dt * 0.35);
    const moving = Math.hypot(i.x, i.z) > 0.01,
      sprint =
        i.sprint &&
        moving &&
        p.stamina > 1 &&
        !i.crouch &&
        !i.ads &&
        !this.search;
    p.moving = moving;
    p.stamina = Math.max(
      0,
      Math.min(100, p.stamina + (sprint ? -24 : 15) * dt),
    );
    const speed =
      (sprint ? 8.4 : i.crouch ? 2.5 : i.ads ? 3 : 5.2) *
      (this.bagWeight > this.maxWeight ? 0.65 : 1);
    if (moving) {
      const n = Math.max(1, Math.hypot(i.x, i.z));
      this.move(p, (i.x / n) * speed * dt, (i.z / n) * speed * dt);
      this.healing = 0;
    }
    p.angle = Math.atan2(i.aimX - p.x, i.aimZ - p.z);
    if (this.reload > 0) {
      this.reload = Math.max(0, this.reload - dt);
      if (!this.reload) {
        const amount = Math.min(
          WEAPONS[this.loadout.weapon].mag - this.mag,
          this.ammo,
        );
        this.mag += amount;
        this.ammo -= amount;
      }
    }
    if (this.healing > 0) {
      this.healing = Math.max(0, this.healing - dt);
      if (!this.healing) {
        this.meds--;
        p.hp = Math.min(100, p.hp + 55);
        p.bleed = false;
        this.notify('包扎完成 · 恢复生命并止血');
      }
    }
    if (p.bleed) {
      p.hp -= dt * 0.65;
      if (p.hp <= 0) {
        this.finish(false, '伤势恶化 · 失血过多');
        return;
      }
    }
    if (i.fire && !this.search && !sprint) this.fire();
    if (this.search) {
      const c = this.crates.find((c) => c.id === this.search);
      if (!c || distance(c, p) > 3) this.search = null;
      else {
        if (c.revealed < c.loot.length) {
          c.searched += dt;
          while (c.searched >= .7 && c.revealed < c.loot.length) {
            const index = c.identified.indexOf(false);
            if (index < 0) break;
            c.identified[index] = true; c.revealed++; c.searched -= .7;
          }
        } else c.searched = 0;
      }
    }
    if (this.powerProgress > 0) {
      if (distance(p, POWER) > 3 || this.elapsed - this.lastHit < 0.1)
        this.powerProgress = 0;
      else {
        this.powerProgress += dt;
        if (this.powerProgress >= 3) {
          this.powered = true;
          this.powerProgress = 0;
          this.notify('供电恢复 · 北侧货运撤离已开放');
        }
      }
    }
    if (this.radarProgress > 0) {
      if (distance(p, RADAR) > 3 || this.elapsed - this.lastHit < 0.1)
        this.radarProgress = 0;
      else {
        this.radarProgress += dt;
        if (this.radarProgress >= 4) {
          this.radar = true;
          this.radarProgress = 0;
          this.crates.push(makeCrate({
            id: 'signal-core',
            name: '归航信号核心',
            x: RADAR.x + 1.5,
            z: RADAR.z + 1,
            loot: ['core'],
          }, true));
          this.notify('信号恢复 · 取走核心并安全撤离');
        }
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.hurt = Math.max(0, e.hurt - dt);
      const d = distance(e, p),
        visible =
          d < (i.crouch ? 8 : sprint ? 19 : 14) && !blocked(e.x, e.z, p.x, p.z);
      e.alert = Math.max(0, e.alert - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (visible) {
        e.mode = 'engage';
        e.alert = 5;
        e.targetX = p.x;
        e.targetZ = p.z;
      } else if (!e.alert) e.mode = 'patrol';
      if (sprint && d < 13 && e.mode === 'patrol') {
        e.mode = 'investigate';
        e.targetX = p.x;
        e.targetZ = p.z;
        e.alert = 3;
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const aim =
            Math.atan2(e.targetX - e.x, e.targetZ - e.z) +
            (this.random() - 0.5) * 0.1;
          const mx = e.x + Math.sin(aim) * 1.3, mz = e.z + Math.cos(aim) * 1.3;
          const obstruction = bulletWallHit(e.x, e.z, mx, mz);
          if (obstruction !== null) this.impact(e.x + (mx - e.x) * obstruction, e.z + (mz - e.z) * obstruction, 'wall');
          else this.bullets.push({
            id: ++this.bulletSerial,
            x: mx,
            z: mz,
            vx: Math.sin(aim) * 30,
            vz: Math.cos(aim) * 30,
            life: 1,
            damage: e.elite ? 22 : 14,
            enemy: true, weapon: e.elite ? 'heron' : 'kestrel', travelled: 0, trail: .95, bornAt: this.elapsed,
          });
          e.lastShot = this.elapsed; e.angle = aim;
          e.cooldown = e.elite ? 0.95 : 1.65;
          this.events.push('enemyShot');
        }
      } else if (visible && d < 21 && e.cooldown <= 0) {
        e.windup = e.elite ? 0.5 : 0.8;
        e.targetX = p.x;
        e.targetZ = p.z;
      } else {
        let tx = e.targetX,
          tz = e.targetZ;
        if (e.mode === 'patrol') {
          tx = e.homeX + Math.sin(this.elapsed * 0.2 + e.id) * 2.5;
          tz = e.homeZ + Math.cos(this.elapsed * 0.2 + e.id) * 2;
        }
        const td = Math.hypot(tx - e.x, tz - e.z);
        e.angle = Math.atan2(tx - e.x, tz - e.z);
        if (td > 0.4 && (e.mode !== 'engage' || d > 9 || !visible))
          this.move(
            e,
            ((tx - e.x) / td) * dt * (e.mode === 'patrol' ? 1 : 2.3),
            ((tz - e.z) / td) * dt * (e.mode === 'patrol' ? 1 : 2.3),
          );
      }
    }
    for (const b of this.bullets) {
      if (b.bornAt === this.elapsed) continue;
      const duration = Math.min(dt, b.life), ax = b.x, az = b.z, nx = ax + b.vx * duration, nz = az + b.vz * duration;
      let first = bulletWallHit(ax, az, nx, nz), victim: Enemy | 'player' | null = null;
      const targetHit = (x: number, z: number, old: { x: number; z: number }, radius: number) =>
        segmentCircleHit(ax - old.x, az - old.z, nx - x, nz - z, 0, 0, radius);
      if (b.enemy) {
        const t = targetHit(p.x, p.z, before, .65);
        if (t !== null && (first === null || t < first)) { first = t; victim = 'player'; }
      } else for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const t = targetHit(e.x, e.z, enemyBefore.get(e.id)!, .72);
        if (t !== null && (first === null || t < first)) { first = t; victim = e; }
      }
      const fraction = first ?? 1;
      b.x = ax + (nx - ax) * fraction; b.z = az + (nz - az) * fraction;
      b.travelled += Math.hypot(nx - ax, nz - az) * fraction; b.life -= duration;
      if (first !== null) {
        b.life = 0;
        if (victim === 'player') { this.impact(b.x, b.z, p.armor > 0 ? 'armor' : 'flesh'); this.hurt(b.damage); }
        else if (victim) this.hitEnemy(victim, b);
        else this.impact(b.x, b.z, 'wall');
      }
      if (this.phase !== 'raid') break;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    if (this.phase !== 'raid') return;
    const exit = EXITS.find(
      (e) => distance(e, p) < 3 && (!e.requiresPower || this.powered),
    );
    if (exit && this.elapsed - this.lastHit > 1) {
      if (exit.id !== this.extractionId) this.extraction = 0;
      this.extractionId = exit.id;
      this.extraction += dt;
      if (this.extraction >= 6) this.finish(true, `${exit.name} · 安全撤离`);
    } else {
      this.extraction = 0;
      this.extractionId = '';
    }
  }
  text() {
    return {
      mode: 'extraction',
      phase: this.phase,
      coordinates: 'metres; X east/right, Z south/down, Y up',
      elapsed: this.elapsed,
      remaining: this.limit - this.elapsed,
      paused: this.paused,
      player: {
        ...this.player,
        weapon: this.loadout.weapon,
        mag: this.mag,
        ammo: this.ammo,
        meds: this.meds,
        reload: this.reload,
        healing: this.healing,
      },
      bag: this.bag,
      bagLayout: this.inventories.bag!.slots,
      bagGrid: this.grid,
      usedCells: this.usedCells,
      secure: this.secure,
      secureLayout: this.secureLayout,
      weight: this.bagWeight,
      capacity: this.capacity,
      kills: this.kills,
      ballistics: { shots: this.shotCount, lastShot: this.lastShot, recoil: this.recoil,
        bullets: this.bullets.map(b => ({ ...b })), impacts: this.impacts.map(f => ({ ...f })),
        hit: this.hitFeedback, casings: this.casings.length },
      nearby: this.nearby,
      search: this.search
        ? this.crates.find((c) => c.id === this.search)
        : null,
      crates: this.crates.filter((c) => c.loot.length),
      enemies: this.enemies
        .filter((e) => e.hp > 0)
        .map((e) => ({
          id: e.id,
          x: e.x,
          z: e.z,
          hp: e.hp,
          armor: e.armor,
          mode: e.mode,
          windup: e.windup,
          elite: e.elite,
        })),
      exits: EXITS.map((e) => ({
        ...e,
        open: !e.requiresPower || this.powered,
      })),
      powered: this.powered,
      radar: this.radar,
      powerProgress: this.powerProgress,
      radarProgress: this.radarProgress,
      extraction: this.extraction,
      lost: this.lost,
      recovered: this.recovered,
      reason: this.reason,
    };
  }
}
