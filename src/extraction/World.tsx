import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OBSTACLES, SECTORS, EXITS, POWER, RADAR } from './map';
import type { Raid } from './simulation';

type Vec = [number, number, number];
export interface ViewBridge {
  pointer: { x: number; y: number; active: boolean };
  project: (x: number, z: number) => { x: number; y: number };
}
function Box({
  at,
  size,
  color,
  metal = 0,
  emissive,
}: {
  at: Vec;
  size: Vec;
  color: string;
  metal?: number;
  emissive?: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.78}
        metalness={metal}
        emissive={emissive}
        emissiveIntensity={emissive ? 0.7 : 0}
      />
    </mesh>
  );
}
function GroundLabel({
  text,
  at,
  width = 9,
  color = '#ccd8cf',
}: {
  text: string;
  at: Vec;
  width?: number;
  color?: string;
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, 384, 78);
    return new THREE.CanvasTexture(c);
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, width / 6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
function Container({ x, z, w, d, h, color }: (typeof OBSTACLES)[number]) {
  return (
    <group>
      <Box at={[x, h / 2, z]} size={[w, h, d]} color={color} metal={0.35} />
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={i}
          at={[
            x + (w > d ? ((i - 4) * w) / 10 : 0),
            h + 0.05,
            z + (d > w ? ((i - 4) * d) / 10 : 0),
          ]}
          size={w > d ? [0.12, 0.13, d] : [w, 0.13, 0.12]}
          color={color}
        />
      ))}
      <Box
        at={[x, 0.3, z + d / 2 + 0.02]}
        size={[w - 0.15, 0.14, 0.06]}
        color="#bec2a6"
      />
      <GroundLabel
        text="SUI / 07"
        at={[x, h + 0.13, z]}
        width={Math.max(w, d) * 0.65}
        color="#d6d5b7"
      />
    </group>
  );
}
function Environment() {
  const concrete = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#899386';
    ctx.fillRect(0, 0, 512, 512);
    let seed = 91;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let n = 0; n < 12000; n++) {
      const v = 100 + Math.floor(random() * 65);
      ctx.fillStyle = `rgba(${v},${v},${v},.15)`;
      ctx.fillRect(
        random() * 512,
        random() * 512,
        random() * 3 + 1,
        random() * 3 + 1,
      );
    }
    ctx.strokeStyle = '#263b291f';
    ctx.lineWidth = 1;
    for (let n = 0; n < 16; n++) {
      let x = random() * 512,
        y = random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += random() * 30 - 10;
        y += random() * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => concrete.dispose(), [concrete]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#59685e" roughness={1} />
      </mesh>
      <mesh
        position={[0, 0.006, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[96, 96]} />
        <meshStandardMaterial map={concrete} color="#bac1a9" roughness={0.94} />
      </mesh>
      <Box at={[0, -0.18, 0]} size={[96, 0.3, 96]} color="#4f5b51" />
      <Box at={[-5, 0.012, 0]} size={[7, 0.035, 93]} color="#47534f" />
      <Box at={[1, 0.018, 29]} size={[92, 0.04, 7]} color="#47534f" />
      <Box at={[0, 0.016, -17]} size={[89, 0.04, 6]} color="#47534f" />
      {Array.from({ length: 20 }, (_, i) => (
        <Box
          key={`road${i}`}
          at={[-5, 0.05, -44 + i * 4.5]}
          size={[0.11, 0.02, 1.5]}
          color="#aaa98a"
        />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <Box
          key={`lane${i}`}
          at={[-41 + i * 5, 0.06, 29]}
          size={[2, 0.02, 0.12]}
          color="#b9b18a"
        />
      ))}
      <Box at={[25, 0.035, 9]} size={[17, 0.1, 24]} color="#77847a" />
      <Box at={[14, 0.035, -30]} size={[33, 0.1, 18]} color="#6c786b" />
      {OBSTACLES.map((o, i) =>
        o.kind === 'container' ? (
          <Container key={i} {...o} />
        ) : o.kind === 'tank' ? (
          <group key={i} position={[o.x, 0, o.z]}>
            <mesh position={[0, o.h / 2, 0]} castShadow>
              <cylinderGeometry args={[3, 3, o.h, 20]} />
              <meshStandardMaterial
                color={o.color}
                metalness={0.5}
                roughness={0.65}
              />
            </mesh>
            {[0.4, 3.8].map((y) => (
              <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[3.03, 0.12, 6, 20]} />
                <meshStandardMaterial color="#b5b9a0" />
              </mesh>
            ))}
          </group>
        ) : (
          <Box
            key={i}
            at={[o.x, o.h / 2, o.z]}
            size={[o.w, o.h, o.d]}
            color={o.color}
          />
        ),
      )}
      {SECTORS.map((s) => (
        <GroundLabel
          key={s.tag}
          text={s.tag}
          at={[s.x, 0.15, s.z + (s.z > 30 ? -4 : 4)]}
          width={13}
        />
      ))}
      <GroundLabel
        text="+ MEDICAL"
        at={[25, 0.15, 18]}
        width={9}
        color="#d1d8cc"
      />
      <GroundLabel
        text="KEEP CLEAR"
        at={[-32, 0.08, 40]}
        width={7}
        color="#e5c87d"
      />
      {/* Gantry cranes give the harbour a tall, readable silhouette. */}
      {[-43, 43].map((x) => (
        <group key={x}>
          <Box
            at={[x, 7, 35]}
            size={[0.8, 14, 0.8]}
            color="#c99b59"
            metal={0.4}
          />
          <Box at={[x, 7, 15]} size={[0.8, 14, 0.8]} color="#c99b59" />
          <Box at={[x, 14, 25]} size={[1, 1, 23]} color="#d7ab62" />
          <Box at={[x, 10, 24]} size={[0.08, 8, 0.08]} color="#303e3c" />
        </group>
      ))}
      {[-46, 46].map((x) => (
        <Box key={x} at={[x, 0.45, 0]} size={[0.35, 0.9, 93]} color="#a0a18c" />
      ))}
      <Box at={[0, 0.45, -47]} size={[94, 0.9, 0.35]} color="#9b9f8d" />
      <mesh position={[0, -0.4, 66]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[220, 36]} />
        <meshStandardMaterial
          color="#244c52"
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <Box
          key={`dock${i}`}
          at={[-46 + i * 6, 0.1, 47]}
          size={[0.45, 0.7, 1.5]}
          color="#c5b68d"
        />
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <group
          key={`weed${i}`}
          position={[-43 + ((i * 17) % 86), 0, -43 + ((i * 29) % 86)]}
        >
          <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[0.4, 0.6, 4]} />
            <meshStandardMaterial color="#85946b" />
          </mesh>
        </group>
      ))}
      <Box at={[POWER.x, 0.7, POWER.z]} size={[1.4, 1.4, 1]} color="#d3b965" />
      <Box
        at={[POWER.x, 0.9, POWER.z + 0.55]}
        size={[0.7, 0.35, 0.06]}
        color="#152a27"
        emissive="#53c8a1"
      />
      <GroundLabel
        text="POWER"
        at={[POWER.x, 0.1, POWER.z + 2]}
        width={4}
        color="#e3c47b"
      />
      <group position={[RADAR.x, 0, RADAR.z]}>
        <Box at={[0, 2, 0]} size={[0.5, 4, 0.5]} color="#c2cbc1" />
        <mesh position={[0, 4, 0]} rotation={[0.6, 0, 0.2]} castShadow>
          <sphereGeometry args={[2.5, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color="#bac4b5"
            side={THREE.DoubleSide}
            metalness={0.4}
            roughness={0.6}
          />
        </mesh>
        <Box at={[0, 5.5, 0]} size={[0.12, 3, 0.12]} color="#77867d" />
      </group>
      {[
        [-13, 25],
        [-11, -12],
        [37, 17],
        [33, -18],
      ].map(([x, z], index) => (
        <group key={`lamp${index}`}>
          <Box at={[x, 3, z]} size={[0.13, 6, 0.13]} color="#334740" />
          <Box
            at={[x + 0.6, 6, z]}
            size={[1.4, 0.15, 0.5]}
            color="#e2cf92"
            emissive="#edcc7b"
          />
        </group>
      ))}
      {/* Painted loading bays and north railway. */}
      {[-38, -30, -22].map((x) => (
        <group key={`bay${x}`}>
          <Box at={[x, 0.06, 36]} size={[0.08, 0.03, 5]} color="#b8b795" />
          <Box
            at={[x + 3, 0.06, 38.5]}
            size={[6, 0.03, 0.08]}
            color="#b8b795"
          />
        </group>
      ))}
      {[37, 41].map((x) => (
        <Box
          key={`rail${x}`}
          at={[x, 0.12, -32]}
          size={[0.13, 0.2, 29]}
          color="#353e39"
          metal={0.6}
        />
      ))}
      {Array.from({ length: 15 }, (_, i) => (
        <Box
          key={`tie${i}`}
          at={[39, 0.06, -45 + i * 1.9]}
          size={[5, 0.1, 0.25]}
          color="#676957"
        />
      ))}
      {[
        [-42, -40],
        [-40, -40],
        [-42, -37],
        [39, 39],
        [41, 39],
        [42, 37],
      ].map(([x, z], i) => (
        <group key={`barrel${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 1.1, 12]} />
            <meshStandardMaterial
              color={i % 2 ? '#99774d' : '#6b8476'}
              metalness={0.45}
              roughness={0.7}
            />
          </mesh>
          <Box at={[0, 0.55, 0.45]} size={[0.3, 0.25, 0.015]} color="#c9bb80" />
        </group>
      ))}
      <group position={[-33, -0.15, 51]}>
        <Box at={[0, 0.55, 0]} size={[6, 1, 2.8]} color="#3c5048" />
        <Box at={[1, 1.3, 0]} size={[2, 1, 2.2]} color="#c3c5ae" />
        <Box at={[1, 1.7, -0.8]} size={[1.5, 0.4, 0.1]} color="#4c6967" />
      </group>
    </group>
  );
}
function Operator({ raid, enemyId }: { raid: Raid; enemyId?: number }) {
  const group = useRef<THREE.Group>(null),
    legs = useRef<THREE.Group>(null);
  const enemy =
    enemyId === undefined ? null : raid.enemies.find((e) => e.id === enemyId)!;
  const color = enemy ? (enemy.elite ? '#8b6048' : '#596756') : '#bfc9b4';
  useFrame(({ clock }) => {
    const p = enemy ?? raid.player;
    if (!group.current) return;
    group.current.visible = p.hp > 0;
    group.current.position.set(p.x, 0, p.z);
    group.current.rotation.y = p.angle;
    if (legs.current)
      legs.current.rotation.x = raid.paused
        ? 0
        : Math.sin(clock.elapsedTime * 12) *
          (enemy || raid.player.moving ? 0.18 : 0);
  });
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[0.58, 0.65, 24]} />
        <meshBasicMaterial
          color={enemy ? '#db9770' : '#a6f0ce'}
          transparent
          opacity={0.6}
        />
      </mesh>
      <group ref={legs}>
        <Box at={[-0.2, 0.4, 0]} size={[0.27, 0.7, 0.35]} color="#344842" />
        <Box at={[0.2, 0.4, 0]} size={[0.27, 0.7, 0.35]} color="#344842" />
      </group>
      <Box at={[0, 1.05, 0]} size={[0.72, 0.7, 0.43]} color={color} />
      <Box
        at={[0, 1.03, 0.24]}
        size={[0.54, 0.55, 0.13]}
        color={enemy ? '#4a463b' : '#405e54'}
      />
      <Box at={[0, 1, -0.32]} size={[0.54, 0.6, 0.25]} color="#8f825c" />
      <mesh position={[0, 1.63, 0]} castShadow>
        <sphereGeometry args={[0.29, 10, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Box
        at={[0, 1.6, 0.24]}
        size={[0.4, 0.12, 0.08]}
        color={enemy ? '#d89465' : '#84ddc9'}
        emissive={enemy ? '#7f4026' : '#2a8e7b'}
      />
      <Box at={[0.39, 1.15, 0.26]} size={[0.2, 0.23, 0.75]} color={color} />
      <Box at={[-0.35, 1.15, 0.3]} size={[0.2, 0.23, 0.5]} color={color} />
      <Box
        at={[0.26, 1.23, 0.75]}
        size={[0.15, 0.17, 1.12]}
        color="#243632"
        metal={0.6}
      />
      {!enemy && raid.loadout.suppressor && (
        <Box
          at={[0.26, 1.23, 1.36]}
          size={[0.19, 0.19, 0.35]}
          color="#202a27"
        />
      )}
      {enemy?.elite && (
        <Box at={[0, 1.14, -0.55]} size={[0.8, 0.9, 0.22]} color="#7b503b" />
      )}
    </group>
  );
}
function Markers({ raid }: { raid: Raid }) {
  return (
    <group>
      {raid.crates
        .filter((c) => c.loot.length)
        .map((c) => (
          <group key={c.id} position={[c.x, 0, c.z]}>
            <Box
              at={[0, 0.35, 0]}
              size={[1.1, 0.7, 0.8]}
              color={c.id === 'signal-core' ? '#d7a855' : '#3f6155'}
              metal={0.4}
            />
            <Box
              at={[0, 0.73, 0]}
              size={[0.6, 0.035, 0.15]}
              color="#a3f2ca"
              emissive="#63e3b4"
            />
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.9, 1, 20]} />
              <meshBasicMaterial color="#8bddb6" transparent opacity={0.45} />
            </mesh>
          </group>
        ))}
      {EXITS.map((e) => (
        <group key={e.id} position={[e.x, 0, e.z]}>
          <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.8, 3, 48]} />
            <meshBasicMaterial
              color={!e.requiresPower || raid.powered ? '#9beaab' : '#d99b58'}
            />
          </mesh>
          <GroundLabel
            text={e.requiresPower && !raid.powered ? 'LOCKED' : 'EXTRACT'}
            at={[0, 0.1, 0]}
            width={4}
            color="#d2e8c0"
          />
          <Box at={[2.5, 1, 0]} size={[0.12, 2, 0.12]} color="#a6baa0" />
          <mesh position={[2.5, 2.1, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshBasicMaterial
              color={!e.requiresPower || raid.powered ? '#92efaa' : '#ed9851'}
            />
          </mesh>
        </group>
      ))}
      {raid.lost && !raid.recovered && (
        <group position={[raid.lost.x, 0, raid.lost.z]}>
          <Box at={[0, 0.25, 0]} size={[1, 0.5, 0.7]} color="#ab7967" />
          <GroundLabel
            text="RECOVER"
            at={[0, 0.1, 1]}
            width={4}
            color="#eda578"
          />
        </group>
      )}
    </group>
  );
}
function Effects({ raid }: { raid: Raid }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    group.current?.children.forEach((obj, index) => {
      const mesh = obj as THREE.Mesh,
        trace = raid.traces[index];
      if (index < 20) {
        mesh.visible = !!trace;
        if (trace) {
          mesh.position.set(
            (trace.x + trace.tx) / 2,
            1.15,
            (trace.z + trace.tz) / 2,
          );
          mesh.rotation.y = Math.atan2(trace.tx - trace.x, trace.tz - trace.z);
          mesh.scale.set(
            0.045,
            0.045,
            Math.hypot(trace.tx - trace.x, trace.tz - trace.z),
          );
        }
      } else if (index < 40) {
        const b = raid.bullets[index - 20];
        mesh.visible = !!b;
        if (b) {
          mesh.position.set(b.x, 1.1, b.z);
          mesh.scale.set(0.12, 0.12, 0.45);
          mesh.rotation.y = Math.atan2(b.vx, b.vz);
        }
      } else {
        const e = raid.enemies[index - 40];
        mesh.visible = !!e && e.hp > 0 && e.windup > 0;
        if (mesh.visible) {
          mesh.position.set((e.x + e.targetX) / 2, 0.17, (e.z + e.targetZ) / 2);
          mesh.rotation.y = Math.atan2(e.targetX - e.x, e.targetZ - e.z);
          mesh.scale.set(
            0.04,
            0.04,
            Math.hypot(e.x - e.targetX, e.z - e.targetZ),
          );
        }
      }
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 54 }, (_, i) => (
        <mesh key={i} visible={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color={i < 20 ? '#fff0b1' : '#ff8260'}
            transparent
            opacity={i < 40 ? 1 : 0.6}
          />
        </mesh>
      ))}
    </group>
  );
}
function Reticle({ raid, bridge }: { raid: Raid; bridge: ViewBridge }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.visible =
      !raid.paused && !raid.search && bridge.pointer.active;
    group.current.position.set(raid.input.aimX, 1, raid.input.aimZ);
    group.current.scale.setScalar(raid.input.ads ? 0.6 : 1);
  });
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.27, 0.31, 24]} />
        <meshBasicMaterial
          color="#f4edc1"
          depthTest={false}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
function CameraRig({
  raid,
  base,
  bridge,
}: {
  raid: Raid;
  base: boolean;
  bridge: ViewBridge;
}) {
  const { camera, size } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []),
    // Aim through torso height so pointing at the visible operator does not
    // overshoot their feet when firing across the isometric camera.
    plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), []),
    point = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    bridge.project = (x, z) => {
      const p = new THREE.Vector3(x, 1, z).project(camera);
      return {
        x: ((p.x + 1) / 2) * size.width,
        y: ((-p.y + 1) / 2) * size.height,
      };
    };
  }, [camera, size, bridge]);
  useFrame(() => {
    const p = raid.player;
    const width = size.width / size.height;
    const targetX = base ? -26 : p.x,
      targetZ = base ? 28 : p.z;
    camera.position.set(
      targetX,
      base ? 32 : width < 1 ? 42 : 34,
      targetZ + (base ? 24 : 25),
    );
    camera.lookAt(targetX, 0, targetZ);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(
        size.width / (width < 1 ? 29 : 49),
        size.height / 30,
      );
      camera.updateProjectionMatrix();
    }
    if (!base && bridge.pointer.active) {
      ray.setFromCamera(
        new THREE.Vector2(
          (bridge.pointer.x / size.width) * 2 - 1,
          (-bridge.pointer.y / size.height) * 2 + 1,
        ),
        camera,
      );
      if (ray.ray.intersectPlane(plane, point)) {
        raid.input.aimX = point.x;
        raid.input.aimZ = point.z;
      }
    }
  });
  return null;
}
class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="ex-gpu-error">
        3D 场景启动失败。请开启浏览器硬件加速后刷新。
        <a href="?mode=lantern">进入 2D 借光归来</a>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function World({
  raid,
  base,
  quality,
  bridge,
}: {
  raid: Raid;
  base: boolean;
  quality: 'high' | 'low';
  bridge: ViewBridge;
}) {
  return (
    <RenderBoundary>
      <Canvas
        orthographic
        shadows={quality === 'high'}
        dpr={[1, quality === 'high' ? 1.5 : 1]}
        camera={{ position: [0, 34, 25], near: 0.1, far: 200, zoom: 25 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
      >
        <color attach="background" args={['#82968c']} />
        <fog attach="fog" args={['#82968c', 65, 140]} />
        <ambientLight intensity={1.05} />
        <hemisphereLight args={['#d8e8df', '#3b4a36', 1.3]} />
        <directionalLight
          position={[-25, 45, 10]}
          intensity={2.7}
          color="#ffe5b1"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-65}
          shadow-camera-right={65}
          shadow-camera-top={65}
          shadow-camera-bottom={-65}
          shadow-camera-far={150}
          shadow-bias={-0.0005}
        />
        <Environment />
        <Markers raid={raid} />
        <Operator raid={raid} />
        {!base &&
          raid.enemies.map((e) => (
            <Operator key={e.id} raid={raid} enemyId={e.id} />
          ))}
        <Effects raid={raid} />
        {!base && <Reticle raid={raid} bridge={bridge} />}
        <CameraRig raid={raid} base={base} bridge={bridge} />
      </Canvas>
    </RenderBoundary>
  );
}
