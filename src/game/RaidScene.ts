import Phaser from 'phaser';
import {
  addStacks,
  canPlaceGridItem,
  cloneGridItems,
  getGridItemSize,
  insertGridStack,
  moveOrMergeGridItem,
  occupiedGridCells,
  removeGridQuantity,
  rotateGridItem,
  splitGridItem,
} from './inventory';
import { getArmorMaximum, ITEMS, RARITY_NAMES, SLOT_NAMES } from './items';
import { containsPoint, findZoneAt, getMapDefinition, type MapDefinition, type MapZoneDefinition } from './maps';
import {
  getWorldLayout,
  type GateDefinition,
  type HazardDefinition,
  type RelayInteractionDefinition,
  type StoryEchoDefinition,
  type TerrainSegment,
  type TerrainStyle,
  type WorldLayoutDefinition,
} from './worldLayout';
import type { GearSlot, GridItem, ItemStack, Loadout, PlayerProfile, RaidResult, RaidRunState, RaidTransition, TextGameState } from '../types/game';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const ZONE_HYSTERESIS = 40;
const ZONE_CANDIDATE_DWELL = 600;
const DOWNSTRIKE_BOUNCE_VELOCITY = -760;
const UNARMED_ATTACK = {
  attack: 1,
  range: 56,
  attackCooldown: 420,
};

type AttackDirection = 'left' | 'right' | 'up' | 'down';

export type VirtualControl = 'left' | 'right' | 'jump' | 'aimUp' | 'aimDown' | 'attack' | 'dash' | 'interact' | 'map' | 'backpack' | 'pause' | 'patch' | 'tonic';

interface RaidSceneOptions {
  profile: PlayerProfile;
  mapId: string;
  entryId: string;
  renderScale: 1 | 1.5 | 2;
  runState?: RaidRunState | null;
  onResult: (result: RaidResult) => void;
  onTransition?: (transition: RaidTransition) => void;
}

interface RaidKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  leftArrow: Phaser.Input.Keyboard.Key;
  rightArrow: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  aimUp: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  attackAlt: Phaser.Input.Keyboard.Key;
  attackTest: Phaser.Input.Keyboard.Key;
  aimDown: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  dashAlt: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  interactAlt: Phaser.Input.Keyboard.Key;
  map: Phaser.Input.Keyboard.Key;
  mapAlt: Phaser.Input.Keyboard.Key;
  backpack: Phaser.Input.Keyboard.Key;
  backpackAlt: Phaser.Input.Keyboard.Key;
  fullscreen: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  pauseAlt: Phaser.Input.Keyboard.Key;
  abort: Phaser.Input.Keyboard.Key;
  usePatch: Phaser.Input.Keyboard.Key;
  useTonic: Phaser.Input.Keyboard.Key;
}

interface EnemyEntity {
  id: string;
  kind: 'husk' | 'moth' | 'warden' | 'sentry';
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
  combatState?: 'patrol' | 'telegraph' | 'charge' | 'aim' | 'burst';
  attackReadyAt?: number;
  telegraphUntil?: number;
  chargeUntil?: number;
  chargeDirection?: -1 | 1;
  warning?: Phaser.GameObjects.Arc;
}

interface SentryBolt {
  orb: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  expiresAt: number;
}

interface LootEntity {
  id: string;
  itemId: string;
  quantity: number;
  icon: Phaser.GameObjects.Text;
  halo: Phaser.GameObjects.Arc;
}

type ContainerKind = 'supply_crate' | 'hotpot' | 'wardrobe' | 'electronics_case' | 'archive_case' | 'relic_cache';

interface RaidCrate {
  id: string;
  sprite: Phaser.GameObjects.Image;
  drops: ItemStack[];
  broken: boolean;
  kind: ContainerKind;
  label: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'relic';
  searchDuration: number;
  requiresSearch: boolean;
}

interface ActiveContainerSearch {
  crate: RaidCrate;
  completesAt: number;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}


interface RaidInventoryDrag {
  source: 'backpack' | 'ground';
  uid?: string;
  lootId?: string;
  rotated?: boolean;
  grabOffsetX?: number;
  grabOffsetY?: number;
}

interface StoryEchoEntity extends StoryEchoDefinition {
  marker: Phaser.GameObjects.Text;
  halo: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  heard: boolean;
  pulseTween: Phaser.Tweens.Tween | null;
}

interface InteractionCandidate {
  priority: number;
  distance: number;
  stableId: string;
  prompt: string;
  interact: () => void;
}

const RAID_EQUIPMENT_SLOTS: GearSlot[] = ['weapon', 'armor', 'head', 'shoes'];
const NEARBY_LOOT_RADIUS = 240;

export class RaidScene extends Phaser.Scene {
  private readonly profile: PlayerProfile;
  private readonly mapId: string;
  private readonly mapDefinition: MapDefinition;
  private readonly layout: WorldLayoutDefinition;
  private readonly entryId: string;
  private readonly renderScale: 1 | 1.5 | 2;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly onResult: (result: RaidResult) => void;
  private readonly onTransition?: (transition: RaidTransition) => void;
  private readonly initialRunState: RaidRunState | null;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private keys!: RaidKeys;
  private enemies: EnemyEntity[] = [];
  private sentryBolts: SentryBolt[] = [];
  private loot: LootEntity[] = [];
  private crates: RaidCrate[] = [];
  private activeContainerSearch: ActiveContainerSearch | null = null;
  private storyEchoes: StoryEchoEntity[] = [];
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
  private zoneRevealText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private bossHealthText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private extractionText!: Phaser.GameObjects.Text;
  private extractingUntil = 0;
  private extractionDuration = 2500;
  private extractionPoint: { x: number; y: number } | null = null;
  private nearbyInteraction: string | null = null;
  private currentZone: MapZoneDefinition | null = null;
  private zoneCandidate: MapZoneDefinition | null = null;
  private previousInvulnerableUntil = 0;
  private zoneCandidateSince: number | null = null;
  private lastZoneRevealAt: number | null = null;
  private revealedZoneIds = new Set<string>();
  private lostEchoIcon: Phaser.GameObjects.Text | null = null;
  private lostEchoHalo: Phaser.GameObjects.Arc | null = null;
  private readonly elevatorPoint = { x: 1450, y: 1330 };
  private extractionPoints: Array<{ x: number; y: number; label: string }> = [];
  private attackGraphics: Phaser.GameObjects.Rectangle | null = null;
  private lastTextStateAt = 0;
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayMode: 'map' | 'backpack' | 'pause' | null = null;
  private overlayNotice = '';
  private activeInventoryDrag: RaidInventoryDrag | null = null;
  private inventoryDragGhost: Phaser.GameObjects.Text | null = null;
  private inventoryDragPreview: Phaser.GameObjects.Rectangle | null = null;
  private discoveredItems = new Set<string>();
  private discoveredClues = new Set<string>();
  private endingTriggered = false;
  private hasteUntil = 0;
  private nextKillHealAt = 0;
  private platformBodies: Phaser.Physics.Arcade.StaticBody[] = [];
  private abortHoldStartedAt = 0;
  private pauseAbortText: Phaser.GameObjects.Text | null = null;
  private lastSafePosition: { x: number; y: number } | null = null;
  private lastSafeRecordedAt = 0;
  private lastSpawnPosition: { x: number; y: number } | null = null;
  private lastAttack: { direction: AttackDirection; connected: boolean; bounced: boolean } | null = null;
  private virtualControls = new Set<VirtualControl>();
  private virtualControlPressed = new Set<VirtualControl>();

  constructor({ profile, mapId, entryId, renderScale, runState, onResult, onTransition }: RaidSceneOptions) {
    super('raid');
    this.profile = profile;
    this.loadout = { ...profile.loadout };
    this.mapId = mapId;
    this.mapDefinition = getMapDefinition(mapId);
    this.layout = getWorldLayout(this.mapDefinition.id);
    this.worldWidth = this.mapDefinition.worldWidth;
    this.worldHeight = this.mapDefinition.worldHeight;
    this.extractionPoints = this.layout.extractionPoints;
    this.entryId = this.mapDefinition.entries[entryId] ? entryId : Object.keys(this.mapDefinition.entries)[0];
    this.renderScale = renderScale;
    this.initialRunState = runState ?? null;
    this.onResult = onResult;
    this.onTransition = onTransition;
  }

  preload(): void {
    this.load.image('sui-bird', `${import.meta.env.BASE_URL}assets/sui-bird.png`);
  }

  create(): void {
    const runState = this.initialRunState;
    if (runState) this.loadout = { ...runState.loadout };
    this.health = Math.max(1, Math.min(this.maxHealth, runState?.health ?? this.maxHealth));
    this.maxArmor = getArmorMaximum({ loadout: this.loadout });
    this.armor = Math.min(runState?.armorCondition ?? this.profile.armorCondition, this.maxArmor);
    this.mapUnlocked = runState?.mapUnlocked ?? this.profile.mapUnlocked;
    this.shortcutUnlocked = runState?.shortcutUnlocked ?? this.profile.shortcutUnlocked;
    this.bossDefeated = runState?.bossDefeated ?? this.profile.bossDefeated;
    this.discoveredItems = new Set(runState?.discoveredItems ?? this.profile.discoveredItems ?? []);
    this.discoveredClues = new Set(runState?.discoveredClues ?? this.profile.discoveredClues ?? []);
    this.recoveredEchoItems = runState?.recoveredItems.map((item) => ({ ...item })) ?? [];
    this.recoveredEcho = runState?.recoveredEcho ?? false;
    this.backpack = cloneGridItems(runState?.backpack ?? this.profile.backpack.items);
    this.createTextures();
    this.createBackdrop();
    this.createPlatforms();
    this.createHazards();
    this.createPlayer();
    this.createEnemies();
    this.createLandmarks();
    this.createForeground();
    this.createInput();
    this.createHud();
    this.applyRenderScale();
    this.currentZone = findZoneAt(this.mapDefinition, this.player.x, this.player.y);
    if (this.currentZone) this.showZoneReveal(this.currentZone, this.time.now);
    this.invulnerableUntil = this.time.now + 3000;

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    // Horizontal world edges are now physical passages. Only the ceiling remains
    // bounded; falling still resolves through the established pit-recovery flow.
    this.physics.world.setBoundsCollision(false, false, true, false);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setViewport(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.cameras.main.setZoom(1);
    this.cameras.main.startFollow(this.player, true, 0.085, 0.1, -120, 20);
    this.cameras.main.setDeadzone(330, 150);
    this.cameras.main.setBackgroundColor('#07151d');
    this.input.mouse?.disableContextMenu();

    // 所有主要地形都是完整实体；角色不能再从下方穿过岩台或机器基座。
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.hazards, (_player, hazard) => {
      this.damagePlayerFromHazard(hazard as Phaser.Types.Physics.Arcade.GameObjectWithBody);
    });
    for (const enemy of this.enemies) {
      if (enemy.kind !== 'moth') this.physics.add.collider(enemy.sprite, this.platforms);
      this.physics.add.overlap(this.player, enemy.sprite, () => this.damagePlayer(enemy));
    }

    this.cameras.main.fadeIn(480, 4, 15, 19);
    this.showHint('A / D 移动 · Space 跳跃 · W / ↑ + J 上劈 · S / ↓ + J 下劈', 5000);
    this.publishTextState(true);
  }

