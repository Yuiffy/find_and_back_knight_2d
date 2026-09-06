import Phaser from 'phaser';
import { POINTS, TERRAIN, type RelicId } from './model';

const C = { ink: 0x293e39, stone: 0xc1cabc, light: 0xe2e8d9, shade: 0x70877b, moss: 0x597d51, leaf: 0x8eb173, coral: 0xc96962, gold: 0xf2c770 };

function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function createArt(scene: Phaser.Scene): void {
  texture(scene, 'lantern-solid', 8, 8, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 8, 8));
  texture(scene, 'lantern-guard', 100, 100, (g) => {
    g.fillStyle(0x263d39, 0.25).fillEllipse(50, 89, 70, 12);
    g.fillStyle(C.ink).fillRoundedRect(22, 49, 56, 38, 19);
    g.fillStyle(0x647c68).fillRoundedRect(28, 43, 48, 36, 17);
    g.fillStyle(C.light).fillEllipse(49, 46, 49, 47);
    g.fillStyle(C.moss).fillTriangle(20, 33, 58, 4, 78, 40).fillEllipse(50, 31, 65, 28);
    g.fillStyle(C.leaf).fillTriangle(41, 22, 40, 0, 65, 16);
    g.lineStyle(3, C.ink).lineBetween(49, 18, 66, 8);
    g.fillStyle(C.ink).fillRoundedRect(34, 43, 7, 11, 3).fillRoundedRect(53, 43, 7, 11, 3);
    g.lineStyle(2, C.shade).lineBetween(43, 61, 51, 61);
    g.fillStyle(C.coral).fillRoundedRect(66, 43, 20, 35, 5);
    g.lineStyle(2, 0xeaa292).strokeRoundedRect(70, 47, 12, 26, 3);
    g.fillStyle(C.ink).fillRoundedRect(30, 78, 12, 12, 4).fillRoundedRect(60, 78, 12, 12, 4);
  });
  texture(scene, 'lantern-sentry', 100, 100, (g) => {
    g.fillStyle(C.ink).fillRoundedRect(43, 63, 14, 25, 3);
    g.fillStyle(C.shade).fillEllipse(50, 85, 53, 14);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.fillStyle(i % 2 === 0 ? C.light : C.stone).fillEllipse(50 + Math.cos(a) * 25, 39 + Math.sin(a) * 25, 28, 30);
    }
    g.fillStyle(C.ink).fillCircle(50, 40, 21);
    g.fillStyle(C.gold).fillCircle(50, 39, 17);
    g.fillStyle(0xffffff).fillEllipse(47, 36, 15, 18);
    g.fillStyle(C.ink).fillCircle(46, 36, 5);
    g.lineStyle(3, C.moss).lineBetween(48, 66, 23, 71).lineBetween(54, 72, 75, 65);
  });
  texture(scene, 'lantern-keeper', 140, 150, (g) => {
    g.fillStyle(C.ink, 0.3).fillEllipse(72, 135, 104, 17);
    g.fillStyle(C.ink).fillRoundedRect(29, 54, 83, 71, 17);
    g.fillStyle(C.shade).fillRoundedRect(34, 58, 74, 58, 13);
    g.fillStyle(C.stone).fillRoundedRect(32, 18, 78, 69, 20);
    g.fillStyle(C.light).fillRoundedRect(40, 22, 61, 58, 15);
    g.fillStyle(C.ink).fillRoundedRect(49, 41, 13, 17, 5).fillRoundedRect(79, 41, 13, 17, 5);
    g.fillStyle(C.gold).fillRoundedRect(51, 42, 7, 10, 3).fillRoundedRect(81, 42, 7, 10, 3);
    g.lineStyle(4, C.shade).lineBetween(59, 68, 84, 68);
    g.fillStyle(C.moss).fillTriangle(33, 22, 22, 0, 71, 13).fillTriangle(76, 12, 118, 2, 108, 29);
    g.fillStyle(C.coral).fillRoundedRect(22, 78, 17, 36, 6).fillRoundedRect(103, 78, 17, 36, 6);
    g.fillStyle(C.gold).fillRoundedRect(56, 90, 31, 26, 8).fillEllipse(71, 115, 40, 9);
    g.fillStyle(C.ink).fillRoundedRect(38, 121, 21, 14, 5).fillRoundedRect(84, 121, 21, 14, 5);
    g.lineStyle(3, C.light).lineBetween(25, 80, 11, 56).lineBetween(116, 85, 129, 67);
  });
  texture(scene, 'lantern-core', 80, 100, (g) => {
    g.lineStyle(4, C.ink).strokeCircle(40, 20, 12);
    g.fillStyle(C.ink).fillRoundedRect(19, 29, 42, 57, 9);
    g.fillStyle(C.gold).fillRoundedRect(25, 36, 30, 42, 6);
    g.fillStyle(0xfff4cc).fillTriangle(31, 62, 43, 43, 51, 67).fillEllipse(40, 67, 21, 19);
    g.fillStyle(C.light).fillRoundedRect(19, 28, 42, 9, 3).fillRoundedRect(19, 78, 42, 10, 3);
  });
  texture(scene, 'lantern-feather', 72, 32, (g) => {
    g.fillStyle(0xf9faf0).fillTriangle(5, 18, 58, 2, 42, 27);
    g.fillStyle(0x80bda3).fillTriangle(9, 18, 62, 8, 42, 27);
    g.lineStyle(3, C.ink).lineBetween(8, 21, 57, 9);
  });
  for (const id of ['bell', 'letter', 'seed'] as RelicId[]) {
    texture(scene, `lantern-relic-${id}`, 70, 70, (g) => {
      if (id === 'bell') {
        g.lineStyle(3, C.ink).strokeCircle(35, 13, 8);
        g.fillStyle(C.gold).fillRoundedRect(18, 23, 34, 32, 13).fillEllipse(35, 54, 44, 11);
        g.lineStyle(3, C.light).lineBetween(26, 28, 23, 45);
        g.fillStyle(C.ink).fillCircle(35, 59, 5);
      } else if (id === 'letter') {
        g.fillStyle(C.light).fillRoundedRect(9, 16, 52, 39, 5);
        g.lineStyle(3, C.shade).strokeRoundedRect(9, 16, 52, 39, 5).lineBetween(10, 18, 35, 38).lineBetween(60, 18, 35, 38);
        g.fillStyle(C.coral).fillCircle(35, 37, 7);
      } else {
        g.fillStyle(C.stone).fillRoundedRect(23, 34, 25, 26, 7);
        g.lineStyle(4, C.ink).lineBetween(35, 44, 35, 18);
        g.fillStyle(C.leaf).fillEllipse(25, 24, 23, 13).fillEllipse(45, 15, 23, 15);
        g.fillStyle(C.light).fillCircle(36, 47, 6);
      }
    });
  }
}

