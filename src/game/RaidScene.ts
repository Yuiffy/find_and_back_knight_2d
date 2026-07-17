import Phaser from 'phaser';
import { addItem, addStacks, hasInventoryRoom } from './inventory';
import { getArmorMaximum, getCurrentObjective, ITEMS } from './items';
import { DEMO_MAP } from './maps';
import type { ItemStack, PlayerProfile, RaidResult, TextGameState } from '../types/game';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const WORLD_WIDTH = DEMO_MAP.worldWidth;
const FLOOR_Y = 674;

interface RaidSceneOptions {
  profile: PlayerProfile;
  entryId: 'foyer' | 'lift';
  onResult: (result: RaidResult) => void;
}

interface RaidKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  leftArrow: Phaser.Input.Keyboard.Key;
  rightArrow: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  jumpAlt: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  attackAlt: Phaser.Input.Keyboard.Key;
  attackTest: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  dashAlt: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  interactAlt: Phaser.Input.Keyboard.Key;
  map: Phaser.Input.Keyboard.Key;
  mapAlt: Phaser.Input.Keyboard.Key;
  backpack: Phaser.Input.Keyboard.Key;
  backpackAlt: Phaser.Input.Keyboard.Key;
  fullscreen: Phaser.Input.Keyboard.Key;
  abort: Phaser.Input.Keyboard.Key;
}

interface EnemyEntity {
  id: string;
  kind: 'husk' | 'moth' | 'warden';
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  health: number;
  maxHealth: number;
  speed: number;
  direction: -1 | 1;
  patrolLeft: number;
  patrolRight: number;
  baseY?: number;
  boss?: boolean;
  label?: Phaser.GameObjects.Text;
}

interface LootEntity {
  id: string;
  itemId: string;
  quantity: number;
  icon: Phaser.GameObjects.Text;
  halo: Phaser.GameObjects.Arc;
}

interface RaidCrate {
  id: string;
  sprite: Phaser.GameObjects.Image;
  drops: ItemStack[];
  broken: boolean;
}

export class RaidScene extends Phaser.Scene {
  private readonly profile: PlayerProfile;
  private readonly entryId: 'foyer' | 'lift';
  private readonly onResult: (result: RaidResult) => void;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private keys!: RaidKeys;
  private enemies: EnemyEntity[] = [];
  private loot: LootEntity[] = [];
  private crates: RaidCrate[] = [];
  private backpack: ItemStack[] = [];
  private recoveredEchoItems: ItemStack[] = [];
  private recoveredEcho = false;
  private mapUnlocked = false;
  private shortcutUnlocked = false;
  private bossDefeated = false;
  private runEnded = false;
  private health = 5;
  private readonly maxHealth = 5;
  private armor = 0;
  private maxArmor = 0;
  private facing: -1 | 1 = 1;
  private lastGroundedAt = 0;
  private jumpQueuedAt = -1000;
  private attackReadyAt = 0;
  private invulnerableUntil = 0;
  private dashReadyAt = 0;
  private dashEndsAt = 0;
  private staggerEndsAt = 0;
  private isDashing = false;
  private statusText!: Phaser.GameObjects.Text;
  private zoneText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private bossHealthText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private extractionText!: Phaser.GameObjects.Text;
  private extractingUntil = 0;
  private extractionX = 0;
  private nearbyInteraction: string | null = null;
  private lostEchoIcon: Phaser.GameObjects.Text | null = null;
  private lostEchoHalo: Phaser.GameObjects.Arc | null = null;
  private readonly elevatorX = 2900;
  private attackGraphics: Phaser.GameObjects.Rectangle | null = null;
  private lastTextStateAt = 0;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayMode: 'map' | 'backpack' | null = null;

  constructor({ profile, entryId, onResult }: RaidSceneOptions) {
    super('raid');
    this.profile = profile;
    this.entryId = entryId;
    this.onResult = onResult;
  }

  preload(): void {
    this.load.image('sui-bird', '/assets/sui-bird.png');
  }

