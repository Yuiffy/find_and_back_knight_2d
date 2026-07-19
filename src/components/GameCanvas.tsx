import { useEffect, useMemo, useRef } from 'react';
import Phaser from 'phaser';
import { RaidScene } from '../game/RaidScene';
import type { PlayerProfile, RaidResult, RaidRunState, RaidTransition } from '../types/game';

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
  runState?: RaidRunState | null;
  onResult: (result: RaidResult) => void;
  onTransition?: (transition: RaidTransition) => void;
}

export function GameCanvas({ profile, mapId, entryId, runState, onResult, onTransition }: GameCanvasProps) {
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

    const scene = new RaidScene({ profile, mapId, entryId, renderScale, runState, onResult, onTransition });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      // Keep one logical coordinate space for the camera, HUD and pointer input.
      // The browser scales this canvas to the available viewport while text uses
      // renderScale below for a sharper internal texture on high-DPI screens.
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      transparent: false,
      backgroundColor: '#07151d',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 1500 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT,
      },
      render: { antialias: true, roundPixels: false },
      scene: [scene],
    });

    return () => {
      game.destroy(true);
      container.replaceChildren();
      window.__SUI_GAME_STATE__ = { mode: 'base', objective: '返回饼干台' };
    };
  }, [entryId, mapId, onResult, onTransition, profile, renderScale, runState]);

  return (
    <main className="raid-shell">
      <div className="game-frame" ref={containerRef} />
    </main>
  );
}