  update(time: number): void {
    if (!this.player?.active || this.runEnded) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.fullscreen)) {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) || Phaser.Input.Keyboard.JustDown(this.keys.pauseAlt) || this.consumeVirtualPress('pause')) {
      this.toggleOverlay('pause');
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.abort) && this.overlayMode !== 'pause') {
      this.toggleOverlay('pause');
    }
    if (!this.overlayMode && (Phaser.Input.Keyboard.JustDown(this.keys.usePatch) || this.consumeVirtualPress('patch'))) this.useRepairPatch();
    if (!this.overlayMode && (Phaser.Input.Keyboard.JustDown(this.keys.useTonic) || this.consumeVirtualPress('tonic'))) this.useEchoTonic();
    // Arrow keys remain available for directional attacks. Dedicated M / Tab
    // shortcuts avoid opening an overlay while the player is trying to strike.
    if (Phaser.Input.Keyboard.JustDown(this.keys.map) || this.consumeVirtualPress('map')) {
      this.toggleOverlay('map');
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.backpack) || this.consumeVirtualPress('backpack')) {
      this.toggleOverlay('backpack');
      return;
    }
    if (this.overlayMode) {
      if (this.overlayMode === 'backpack'
        && this.activeInventoryDrag
        && Phaser.Input.Keyboard.JustDown(this.keys.usePatch)) {
        this.rotateActiveRaidDrag();
      }
      if (this.overlayMode === 'pause') this.updateAbandonHold();
      this.publishTextState(time - this.lastTextStateAt > 100);
      return;
    }

    if (this.updateContainerSearch(time)) {
      this.updateHud();
      this.publishTextState(time - this.lastTextStateAt > 100);
      return;
    }

    this.updateMovement(time);
    if (this.tryBoundaryPassage()) return;
    this.updateSafePosition(time);
    this.updateAttack(time);
    this.updateEnemies();
    this.updateSentryBolts(time);
    this.updateInteractions(time);
    this.updateHud();

    if (this.player.y > this.worldHeight + 100) {
      this.respawnFromPit();
    }

    this.publishTextState(time - this.lastTextStateAt > 100);
  }

  private createTextures(): void {
    const terrainPalettes: Record<TerrainStyle, { body: number; lip: number; seam: number }> = {
      foyer: { body: 0x1b3339, lip: 0x78968b, seam: 0xb0b58f },
      shaft: { body: 0x132b33, lip: 0x48716f, seam: 0x79b5aa },
      archive: { body: 0x23323b, lip: 0x60777b, seam: 0xc39f69 },
      fungal: { body: 0x173d3c, lip: 0x55a58f, seam: 0x9be1bf },
      cistern: { body: 0x173541, lip: 0x4d8997, seam: 0x8ec4ca },
      machine: { body: 0x242d3b, lip: 0x75658a, seam: 0xb19ad0 },
      graveyard: { body: 0x292d40, lip: 0x8871a2, seam: 0xc7a8e9 },
      conservatory: { body: 0x17382f, lip: 0x6bbd91, seam: 0xc5e89b },
      relay: { body: 0x1a3040, lip: 0x638aa6, seam: 0xa7d9e8 },
    };
    for (const style of Object.keys(terrainPalettes) as TerrainStyle[]) {
      const palette = terrainPalettes[style];
      const surface = this.add.graphics();
      surface.fillStyle(palette.body, 1);
      surface.fillRect(0, 8, 256, 30);
      surface.fillTriangle(0, 8, 22, 0, 52, 8);
      surface.fillTriangle(178, 8, 213, 1, 256, 8);
      surface.fillStyle(palette.lip, 0.82);
      surface.fillRect(0, 7, 256, 7);
      surface.lineStyle(2, palette.seam, 0.38);
      surface.beginPath();
      surface.moveTo(0, 8);
      surface.lineTo(40, 5);
      surface.lineTo(76, 9);
      surface.lineTo(122, 4);
      surface.lineTo(166, 8);
      surface.lineTo(211, 3);
      surface.lineTo(256, 8);
      surface.strokePath();
      surface.generateTexture(`terrain-${style}`, 256, 38);
      surface.destroy();
    }

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
    for (let y = 240; y < this.worldHeight + 600; y += 520) {
      for (let x = -200; x < this.worldWidth + 500; x += 300) {
        const peak = y - 360 - ((x / 300) % 3) * 45;
        farCaves.fillTriangle(x, y, x + 165, peak, x + 340, y);
      }
    }

    const midCaves = this.add.graphics();
    midCaves.setScrollFactor(0.34, 0.22);
    midCaves.fillStyle(0x102f36, 0.85);
    for (let y = 380; y < this.worldHeight + 500; y += 620) {
      for (let x = -80; x < this.worldWidth + 500; x += 430) midCaves.fillEllipse(x + 90, y, 470, 390);
    }

    for (let i = 0; i < 72; i += 1) {
      const mote = this.add.circle(
        Phaser.Math.Between(0, this.worldWidth),
        Phaser.Math.Between(80, this.worldHeight - 80),
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

    this.add.text(90, this.worldHeight - 410, this.mapDefinition.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '48px',
      color: '#c7e8df',
    }).setAlpha(0.12);
    if (this.mapId === 'relay_01') return;
    this.add.text(96, 1844, 'THE HOLLOW OF LOST FEATHERS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      letterSpacing: 4,
      color: '#87d7c5',
    }).setAlpha(0.2);

    this.add.text(900, 1180, '荧菌裂谷', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#a5e8d7',
    }).setAlpha(0.1);
    this.add.text(170, 845, '遗忘档案窟', {
      fontFamily: 'Georgia, serif', fontSize: '38px', color: '#b5c6c8',
    }).setAlpha(0.09);
    this.add.text(2320, 1185, '沉钟蓄水池', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#95d2d8',
    }).setAlpha(0.1);
    this.add.text(3100, 360, '静默机房', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#c9b6f2',
    }).setAlpha(0.1);
    this.add.text(3850, 280, '天线墓园', {
      fontFamily: 'Georgia, serif', fontSize: '46px', color: '#d2b5ef',
    }).setAlpha(0.12);
    this.add.text(4750, 220, '沉眠温室', {
      fontFamily: 'Georgia, serif', fontSize: '48px', color: '#b8e7ad',
    }).setAlpha(0.12);

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
    machines.moveTo(2940, 180);
    machines.lineTo(3180, 180);
    machines.lineTo(3180, 380);
    machines.lineTo(3460, 380);
    machines.lineTo(3460, 140);
    machines.lineTo(4160, 140);
    machines.strokePath();
    for (let x = 3000; x < 4180; x += 280) {
      machines.fillStyle(0x182731, 0.82);
      machines.fillRoundedRect(x, 360, 150, 250, 18);
      machines.lineStyle(2, 0x8e6fc4, 0.18);
      machines.strokeRoundedRect(x, 360, 150, 250, 18);
      machines.fillStyle(0x8a6ac0, 0.3);
      machines.fillCircle(x + 75, 405, 12);
    }

    this.drawWorldArchitecture();
    this.createAmbientLife();
  }

  private drawWorldArchitecture(): void {
    const architecture = this.add.graphics().setDepth(2);

    // 前庭是一座坍塌的公共建筑，而不只是洞底的一条地板。
    architecture.fillStyle(0x0e252c, 0.96);
    architecture.fillRect(0, 2050, 2140, 150);
    architecture.fillStyle(0x173039, 0.76);
    for (let x = 100; x < 1880; x += 310) {
      architecture.fillRect(x, 1740, 42, 330);
      architecture.fillRect(x - 24, 1730, 90, 22);
      architecture.lineStyle(12, 0x1a343b, 0.9);
      architecture.strokeRoundedRect(x - 8, 1580, 260, 340, 128);
    }
    architecture.fillStyle(0x091b22, 0.92);
    architecture.fillTriangle(0, 1680, 260, 1510, 500, 1680);
    architecture.fillTriangle(1440, 1730, 1700, 1510, 2020, 1730);

    // 回声竖井两侧的岩壁、旧缆线和维修梁把台阶包进一个垂直空间。
    architecture.fillStyle(0x0a2028, 0.98);
    architecture.fillRect(470, 1330, 145, 760);
    architecture.fillRect(1080, 1320, 120, 760);
    architecture.fillTriangle(470, 1330, 690, 1410, 470, 1510);
    architecture.fillTriangle(1200, 1320, 1000, 1470, 1200, 1580);
    architecture.lineStyle(7, 0x486866, 0.34);
    architecture.beginPath();
    architecture.moveTo(560, 1340);
    architecture.lineTo(590, 1960);
    architecture.moveTo(1120, 1350);
    architecture.lineTo(1070, 2030);
    architecture.strokePath();
    for (let y = 1390; y < 2050; y += 132) {
      architecture.lineStyle(2, 0x73928c, 0.24);
      architecture.lineBetween(525, y, 1140, y + 24);
    }

    // 档案窟：埋入岩层的门洞、倾斜书架与仍在亮的记录终端。
    architecture.fillStyle(0x101f27, 0.98);
    architecture.fillRect(0, 760, 1050, 210);
    architecture.fillRect(0, 920, 75, 530);
    architecture.fillTriangle(0, 980, 280, 760, 520, 930);
    architecture.lineStyle(10, 0x3b4b50, 0.75);
    architecture.strokeRoundedRect(240, 825, 540, 430, 170);
    for (let x = 300; x < 850; x += 150) {
      architecture.fillStyle(0x26343a, 0.78);
      architecture.fillRect(x, 840, 82, 330);
      architecture.lineStyle(3, 0x9f825a, 0.28);
      for (let y = 875; y < 1140; y += 48) architecture.lineBetween(x + 8, y, x + 74, y + 6);
    }

    // 裂谷的巨大菌伞形成“树冠”，让主路像穿过一座地下森林。
    for (let x = 1120; x < 2150; x += 210) {
      const stemTop = 770 + ((x / 210) % 3) * 72;
      architecture.fillStyle(0x285650, 0.34);
      architecture.fillRoundedRect(x, stemTop, 28, 580, 14);
      architecture.fillStyle(0x4c9183, 0.22);
      architecture.fillEllipse(x + 14, stemTop, 250, 88);
      architecture.lineStyle(3, 0x88d8bd, 0.18);
      architecture.strokeEllipse(x + 14, stemTop, 250, 88);
    }

    // 蓄水池：环形水塔、输水管与沉入水下的钟架。
    architecture.fillStyle(0x0b2530, 0.96);
    architecture.fillRect(1820, 1995, 1400, 205);
    architecture.lineStyle(22, 0x243f49, 0.82);
    architecture.strokeCircle(2690, 1715, 330);
    architecture.lineStyle(8, 0x4a7882, 0.35);
    architecture.strokeCircle(2690, 1715, 280);
    architecture.lineStyle(18, 0x213b46, 0.9);
    architecture.beginPath();
    architecture.moveTo(1880, 1150);
    architecture.lineTo(1880, 1840);
    architecture.lineTo(3130, 1840);
    architecture.lineTo(3130, 1120);
    architecture.strokePath();
    architecture.fillStyle(0x203f49, 0.7);
    architecture.fillTriangle(2730, 1260, 2820, 1440, 2640, 1440);
    architecture.fillRect(2678, 1420, 104, 160);

    // 机房用厚重墙板、管道与巨型转子建立人工设施的体量。
    architecture.fillStyle(0x121b28, 0.96);
    architecture.fillRect(2850, 250, 930, 390);
    architecture.lineStyle(12, 0x40384f, 0.82);
    architecture.strokeRoundedRect(2920, 300, 780, 410, 28);
    architecture.lineStyle(18, 0x2f3443, 0.9);
    architecture.strokeCircle(3350, 490, 205);
    architecture.lineStyle(5, 0x9a7fbc, 0.24);
    architecture.strokeCircle(3350, 490, 156);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      architecture.lineBetween(3350, 490, 3350 + Math.cos(angle) * 190, 490 + Math.sin(angle) * 190);
    }

    // 天线墓园是开阔的深层终景：倾倒的塔、断裂碟面和向上消失的缆线。
    architecture.fillStyle(0x101723, 0.96);
    architecture.fillRect(3750, 650, 450, 270);
    for (let x = 3820; x < 4140; x += 180) {
      const lean = ((x / 250) % 2 === 0 ? -35 : 28);
      architecture.lineStyle(13, 0x343448, 0.9);
      architecture.lineBetween(x, 690, x + lean, 210);
      architecture.lineStyle(5, 0x78628f, 0.45);
      architecture.strokeEllipse(x + lean, 245, 180, 62);
      architecture.lineBetween(x + lean, 245, x + lean * 1.4, 120);
    }

    // 温室以断裂玻璃拱、悬垂花床和风顶信标收束扩展区域。
    architecture.lineStyle(10, 0x315f50, 0.68);
    for (let x = 4380; x <= 6220; x += 330) {
      architecture.strokeEllipse(x, 500 + ((x / 330) % 3) * 80, 280, 430);
      architecture.lineStyle(3, 0x8acfa0, 0.24);
      architecture.lineBetween(x - 130, 720, x + 110, 290);
      architecture.lineStyle(10, 0x315f50, 0.68);
    }
    for (let x = 4580; x < 6140; x += 210) {
      architecture.fillStyle(0x294f40, 0.62);
      architecture.fillRoundedRect(x, 370 + ((x / 210) % 3) * 110, 110, 18, 8);
      architecture.lineStyle(2, 0xbbe7a6, 0.25);
      architecture.lineBetween(x + 18, 390 + ((x / 210) % 3) * 110, x + 42, 480 + ((x / 210) % 2) * 90);
    }
    architecture.lineStyle(8, 0xa8e8bf, 0.5);
    architecture.strokeCircle(6200, 240, 88);
  }

  private createAmbientLife(): void {
    const lightPools = [
      { x: 430, y: 1850, width: 700, height: 520, color: 0xcaa55d, alpha: 0.035 },
      { x: 1550, y: 1110, width: 1050, height: 760, color: 0x5ce2ad, alpha: 0.055 },
      { x: 3350, y: 550, width: 980, height: 580, color: 0x9a70d5, alpha: 0.06 },
      { x: 3970, y: 470, width: 620, height: 520, color: 0xb185e8, alpha: 0.055 },
      { x: 5350, y: 640, width: 1850, height: 820, color: 0x78e69a, alpha: 0.045 },
    ];
    for (const pool of lightPools) {
      const glow = this.add.ellipse(pool.x, pool.y, pool.width, pool.height, pool.color, pool.alpha)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(3);
      this.tweens.add({
        targets: glow,
        alpha: { from: pool.alpha * 0.65, to: pool.alpha * 1.35 },
        scaleX: { from: 0.97, to: 1.03 },
        duration: 2600 + (pool.x % 900),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    for (let x = 1880; x < 3220; x += 180) {
      const waterLine = this.add.rectangle(x, 2035 + ((x / 180) % 3) * 9, 145, 2, 0x70c8d1, 0.18).setDepth(5);
      this.tweens.add({
        targets: waterLine,
        x: x + 45,
        alpha: { from: 0.08, to: 0.34 },
        duration: 1500 + (x % 700),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    for (let i = 0; i < 26; i += 1) {
      const spore = this.add.circle(
        1080 + (i * 83) % 1160,
        880 + (i * 137) % 640,
        2 + (i % 3),
        i % 4 === 0 ? 0xd6c778 : 0x82e5c3,
        0.18 + (i % 5) * 0.04,
      ).setDepth(6);
      this.tweens.add({
        targets: spore,
        x: spore.x + 35 - (i % 4) * 18,
        y: spore.y - 60 - (i % 3) * 24,
        alpha: 0.03,
        duration: 2600 + i * 95,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    for (let i = 0; i < 12; i += 1) {
      const seed = this.add.circle(4480 + (i * 157) % 1700, 330 + (i * 109) % 940, 2 + i % 2, 0xc8f2a4, 0.22).setDepth(6);
      this.tweens.add({
        targets: seed,
        y: seed.y - 34,
        alpha: { from: 0.06, to: 0.34 },
        duration: 2200 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    for (const segment of this.layout.terrain) {
      this.drawTerrainMass(segment);
      this.add.image(segment.x, segment.y, `terrain-${segment.style}`)
        .setDisplaySize(segment.width, 38)
        .setDepth(8);
      const depth = segment.massDepth ?? 120;
      const surfaceY = segment.y - 19;
      const collider = this.platforms.create(
        segment.x,
        surfaceY + depth / 2,
        `terrain-${segment.style}`,
      ) as Phaser.Physics.Arcade.Sprite;
      collider.setDisplaySize(segment.width, depth).setVisible(false);
      collider.refreshBody();
      this.platformBodies.push(collider.body as Phaser.Physics.Arcade.StaticBody);
    }
  }

  private createHazards(): void {
    this.hazards = this.physics.add.staticGroup();
    for (const hazard of this.layout.hazards) this.createSpikeHazard(hazard);
  }

  private createSpikeHazard(hazard: HazardDefinition): void {
    const graphics = this.add.graphics().setDepth(10);
    const left = hazard.x - hazard.width / 2;
    const spikeWidth = 24;
    const count = Math.max(2, Math.floor(hazard.width / spikeWidth));
    graphics.fillStyle(0x9bb8b1, 0.9);
    graphics.lineStyle(2, 0xd7eee7, 0.46);
    for (let index = 0; index < count; index += 1) {
      const x = left + (index * hazard.width) / count;
      const nextX = left + ((index + 1) * hazard.width) / count;
      graphics.fillTriangle(x, hazard.y, (x + nextX) / 2, hazard.y - 30, nextX, hazard.y);
      graphics.strokeTriangle(x, hazard.y, (x + nextX) / 2, hazard.y - 30, nextX, hazard.y);
    }
    const collider = this.hazards.create(hazard.x, hazard.y - 11, 'terrain-foyer') as Phaser.Physics.Arcade.Sprite;
    collider.setDisplaySize(hazard.width - 8, 22).setVisible(false).refreshBody();
  }

  private drawTerrainMass(segment: TerrainSegment): void {
    const palette: Record<TerrainStyle, { body: number; shadow: number; accent: number }> = {
      foyer: { body: 0x142b31, shadow: 0x091b22, accent: 0x748e82 },
      shaft: { body: 0x10272f, shadow: 0x071921, accent: 0x4a7772 },
      archive: { body: 0x1d2b33, shadow: 0x0b1920, accent: 0x987d57 },
      fungal: { body: 0x123434, shadow: 0x071d24, accent: 0x4c9984 },
      cistern: { body: 0x112f3a, shadow: 0x061a24, accent: 0x4a8392 },
      machine: { body: 0x202936, shadow: 0x0d1520, accent: 0x655877 },
      graveyard: { body: 0x24283a, shadow: 0x101420, accent: 0x75628d },
      conservatory: { body: 0x12352b, shadow: 0x061c17, accent: 0x70b98d },
      relay: { body: 0x172d3a, shadow: 0x091924, accent: 0x648aa1 },
    };
    const colors = palette[segment.style];
    const left = segment.x - segment.width / 2;
    const right = segment.x + segment.width / 2;
    const top = segment.y - 19;
    const bottom = Math.min(this.worldHeight + 80, top + (segment.massDepth ?? 120));
    const mass = this.add.graphics().setDepth(4);
    mass.fillStyle(colors.body, 0.98);
    mass.beginPath();
    mass.moveTo(left, top);
    mass.lineTo(right, top);
    mass.lineTo(right - 4, bottom - 18);
    mass.lineTo(right - segment.width * 0.17, bottom - 4);
    mass.lineTo(right - segment.width * 0.34, bottom - 24);
    mass.lineTo(left + segment.width * 0.48, bottom - 8);
    mass.lineTo(left + segment.width * 0.24, bottom - 30);
    mass.lineTo(left + 7, bottom - 14);
    mass.closePath();
    mass.fillPath();
    mass.fillStyle(colors.shadow, 0.58);
    mass.fillTriangle(left + segment.width * 0.08, top + 20, left + segment.width * 0.32, bottom - 18, left + segment.width * 0.44, top + 20);
    mass.fillTriangle(right - segment.width * 0.35, top + 22, right - segment.width * 0.16, bottom - 10, right - segment.width * 0.06, top + 22);
    mass.lineStyle(2, colors.accent, 0.22);
    mass.beginPath();
    mass.moveTo(left + 18, top + 34);
    mass.lineTo(left + segment.width * 0.32, top + 50);
    mass.lineTo(left + segment.width * 0.48, top + 43);
    mass.lineTo(right - 20, top + 66);
    mass.strokePath();

    if (segment.style === 'machine' || segment.style === 'graveyard' || segment.style === 'relay') {
      mass.lineStyle(3, colors.accent, 0.24);
      for (let x = left + 34; x < right; x += 84) {
        mass.strokeRect(x, top + 20, Math.min(62, right - x - 5), Math.min(70, bottom - top - 34));
      }
    }
    if (segment.style === 'fungal' || segment.style === 'conservatory') {
      for (let x = left + 32; x < right - 20; x += 86) {
        mass.fillStyle(segment.style === 'conservatory' ? 0xd4ef93 : 0x79d5b7, segment.style === 'conservatory' ? 0.2 : 0.13);
        mass.fillCircle(x, top + 24 + ((x / 10) % 3) * 9, segment.style === 'conservatory' ? 7 : 5);
      }
    }
  }

  private createForeground(): void {
    const foreground = this.add.graphics().setDepth(42);
    foreground.fillStyle(0x04141b, 0.78);
    foreground.fillTriangle(0, 1260, 170, 1430, 0, 1740);
    foreground.fillTriangle(4200, 180, 4025, 430, 4200, 720);
    foreground.fillTriangle(6400, 80, 6180, 310, 6400, 620);
    foreground.fillTriangle(1850, 2200, 2050, 2025, 2280, 2200);
    foreground.fillTriangle(3090, 2200, 3270, 1990, 3480, 2200);
    foreground.fillStyle(0x071921, 0.82);
    for (let x = 1120; x < 2140; x += 260) {
      foreground.fillTriangle(x, 720, x + 70, 880 + ((x / 260) % 3) * 60, x + 150, 720);
    }
    for (let x = 2150; x < 4200; x += 330) {
      foreground.fillTriangle(x, 0, x + 82, 190 + ((x / 330) % 4) * 55, x + 190, 0);
    }

    const vignette = this.add.graphics().setScrollFactor(0).setDepth(92);
    vignette.fillStyle(0x02090d, 0.2);
    vignette.fillRect(0, 0, VIEW_WIDTH, 20);
    vignette.fillRect(0, VIEW_HEIGHT - 18, VIEW_WIDTH, 18);
    vignette.fillRect(0, 0, 18, VIEW_HEIGHT);
    vignette.fillRect(VIEW_WIDTH - 18, 0, 18, VIEW_HEIGHT);
    vignette.fillStyle(0x02090d, 0.1);
    vignette.fillRect(18, 20, 18, VIEW_HEIGHT - 40);
    vignette.fillRect(VIEW_WIDTH - 36, 20, 18, VIEW_HEIGHT - 40);
  }

  private createPlayer(): void {
    const entry = this.getEntryPosition();
    this.player = this.physics.add.sprite(entry.x, entry.y, 'sui-bird');
    this.player.setScale(0.28);
    // 本地鸟素材原图面向左；向右移动时必须翻转，否则会变成尾巴朝前。
    this.player.setFlipX(true);
    this.player.setDepth(20);
    this.player.setCollideWorldBounds(false);
    this.player.setMaxVelocity(720, 1100);
    this.player.setDragX(900);
    this.player.body.setSize(180, 185, true);
  }

  private createEnemies(): void {
    if (this.mapId === 'relay_01') {
      this.spawnHusk('husk-relay-west', 520, 1510, 390, 740);
      this.spawnMoth('moth-relay-trench', 1550, 1160, 1250, 1950);
      this.spawnHusk('husk-relay-east', 2480, 1160, 2320, 2720);
      this.spawnMoth('moth-relay-crown', 3150, 720, 2940, 3440);
      if (this.profile.raidsStarted % 2 === 0) this.spawnSentry('sentry-relay-east', 2680, 1160);
      return;
    }
    // Keep the manifest's open floor clear; its former overlapping patrol is moved east.
    this.spawnHusk('husk-foyer-1', 1080, 2010, 1000, 1180);
    this.spawnHusk('husk-foyer-2', 1570, 1870, 1450, 1690);
    this.spawnHusk('husk-shaft-1', 470, 1530, 420, 540);
    this.spawnHusk('husk-archive-1', 650, 840, 480, 790);
    this.spawnMoth('moth-rift-1', 1560, 1280, 1370, 1840);
    this.spawnHusk('husk-rift-1', 2700, 860, 2550, 2840);
    this.spawnMoth('moth-cistern-1', 2620, 1530, 2310, 3000);
    this.spawnHusk('husk-cistern-1', 2800, 1625, 2680, 2930);
    if (this.profile.raidsStarted % 2 === 0) this.spawnSentry('sentry-cistern', 3030, 1410);
    this.spawnHusk('husk-graveyard-1', 3970, 550, 3830, 4120);
    this.spawnMoth('moth-graveyard-1', 3890, 430, 3780, 4140);
    this.spawnHusk('husk-conservatory-1', 4560, 690, 4350, 4700);
    this.spawnMoth('moth-conservatory-1', 5200, 430, 4850, 5520);
    this.spawnHusk('husk-conservatory-2', 5570, 620, 5450, 5720);
    this.spawnMoth('moth-conservatory-2', 6030, 250, 5800, 6280);
    if (!this.bossDefeated) this.spawnWarden();
  }

  private createLandmarks(): void {
    for (const extraction of this.extractionPoints) this.createExtractionBeacon(extraction.x, extraction.y, extraction.label);
    for (const passage of this.layout.boundaryPassages ?? []) this.createBoundaryPassage(passage);
    for (const gate of this.layout.gates ?? []) this.createGate(gate);
    if (this.mapId === 'relay_01') {
      this.createRelayLandmarks();
      this.layout.storyEchoes.forEach((echo) => this.createStoryEcho(echo));
      this.createMatchingLostEcho();
      return;
    }

    this.spawnCrate('crate-foyer', 390, 2020, [
      ...this.getRaidSupplyDrops('foyer'),
      { itemId: this.profile.raidsStarted % 2 === 0 ? 'sichuan_hotpot' : 'beef_jerky', quantity: 1 },
    ], { kind: 'hotpot', label: '封存火锅锅', rarity: 'uncommon' });
    this.spawnCrate('crate-rift', 1250, 1715, [
      { itemId: 'echo_lance', quantity: 1 },
      { itemId: 'blue_hood', quantity: 1 },
      { itemId: 'grapefruit_soda', quantity: 1 },
    ], { kind: 'wardrobe', label: '裂谷旧衣柜', rarity: 'rare' });
    // 原深层箱子曾嵌进 x=2700 的厚平台；移到平台右侧安全表面。
    this.spawnCrate('crate-deep', 2825, 855, [
      { itemId: 'echo_dust', quantity: 5 },
      { itemId: 'repair_patch', quantity: 1 },
      { itemId: this.profile.raidsStarted % 2 === 0 ? 'rtx_3050' : 'cpu_12400f', quantity: 1 },
    ], { kind: 'electronics_case', label: '机房电子箱', rarity: 'rare' });
    this.spawnCrate('crate-archive', 390, 1040, [
      ...this.getRaidSupplyDrops('archive'),
      { itemId: this.profile.raidsStarted % 2 === 0 ? 'broken_iphone14' : 'beef_jerky', quantity: 1 },
    ], { kind: 'archive_case', label: '档案密封柜', rarity: 'uncommon' });
    this.spawnCrate('crate-platforming-cache', 1150, 545, [
      { itemId: 'echo_dust', quantity: 7 },
      { itemId: 'echo_tonic', quantity: 2 },
    ]);
    this.spawnCrate('crate-cistern', 3020, 1400, [
      { itemId: 'cat_cap', quantity: 1 },
      { itemId: 'bell_maul', quantity: 1 },
      { itemId: 'repair_patch', quantity: 1 },
      { itemId: 'glucose_monitor', quantity: 1 },
    ], { kind: 'electronics_case', label: '防水电子箱', rarity: 'rare' });
    this.spawnCrate('crate-graveyard', 3990, 535, [
      { itemId: 'echo_dust', quantity: 8 },
      { itemId: 'echo_tonic', quantity: 1 },
      { itemId: this.profile.raidsStarted % 3 === 0 ? 'shiori_library_parcel' : 'iphone16', quantity: 1 },
    ], { kind: 'relic_cache', label: '墓园远寄封箱', rarity: 'relic' });
    this.spawnCrate('crate-conservatory-entry', 4520, 685, [
      { itemId: 'echo_tonic', quantity: 2 },
      { itemId: 'echo_dust', quantity: 4 },
    ]);
    this.spawnCrate('crate-conservatory-depths', 5920, 1245, [
      { itemId: 'flower_hat', quantity: 1 },
      { itemId: 'wind_needle', quantity: 1 },
      { itemId: 'echo_tonic', quantity: 2 },
    ]);
    this.spawnCrate('crate-conservatory-summit', 6200, 270, [
      { itemId: 'storm_feather', quantity: 1 },
      { itemId: 'echo_dust', quantity: 10 },
      { itemId: 'airlift_firecloud', quantity: 1 },
    ], { kind: 'relic_cache', label: '空运封存箱', rarity: 'relic' });
    this.spawnLoot('map-feather', 'map_feather', 1, 1220, 995);
    this.layout.storyEchoes.forEach((echo) => this.createStoryEcho(echo));

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

    this.createMatchingLostEcho();
  }

  private getRaidSupplyDrops(cache: 'foyer' | 'archive'): ItemStack[] {
    const alternate = this.profile.raidsStarted % 2 === 0;
    if (cache === 'foyer') {
      return alternate
        ? [{ itemId: 'echo_dust', quantity: 2 }, { itemId: 'repair_patch', quantity: 1 }]
        : [{ itemId: 'echo_dust', quantity: 4 }, { itemId: 'echo_tonic', quantity: 1 }];
    }
    return alternate
      ? [{ itemId: 'echo_dust', quantity: 3 }, { itemId: 'echo_tonic', quantity: 2 }]
      : [{ itemId: 'repair_patch', quantity: 2 }, { itemId: 'echo_tonic', quantity: 1 }];
  }

  private createRelayLandmarks(): void {
    this.spawnCrate('crate-relay-west', 440, 1530, this.profile.raidsStarted % 2 === 0
      ? [{ itemId: 'echo_dust', quantity: 3 }, { itemId: 'echo_tonic', quantity: 1 }, { itemId: 'sichuan_hotpot', quantity: 1 }]
      : [{ itemId: 'echo_dust', quantity: 5 }, { itemId: 'repair_patch', quantity: 1 }, { itemId: 'grapefruit_soda', quantity: 1 }], { kind: 'hotpot', label: '深场保温锅', rarity: 'uncommon' });
    this.spawnCrate('crate-relay-east', 2450, 1170, [{ itemId: 'biscuit_note', quantity: 1 }, { itemId: 'echo_dust', quantity: 4 }, { itemId: 'supreme_glucose_monitor', quantity: 1 }], { kind: 'electronics_case', label: '阵列仪表箱', rarity: 'relic' });
    this.spawnCrate('crate-relay-crown', 3100, 990, [{ itemId: 'relay_sabre', quantity: 1 }]);
    for (const relay of this.layout.relayInteractions ?? []) this.createRelayInteraction(relay);
    const terminal = this.layout.terminal;
    if (terminal) {
      this.add.rectangle(terminal.x, terminal.y, 124, 112, 0x17273b, 0.96).setStrokeStyle(3, 0xb99cff, 0.48).setDepth(8);
      this.add.text(terminal.x, terminal.y, '⌁', { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#d7c0ff' }).setOrigin(0.5).setDepth(9);
      this.add.text(terminal.x, terminal.y - 78, terminal.name, { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#a994c4' }).setOrigin(0.5).setDepth(9);
    }
  }

  private createRelayInteraction(relay: RelayInteractionDefinition): void {
    const calibrated = this.discoveredClues.has(relay.id);
    this.add.rectangle(relay.x, relay.y, 104, 92, calibrated ? 0x215749 : 0x17313c, 0.96)
      .setStrokeStyle(3, calibrated ? 0x89f1d0 : 0x6c9fb2, 0.5)
      .setDepth(8);
    this.add.text(relay.x, relay.y - 64, relay.name, { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: calibrated ? '#9cebd4' : '#7f9da6' }).setOrigin(0.5).setDepth(9);
  }

  private createMatchingLostEcho(): void {
    if (!this.profile.lostEcho || this.profile.lostEcho.mapId !== this.mapId) return;
    const x = Phaser.Math.Clamp(this.profile.lostEcho.x, 120, this.worldWidth - 120);
    const y = Phaser.Math.Clamp(this.profile.lostEcho.y - 40, 120, this.worldHeight - 120);
    this.lostEchoHalo = this.add.circle(x, y, 38, 0x8c69e8, 0.1)
      .setStrokeStyle(2, 0xb999ff, 0.52)
      .setDepth(15);
    this.lostEchoIcon = this.add.text(x, y, '◉', {
      fontFamily: 'Georgia, serif', fontSize: '34px', color: '#c6a8ff', stroke: '#211835', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(16);
    this.tweens.add({ targets: [this.lostEchoHalo, this.lostEchoIcon], alpha: { from: 0.45, to: 1 }, scale: { from: 0.92, to: 1.08 }, duration: 900, yoyo: true, repeat: -1 });
  }

  private createStoryEcho(definition: StoryEchoDefinition): void {
    const heard = this.discoveredClues.has(definition.id);
    const halo = this.add.circle(definition.x, definition.y, 28, definition.color, heard ? 0.025 : 0.06)
      .setStrokeStyle(2, definition.color, heard ? 0.16 : 0.32)
      .setDepth(10);
    const marker = this.add.text(definition.x, definition.y, '⌁', {
      fontFamily: 'Georgia, serif', fontSize: '30px',
      color: Phaser.Display.Color.IntegerToColor(definition.color).rgba,
      stroke: '#07151d', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(11).setAlpha(heard ? 0.48 : 1);
    const label = this.add.text(definition.x, definition.y - 48, definition.title, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: heard ? '#566e6c' : '#799693', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(10);
    const pulseTween = heard ? null : this.tweens.add({
      targets: [halo, marker], alpha: { from: 0.38, to: 0.92 }, scale: { from: 0.94, to: 1.08 },
      duration: 1250 + this.storyEchoes.length * 130, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.storyEchoes.push({ ...definition, marker, halo, label, heard, pulseTween });
  }

  private markStoryEchoHeard(echo: StoryEchoEntity): void {
    if (echo.heard) return;
    echo.heard = true;
    echo.pulseTween?.stop();
    echo.pulseTween = null;
    echo.marker.setAlpha(0.48).setScale(1);
    echo.halo.setAlpha(0.025).setScale(1).setStrokeStyle(2, echo.color, 0.16);
    echo.label.setColor('#566e6c');
  }

  private createBoundaryPassage(passage: { edge: 'left' | 'right'; centerY: number; height: number; name: string }): void {
    const x = passage.edge === 'left' ? 12 : this.worldWidth - 12;
    const width = 28;
    const frame = this.add.rectangle(x, passage.centerY, width, passage.height, 0x5f89a4, 0.14)
      .setStrokeStyle(3, 0xa8dded, 0.7).setDepth(9);
    const arrow = this.add.text(x, passage.centerY, passage.edge === 'left' ? '⇠' : '⇢', {
      fontFamily: 'Georgia, serif', fontSize: '35px', color: '#c5f6ef', stroke: '#07151d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);
    this.add.text(passage.edge === 'left' ? 38 : this.worldWidth - 38, passage.centerY - passage.height / 2 - 26, `${passage.name}\n直接走出边界`, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#9cc8c7', align: passage.edge === 'left' ? 'left' : 'right',
    }).setOrigin(passage.edge === 'left' ? 0 : 1, 0.5).setDepth(10);
    this.tweens.add({ targets: [frame, arrow], alpha: { from: 0.38, to: 0.92 }, duration: 900, yoyo: true, repeat: -1 });
  }

  private createGate(gate: GateDefinition): void {
    const ring = this.add.circle(gate.x, gate.y, 40, 0x8978e8, 0.12).setStrokeStyle(3, 0xc7b7ff, 0.62).setDepth(8);
    this.add.text(gate.x, gate.y, '⌘', { fontFamily: 'Georgia, serif', fontSize: '34px', color: '#e4dcff', stroke: '#07151d', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
    this.add.text(gate.x, gate.y - 68, gate.name, { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#b8afe0' }).setOrigin(0.5).setDepth(9);
    this.tweens.add({ targets: ring, scale: 1.16, alpha: 0.34, duration: 900, yoyo: true, repeat: -1 });
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

  private spawnCrate(
    id: string,
    x: number,
    y: number,
    drops: ItemStack[],
    config: Partial<Pick<RaidCrate, 'kind' | 'label' | 'rarity' | 'searchDuration'>> = {},
  ): void {
    // Gates reload a Phaser scene. Preserve per-run searches so returning through
    // a passage cannot repopulate containers that were already opened.
    if (this.initialRunState?.openedCrateIds.includes(id)) return;
    const kind = config.kind ?? 'supply_crate';
    const rarity = config.rarity ?? 'common';
    const label = config.label ?? '补给箱';
    const searchDuration = config.searchDuration ?? (rarity === 'relic' ? 2600 : rarity === 'rare' ? 1800 : rarity === 'uncommon' ? 1100 : 650);
    // Keep legacy starter crates immediately breakable for the existing opening
    // tutorial; the new themed containers always use the deliberate search loop.
    const requiresSearch = config.kind !== undefined;
    const sprite = this.add.image(x, y, 'loot-crate').setDepth(13);
    const tint = rarity === 'relic' ? 0xff8b70 : rarity === 'rare' ? 0xa89bff : rarity === 'uncommon' ? 0x82e7cb : 0xffffff;
    sprite.setTint(tint);
    const marker = this.add.text(x, y - 46, kind === 'hotpot' ? '🍲' : kind === 'wardrobe' ? '🧥' : kind === 'electronics_case' ? '🔌' : kind === 'relic_cache' ? '✦' : '▣', {
      fontFamily: 'Arial, sans-serif', fontSize: '19px', color: rarity === 'relic' ? '#ff8b70' : '#9cebd8', stroke: '#07151d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(14);
    sprite.setData('containerMarker', marker);
    this.crates.push({ id, sprite, drops, broken: false, kind, label, rarity, searchDuration, requiresSearch });
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
    if (this.initialRunState?.defeatedEnemyIds.includes(id)) return;
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
    if (this.initialRunState?.defeatedEnemyIds.includes(id)) return;
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

  private spawnSentry(id: string, x: number, y: number): void {
    if (this.initialRunState?.defeatedEnemyIds.includes(id)) return;
    const sprite = this.physics.add.sprite(x, y, 'signal-warden');
    sprite.setScale(0.64);
    sprite.setTint(0x75c3dd);
    sprite.setDepth(16);
    sprite.body.allowGravity = false;
    sprite.body.setSize(72, 56);
    sprite.body.setOffset(28, 25);
    const label = this.add.text(x, y - 54, '回波哨兵', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#9de6f7',
      stroke: '#07151d',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(17);
    this.enemies.push({
      id,
      kind: 'sentry',
      sprite,
      health: 5,
      maxHealth: 5,
      speed: 0,
      direction: -1,
      patrolLeft: x,
      patrolRight: x,
      baseY: y,
      label,
      attackReadyAt: this.time.now + 1200,
    });
  }

  private spawnWarden(): void {
    if (this.initialRunState?.defeatedEnemyIds.includes('signal-warden')) return;
    const sprite = this.physics.add.sprite(3400, 750, 'signal-warden');
    sprite.setDepth(18);
    sprite.body.setSize(105, 78);
    sprite.body.setOffset(11, 15);
    const label = this.add.text(3400, 664, '失频守卫', {
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
      patrolLeft: 3100,
      patrolRight: 3480,
      baseY: 750,
      boss: true,
      label,
      combatState: 'patrol',
      attackReadyAt: this.time.now + 1200,
    });
  }

  setVirtualControl(control: VirtualControl, isDown: boolean): void {
    if (isDown) {
      if (!this.virtualControls.has(control)) this.virtualControlPressed.add(control);
      this.virtualControls.add(control);
      return;
    }
    this.virtualControls.delete(control);
  }

  clearVirtualControls(): void {
    this.virtualControls.clear();
    this.virtualControlPressed.clear();
  }

  private consumeVirtualPress(control: VirtualControl): boolean {
    if (!this.virtualControlPressed.has(control)) return false;
    this.virtualControlPressed.delete(control);
    return true;
  }

  private isVirtualDown(control: VirtualControl): boolean {
    return this.virtualControls.has(control);
  }

  private createInput(): void {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable');
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      aimUp: Phaser.Input.Keyboard.KeyCodes.W,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      attackAlt: Phaser.Input.Keyboard.KeyCodes.X,
      attackTest: Phaser.Input.Keyboard.KeyCodes.B,
      aimDown: Phaser.Input.Keyboard.KeyCodes.S,
      dash: Phaser.Input.Keyboard.KeyCodes.K,
      dashAlt: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      interactAlt: Phaser.Input.Keyboard.KeyCodes.ENTER,
      map: Phaser.Input.Keyboard.KeyCodes.M,
      mapAlt: Phaser.Input.Keyboard.KeyCodes.UP,
      backpack: Phaser.Input.Keyboard.KeyCodes.TAB,
      backpackAlt: Phaser.Input.Keyboard.KeyCodes.DOWN,
      fullscreen: Phaser.Input.Keyboard.KeyCodes.F,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
      pauseAlt: Phaser.Input.Keyboard.KeyCodes.P,
      abort: Phaser.Input.Keyboard.KeyCodes.Q,
      usePatch: Phaser.Input.Keyboard.KeyCodes.R,
      useTonic: Phaser.Input.Keyboard.KeyCodes.H,
    }) as unknown as RaidKeys;
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.TAB,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.ESC,
    ]);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.overlayMode === 'backpack' && (pointer.rightButtonDown() || pointer.button === 2)) {
        this.rotateRaidItemAt(pointer);
        return;
      }
      if (!this.overlayMode) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const dx = worldPoint.x - this.player.x;
        const dy = worldPoint.y - this.player.y;
        const direction: AttackDirection = Math.abs(dy) > Math.abs(dx) * 0.72
          ? (dy < 0 ? 'up' : 'down')
          : (dx < 0 ? 'left' : 'right');
        this.tryAttack(this.time.now, this.normalizeAttackDirection(direction, dx < 0 ? 'left' : 'right'));
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activeInventoryDrag && this.inventoryDragGhost) {
        this.inventoryDragGhost.setPosition(pointer.x + 18, pointer.y + 18);
        this.updateRaidInventoryDragPreview(pointer);
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.activeInventoryDrag || this.overlayMode !== 'backpack') return;
      const drag = this.activeInventoryDrag;
      this.activeInventoryDrag = null;
      this.inventoryDragGhost?.destroy();
      this.inventoryDragGhost = null;
      this.inventoryDragPreview?.destroy();
      this.inventoryDragPreview = null;
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

    this.zoneRevealText = this.add.text(VIEW_WIDTH / 2, 174, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#d8eee8',
      align: 'center',
      letterSpacing: 4,
      stroke: '#07151d',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(96).setAlpha(0);

    this.objectiveText = this.add.text(26, 55, `目标  ${this.getRaidObjective()}`, {
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

    this.add.text(VIEW_WIDTH - 24, VIEW_HEIGHT - 20, 'J 攻击 / 方向劈 · K 冲刺 · H 糖浆 · E 互动 · M 地图 · Tab 背包 · F 全屏', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#5d7f7e',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);
  }

  private getHeadEffect(): 'kill-heal' | 'scout' | 'tonic-boost' | 'panic-haste' | undefined {
    return this.getHeadDefinition()?.stats?.headEffect;
  }

  private getHeadDefinition() {
    return this.loadout.head ? ITEMS[this.loadout.head] : undefined;
  }

  private getDashMode(): 'normal' | 'shadow' | null {
    const shoes = this.loadout.shoes ? ITEMS[this.loadout.shoes] : undefined;
    return shoes?.stats?.dashEnabled ? (shoes.stats.dashMode ?? 'normal') : null;
  }

  private endDash(releaseVelocity = true): void {
    if (!this.isDashing) return;
    this.isDashing = false;
    this.player.body.allowGravity = true;
    this.player.clearTint();
    if (releaseVelocity) this.player.setVelocityX(this.facing * 280);
  }

  private updateMovement(time: number): void {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.lastGroundedAt = time;

    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.jump) || this.consumeVirtualPress('jump');
    if (jumpPressed) this.jumpQueuedAt = time;

    if (this.isDashing) {
      if (time >= this.dashEndsAt) this.endDash();
      else return;
    }

    if (time < this.staggerEndsAt) return;

    const shoes = this.loadout.shoes ? ITEMS[this.loadout.shoes] : null;
    const armor = this.loadout.armor ? ITEMS[this.loadout.armor] : null;
    const catHaste = this.getHeadEffect() === 'panic-haste' && time < this.hasteUntil ? 1.28 : 1;
    const speedMultiplier = (shoes?.stats?.speedMultiplier ?? 1) * (armor?.stats?.speedMultiplier ?? 1) * catHaste;
    const moveSpeed = 350 * speedMultiplier;
    const leftDown = this.keys.left.isDown || this.keys.leftArrow.isDown || this.isVirtualDown('left');
    const rightDown = this.keys.right.isDown || this.keys.rightArrow.isDown || this.isVirtualDown('right');
    const desiredVelocity = leftDown === rightDown ? 0 : (leftDown ? -moveSpeed : moveSpeed);
    const responsiveness = grounded ? 0.52 : 0.3;
    this.player.setVelocityX(Phaser.Math.Linear(body.velocity.x, desiredVelocity, responsiveness));
    if (grounded) this.correctGroundedEdge(leftDown, rightDown);

    if (leftDown && !rightDown) this.facing = -1;
    if (rightDown && !leftDown) this.facing = 1;
    this.player.setFlipX(this.facing > 0);

    // 保留略长于受击硬直的输入缓冲；玩家在落地或挨打瞬间按跳跃不应丢输入。
    if (time - this.jumpQueuedAt <= 260 && time - this.lastGroundedAt <= 120) {
      this.player.setVelocityY(-1050);
      this.jumpQueuedAt = -1000;
      this.lastGroundedAt = -1000;
    }

    const jumpHeld = this.keys.jump.isDown || this.isVirtualDown('jump');
    if (!jumpHeld && body.velocity.y < -420) this.player.setVelocityY(-420);

    const dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.dash)
      || Phaser.Input.Keyboard.JustDown(this.keys.dashAlt)
      || this.consumeVirtualPress('dash');
    if (dashPressed) {
      if (this.getDashMode() && time >= this.dashReadyAt) this.startDash(time);
      else if (!this.getDashMode()) this.showHint('需要装备能冲刺的鞋子。软羽靴可普通冲刺，影步靴可黑冲。', 1500);
      else this.showHint('冲刺仍在冷却。', 700);
    }

    if (this.loadout.weapon && Math.abs(body.velocity.x) > 20 && grounded) {
      this.player.angle = Math.sin(time / 85) * 1.4;
    } else {
      this.player.angle = Phaser.Math.Linear(this.player.angle, 0, 0.2);
    }
  }

  private correctGroundedEdge(leftDown: boolean, rightDown: boolean): void {
    if (leftDown === rightDown) return;
    const body = this.player.body;
    const direction = rightDown ? 1 : -1;
    const touchingEdge = this.platformBodies.some((terrainBody) => {
      const horizontalGap = direction > 0
        ? terrainBody.left - body.right
        : body.left - terrainBody.right;
      return horizontalGap >= -2
        && horizontalGap <= 3
        && Math.abs(terrainBody.top - body.bottom) <= 6;
    });
    if (!touchingEdge) return;
    body.reset(this.player.x + direction * 4, this.player.y - 2);
    this.player.setVelocityX(direction * 180);
  }

  private startDash(time: number): void {
    const mode = this.getDashMode();
    if (!mode) return;
    const shadow = mode === 'shadow';
    this.isDashing = true;
    this.dashEndsAt = time + 180;
    this.dashReadyAt = time + 900;
    this.player.body.allowGravity = false;
    this.player.setVelocity(this.facing * 820, 0);
    this.player.setTint(shadow ? 0x8c76ff : 0x78e2bf);
    for (let i = 0; i < 5; i += 1) {
      const echo = this.add.image(this.player.x - this.facing * i * 18, this.player.y, 'sui-bird')
        .setScale(0.28)
        .setFlipX(this.facing > 0)
        .setTint(shadow ? 0x6653c9 : 0x48b995)
        .setAlpha(0.22 - i * 0.025)
        .setDepth(18);
      this.tweens.add({ targets: echo, alpha: 0, duration: 230, onComplete: () => echo.destroy() });
    }
  }

  private updateAttack(time: number): void {
    const attackPressed = Phaser.Input.Keyboard.JustDown(this.keys.attack)
      || Phaser.Input.Keyboard.JustDown(this.keys.attackAlt)
      || Phaser.Input.Keyboard.JustDown(this.keys.attackTest)
      || this.consumeVirtualPress('attack');
    if (attackPressed) this.tryAttack(time, this.getKeyboardAttackDirection());
  }

  private isGrounded(): boolean {
    return this.player.body.blocked.down || this.player.body.touching.down;
  }

  private normalizeAttackDirection(direction: AttackDirection, horizontalFallback: AttackDirection): AttackDirection {
    return direction === 'down' && this.isGrounded() ? horizontalFallback : direction;
  }

  private getKeyboardAttackDirection(): AttackDirection {
    const aimingUp = this.keys.aimUp.isDown || this.keys.mapAlt.isDown || this.isVirtualDown('aimUp');
    const aimingDown = this.keys.aimDown.isDown || this.keys.backpackAlt.isDown || this.isVirtualDown('aimDown');
    if (aimingUp && !aimingDown) return 'up';
    if (aimingDown && !aimingUp) return this.normalizeAttackDirection('down', this.facing < 0 ? 'left' : 'right');
    return this.facing < 0 ? 'left' : 'right';
  }

  private tryAttack(time: number, direction: AttackDirection = this.facing < 0 ? 'left' : 'right'): void {
    if (time < this.attackReadyAt || this.isDashing || !this.player.active) return;
    const weapon = this.loadout.weapon ? ITEMS[this.loadout.weapon] : null;
    const range = weapon?.stats?.range ?? UNARMED_ATTACK.range;
    const damage = weapon?.stats?.attack ?? UNARMED_ATTACK.attack;
    const vertical = direction === 'up' || direction === 'down';
    const directionX = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const directionY = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    if (directionX !== 0) this.facing = directionX as -1 | 1;
    this.attackReadyAt = time + (weapon?.stats?.attackCooldown ?? UNARMED_ATTACK.attackCooldown);

    const hitboxWidth = vertical ? 88 : range + 56;
    const hitboxHeight = vertical ? range + 56 : 88;
    const attackX = this.player.x + directionX * (range / 2);
    const attackY = this.player.y + directionY * (range / 2);
    const hitbox = new Phaser.Geom.Rectangle(
      attackX - hitboxWidth / 2,
      attackY - hitboxHeight / 2,
      hitboxWidth,
      hitboxHeight,
    );

    this.attackGraphics?.destroy();
    const attackGraphic = this.add.rectangle(
      attackX,
      attackY,
      vertical ? 56 : range,
      vertical ? range : 56,
      0xb8fff0,
      0.16,
    )
      .setStrokeStyle(3, 0xc8fff2, 0.75)
      .setDepth(30)
      .setRotation(vertical ? directionY * 0.08 : (directionX > 0 ? -0.12 : 0.12));
    this.attackGraphics = attackGraphic;
    this.tweens.add({
      targets: attackGraphic,
      alpha: 0,
      scaleX: vertical ? 1.45 : 1,
      scaleY: vertical ? 1 : 1.45,
      x: attackX + directionX * 18,
      y: attackY + directionY * 18,
      duration: 135,
      ease: 'Cubic.Out',
      onComplete: () => {
        attackGraphic.destroy();
        if (this.attackGraphics === attackGraphic) this.attackGraphics = null;
      },
    });

    let attackConnected = false;
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || !Phaser.Geom.Intersects.RectangleToRectangle(hitbox, enemy.sprite.getBounds())) continue;
      attackConnected = true;
      enemy.health -= damage;
      enemy.direction = directionX === 0 ? this.facing : directionX as -1 | 1;
      enemy.sprite.setVelocity(directionX * 310, direction === 'down' ? 260 : -180);
      enemy.sprite.setTint(0xe8fff6).setTintMode(Phaser.TintModes.FILL);
      this.time.delayedCall(80, () => enemy.sprite.active && enemy.sprite.clearTint());
      this.spawnImpact(enemy.sprite.x, enemy.sprite.y);
      this.spawnDamageNumber(enemy.sprite.x, enemy.sprite.y - 30, damage, enemy.health <= 0);
      if (enemy.health <= 0) this.defeatEnemy(enemy);
    }

    for (const crate of this.crates) {
      if (crate.broken || !Phaser.Geom.Intersects.RectangleToRectangle(hitbox, crate.sprite.getBounds())) continue;
      attackConnected = true;
      if (crate.requiresSearch) this.showHint(`${crate.label}不能砸开；靠近后按 E 搜索。`, 1100);
      else this.breakCrate(crate);
    }
    const bounced = direction === 'down' && attackConnected;
    if (bounced) {
      this.player.setVelocityY(DOWNSTRIKE_BOUNCE_VELOCITY);
      this.lastGroundedAt = -1000;
      this.cameras.main.shake(70, 0.003);
      this.showHint('下劈命中 · 借力反弹', 650);
    }
    this.lastAttack = { direction, connected: attackConnected, bounced };
  }

  private updateEnemies(): void {
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      if (enemy.sprite.y > this.worldHeight + 100) {
        enemy.sprite.setPosition((enemy.patrolLeft + enemy.patrolRight) / 2, enemy.baseY ?? 600);
        enemy.sprite.setVelocity(0, 0);
      }
      if (enemy.kind === 'moth') {
        const distance = this.player.x - enemy.sprite.x;
        // 飞行敌人可以追逐玩家，但不能跨越整张地图离开自己的生态区。
        if (enemy.sprite.x <= enemy.patrolLeft) enemy.direction = 1;
        else if (enemy.sprite.x >= enemy.patrolRight) enemy.direction = -1;
        else if (Math.abs(distance) < 420) enemy.direction = distance < 0 ? -1 : 1;
        const targetY = (enemy.baseY ?? 470) + Math.sin(this.time.now / 420 + enemy.patrolLeft) * 52;
        enemy.sprite.setVelocity(enemy.direction * enemy.speed, (targetY - enemy.sprite.y) * 2.1);
        enemy.sprite.setFlipX(enemy.direction > 0);
        enemy.sprite.setScale(1, 0.92 + Math.sin(this.time.now / 90) * 0.08);
        continue;
      }
      const distance = this.player.x - enemy.sprite.x;
      if (enemy.kind === 'warden') {
        this.updateWarden(enemy, distance);
        continue;
      }
      if (enemy.kind === 'sentry') {
        this.updateSentry(enemy, distance);
        continue;
      }
      if (Math.abs(distance) < 320 && Math.abs(this.player.y - enemy.sprite.y) < 100) {
        enemy.direction = distance < 0 ? -1 : 1;
      }
      if (enemy.sprite.x <= enemy.patrolLeft) enemy.direction = 1;
      if (enemy.sprite.x >= enemy.patrolRight) enemy.direction = -1;
      enemy.sprite.setVelocityX(enemy.direction * enemy.speed);
      enemy.sprite.setFlipX(enemy.direction > 0);
      enemy.sprite.angle = Math.sin(this.time.now / 130 + enemy.sprite.x) * 2;
      enemy.label?.setPosition(enemy.sprite.x, enemy.sprite.y - 86);
    }
  }

  private updateSentry(enemy: EnemyEntity, distance: number): void {
    const time = this.time.now;
    enemy.label?.setPosition(enemy.sprite.x, enemy.sprite.y - 54);
    const verticalDistance = Math.abs(this.player.y - enemy.sprite.y);
    const state = enemy.combatState ?? 'patrol';
    if (state === 'aim') {
      enemy.sprite.setVelocity(0, 0);
      enemy.sprite.setTint(0x9de6f7).setTintMode(Phaser.TintModes.FILL);
      enemy.sprite.setScale(0.64 + Math.sin(time / 48) * 0.06);
      enemy.label?.setText('回波哨兵 · 锁定').setColor('#d2f8ff');
      if (time < (enemy.telegraphUntil ?? 0)) return;
      this.fireSentryBolt(enemy);
      enemy.combatState = 'burst';
      enemy.chargeUntil = time + 180;
      return;
    }
    if (state === 'burst') {
      if (time < (enemy.chargeUntil ?? 0)) return;
      enemy.combatState = 'patrol';
      enemy.attackReadyAt = time + 2100;
      enemy.sprite.clearTint().setScale(0.64);
      enemy.label?.setText('回波哨兵').setColor('#9de6f7');
      return;
    }
    enemy.sprite.setVelocity(0, Math.sin(time / 320 + enemy.sprite.x) * 18);
    enemy.sprite.setScale(0.64 + Math.sin(time / 170) * 0.025);
    if (Math.abs(distance) < 600 && verticalDistance < 250 && time >= (enemy.attackReadyAt ?? 0)) {
      enemy.direction = distance < 0 ? -1 : 1;
      enemy.combatState = 'aim';
      enemy.telegraphUntil = time + 700;
      enemy.sprite.setVelocity(0, 0);
      enemy.warning?.destroy();
      enemy.warning = this.add.arc(
        enemy.sprite.x + enemy.direction * 82,
        enemy.sprite.y,
        56,
        -28,
        28,
        false,
        0x70dff5,
        0.22,
      ).setStrokeStyle(4, 0xc8f7ff, 0.9).setDepth(18).setAngle(enemy.direction < 0 ? 180 : 0);
      this.tweens.add({
        targets: enemy.warning,
        scaleX: 2.6,
        scaleY: 1.3,
        alpha: 0.82,
        duration: 650,
        ease: 'Sine.In',
      });
    }
  }

  private fireSentryBolt(enemy: EnemyEntity): void {
    enemy.warning?.destroy();
    enemy.warning = undefined;
    const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
    const orb = this.add.circle(enemy.sprite.x + enemy.direction * 42, enemy.sprite.y, 10, 0x8eefff, 0.96)
      .setStrokeStyle(2, 0xe0fbff, 0.9)
      .setDepth(22);
    this.sentryBolts.push({
      orb,
      velocityX: Math.cos(angle) * 310,
      velocityY: Math.sin(angle) * 310,
      expiresAt: this.time.now + 1800,
    });
    this.cameras.main.flash(80, 104, 219, 242);
    this.showHint('回波哨兵发射脉冲；横移或跳跃躲避。', 1050);
  }

  private updateSentryBolts(time: number): void {
    this.sentryBolts = this.sentryBolts.filter((bolt) => {
      if (!bolt.orb.active || time >= bolt.expiresAt) {
        bolt.orb.destroy();
        return false;
      }
      bolt.orb.x += bolt.velocityX / 60;
      bolt.orb.y += bolt.velocityY / 60;
      if (bolt.orb.x < 0 || bolt.orb.x > this.worldWidth || bolt.orb.y < 0 || bolt.orb.y > this.worldHeight) {
        bolt.orb.destroy();
        return false;
      }
      if (Phaser.Math.Distance.Between(bolt.orb.x, bolt.orb.y, this.player.x, this.player.y) < 38) {
        bolt.orb.destroy();
        this.applyPlayerDamage(this.player.x < bolt.orb.x ? -1 : 1);
        return false;
      }
      return true;
    });
  }

  private updateWarden(enemy: EnemyEntity, distance: number): void {
    const time = this.time.now;
    const state = enemy.combatState ?? 'patrol';
    enemy.label?.setPosition(enemy.sprite.x, enemy.sprite.y - 86);

    if (state === 'telegraph') {
      enemy.sprite.setVelocityX(0);
      enemy.sprite.setTint(0xc5a5ff).setTintMode(Phaser.TintModes.FILL);
      enemy.sprite.angle = Math.sin(time / 42) * 4;
      enemy.label?.setText('失频守卫 · 蓄势').setColor('#f1d8ff');
      if (time < (enemy.telegraphUntil ?? 0)) return;
      enemy.combatState = 'charge';
      enemy.chargeUntil = time + 420;
      enemy.warning?.destroy();
      enemy.warning = undefined;
      this.cameras.main.shake(90, 0.004);
    }

    if (enemy.combatState === 'charge') {
      if (time < (enemy.chargeUntil ?? 0)) {
        enemy.sprite.setTint(0xf0b4ff).setTintMode(Phaser.TintModes.FILL);
        enemy.sprite.setVelocityX((enemy.chargeDirection ?? enemy.direction) * 500);
        enemy.sprite.setFlipX((enemy.chargeDirection ?? enemy.direction) > 0);
        enemy.sprite.angle = (enemy.chargeDirection ?? enemy.direction) * 7;
        enemy.label?.setText('失频守卫 · 冲锋').setColor('#ffbfe8');
        return;
      }
      enemy.combatState = 'patrol';
      enemy.attackReadyAt = time + 1650;
      enemy.sprite.clearTint();
      enemy.sprite.angle = 0;
      enemy.label?.setText('失频守卫').setColor('#bda8df');
    }

    if (Math.abs(distance) < 560
      && Math.abs(this.player.y - enemy.sprite.y) < 135
      && time >= (enemy.attackReadyAt ?? 0)) {
      enemy.direction = distance < 0 ? -1 : 1;
      enemy.chargeDirection = enemy.direction;
      enemy.combatState = 'telegraph';
      enemy.telegraphUntil = time + 900;
      enemy.attackReadyAt = time + 2800;
      enemy.sprite.setVelocityX(0);
      enemy.warning?.destroy();
      enemy.warning = this.add.arc(
        enemy.sprite.x + enemy.direction * 95,
        enemy.sprite.y + 18,
        74,
        -34,
        34,
        false,
        0xb978ef,
        0.28,
      ).setStrokeStyle(5, 0xf0c8ff, 0.92).setDepth(19).setAngle(enemy.direction < 0 ? 180 : 0);
      this.tweens.add({
        targets: enemy.warning,
        scaleX: 3.2,
        scaleY: 1.45,
        alpha: 0.82,
        duration: 860,
        ease: 'Sine.In',
      });
      return;
    }

    if (enemy.sprite.x <= enemy.patrolLeft) enemy.direction = 1;
    if (enemy.sprite.x >= enemy.patrolRight) enemy.direction = -1;
    if (Math.abs(distance) < 520) enemy.direction = distance < 0 ? -1 : 1;
    const speed = Math.abs(distance) < 520 ? enemy.speed * 1.35 : enemy.speed;
    enemy.sprite.setVelocityX(enemy.direction * speed);
    enemy.sprite.setFlipX(enemy.direction > 0);
    enemy.sprite.angle = Math.sin(time / 190 + enemy.sprite.x) * 2;
  }

  private damagePlayer(enemy: EnemyEntity): void {
    if (!enemy.sprite.active || (enemy.boss && enemy.combatState === 'telegraph')) return;
    const knockDirection = this.player.x < enemy.sprite.x ? -1 : 1;
    if (!this.applyPlayerDamage(knockDirection)) return;
    enemy.sprite.setVelocity(-knockDirection * 170, -120);
  }

  private damagePlayerFromHazard(hazard: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const hazardBody = hazard.body as Phaser.Physics.Arcade.StaticBody;
    const knockDirection = this.player.x < hazardBody.center.x ? -1 : 1;
    if (!this.applyPlayerDamage(knockDirection)) return;
    this.showHint('地刺造成伤害；观察尖刺并寻找安全落点。', 1100);
  }

  private applyPlayerDamage(knockDirection: number): boolean {
    const time = this.time.now;
    const shadowDashing = this.isDashing && this.getDashMode() === 'shadow';
    if (time < this.invulnerableUntil || shadowDashing || !this.player.active) return false;
    if (this.isDashing) this.endDash(false);
    this.invulnerableUntil = time + 1100;
    this.staggerEndsAt = time + 190;
    if (this.armor > 0) this.armor -= 1;
    else this.health -= 1;
    if (this.getHeadEffect() === 'panic-haste') {
      this.hasteUntil = time + 1800;
      this.showHint('小猫帽应激：移动速度暂时提升', 900);
    }
    this.player.setVelocity(knockDirection * 420, -470);
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
    return true;
  }

  private defeatEnemy(enemy: EnemyEntity): void {
    const { x, y } = enemy.sprite;
    enemy.sprite.disableBody(true, true);
    if (this.getHeadEffect() === 'kill-heal' && this.health < this.maxHealth && this.time.now >= this.nextKillHealAt) {
      this.health += 1;
      this.nextKillHealAt = this.time.now + 3000;
      this.showHint(`小红帽回应了胜利：生命 ${this.health}/${this.maxHealth}`, 1100);
      this.cameras.main.flash(100, 238, 108, 121);
    }
    enemy.label?.destroy();
    enemy.warning?.destroy();
    if (enemy.boss) {
      this.bossDefeated = true;
      this.discoveredClues.add('warden-trace');
      const strandedRewards = new Set(this.profile.lostEcho?.items.map((item) => item.itemId) ?? []);
      if (!strandedRewards.has('echo_core')) this.spawnLoot('boss-core', 'echo_core', 1, x - 34, y - 18);
      if (!strandedRewards.has('shadow_boots')) this.spawnLoot('boss-boots', 'shadow_boots', 1, x + 36, y - 18);
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

  private beginContainerSearch(crate: RaidCrate): void {
    if (crate.broken || this.activeContainerSearch) return;
    const { x, y } = crate.sprite;
    const color = crate.rarity === 'relic' ? 0xff725f : crate.rarity === 'rare' ? 0xa99cff : crate.rarity === 'uncommon' ? 0x78d9c4 : 0xc1d1cb;
    const ring = this.add.circle(x, y, 42, color, 0.1).setStrokeStyle(4, color, 0.88).setDepth(35);
    const label = this.add.text(x, y - 78, `正在搜索 ${crate.label}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#effff9', stroke: '#07151d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(36);
    this.activeContainerSearch = { crate, completesAt: this.time.now + crate.searchDuration, ring, label };
    this.player.setVelocity(0, 0);
    this.showHint(crate.rarity === 'relic' ? '红色容器发出急促的高频回响。' : `正在翻找 ${crate.label}…`, 900);
  }

  private updateContainerSearch(time: number): boolean {
    const active = this.activeContainerSearch;
    if (!active) return false;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, active.crate.sprite.x, active.crate.sprite.y);
    if (distance > 125) {
      active.ring.destroy();
      active.label.destroy();
      this.activeContainerSearch = null;
      this.showHint('离开容器，搜索取消。', 900);
      return false;
    }
    const progress = Phaser.Math.Clamp(1 - (active.completesAt - time) / active.crate.searchDuration, 0, 1);
    active.ring.setScale(0.8 + progress * 0.5).setAlpha(0.55 + Math.sin(time / 55) * 0.25);
    active.label.setText(`搜索 ${active.crate.label}  ${'▰'.repeat(Math.ceil(progress * 10))}${'▱'.repeat(10 - Math.ceil(progress * 10))}`);
    if (time >= active.completesAt) {
      active.ring.destroy();
      active.label.destroy();
      this.activeContainerSearch = null;
      this.breakCrate(active.crate);
    }
    return true;
  }

  private breakCrate(crate: RaidCrate): void {
    crate.broken = true;
    const { x, y } = crate.sprite;
    const marker = crate.sprite.getData('containerMarker') as Phaser.GameObjects.Text | undefined;
    marker?.destroy();
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

  private spawnDamageNumber(x: number, y: number, damage: number, defeated: boolean): void {
    const text = this.add.text(x, y, defeated ? `-${damage}  击破` : `-${damage}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: defeated ? '18px' : '15px',
      color: defeated ? '#f1c879' : '#d8fff4',
      stroke: '#07151d',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(46);
    this.tweens.add({
      targets: text,
      y: y - 38,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    });
  }

  private useEchoTonic(): void {
    if (this.health >= this.maxHealth) {
      this.showHint('生命已经充盈。', 900);
      return;
    }
    const next = removeGridQuantity(this.backpack, 'echo_tonic', 1);
    if (!next) {
      this.showHint('随身背包里没有回声糖浆。', 1100);
      return;
    }
    const tonic = ITEMS.echo_tonic;
    const baseHealing = tonic.stats?.healAmount ?? 2;
    const healing = baseHealing + (this.getHeadEffect() === 'tonic-boost' ? 1 : 0);
    const restored = Math.min(healing, this.maxHealth - this.health);
    this.backpack = next;
    this.health += restored;
    this.showHint(`回声糖浆恢复 ${restored} 点生命：${this.health}/${this.maxHealth}`, 1200);
    this.cameras.main.flash(120, 111, 225, 177);
  }

  private useRepairPatch(): void {
    if (this.maxArmor <= 0) {
      this.showHint('没有装备护甲，无法使用修补片。', 1100);
      return;
    }
    if (this.armor >= this.maxArmor) {
      this.showHint('蓝甲已经完整。', 900);
      return;
    }
    const next = removeGridQuantity(this.backpack, 'repair_patch', 1);
    if (!next) {
      this.showHint('随身背包里没有便携修补片。', 1100);
      return;
    }
    this.backpack = next;
    this.armor = Math.min(this.maxArmor, this.armor + 1);
    this.showHint(`修补完成：蓝甲 ${this.armor}/${this.maxArmor}`, 1200);
    this.cameras.main.flash(120, 130, 230, 201);
  }

  private updateSafePosition(time: number): void {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    if (!grounded || time - this.lastSafeRecordedAt < 350 || time < this.invulnerableUntil - 700) return;
    this.lastSafeRecordedAt = time;
    const nearHazard = this.layout.hazards.some((hazard) => Math.abs(this.player.x - hazard.x) < hazard.width / 2 + 70
      && Math.abs(this.player.y - hazard.y) < 100);
    if (nearHazard) return;
    this.lastSafePosition = { x: this.player.x, y: this.player.y - 12 };
  }

  private respawnFromPit(): void {
    this.health -= 1;
    if (this.health <= 0) {
      this.finishRaid('died');
      return;
    }
    const checkpoint = this.lastSafePosition ?? this.lastSpawnPosition;
    if (!checkpoint) throw new Error('Player spawn was not initialized before pit recovery');
    this.player.setPosition(checkpoint.x, checkpoint.y);
    this.player.setVelocity(0, 0);
    this.invulnerableUntil = this.time.now + 1200;
    this.cameras.main.flash(220, 110, 30, 42);
    this.showHint(this.lastSafePosition ? '空洞把你送回最近的安全落点。失去 1 点生命。' : '空洞把你吐回了投放点。失去 1 点生命。', 1800);
  }

  private createRunState(): RaidRunState {
    return {
      backpack: cloneGridItems(this.backpack),
      loadout: { ...this.loadout },
      armorCondition: this.armor,
      health: this.health,
      recoveredItems: this.recoveredEchoItems.map((item) => ({ ...item })),
      recoveredEcho: this.recoveredEcho,
      mapUnlocked: this.mapUnlocked,
      shortcutUnlocked: this.shortcutUnlocked,
      bossDefeated: this.bossDefeated,
      discoveredItems: Array.from(this.discoveredItems),
      discoveredClues: Array.from(this.discoveredClues),
      openedCrateIds: this.crates.filter((crate) => crate.broken).map((crate) => crate.id),
      defeatedEnemyIds: this.enemies.filter((enemy) => !enemy.sprite.active).map((enemy) => enemy.id),
    };
  }

  private updateInteractions(time: number): void {
    if (this.extractingUntil > 0) {
      const distance = this.extractionPoint
        ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.extractionPoint.x, this.extractionPoint.y)
        : Number.POSITIVE_INFINITY;
      if (distance > 105) {
        this.extractingUntil = 0;
        if (this.endingTriggered) this.invulnerableUntil = Math.max(this.previousInvulnerableUntil, time + 500);
        this.previousInvulnerableUntil = 0;
        this.endingTriggered = false;
        this.extractionText.setVisible(false);
        this.showHint('已离开信号范围，连接取消。', 1100);
      } else {
        const remaining = Math.max(0, this.extractingUntil - time);
        const blocks = Phaser.Math.Clamp(Math.ceil((1 - remaining / this.extractionDuration) * 12), 0, 12);
        this.extractionText
          .setText(`${this.endingTriggered ? '正在对准饼干岛频道' : '正在上传战利品'}  ${'▰'.repeat(blocks)}${'▱'.repeat(12 - blocks)}  ${(remaining / 1000).toFixed(1)}s`)
          .setVisible(true);
        if (remaining <= 0) {
          this.finishRaid('extracted');
          return;
        }
      }
    }

    const candidate = this.resolveNearbyInteraction(time);
    const nearbyLoot = this.getNearbyLoot(88);
    const prompt = candidate && candidate.priority < 7 && nearbyLoot.length > 0
      ? `${candidate.prompt} · Tab 背包可处理附近掉落物`
      : candidate?.prompt ?? null;
    const interactPressed = Phaser.Input.Keyboard.JustDown(this.keys.interact)
      || Phaser.Input.Keyboard.JustDown(this.keys.interactAlt)
      || this.consumeVirtualPress('interact');
    if (interactPressed && candidate) candidate.interact();

    this.nearbyInteraction = prompt;
    this.promptText.setText(prompt ?? '').setVisible(Boolean(prompt) && this.extractingUntil === 0);
  }

  private tryBoundaryPassage(): boolean {
    const passage = (this.layout.boundaryPassages ?? []).find((entry) => {
      // Trigger before the sprite leaves the physical floor edge, so passages
      // remain reliable even where a border platform provides the walkable lip.
      const movingOutward = entry.edge === 'left' ? this.player.body.velocity.x < -20 : this.player.body.velocity.x > 20;
      const isAtEdge = entry.edge === 'left' ? this.player.x < 300 : this.player.x > this.worldWidth - 300;
      return movingOutward && isAtEdge && Math.abs(this.player.y - entry.centerY) <= entry.height / 2;
    });
    if (!passage || !this.onTransition) return false;
    const mapAllowed = passage.targetMapId !== 'relay_01' || this.bossDefeated || this.profile.bossDefeated;
    if (!mapAllowed) {
      this.player.setPosition(this.worldWidth - 72, this.player.y).setVelocity(0, 0);
      this.showHint('风道尽头没有回应；先让回声核心重新亮起。', 1600);
      return true;
    }
    this.runEnded = true;
    this.physics.pause();
    this.showHint(`穿过${passage.name}，正在接入下一片区域…`, 800);
    this.cameras.main.fadeOut(240, 120, 220, 218);
    this.time.delayedCall(260, () => this.onTransition?.({
      targetMapId: passage.targetMapId,
      targetEntryId: passage.targetEntryId,
      runState: this.createRunState(),
    }));
    return true;
  }

  private resolveNearbyInteraction(time: number): InteractionCandidate | null {
    const candidates: InteractionCandidate[] = [];
    const nearbyLoot = this.getNearbyLoot(88);
    const addCandidate = (
      priority: number,
      stableId: string,
      x: number,
      y: number,
      radius: number,
      prompt: string,
      interact: () => void,
    ): void => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
      if (distance < radius) candidates.push({ priority, distance, stableId, prompt, interact });
    };

    if (this.lostEchoIcon?.active) {
      addCandidate(0, 'lost-echo', this.lostEchoIcon.x, this.lostEchoIcon.y, 95,
        'E · 找回遗失回声（再次死亡前只有这一次）', () => {
          if (this.profile.lostEcho) this.recoverLostEcho();
        });
    }

    if (this.mapId === 'hollow_01') {
      addCandidate(1, 'maintenance-elevator', this.elevatorPoint.x, this.elevatorPoint.y, 105,
        this.shortcutUnlocked ? '维护电梯已启动 · 下轮可从深层入口出发' : 'E · 启动维护电梯捷径', () => {
          if (this.shortcutUnlocked) return;
          this.shortcutUnlocked = true;
          this.discoveredClues.add('lift-trace');
          this.discoveredClues.add('warden-trace');
          this.showHint('维护电梯已记录到基地。以后可快速进入深层。', 2200);
        });
    }

    for (const gate of this.layout.gates ?? []) {
      const canCross = gate.targetMapId !== 'relay_01' || this.bossDefeated || this.profile.bossDefeated;
      addCandidate(1, `gate-${gate.name}`, gate.x, gate.y, 105,
        canCross ? `E · 穿过${gate.name}` : `${gate.name}等待回声核心回应`, () => {
          if (!canCross || !this.onTransition) return;
          this.runEnded = true;
          this.physics.pause();
          this.showHint('折跃门展开，携带中的物资将随你穿过深场。', 900);
          this.time.delayedCall(260, () => this.onTransition?.({
            targetMapId: gate.targetMapId,
            targetEntryId: gate.targetEntryId,
            runState: this.createRunState(),
          }));
        });
    }

    for (const relay of this.layout.relayInteractions ?? []) {
      const calibrated = this.discoveredClues.has(relay.id);
      addCandidate(1, `relay-${relay.id}`, relay.x, relay.y, 105,
        calibrated ? `${relay.name} · 已校准` : `E · 校准${relay.name}`, () => {
          if (calibrated) return;
          this.discoveredClues.add(relay.id);
          this.showHint(`${relay.name}已锁定。`, 1800);
        });
    }

    const terminal = this.layout.terminal;
    if (terminal) {
      const ready = this.discoveredClues.has('relay-west-calibrated') && this.discoveredClues.has('relay-east-calibrated');
      const terminalPrompt = this.profile.endingSeen
        ? '归航频道已锁定 · 可从附近信标撤离'
        : (ready ? 'E · 锁定饼干岛频道（3.5 秒）' : '归航终端等待东西阵列校准');
      addCandidate(1, 'home-terminal', terminal.x, terminal.y, 110, terminalPrompt, () => {
        if (!ready || this.profile.endingSeen || this.extractingUntil > 0) return;
        this.endingTriggered = true;
        this.extractionDuration = 3500;
        this.previousInvulnerableUntil = this.invulnerableUntil;
        this.invulnerableUntil = time + 3500;
        this.staggerEndsAt = time;
        this.player.setPosition(terminal.x, this.player.y).setVelocity(0, 0);
        this.extractionPoint = { x: terminal.x, y: terminal.y };
        this.extractingUntil = time + 3500;
        this.showHint('双向信号重合。留在终端旁，直到频道锁定。', 1700);
      });
    }

    for (const echo of this.storyEchoes) {
      addCandidate(2, `echo-${echo.id}`, echo.x, echo.y, 92,
        `E · ${echo.heard ? '重听' : '聆听'}「${echo.title}」`, () => {
          this.discoveredClues.add(echo.id);
          if (echo.id === 'graveyard-terminal') this.discoveredClues.add('home-trace');
          this.markStoryEchoHeard(echo);
          this.showHint(echo.message, 5200);
          this.tweens.add({ targets: [echo.marker, echo.halo], scale: 1.22, duration: 180, yoyo: true });
        });
    }

    for (const extraction of this.extractionPoints) {
      addCandidate(3, `extraction-${extraction.label}`, extraction.x, extraction.y, 100,
        'E · 开始安全撤离（2.5 秒）', () => {
          if (this.extractingUntil > 0) return;
          this.extractionDuration = 2500;
          this.extractionPoint = extraction;
          this.extractingUntil = time + 2500;
        });
    }

    for (const crate of this.crates) {
      if (!crate.sprite.active || crate.broken || !crate.requiresSearch) continue;
      addCandidate(1, `container-${crate.id}`, crate.sprite.x, crate.sprite.y, 112,
        `E · 搜索${crate.rarity === 'relic' ? '红色 ' : ''}${crate.label}（${(crate.searchDuration / 1000).toFixed(1)} 秒）`, () => this.beginContainerSearch(crate));
    }

    for (const loot of nearbyLoot) {
      const item = ITEMS[loot.itemId];
      addCandidate(4, `loot-${loot.id}`, loot.icon.x, loot.icon.y, 88,
        `E · 拾取 ${item.icon} ${item.name}${loot.quantity > 1 ? ` ×${loot.quantity}` : ''}`, () => this.collectLoot(loot));
    }

    return candidates.sort((left, right) => left.priority - right.priority
      || left.distance - right.distance
      || left.stableId.localeCompare(right.stableId))[0] ?? null;
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
    this.discoveredItems.add(entry.itemId);
    if (entry.itemId === 'map_feather') {
      this.mapUnlocked = true;
      this.discoveredClues.add('map-trace');
      this.discoveredClues.add('lift-trace');
    }
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
      mapId: this.mapId,
      entryId: this.entryId,
      backpack: cloneGridItems(this.backpack),
      loadout: { ...this.loadout },
      recoveredItems: this.recoveredEchoItems.map((stack) => ({ ...stack })),
      armorCondition: this.armor,
      mapUnlocked: this.mapUnlocked,
      shortcutUnlocked: this.shortcutUnlocked,
      bossDefeated: this.bossDefeated,
      recoveredEcho: this.recoveredEcho,
      discoveredItems: Array.from(this.discoveredItems),
      discoveredClues: Array.from(this.discoveredClues),
      endingTriggered: outcome === 'extracted' && this.endingTriggered,
    };

    if (outcome === 'died') {
      result.deathPosition = {
        x: Math.round(Phaser.Math.Clamp(this.player.x, 80, this.worldWidth - 80)),
        y: Math.round(Phaser.Math.Clamp(this.player.y, 120, this.worldHeight - 80)),
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
      window.setTimeout(() => this.onResult(result), 1050);
      return;
    }

    this.cameras.main.fadeOut(520, 182, 255, 231);
    this.time.delayedCall(620, () => this.onResult(result));
  }

  private getScoutGuidance(): string | null {
    if (this.getHeadEffect() !== 'scout') return null;
    const candidates = this.crates
      .filter((crate) => !crate.broken && crate.sprite.active)
      .map((crate) => ({ label: '宝箱', x: crate.sprite.x, y: crate.sprite.y }))
      .concat(this.profile.lostEcho && this.lostEchoIcon?.active
        ? [{ label: '遗失回声', x: this.lostEchoIcon.x, y: this.lostEchoIcon.y }]
        : []);
    if (candidates.length === 0) return null;
    const nearest = candidates.reduce((best, candidate) => Phaser.Math.Distance.Between(this.player.x, this.player.y, candidate.x, candidate.y)
      < Phaser.Math.Distance.Between(this.player.x, this.player.y, best.x, best.y) ? candidate : best);
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, nearest.x, nearest.y);
    const direction = Math.abs(nearest.x - this.player.x) < 80 ? '附近' : (nearest.x > this.player.x ? '东侧' : '西侧');
    return `蓝帽侦测：${direction}${nearest.label} ${Math.round(distance)}`;
  }

  private updateScoutVisuals(): void {
    const scouting = this.getHeadEffect() === 'scout';
    for (const crate of this.crates) {
      if (!crate.sprite.active || crate.broken) continue;
      crate.sprite.setTint(scouting ? 0x9ce9ff : 0xffffff);
    }
    if (this.lostEchoHalo?.active) this.lostEchoHalo.setAlpha(scouting ? 0.24 : 0.1).setScale(scouting ? 1.22 : 1);
  }

  private updateHud(): void {
    const hearts = `${'♥'.repeat(this.health)}${'♡'.repeat(this.maxHealth - this.health)}`;
    const armor = this.maxArmor > 0
      ? `${'◆'.repeat(this.armor)}${'◇'.repeat(this.maxArmor - this.armor)}`
      : '无护甲';
    const bagUsed = occupiedGridCells(this.backpack);
    const bagTotal = this.profile.backpack.width * this.profile.backpack.height;
    const patches = this.backpack.filter((item) => item.itemId === 'repair_patch').reduce((sum, item) => sum + item.quantity, 0);
    const tonics = this.backpack.filter((item) => item.itemId === 'echo_tonic').reduce((sum, item) => sum + item.quantity, 0);
    this.statusText.setText(`生命  ${hearts}    蓝甲  ${armor}    背包  ${bagUsed}/${bagTotal} 格${patches > 0 ? `    修补 R×${patches}` : ''}${tonics > 0 ? `    糖浆 H×${tonics}` : ''}`);
    this.objectiveText.setText(`目标  ${this.getRaidObjective()}${this.getScoutGuidance() ? `  ·  ${this.getScoutGuidance()}` : ''}`);
    this.updateScoutVisuals();
    this.updateZoneState(this.time.now);
    const zone = this.currentZone;
    this.zoneText.setText(zone ? `${zone.name} · 风险 ${zone.risk}` : `${this.mapDefinition.name} · 过渡区`);
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

  private toggleOverlay(mode: 'map' | 'backpack' | 'pause'): void {
    if (this.overlayMode === mode) {
      this.closeOverlay();
      return;
    }
    this.closeOverlay();
    this.overlayMode = mode;
    this.physics.pause();
    this.overlay = mode === 'map'
      ? this.createMapOverlay()
      : (mode === 'backpack' ? this.createRaidInventoryOverlay() : this.createPauseOverlay());
  }

  private closeOverlay(): void {
    this.activeInventoryDrag = null;
    this.inventoryDragGhost?.destroy();
    this.inventoryDragGhost = null;
    this.inventoryDragPreview?.destroy();
    this.inventoryDragPreview = null;
    this.abortHoldStartedAt = 0;
    this.pauseAbortText = null;
    this.overlay?.destroy(true);
    this.overlay = null;
    if (this.overlayMode && !this.runEnded) this.physics.resume();
    this.overlayMode = null;
  }

  private createPauseOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(180);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02070b, 0.86);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 600, 430, 0x0a2028, 0.99)
      .setStrokeStyle(2, 0x75d7c2, 0.32);
    const continueButton = this.add.rectangle(VIEW_WIDTH / 2, 444, 260, 52, 0x17443e, 0.92)
      .setStrokeStyle(2, 0x75d7c2, 0.48)
      .setInteractive({ cursor: 'pointer' });
    continueButton.on('pointerdown', () => this.closeOverlay());
    this.pauseAbortText = this.add.text(VIEW_WIDTH / 2, 518, '按住 Q 1.2 秒放弃远征', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#c48f99',
    }).setOrigin(0.5);
    container.add([
      shade,
      panel,
      this.add.text(VIEW_WIDTH / 2, 176, '远 征 暂 停', {
        fontFamily: 'Georgia, serif', fontSize: '38px', color: '#d8eee8', letterSpacing: 7,
      }).setOrigin(0.5),
      this.add.text(VIEW_WIDTH / 2, 233, 'A / D 移动　Space 跳跃　J 攻击 / 方向劈　E 互动', {
        fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#91aaa7',
      }).setOrigin(0.5),
      this.add.text(VIEW_WIDTH / 2, 263, 'Tab 背包　M 地图　R 修补　H 糖浆　K / Shift 冲刺', {
        fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#91aaa7',
      }).setOrigin(0.5),
      this.add.text(VIEW_WIDTH / 2, 326, '轻按 Q 只会打开此页，不会再误触丢失战利品。', {
        fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#e3c98e',
      }).setOrigin(0.5),
      continueButton,
      this.add.text(VIEW_WIDTH / 2, 444, '继续远征　Esc / P', {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#d7f3ec', fontStyle: 'bold',
      }).setOrigin(0.5),
      this.pauseAbortText,
    ]);
    return container;
  }

  private updateAbandonHold(): void {
    if (!this.keys.abort.isDown) {
      this.abortHoldStartedAt = 0;
      this.pauseAbortText?.setText('按住 Q 1.2 秒放弃远征').setColor('#c48f99');
      return;
    }
    const now = performance.now();
    if (this.abortHoldStartedAt <= 0) this.abortHoldStartedAt = now;
    const elapsed = now - this.abortHoldStartedAt;
    const progress = Phaser.Math.Clamp(Math.ceil((elapsed / 1200) * 10), 0, 10);
    this.pauseAbortText
      ?.setText(`正在放弃  ${'■'.repeat(progress)}${'□'.repeat(10 - progress)}`)
      .setColor('#ff9cab');
    if (elapsed >= 1200) {
      this.closeOverlay();
      this.finishRaid('died');
    }
  }

  private createMapOverlay(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(170);
    const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02090d, 0.9);
    const panel = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 1090, 540, 0x0a2028, 0.98)
      .setStrokeStyle(2, 0x75d7c2, 0.24);
    const mapKnown = this.mapId === 'relay_01' || this.mapUnlocked;
    const title = this.add.text(145, 135, `${this.mapDefinition.name} · ${mapKnown ? '完整测绘' : '相对定位'}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      color: '#d8eee8',
    });
    const subtitle = this.add.text(145, 176, mapKnown
      ? `${this.mapDefinition.subtitle} · 目标标记随当前进度更新。`
      : '地图数据损坏，但你的相对位置与主目标仍然可见。找到导航羽片可恢复细节。', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#789795',
    });
    const mapLeft = 155;
    const mapTop = 215;
    const mapWidth = 970;
    const mapHeight = 300;
    const sx = (x: number) => mapLeft + (x / this.worldWidth) * mapWidth;
    const sy = (y: number) => mapTop + (y / this.worldHeight) * mapHeight;
    const mapGraphic = this.add.graphics();
    const currentRoomId = this.currentZone?.id ?? null;
    const target = this.getMapTarget();
    const targetRoomId = findZoneAt(this.mapDefinition, target.x, target.y)?.id ?? null;
    for (const room of this.layout.roomShapes) {
      const revealed = mapKnown || room.id === currentRoomId || room.id === targetRoomId || this.revealedZoneIds.has(room.id);
      mapGraphic.fillStyle(room.color, revealed ? 0.28 : 0.055);
      mapGraphic.fillRoundedRect(
        sx(room.x),
        sy(room.y),
        (room.width / this.worldWidth) * mapWidth,
        (room.height / this.worldHeight) * mapHeight,
        8,
      );
      if (room.id === currentRoomId) {
        mapGraphic.lineStyle(3, 0xf1c879, 0.95);
        mapGraphic.strokeRoundedRect(sx(room.x), sy(room.y), (room.width / this.worldWidth) * mapWidth, (room.height / this.worldHeight) * mapHeight, 8);
      }
    }
    for (const route of this.layout.routes) {
      mapGraphic.lineStyle(5, mapKnown ? 0x67cbb6 : 0x4e6669, mapKnown ? 0.66 : 0.22);
      mapGraphic.beginPath();
      route.forEach((point, index) => {
        if (index === 0) mapGraphic.moveTo(sx(point.x), sy(point.y));
        else mapGraphic.lineTo(sx(point.x), sy(point.y));
      });
      mapGraphic.strokePath();
    }
    for (const passage of this.layout.boundaryPassages ?? []) {
      const x = passage.edge === 'left' ? mapLeft + 4 : mapLeft + mapWidth - 4;
      const y = sy(passage.centerY);
      mapGraphic.lineStyle(3, 0xa8dded, 0.85);
      mapGraphic.lineBetween(x, y - 13, x, y + 13);
    }
    container.add([shade, panel, title, subtitle, mapGraphic]);

    for (const room of this.layout.roomShapes) {
      const revealLabel = mapKnown || room.id === currentRoomId || room.id === targetRoomId || this.revealedZoneIds.has(room.id);
      if (!revealLabel) continue;
      const roomLabel = this.add.text(
        sx(room.x + room.width / 2),
        sy(room.y + room.height / 2),
        room.name,
        { fontFamily: 'Arial, sans-serif', fontSize: '9px', color: room.id === currentRoomId ? '#f1c879' : '#6f9692' },
      ).setOrigin(0.5);
      container.add(roomLabel);
    }

    const nodes = this.mapId === 'relay_01'
      ? [
        { x: 230, y: 1510, known: '入口', unknown: '入口' },
        { x: 760, y: 1515, known: '西向校准', unknown: '西向校准' },
        { x: 2525, y: 1155, known: '东向校准', unknown: '东向校准' },
        { x: 2920, y: 985, known: '东侧撤离', unknown: '东侧撤离' },
        { x: 3310, y: 775, known: '归航终端', unknown: '归航终端' },
        { x: 350, y: 1515, known: '西侧撤离', unknown: '西侧撤离' },
      ]
      : [
      { x: 240, y: 1960, known: '入口', unknown: '入口' },
      { x: 520, y: 1995, known: '前庭撤离', unknown: '安全信号' },
      { x: 1220, y: 995, known: '导航羽片', unknown: '未知目标' },
      { x: 1450, y: 1330, known: '维护电梯', unknown: '未知设施' },
      { x: 3010, y: 1415, known: '沉钟浮标', unknown: '侧路信号' },
      { x: 3620, y: 745, known: '机房撤离', unknown: '深层信号' },
      { x: 4000, y: 535, known: '墓园天线', unknown: '极远信号' },
      { x: 4520, y: 760, known: '温室入口', unknown: '东侧信号' },
      { x: 5920, y: 1320, known: '温室深处', unknown: '未知目标' },
      { x: 6200, y: 265, known: '温室风顶撤离', unknown: '极远信号' },
    ];
    nodes.forEach((entry, index) => {
      const x = sx(entry.x);
      const y = sy(entry.y);
      const deepNode = this.mapId === 'hollow_01' && index >= 5;
      const node = this.add.circle(x, y, deepNode ? 12 : 9, deepNode ? 0xa281df : 0x74d6bf, 0.9)
        .setStrokeStyle(4, 0x07151d, 1);
      const label = this.add.text(x, y + 19, mapKnown ? entry.known : entry.unknown, {
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
    const targetPosition = this.getMapTarget();
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

  private getNearbyLoot(radius = NEARBY_LOOT_RADIUS): LootEntity[] {
    return this.loot
      .map((entry) => ({
        entry,
        distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.icon.x, entry.icon.y),
      }))
      .filter(({ entry, distance }) => entry.icon.active && distance <= radius)
      .sort((left, right) => left.distance - right.distance || left.entry.id.localeCompare(right.entry.id))
      .map(({ entry }) => entry);
  }

  private refreshBackpackOverlay(): void {
    if (this.overlayMode !== 'backpack') return;
    this.overlay?.destroy(true);
    this.overlay = this.createRaidInventoryOverlay();
    this.updateHud();
    this.publishTextState(true);
  }

  private rotateRaidItemAt(pointer: Phaser.Input.Pointer): void {
    const cellSize = Math.min(62, 340 / Math.max(1, this.profile.backpack.height), 340 / Math.max(1, this.profile.backpack.width));
    const gridWidth = this.profile.backpack.width * cellSize;
    const gridHeight = this.profile.backpack.height * cellSize;
    const gridLeft = 625 - gridWidth / 2;
    const gridTop = 171;
    if (pointer.x < gridLeft || pointer.x >= gridLeft + gridWidth || pointer.y < gridTop || pointer.y >= gridTop + gridHeight) return;
    const cellX = Math.floor((pointer.x - gridLeft) / cellSize);
    const cellY = Math.floor((pointer.y - gridTop) / cellSize);
    const stack = this.backpack.find((entry) => {
      const footprint = getGridItemSize(entry);
      return cellX >= entry.x && cellX < entry.x + footprint.width && cellY >= entry.y && cellY < entry.y + footprint.height;
    });
    if (!stack) return;
    const rotated = rotateGridItem(this.backpack, this.profile.backpack, stack.uid);
    this.overlayNotice = rotated ? `${ITEMS[stack.itemId].name} 已旋转。` : '当前位置没有旋转所需空间。';
    if (rotated) this.backpack = rotated;
    this.refreshBackpackOverlay();
  }

  private rotateActiveRaidDrag(): void {
    const drag = this.activeInventoryDrag;
    if (drag?.source !== 'backpack' || !drag.uid) return;
    const stack = this.backpack.find((entry) => entry.uid === drag.uid);
    const item = stack ? ITEMS[stack.itemId] : null;
    if (!stack || !item || item.size.width === item.size.height) return;

    const grabOffsetX = drag.grabOffsetX ?? 0;
    const grabOffsetY = drag.grabOffsetY ?? 0;
    const rotated = !drag.rotated;
    this.activeInventoryDrag = rotated
      ? {
        ...drag,
        rotated,
        grabOffsetX: item.size.height - 1 - grabOffsetY,
        grabOffsetY: grabOffsetX,
      }
      : {
        ...drag,
        rotated,
        grabOffsetX: grabOffsetY,
        grabOffsetY: item.size.height - 1 - grabOffsetX,
      };
    const footprint = getGridItemSize({ itemId: stack.itemId, rotated });
    this.inventoryDragGhost?.setText(`${item.icon} ${item.name} ↻ ${footprint.width}×${footprint.height}`);
    this.overlayNotice = `拖动中已旋转：${footprint.width}×${footprint.height}`;
    this.createRaidInventoryDragPreview();
    this.updateRaidInventoryDragPreview(this.input.activePointer);
  }

  private createRaidInventoryDragPreview(): void {
    this.inventoryDragPreview?.destroy();
    this.inventoryDragPreview = null;
    const drag = this.activeInventoryDrag;
    if (drag?.source !== 'backpack' || !drag.uid) return;
    const stack = this.backpack.find((entry) => entry.uid === drag.uid);
    if (!stack) return;
    const footprint = getGridItemSize({ itemId: stack.itemId, rotated: drag.rotated ?? stack.rotated });
    const cellSize = Math.min(62, 340 / Math.max(1, this.profile.backpack.height), 340 / Math.max(1, this.profile.backpack.width));
    this.inventoryDragPreview = this.add.rectangle(0, 0, footprint.width * cellSize - 7, footprint.height * cellSize - 7, 0x75d7c2, 0.24)
      .setStrokeStyle(3, 0x9ef0dc, 0.96)
      .setScrollFactor(0)
      .setDepth(221)
      .setVisible(false);
  }

  private updateRaidInventoryDragPreview(pointer: Phaser.Input.Pointer): void {
    const drag = this.activeInventoryDrag;
    const preview = this.inventoryDragPreview;
    if (!preview || drag?.source !== 'backpack' || !drag.uid) return;
    const cellSize = Math.min(62, 340 / Math.max(1, this.profile.backpack.height), 340 / Math.max(1, this.profile.backpack.width));
    const gridWidth = this.profile.backpack.width * cellSize;
    const gridHeight = this.profile.backpack.height * cellSize;
    const gridLeft = 625 - gridWidth / 2;
    const gridTop = 171;
    if (pointer.x < gridLeft || pointer.x >= gridLeft + gridWidth || pointer.y < gridTop || pointer.y >= gridTop + gridHeight) {
      preview.setVisible(false);
      return;
    }
    const stack = this.backpack.find((entry) => entry.uid === drag.uid);
    if (!stack) return;
    const candidate = { ...stack, rotated: drag.rotated ?? stack.rotated };
    const footprint = getGridItemSize(candidate);
    const x = Math.floor((pointer.x - gridLeft) / cellSize) - (drag.grabOffsetX ?? 0);
    const y = Math.floor((pointer.y - gridTop) / cellSize) - (drag.grabOffsetY ?? 0);
    const valid = canPlaceGridItem(this.backpack, this.profile.backpack, candidate, x, y, drag.uid);
    preview
      .setPosition(gridLeft + (x + footprint.width / 2) * cellSize, gridTop + (y + footprint.height / 2) * cellSize)
      .setFillStyle(valid ? 0x75d7c2 : 0xdf7d83, 0.24)
      .setStrokeStyle(3, valid ? 0x9ef0dc : 0xffa7a5, 0.96)
      .setVisible(true);
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
    const carried = drag.uid ? this.backpack.find((entry) => entry.uid === drag.uid) : null;
    const footprint = carried ? getGridItemSize(carried) : item.size;
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
      ? `${RARITY_NAMES[item.rarity]} · ${footprint.width}×${footprint.height}${quantity > 1 ? ` · ×${quantity}` : ''}`
      : (quantity > 1 ? `×${quantity}` : `${footprint.width}×${footprint.height}${carried?.rotated ? ' ↻' : ''}`);
    const detailText = this.add.text(compact ? -width / 2 + 50 : width / 2 - 5, compact ? 12 : -height / 2 + 5, detail, {
      fontFamily: 'Arial, sans-serif',
      fontSize: compact ? '10px' : '9px',
      color: '#f1c879',
    }).setOrigin(compact ? 0 : 1, compact ? 0.5 : 0);
    const card = this.add.container(x, y, [panel, icon, name, detailText]);
    const hitArea = this.add.zone(x, y, width, height).setScrollFactor(0).setInteractive({ cursor: 'grab' });
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.button === 2) return;
      this.activeInventoryDrag = {
        ...drag,
        grabOffsetX: carried ? Math.min(footprint.width - 1, Math.max(0, Math.floor(((pointer.x - (x - width / 2)) / width) * footprint.width))) : 0,
        grabOffsetY: carried ? Math.min(footprint.height - 1, Math.max(0, Math.floor(((pointer.y - (y - height / 2)) / height) * footprint.height))) : 0,
      };
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
      this.createRaidInventoryDragPreview();
      this.updateRaidInventoryDragPreview(pointer);
      card.setScale(1.025).setAlpha(0.92);
    });
    container.add([card, hitArea]);
    if (carried && item.size.width !== item.size.height) {
      const rotateButton = this.add.text(x - width / 2 + 6, y - height / 2 + 4, '↻', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#f1c879',
        backgroundColor: '#12312f',
        padding: { x: 5, y: 3 },
      }).setScrollFactor(0).setDepth(212).setInteractive({ cursor: 'pointer' });
      rotateButton.on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        const rotated = rotateGridItem(this.backpack, this.profile.backpack, carried.uid);
        this.overlayNotice = rotated ? `${item.name} 已旋转。` : '当前位置没有旋转所需空间。';
        if (rotated) this.backpack = rotated;
        this.refreshBackpackOverlay();
      });
      container.add(rotateButton);
    }
    if (carried && carried.quantity > 1) {
      const splitButton = this.add.text(x - width / 2 + 6, y + height / 2 - 24, '½', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#bfeee2',
        backgroundColor: '#12312f',
        padding: { x: 5, y: 3 },
      }).setScrollFactor(0).setDepth(212).setInteractive({ cursor: 'pointer' });
      splitButton.on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        const split = splitGridItem(this.backpack, this.profile.backpack, carried.uid);
        this.overlayNotice = split ? `${item.name} 已拆成两组。` : '没有空间放置拆出的新堆叠。';
        if (split) this.backpack = split;
        this.refreshBackpackOverlay();
      });
      container.add(splitButton);
    }
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
      this.add.text(90, 109, '拖动物品可换装、整理或丢弃；抓取格决定落点，拖动时按 R 可旋转。', {
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
      const footprint = getGridItemSize(stack);
      const width = footprint.width * cellSize - 7;
      const height = footprint.height * cellSize - 7;
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
    if (item.stats?.dashEnabled) return item.stats.dashMode === 'shadow' ? '免伤黑冲' : '普通冲刺';
    if (item.stats?.headEffect === 'kill-heal') return '击败敌人恢复生命';
    if (item.stats?.headEffect === 'scout') return '高亮宝箱与遗失回声';
    if (item.stats?.headEffect === 'tonic-boost') return '糖浆额外恢复 1 点生命';
    if (item.stats?.headEffect === 'panic-haste') return '受伤后短暂加速';
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
      const x = Math.floor((pointer.x - gridLeft) / cellSize) - (drag.grabOffsetX ?? 0);
      const y = Math.floor((pointer.y - gridTop) / cellSize) - (drag.grabOffsetY ?? 0);
      const result = moveOrMergeGridItem(this.backpack, this.profile.backpack, drag.uid, x, y, drag.rotated);
      if (result) {
        this.backpack = result.items;
        this.overlayNotice = result.merged ? '同类物品已合并。' : (result.autoPlaced ? '落点冲突，已自动放到空位。' : '背包布局已调整。');
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
        this.discoveredItems.add(loot.itemId);
        if (loot.itemId === 'map_feather') this.mapUnlocked = true;
        if (loot.itemId === 'map_feather') {
          this.discoveredClues.add('map-trace');
          this.discoveredClues.add('lift-trace');
        }
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
    this.discoveredItems.add(itemId);
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
      this.armor = Math.min(this.armor, this.maxArmor);
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
      const footprint = getGridItemSize(stack);
      const width = footprint.width * cellSize - 7;
      const height = footprint.height * cellSize - 7;
      const x = gridLeft + stack.x * cellSize + width / 2 + 3;
      const y = gridTop + stack.y * cellSize + height / 2 + 3;
      const color = item.rarity === 'relic' ? 0x6f5730 : item.rarity === 'rare' ? 0x3f4777 : 0x1b514c;
      const itemPanel = this.add.rectangle(x, y, width, height, color, 0.95)
        .setStrokeStyle(2, item.rarity === 'relic' ? 0xf1ca7a : 0x78d9c4, 0.55);
      container.add([
        itemPanel,
        this.add.text(x, y - 9, item.icon, { fontSize: `${Math.min(30, height * 0.38)}px` }).setOrigin(0.5),
        this.add.text(x, y + Math.min(24, height * 0.28), item.name, { fontSize: '10px', color: '#d7ece7' }).setOrigin(0.5),
        this.add.text(x + width / 2 - 5, y - height / 2 + 5, stack.quantity > 1 ? `×${stack.quantity}` : `${footprint.width}×${footprint.height}${stack.rotated ? ' ↻' : ''}`, { fontSize: '9px', color: '#f1c879' }).setOrigin(1, 0),
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

  private updateZoneState(time: number): void {
    const exact = findZoneAt(this.mapDefinition, this.player.x, this.player.y);
    if (this.currentZone && containsPoint(this.currentZone, this.player.x, this.player.y, ZONE_HYSTERESIS)) {
      this.zoneCandidate = null;
      this.zoneCandidateSince = null;
      return;
    }
    if (!exact) {
      // Transition gaps are real map space. Preserve the previous label without
      // falling back to foyer, and require a fresh dwell on the far side.
      this.zoneCandidate = null;
      this.zoneCandidateSince = null;
      return;
    }
    if (exact.id === this.currentZone?.id) return;
    if (this.zoneCandidate?.id !== exact.id) {
      this.zoneCandidate = exact;
      this.zoneCandidateSince = time;
      return;
    }
    if (this.zoneCandidateSince === null || time - this.zoneCandidateSince < ZONE_CANDIDATE_DWELL) return;
    this.currentZone = exact;
    this.zoneCandidate = null;
    this.zoneCandidateSince = null;
    if (this.revealedZoneIds.has(exact.id)) return;
    this.showZoneReveal(exact, time);
  }

  private showZoneReveal(zone: MapZoneDefinition, time: number): void {
    this.revealedZoneIds.add(zone.id);
    this.lastZoneRevealAt = time;
    this.tweens.killTweensOf(this.zoneRevealText);
    this.zoneRevealText.setText(`${zone.name}\n风险 ${zone.risk}`).setAlpha(0).setY(190);
    this.tweens.add({ targets: this.zoneRevealText, alpha: { from: 0, to: 0.78 }, y: 174, duration: 520, hold: 1250, yoyo: true, ease: 'Sine.InOut' });
  }

  private getEntryPosition(): { x: number; y: number } {
    if (this.lastSpawnPosition) return this.lastSpawnPosition;
    const entry = this.mapDefinition.entries[this.entryId] ?? Object.values(this.mapDefinition.entries)[0];
    const cluster = this.layout.spawnClusters.find((candidate) => candidate.entryId === entry.id);
    if (!cluster || cluster.positions.length === 0) {
      this.lastSpawnPosition = { x: entry.x, y: entry.y };
      return this.lastSpawnPosition;
    }
    // Raid id supplies deterministic variety: retries can be reproduced, while
    // consecutive expeditions rotate through genuinely different safe arrivals.
    const index = Math.max(0, this.profile.raidsStarted - 1) % cluster.positions.length;
    this.lastSpawnPosition = { ...cluster.positions[index] };
    return this.lastSpawnPosition;
  }

  private carriesEchoCore(): boolean {
    return this.backpack.some((item) => item.itemId === 'echo_core');
  }

  private getMapTarget(): { x: number; y: number } {
    if (this.mapId === 'relay_01') {
      if (!this.discoveredClues.has('relay-west-calibrated')) return { x: 760, y: 1515 };
      if (!this.discoveredClues.has('relay-east-calibrated')) return { x: 2525, y: 1155 };
      return { x: 3310, y: 775 };
    }
    if (this.profile.successfulExtractions === 0) return { x: 520, y: 1995 };
    if (!this.mapUnlocked) return { x: 1220, y: 995 };
    if (!this.shortcutUnlocked) return this.elevatorPoint;
    if (!this.bossDefeated) return { x: 3400, y: 750 };
    if (!this.carriesEchoCore()) return { x: 3400, y: 750 };
    return { x: 3620, y: 745 };
  }

  private getRaidObjective(): string {
    if (this.mapId === 'relay_01') {
      const west = this.discoveredClues.has('relay-west-calibrated');
      const east = this.discoveredClues.has('relay-east-calibrated');
      if (!west) return '校准西向阵列';
      if (!east) return '校准东向阵列';
      return '前往冠顶终端，锁定频道';
    }
    if (this.profile.successfulExtractions === 0) return '在前庭完成首次安全撤离';
    if (!this.mapUnlocked) return '找到导航羽片并安全撤离';
    if (!this.shortcutUnlocked) return '启动裂谷维护电梯';
    if (!this.bossDefeated) return '击败失频守卫，带回回声核心';
    if (!this.carriesEchoCore()) return '拾取并安全带回回声核心';
    return '带着回声核心前往机房信号井撤离';
  }

  private applyRenderScale(): void {
    this.children.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Text) child.setResolution(this.renderScale);
    });
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (child: Phaser.GameObjects.GameObject) => {
      if (child instanceof Phaser.GameObjects.Text) child.setResolution(this.renderScale);
    });
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
      coordinateSystem: `World origin is top-left; +x right, +y down; two-axis room network ${this.worldWidth}x${this.worldHeight}.`,
      objective: this.getRaidObjective(),
      mapId: this.mapId,
      zone: this.currentZone?.name,
      zoneId: this.currentZone?.id ?? null,
      zoneReveal: {
        candidateZoneId: this.zoneCandidate?.id ?? null,
        candidateSince: this.zoneCandidateSince,
        revealedZoneIds: Array.from(this.revealedZoneIds),
        lastRevealAt: this.lastZoneRevealAt,
        visible: this.zoneRevealText.alpha > 0,
      },
      render: {
        logicalWidth: VIEW_WIDTH,
        logicalHeight: VIEW_HEIGHT,
        backingWidth: VIEW_WIDTH,
        backingHeight: VIEW_HEIGHT,
        renderScale: this.renderScale,
      },
      spawn: this.lastSpawnPosition ? { x: Math.round(this.lastSpawnPosition.x), y: Math.round(this.lastSpawnPosition.y) } : undefined,
      lastAttack: this.lastAttack ? { ...this.lastAttack } : null,
      dash: {
        mode: this.getDashMode(),
        active: this.isDashing,
        ready: this.time.now >= this.dashReadyAt,
      },
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        collisionX: Math.round(body.center.x),
        collisionY: Math.round(body.center.y),
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
      nearbyTerrain: this.platformBodies
        .filter((terrainBody) => Math.abs(terrainBody.center.x - body.center.x) < 900
          && Math.abs(terrainBody.center.y - body.center.y) < 700)
        .map((terrainBody) => ({
          left: Math.round(terrainBody.left),
          right: Math.round(terrainBody.right),
          top: Math.round(terrainBody.top),
          bottom: Math.round(terrainBody.bottom),
        })),
      visibleHazards: this.layout.hazards
        .filter((hazard) => Math.abs(hazard.x - this.player.x) < 850 && Math.abs(hazard.y - this.player.y) < 650)
        .map((hazard) => ({ ...hazard })),
      visibleEnemies: this.enemies
        .filter((enemy) => enemy.sprite.active && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y) < 850)
        .map((enemy) => ({
          id: enemy.id,
          kind: enemy.kind,
          x: Math.round(enemy.sprite.x),
          y: Math.round(enemy.sprite.y),
          health: enemy.health,
          state: enemy.combatState,
        })),
      visibleLoot: this.loot
        .filter((entry) => entry.icon.active && Phaser.Math.Distance.Between(entry.icon.x, entry.icon.y, this.player.x, this.player.y) < 850)
        .map((entry) => ({
          id: entry.id,
          itemId: entry.itemId,
          x: Math.round(entry.icon.x),
          y: Math.round(entry.icon.y),
        })),
      visibleStoryEchoes: this.storyEchoes
        .filter((echo) => Phaser.Math.Distance.Between(echo.x, echo.y, this.player.x, this.player.y) < 850)
        .map((echo) => ({ id: echo.id, x: echo.x, y: echo.y, heard: echo.heard, pulsing: Boolean(echo.pulseTween?.isPlaying()) })),
      nearbyInteraction: this.nearbyInteraction,
      flags: {
        dashReady: this.time.now >= this.dashReadyAt,
        dashEquipped: Boolean(this.loadout.shoes && ITEMS[this.loadout.shoes]?.stats?.dashEnabled),
        mapUnlocked: this.mapUnlocked,
        shortcutUnlocked: this.shortcutUnlocked,
        recoveredEcho: this.recoveredEcho,
        extracting: this.extractingUntil > 0,
        inventoryOpen: this.overlayMode === 'backpack',
        paused: this.overlayMode === 'pause',
        abandonHoldActive: this.overlayMode === 'pause' && this.keys.abort.isDown,
      },
    };
    window.__SUI_GAME_STATE__ = state;
  }
}
