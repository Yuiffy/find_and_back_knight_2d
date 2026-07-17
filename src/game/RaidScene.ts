import Phaser from 'phaser';
import {
  addStacks,
  cloneGridItems,
  insertGridStack,
  moveGridItem,
  occupiedGridCells,
} from './inventory';
import { getArmorMaximum, getCurrentObjective, ITEMS, RARITY_NAMES, SLOT_NAMES } from './items';
import { DEMO_MAP } from './maps';
import type { GearSlot, GridItem, ItemStack, Loadout, PlayerProfile, RaidResult, TextGameState } from '../types/game';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const WORLD_WIDTH = DEMO_MAP.worldWidth;
const WORLD_HEIGHT = DEMO_MAP.worldHeight;

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

interface RaidInventoryDrag {
  source: 'backpack' | 'ground';
  uid?: string;
  lootId?: string;
}

const RAID_EQUIPMENT_SLOTS: GearSlot[] = ['weapon', 'armor', 'head', 'shoes'];
const NEARBY_LOOT_RADIUS = 240;

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
  private backpack: GridItem[] = [];
  private loadout: Loadout;
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
  private extractionPoint: { x: number; y: number } | null = null;
  private nearbyInteraction: string | null = null;
  private lostEchoIcon: Phaser.GameObjects.Text | null = null;
  private lostEchoHalo: Phaser.GameObjects.Arc | null = null;
  private readonly elevatorPoint = { x: 1450, y: 1330 };
  private readonly extractionPoints = [
    { x: 520, y: 1995, label: '前庭撤离点' },
    { x: 3010, y: 595, label: '机房信号井' },
  ];
  private attackGraphics: Phaser.GameObjects.Rectangle | null = null;
  private lastTextStateAt = 0;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayMode: 'map' | 'backpack' | null = null;
  private overlayNotice = '';
  private activeInventoryDrag: RaidInventoryDrag | null = null;
  private inventoryDragGhost: Phaser.GameObjects.Text | null = null;

  constructor({ profile, entryId, onResult }: RaidSceneOptions) {
    super('raid');
    this.profile = profile;
    this.loadout = { ...profile.loadout };
    this.entryId = entryId;
    this.onResult = onResult;
  }

  preload(): void {
    this.load.image('sui-bird', '/assets/sui-bird.png');
  }

  create(): void {
    this.health = this.maxHealth;
    this.maxArmor = getArmorMaximum({ loadout: this.loadout });
    this.armor = Math.min(this.profile.armorCondition, this.maxArmor);
    this.mapUnlocked = this.profile.mapUnlocked;
    this.shortcutUnlocked = this.profile.shortcutUnlocked;
    this.bossDefeated = this.profile.bossDefeated;
    this.backpack = cloneGridItems(this.profile.backpack.items);
    this.createTextures();
    this.createBackdrop();
    this.createPlatforms();
    this.createPlayer();
    this.createEnemies();
    this.createLandmarks();
    this.createInput();
    this.createHud();
    this.invulnerableUntil = this.time.now + 3000;

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.085, 0.1, -120, 20);
    this.cameras.main.setDeadzone(330, 150);
    this.cameras.main.setBackgroundColor('#07151d');
    this.input.mouse?.disableContextMenu();

    this.physics.add.collider(
      this.player,
      this.platforms,
      undefined,
      (playerObject, platformObject) => {
        const playerBody = (playerObject as Phaser.Types.Physics.Arcade.GameObjectWithBody).body as Phaser.Physics.Arcade.Body;
        const platformBody = (platformObject as Phaser.Types.Physics.Arcade.GameObjectWithBody).body as Phaser.Physics.Arcade.StaticBody;
        // 探索平台只在从上方下落时承接玩家，避免竖井台阶变成跳跃时撞到的侧墙。
        return playerBody.velocity.y >= -10 && playerBody.bottom <= platformBody.top + 20;
      },
    );
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

    if (this.player.y > WORLD_HEIGHT + 100) {
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
    farCaves.setScrollFactor(0.12, 0.08);
    farCaves.fillStyle(0x0e2932, 1);
    for (let y = 240; y < WORLD_HEIGHT + 600; y += 520) {
      for (let x = -200; x < WORLD_WIDTH + 500; x += 300) {
        const peak = y - 360 - ((x / 300) % 3) * 45;
        farCaves.fillTriangle(x, y, x + 165, peak, x + 340, y);
      }
    }

    const midCaves = this.add.graphics();
    midCaves.setScrollFactor(0.34, 0.22);
    midCaves.fillStyle(0x102f36, 0.85);
    for (let y = 380; y < WORLD_HEIGHT + 500; y += 620) {
      for (let x = -80; x < WORLD_WIDTH + 500; x += 430) midCaves.fillEllipse(x + 90, y, 470, 390);
    }

    for (let i = 0; i < 72; i += 1) {
      const mote = this.add.circle(
        Phaser.Math.Between(0, WORLD_WIDTH),
        Phaser.Math.Between(80, WORLD_HEIGHT - 80),
        Phaser.Math.Between(1, 3),
        i % 5 === 0 ? 0xe8c77b : 0x75d7c2,
        Phaser.Math.FloatBetween(0.12, 0.4),
      );
      mote.setScrollFactor(Phaser.Math.FloatBetween(0.45, 0.9));
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

    this.add.text(90, 1790, '失落前庭', {
      fontFamily: 'Georgia, serif',
      fontSize: '48px',
      color: '#c7e8df',
    }).setAlpha(0.12);
    this.add.text(96, 1844, 'THE HOLLOW OF LOST FEATHERS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      letterSpacing: 4,
      color: '#87d7c5',
    }).setAlpha(0.2);

    this.add.text(900, 1180, '荧菌裂谷', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#a5e8d7',
    }).setAlpha(0.1);
    this.add.text(2400, 360, '静默机房', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#c9b6f2',
    }).setAlpha(0.1);

    const fungi = this.add.graphics().setDepth(2);
    for (let x = 520; x < 2200; x += 190) {
      const floor = 980 + ((x / 190) % 5) * 150;
      const height = 60 + ((x / 190) % 3) * 20;
      fungi.fillStyle(0x4b8c87, 0.16);
      fungi.fillRoundedRect(x, floor - height, 14, height, 7);
      fungi.fillStyle(0x76d8c4, 0.18);
      fungi.fillEllipse(x + 7, floor - height, 94, 34);
      fungi.lineStyle(2, 0xa7f1d9, 0.16);
      fungi.strokeEllipse(x + 7, floor - height, 94, 34);
    }

    const machines = this.add.graphics().setDepth(2);
    machines.lineStyle(11, 0x293744, 0.72);
    machines.beginPath();
    machines.moveTo(2140, 180);
    machines.lineTo(2380, 180);
    machines.lineTo(2380, 380);
    machines.lineTo(2660, 380);
    machines.lineTo(2660, 140);
    machines.lineTo(3160, 140);
    machines.strokePath();
    for (let x = 2200; x < 3180; x += 280) {
      machines.fillStyle(0x182731, 0.82);
      machines.fillRoundedRect(x, 360, 150, 250, 18);
      machines.lineStyle(2, 0x8e6fc4, 0.18);
      machines.strokeRoundedRect(x, 360, 150, 250, 18);
      machines.fillStyle(0x8a6ac0, 0.3);
      machines.fillCircle(x + 75, 405, 12);
    }
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    const segments = [
      // 失落前庭与下层侧洞
      { x: 420, y: 2080, width: 840 },
      { x: 1050, y: 2080, width: 300 },
      { x: 1390, y: 1990, width: 300 },
      { x: 1680, y: 1900, width: 300 },
      { x: 1960, y: 1990, width: 280 },
      // 回声竖井：每级 90–110px，低于完整跳跃高度
      { x: 780, y: 1970, width: 220 },
      { x: 900, y: 1865, width: 340 },
      { x: 780, y: 1760, width: 220 },
      { x: 900, y: 1655, width: 340 },
      { x: 780, y: 1550, width: 240 },
      { x: 900, y: 1450, width: 340 },
      { x: 610, y: 1420, width: 520 },
      { x: 1210, y: 1450, width: 420 },
      // 荧菌裂谷的折返上升路线与地图支路
      { x: 1500, y: 1390, width: 400 },
      { x: 1650, y: 1295, width: 400 },
      { x: 1510, y: 1200, width: 360 },
      { x: 1650, y: 1105, width: 400 },
      { x: 1540, y: 1010, width: 360 },
      { x: 1220, y: 1050, width: 350 },
      { x: 1900, y: 930, width: 700 },
      // 机房上层与 Boss 房
      { x: 2260, y: 840, width: 260 },
      { x: 2470, y: 780, width: 360 },
      { x: 2790, y: 680, width: 820 },
    ];

    for (const segment of segments) {
      const platform = this.platforms.create(segment.x, segment.y, 'stone-platform') as Phaser.Physics.Arcade.Sprite;
      platform.setDisplaySize(segment.width, 38);
      platform.refreshBody();
    }
  }

  private createPlayer(): void {
    const entry = this.getEntryPosition();
    this.player = this.physics.add.sprite(entry.x, entry.y, 'sui-bird');
    this.player.setScale(0.28);
    // 本地鸟素材原图面向左；向右移动时必须翻转，否则会变成尾巴朝前。
    this.player.setFlipX(true);
    this.player.setDepth(20);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(720, 1100);
    this.player.setDragX(1500);
    this.player.body.setSize(180, 185);
    this.player.body.setOffset(85, 48);
  }

  private createEnemies(): void {
    this.spawnHusk('husk-foyer-1', 760, 2010, 600, 810);
    this.spawnHusk('husk-foyer-2', 1390, 1920, 1270, 1510);
    this.spawnHusk('husk-shaft-1', 1030, 1585, 930, 1130);
    this.spawnMoth('moth-rift-1', 1560, 1280, 1370, 1840);
    this.spawnHusk('husk-rift-1', 1950, 860, 1740, 2220);
    if (!this.profile.bossDefeated) this.spawnWarden();
  }

  private createLandmarks(): void {
    for (const extraction of this.extractionPoints) this.createExtractionBeacon(extraction.x, extraction.y, extraction.label);

    this.spawnCrate('crate-foyer', 390, 2030, [
      { itemId: 'echo_dust', quantity: 4 },
      { itemId: 'repair_patch', quantity: 1 },
    ]);
    this.spawnCrate('crate-rift', 1100, 1400, [
      { itemId: 'echo_lance', quantity: 1 },
      { itemId: 'echo_dust', quantity: 2 },
    ]);
    this.spawnCrate('crate-deep', 2010, 880, [
      { itemId: 'miner_shell', quantity: 1 },
      { itemId: 'echo_dust', quantity: 3 },
    ]);
    this.spawnLoot('map-feather', 'map_feather', 1, 1220, 995);

    const liftBase = this.add.rectangle(this.elevatorPoint.x, this.elevatorPoint.y, 118, 118, 0x152f3a, 0.92)
      .setStrokeStyle(3, 0x75d7c2, 0.28)
      .setDepth(5);
    this.add.rectangle(this.elevatorPoint.x, this.elevatorPoint.y, 62, 88, 0x07151d, 0.8).setDepth(6);
    const liftLamp = this.add.circle(this.elevatorPoint.x, this.elevatorPoint.y - 50, 7, this.shortcutUnlocked ? 0x83f2c5 : 0xe1a35f, 0.9).setDepth(7);
    this.add.text(this.elevatorPoint.x, this.elevatorPoint.y - 78, '维护电梯', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#789a99',
    }).setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: liftLamp, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    liftBase.setData('landmark', 'elevator');

    if (this.profile.lostEcho) {
      const x = Phaser.Math.Clamp(this.profile.lostEcho.x, 120, WORLD_WIDTH - 120);
      const y = Phaser.Math.Clamp(this.profile.lostEcho.y - 40, 120, WORLD_HEIGHT - 120);
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

  private createExtractionBeacon(x: number, y: number, label: string): void {
    const glow = this.add.circle(x, y, 54, 0x63d7b8, 0.07)
      .setStrokeStyle(3, 0x87e9ca, 0.45)
      .setDepth(7);
    this.add.circle(x, y, 31, 0x09242a, 0.75)
      .setStrokeStyle(1, 0xa8f8e1, 0.3)
      .setDepth(8);
    this.add.text(x, y, '⇧', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '30px',
      color: '#a9f2dc',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9);
    this.add.text(x, y - 72, label, {
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
      baseY: y,
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
    const sprite = this.physics.add.sprite(2880, 600, 'signal-warden');
    sprite.setDepth(18);
    sprite.body.setSize(105, 78);
    sprite.body.setOffset(11, 15);
    const label = this.add.text(2880, 514, '失频守卫', {
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
      health: 15,
      maxHealth: 15,
      speed: 58,
      direction: -1,
      patrolLeft: 2700,
      patrolRight: 3120,
      baseY: 600,
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
    this.input.on('pointerdown', () => {
      if (!this.overlayMode) this.tryAttack(this.time.now);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activeInventoryDrag && this.inventoryDragGhost) {
        this.inventoryDragGhost.setPosition(pointer.x + 18, pointer.y + 18);
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.activeInventoryDrag || this.overlayMode !== 'backpack') return;
      const drag = this.activeInventoryDrag;
      this.activeInventoryDrag = null;
      this.inventoryDragGhost?.destroy();
      this.inventoryDragGhost = null;
      if (!this.handleRaidInventoryPointerDrop(drag, pointer)) this.refreshBackpackOverlay();
    });
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

    const weapon = this.loadout.weapon ? ITEMS[this.loadout.weapon] : ITEMS.rust_nail;
    const shoes = this.loadout.shoes ? ITEMS[this.loadout.shoes] : null;
    const armor = this.loadout.armor ? ITEMS[this.loadout.armor] : null;
    const speedMultiplier = (shoes?.stats?.speedMultiplier ?? 1) * (armor?.stats?.speedMultiplier ?? 1);
    const moveSpeed = 300 * speedMultiplier;
    const leftDown = this.keys.left.isDown || this.keys.leftArrow.isDown;
    const rightDown = this.keys.right.isDown || this.keys.rightArrow.isDown;
    const desiredVelocity = leftDown === rightDown ? 0 : (leftDown ? -moveSpeed : moveSpeed);
    const responsiveness = grounded ? 0.28 : 0.16;
    this.player.setVelocityX(Phaser.Math.Linear(body.velocity.x, desiredVelocity, responsiveness));

    if (leftDown && !rightDown) this.facing = -1;
    if (rightDown && !leftDown) this.facing = 1;
    this.player.setFlipX(this.facing > 0);

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
        .setFlipX(this.facing > 0)
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
    const weapon = this.loadout.weapon ? ITEMS[this.loadout.weapon] : ITEMS.rust_nail;
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
      if (enemy.sprite.y > WORLD_HEIGHT + 100) {
        enemy.sprite.setPosition((enemy.patrolLeft + enemy.patrolRight) / 2, enemy.baseY ?? 600);
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
      const speed = enemy.kind === 'warden' && chasing ? enemy.speed * 1.35 : enemy.speed;
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
    const entry = this.getEntryPosition();
    this.player.setPosition(entry.x, entry.y);
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(220, 110, 30, 42);
    this.showHint('空洞把你吐回了入口。失去 1 点生命。', 1800);
  }

  private updateInteractions(time: number): void {
    if (this.extractingUntil > 0) {
      const distance = this.extractionPoint
        ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.extractionPoint.x, this.extractionPoint.y)
        : Number.POSITIVE_INFINITY;
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
      } else if (Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.elevatorPoint.x,
        this.elevatorPoint.y,
      ) < 105) {
        prompt = this.shortcutUnlocked ? '维护电梯已启动 · 下轮可从深层入口出发' : 'E · 启动维护电梯捷径';
        if (interactPressed && !this.shortcutUnlocked) {
          this.shortcutUnlocked = true;
          this.showHint('维护电梯已记录到基地。以后可快速进入深层。', 2200);
        }
      } else {
        const extraction = this.extractionPoints.find((point) => Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          point.x,
          point.y,
        ) < 100);
        if (extraction) {
          prompt = this.extractingUntil > 0 ? '留在信号圈内…' : 'E · 开始安全撤离（2.5 秒）';
          if (interactPressed && this.extractingUntil === 0) {
            this.extractionPoint = extraction;
            this.extractingUntil = time + 2500;
          }
        }
      }
    }

    this.nearbyInteraction = prompt;
    this.promptText.setText(prompt ?? '').setVisible(Boolean(prompt) && this.extractingUntil === 0);
  }

  private collectLoot(entry: LootEntity): void {
    const inserted = insertGridStack(this.backpack, this.profile.backpack, {
      itemId: entry.itemId,
      quantity: entry.quantity,
    });
    if (!inserted) {
      const size = ITEMS[entry.itemId].size;
      this.showHint(`背包缺少 ${size.width}×${size.height} 连续空格。按 Tab 查看布局。`, 1600);
      return;
    }
    this.backpack = inserted;
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

    const result: RaidResult = {
      outcome,
      backpack: cloneGridItems(this.backpack),
      loadout: { ...this.loadout },
      recoveredItems: this.recoveredEchoItems.map((stack) => ({ ...stack })),
      armorCondition: this.armor,
      mapUnlocked: this.mapUnlocked,
      shortcutUnlocked: this.shortcutUnlocked,
      bossDefeated: this.bossDefeated,
      recoveredEcho: this.recoveredEcho,
    };

    if (outcome === 'died') {
      result.deathPosition = {
        x: Math.round(Phaser.Math.Clamp(this.player.x, 80, WORLD_WIDTH - 80)),
        y: Math.round(Phaser.Math.Clamp(this.player.y, 120, WORLD_HEIGHT - 80)),
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
    const bagUsed = occupiedGridCells(this.backpack);
    const bagTotal = this.profile.backpack.width * this.profile.backpack.height;
    this.statusText.setText(`生命  ${hearts}    蓝甲  ${armor}    背包  ${bagUsed}/${bagTotal} 格`);
    const zone = this.getZone();
    this.zoneText.setText(`${zone.name} · 风险 ${zone.risk}`);
    const boss = this.enemies.find((enemy) => enemy.boss && enemy.sprite.active);
    if (boss && Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.sprite.x, boss.sprite.y) < 760) {
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
    this.overlay = mode === 'map' ? this.createMapOverlay() : this.createRaidInventoryOverlay();
  }

  private closeOverlay(): void {
    this.activeInventoryDrag = null;
    this.inventoryDragGhost?.destroy();
    this.inventoryDragGhost = null;
    this.overlay?.destroy(true);
    this.overlay = null;
    if (this.overlayMode && !this.runEnded) this.physics.resume();
    this.overlayMode = null;
  }

  private createMapOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(170);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02090d, 0.9);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 1090, 540, 0x0a2028, 0.98)
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
    const mapLeft = 185;
    const mapTop = 215;
    const mapWidth = 900;
    const mapHeight = 310;
    const sx = (x: number) => mapLeft + (x / WORLD_WIDTH) * mapWidth;
    const sy = (y: number) => mapTop + (y / WORLD_HEIGHT) * mapHeight;
    const mapGraphic = this.add.graphics();
    mapGraphic.lineStyle(6, this.mapUnlocked ? 0x67cbb6 : 0x4e6669, this.mapUnlocked ? 0.68 : 0.36);
    mapGraphic.beginPath();
    mapGraphic.moveTo(sx(300), sy(1990));
    mapGraphic.lineTo(sx(950), sy(1550));
    mapGraphic.lineTo(sx(1500), sy(1350));
    mapGraphic.lineTo(sx(1750), sy(980));
    mapGraphic.lineTo(sx(2450), sy(720));
    mapGraphic.lineTo(sx(2980), sy(620));
    mapGraphic.strokePath();
    const rooms = [
      { x: 90, y: 1770, w: 1030, h: 330, color: 0x315d61 },
      { x: 650, y: 1350, w: 1050, h: 440, color: 0x36786f },
      { x: 1050, y: 850, w: 1250, h: 570, color: 0x397e73 },
      { x: 2200, y: 430, w: 980, h: 430, color: 0x5f4e7d },
    ];
    for (const room of rooms) {
      mapGraphic.fillStyle(room.color, this.mapUnlocked ? 0.22 : 0.1);
      mapGraphic.fillRoundedRect(sx(room.x), sy(room.y), (room.w / WORLD_WIDTH) * mapWidth, (room.h / WORLD_HEIGHT) * mapHeight, 8);
    }
    container.add([shade, panel, title, subtitle, mapGraphic]);

    const nodes = [
      { x: 240, y: 1960, known: '入口', unknown: '入口' },
      { x: 520, y: 1995, known: '前庭撤离', unknown: '安全信号' },
      { x: 1220, y: 995, known: '导航羽片', unknown: '未知目标' },
      { x: 1450, y: 1330, known: '维护电梯', unknown: '未知设施' },
      { x: 3010, y: 595, known: '机房撤离', unknown: '深层信号' },
    ];
    nodes.forEach((entry, index) => {
      const x = sx(entry.x);
      const y = sy(entry.y);
      const node = this.add.circle(x, y, index === 4 ? 15 : 10, index === 4 ? 0xa281df : 0x74d6bf, 0.9)
        .setStrokeStyle(4, 0x07151d, 1);
      const label = this.add.text(x, y + 19, this.mapUnlocked ? entry.known : entry.unknown, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#8da9a7',
      }).setOrigin(0.5, 0);
      container.add([node, label]);
    });

    const playerMarker = this.add.text(sx(this.player.x), sy(this.player.y) - 18, '▼ 你', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#f1c879',
      stroke: '#07151d',
      strokeThickness: 4,
    }).setOrigin(0.5);
    const targetPosition = !this.mapUnlocked
      ? { x: 1220, y: 995 }
      : (this.bossDefeated ? { x: 520, y: 1995 } : { x: 2760, y: 600 });
    const targetMarker = this.add.text(sx(targetPosition.x), sy(targetPosition.y) - 34, '◇ 主目标', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#d8b3ff',
    }).setOrigin(0.5);
    const footer = this.add.text(VIEW_WIDTH / 2, 602, 'M 关闭地图 · 房间图同时使用 X / Y 两个坐标轴', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#63817f',
      letterSpacing: 2,
    }).setOrigin(0.5);
    container.add([playerMarker, targetMarker, footer]);
    return container;
  }

  private getNearbyLoot(): LootEntity[] {
    return this.loot
      .filter((entry) => entry.icon.active && Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        entry.icon.x,
        entry.icon.y,
      ) <= NEARBY_LOOT_RADIUS)
      .sort((left, right) => Phaser.Math.Distance.Between(this.player.x, this.player.y, left.icon.x, left.icon.y)
        - Phaser.Math.Distance.Between(this.player.x, this.player.y, right.icon.x, right.icon.y));
  }

  private refreshBackpackOverlay(): void {
    if (this.overlayMode !== 'backpack') return;
    this.overlay?.destroy(true);
    this.overlay = this.createRaidInventoryOverlay();
    this.updateHud();
    this.publishTextState(true);
  }

  private createInventoryDragCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    itemId: string,
    quantity: number,
    drag: RaidInventoryDrag,
    compact = false,
  ): Phaser.GameObjects.Container {
    const item = ITEMS[itemId];
    const fill = item.rarity === 'relic' ? 0x6f5730 : item.rarity === 'rare' ? 0x3f4777 : item.rarity === 'uncommon' ? 0x225b57 : 0x173d3b;
    const border = item.rarity === 'relic' ? 0xf1ca7a : item.rarity === 'rare' ? 0xb8afff : 0x78d9c4;
    const panel = this.add.rectangle(0, 0, width, height, fill, 0.98).setStrokeStyle(2, border, 0.64);
    const icon = this.add.text(compact ? -width / 2 + 25 : 0, compact ? 0 : -Math.min(14, height * 0.16), item.icon, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${compact ? 24 : Math.min(30, Math.max(18, height * 0.34))}px`,
    }).setOrigin(0.5);
    const name = this.add.text(compact ? -width / 2 + 50 : 0, compact ? -9 : Math.min(22, height * 0.23), item.name, {
      fontFamily: 'Arial, sans-serif',
      fontSize: compact ? '13px' : '10px',
      color: '#e5f5f0',
      fontStyle: 'bold',
    }).setOrigin(compact ? 0 : 0.5, 0.5);
    const detail = compact
      ? `${RARITY_NAMES[item.rarity]} · ${item.size.width}×${item.size.height}${quantity > 1 ? ` · ×${quantity}` : ''}`
      : (quantity > 1 ? `×${quantity}` : `${item.size.width}×${item.size.height}`);
    const detailText = this.add.text(compact ? -width / 2 + 50 : width / 2 - 5, compact ? 12 : -height / 2 + 5, detail, {
      fontFamily: 'Arial, sans-serif',
      fontSize: compact ? '10px' : '9px',
      color: '#f1c879',
    }).setOrigin(compact ? 0 : 1, compact ? 0.5 : 0);
    const card = this.add.container(x, y, [panel, icon, name, detailText]);
    const hitArea = this.add.zone(x, y, width, height).setScrollFactor(0).setInteractive({ cursor: 'grab' });
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activeInventoryDrag = drag;
      this.inventoryDragGhost?.destroy();
      this.inventoryDragGhost = this.add.text(pointer.x + 18, pointer.y + 18, `${item.icon} ${item.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#effffb',
        backgroundColor: '#173d3b',
        padding: { x: 9, y: 6 },
        stroke: '#07151d',
        strokeThickness: 3,
      }).setScrollFactor(0).setDepth(220);
      card.setScale(1.025).setAlpha(0.92);
    });
    container.add([card, hitArea]);
    return card;
  }

  private createRaidInventoryOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(170);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02090d, 0.92);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 1160, 610, 0x0a2028, 0.99)
      .setStrokeStyle(2, 0x75d7c2, 0.3);
    const used = occupiedGridCells(this.backpack);
    const total = this.profile.backpack.width * this.profile.backpack.height;
    container.add([
      shade,
      panel,
      this.add.text(90, 70, '远征整备', { fontFamily: 'Georgia, serif', fontSize: '30px', color: '#d8eee8' }),
      this.add.text(90, 109, '拖动物品即可换装、整理或丢到脚边；附近战利品也能直接拿取。', {
        fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#789795',
      }),
      this.add.text(90, 148, '当前装备', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#9ee6d5', fontStyle: 'bold' }),
      this.add.text(455, 148, `随身背包  ${this.profile.backpack.width}×${this.profile.backpack.height} · ${used}/${total} 格`, {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#9ee6d5', fontStyle: 'bold',
      }),
      this.add.text(855, 148, `附近物品  ${NEARBY_LOOT_RADIUS} 范围`, {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#9ee6d5', fontStyle: 'bold',
      }),
    ]);

    RAID_EQUIPMENT_SLOTS.forEach((slot, index) => {
      const y = 196 + index * 86;
      const slotPanel = this.add.rectangle(220, y, 260, 70, 0x07171e, 0.9)
        .setStrokeStyle(1, 0x6bcbb6, 0.3)
        .setInteractive({ dropZone: true, cursor: 'copy' });
      slotPanel.setData('inventoryTarget', 'equip');
      slotPanel.setData('gearSlot', slot);
      const itemId = this.loadout[slot];
      const item = itemId ? ITEMS[itemId] : null;
      container.add([
        slotPanel,
        this.add.text(108, y - 22, SLOT_NAMES[slot], { fontSize: '10px', color: '#698b88' }),
        this.add.text(116, y + 5, item?.icon ?? '＋', { fontSize: '26px', color: '#5e7d7a' }).setOrigin(0, 0.5),
        this.add.text(158, y - 5, item?.name ?? '空槽位', { fontSize: '13px', color: item ? '#e3f4ef' : '#5e7d7a', fontStyle: 'bold' }),
        this.add.text(158, y + 15, item ? this.getEquipmentSummary(item.id) : `拖入${SLOT_NAMES[slot]}类物品`, {
          fontSize: '10px', color: '#86aaa7',
        }),
      ]);
    });

    const backpackItem = this.loadout.backpack ? ITEMS[this.loadout.backpack] : null;
    container.add([
      this.add.rectangle(220, 555, 260, 54, 0x0c1e25, 0.72).setStrokeStyle(1, 0x516c70, 0.28),
      this.add.text(108, 548, `背包本体  ${backpackItem?.icon ?? ''} ${backpackItem?.name ?? '无'}`, { fontSize: '11px', color: '#91aaa7' }),
      this.add.text(108, 565, '远征中锁定，返回基地后可更换', { fontSize: '9px', color: '#58716f' }),
    ]);

    const cellSize = Math.min(62, 340 / Math.max(1, this.profile.backpack.height), 340 / Math.max(1, this.profile.backpack.width));
    const gridWidth = this.profile.backpack.width * cellSize;
    const gridHeight = this.profile.backpack.height * cellSize;
    const gridLeft = 625 - gridWidth / 2;
    const gridTop = 171;
    const gridDropZone = this.add.rectangle(gridLeft + gridWidth / 2, gridTop + gridHeight / 2, gridWidth, gridHeight, 0x07171e, 0.7)
      .setStrokeStyle(2, 0x6bcbb6, 0.28)
      .setInteractive({ dropZone: true, cursor: 'copy' });
    gridDropZone.setData('inventoryTarget', 'backpack');
    gridDropZone.setData('gridLeft', gridLeft);
    gridDropZone.setData('gridTop', gridTop);
    gridDropZone.setData('cellSize', cellSize);
    container.add(gridDropZone);
    for (let row = 0; row < this.profile.backpack.height; row += 1) {
      for (let column = 0; column < this.profile.backpack.width; column += 1) {
        container.add(this.add.rectangle(
          gridLeft + column * cellSize + cellSize / 2,
          gridTop + row * cellSize + cellSize / 2,
          cellSize - 3,
          cellSize - 3,
          0x102a31,
          0.42,
        ).setStrokeStyle(1, 0x6bcbb6, 0.15));
      }
    }
    for (const stack of this.backpack) {
      const item = ITEMS[stack.itemId];
      const width = item.size.width * cellSize - 7;
      const height = item.size.height * cellSize - 7;
      this.createInventoryDragCard(
        container,
        gridLeft + stack.x * cellSize + width / 2 + 3,
        gridTop + stack.y * cellSize + height / 2 + 3,
        width,
        height,
        stack.itemId,
        stack.quantity,
        { source: 'backpack', uid: stack.uid },
      );
    }

    const dropZone = this.add.rectangle(625, 570, 300, 62, 0x391d25, 0.78)
      .setStrokeStyle(2, 0xdf7d83, 0.58)
      .setInteractive({ dropZone: true, cursor: 'move' });
    dropZone.setData('inventoryTarget', 'ground');
    container.add([
      dropZone,
      this.add.text(625, 560, '↓  丢到脚边', { fontSize: '15px', color: '#f1b0af', fontStyle: 'bold' }).setOrigin(0.5),
      this.add.text(625, 580, '整组物品会回到地面，可再次拾取', { fontSize: '9px', color: '#a77578' }).setOrigin(0.5),
    ]);

    const nearby = this.getNearbyLoot().slice(0, 6);
    if (nearby.length === 0) {
      container.add([
        this.add.text(1010, 280, '脚边没有可拾取物品', { fontSize: '14px', color: '#688481' }).setOrigin(0.5),
        this.add.text(1010, 308, '靠近战利品后再打开背包', { fontSize: '10px', color: '#4f6967' }).setOrigin(0.5),
      ]);
    } else {
      nearby.forEach((entry, index) => {
        this.createInventoryDragCard(
          container,
          1010,
          205 + index * 64,
          300,
          52,
          entry.itemId,
          entry.quantity,
          { source: 'ground', lootId: entry.id },
          true,
        );
      });
    }
    if (this.getNearbyLoot().length > 6) {
      container.add(this.add.text(1010, 602, `另有 ${this.getNearbyLoot().length - 6} 组物品，拾取后会继续显示`, {
        fontSize: '10px', color: '#789795',
      }).setOrigin(0.5));
    }

    const notice = this.overlayNotice || '拖到装备槽可立即换上；拖到背包格可拿取或调整位置。';
    container.add([
      this.add.text(625, 630, notice, {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: this.overlayNotice ? '#f1c879' : '#63817f',
      }).setOrigin(0.5),
      this.add.text(VIEW_WIDTH - 92, 630, 'Tab 关闭', { fontSize: '11px', color: '#63817f', letterSpacing: 2 }).setOrigin(1, 0.5),
    ]);
    return container;
  }

  private getEquipmentSummary(itemId: string): string {
    const item = ITEMS[itemId];
    if (item.stats?.attack) return `伤害 ${item.stats.attack} · 范围 ${item.stats.range ?? 0}`;
    if (item.stats?.armor) return `蓝甲 ${item.stats.armor}${item.stats.speedMultiplier ? ' · 移速修正' : ''}`;
    if (item.stats?.dashEnabled) return '解锁黑冲';
    if (item.stats?.speedMultiplier) return `移速 ×${item.stats.speedMultiplier.toFixed(2)}`;
    return RARITY_NAMES[item.rarity];
  }

  private handleRaidInventoryPointerDrop(drag: RaidInventoryDrag, pointer: Phaser.Input.Pointer): boolean {
    if (pointer.x >= 475 && pointer.x <= 775 && pointer.y >= 539 && pointer.y <= 601) {
      if (drag.source !== 'backpack' || !drag.uid) {
        this.overlayNotice = '地面物品已经在脚边了。';
        this.refreshBackpackOverlay();
        return true;
      }
      const stack = this.backpack.find((entry) => entry.uid === drag.uid);
      if (!stack) return false;
      this.backpack = this.backpack.filter((entry) => entry.uid !== drag.uid).map((entry) => ({ ...entry }));
      this.spawnLoot(`manual-drop-${stack.uid}-${Math.round(this.time.now)}`, stack.itemId, stack.quantity, this.player.x + this.facing * 54, this.player.y - 20);
      this.overlayNotice = `已丢到脚边：${ITEMS[stack.itemId].name}${stack.quantity > 1 ? ` ×${stack.quantity}` : ''}`;
      this.refreshBackpackOverlay();
      return true;
    }

    if (pointer.x >= 90 && pointer.x <= 350) {
      const slotIndex = RAID_EQUIPMENT_SLOTS.findIndex((_slot, index) => {
        const centerY = 196 + index * 86;
        return pointer.y >= centerY - 35 && pointer.y <= centerY + 35;
      });
      if (slotIndex >= 0) {
        this.equipRaidItem(drag, RAID_EQUIPMENT_SLOTS[slotIndex]);
        this.refreshBackpackOverlay();
        return true;
      }
    }

    const cellSize = Math.min(62, 340 / Math.max(1, this.profile.backpack.height), 340 / Math.max(1, this.profile.backpack.width));
    const gridWidth = this.profile.backpack.width * cellSize;
    const gridHeight = this.profile.backpack.height * cellSize;
    const gridLeft = 625 - gridWidth / 2;
    const gridTop = 171;
    if (pointer.x < gridLeft || pointer.x > gridLeft + gridWidth || pointer.y < gridTop || pointer.y > gridTop + gridHeight) {
      return false;
    }

    if (drag.source === 'backpack' && drag.uid) {
      const x = Math.floor((pointer.x - gridLeft) / cellSize);
      const y = Math.floor((pointer.y - gridTop) / cellSize);
      const moved = moveGridItem(this.backpack, this.profile.backpack, drag.uid, x, y);
      if (moved) {
        this.backpack = moved;
        this.overlayNotice = '背包布局已调整。';
      } else {
        this.overlayNotice = '这里放不下：需要完整连续空格。';
      }
      this.refreshBackpackOverlay();
      return true;
    }

    if (drag.source === 'ground' && drag.lootId) {
      const loot = this.loot.find((entry) => entry.id === drag.lootId && entry.icon.active);
      if (!loot) return false;
      const inserted = insertGridStack(this.backpack, this.profile.backpack, { itemId: loot.itemId, quantity: loot.quantity });
      if (!inserted) {
        const item = ITEMS[loot.itemId];
        this.overlayNotice = `${item.name} 需要 ${item.size.width}×${item.size.height} 连续空格。`;
      } else {
        this.backpack = inserted;
        if (loot.itemId === 'map_feather') this.mapUnlocked = true;
        loot.icon.destroy();
        loot.halo.destroy();
        this.overlayNotice = `已装入背包：${ITEMS[loot.itemId].name}`;
      }
      this.refreshBackpackOverlay();
      return true;
    }
    return false;
  }

  private equipRaidItem(drag: RaidInventoryDrag, slot: GearSlot): void {
    let itemId: string | null = null;
    let sourceLoot: LootEntity | null = null;
    let nextBackpack = cloneGridItems(this.backpack);
    if (drag.source === 'backpack' && drag.uid) {
      const carried = this.backpack.find((entry) => entry.uid === drag.uid);
      if (carried) {
        itemId = carried.itemId;
        nextBackpack = this.backpack.filter((entry) => entry.uid !== drag.uid).map((entry) => ({ ...entry }));
      }
    } else if (drag.source === 'ground' && drag.lootId) {
      sourceLoot = this.loot.find((entry) => entry.id === drag.lootId && entry.icon.active) ?? null;
      itemId = sourceLoot?.itemId ?? null;
    }
    if (!itemId) return;
    const item = ITEMS[itemId];
    if (item.category !== slot) {
      this.overlayNotice = `${item.name} 不能装备到${SLOT_NAMES[slot]}槽。`;
      return;
    }

    const oldItemId = this.loadout[slot];
    if (oldItemId === itemId && drag.source === 'backpack') {
      this.overlayNotice = `${item.name} 已经装备。`;
      return;
    }
    let oldWentToBackpack = false;
    if (oldItemId) {
      const insertedOld = insertGridStack(nextBackpack, this.profile.backpack, { itemId: oldItemId, quantity: 1 });
      if (insertedOld) {
        nextBackpack = insertedOld;
        oldWentToBackpack = true;
      } else {
        this.spawnLoot(`swap-drop-${oldItemId}-${Math.round(this.time.now)}`, oldItemId, 1, this.player.x - this.facing * 58, this.player.y - 20);
      }
    }

    this.backpack = nextBackpack;
    this.loadout = { ...this.loadout, [slot]: itemId };
    if (sourceLoot) {
      sourceLoot.icon.destroy();
      sourceLoot.halo.destroy();
    }
    if (slot === 'armor') {
      this.maxArmor = getArmorMaximum({ loadout: this.loadout });
      this.armor = this.maxArmor;
    }
    this.overlayNotice = `${item.icon} 已装备 ${item.name}${oldItemId ? (oldWentToBackpack ? '；旧装备已放回背包。' : '；背包无空位，旧装备落在脚边。') : ''}`;
  }

  private createBackpackOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(170);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02090d, 0.9);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 900, 560, 0x0a2028, 0.98)
      .setStrokeStyle(2, 0x75d7c2, 0.24);
    const used = occupiedGridCells(this.backpack);
    const total = this.profile.backpack.width * this.profile.backpack.height;
    const title = this.add.text(225, 105, `随身背包  ${this.profile.backpack.width}×${this.profile.backpack.height} · ${used}/${total} 格`, {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      color: '#d8eee8',
    });
    const subtitle = this.add.text(225, 148, '每件物品按实际尺寸占格；安全撤离后仍留在背包，回基地再卸入仓库。', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#789795',
    });
    container.add([shade, panel, title, subtitle]);

    const cellSize = Math.min(64, 350 / Math.max(1, this.profile.backpack.height), 430 / Math.max(1, this.profile.backpack.width));
    const gridWidth = this.profile.backpack.width * cellSize;
    const gridHeight = this.profile.backpack.height * cellSize;
    const gridLeft = VIEW_WIDTH / 2 - gridWidth / 2;
    const gridTop = 185;
    for (let row = 0; row < this.profile.backpack.height; row += 1) {
      for (let column = 0; column < this.profile.backpack.width; column += 1) {
        const x = gridLeft + column * cellSize + cellSize / 2;
        const y = gridTop + row * cellSize + cellSize / 2;
        const slot = this.add.rectangle(x, y, cellSize - 3, cellSize - 3, 0x07171e, 0.88)
        .setStrokeStyle(1, 0x6bcbb6, 0.18);
        container.add(slot);
      }
    }
    for (const stack of this.backpack) {
      const item = ITEMS[stack.itemId];
      const width = item.size.width * cellSize - 7;
      const height = item.size.height * cellSize - 7;
      const x = gridLeft + stack.x * cellSize + width / 2 + 3;
      const y = gridTop + stack.y * cellSize + height / 2 + 3;
      const color = item.rarity === 'relic' ? 0x6f5730 : item.rarity === 'rare' ? 0x3f4777 : 0x1b514c;
      const itemPanel = this.add.rectangle(x, y, width, height, color, 0.95)
        .setStrokeStyle(2, item.rarity === 'relic' ? 0xf1ca7a : 0x78d9c4, 0.55);
      container.add([
        itemPanel,
        this.add.text(x, y - 9, item.icon, { fontSize: `${Math.min(30, height * 0.38)}px` }).setOrigin(0.5),
        this.add.text(x, y + Math.min(24, height * 0.28), item.name, { fontSize: '10px', color: '#d7ece7' }).setOrigin(0.5),
        this.add.text(x + width / 2 - 5, y - height / 2 + 5, stack.quantity > 1 ? `×${stack.quantity}` : `${item.size.width}×${item.size.height}`, { fontSize: '9px', color: '#f1c879' }).setOrigin(1, 0),
      ]);
    }

    if (this.recoveredEchoItems.length > 0) {
      container.add(this.add.text(225, 545, `◉ 遗失回声包：${this.recoveredEchoItems.reduce((sum, stack) => sum + stack.quantity, 0)} 件（撤离后送往基地仓库）`, {
        fontSize: '12px',
        color: '#c4a5f4',
      }));
    }
    container.add(this.add.text(VIEW_WIDTH / 2, 618, 'Tab 关闭背包', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#63817f',
      letterSpacing: 2,
    }).setOrigin(0.5));
    return container;
  }

  private getZone(): { name: string; risk: string } {
    const zone = DEMO_MAP.zones.find((entry) => this.player.x >= entry.bounds.x
      && this.player.x < entry.bounds.x + entry.bounds.width
      && this.player.y >= entry.bounds.y
      && this.player.y < entry.bounds.y + entry.bounds.height)
      ?? DEMO_MAP.zones[DEMO_MAP.zones.length - 1];
    return { name: zone.name, risk: zone.risk };
  }

  private getEntryPosition(): { x: number; y: number } {
    const entry = DEMO_MAP.entries[this.entryId];
    return { x: entry.x, y: entry.y };
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
      coordinateSystem: `World origin is top-left; +x right, +y down; two-axis room network ${WORLD_WIDTH}x${WORLD_HEIGHT}.`,
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
        bodyWidth: Math.round(body.width),
        bodyHeight: Math.round(body.height),
        facing: this.facing < 0 ? 'left' : 'right',
        grounded: body.blocked.down || body.touching.down,
      },
      backpack: this.backpack.map((stack) => ({ ...stack })),
      loadout: { ...this.loadout },
      nearbyLoot: this.getNearbyLoot().map((entry) => ({
        id: entry.id,
        itemId: entry.itemId,
        quantity: entry.quantity,
        distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.icon.x, entry.icon.y)),
      })),
      visibleEnemies: this.enemies
        .filter((enemy) => enemy.sprite.active && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y) < 850)
        .map((enemy) => ({
          id: enemy.id,
          kind: enemy.kind,
          x: Math.round(enemy.sprite.x),
          y: Math.round(enemy.sprite.y),
          health: enemy.health,
        })),
      visibleLoot: this.loot
        .filter((entry) => entry.icon.active && Phaser.Math.Distance.Between(entry.icon.x, entry.icon.y, this.player.x, this.player.y) < 850)
        .map((entry) => ({
          id: entry.id,
          itemId: entry.itemId,
          x: Math.round(entry.icon.x),
          y: Math.round(entry.icon.y),
        })),
      nearbyInteraction: this.nearbyInteraction,
      flags: {
        dashReady: this.time.now >= this.dashReadyAt,
        dashEquipped: Boolean(this.loadout.shoes && ITEMS[this.loadout.shoes]?.stats?.dashEnabled),
        mapUnlocked: this.mapUnlocked,
        shortcutUnlocked: this.shortcutUnlocked,
        recoveredEcho: this.recoveredEcho,
        extracting: this.extractingUntil > 0,
        inventoryOpen: this.overlayMode === 'backpack',
      },
    };
    window.__SUI_GAME_STATE__ = state;
  }
}
