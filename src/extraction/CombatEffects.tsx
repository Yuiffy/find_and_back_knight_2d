import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Raid } from './simulation';

const CAPACITY = 64;
const color = new THREE.Color();

/** Fixed render pools read the simulation; no projectile logic runs here. */
export function CombatEffects({ raid }: { raid: Raid }) {
  const tails = useRef<THREE.InstancedMesh>(null), heads = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null), shells = useRef<THREE.InstancedMesh>(null);
  const warnings = useRef<THREE.InstancedMesh>(null), rings = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    for (let index = 0; index < CAPACITY; index++) {
      const bullet = raid.bullets[index];
      for (const [ref, head] of [[tails, false], [heads, true]] as const) {
        if (!ref.current) continue;
        matrix.rotation.set(0, 0, 0);
        if (bullet) {
          const speed = Math.hypot(bullet.vx, bullet.vz);
          const length = head ? .17 : Math.max(.08, Math.min(bullet.trail, bullet.travelled));
          const back = head ? 0 : length / 2;
          matrix.position.set(bullet.x - bullet.vx / speed * back, bullet.enemy ? 1.25 : 1.46, bullet.z - bullet.vz / speed * back);
          matrix.rotation.y = Math.atan2(bullet.vx, bullet.vz);
          matrix.scale.set(head ? .09 : .05, head ? .09 : .05, length);
          ref.current.setColorAt(index, color.set(bullet.enemy ? head ? '#ffbea4' : '#ef927f' : head ? '#fffde6' : '#fbd69c'));
        } else matrix.scale.setScalar(0);
        matrix.updateMatrix(); ref.current.setMatrixAt(index, matrix.matrix);
      }
      if (shells.current) {
        const casing = raid.casings[index];
        if (casing) {
          const t = casing.age;
          matrix.position.set(casing.x, Math.max(.06, 1.4 + t * 2.3 - t * t * 8), casing.z);
          matrix.rotation.set(t * 18, t * 12, t * 21); matrix.scale.set(.075, .075, .16);
        } else matrix.scale.setScalar(0);
        matrix.updateMatrix(); shells.current.setMatrixAt(index, matrix.matrix);
      }
    }
    for (let index = 0; index < CAPACITY * 4; index++) {
      if (!sparks.current) break;
      const impact = raid.impacts[Math.floor(index / 4)], k = index % 4;
      if (impact) {
        const t = (impact.kind === 'kill' ? .3 : .18) - impact.life;
        const angle = k * 2.4 + Math.floor(index / 4);
        matrix.position.set(impact.x + Math.sin(angle) * t * 3.8, 1.3 + t * (k + 1) * 1.7, impact.z + Math.cos(angle) * t * 3.8);
        matrix.rotation.set(t * 5, angle, t * 3); matrix.scale.setScalar(Math.max(.02, impact.life * .42));
        sparks.current.setColorAt(index, color.set(impact.kind === 'wall' || impact.kind === 'armor' ? '#ffe1a6' : '#e89caa'));
      } else matrix.scale.setScalar(0);
      matrix.updateMatrix(); sparks.current.setMatrixAt(index, matrix.matrix);
    }
    for (let index = 0; index < 16; index++) {
      if (warnings.current) {
        const e = raid.enemies[index];
        matrix.rotation.set(0, 0, 0);
        if (e && e.hp > 0 && e.windup > 0) {
          matrix.position.set((e.x + e.targetX) / 2, .08, (e.z + e.targetZ) / 2);
          matrix.rotation.y = Math.atan2(e.targetX - e.x, e.targetZ - e.z);
          matrix.scale.set(.025, .015, Math.hypot(e.x - e.targetX, e.z - e.targetZ));
        } else matrix.scale.setScalar(0);
        matrix.updateMatrix(); warnings.current.setMatrixAt(index, matrix.matrix);
      }
      if (rings.current) {
        const impact = raid.impacts[index];
        matrix.rotation.set(-Math.PI / 2, 0, 0);
        if (impact) {
          matrix.position.set(impact.x, .08, impact.z);
          matrix.scale.setScalar((.3 - impact.life) * 2.2 + .15);
          rings.current.setColorAt(index, color.set(impact.kind === 'wall' || impact.kind === 'armor' ? '#edcd8f' : '#e393a3'));
        } else matrix.scale.setScalar(0);
        matrix.updateMatrix(); rings.current.setMatrixAt(index, matrix.matrix);
      }
    }
    for (const ref of [tails, heads, sparks, shells, warnings, rings]) if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  });
  return <>
    <instancedMesh name="flying-bullet-tails" ref={tails} args={[undefined, undefined, CAPACITY]} frustumCulled={false}>
      <boxGeometry/><meshBasicMaterial toneMapped={false} transparent opacity={.85} depthWrite={false}/>
    </instancedMesh>
    <instancedMesh name="flying-bullet-heads" ref={heads} args={[undefined, undefined, CAPACITY]} frustumCulled={false}>
      <boxGeometry/><meshBasicMaterial toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={sparks} args={[undefined, undefined, CAPACITY * 4]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]}/><meshBasicMaterial toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={shells} args={[undefined, undefined, CAPACITY]} frustumCulled={false}>
      <boxGeometry/><meshBasicMaterial color="#dcba79"/>
    </instancedMesh>
    <instancedMesh ref={warnings} args={[undefined, undefined, 16]} frustumCulled={false}>
      <boxGeometry/><meshBasicMaterial color="#de8891" transparent opacity={.38} depthWrite={false}/>
    </instancedMesh>
    <instancedMesh ref={rings} args={[undefined, undefined, 16]} frustumCulled={false}>
      <ringGeometry args={[.85, 1, 16]}/><meshBasicMaterial transparent opacity={.4} depthWrite={false}/>
    </instancedMesh>
  </>;
}
