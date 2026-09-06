import Phaser from 'phaser';
import { createArt, drawWorld } from './art';
import { LanternAudio } from './audio';
import { stepHorizontalCamera, type CameraMotion } from './camera';
import { createBrain, ENEMY_SPAWNS, RETURN_SPAWNS, stepEnemy, strikeDamage, type EnemyBrain, type EnemySpawn } from './combat';
import { getControlLesson, getTeaRestoration, MAX_HEALTH, nextRelic, POINTS, RELICS, RETURN_WINDOW, roomAt, TERRAIN, WEAPONS, WORLD_WIDTH, type Control, type ControlLesson, type Phase, type Progress, type RelicId, type RunResult, type Weapon } from './model';

type BodySprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
const bodyRect = (body: { x: number; y: number; width: number; height: number }) => new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
type Direction = 'left' | 'right' | 'up' | 'down';
interface Enemy { brain: EnemyBrain; sprite: BodySprite; warning: Phaser.GameObjects.Graphics; bar: Phaser.GameObjects.Graphics; hitAttack: number }
interface Shot {
  image: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  vx: number; vy: number; born: number; ttl: number; friendly: boolean; damage: number;
  kind: 'bolt' | 'wave' | 'feather'; returning: boolean; hits: Set<string>; originX: number;
}
interface Swing { weapon: Weapon; direction: Direction; at: number; hit: boolean; graphic: Phaser.GameObjects.Graphics | null; featherCue: Phaser.GameObjects.Image | null }

export interface LanternSnapshot {
  mode: 'lantern';
  phase: Phase;
  paused: boolean;
  pauseReason: string;
  room: string;
  roomId: string;
  visited: string[];
  health: number;
  maxHealth: number;
  weapon: Weapon;
  attack: { weapon: Weapon; visual: 'slash' | 'throw'; direction: Direction; released: boolean } | null;
  empowered: boolean;
  lightMs: number;
  elapsedMs: number;
  coreTaken: boolean;
  relic: RelicId | null;
  offeredRelic: RelicId;
  routeChoice: boolean;
  destination: 'home' | 'relic';
  restUsed: boolean;
  kills: number;
  damageTaken: number;
  objective: string;
  target: { x: number; y: number; name: string; direction: 'left' | 'right'; distance: number };
  interaction: { id: 'core' | 'rest' | 'home' | 'relic'; label: string; enabled: boolean } | null;
  extraction: number;
  result: RunResult | null;
  message: string;
  guidance: { lesson: ControlLesson | null; learned: ControlLesson[] };
  player: { x: number; y: number; vx: number; vy: number; grounded: boolean; facing: number; dashing: boolean; dashReady: boolean };
  enemies: Array<{ id: string; kind: string; x: number; y: number; hp: number; maxHp: number; phase: string; pattern: string; facing: number }>;
  shots: Array<{ x: number; y: number; friendly: boolean; kind: string; returning: boolean }>;
  terrain: typeof TERRAIN;
  camera: { x: number; y: number; width: number; height: number; zoom: number; lookAhead: number };
  coordinateSystem: string;
}

interface Options {
  progress: Progress;
  onState: (state: LanternSnapshot) => void;
  onStart: () => void;
  onResult: (result: RunResult) => void;
  onReady: () => void;
  onLoadError: () => void;
  onLearnControl: (lesson: ControlLesson) => void;
}

