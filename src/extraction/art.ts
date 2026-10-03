import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ART_VERSION = 'sui-harbor-2';
export const SUI_IDENTITY = {
  name: '岁己 SUI',
  appearance: '白色双马尾 / 红瞳 / 红帽 / 羽翼 / 格纹裙 / 金色光环',
  source: 'assets/fogharbor/sui-reference.png',
};
export type Vec3 = [number, number, number];
export type Surface = 'metal' | 'concrete' | 'wood' | 'rubber' | 'glass' | 'lamp' | 'foliage';

export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function canvasTexture(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function paint(width: number, height: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  return canvasTexture(canvas);
}

/** Static scenery is baked by surface, so detail does not mean one draw call per bolt. */
export class SceneryBuilder {
  geometries = new Map<Surface, THREE.BufferGeometry[]>();
  add(g: THREE.BufferGeometry, at: Vec3, color: string, surface: Surface = 'metal', rotation: Vec3 = [0, 0, 0]) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(matrix);
    const c = new THREE.Color(color),
      colors = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const list = this.geometries.get(surface) ?? [];
    list.push(g);
    this.geometries.set(surface, list);
  }
  box(at: Vec3, size: Vec3, color: string, surface: Surface = 'metal', rotation?: Vec3) {
    this.add(new THREE.BoxGeometry(...size), at, color, surface, rotation);
  }
  cylinder(at: Vec3, radius: number, height: number, color: string, surface: Surface = 'metal', rotation?: Vec3, top = radius) {
    this.add(new THREE.CylinderGeometry(top, radius, height, 12), at, color, surface, rotation);
  }
  beam(a: Vec3, b: Vec3, width: number, color: string, surface: Surface = 'metal') {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(width, width, delta.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    this.add(g, from.add(to).multiplyScalar(.5).toArray() as Vec3, color, surface);
  }
  finish() {
    return Array.from(this.geometries, ([surface, gs]) => {
      const geometry = mergeGeometries(gs, false)!;
      gs.forEach(g => g.dispose());
      geometry.computeBoundingSphere();
      return { surface, geometry };
    });
  }
}

export function makeSurfaceTexture(surface: Surface) {
  const r = seededRandom(surface === 'metal' ? 405 : 901);
  return paint(256, 256, c => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = Math.floor(180 + r() * 65);
      c.fillStyle = `rgba(${v},${v},${v},${surface === 'concrete' ? .52 : .18})`;
      c.fillRect(r() * 256, r() * 256, r() * 3 + 1, surface === 'wood' ? 25 + r() * 60 : 2);
    }
    if (surface === 'metal') {
      for (let i = 0; i < 60; i++) {
        c.fillStyle = `rgba(116,67,34,${.12 + r() * .12})`;
        c.fillRect(r() * 256, r() * 256, 1 + r() * 10, 4 + r() * 28);
      }
      c.strokeStyle = '#7b7e8544'; c.lineWidth = 1;
      for (let i = 0; i < 18; i++) { c.beginPath(); c.moveTo(r()*256,r()*256); c.lineTo(r()*256,r()*256); c.stroke(); }
    }
  });
}