function arch(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  g.lineStyle(20, C.shade, 0.38);
  g.beginPath().moveTo(x - width / 2, y).lineTo(x - width / 2, y - height + width / 2).arc(x, y - height + width / 2, width / 2, Math.PI, 0).lineTo(x + width / 2, y).strokePath();
  g.lineStyle(10, C.light, 0.62);
  g.beginPath().moveTo(x - width / 2, y).lineTo(x - width / 2, y - height + width / 2).arc(x, y - height + width / 2, width / 2, Math.PI, 0).lineTo(x + width / 2, y).strokePath();
  g.lineStyle(3, C.shade, 0.36).lineBetween(x, y - height + 8, x, y).lineBetween(x - width / 2 + 10, y - height / 2, x + width / 2 - 10, y - height / 2);
}

function plant(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color = C.moss): void {
  g.lineStyle(2, color).lineBetween(x, y, x + 4, y - size);
  g.fillStyle(color).fillEllipse(x - size * 0.18, y - size * 0.45, size * 0.55, size * 0.2);
  g.fillStyle(C.leaf).fillEllipse(x + size * 0.23, y - size * 0.7, size * 0.6, size * 0.22);
}

export function drawWorld(scene: Phaser.Scene, hasReturned: boolean): { beacon: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; relic: Phaser.GameObjects.Image; gate: Phaser.GameObjects.Graphics; rest: Phaser.GameObjects.Graphics } {
  const distant = scene.add.graphics().setDepth(-40);
  for (const [x, y, w, h] of [[950, 700, 280, 395], [2140, 820, 650, 570], [3100, 700, 640, 490], [4650, 820, 360, 700]]) arch(distant, x, y, w, h);
  distant.lineStyle(3, C.ink, 0.28).lineBetween(1870, 310, 2440, 310).lineBetween(2870, 320, 3360, 320);

  const terrain = scene.add.graphics().setDepth(1);
  for (const segment of TERRAIN) {
    const { x, top, width, height, garden } = segment;
    terrain.fillStyle(garden ? 0x7c8e7d : 0x87988f).fillRect(x, top, width, height);
    terrain.fillStyle(0x415c51, 0.35).fillRect(x, top + 24, width, height - 24);
    for (let row = 0; row < Math.min(7, height / 52); row++) {
      for (let column = 0; column < width / 112; column++) {
        const offset = row % 2 ? 42 : 0;
        const bx = x + column * 112 + offset;
        const bw = Math.min(103, x + width - bx - 3);
        if (bw < 1) continue;
        terrain.fillStyle((row + column) % 3 === 0 ? 0xa2aea0 : 0x8d9c8e, 0.65 - row * 0.05).fillRoundedRect(bx + 3, top + 29 + row * 50, bw, 43, 4);
        terrain.lineStyle(1, 0xd6ddc7, 0.2).lineBetween(bx + 9, top + 31 + row * 50, bx + bw - 4, top + 31 + row * 50);
      }
    }
    terrain.fillStyle(C.ink).fillRect(x, top, width, 6);
    terrain.fillStyle(garden ? 0x8ca866 : C.light).fillRect(x, top + 3, width, 12);
    terrain.fillStyle(garden ? 0xbac988 : 0xf2f3df).fillRect(x, top, width, 4);
    for (let i = 18; i < width - 15; i += 59) {
      const n = Math.sin((x + i) * 2.4);
      if (garden) plant(terrain, x + i, top, 13 + Math.abs(n) * 22);
      if (garden && n > 0.25) {
        terrain.fillStyle(C.coral).fillCircle(x + i + 4, top - 23, 3.5);
        terrain.fillStyle(0xf3dbc4).fillCircle(x + i + 5, top - 24, 1.5);
      }
      if (i % 3 > 1) {
        terrain.lineStyle(2, C.ink, 0.25).lineBetween(x + i, top + 16, x + i - 8, top + 31);
      }
    }
  }

  const station = scene.add.graphics().setDepth(-10);
  station.fillStyle(C.shade).fillRoundedRect(87, 509, 237, 190, 9);
  station.fillStyle(C.light).fillRoundedRect(94, 515, 221, 182, 6);
  station.fillStyle(C.ink).fillRoundedRect(162, 567, 80, 129, { tl: 38, tr: 38, bl: 0, br: 0 });
  station.fillStyle(0x5a7972).fillRoundedRect(170, 576, 64, 120, { tl: 31, tr: 31, bl: 0, br: 0 });
  station.fillStyle(C.coral).fillTriangle(65, 520, 205, 423, 345, 520);
  station.lineStyle(8, C.ink).lineBetween(63, 520, 205, 421).lineBetween(205, 421, 347, 520);
  station.fillStyle(C.gold, hasReturned ? 0.95 : 0.4).fillRoundedRect(107, 550, 36, 51, 14).fillRoundedRect(265, 550, 36, 51, 14);
  station.lineStyle(3, C.ink).lineBetween(125, 550, 125, 601).lineBetween(283, 550, 283, 601);
  station.fillStyle(C.ink).fillRoundedRect(180, 470, 51, 29, 6);
  scene.add.text(205, 484, 'SUI', { fontFamily: 'Georgia', fontSize: '17px', color: '#f2efe1' }).setOrigin(0.5).setDepth(-9);
  station.lineStyle(4, C.ink).lineBetween(380, 697, 380, 522).lineBetween(380, 522, 421, 522);
  const beacon = scene.add.image(413, 557, 'lantern-core').setDisplaySize(41, 51).setDepth(-8).setAlpha(hasReturned ? 1 : 0.42);
  sign(scene, 650, 700, '温室', 1);
  sign(scene, 2580, 630, '灯芯温室', 1);
  sign(scene, 3640, 700, '钟楼', 1);
  sign(scene, 2690, 700, '归灯站', -1);

  const shrine = scene.add.graphics().setDepth(-7);
  arch(shrine, POINTS.core.x, 700, 160, 270);
  shrine.fillStyle(C.stone).fillRect(POINTS.core.x - 30, 651, 60, 47);
  shrine.fillStyle(C.light).fillRoundedRect(POINTS.core.x - 42, 644, 84, 12, 4);
  const core = scene.add.image(POINTS.core.x, POINTS.core.y - 21, 'lantern-core').setDepth(6).setScale(0.75);
  scene.tweens.add({ targets: core, y: core.y - 7, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

  const rest = scene.add.graphics().setDepth(3);
  rest.fillStyle(C.ink).fillRoundedRect(POINTS.rest.x - 39, 610, 78, 10, 3).fillRect(POINTS.rest.x - 31, 620, 7, 10).fillRect(POINTS.rest.x + 24, 620, 7, 10);
  rest.fillStyle(C.coral).fillRoundedRect(POINTS.rest.x - 9, 585, 21, 25, 6);
  rest.lineStyle(3, C.light).strokeCircle(POINTS.rest.x + 15, 597, 8);
  rest.fillStyle(C.light).fillEllipse(POINTS.rest.x + 1, 585, 22, 7);
  scene.add.text(POINTS.rest.x, 563, '雨歇茶', { fontFamily: 'Microsoft YaHei', fontSize: '13px', color: '#344d43', backgroundColor: '#edf0dc', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(2);

  const gate = scene.add.graphics().setDepth(4);
  gate.lineStyle(9, C.ink, 0.8).lineBetween(3730, 700, 3730, 514).lineBetween(3770, 700, 3770, 514);
  gate.lineStyle(4, C.gold, 0.7);
  for (let y = 525; y < 695; y += 27) gate.lineBetween(3730, y, 3770, y + 15);
  scene.add.text(3750, 472, '钟楼', { fontFamily: 'Georgia, Microsoft YaHei', fontSize: '22px', color: '#314b42' }).setOrigin(0.5).setDepth(2);

  const pedestal = scene.add.graphics().setDepth(2);
  pedestal.fillStyle(C.stone).fillRect(4822, 592, 76, 28);
  pedestal.fillStyle(C.light).fillRoundedRect(4812, 588, 96, 12, 4);
  const relic = scene.add.image(POINTS.relic.x, POINTS.relic.y, 'lantern-relic-bell').setDepth(6).setAlpha(0.38);

  const details = scene.add.graphics().setDepth(3);
  for (const x of [810, 1530, 2910, 3650, 4380]) {
    const y = x === 4380 ? 620 : 700;
    details.lineStyle(3, C.ink).lineBetween(x, y, x, y - 90);
    details.fillStyle(C.coral).fillTriangle(x, y - 90, x + 43, y - 80, x, y - 62);
    plant(details, x - 19, y, 51);
  }
  return { beacon, core, relic, gate, rest };
}

function sign(scene: Phaser.Scene, x: number, y: number, label: string, direction: number): void {
  const g = scene.add.graphics().setDepth(2);
  g.fillStyle(C.ink).fillRect(x - 3, y - 69, 6, 69);
  g.fillStyle(C.light).fillRoundedRect(x - 52, y - 86, 104, 29, 4);
  g.lineStyle(2, C.shade).strokeRoundedRect(x - 52, y - 86, 104, 29, 4);
  scene.add.text(x, y - 73, `${direction < 0 ? '‹ ' : ''}${label}${direction > 0 ? ' ›' : ''}`, { fontFamily: 'Microsoft YaHei', fontSize: '12px', color: '#364c42' }).setOrigin(0.5).setDepth(3);
}
