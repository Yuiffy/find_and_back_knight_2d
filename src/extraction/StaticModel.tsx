import { useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ArtQuality } from './ArtQuality';

/** Bake only rigid parts inside this animation joint. Moving joints stay outside it. */
export function StaticModel({ children }: { children:ReactNode }) {
  const root=useRef<THREE.Group>(null);
  const quality=useContext(ArtQuality);
  useLayoutEffect(()=>{
    const group=root.current;if(!group)return;
    group.updateWorldMatrix(true,true);
    const inverse=group.matrixWorld.clone().invert(),sources:THREE.Mesh[]=[],batches=new Map<string,{material:THREE.MeshStandardMaterial|THREE.MeshLambertMaterial;geometries:THREE.BufferGeometry[]}>();
    group.traverse(obj=>{
      if(!(obj instanceof THREE.Mesh)||(!(obj.material instanceof THREE.MeshStandardMaterial)&&!(obj.material instanceof THREE.MeshLambertMaterial))||obj instanceof THREE.SkinnedMesh)return;
      let ancestor:THREE.Object3D|null=obj;
      while(ancestor&&ancestor!==group){if(!ancestor.visible)return;ancestor=ancestor.parent;}
      const material=obj.material,key=[material.map?.uuid,material.normalMap?.uuid,material instanceof THREE.MeshStandardMaterial?material.roughness:'matte',material instanceof THREE.MeshStandardMaterial?material.metalness:0,material.side,material.opacity,material.transparent,material.emissive.getHex()].join('|');
      // Primitives such as the halo gems are non-indexed. Normalize topology so
      // the diffuse quality mode can combine them with spheres and cloth.
      const g=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();g.applyMatrix4(inverse.clone().multiply(obj.matrixWorld));
      const colors=new Float32Array(g.attributes.position.count*3),existing=g.attributes.color;
      for(let i=0;i<g.attributes.position.count;i++) {
        colors[i*3]=material.color.r*(existing?existing.getX(i):1);
        colors[i*3+1]=material.color.g*(existing?existing.getY(i):1);
        colors[i*3+2]=material.color.b*(existing?existing.getZ(i):1);
      }
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));
      let batch=batches.get(key);
      if(!batch){const m=material.clone();m.color.set('#ffffff');m.vertexColors=true;batch={material:m,geometries:[]};batches.set(key,batch);}
      batch.geometries.push(g);sources.push(obj);
    });
    const merged:THREE.Mesh[]=[];
    for(const b of batches.values()) {
      const g=mergeGeometries(b.geometries,false)!;b.geometries.forEach(x=>x.dispose());g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,b.material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);merged.push(mesh);
    }
    sources.forEach(m=>m.visible=false);
    return()=>{sources.forEach(m=>m.visible=true);merged.forEach(m=>{group.remove(m);m.geometry.dispose();(m.material as THREE.Material).dispose();});};
  },[quality]);
  return <group ref={root}>{children}</group>;
}