export function makeGroundTexture(source?: CanvasImageSource) {
  const random = seededRandom(33007);
  return paint(2048, 2048, c => {
    const scale = 2048 / 96;
    const rect = (x: number, z: number, w: number, d: number, color: string) => {
      c.fillStyle = color; c.fillRect((x - w/2 + 48)*scale, (z - d/2 + 48)*scale, w*scale, d*scale);
    };
    const line = (x: number, z: number, tx: number, tz: number, color: string, width = .08) => {
      c.strokeStyle = color; c.lineWidth = width*scale; c.beginPath(); c.moveTo((x+48)*scale,(z+48)*scale); c.lineTo((tx+48)*scale,(tz+48)*scale); c.stroke();
    };
    c.fillStyle = '#5d6974'; c.fillRect(0,0,2048,2048);
    if(source)for(let x=0;x<2048;x+=256)for(let y=0;y<2048;y+=256)c.drawImage(source,x,y,256,256);
    rect(-5,0,7.6,96,'#1a2d4099'); rect(0,29,96,7.5,'#1a2d4099'); rect(0,-17,96,6.5,'#1a2d4099');
    rect(25,9,17,24,'#a1b6b14b'); rect(14,-30,33,18,'#5c809729'); rect(-30,-28,26,24,'#3b506d22');
    for(let z=-47;z<48;z+=5.5) line(-5,z,-5,z+2.2,'#d5c195',.13);
    for(let x=-43;x<46;x+=6) line(x,29,x+2.8,29,'#e2c89d',.12);
    for(let x=-44;x<44;x+=8) {
      line(x,33,x,40,'#dad5bbaa'); line(x,40,x+6,40,'#dad5bbaa');
      for(let z=-45;z<47;z+=9) line(x,z,x+7.6,z,'#46576366',.025);
    }
    for(let z=-2;z<21;z+=2) line(17,z,34,z,'#657e813b',.03);
    for(let x=18;x<34;x+=2) line(x,-3,x,21,'#657e813b',.03);
    // Oil washes and tire arcs break up large, empty paving areas.
    for(let i=0;i<140;i++) {
      const x=random()*2048,z=random()*2048,r=10+random()*95;
      const wash=c.createRadialGradient(x,z,0,x,z,r); wash.addColorStop(0,'#20374627'); wash.addColorStop(1,'#20374600');
      c.fillStyle=wash;c.fillRect(x-r,z-r,r*2,r*2);
    }
    c.strokeStyle='#1827352a'; c.lineWidth=5;
    for(let i=0;i<25;i++) {
      c.beginPath();c.ellipse(random()*2048,random()*2048,80+random()*160,150+random()*200,random(),0,Math.PI*.8);c.stroke();
    }
    c.lineWidth=.8; c.strokeStyle='#1d30445e';
    for(let i=0;i<90;i++) {
      let x=random()*2048,z=random()*2048;c.beginPath();c.moveTo(x,z);
      for(let j=0;j<6;j++) {x+=random()*18-7;z+=random()*20-5;c.lineTo(x,z);}c.stroke();
    }
    for(let i=0;i<1600;i++) {
      c.fillStyle=random()>.5?'#d6baa14b':'#19394544';c.fillRect(random()*2048,random()*2048,1+random()*4,1+random()*3);
    }
    // Small worn stencils, rather than oversized district labels.
    c.textAlign='center'; c.font='bold 23px monospace';c.fillStyle='#e8dfc369';
    c.fillText('SOUTH / 07',16*scale,84*scale);
    c.font='bold 17px monospace'; c.fillText('KEEP CLEAR',16*scale,91*scale);
    c.save(); c.translate(73*scale,64*scale); c.fillStyle='#9c655f77'; c.fillRect(-40,-7,80,14);c.fillRect(-7,-40,14,80);c.restore();
    for(let i=0;i<240;i++) { c.fillStyle='#71838b88';c.fillRect(random()*2048,random()*2048,2+random()*15,2); }
  });
}

/** Tapered organic geometry for hair, cloth, feather and other non-box silhouettes. */
export function strand(points: Vec3[], radius: number, flatten = .65) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),
    segments=20, sides=7, positions:number[]=[], uvs:number[]=[], indices:number[]=[];
  for(let i=0;i<=segments;i++) {
    const t=i/segments, center=curve.getPoint(t), tangent=curve.getTangent(t),
      normal=new THREE.Vector3(0,0,1).cross(tangent).normalize(), binormal=tangent.clone().cross(normal).normalize(),
      r=radius*(.3+.7*Math.sin(Math.PI*(t*.9+.08)))*(1-Math.pow(t,5)*.96);
    for(let k=0;k<=sides;k++) {
      const a=k/sides*Math.PI*2, p=center.clone().addScaledVector(normal,Math.cos(a)*r).addScaledVector(binormal,Math.sin(a)*r*flatten);
      positions.push(p.x,p.y,p.z);uvs.push(k/sides,t);
      if(i<segments&&k<sides) {const n=i*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