  create(): void {
    this.health = this.maxHealth;
    this.maxArmor = getArmorMaximum(this.profile);
    this.armor = Math.min(this.profile.armorCondition, this.maxArmor);
    this.mapUnlocked = this.profile.mapUnlocked;
    this.shortcutUnlocked = this.profile.shortcutUnlocked;
    this.bossDefeated = this.profile.bossDefeated;
    this.createTextures();
    this.createBackdrop();
    this.createPlatforms();
    this.createPlayer();
    this.createEnemies();
    this.createLandmarks();
    this.createInput();
    this.createHud();
    this.invulnerableUntil = this.time.now + 3000;

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, VIEW_HEIGHT);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, VIEW_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.085, 0.12, -180, 15);
    this.cameras.main.setDeadzone(360, 160);
    this.cameras.main.setBackgroundColor('#07151d');
    this.input.mouse?.disableContextMenu();

    this.physics.add.collider(this.player, this.platforms);
    for (const enemy of this.enemies) {
      if (enemy.kind !== 'moth') this.physics.add.collider(enemy.sprite, this.platforms);
      this.physics.add.overlap(this.player, enemy.sprite, () => this.damagePlayer(enemy));
    }

    this.cameras.main.fadeIn(480, 4, 15, 19);
    this.showHint('A / D 移动 · Space 跳跃 · J 或鼠标左键攻击', 3800);
    this.publishTextState(true);
  }

  update(time: number): void {
    if (!this.player?.active || this.runEnded) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.fullscreen)) {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.abort)) {
      this.finishRaid('died');
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.map) || Phaser.Input.Keyboard.JustDown(this.keys.mapAlt)) {
      this.toggleOverlay('map');
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.backpack) || Phaser.Input.Keyboard.JustDown(this.keys.backpackAlt)) {
      this.toggleOverlay('backpack');
      return;
    }
    if (this.overlayMode) {
      this.publishTextState(time - this.lastTextStateAt > 100);
      return;
    }

    this.updateMovement(time);
    this.updateAttack(time);
    this.updateEnemies();
    this.updateInteractions(time);
    this.updateHud();

    if (this.player.y > VIEW_HEIGHT + 100) {
      this.respawnFromPit();
    }

    this.publishTextState(time - this.lastTextStateAt > 100);
  }

  private createTextures(): void {
    const platform = this.add.graphics();
    platform.fillStyle(0x173840, 1);
    platform.fillRoundedRect(0, 0, 256, 38, 12);
    platform.fillStyle(0x3c736f, 0.62);
    platform.fillRoundedRect(0, 0, 256, 8, 8);
    platform.lineStyle(2, 0x87d7c5, 0.12);
    platform.strokeRoundedRect(1, 1, 254, 36, 11);
    platform.generateTexture('stone-platform', 256, 38);
    platform.destroy();

    const husk = this.add.graphics();
    husk.fillStyle(0x725479, 1);
    husk.fillEllipse(34, 27, 62, 42);
    husk.fillStyle(0x9c79a5, 1);
    husk.fillCircle(17, 17, 11);
    husk.fillCircle(51, 17, 11);
    husk.fillStyle(0xe4f7df, 1);
    husk.fillCircle(19, 17, 4);
    husk.fillCircle(49, 17, 4);
    husk.fillStyle(0x17222b, 1);
    husk.fillCircle(20, 18, 2);
    husk.fillCircle(48, 18, 2);
    husk.fillStyle(0x543c5c, 1);
    husk.fillTriangle(5, 31, 0, 46, 18, 38);
    husk.fillTriangle(63, 31, 68, 46, 50, 38);
    husk.generateTexture('echo-husk', 68, 50);
    husk.destroy();

    const crate = this.add.graphics();
    crate.fillStyle(0x6a5238, 1);
    crate.fillRoundedRect(0, 0, 74, 58, 7);
    crate.fillStyle(0xa98755, 1);
    crate.fillRect(7, 8, 60, 8);
    crate.fillRect(7, 42, 60, 8);
    crate.fillStyle(0x3d3329, 0.85);
    crate.fillRect(32, 0, 10, 58);
    crate.lineStyle(2, 0xe5c47b, 0.45);
    crate.strokeRoundedRect(1, 1, 72, 56, 6);
    crate.generateTexture('loot-crate', 74, 58);
    crate.destroy();

    const moth = this.add.graphics();
    moth.fillStyle(0x5ea6a2, 0.95);
    moth.fillEllipse(20, 25, 38, 34);
    moth.fillEllipse(58, 25, 38, 34);
    moth.fillStyle(0x263d4a, 1);
    moth.fillEllipse(39, 28, 24, 42);
    moth.fillStyle(0xd7f0d9, 1);
    moth.fillCircle(34, 22, 4);
    moth.fillCircle(44, 22, 4);
    moth.fillStyle(0x9ef1c8, 0.5);
    moth.fillCircle(16, 24, 8);
    moth.fillCircle(62, 24, 8);
    moth.generateTexture('spore-moth', 78, 54);
    moth.destroy();

    const warden = this.add.graphics();
    warden.fillStyle(0x43385c, 1);
    warden.fillRoundedRect(8, 26, 112, 68, 28);
    warden.fillStyle(0x6f5b8f, 1);
    warden.fillTriangle(14, 40, 0, 4, 42, 30);
    warden.fillTriangle(114, 40, 128, 4, 86, 30);
    warden.fillStyle(0xbfa2ff, 0.9);
    warden.fillCircle(42, 51, 9);
    warden.fillCircle(86, 51, 9);
    warden.fillStyle(0x10131b, 1);
    warden.fillCircle(42, 51, 4);
    warden.fillCircle(86, 51, 4);
    warden.lineStyle(5, 0x9c7ee3, 0.65);
    warden.beginPath();
    warden.moveTo(37, 75);
    warden.lineTo(64, 84);
    warden.lineTo(91, 75);
    warden.strokePath();
    warden.generateTexture('signal-warden', 128, 98);
    warden.destroy();
  }

  private createBackdrop(): void {
    const background = this.add.graphics();
    background.setScrollFactor(0);
    background.fillGradientStyle(0x07151d, 0x07151d, 0x102c34, 0x102c34, 1);
    background.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const farCaves = this.add.graphics();
    farCaves.setScrollFactor(0.12, 0);
    farCaves.fillStyle(0x0e2932, 1);
    for (let x = -120; x < WORLD_WIDTH + 400; x += 230) {
      const peak = 170 + ((x / 230) % 3) * 55;
      farCaves.fillTriangle(x, FLOOR_Y, x + 135, peak, x + 280, FLOOR_Y);
    }

    const midCaves = this.add.graphics();
    midCaves.setScrollFactor(0.35, 0);
    midCaves.fillStyle(0x102f36, 0.85);
    for (let x = -80; x < WORLD_WIDTH + 500; x += 360) {
      midCaves.fillEllipse(x + 90, 610, 390, 380);
    }

    for (let i = 0; i < 48; i += 1) {
      const mote = this.add.circle(
        Phaser.Math.Between(0, WORLD_WIDTH),
        Phaser.Math.Between(90, 610),
        Phaser.Math.Between(1, 3),
        i % 5 === 0 ? 0xe8c77b : 0x75d7c2,
        Phaser.Math.FloatBetween(0.12, 0.4),
      );
      mote.setScrollFactor(Phaser.Math.FloatBetween(0.35, 0.85));
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(16, 46),
        alpha: { from: mote.alpha, to: 0.05 },
        duration: Phaser.Math.Between(1800, 3600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    this.add.text(95, 115, '寂羽空洞', {
      fontFamily: 'Georgia, serif',
      fontSize: '48px',
      color: '#c7e8df',
    }).setAlpha(0.12);
    this.add.text(101, 169, 'THE HOLLOW OF LOST FEATHERS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      letterSpacing: 4,
      color: '#87d7c5',
    }).setAlpha(0.2);

    const fungi = this.add.graphics().setDepth(2);
    for (let x = 1710; x < 3250; x += 210) {
      const height = 70 + ((x / 210) % 3) * 22;
      fungi.fillStyle(0x4b8c87, 0.16);
      fungi.fillRoundedRect(x, FLOOR_Y - height, 14, height, 7);
      fungi.fillStyle(0x76d8c4, 0.18);
      fungi.fillEllipse(x + 7, FLOOR_Y - height, 94, 34);
      fungi.lineStyle(2, 0xa7f1d9, 0.16);
      fungi.strokeEllipse(x + 7, FLOOR_Y - height, 94, 34);
    }

    const machines = this.add.graphics().setDepth(2);
    machines.lineStyle(11, 0x293744, 0.72);
    machines.beginPath();
    machines.moveTo(3300, 240);
    machines.lineTo(3560, 240);
    machines.lineTo(3560, 410);
    machines.lineTo(3910, 410);
    machines.lineTo(3910, 210);
    machines.lineTo(4480, 210);
    machines.strokePath();
    for (let x = 3420; x < 4680; x += 320) {
      machines.fillStyle(0x182731, 0.82);
      machines.fillRoundedRect(x, 320, 150, 260, 18);
      machines.lineStyle(2, 0x8e6fc4, 0.18);
      machines.strokeRoundedRect(x, 320, 150, 260, 18);
      machines.fillStyle(0x8a6ac0, 0.3);
      machines.fillCircle(x + 75, 365, 12);
    }
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    const segments = [
      { x: 365, y: FLOOR_Y, width: 730 },
      { x: 980, y: FLOOR_Y, width: 340 },
      { x: 1435, y: FLOOR_Y, width: 430 },
      { x: 1900, y: FLOOR_Y, width: 340 },
      { x: 2320, y: FLOOR_Y, width: 360 },
      { x: 2800, y: FLOOR_Y, width: 480 },
      { x: 3380, y: FLOOR_Y, width: 500 },
      { x: 3995, y: FLOOR_Y, width: 630 },
      { x: 4580, y: FLOOR_Y, width: 440 },
      { x: 760, y: 535, width: 250 },
      { x: 1130, y: 455, width: 230 },
      { x: 1540, y: 530, width: 210 },
      { x: 2050, y: 500, width: 240 },
      { x: 2550, y: 430, width: 220 },
      { x: 3110, y: 510, width: 260 },
      { x: 3620, y: 450, width: 230 },
      { x: 4140, y: 520, width: 270 },
      { x: 4395, y: 570, width: 105 },
    ];

    for (const segment of segments) {
      const platform = this.platforms.create(segment.x, segment.y, 'stone-platform') as Phaser.Physics.Arcade.Sprite;
      platform.setDisplaySize(segment.width, 38);
      platform.refreshBody();
    }
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(this.getEntryX(), 560, 'sui-bird');
    this.player.setScale(0.28);
    this.player.setDepth(20);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(720, 1100);
    this.player.setDragX(1500);
    this.player.body.setSize(180, 185);
    this.player.body.setOffset(85, 48);
  }

  private createEnemies(): void {
    this.spawnHusk('husk-foyer-1', 910, 600, 835, 1120);
    this.spawnHusk('husk-foyer-2', 1480, 600, 1300, 1590);
    this.spawnHusk('husk-rift-1', 1880, 600, 1760, 2040);
    this.spawnMoth('moth-rift-1', 2180, 475, 2050, 2410);
    this.spawnHusk('husk-rift-2', 2380, 600, 2180, 2480);
    this.spawnMoth('moth-rift-2', 2760, 430, 2580, 3020);
    this.spawnHusk('husk-deep-1', 3820, 600, 3740, 3970);
    this.spawnMoth('moth-deep-1', 3890, 465, 3720, 4080);
    if (!this.profile.bossDefeated) this.spawnWarden();
  }

  private createLandmarks(): void {
    this.createExtractionBeacon(620, '前庭撤离点');
    this.createExtractionBeacon(4550, '深层信号井');

    this.spawnCrate('crate-foyer', 440, 625, [
      { itemId: 'echo_dust', quantity: 4 },
      { itemId: 'repair_patch', quantity: 1 },
    ]);
    this.spawnCrate('crate-rift', 1830, 625, [
      { itemId: 'echo_lance', quantity: 1 },
      { itemId: 'echo_dust', quantity: 2 },
    ]);
    this.spawnCrate('crate-deep', 3350, 625, [
      { itemId: 'miner_shell', quantity: 1 },
      { itemId: 'echo_dust', quantity: 3 },
    ]);
    this.spawnLoot('map-feather', 'map_feather', 1, 2220, 590);

    const liftBase = this.add.rectangle(this.elevatorX, 598, 118, 148, 0x152f3a, 0.92)
      .setStrokeStyle(3, 0x75d7c2, 0.28)
      .setDepth(5);
    this.add.rectangle(this.elevatorX, 598, 62, 112, 0x07151d, 0.8).setDepth(6);
    const liftLamp = this.add.circle(this.elevatorX, 534, 7, this.shortcutUnlocked ? 0x83f2c5 : 0xe1a35f, 0.9).setDepth(7);
    this.add.text(this.elevatorX, 499, '维护电梯', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#789a99',
    }).setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: liftLamp, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    liftBase.setData('landmark', 'elevator');

    if (this.profile.lostEcho) {
      const x = Phaser.Math.Clamp(this.profile.lostEcho.x, 120, WORLD_WIDTH - 120);
      const y = Phaser.Math.Clamp(this.profile.lostEcho.y - 40, 120, 610);
      this.lostEchoHalo = this.add.circle(x, y, 38, 0x8c69e8, 0.1)
        .setStrokeStyle(2, 0xb999ff, 0.52)
        .setDepth(15);
      this.lostEchoIcon = this.add.text(x, y, '◉', {
        fontFamily: 'Georgia, serif',
        fontSize: '34px',
        color: '#c6a8ff',
        stroke: '#211835',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(16);
      this.tweens.add({
        targets: [this.lostEchoHalo, this.lostEchoIcon],
        alpha: { from: 0.45, to: 1 },
        scale: { from: 0.92, to: 1.08 },
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createExtractionBeacon(x: number, label: string): void {
    const glow = this.add.circle(x, 598, 54, 0x63d7b8, 0.07)
      .setStrokeStyle(3, 0x87e9ca, 0.45)
      .setDepth(7);
    this.add.circle(x, 598, 31, 0x09242a, 0.75)
      .setStrokeStyle(1, 0xa8f8e1, 0.3)
      .setDepth(8);
    this.add.text(x, 598, '⇧', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '30px',
      color: '#a9f2dc',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9);
    this.add.text(x, 526, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#7da5a1',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(9);
    this.tweens.add({ targets: glow, scale: 1.16, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1 });
  }

  private spawnCrate(id: string, x: number, y: number, drops: ItemStack[]): void {
    const sprite = this.add.image(x, y, 'loot-crate').setDepth(13);
    this.crates.push({ id, sprite, drops, broken: false });
  }

  private spawnLoot(id: string, itemId: string, quantity: number, x: number, y: number): void {
    const definition = ITEMS[itemId];
    if (!definition) return;
    const halo = this.add.circle(x, y, 25, definition.rarity === 'relic' ? 0xe5b95e : 0x73d9c3, 0.08)
      .setStrokeStyle(1, definition.rarity === 'relic' ? 0xf0cc7f : 0xa0ead9, 0.32)
      .setDepth(14);
    const icon = this.add.text(x, y, definition.icon, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '27px',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: [halo, icon],
      y: y - 9,
      duration: 950 + (this.loot.length % 3) * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.loot.push({ id, itemId, quantity, icon, halo });
  }

  private spawnHusk(id: string, x: number, y: number, patrolLeft: number, patrolRight: number): void {
    const sprite = this.physics.add.sprite(x, y, 'echo-husk');
    sprite.setDepth(12);
    sprite.setBounce(0.05);
    sprite.body.setSize(58, 42);
    sprite.body.setOffset(5, 6);
    this.enemies.push({
      id,
      kind: 'husk',
      sprite,
      health: 4,
      maxHealth: 4,
      speed: 58,
      direction: -1,
      patrolLeft,
      patrolRight,
    });
  }

  private spawnMoth(id: string, x: number, y: number, patrolLeft: number, patrolRight: number): void {
    const sprite = this.physics.add.sprite(x, y, 'spore-moth');
    sprite.setDepth(17);
    sprite.body.allowGravity = false;
    sprite.body.setSize(60, 40);
    sprite.body.setOffset(9, 7);
    this.enemies.push({
      id,
      kind: 'moth',
      sprite,
      health: 3,
      maxHealth: 3,
      speed: 82,
      direction: -1,
      patrolLeft,
      patrolRight,
      baseY: y,
    });
  }

  private spawnWarden(): void {
    const sprite = this.physics.add.sprite(4100, 560, 'signal-warden');
    sprite.setDepth(18);
    sprite.body.setSize(105, 78);
    sprite.body.setOffset(11, 15);
    const label = this.add.text(4100, 474, '失频守卫', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#bda8df',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(17);
    this.enemies.push({
      id: 'signal-warden',
      kind: 'warden',
      sprite,
      health: 16,
      maxHealth: 16,
      speed: 72,
      direction: -1,
      patrolLeft: 3830,
      patrolRight: 4270,
      boss: true,
      label,
    });
  }

  private createInput(): void {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable');
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      jumpAlt: Phaser.Input.Keyboard.KeyCodes.W,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      attackAlt: Phaser.Input.Keyboard.KeyCodes.X,
      attackTest: Phaser.Input.Keyboard.KeyCodes.B,
      dash: Phaser.Input.Keyboard.KeyCodes.K,
      dashAlt: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      interactAlt: Phaser.Input.Keyboard.KeyCodes.ENTER,
      map: Phaser.Input.Keyboard.KeyCodes.M,
      mapAlt: Phaser.Input.Keyboard.KeyCodes.UP,
      backpack: Phaser.Input.Keyboard.KeyCodes.TAB,
      backpackAlt: Phaser.Input.Keyboard.KeyCodes.DOWN,
      fullscreen: Phaser.Input.Keyboard.KeyCodes.F,
      abort: Phaser.Input.Keyboard.KeyCodes.Q,
    }) as unknown as RaidKeys;
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.TAB,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
    this.input.on('pointerdown', () => this.tryAttack(this.time.now));
  }

  private createHud(): void {
    this.statusText = this.add.text(26, 22, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#e9fbf6',
      stroke: '#07151d',
      strokeThickness: 5,
    }).setScrollFactor(0).setDepth(100);

    this.zoneText = this.add.text(VIEW_WIDTH - 28, 22, '失落前庭 · 风险 I', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#86aaa7',
      letterSpacing: 2,
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    this.objectiveText = this.add.text(26, 55, `目标  ${getCurrentObjective(this.profile)}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#f0c981',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setScrollFactor(0).setDepth(100);

    this.hintText = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT - 38, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#d8eee9',
      backgroundColor: 'rgba(5, 20, 26, .88)',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(120).setAlpha(0);

    this.promptText = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT - 88, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#07151d',
      backgroundColor: '#a8eed9',
      padding: { x: 15, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(121).setVisible(false);

    this.extractionText = this.add.text(VIEW_WIDTH / 2, 102, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#bff8e7',
      backgroundColor: 'rgba(5, 20, 26, .9)',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(121).setVisible(false);

    this.bossHealthText = this.add.text(VIEW_WIDTH / 2, 28, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#d4c0f4',
      backgroundColor: 'rgba(20, 13, 30, .82)',
      padding: { x: 15, y: 7 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(122).setVisible(false);

    this.add.text(VIEW_WIDTH - 24, VIEW_HEIGHT - 20, 'J 攻击 · Space 跳跃 · E 互动 · M 地图 · Tab 背包 · F 全屏', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#5d7f7e',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);
  }

  private updateMovement(time: number): void {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.lastGroundedAt = time;

    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.jump)
      || Phaser.Input.Keyboard.JustDown(this.keys.jumpAlt);
    if (jumpPressed) this.jumpQueuedAt = time;

    if (this.isDashing) {
      if (time >= this.dashEndsAt) {
        this.isDashing = false;
        body.allowGravity = true;
        this.player.clearTint();
        this.player.setVelocityX(this.facing * 280);
      }
      return;
    }

    if (time < this.staggerEndsAt) return;

    const weapon = this.profile.loadout.weapon ? ITEMS[this.profile.loadout.weapon] : ITEMS.rust_nail;
    const shoes = this.profile.loadout.shoes ? ITEMS[this.profile.loadout.shoes] : null;
    const armor = this.profile.loadout.armor ? ITEMS[this.profile.loadout.armor] : null;
    const speedMultiplier = (shoes?.stats?.speedMultiplier ?? 1) * (armor?.stats?.speedMultiplier ?? 1);
    const moveSpeed = 300 * speedMultiplier;
    const leftDown = this.keys.left.isDown || this.keys.leftArrow.isDown;
    const rightDown = this.keys.right.isDown || this.keys.rightArrow.isDown;
    const desiredVelocity = leftDown === rightDown ? 0 : (leftDown ? -moveSpeed : moveSpeed);
    const responsiveness = grounded ? 0.28 : 0.16;
    this.player.setVelocityX(Phaser.Math.Linear(body.velocity.x, desiredVelocity, responsiveness));

    if (leftDown && !rightDown) this.facing = -1;
    if (rightDown && !leftDown) this.facing = 1;
    this.player.setFlipX(this.facing < 0);

    if (time - this.jumpQueuedAt <= 130 && time - this.lastGroundedAt <= 120) {
      this.player.setVelocityY(-650);
      this.jumpQueuedAt = -1000;
      this.lastGroundedAt = -1000;
      this.tweens.add({
        targets: this.player,
        scaleX: 0.25,
        scaleY: 0.31,
        duration: 90,
        yoyo: true,
      });
    }

    const jumpHeld = this.keys.jump.isDown || this.keys.jumpAlt.isDown;
    if (!jumpHeld && body.velocity.y < -260) this.player.setVelocityY(-260);

    const dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.dash)
      || Phaser.Input.Keyboard.JustDown(this.keys.dashAlt);
    if (dashPressed) {
      if (shoes?.stats?.dashEnabled && time >= this.dashReadyAt) this.startDash(time);
      else if (!shoes?.stats?.dashEnabled) this.showHint('需要装备「影步靴」才能黑冲', 1200);
    }

    if (weapon.stats?.range && Math.abs(body.velocity.x) > 20 && grounded) {
      this.player.angle = Math.sin(time / 85) * 1.4;
    } else {
      this.player.angle = Phaser.Math.Linear(this.player.angle, 0, 0.2);
    }
  }

  private startDash(time: number): void {
    this.isDashing = true;
    this.dashEndsAt = time + 180;
    this.dashReadyAt = time + 900;
    this.player.body.allowGravity = false;
    this.player.setVelocity(this.facing * 820, 0);
    this.player.setTint(0x8c76ff);
    for (let i = 0; i < 5; i += 1) {
      const echo = this.add.image(this.player.x - this.facing * i * 18, this.player.y, 'sui-bird')
        .setScale(0.28)
        .setFlipX(this.facing < 0)
        .setTint(0x6653c9)
        .setAlpha(0.22 - i * 0.025)
        .setDepth(18);
      this.tweens.add({ targets: echo, alpha: 0, duration: 230, onComplete: () => echo.destroy() });
    }
  }

  private updateAttack(time: number): void {
    const attackPressed = Phaser.Input.Keyboard.JustDown(this.keys.attack)
      || Phaser.Input.Keyboard.JustDown(this.keys.attackAlt)
      || Phaser.Input.Keyboard.JustDown(this.keys.attackTest);
    if (attackPressed) this.tryAttack(time);
  }

  private tryAttack(time: number): void {
    if (time < this.attackReadyAt || this.isDashing || !this.player.active) return;
    const weapon = this.profile.loadout.weapon ? ITEMS[this.profile.loadout.weapon] : ITEMS.rust_nail;
    const range = weapon.stats?.range ?? 84;
    const damage = weapon.stats?.attack ?? 2;
    this.attackReadyAt = time + (weapon.stats?.attackCooldown ?? 340);
    const attackWidth = range + 56;
    const attackX = this.player.x + this.facing * (range / 2);
    const hitbox = new Phaser.Geom.Rectangle(
      attackX - attackWidth / 2,
      this.player.y - 44,
      attackWidth,
      88,
    );

    this.attackGraphics?.destroy();
    this.attackGraphics = this.add.rectangle(attackX, this.player.y, range, 56, 0xb8fff0, 0.16)
      .setStrokeStyle(3, 0xc8fff2, 0.75)
      .setDepth(30)
      .setRotation(this.facing > 0 ? -0.12 : 0.12);
    this.tweens.add({
      targets: this.attackGraphics,
      alpha: 0,
      scaleY: 1.45,
      x: attackX + this.facing * 18,
      duration: 135,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.attackGraphics?.destroy();
        this.attackGraphics = null;
      },
    });
    this.tweens.add({
      targets: this.player,
      scaleX: 0.31,
      scaleY: 0.25,
      duration: 65,
      yoyo: true,
    });

    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || !Phaser.Geom.Intersects.RectangleToRectangle(hitbox, enemy.sprite.getBounds())) continue;
      enemy.health -= damage;
      enemy.direction = this.facing;
      enemy.sprite.setVelocity(this.facing * 310, -180);
      enemy.sprite.setTint(0xe8fff6).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(80, () => enemy.sprite.active && enemy.sprite.clearTint());
      this.spawnImpact(enemy.sprite.x, enemy.sprite.y);
      if (enemy.health <= 0) this.defeatEnemy(enemy);
    }

    for (const crate of this.crates) {
      if (crate.broken || !Phaser.Geom.Intersects.RectangleToRectangle(hitbox, crate.sprite.getBounds())) continue;
      this.breakCrate(crate);
    }
  }

  private updateEnemies(): void {
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      if (enemy.sprite.y > VIEW_HEIGHT + 100) {
        enemy.sprite.setPosition((enemy.patrolLeft + enemy.patrolRight) / 2, 590);
        enemy.sprite.setVelocity(0, 0);
      }
      if (enemy.kind === 'moth') {
        const distance = this.player.x - enemy.sprite.x;
        if (Math.abs(distance) < 420) enemy.direction = distance < 0 ? -1 : 1;
        else {
          if (enemy.sprite.x <= enemy.patrolLeft) enemy.direction = 1;
          if (enemy.sprite.x >= enemy.patrolRight) enemy.direction = -1;
        }
        const targetY = (enemy.baseY ?? 470) + Math.sin(this.time.now / 420 + enemy.patrolLeft) * 52;
        enemy.sprite.setVelocity(enemy.direction * enemy.speed, (targetY - enemy.sprite.y) * 2.1);
        enemy.sprite.setFlipX(enemy.direction > 0);
        enemy.sprite.setScale(1, 0.92 + Math.sin(this.time.now / 90) * 0.08);
        continue;
      }
      const distance = this.player.x - enemy.sprite.x;
      if (Math.abs(distance) < 320 && Math.abs(this.player.y - enemy.sprite.y) < 100) {
        enemy.direction = distance < 0 ? -1 : 1;
      }
      if (enemy.sprite.x <= enemy.patrolLeft) enemy.direction = 1;
      if (enemy.sprite.x >= enemy.patrolRight) enemy.direction = -1;
      const chasing = Math.abs(distance) < (enemy.kind === 'warden' ? 520 : 320);
      const speed = enemy.kind === 'warden' && chasing ? enemy.speed * 1.65 : enemy.speed;
      enemy.sprite.setVelocityX(enemy.direction * speed);
      enemy.sprite.setFlipX(enemy.direction > 0);
      enemy.sprite.angle = Math.sin(this.time.now / (enemy.kind === 'warden' ? 190 : 130) + enemy.sprite.x) * 2;
      enemy.label?.setPosition(enemy.sprite.x, enemy.sprite.y - 86);
    }
  }

  private damagePlayer(enemy: EnemyEntity): void {
    const time = this.time.now;
    if (time < this.invulnerableUntil || this.isDashing || !enemy.sprite.active) return;
    this.invulnerableUntil = time + 1100;
    this.staggerEndsAt = time + 190;
    if (this.armor > 0) this.armor -= 1;
    else this.health -= 1;
    const knockDirection = this.player.x < enemy.sprite.x ? -1 : 1;
    this.player.setVelocity(knockDirection * 420, -370);
    enemy.sprite.setVelocity(-knockDirection * 170, -120);
    this.player.setTint(0xff8290).setTintMode(Phaser.TintModes.FILL);
    this.cameras.main.shake(140, 0.009);
    this.time.delayedCall(120, () => this.player.active && this.player.clearTint());
    this.tweens.add({
      targets: this.player,
      alpha: 0.32,
      duration: 90,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.player.setAlpha(1),
    });
    if (this.health <= 0) this.finishRaid('died');
  }

  private defeatEnemy(enemy: EnemyEntity): void {
    const { x, y } = enemy.sprite;
    enemy.sprite.disableBody(true, true);
    enemy.label?.destroy();
    if (enemy.boss) {
      this.bossDefeated = true;
      this.spawnLoot('boss-core', 'echo_core', 1, x - 34, y - 18);
      this.spawnLoot('boss-boots', 'shadow_boots', 1, x + 36, y - 18);
      this.cameras.main.flash(380, 151, 113, 224);
      this.showHint('失频守卫停止了。回声核心正在等待被带回。', 2600);
    } else {
      const quantity = enemy.kind === 'moth' || enemy.id.includes('foyer-2') ? 2 : 1;
      this.spawnLoot(`drop-${enemy.id}-${Math.round(this.time.now)}`, 'echo_dust', quantity, x, y - 12);
    }
    const burst = this.add.text(x, y, '✦  ✧  ✦', {
      fontSize: '20px',
      color: '#b9f8e7',
      stroke: '#14232b',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({
      targets: burst,
      y: y - 55,
      alpha: 0,
      scale: 1.5,
      duration: 520,
      onComplete: () => burst.destroy(),
    });
  }

  private breakCrate(crate: RaidCrate): void {
    crate.broken = true;
    const { x, y } = crate.sprite;
    this.tweens.add({
      targets: crate.sprite,
      angle: 14,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.65,
      y: y + 18,
      duration: 180,
      onComplete: () => crate.sprite.destroy(),
    });
    crate.drops.forEach((drop, index) => {
      this.time.delayedCall(index * 90, () => {
        this.spawnLoot(`${crate.id}-${drop.itemId}`, drop.itemId, drop.quantity, x + (index * 46 - 22), y - 24);
      });
    });
    this.spawnImpact(x, y);
  }

  private spawnImpact(x: number, y: number): void {
    for (let i = 0; i < 5; i += 1) {
      const spark = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0xc4fff0, 0.9).setDepth(40);
      this.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-42, 42),
        y: y + Phaser.Math.Between(-45, 25),
        alpha: 0,
        duration: Phaser.Math.Between(180, 330),
        onComplete: () => spark.destroy(),
      });
    }
  }

  private respawnFromPit(): void {
    this.health -= 1;
    if (this.health <= 0) {
      this.finishRaid('died');
      return;
    }
    this.player.setPosition(this.getEntryX(), 540);
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(220, 110, 30, 42);
    this.showHint('空洞把你吐回了入口。失去 1 点生命。', 1800);
  }

  private updateInteractions(time: number): void {
    if (this.extractingUntil > 0) {
      const distance = Math.abs(this.player.x - this.extractionX);
      if (distance > 105) {
        this.extractingUntil = 0;
        this.extractionText.setVisible(false);
        this.showHint('已离开信号范围，撤离取消。', 1100);
      } else {
        const remaining = Math.max(0, this.extractingUntil - time);
        const blocks = Math.ceil((1 - remaining / 2500) * 12);
        this.extractionText
          .setText(`正在上传战利品  ${'▰'.repeat(blocks)}${'▱'.repeat(12 - blocks)}  ${(remaining / 1000).toFixed(1)}s`)
          .setVisible(true);
        if (remaining <= 0) {
          this.finishRaid('extracted');
          return;
        }
      }
    }

    const interactPressed = Phaser.Input.Keyboard.JustDown(this.keys.interact)
      || Phaser.Input.Keyboard.JustDown(this.keys.interactAlt);
    let prompt: string | null = null;

    if (this.lostEchoIcon?.active && Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.lostEchoIcon.x,
      this.lostEchoIcon.y,
    ) < 95) {
      prompt = 'E · 找回遗失回声（再次死亡前只有这一次）';
      if (interactPressed && this.profile.lostEcho) this.recoverLostEcho();
    } else {
      const nearbyLoot = this.loot.find((entry) => entry.icon.active && Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        entry.icon.x,
        entry.icon.y,
      ) < 88);

      if (nearbyLoot) {
        const item = ITEMS[nearbyLoot.itemId];
        prompt = `E · 拾取 ${item.icon} ${item.name}${nearbyLoot.quantity > 1 ? ` ×${nearbyLoot.quantity}` : ''}`;
        if (interactPressed) this.collectLoot(nearbyLoot);
      } else if (Math.abs(this.player.x - this.elevatorX) < 90) {
        prompt = this.shortcutUnlocked ? '维护电梯已启动 · 下轮可从深层入口出发' : 'E · 启动维护电梯捷径';
        if (interactPressed && !this.shortcutUnlocked) {
          this.shortcutUnlocked = true;
          this.showHint('维护电梯已记录到基地。以后可快速进入深层。', 2200);
        }
      } else {
        const extraction = [620, 4550].find((x) => Math.abs(this.player.x - x) < 92);
        if (extraction) {
          prompt = this.extractingUntil > 0 ? '留在信号圈内…' : 'E · 开始安全撤离（2.5 秒）';
          if (interactPressed && this.extractingUntil === 0) {
            this.extractionX = extraction;
            this.extractingUntil = time + 2500;
          }
        }
      }
    }

    this.nearbyInteraction = prompt;
    this.promptText.setText(prompt ?? '').setVisible(Boolean(prompt) && this.extractingUntil === 0);
  }

  private collectLoot(entry: LootEntity): void {
    if (!hasInventoryRoom(this.backpack, this.profile.backpackCapacity, entry.itemId)) {
      this.showHint(`背包已满（${this.backpack.length}/${this.profile.backpackCapacity} 格）。按 Tab 查看。`, 1400);
      return;
    }
    this.backpack = addItem(this.backpack, entry.itemId, entry.quantity);
    if (entry.itemId === 'map_feather') this.mapUnlocked = true;
    entry.icon.destroy();
    entry.halo.destroy();
    this.showHint(`已拾取：${ITEMS[entry.itemId].name}${entry.quantity > 1 ? ` ×${entry.quantity}` : ''}`, 900);
  }

  private recoverLostEcho(): void {
    if (!this.profile.lostEcho || this.recoveredEcho) return;
    this.recoveredEchoItems = addStacks(this.recoveredEchoItems, this.profile.lostEcho.items);
    this.recoveredEcho = true;
    this.lostEchoIcon?.destroy();
    this.lostEchoHalo?.destroy();
    this.lostEchoIcon = null;
    this.lostEchoHalo = null;
    this.showHint(`已找回 ${this.recoveredEchoItems.reduce((sum, stack) => sum + stack.quantity, 0)} 件遗失物。安全撤离才能带回基地。`, 2400);
  }

  private finishRaid(outcome: 'extracted' | 'died'): void {
    if (this.runEnded) return;
    this.runEnded = true;
    this.extractingUntil = 0;
    this.promptText?.setVisible(false);
    this.extractionText?.setVisible(false);
    this.physics.pause();
    this.player.setVelocity(0, 0);

    const combinedLoot = addStacks(this.backpack, this.recoveredEchoItems);
    const result: RaidResult = {
      outcome,
      backpack: combinedLoot,
      armorCondition: this.armor,
      mapUnlocked: this.mapUnlocked,
      shortcutUnlocked: this.shortcutUnlocked,
      bossDefeated: this.bossDefeated,
      recoveredEcho: this.recoveredEcho,
    };

    if (outcome === 'died') {
      result.deathPosition = {
        x: Math.round(Phaser.Math.Clamp(this.player.x, 80, WORLD_WIDTH - 80)),
        y: Math.round(Phaser.Math.Clamp(this.player.y, 120, 640)),
      };
      this.player.setTint(0x6e5b80);
      this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x03070c, 0.72)
        .setScrollFactor(0)
        .setDepth(190);
      this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 26, '信 号 中 断', {
        fontFamily: 'Georgia, serif',
        fontSize: '46px',
        color: '#d4c2e8',
        letterSpacing: 8,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(191);
      this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 38, '遗失物会在下一轮留在这里一次', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#8f81a0',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(191);
      this.time.delayedCall(1050, () => this.onResult(result));
      return;
    }

    this.cameras.main.fadeOut(520, 182, 255, 231);
    this.time.delayedCall(620, () => this.onResult(result));
  }

  private updateHud(): void {
    const hearts = `${'♥'.repeat(this.health)}${'♡'.repeat(this.maxHealth - this.health)}`;
    const armor = this.maxArmor > 0
      ? `${'◆'.repeat(this.armor)}${'◇'.repeat(this.maxArmor - this.armor)}`
      : '无护甲';
    this.statusText.setText(`生命  ${hearts}    蓝甲  ${armor}    背包  ${this.backpack.length}/${this.profile.backpackCapacity}`);
    const zone = this.getZone();
    this.zoneText.setText(`${zone.name} · 风险 ${zone.risk}`);
    const boss = this.enemies.find((enemy) => enemy.boss && enemy.sprite.active);
    if (boss && this.player.x > 3650) {
      const filled = Math.ceil((boss.health / boss.maxHealth) * 18);
      this.bossHealthText
        .setText(`失频守卫  ${'▰'.repeat(filled)}${'▱'.repeat(18 - filled)}`)
        .setVisible(true);
    } else {
      this.bossHealthText.setVisible(false);
    }
  }

  private toggleOverlay(mode: 'map' | 'backpack'): void {
    if (this.overlayMode === mode) {
      this.closeOverlay();
      return;
    }
    this.closeOverlay();
    this.overlayMode = mode;
    this.physics.pause();
    this.overlay = mode === 'map' ? this.createMapOverlay() : this.createBackpackOverlay();
  }

  private closeOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = null;
    if (this.overlayMode && !this.runEnded) this.physics.resume();
    this.overlayMode = null;
  }

  private createMapOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(170);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02090d, 0.9);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 1090, 510, 0x0a2028, 0.98)
      .setStrokeStyle(2, 0x75d7c2, 0.24);
    const title = this.add.text(145, 135, this.mapUnlocked ? '寂羽空洞 · 完整测绘' : '寂羽空洞 · 相对定位', {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      color: '#d8eee8',
    });
    const subtitle = this.add.text(145, 176, this.mapUnlocked
      ? '导航羽片已解析房间、捷径与撤离信号。'
      : '地图数据损坏，但你的相对位置与主目标仍然可见。找到导航羽片可恢复细节。', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#789795',
    });
    const mapGraphic = this.add.graphics();
    mapGraphic.lineStyle(4, this.mapUnlocked ? 0x67cbb6 : 0x4e6669, this.mapUnlocked ? 0.8 : 0.42);
    mapGraphic.beginPath();
    mapGraphic.moveTo(175, 380);
    mapGraphic.lineTo(380, 330);
    mapGraphic.lineTo(585, 390);
    mapGraphic.lineTo(790, 300);
    mapGraphic.lineTo(1095, 355);
    mapGraphic.strokePath();
    container.add([shade, panel, title, subtitle, mapGraphic]);

    const nodePositions = [175, 380, 585, 790, 1095];
    const nodeLabels = this.mapUnlocked
      ? ['入口', '前庭撤离', '荧菌裂谷', '维护电梯', '静默机房']
      : ['入口', '安全信号', '未知', '未知', '深层目标'];
    nodePositions.forEach((x, index) => {
      const y = [380, 330, 390, 300, 355][index];
      const node = this.add.circle(x, y, index === 4 ? 17 : 12, index === 4 ? 0xa281df : 0x74d6bf, 0.85)
        .setStrokeStyle(4, 0x07151d, 1);
      const label = this.add.text(x, y + 28, nodeLabels[index], {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#8da9a7',
      }).setOrigin(0.5, 0);
      container.add([node, label]);
    });

    const playerMapX = 175 + (this.player.x / WORLD_WIDTH) * 920;
    const playerMarker = this.add.text(playerMapX, 260, '▼ 你', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#f1c879',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(0.5);
    const targetMarker = this.add.text(this.bossDefeated ? 380 : (this.mapUnlocked ? 585 : 1095), 455, '◇ 主目标', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#d8b3ff',
    }).setOrigin(0.5);
    const footer = this.add.text(VIEW_WIDTH / 2, 575, 'M 关闭地图', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#63817f',
      letterSpacing: 2,
    }).setOrigin(0.5);
    container.add([playerMarker, targetMarker, footer]);
    return container;
  }

  private createBackpackOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(170);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02090d, 0.9);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 850, 500, 0x0a2028, 0.98)
      .setStrokeStyle(2, 0x75d7c2, 0.24);
    const title = this.add.text(250, 140, `远征背包  ${this.backpack.length} / ${this.profile.backpackCapacity} 格`, {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      color: '#d8eee8',
    });
    const subtitle = this.add.text(250, 182, '只有从撤离点安全返回，物品才会写入饼干台仓库。', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#789795',
    });
    container.add([shade, panel, title, subtitle]);

    for (let index = 0; index < this.profile.backpackCapacity; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 300 + column * 170;
      const y = 270 + row * 130;
      const slot = this.add.rectangle(x, y, 150, 105, 0x07171e, 0.88)
        .setStrokeStyle(1, 0x6bcbb6, 0.18);
      container.add(slot);
      const stack = this.backpack[index];
      if (!stack) {
        container.add(this.add.text(x, y, '·', { fontSize: '25px', color: '#214047' }).setOrigin(0.5));
        continue;
      }
      const item = ITEMS[stack.itemId];
      container.add([
        this.add.text(x, y - 18, item.icon, { fontSize: '30px' }).setOrigin(0.5),
        this.add.text(x, y + 22, item.name, { fontSize: '12px', color: '#c6ded9' }).setOrigin(0.5),
        this.add.text(x + 58, y - 40, stack.quantity > 1 ? `×${stack.quantity}` : '', { fontSize: '11px', color: '#f1c879' }).setOrigin(1, 0),
      ]);
    }

    if (this.recoveredEchoItems.length > 0) {
      container.add(this.add.text(250, 490, `◉ 遗失回声包：${this.recoveredEchoItems.reduce((sum, stack) => sum + stack.quantity, 0)} 件（不占普通背包格）`, {
        fontSize: '12px',
        color: '#c4a5f4',
      }));
    }
    container.add(this.add.text(VIEW_WIDTH / 2, 585, 'Tab 关闭背包', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#63817f',
      letterSpacing: 2,
    }).setOrigin(0.5));
    return container;
  }

  private getZone(): { name: string; risk: string } {
    const zone = DEMO_MAP.zones.find((entry) => this.player.x >= entry.startX && this.player.x < entry.endX)
      ?? DEMO_MAP.zones[DEMO_MAP.zones.length - 1];
    return { name: zone.name, risk: zone.risk };
  }

  private getEntryX(): number {
    return DEMO_MAP.entries[this.entryId].x;
  }

  private showHint(message: string, duration: number): void {
    this.hintText?.setText(message).setAlpha(1);
    this.tweens.killTweensOf(this.hintText);
    this.tweens.add({ targets: this.hintText, alpha: 0, delay: duration, duration: 300 });
  }

  private publishTextState(force: boolean): void {
    if (!force) return;
    this.lastTextStateAt = this.time.now;
    const body = this.player.body;
    const state: TextGameState = {
      mode: 'raid',
      coordinateSystem: `World origin is top-left; +x right, +y down; world ${WORLD_WIDTH}x${VIEW_HEIGHT}.`,
      objective: getCurrentObjective(this.profile),
      zone: this.getZone().name,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        velocityX: Math.round(body.velocity.x),
        velocityY: Math.round(body.velocity.y),
        health: this.health,
        maxHealth: this.maxHealth,
        armor: this.armor,
        maxArmor: this.maxArmor,
        facing: this.facing < 0 ? 'left' : 'right',
        grounded: body.blocked.down || body.touching.down,
      },
      backpack: this.backpack.map((stack) => ({ ...stack })),
      visibleEnemies: this.enemies
        .filter((enemy) => enemy.sprite.active && Math.abs(enemy.sprite.x - this.player.x) < 800)
        .map((enemy) => ({
          id: enemy.id,
          kind: enemy.kind,
          x: Math.round(enemy.sprite.x),
          y: Math.round(enemy.sprite.y),
          health: enemy.health,
        })),
      visibleLoot: this.loot
        .filter((entry) => entry.icon.active && Math.abs(entry.icon.x - this.player.x) < 800)
        .map((entry) => ({
          id: entry.id,
          itemId: entry.itemId,
          x: Math.round(entry.icon.x),
          y: Math.round(entry.icon.y),
        })),
      nearbyInteraction: this.nearbyInteraction,
      flags: {
        dashReady: this.time.now >= this.dashReadyAt,
        dashEquipped: Boolean(this.profile.loadout.shoes && ITEMS[this.profile.loadout.shoes]?.stats?.dashEnabled),
        mapUnlocked: this.mapUnlocked,
        shortcutUnlocked: this.shortcutUnlocked,
        recoveredEcho: this.recoveredEcho,
        extracting: this.extractingUntil > 0,
      },
    };
    window.__SUI_GAME_STATE__ = state;
  }
}
