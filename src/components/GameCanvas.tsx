import { useEffect, useMemo, useRef } from 'react';
import Phaser from 'phaser';
import { RaidScene } from '../game/RaidScene';
import type { PlayerProfile, RaidResult } from '../types/game';

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;

export function chooseRenderScale(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio: number,
): 1 | 1.5 | 2 {
  const physicalFit = Math.min(
    (viewportWidth * devicePixelRatio) / LOGICAL_WIDTH,
    (viewportHeight * devicePixelRatio) / LOGICAL_HEIGHT,
    2,
  );
  if (physicalFit >= 2) return 2;
  if (physicalFit >= 1.5) return 1.5;
  return 1;
}

interface GameCanvasProps {
  profile: PlayerProfile;
  mapId: string;
  entryId: string;
  onResult: (result: RaidResult) => void;
}

export function GameCanvas({ profile, mapId, entryId, onResult }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderScale = useMemo(() => chooseRenderScale(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio || 1,
  ), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.replaceChildren();

    const backingWidth = Math.round(LOGICAL_WIDTH * renderScale);
    const backingHeight = Math.round(LOGICAL_HEIGHT * renderScale);
    const scene = new RaidScene({ profile, mapId, entryId, renderScale, onResult });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      // Phaser 4 does not document GameConfig.resolution. Use an explicit
      // backing store and let the scene camera preserve 1280x720 coordinates.
      width: backingWidth,
      height: backingHeight,
      transparent: false,
      backgroundColor: '#07151d',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 1500 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: backingWidth,
        height: backingHeight,
      },
      render: { antialias: true, roundPixels: false },
      scene: [scene],
    });

    return () => {
      game.destroy(true);
      container.replaceChildren();
      window.__SUI_GAME_STATE__ = { mode: 'base', objective: '返回饼干台' };
    };
  }, [entryId, mapId, onResult, profile, renderScale]);

  return (
    <main className="raid-shell">
      <div className="game-frame" data-render-scale={renderScale} ref={containerRef} />
    </main>
  );
}
