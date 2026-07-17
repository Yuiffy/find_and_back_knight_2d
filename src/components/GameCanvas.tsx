import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { RaidScene } from '../game/RaidScene';
import type { PlayerProfile, RaidResult } from '../types/game';

interface GameCanvasProps {
  profile: PlayerProfile;
  entryId: 'foyer' | 'lift';
  onResult: (result: RaidResult) => void;
}

export function GameCanvas({ profile, entryId, onResult }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.replaceChildren();

    const scene = new RaidScene({ profile, entryId, onResult });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 1280,
      height: 720,
      transparent: false,
      backgroundColor: '#07151d',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 1500 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      render: {
        antialias: true,
        roundPixels: false,
      },
      scene: [scene],
    });

    return () => {
      game.destroy(true);
      container.replaceChildren();
      window.__SUI_GAME_STATE__ = { mode: 'base', objective: '返回饼干台' };
    };
  }, [entryId, onResult, profile]);

  return (
    <main className="raid-shell">
      <div className="game-frame" ref={containerRef} />
    </main>
  );
}
