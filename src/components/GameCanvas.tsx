import { useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import Phaser from 'phaser';
import { RaidScene, type VirtualControl } from '../game/RaidScene';
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

interface TouchControlsProps {
  sceneRef: MutableRefObject<RaidScene | null>;
}

function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0
    || 'ontouchstart' in window
    || window.matchMedia('(pointer: coarse)').matches;
}

function TouchControls({ sceneRef }: TouchControlsProps) {
  const [joystickPointerId, setJoystickPointerId] = useState<number | null>(null);
  const [joystickOffset, setJoystickOffset] = useState({ x: 0, y: 0 });
  const activeJoystickControls = useRef<VirtualControl[]>([]);

  const clearControls = (): void => {
    activeJoystickControls.current.forEach((control) => sceneRef.current?.setVirtualControl(control, false));
    activeJoystickControls.current = [];
    setJoystickPointerId(null);
    setJoystickOffset({ x: 0, y: 0 });
  };

  const updateJoystick = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const maxDistance = bounds.width * 0.28;
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const offset = { x: dx * scale, y: dy * scale };
    const nextControls: VirtualControl[] = [];
    if (offset.x < -maxDistance * 0.25) nextControls.push('left');
    if (offset.x > maxDistance * 0.25) nextControls.push('right');
    if (offset.y < -maxDistance * 0.5) nextControls.push('aimUp');
    if (offset.y > maxDistance * 0.5) nextControls.push('aimDown');
    activeJoystickControls.current.forEach((control) => {
      if (!nextControls.includes(control)) sceneRef.current?.setVirtualControl(control, false);
    });
    nextControls.forEach((control) => {
      if (!activeJoystickControls.current.includes(control)) sceneRef.current?.setVirtualControl(control, true);
    });
    activeJoystickControls.current = nextControls;
    setJoystickOffset(offset);
  };

  const handleJoystickDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' || joystickPointerId !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setJoystickPointerId(event.pointerId);
    updateJoystick(event);
  };

  const handleJoystickMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault();
    updateJoystick(event);
  };

  const handleJoystickEnd = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault();
    clearControls();
  };

  const handleButtonDown = (control: VirtualControl) => (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sceneRef.current?.setVirtualControl(control, true);
  };

  const handleButtonEnd = (control: VirtualControl) => (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    sceneRef.current?.setVirtualControl(control, false);
  };

  useEffect(() => () => sceneRef.current?.clearVirtualControls(), [sceneRef]);

  const button = (control: VirtualControl, label: string, className = '') => (
    <button
      className={`touch-button ${className}`}
      type="button"
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={handleButtonDown(control)}
      onPointerUp={handleButtonEnd(control)}
      onPointerCancel={handleButtonEnd(control)}
      onLostPointerCapture={handleButtonEnd(control)}
    >
      {label}
    </button>
  );

  return (
    <div className="touch-controls" aria-label="触屏游戏操作">
      <div
        className="touch-joystick"
        aria-label="移动与方向攻击摇杆"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handleJoystickDown}
        onPointerMove={handleJoystickMove}
        onPointerUp={handleJoystickEnd}
        onPointerCancel={handleJoystickEnd}
        onLostPointerCapture={handleJoystickEnd}
      >
        <span className="touch-joystick-knob" style={{ transform: `translate(${joystickOffset.x}px, ${joystickOffset.y}px)` }} />
        <small>移动 / 方向</small>
      </div>
      <div className="touch-action-cluster">
        {button('jump', '跳跃', 'touch-button-jump')}
        {button('attack', '攻击', 'touch-button-attack')}
        {button('dash', '冲刺')}
        {button('interact', '互动')}
      </div>
      <div className="touch-utility-cluster">
        {button('map', '地图')}
        {button('backpack', '背包')}
        {button('patch', '修补')}
        {button('tonic', '糖浆')}
        {button('pause', '暂停')}
      </div>
    </div>
  );
}

export function GameCanvas({ profile, mapId, entryId, runState, onResult, onTransition }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RaidScene | null>(null);
  const [touchEnabled, setTouchEnabled] = useState(false);
  const renderScale = useMemo(() => chooseRenderScale(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio || 1,
  ), []);

  useEffect(() => {
    const refreshTouchCapability = () => setTouchEnabled(isTouchDevice());
    refreshTouchCapability();
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    coarsePointer.addEventListener('change', refreshTouchCapability);
    return () => coarsePointer.removeEventListener('change', refreshTouchCapability);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.replaceChildren();

    const scene = new RaidScene({ profile, mapId, entryId, renderScale, runState, onResult, onTransition });
    sceneRef.current = scene;
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
      scene.clearVirtualControls();
      if (sceneRef.current === scene) sceneRef.current = null;
      game.destroy(true);
      container.replaceChildren();
      window.__SUI_GAME_STATE__ = { mode: 'base', objective: '返回饼干台' };
    };
  }, [entryId, mapId, onResult, onTransition, profile, renderScale, runState]);

  return (
    <main className="raid-shell">
      <div className="game-frame" ref={containerRef} />
      {touchEnabled && <TouchControls sceneRef={sceneRef} />}
    </main>
  );
}