export class LanternScene extends Phaser.Scene {
  private readonly options: Options;
  private player!: BodySprite;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private visuals!: ReturnType<typeof drawWorld>;
  private backdrop!: Phaser.GameObjects.Image;
  private gateBody!: Phaser.Types.Physics.Arcade.ImageWithStaticBody;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private carriedLight!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private controls = new Set<Control>();
  private presses = new Set<Control>();
  private audio: LanternAudio;
  private timeMs = 0;
  private elapsedMs = 0;
  private phase: Phase = 'home';
  private paused = false;
  private pauseReason = '';
  private health = MAX_HEALTH;
  private weapon: Weapon;
  private coreTaken = false;
  private lightMs = RETURN_WINDOW;
  private relic: RelicId | null = null;
  private offeredRelic: RelicId;
  private restUsed = false;
  private routeDecided = false;
  private destination: 'home' | 'relic' = 'home';
  private facing = 1;
  private groundedAt = -1000;
  private jumpAt = -1000;
  private dashUntil = 0;
  private dashReadyAt = 0;
  private hurtUntil = 0;
  private staggerUntil = 0;
  private attackReadyAt = 0;
  private hitstop = 0;
  private swing: Swing | null = null;
  private extraction = 0;
  private extracting = false;
  private kills = 0;
  private damageTaken = 0;
  private result: RunResult | null = null;
  private visited = new Set(['home']);
  private message = '';
  private messageUntil = 0;
  private lastPublishAt = -1000;
  private lastTrailAt = 0;
  private lastSafe = { x: 360, y: 665 };
  private pointerAttack = false;
  private pausePressed = false;
  private fullscreenPressed = false;
  private learnedControls: Set<ControlLesson>;
  private learningStartX = 360;
  private cameraMotion: CameraMotion = { lookAhead: 0, lookTarget: 0, direction: 0, stableMs: 0 };
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(options: Options) {
    super({ key: 'LanternRun' });
    this.options = options;
    this.weapon = options.progress.weapon;
    this.offeredRelic = nextRelic(options.progress);
    this.audio = new LanternAudio(options.progress.muted);
    this.learnedControls = new Set(options.progress.learnedControls);
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.options.onLoadError);
    this.load.image('lantern-sui', `${import.meta.env.BASE_URL}assets/sui-bird.png`);
    this.load.image('lantern-garden', `${import.meta.env.BASE_URL}assets/lantern/garden.webp`);
  }

  create(): void {
    createArt(this);
    this.backdrop = this.add.image(0, 0, 'lantern-garden').setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.visuals = drawWorld(this, this.options.progress.returns > 0);
    this.visuals.relic.setTexture(`lantern-relic-${this.offeredRelic}`);
    this.ground = this.physics.add.staticGroup();
    for (const tile of TERRAIN) {
      const body = this.ground.create(tile.x + tile.width / 2, tile.top + tile.height / 2, 'lantern-solid') as Phaser.Types.Physics.Arcade.ImageWithStaticBody;
      body.setDisplaySize(tile.width, tile.height).refreshBody().setVisible(false);
    }
    this.gateBody = this.physics.add.staticImage(3750, 587, 'lantern-solid').setDisplaySize(32, 226).refreshBody().setVisible(false);
    this.physics.world.setBounds(0, -600, WORLD_WIDTH, 2100);
    this.playerShadow = this.add.ellipse(360, 697, 58, 9, 0x203b2f, 0.2).setDepth(4);
    this.player = this.physics.add.sprite(360, 659, 'lantern-sui').setDisplaySize(81, 58).setDepth(10).setFlipX(true);
    this.player.body.setSize(175, 190, true);
    this.player.setCollideWorldBounds(true).setMaxVelocity(900, 1100);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.gateBody);
    this.carriedLight = this.add.image(340, 643, 'lantern-core').setDisplaySize(29, 36).setDepth(11).setVisible(false);
    ENEMY_SPAWNS.forEach((spawn) => this.spawnEnemy(spawn));
    this.keys = this.input.keyboard!.addKeys({
      left: 'A', right: 'D', up: 'W', down: 'S', leftArrow: 'LEFT', rightArrow: 'RIGHT', upArrow: 'UP', downArrow: 'DOWN',
      jump: 'SPACE', attack: 'J', attackAlt: 'X', attackClient: 'B', dash: 'K', dashAlt: 'SHIFT', interact: 'E', interactAlt: 'ENTER', pause: 'ESC', pauseAlt: 'P', fullscreen: 'F',
    }, false) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.audio.unlock();
      if (pointer.rightButtonDown()) this.presses.add('dash');
      else this.pointerAttack = true;
    });
    this.input.on('pointerup', () => { this.pointerAttack = false; });
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      this.audio.unlock();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const uiTarget = event.target instanceof Element && event.target.closest('button, a, input, select, textarea');
      if (uiTarget && (event.code === 'Space' || event.code === 'Enter')) {
        this.keys.jump.reset();
        this.keys.interactAlt.reset();
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Space') this.presses.add('jump');
      if (event.code === 'KeyK' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.presses.add('dash');
      if (event.code === 'KeyE' || event.code === 'Enter') this.presses.add('interact');
      if (event.code === 'KeyJ' || event.code === 'KeyX' || event.code === 'KeyB') this.presses.add('attack');
      if (event.code === 'Escape' || event.code === 'KeyP') this.pausePressed = true;
      if (event.code === 'KeyF') this.fullscreenPressed = true;
    });
    this.scale.on('resize', this.resizeView, this);
    this.resizeView();
    this.cameras.main.centerOn(500, 440);
    const onBlur = () => { if (this.phase === 'outbound' || this.phase === 'returning') this.setPaused(true, '旅途已暂停'); };
    const onVisibility = () => { if (document.hidden) onBlur(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audio.dispose();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      this.scale.off('resize', this.resizeView, this);
      this.input.keyboard?.removeAllListeners();
    });
    this.publish();
    this.options.onReady();
  }

  private resizeView(): void {
    const { width, height } = this.scale;
    const zoom = Phaser.Math.Clamp(Math.min(width / 1152, height / 720), 0.72, 1.65);
    this.cameras.main.setZoom(zoom).setBounds(0, -500, WORLD_WIDTH, 2000);
    this.positionBackdrop();
  }

  private positionBackdrop(): void {
    if (!this.backdrop) return;
    const { width, height } = this.scale;
    const zoom = this.cameras.main.zoom;
    const scale = Math.max(width / this.backdrop.width, height / this.backdrop.height) / zoom;
    const bgWidth = this.backdrop.width * scale;
    const bgHeight = this.backdrop.height * scale;
    const progress = Phaser.Math.Clamp(this.player?.x / WORLD_WIDTH || 0, 0, 1);
    this.backdrop.setScale(scale).setPosition(
      width * (1 - 1 / zoom) / 2 - Math.max(0, bgWidth - width / zoom) * (0.12 + progress * 0.65),
      height * (1 - 1 / zoom) / 2 - (bgHeight - height / zoom) / 2,
    );
  }

  setControl(control: Control, down: boolean): void {
    this.audio.unlock();
    if (down) {
      if (!this.controls.has(control)) this.presses.add(control);
      this.controls.add(control);
    } else this.controls.delete(control);
  }

  clearControls(): void {
    this.controls.clear();
    this.presses.clear();
    this.pointerAttack = false;
    this.input?.keyboard?.resetKeys();
  }

  setWeapon(weapon: Weapon): void {
    if (this.phase !== 'home' || (weapon === 'feather' && this.options.progress.returns === 0)) return;
    this.weapon = weapon;
    this.publish();
  }

  setMuted(muted: boolean): void { this.audio.unlock(); this.audio.setMuted(muted); }

  resetControlLessons(): void {
    this.learnedControls.clear();
    this.learningStartX = this.player?.x ?? 360;
    this.publish();
  }

  private learnControl(lesson: ControlLesson): void {
    if (this.learnedControls.has(lesson)) return;
    this.learnedControls.add(lesson);
    this.options.onLearnControl(lesson);
  }

  chooseDestination(destination: 'home' | 'relic'): void {
    if (!this.coreTaken || this.result) return;
    this.destination = destination;
    this.routeDecided = true;
    this.publish();
  }

  depart(): void {
    if (this.phase !== 'home') return;
    this.audio.unlock();
    this.phase = 'outbound';
    this.options.onStart();
    this.publish();
  }

  setPaused(paused: boolean, reason = ''): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.paused = paused;
    this.pauseReason = reason;
    this.clearControls();
    if (paused) this.physics.pause(); else if (this.hitstop <= 0) this.physics.resume();
    this.publish();
  }

  abandon(): void { this.finish('lost', '这次先回去歇一歇。'); }

  private down(...names: string[]): boolean { return names.some((name) => this.keys[name]?.isDown || this.controls.has(name as Control)); }
  private pressed(control: Control, ...keys: string[]): boolean {
    const virtual = this.presses.delete(control);
    return keys.reduce((pressed, key) => Phaser.Input.Keyboard.JustDown(this.keys[key]) || pressed, virtual);
  }

  update(_time: number, rawDelta: number): void {
    if (!this.player) return;
    if (this.fullscreenPressed) {
      this.fullscreenPressed = false;
      if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
    }
    if (this.pausePressed) { this.pausePressed = false; this.setPaused(!this.paused); }
    this.audio.update(this.coreTaken, this.paused || this.phase === 'won' || this.phase === 'lost');
    this.positionBackdrop();
    if (this.paused || this.phase === 'won' || this.phase === 'lost') return;
    const delta = Math.min(40, rawDelta);
    if (this.hitstop > 0) {
      this.hitstop -= delta;
      if (this.hitstop <= 0) this.physics.resume();
      return;
    }
    this.timeMs += delta;
    if (this.phase !== 'home') this.elapsedMs += delta;
    if (this.coreTaken) {
      this.lightMs = Math.max(0, this.lightMs - delta);
      if (this.lightMs === 0) { this.finish('lost', '灯芯熄灭了。下次，可以早一点回家。'); return; }
    }
    this.updateMovement(delta);
    if (this.phase === 'home' && this.player.x > 550) this.depart();
    this.updateAttack();
    if (this.phase !== 'home') this.updateEnemies();
    this.updateShots(delta);
    if (this.pressed('interact', 'interact', 'interactAlt')) this.interact();
    if (this.extracting) {
      if (Math.abs(this.player.x - POINTS.home.x) > 100 || Math.abs(this.player.y - POINTS.home.y) > 85) {
        this.extracting = false;
        this.extraction = 0;
      } else {
        this.extraction += delta / 1500;
        if (this.extraction >= 1) { this.finish('won', '你把光带回来了。'); return; }
      }
    }
    this.visited.add(roomAt(this.player.x).id);
    this.updateCamera(delta);
    this.updatePlayerArt();
    if (this.timeMs - this.lastPublishAt > 85) this.publish();
  }

  private updateMovement(delta: number): void {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) {
      this.groundedAt = this.timeMs;
      if (!this.enemies.some((enemy) => enemy.brain.hp > 0 && Math.abs(enemy.sprite.x - this.player.x) < 95 && Math.abs(enemy.sprite.y - this.player.y) < 100)) this.lastSafe = { x: this.player.x, y: this.player.y - 3 };
    }
    if (this.pressed('jump', 'jump')) this.jumpAt = this.timeMs;
    if (this.timeMs < this.dashUntil) {
      body.allowGravity = false;
      this.player.setVelocity(this.facing * 790, 0);
      if (this.timeMs - this.lastTrailAt > 32) {
        const echo = this.add.image(this.player.x, this.player.y, 'lantern-sui').setDisplaySize(81, 58).setFlipX(this.facing > 0).setAlpha(0.22).setTint(0xbbe8d1).setDepth(9);
        this.tweens.add({ targets: echo, alpha: 0, duration: 180, onComplete: () => echo.destroy() });
        this.lastTrailAt = this.timeMs;
      }
      return;
    }
    body.allowGravity = true;
    if (this.timeMs < this.staggerUntil) return;
    const left = this.down('left', 'leftArrow');
    const right = this.down('right', 'rightArrow');
    const direction = left === right ? 0 : left ? -1 : 1;
    if (direction && Math.abs(this.player.x - this.learningStartX) > 35) this.learnControl('move');
    if (direction) this.facing = direction;
    this.player.setVelocityX(Phaser.Math.Linear(body.velocity.x, direction * 325, 1 - Math.exp(-delta / (grounded ? 36 : 74))));
    if (this.timeMs - this.jumpAt < 170 && this.timeMs - this.groundedAt < 110) {
      this.player.setVelocityY(-790);
      this.learnControl('jump');
      this.jumpAt = -1000;
      this.groundedAt = -1000;
      this.audio.play('jump');
      this.burst(this.player.x, this.player.y + 22, 0xf1eddb, 5);
    }
    if (!this.down('jump') && body.velocity.y < -330) this.player.setVelocityY(-330);
    if (this.pressed('dash', 'dash', 'dashAlt') && this.timeMs >= this.dashReadyAt) {
      this.dashUntil = this.timeMs + 160;
      this.learnControl('dash');
      this.dashReadyAt = this.timeMs + 700;
      this.audio.play('dash');
    }
    if (this.player.y > 1100) {
      this.hurt(-this.facing);
      this.player.body.reset(this.lastSafe.x, this.lastSafe.y);
      this.player.setVelocity(0, 0);
    }
  }

  private attackDirection(): Direction {
    if (this.down('up', 'upArrow')) return 'up';
    if (this.down('down', 'downArrow') && !this.player.body.blocked.down) return 'down';
    return this.facing < 0 ? 'left' : 'right';
  }

  private updateAttack(): void {
    const attackPressed = this.presses.delete('attack');
    const attacking = this.down('attack', 'attackAlt', 'attackClient') || this.pointerAttack || attackPressed;
    if (attacking && this.timeMs >= this.attackReadyAt && this.timeMs >= this.dashUntil && !this.swing) {
      this.learnControl('attack');
      this.audio.play(this.weapon === 'feather' ? 'throw' : 'slash');
      const direction = this.attackDirection();
      this.attackReadyAt = this.timeMs + WEAPONS[this.weapon].cooldownMs;
      this.swing = {
        weapon: this.weapon, direction, at: this.timeMs, hit: false,
        graphic: this.weapon === 'blade' ? this.add.graphics().setDepth(14) : null,
        featherCue: this.weapon === 'feather' ? this.add.image(this.player.x, this.player.y, 'lantern-feather').setDisplaySize(35, 17).setDepth(14) : null,
      };
    }
    const swing = this.swing;
    if (!swing) return;
    const age = this.timeMs - swing.at;
    const angle = swing.direction === 'left' ? Math.PI : swing.direction === 'up' ? -Math.PI / 2 : swing.direction === 'down' ? Math.PI / 2 : 0;
    if (swing.graphic) {
      swing.graphic.clear().setPosition(this.player.x, this.player.y);
      swing.graphic.lineStyle(this.coreTaken ? 14 : 10, this.coreTaken ? 0xffe8a4 : 0xf8f8ee, Math.max(0, 1 - age / 210));
      swing.graphic.beginPath().arc(0, 0, 72, angle - 0.8 + age / 220, angle + 0.8 + age / 220).strokePath();
      swing.graphic.lineStyle(2, 0x43695a, 0.8).beginPath().arc(0, 0, 80, angle - 0.6 + age / 220, angle + 0.65 + age / 220).strokePath();
    }
    swing.featherCue?.setPosition(this.player.x + Math.cos(angle) * 27, this.player.y + Math.sin(angle) * 27 - 6).setRotation(angle);
    if (age > 55 && !swing.hit) {
      swing.hit = true;
      swing.featherCue?.setVisible(false);
      if (swing.weapon === 'feather') this.fireFriendly('feather', angle);
      else this.melee(swing.direction);
      if (this.coreTaken && swing.direction !== 'down') this.fireFriendly('wave', angle);
    }
    if (age > 210) { swing.graphic?.destroy(); swing.featherCue?.destroy(); this.swing = null; }
  }

  private melee(direction: Direction): void {
    const vertical = direction === 'up' || direction === 'down';
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const range = this.coreTaken ? 123 : 104;
    const rect = new Phaser.Geom.Rectangle(this.player.x + dx * range * 0.48 - (vertical ? 36 : range / 2), this.player.y + dy * range * 0.48 - (vertical ? range / 2 : 33), vertical ? 72 : range, vertical ? range : 66);
    let bounced = false;
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || enemy.brain.hp <= 0 || !Phaser.Geom.Intersects.RectangleToRectangle(rect, bodyRect(enemy.sprite.body))) continue;
      const damage = strikeDamage(enemy.brain, this.player.x, this.coreTaken, direction === 'down');
      this.hitEnemy(enemy, damage);
      if (direction === 'down' && damage > 0) bounced = true;
    }
    for (const shot of this.shots) {
      if (!shot.friendly && rect.contains(shot.image.x, shot.image.y)) {
        shot.friendly = true;
        shot.vx = dx === 0 ? -shot.vx * 1.5 : dx * 590;
        shot.vy = dy === 0 ? -shot.vy : dy * 590;
        if (shot.image instanceof Phaser.GameObjects.Ellipse) shot.image.setFillStyle(0xffedaa);
        shot.damage = 3;
        this.audio.play('block');
        this.burst(shot.image.x, shot.image.y, 0xffecba, 7);
      }
    }
    if (bounced) {
      this.player.setVelocityY(-660);
      this.groundedAt = -1000;
      if (this.coreTaken) {
        const ring = this.add.ellipse(this.player.x, this.player.y + 42, 50, 17).setStrokeStyle(5, 0xffe3a1).setDepth(15);
        this.tweens.add({ targets: ring, scaleX: 5, scaleY: 2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
        for (const enemy of this.enemies) if (enemy.brain.hp > 0 && Math.abs(enemy.sprite.x - this.player.x) < 160 && Math.abs(enemy.sprite.y - this.player.y) < 125 && this.timeMs - enemy.brain.lastHitAt > 80) this.hitEnemy(enemy, 2);
      }
    }
  }

  private fireFriendly(kind: 'wave' | 'feather', angle: number): void {
    const image = kind === 'feather'
      ? this.add.image(this.player.x, this.player.y, 'lantern-feather').setDisplaySize(50, 24).setDepth(13)
      : this.add.ellipse(this.player.x, this.player.y, 12, 42, 0xffe9a3, 0.85).setStrokeStyle(2, 0xfff7d8).setDepth(13).setRotation(angle);
    this.shots.push({ image, vx: Math.cos(angle) * (kind === 'feather' ? 590 : 650), vy: Math.sin(angle) * (kind === 'feather' ? 590 : 650), born: this.timeMs, ttl: kind === 'feather' ? 1100 : 550, friendly: true, damage: this.coreTaken ? 2 : 1, kind, returning: false, hits: new Set(), originX: this.player.x });
  }

  private spawnEnemy(spawn: EnemySpawn, returning = false): void {
    const brain = createBrain(spawn);
    brain.returnOnly = returning;
    brain.readyAt = this.timeMs + 800;
    const sprite = this.physics.add.sprite(brain.x, brain.y, `lantern-${brain.kind}`).setDepth(8);
    if (brain.kind === 'keeper') { sprite.setDisplaySize(112, 120); sprite.body.setSize(75, 104).setOffset(32, 31); }
    else { sprite.setDisplaySize(75, 75); sprite.body.setSize(60, 67).setOffset(20, 22); }
    this.physics.add.collider(sprite, this.ground);
    const warning = this.add.graphics().setDepth(5);
    const bar = this.add.graphics().setDepth(9);
    this.enemies.push({ brain, sprite, warning, bar, hitAttack: -1 });
    if (returning) this.burst(spawn.x, spawn.floor - 30, 0xefd89d, 12);
  }

  private updateEnemies(): void {
    for (const enemy of this.enemies) {
      const { brain, sprite, warning, bar } = enemy;
      if (brain.hp <= 0) continue;
      brain.x = sprite.x;
      brain.y = sprite.y;
      if (brain.kind === 'keeper' && (!this.coreTaken || this.player.x < 4270)) {
        sprite.setVelocityX(0);
        continue;
      }
      const wasPhase = brain.phase;
      const intent = stepEnemy(brain, this.player, this.timeMs);
      const nextX = sprite.x + Math.sign(intent.vx) * 35;
      const supported = TERRAIN.some((t) => nextX >= t.x && nextX <= t.x + t.width && Math.abs(sprite.body.bottom - t.top) < 15);
      sprite.setVelocityX(supported || !sprite.body.blocked.down ? intent.vx : 0);
      sprite.setFlipX(brain.facing < 0);
      if (brain.phase === 'windup' && wasPhase !== 'windup' && Math.abs(sprite.x - this.player.x) < 650) this.audio.play('warning');
      warning.clear();
      if (brain.phase === 'windup') {
        const floor = sprite.body.bottom;
        const reach = brain.kind === 'keeper' ? 265 : 140;
        warning.fillStyle(0xcf615c, 0.17).fillRect(brain.facing < 0 ? sprite.x - reach : sprite.x, floor - 52, reach, 52);
        warning.lineStyle(3, 0xe37d69, 0.9).lineBetween(sprite.x, floor - 3, sprite.x + brain.facing * reach, floor - 3);
        warning.fillStyle(0xe6a385, 0.9).fillTriangle(sprite.x + brain.facing * reach, floor - 3, sprite.x + brain.facing * (reach - 16), floor - 14, sprite.x + brain.facing * (reach - 16), floor + 6);
        if (brain.kind === 'sentry') warning.lineStyle(2, 0xcf615c, 0.48).lineBetween(sprite.x, sprite.y - 10, brain.aimX, brain.aimY);
        else {
          const front = brain.facing > 0 ? 0 : Math.PI;
          warning.lineStyle(4, 0xe8efdf, 0.88).beginPath().arc(sprite.x, sprite.y - 1, sprite.displayWidth * 0.48, front - 0.8, front + 0.8).strokePath();
        }
        if (brain.pattern === 'wave') {
          warning.lineStyle(3, 0xcf615c, 0.7).strokeEllipse(sprite.x, floor, 240 + Math.sin(this.timeMs / 60) * 15, 20);
        }
        sprite.angle = Math.sin(this.timeMs / 38) * 3;
      } else if (brain.phase === 'recover') {
        warning.lineStyle(2, 0xffffff, 0.8).strokeCircle(sprite.x, sprite.y - 56, 6);
        sprite.angle = brain.facing * 8;
      } else sprite.angle = Math.sin(this.timeMs / 140) * (Math.abs(intent.vx) > 0 ? 2.5 : 0.5);
      if (intent.fire && (brain.kind === 'sentry' || brain.pattern === 'wave')) this.fireEnemy(enemy);
      if (brain.phase === 'strike' && brain.kind !== 'sentry' && brain.pattern !== 'wave'
        && enemy.hitAttack !== brain.attackId && Phaser.Geom.Intersects.RectangleToRectangle(bodyRect(sprite.body), bodyRect(this.player.body))) {
        if (this.hurt(brain.facing, brain.kind === 'keeper' ? 2 : 1)) enemy.hitAttack = brain.attackId;
      }
      bar.clear();
      if (brain.hp < brain.maxHp && Math.abs(sprite.x - this.player.x) < 800) {
        const width = brain.kind === 'keeper' ? 86 : 43;
        bar.fillStyle(0x273e35, 0.85).fillRoundedRect(sprite.x - width / 2, sprite.y - sprite.displayHeight / 2 - 14, width, 5, 2);
        bar.fillStyle(brain.kind === 'keeper' ? 0xe7b575 : 0xebe7c8).fillRoundedRect(sprite.x - width / 2, sprite.y - sprite.displayHeight / 2 - 14, width * brain.hp / brain.maxHp, 5, 2);
      }
    }
  }

  private fireEnemy(enemy: Enemy): void {
    const brain = enemy.brain;
    const wave = brain.pattern === 'wave';
    const angle = wave ? (brain.facing < 0 ? Math.PI : 0) : Phaser.Math.Angle.Between(brain.x, brain.y - 10, brain.aimX, brain.aimY);
    const y = wave ? enemy.sprite.body.bottom - 16 : brain.y - 10;
    const image = this.add.ellipse(brain.x + brain.facing * 38, y, wave ? 48 : 18, wave ? 23 : 18, 0xd27162).setStrokeStyle(3, 0xffd2ae).setDepth(12);
    this.shots.push({ image, vx: Math.cos(angle) * (wave ? 430 : 315), vy: Math.sin(angle) * (wave ? 430 : 315), born: this.timeMs, ttl: 2400, friendly: false, damage: wave ? 2 : 1, kind: 'bolt', returning: false, hits: new Set(), originX: brain.x });
  }

  private updateShots(delta: number): void {
    const remove = new Set<Shot>();
    for (const shot of this.shots) {
      if (this.timeMs - shot.born > shot.ttl) { remove.add(shot); continue; }
      if (shot.kind === 'feather') {
        shot.image.rotation += delta * 0.02;
        if (this.timeMs - shot.born > 420) {
          shot.returning = true;
          const angle = Phaser.Math.Angle.Between(shot.image.x, shot.image.y, this.player.x, this.player.y);
          shot.vx = Math.cos(angle) * 660;
          shot.vy = Math.sin(angle) * 660;
          if (Phaser.Math.Distance.Between(shot.image.x, shot.image.y, this.player.x, this.player.y) < 27) remove.add(shot);
        }
      }
      shot.image.x += shot.vx * delta / 1000;
      shot.image.y += shot.vy * delta / 1000;
      if (shot.friendly) {
        for (const enemy of this.enemies) {
          const id = `${enemy.brain.id}-${shot.returning}`;
          if (enemy.brain.hp <= 0 || shot.hits.has(id) || !Phaser.Geom.Rectangle.Contains(bodyRect(enemy.sprite.body), shot.image.x, shot.image.y)) continue;
          shot.hits.add(id);
          const damage = strikeDamage(enemy.brain, shot.originX, this.coreTaken, false) === 0 ? 0 : shot.damage;
          this.hitEnemy(enemy, damage);
          if (shot.kind === 'bolt') remove.add(shot);
        }
      } else if (Phaser.Geom.Rectangle.Contains(bodyRect(this.player.body), shot.image.x, shot.image.y)) {
        this.hurt(shot.vx < 0 ? -1 : 1, shot.damage);
        remove.add(shot);
      }
      if (shot.kind === 'bolt' && TERRAIN.some((t) => shot.image.x > t.x && shot.image.x < t.x + t.width && shot.image.y > t.top + 6 && shot.image.y < t.top + t.height)) remove.add(shot);
    }
    this.shots = this.shots.filter((shot) => {
      if (!remove.has(shot)) return true;
      shot.image.destroy();
      return false;
    });
  }

  private hitEnemy(enemy: Enemy, damage: number): void {
    if (enemy.brain.hp <= 0 || this.timeMs - enemy.brain.lastHitAt < 75) return;
    enemy.brain.lastHitAt = this.timeMs;
    if (damage === 0) {
      this.audio.play('block');
      this.burst(enemy.sprite.x, enemy.sprite.y - 10, 0xd8e7de, 4);
      return;
    }
    enemy.brain.hp = Math.max(0, enemy.brain.hp - damage);
    this.audio.play('hit');
    enemy.sprite.setTint(0xffefcf);
    this.time.delayedCall(100, () => enemy.sprite.active && enemy.sprite.clearTint());
    this.burst(enemy.sprite.x, enemy.sprite.y - 8, this.coreTaken ? 0xffe6a2 : 0xf5f1dc, 8);
    this.hitstop = this.reducedMotion ? 20 : 42;
    this.physics.pause();
    if (!this.reducedMotion) this.cameras.main.shake(65, 0.002);
    if (enemy.brain.phase === 'idle' && enemy.brain.kind !== 'keeper') {
      enemy.brain.phase = 'stunned';
      enemy.brain.until = this.timeMs + 150;
    }
    if (enemy.brain.hp === 0) {
      this.kills += 1;
      enemy.sprite.disableBody(true, true);
      enemy.warning.clear();
      enemy.bar.clear();
      this.burst(enemy.sprite.x, enemy.sprite.y - 10, enemy.brain.kind === 'keeper' ? 0xf4c879 : 0xa7c990, 15);
      if (enemy.brain.kind === 'keeper') {
        this.visuals.relic.setAlpha(1);
        this.say('钟声安静下来。', 2000);
        this.audio.play('pickup');
      }
    }
  }

  private hurt(direction: number, damage = 1): boolean {
    if (this.timeMs < this.hurtUntil || this.timeMs < this.dashUntil || this.phase === 'home' || this.result) return false;
    this.health = Math.max(0, this.health - damage);
    this.damageTaken += damage;
    this.hurtUntil = this.timeMs + 1050;
    this.staggerUntil = this.timeMs + 160;
    this.player.setVelocity(direction * 300, -310);
    this.extracting = false;
    this.extraction = 0;
    this.audio.play('hurt');
    this.burst(this.player.x, this.player.y, 0xe78d7c, 9);
    if (!this.reducedMotion) this.cameras.main.shake(130, 0.006);
    if (this.health === 0) this.finish('lost', '没关系，灯还在等你。');
    this.publish();
    return true;
  }

  private interaction(): LanternSnapshot['interaction'] {
    if (this.phase === 'won' || this.phase === 'lost' || this.phase === 'home') return null;
    const near = (point: { x: number; y: number }, radius = 100) => Math.abs(this.player.x - point.x) < radius && Math.abs(this.player.y - point.y) < 100;
    if (!this.coreTaken && near(POINTS.core)) {
      const guarded = this.enemies.some((enemy) => enemy.brain.id.startsWith('heart-') && enemy.brain.hp > 0);
      return { id: 'core', label: guarded ? '温室守卫尚未平息' : '取走灯芯', enabled: !guarded };
    }
    if (this.coreTaken && !this.relic && near(POINTS.relic)) {
      const guarded = this.enemies.some((enemy) => enemy.brain.kind === 'keeper' && enemy.brain.hp > 0);
      return { id: 'relic', label: guarded ? '钟卫仍在守候' : `带上${RELICS[this.offeredRelic].name}`, enabled: !guarded };
    }
    if (this.coreTaken && near(POINTS.home)) return { id: 'home', label: '把光带回家', enabled: true };
    if (near(POINTS.rest, 90)) return { id: 'rest', label: this.restUsed ? '雨歇茶已喝完' : '喝一口雨歇茶', enabled: !this.restUsed };
    return null;
  }

  interact(): void {
    if (this.paused || this.result) return;
    const interaction = this.interaction();
    if (!interaction?.enabled) return;
    this.audio.unlock();
    this.learnControl('interact');
    if (interaction.id === 'core') {
      this.coreTaken = true;
      this.phase = 'returning';
      this.visuals.core.setVisible(false);
      this.carriedLight.setVisible(true);
      this.gateBody.disableBody(true, true);
      this.visuals.gate.setAlpha(0.18);
      RETURN_SPAWNS.forEach((spawn) => this.spawnEnemy(spawn, true));
      this.audio.play('pickup');
      this.say('灯芯醒了。旧路上，也有什么醒了。', 3300);
      this.burst(this.player.x, this.player.y - 30, 0xffe4a0, 28);
      this.health = Math.min(MAX_HEALTH, this.health + 1);
    } else if (interaction.id === 'rest') {
      const { healthGained, lightGained } = getTeaRestoration(this.health, this.coreTaken, this.lightMs);
      if (healthGained === 0 && lightGained === 0) {
        this.say(this.coreTaken ? '生命与余光都已充足，雨歇茶留在原处。' : '生命已满，雨歇茶留在原处。', 2800);
        this.publish();
        return;
      }
      this.restUsed = true;
      this.health += healthGained;
      this.lightMs += lightGained;
      this.visuals.rest.setAlpha(0.5);
      this.audio.play('heal');
      this.say([healthGained > 0 ? `生命 +${healthGained}` : '', lightGained > 0 ? `余光 +${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(lightGained / 1000)} 秒` : ''].filter(Boolean).join(' · '), 2400);
      this.burst(this.player.x, this.player.y, 0xb4d9a1, 9);
    } else if (interaction.id === 'relic') {
      this.relic = this.offeredRelic;
      this.destination = 'home';
      this.visuals.relic.setVisible(false);
      this.health = Math.min(MAX_HEALTH, this.health + 2);
      this.lightMs = Math.min(RETURN_WINDOW, this.lightMs + 25_000);
      this.audio.play('pickup');
      this.say('还有一点余光，够我们回家了。', 2500);
    } else {
      this.extracting = true;
      this.extraction = 0;
      this.player.setVelocityX(0);
    }
    this.publish();
  }

  private finish(outcome: 'won' | 'lost', reason: string): void {
    if (this.result) return;
    this.phase = outcome;
    this.paused = false;
    this.result = { outcome, relic: outcome === 'won' ? this.relic : null, durationMs: Math.round(this.elapsedMs), kills: this.kills, damageTaken: this.damageTaken, reason };
    this.physics.pause();
    this.clearControls();
    if (outcome === 'won') {
      this.visuals.beacon.setAlpha(1);
      this.burst(POINTS.home.x + 60, POINTS.home.y - 100, 0xffe09a, 35);
      this.carriedLight.setVisible(false);
      this.audio.play('win');
    } else this.audio.play('lose');
    this.options.onResult(this.result);
    this.publish();
  }

  private say(message: string, duration: number): void { this.message = message; this.messageUntil = this.timeMs + duration; }

  private burst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.add.rectangle(x, y, 3 + i % 3, 3 + i % 2, color).setDepth(16).setRotation(i);
      const angle = i * 2.399;
      const radius = 23 + (i % 7) * 8;
      this.tweens.add({ targets: particle, x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius - 20, angle: i * 130, alpha: 0, duration: 260 + i % 5 * 65, ease: 'Cubic.Out', onComplete: () => particle.destroy() });
    }
  }

  private updateCamera(delta: number): void {
    const camera = this.cameras.main;
    const viewWidth = this.scale.width / camera.zoom;
    const horizontal = stepHorizontalCamera(this.cameraMotion, camera.scrollX + this.scale.width / 2, this.player.x, this.player.body.velocity.x, viewWidth, delta);
    this.cameraMotion = horizontal;
    const targetY = this.player.y - this.scale.height / 2 + (0.5 - (this.scale.height > this.scale.width ? 0.57 : 0.70)) * this.scale.height / camera.zoom;
    const smoothing = 1 - Math.exp(-delta / 150);
    camera.scrollX = horizontal.center - this.scale.width / 2;
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetY, smoothing);
  }

  private updatePlayerArt(): void {
    const body = this.player.body;
    const airborne = !body.blocked.down;
    const movement = Math.abs(body.velocity.x);
    this.player.setFlipX(this.facing > 0);
    this.player.angle = airborne ? Phaser.Math.Clamp(body.velocity.y / 65, -10, 12) * this.facing : Math.sin(this.timeMs / 85) * Math.min(4, movement / 70);
    this.player.setAlpha(this.timeMs < this.hurtUntil ? (Math.sin(this.timeMs / 45) > 0 ? 0.35 : 1) : 1);
    if (this.timeMs < this.dashUntil) this.player.setTint(0xc7f2e1); else this.player.clearTint();
    const floor = TERRAIN.filter((t) => this.player.x >= t.x && this.player.x <= t.x + t.width && t.top >= body.bottom - 4).sort((a, b) => a.top - b.top)[0];
    this.playerShadow.setPosition(this.player.x, floor?.top ?? body.bottom).setAlpha(airborne ? 0.12 : 0.2).setScale(airborne ? 0.7 : 1);
    this.carriedLight.setPosition(this.player.x - this.facing * 33, this.player.y - 7 + Math.sin(this.timeMs / 160) * 3).setRotation(this.facing * -0.14);
  }

  snapshot(): LanternSnapshot {
    const p = this.player;
    const room = roomAt(p?.x ?? 360);
    const keeper = this.enemies.find((e) => e.brain.kind === 'keeper');
    const goingDeeper = this.coreTaken && this.destination === 'relic' && !this.relic;
    const target = goingDeeper ? POINTS.relic : this.coreTaken ? POINTS.home : POINTS.core;
    const interaction = p ? this.interaction() : null;
    const closeEnemies = this.enemies.filter((enemy) => enemy.brain.hp > 0 && Math.abs(enemy.sprite.x - (p?.x ?? 360)) < 400 && Math.abs(enemy.sprite.y - (p?.y ?? 660)) < 150);
    const lesson = p ? getControlLesson({
      phase: this.phase, learned: this.learnedControls, x: p.x, footY: p.body.bottom,
      facing: this.facing, grounded: p.body.blocked.down || p.body.touching.down,
      canInteract: Boolean(interaction?.enabled), enemyNearby: closeEnemies.length > 0,
      enemyWindingUp: closeEnemies.some((enemy) => enemy.brain.phase === 'windup'),
    }) : 'move';
    const objective = this.phase === 'home' ? '温室里，还有一盏没有熄灭的灯。'
      : this.phase === 'outbound' ? '取回温室灯芯'
        : this.phase === 'won' ? '灯亮了。你也回来了。'
          : this.phase === 'lost' ? '下次，我们再一起去。'
            : goingDeeper || (room.id === 'belfry' && !this.relic && keeper && keeper.brain.hp > 0) ? '钟楼深处 · 可选的冒险' : '把灯芯带回归灯站';
    return {
      mode: 'lantern', phase: this.phase, paused: this.paused, pauseReason: this.pauseReason,
      room: room.name, roomId: room.id, visited: [...this.visited], health: this.health, maxHealth: MAX_HEALTH,
      weapon: this.weapon, empowered: this.coreTaken, lightMs: Math.round(this.lightMs), elapsedMs: Math.round(this.elapsedMs),
      attack: this.swing ? { weapon: this.swing.weapon, visual: this.swing.graphic ? 'slash' : 'throw', direction: this.swing.direction, released: this.swing.hit } : null,
      coreTaken: this.coreTaken, relic: this.relic, offeredRelic: this.offeredRelic, restUsed: this.restUsed,
      destination: this.destination, routeChoice: this.coreTaken && !this.routeDecided && !this.relic && !this.result && Math.abs((p?.x ?? 0) - POINTS.core.x) < 175,
      kills: this.kills, damageTaken: this.damageTaken, objective,
      target: { ...target, name: goingDeeper ? RELICS[this.offeredRelic].name : this.coreTaken ? '归灯站' : '灯芯温室', direction: (p?.x ?? 360) > target.x ? 'left' : 'right', distance: Math.round(Math.abs((p?.x ?? 360) - target.x)) },
      interaction, extraction: this.extraction, result: this.result,
      guidance: { lesson, learned: [...this.learnedControls] },
      message: this.timeMs < this.messageUntil ? this.message : '',
      player: { x: Math.round(p?.x ?? 360), y: Math.round(p?.y ?? 660), vx: Math.round(p?.body.velocity.x ?? 0), vy: Math.round(p?.body.velocity.y ?? 0), grounded: p?.body.blocked.down ?? false, facing: this.facing, dashing: this.timeMs < this.dashUntil, dashReady: this.timeMs >= this.dashReadyAt },
      enemies: this.enemies.filter((e) => e.brain.hp > 0).map(({ brain: b, sprite: s }) => ({ id: b.id, kind: b.kind, x: Math.round(s.x), y: Math.round(s.y), hp: b.hp, maxHp: b.maxHp, phase: b.phase, pattern: b.pattern, facing: b.facing })),
      shots: this.shots.map((s) => ({ x: Math.round(s.image.x), y: Math.round(s.image.y), friendly: s.friendly, kind: s.kind, returning: s.returning })),
      terrain: TERRAIN,
      camera: { x: Math.round(this.cameras.main?.worldView.x ?? 0), y: Math.round(this.cameras.main?.worldView.y ?? 0), width: this.scale.width, height: this.scale.height, zoom: this.cameras.main?.zoom ?? 1, lookAhead: Math.round(this.cameraMotion.lookAhead) },
      coordinateSystem: 'World origin top-left, x right, y down. Coordinates in world pixels; terrain x is left edge, top is walkable surface.',
    };
  }

  private publish(): void { this.lastPublishAt = this.timeMs; this.options.onState(this.snapshot()); }
}
