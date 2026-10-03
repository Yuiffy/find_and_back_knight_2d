import { SurfaceMaterial } from './ArtQuality';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { OBSTACLES, EXITS, POWER, RADAR } from './map';
import type { Raid } from './simulation';
import { SceneryBuilder, makeSurfaceTexture, makeGroundTexture, paint, seededRandom, type Vec3 } from './art';

function Batch({ build }: { build: (b: SceneryBuilder) => void }) {
  const steel=useLoader(THREE.TextureLoader,`${import.meta.env.BASE_URL}assets/fogharbor/painted-steel.webp`);
  const batches=useMemo(()=>{const b=new SceneryBuilder();build(b);return b.finish();},[build]);
  const textures=useMemo(()=>({metal:makeSurfaceTexture('metal'),concrete:makeSurfaceTexture('concrete'),wood:makeSurfaceTexture('wood')}),[]);
  useEffect(()=>()=>{batches.forEach(b=>b.geometry.dispose());Object.values(textures).forEach(t=>t.dispose());},[batches,textures]);
  return <group>{batches.map(({surface,geometry})=><mesh key={surface} geometry={geometry} castShadow={surface!=='lamp'} receiveShadow>
    <SurfaceMaterial vertexColors map={surface==='metal'?steel:surface==='concrete'||surface==='wood'?textures[surface]:undefined}
      roughness={surface==='glass'?.24:surface==='metal'?.65:.94} metalness={surface==='metal'?.12:surface==='glass'?.35:0}
      emissive={surface==='lamp'?'#ffdb9c':surface==='glass'?'#467799':'#000000'} emissiveIntensity={surface==='lamp'?2.4:surface==='glass'?.12:0}/>
  </mesh>)}</group>;
}
export function Sign({ text, at, width=4, rotation=[0,0,0], color='#dad5c4', background='#243749' }: { text:string;at:Vec3;width?:number;rotation?:Vec3;color?:string;background?:string }) {
  const texture=useMemo(()=>paint(512,128,c=>{
    c.fillStyle=background;c.fillRect(0,0,512,128);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(6,6,500,116);
    c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='bold 48px "Microsoft YaHei",sans-serif';c.fillText(text,256,67,475);
    const r=seededRandom(31);for(let i=0;i<350;i++){c.fillStyle='#24334644';c.fillRect(r()*512,r()*128,r()*9,2);}
  }),[text,color,background]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={at} rotation={rotation}><planeGeometry args={[width,width/4]}/><SurfaceMaterial map={texture} roughness={.88}/></mesh>;
}
const metal='#566e80', trim='#93a3ae', dark='#27384b', amber='#ba8b57';
function buildContainer(b:SceneryBuilder,o:(typeof OBSTACLES)[number],index:number) {
  const {x,z,w,d,h}=o;
  const colors=['#6f93a0','#ae8a6e','#65949d','#b17c73','#71869a'];
  const color=colors[index%colors.length];
  b.box([x,h/2,z],[w,h,d],color);
  // Vertical ribs, corner castings, door bars and roof weathering.
  for(let i=0;i<=Math.floor(w/.7);i++) {
    const xx=x-w/2+.2+i*(w-.4)/Math.floor(w/.7);
    b.box([xx,h/2,z+d/2+.028],[.045,h-.22,.055],color);
    b.box([xx,h/2,z-d/2-.028],[.045,h-.22,.055],color);
    b.box([xx,h+.04,z],[.055,.07,d-.1],color);
  }
  for(let i=0;i<=Math.floor(d/.7);i++) {
    const zz=z-d/2+.2+i*(d-.4)/Math.floor(d/.7);
    for(const s of [-1,1])b.box([x+s*(w/2+.03),h/2,zz],[.055,h-.22,.045],color);
  }
  for(const sx of [-1,1])for(const sz of [-1,1]) {
    b.box([x+sx*(w/2-.08),h/2,z+sz*(d/2-.08)],[.17,h+.13,.17],trim);
    for(const yy of [.13,h-.13])b.box([x+sx*(w/2-.1),yy,z+sz*(d/2-.1)],[.28,.23,.28],dark);
  }
  for(const yy of [.12,h-.12]) b.box([x,yy,z+d/2+.07],[w-.3,.12,.07],dark);
  for(const sx of [-1,1]) {
    b.box([x+sx*w*.24,h/2,z+d/2+.085],[.055,h-.4,.05],trim);
    b.box([x+sx*w*.24,h*.37,z+d/2+.13],[.25,.045,.05],trim);
  }
  b.box([x,.07,z],[w+.2,.12,d+.2],dark);
  b.box([x,h+.075,z],[w*.16,.015,d*.24],'#778c99','rubber');
  for(const sx of [-1,1]) b.box([x+sx*(w/2-.6),h*.62,z+d/2+.09],[.65,.35,.015],'#d8ba83');
}
function buildWall(b:SceneryBuilder,o:(typeof OBSTACLES)[number],index:number) {
  const {x,z,w,d,h}=o,medical=index>=8&&index<=11,radar=index>=13&&index<=17;
  const color=medical?'#829196':radar?'#65798a':'#7c8589';
  b.box([x,h/2,z],[w,h,d],color,'concrete');
  b.box([x,.16,z],[w+.07,.32,d+.07],'#354b5c','concrete');
  b.box([x,h+.04,z],[w+.12,.12,d+.12],trim);
  const long=w>d,length=long?w:d;
  for(let n=0;n<length;n+=2) {
    const xx=long?x-w/2+n+.7:x,zz=long?z:z-d/2+n+.7;
    b.box([xx,h/2,zz],long?[.05,h,.045]:[.045,h,.05],'#415566','concrete');
    if(medical&&long){b.box([xx,h*.65,z+d/2+.016],[1.28,.68,.025],'#385b77','glass');b.box([xx,h*.65,z+d/2+.04],[.045,.7,.045],trim);}
  }
  if(medical) {
    for(const yy of [.42,2.1])b.box([x,yy,z+d/2+.018],[w-.06,.07,.03],'#e0d7c0');
    b.box([x,h-.14,z+d/2+.1],[w+.13,.16,.35],'#667d88');
    b.box([x,h-.3,z+d/2+.2],[Math.min(w-.1,3),.045,.045],'#e9d49e','lamp');
  }
  if(!medical&&!radar) {
    for(let j=-1;j<=1;j++)b.box([x+j*w*.28,h*.72,z+d/2+.028],[.18,h*.4,.015],'#d6b78b');
    for(let j=0;j<4;j++)b.box([x-w*.4+j*w*.22,.55,z+d/2+.03],[w*.14,.21,.025],'#334c60');
  }
}
function buildCrate(b:SceneryBuilder,o:(typeof OBSTACLES)[number]) {
  const {x,z,w,d,h}=o;
  b.box([x,h/2,z],[w,h,d],'#7a7566','wood');
  for(const y of [.2,h-.18])b.box([x,y,z+d/2+.03],[w+.05,.11,.06],'#4d5963');
  for(const sx of [-1,1])b.box([x+sx*w*.32,h/2,z+d/2+.05],[.14,h,.06],'#b0a38a','wood');
  b.box([x,h+.02,z],[w+.08,.12,d+.08],'#8e8a77','wood');
  for(let n=0;n<6;n++)b.box([x-w/2+(n+.5)*w/6,h+.085,z],[.025,.02,d],'#414e58');
  b.box([x,.05,z],[w+.15,.1,d+.15],dark);
}
function buildTank(b:SceneryBuilder,o:(typeof OBSTACLES)[number]) {
  const {x,z,h}=o;
  b.cylinder([x,h/2,z],2.94,h,'#6d8692');
  for(const y of [.15,h-.1,h*.6])b.cylinder([x,y,z],3.04,.1,trim);
  b.cylinder([x,h+.12,z],.95,.2,metal);
  b.cylinder([x,.1,z],3.25,.2,'#3f5364','concrete');
  for(const sx of [-1,1])b.beam([x+sx*.37,.2,z+3],[x+sx*.37,h+.1,z+3],.045,trim);
  for(let n=0;n<12;n++)b.beam([x-.4,n*h/12,z+3.06],[x+.4,n*h/12,z+3.06],.035,trim);
  b.beam([x+2,h,z],[x+2,h+1.2,z],.14,metal);
  b.beam([x+2,h+1.2,z],[x+3,h+1.2,z],.14,metal);
}
function crane(b:SceneryBuilder,x:number,z:number,size=1) {
  const h=12*size,w=8*size;
  for(const sx of [-1,1]) {
    b.beam([x+sx*w/2,0,z],[x+sx*w/2,h,z],.16*size,amber);
    b.beam([x+sx*w/2,0,z-3*size],[x+sx*w/2,h,z],.12*size,amber);
    b.box([x+sx*w/2,.15,z-1.5*size],[.8*size,.3,4*size],dark);
    for(let n=1;n<5;n++)b.beam([x+sx*w/2,n*h/5,z],[x+sx*w/2,(n+1)*h/5,z-3*size],.05*size,trim);
  }
  b.box([x,h,z],[w+2*size,.6*size,.7*size],amber);
  for(let n=0;n<8;n++)b.beam([x-w/2+n*w/8,h-.25,z],[x-w/2+(n+1)*w/8,h+.25,z],.04,trim);
  b.box([x+2*size,h-.65,z],[1.3*size,1.4*size,1.25*size],'#657a89');
  b.box([x+2*size,h-.6,z+.65*size],[.95*size,.7*size,.025],'#7295a8','glass');
  b.beam([x,h,z],[x,3.2*size,z],.018,'#253647');
  b.box([x,3.1*size,z],[2*size,.12,.65*size],trim);
}
function barrel(b:SceneryBuilder,x:number,z:number,color:string) {
  b.cylinder([x,.55,z],.44,1.1,color);
  for(const y of [.07,.39,.72,1.05])b.cylinder([x,y,z],.456,.035,trim);
  b.box([x,.65,z+.445],[.32,.28,.018],'#d9bc8d');
  b.cylinder([x+.17,1.12,z],.055,.02,dark);
}
function pallet(b:SceneryBuilder,x:number,z:number,w=2) {
  for(const zz of [-.55,0,.55])b.box([x,.12,z+zz],[w,.2,.12],'#7e8073','wood');
  for(let i=0;i<6;i++)b.box([x-w/2+(i+.5)*w/6,.25,z],[w/7,.08,1.35],'#9b9584','wood');
}
function lamp(b:SceneryBuilder,x:number,z:number) {
  b.cylinder([x,3.2,z],.075,6.4,dark);
  b.beam([x,6.4,z],[x+.85,6.4,z],.045,trim);
  b.box([x+.8,6.35,z],[.55,.15,.4],metal);
  b.box([x+.8,6.24,z],[.46,.025,.28],'#efd7ab','lamp');
  b.cylinder([x,.12,z],.2,.24,'#687981','concrete');
}
function fence(b:SceneryBuilder,x:number,z:number,length:number,vertical=false) {
  const p=(offset:number,y:number):Vec3=>vertical?[x,y,z+offset]:[x+offset,y,z];
  for(let n=0;n<=length;n+=3)b.beam(p(n,0),p(n,2.15),.04,trim);
  for(const y of [.25,2.05])b.beam(p(0,y),p(length,y),.025,metal);
  for(let n=0;n<length;n+=.38) {
    b.beam(p(n,.3),p(Math.min(length,n+1.75),2),.007,metal);
    b.beam(p(n,2),p(Math.min(length,n+1.75),.3),.007,metal);
  }
}
function makeHarbor(b:SceneryBuilder) {
  OBSTACLES.forEach((o,index)=>{
    if(o.kind==='container')buildContainer(b,o,index);else if(o.kind==='tank')buildTank(b,o);else if(o.kind==='crate')buildCrate(b,o);else buildWall(b,o,index);
  });
  b.box([0,-.33,0],[96,.6,96],'#495f72','concrete');
  for(const x of [-47,47])b.box([x,.23,0],[.35,.5,94],'#8796a2','concrete');
  b.box([0,.24,-47],[94,.5,.35],'#8796a2','concrete');
  b.box([0,.05,47.5],[96,.15,.85],'#bcc0b1','concrete');
  // Quay fenders, bollards and mooring ropes are outside the playable edge.
  for(let i=0;i<20;i++) {
    const x=-45+i*4.7;
    b.cylinder([x,.38,46.5],.15,.7,metal);b.box([x,.7,46.5],[.58,.16,.25],dark);
    b.cylinder([x,-.3,48.1],.39,.19,dark,'rubber',[Math.PI/2,0,0]);
    if(i%3===0)b.beam([x,.56,46.5],[x+1,-.2,50],.026,'#aa9e7f','wood');
  }
  // The extraction boat sits on the water beside the southern beacon.
  b.box([-33,.1,51],[6.5,.65,2.8],'#30485e');b.box([-33,.49,51],[6,.15,2.55],'#77959e');
  b.box([-31.9,1.09,51],[1.9,1.05,2.15],'#a5b5b9');b.box([-31.9,1.69,51],[2.06,.16,2.28],'#405d72');
  b.box([-31.9,1.21,52.09],[1.48,.45,.035],'#305d80','glass');
  b.box([-30.91,1.25,51],[.025,.44,1.35],'#456e89','glass');
  b.beam([-31.9,1.75,51],[-31.9,2.7,51],.025,trim);b.box([-31.9,2.69,51],[.08,.08,.08],'#e3c8a1','lamp');
  for(const z of [49.85,52.15]){b.beam([-36,.6,z],[-34,.6,z],.022,trim);b.beam([-36,.5,z],[-36,1,z],.022,trim);}
  b.cylinder([-34.1,.67,51],.32,.18,'#d99570','rubber');
  b.beam([-35,.7,50],[-34,.4,47.4],.023,'#b7a680','wood');
  crane(b,-43,25,.8);crane(b,43,29,.85);
  for(const [x,z] of [[-13,25],[-11,-12],[37,17],[33,-18],[-39,43],[30,-43]])lamp(b,x,z);
  [[-42,-40],[-40,-40],[-42,-37],[40,40],[42,40],[42,37],[-42,8]].forEach(([x,z],i)=>barrel(b,x,z,i%2?'#8f6a59':'#467580'));
  [[-42,32],[-42,35],[-32,31],[-27,17],[-27,19],[30,0],[30,2],[8,-34]].forEach(([x,z])=>pallet(b,x,z));
  // Pumps and pipework sit on existing tank footprints, keeping routes clear.
  for(const z of [-26,-29,-32])b.beam([-32,1.1,z],[-22,1.1,z],.12,'#b2b9b7');
  for(const x of [-32,-22]){b.box([x,5.6,-29],[.5,.5,1.4],dark);b.cylinder([x,6,-29],.18,.4,amber);}
  for(const x of [37,41])b.box([x,.07,-32],[.12,.12,29],trim);
  for(let n=0;n<18;n++)b.box([39,.018,-45+n*1.55],[5,.09,.2],'#6b6a63','wood');
  fence(b,-46,-45,42,true);fence(b,46,-45,41,true);fence(b,-43,-46,72);
  // Medical alcove: beds, service counter and instruments fit existing crate.
  b.box([23,1.15,10],[3.1,.15,2.1],'#abb8bd');
  b.box([23,1.27,10],[2.7,.1,1.6],'#d3d2c5','rubber');
  b.box([23,1.45,9.2],[2.5,.25,.16],metal);
  b.box([23.8,1.6,10.1],[.43,.48,.12],dark);b.box([23.8,1.62,10.17],[.33,.28,.025],'#83adb5','glass');
  b.box([32,2.5,-2.3],[1.25,1.05,.35],'#7e939f');
  for(let i=0;i<8;i++)b.box([32,2.16+i*.075,-2.09],[.95,.025,.015],dark);
  // Signal control station and antenna tower.
  b.box([12,2.37,-31],[4.2,.15,4.4],trim);
  for(const x of [10.7,12,13.3]){b.box([x,2.6,-31],[.8,.37,.6],dark);b.box([x,2.64,-30.69],[.6,.22,.025],'#749bad','glass');}
  for(const x of [19,23])for(const z of [-35,-31])b.beam([x,.2,z],[21,7,-33],.05,trim);
  for(const y of [1.2,2.8,4.4,6]) {b.beam([19,y,-35],[23,y,-35],.025,metal);b.beam([19,y,-31],[23,y,-31],.025,metal);}
  b.beam([21,7,-33],[21,9.5,-33],.035,trim);
  b.box([21,9.45,-33],[.11,.13,.11],'#e39785','lamp');
  // Drains, scraps and tufts are flat or on solid scenery: no invisible collision.
  const r=seededRandom(910);for(let i=0;i<110;i++) {
    const x=-45+r()*90,z=-45+r()*90;
    if(i%4===0){b.box([x,.017,z],[.4,.02,.24],'#b5b5a8','wood',[0,r()*3,0]);}
    else if(i%4===1){b.box([x,.025,z],[.23,.025,.23],'#405868','metal',[0,r()*3,0]);}
  }
  for(const z of [-44,-32,-20,-8,4,16,40]){b.box([-8.1,.017,z],[.55,.018,1.4],dark);for(let n=0;n<7;n++)b.box([-8.1,.03,z-.6+n*.2],[.46,.02,.035],trim);}
  for(let i=0;i<100;i++) {
    const x=i%2?-45.5:45.5,z=-44+(i%50)*1.8;
    b.beam([x,.03,z],[x+.13,.25+r()*.25,z+.1],.025,'#68837b','foliage');
    b.beam([x,.03,z],[x-.15,.18+r()*.2,z-.12],.02,'#748475','foliage');
  }
  // Cargo ship, warehouses and cranes outside the navigable island.
  b.box([16,.65,61],[38,2.1,10],'#304d66');b.box([16,1.78,61],[38,.22,10],'#78939e');
  for(let i=0;i<8;i++)for(let j=0;j<2;j++)b.box([-1+i*4.7,3.3+j*2.1,61],[4.45,2,6.5],['#497382','#745969','#596b82'][i%3]);
  b.box([35,4.4,61],[5,7,8],'#acb4b4');b.box([35,7.2,65.02],[4,.8,.03],'#54768c','glass');
  for(const x of [-69,62]) {
    b.box([x,4.5,-2],[17,9,70],'#415b73','concrete');b.box([x,9.2,-2],[19,.4,72],'#34506b');
    for(let z=-32;z<35;z+=6)b.box([x+(x<0?8.6:-8.6),4.6,z],[.035,2.4,3.8],'#8399a3','glass');
  }
  for(const x of [-68,-39,4,44,70])crane(b,x,76,1.25);
}

const waterVertex=`varying vec3 vWorld;varying vec2 vUv; void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const waterFragment=`uniform float time;uniform float opacity;uniform float puddle;varying vec3 vWorld;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){vec2 p=vWorld.xz;float n=noise(p*.63+vec2(time*.035,-time*.08));
float wave=sin(p.x*1.5+p.y*2.6+time*.7+n*4.0)*.5+.5;
float fine=sin(p.y*11.0+p.x*3.7+n*12.0+time*.8)*.5+.5;
vec3 color=mix(vec3(.025,.064,.11),vec3(.13,.22,.31),n*.48+wave*.17);
float glint=pow(fine,18.0)*pow(n,3.0)*.14;
float lightBand=pow(max(0.,sin(p.x*.61+.8)),18.0)*pow(fine,12.0)*.16;
color+=vec3(.45,.57,.69)*glint+vec3(.82,.48,.22)*lightBand;
float edge=1.-smoothstep(.28,.5,length(vUv-.5));
float alpha=opacity*mix(1.,edge,puddle);gl_FragColor=vec4(color,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function Sea({ reducedMotion=false }: { reducedMotion?:boolean }) {
  const shader=useRef<THREE.ShaderMaterial>(null);
  useFrame((_,dt)=>{if(shader.current&&!reducedMotion)shader.current.uniforms.time.value+=dt;});
  return <mesh position={[0,-.38,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[340,340]}/><shaderMaterial ref={shader} vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={{time:{value:0},opacity:{value:1},puddle:{value:0}}}/></mesh>;
}
export function Puddles({ reducedMotion=false }: { reducedMotion?:boolean }) {
  const group=useRef<THREE.Group>(null),uniforms=useMemo(()=>({time:{value:0},opacity:{value:.26},puddle:{value:1}}),[]);
  useFrame((_,dt)=>{if(!reducedMotion)uniforms.time.value+=dt;});
  const spots=[[-35,37,3,1.2],[-24,34,3.2,1.4],[-39,24,1.2,2.6],[-31,23,3,1],[-26,8,2.6,1.2],[-17,5,2.2,1],[-8,-9,2,4],[6,27,3.5,1.3],[22,17,2,1],[28,-7,3,1.2],[18,-26,2.5,1],[-36,-34,2.6,1.6]];
  return <group ref={group}>{spots.map(([x,z,w,d],i)=><mesh key={i} position={[x,.022,z]} rotation={[-Math.PI/2,0,i*.72]} scale={[w,d,1]}><circleGeometry args={[1,20]}/><shaderMaterial vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} transparent depthWrite={false}/></mesh>)}</group>;
}
export function HarborEnvironment({ reducedMotion=false }: { reducedMotion?:boolean }) {
  const paving=useLoader(THREE.TextureLoader,`${import.meta.env.BASE_URL}assets/fogharbor/dock-paving.webp`);
  const ground=useMemo(()=>makeGroundTexture(paving.image),[paving]);
  useEffect(()=>()=>ground.dispose(),[ground]);
  return <group name="weathered-harbor">
    <Sea reducedMotion={reducedMotion}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.006,0]} receiveShadow><planeGeometry args={[96,96]}/><SurfaceMaterial map={ground} roughness={.86} metalness={.08}/></mesh>
    <Batch build={makeHarbor}/><Puddles reducedMotion={reducedMotion}/>
    <Sign text="南岸码头 / 07" at={[-23,2.13,30.065]} width={4.8}/>
    <Sign text="雨蚀医疗站" at={[25,2.66,21.63]} width={5.6} color="#e1d7c9" background="#824c54"/>
    <Sign text="SIGNAL / 07" at={[14,1.78,-39.275]} width={6}/>
    <Sign text="FREIGHT  /  02" at={[-35,1.95,-6.965]} width={4}/>
    <Sign text="严禁通行" at={[0,1,-46.8]} width={3.6} color="#dfb987"/>
  </group>;
}

function makeStage(b:SceneryBuilder) {
  // Equipment bench and a mooring bollard bracket the actual character.
  b.box([2.3,.72,-1.3],[1.7,1.4,1.1],'#405565');b.box([2.3,1.43,-1.3],[1.78,.12,1.18],'#526d80');
  for(const x of [1.7,2.9]) b.box([x,.72,-.735],[.08,1.2,.025],trim);
  b.box([2.3,1.03,-.72],[.47,.13,.035],'#c5bea8');
  pallet(b,3.6,-2);barrel(b,-2.6,-2.2,'#547986');
  b.cylinder([-1.5,.35,1.7],.18,.65,metal);b.box([-1.5,.63,1.7],[.65,.17,.25],dark);
  for(let n=0;n<6;n++){const a=n/6*Math.PI*2,aa=(n+1)/6*Math.PI*2;b.beam([-1.5+Math.cos(a)*.38,.035,1.7+Math.sin(a)*.38],[-1.5+Math.cos(aa)*.38,.035,1.7+Math.sin(aa)*.38],.018,'#b8ab8f','wood');}
  b.box([-3,.06,-2.5],[1.6,.1,.25],'#314257');
}
export function BaseStage() {
  const paving=useLoader(THREE.TextureLoader,`${import.meta.env.BASE_URL}assets/fogharbor/dock-paving.webp`);
  const ground=useMemo(()=>{const g=makeGroundTexture(paving.image);g.repeat.set(.12,.13);g.offset.set(.24,.67);return g;},[paving]);
  const fade=useMemo(()=>paint(256,256,c=>{const g=c.createRadialGradient(128,128,34,128,128,128);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#b0b0b0');g.addColorStop(1,'#000000');c.fillStyle=g;c.fillRect(0,0,256,256);}),[]);
  useEffect(()=>()=>{ground.dispose();fade.dispose();},[ground,fade]);
  return <group name="sui-equipment-stage">
    <mesh position={[0,.009,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[8,6]}/><SurfaceMaterial map={ground} alphaMap={fade} roughness={.68} metalness={.12} transparent opacity={.65} depthWrite={false}/></mesh>
    <Batch build={makeStage}/>
    <Sign text="SUI / 归航频段 07" at={[2.3,.65,-.739]} width={1.2}/>
  </group>;
}

export function HarborMarkers({raid}:{raid:Raid}) {
  const batched=useMemo(()=>{
    const build=(b:SceneryBuilder)=>{
      raid.crates.filter(c=>c.loot.length).forEach(c=>{
        const special=c.id==='signal-core',medical=c.name.includes('医疗')||c.name.includes('样本');
        b.box([c.x,.32,c.z],[1.2,.64,.88],special?'#856d5d':medical?'#748c99':'#456a7c');
        b.box([c.x,.68,c.z],[1.26,.11,.94],special?'#c7a97c':'#869b9f');
        for(const s of [-1,1])b.box([c.x+s*.38,.33,c.z+.465],[.1,.58,.06],'#d7c8a2');
        b.box([c.x,.42,c.z+.49],[.19,.12,.03],'#e4d7b3');
        b.box([c.x,.756,c.z],[.49,.012,.06],special?'#ffd596':'#b2e6e4','lamp');
        if(medical){b.box([c.x,.763,c.z],[.08,.02,.4],'#e3b6b4');b.box([c.x,.766,c.z],[.4,.02,.08],'#e3b6b4');}
      });
      if(raid.lost&&!raid.recovered){b.box([raid.lost.x,.2,raid.lost.z],[.9,.4,.65],'#74586a');b.box([raid.lost.x,.415,raid.lost.z],[.5,.018,.07],'#e4a7aa','lamp');}
      b.box([POWER.x,.8,POWER.z],[1.25,1.6,.75],'#687d8c');b.box([POWER.x,.85,POWER.z+.39],[.8,.9,.03],dark);
      b.box([POWER.x,.96,POWER.z+.43],[.6,.32,.024],raid.powered?'#8ed9cf':'#eac48e','lamp');
      for(const x of [-.24,.24])b.box([POWER.x+x,.56,POWER.z+.43],[.1,.12,.045],trim);
      b.box([POWER.x,1.67,POWER.z],[1.38,.1,.9],metal);
      b.cylinder([RADAR.x,3.9,RADAR.z],.1,7.8,trim);
    };return build;
    // React's existing UI tick makes searched loot and power changes visible.
  },[raid.crates.map(c=>`${c.id}:${c.loot.length}`).join(),raid.powered,raid.recovered,raid]);
  const dish=useRef<THREE.Group>(null);
  useFrame((_,dt)=>{if(dish.current&&raid.radar&&!raid.paused)dish.current.rotation.y+=dt*.3;});
  return <group>
    <Batch build={batched}/>
    <group ref={dish} position={[RADAR.x,7,RADAR.z]}>
      <mesh rotation={[.55,0,0]} castShadow><sphereGeometry args={[2.15,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2]}/><SurfaceMaterial color="#a8b5bd" side={THREE.DoubleSide} metalness={.55} roughness={.47}/></mesh>
      <mesh rotation={[Math.PI/2+.55,0,0]}><torusGeometry args={[2.15,.03,6,48]}/><SurfaceMaterial color="#536e85"/></mesh>
    </group>
    {raid.crates.filter(c=>c.loot.length).map(c=><mesh key={c.id} position={[c.x,.05,c.z]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.83,.9,32]}/><meshBasicMaterial color={c.id==='signal-core'?'#eabf8d':'#a1d4dc'} transparent opacity={.33}/></mesh>)}
    {EXITS.map(e=><group key={e.id} position={[e.x,0,e.z]}>
      <mesh position={[0,.045,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.8,2.92,64]}/><meshBasicMaterial color={!e.requiresPower||raid.powered?'#9ee5c7':'#eac594'} transparent opacity={.78}/></mesh>
      <mesh position={[0,.032,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.8,64]}/><meshBasicMaterial color={!e.requiresPower||raid.powered?'#74baa6':'#af8965'} transparent opacity={.06} depthWrite={false}/></mesh>
      <mesh position={[2.5,1.2,0]}><cylinderGeometry args={[.05,.05,2.4,8]}/><SurfaceMaterial color="#8b9eaf"/></mesh>
      <mesh position={[2.5,2.46,0]}><sphereGeometry args={[.14,12,8]}/><meshBasicMaterial color={!e.requiresPower||raid.powered?'#acf4cb':'#e6b27d'}/></mesh>
      <Sign text={e.requiresPower&&!raid.powered?'等待供电':'撤离 / EXTRACT'} at={[2.5,1.85,.06]} width={1.5} color={!e.requiresPower||raid.powered?'#a8d6c3':'#e1b68b'}/>
    </group>)}
  </group>;
}

export function Atmosphere({ raid, base=false, reducedMotion=false, high=true }: { raid:Raid;base?:boolean;reducedMotion?:boolean;high?:boolean }) {
  const points=useRef<THREE.Points>(null),time=useRef(0);
  const geometry=useMemo(()=>{
    const r=seededRandom(707),p=new Float32Array(140*3);
    for(let i=0;i<140;i++){p[i*3]=(r()-.5)*60;p[i*3+1]=r()*8+.3;p[i*3+2]=(r()-.5)*48;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame((_,dt)=>{
    if(!points.current)return;points.current.position.set(base?0:raid.player.x,0,base?0:raid.player.z);
    if(!reducedMotion&&!raid.paused){time.current+=dt;points.current.rotation.y=Math.sin(time.current*.05)*.015;}
  });
  return high?<points ref={points} geometry={geometry}><pointsMaterial color="#bed3e7" size={base?.015:.025} transparent opacity={reducedMotion?0:.32} depthWrite={false} sizeAttenuation/></points>:null;
}

/** Localized pools of practical light; emissive fixtures remain visible on low quality. */
export function PracticalLights({ raid, base=false, high=true }: { raid:Raid;base?:boolean;high?:boolean }) {
  const {size}=useThree();
  if(base)return <><pointLight position={[3,3,1]} color="#ffc69e" intensity={14} distance={9} decay={2}/><pointLight position={[-2,2.8,1]} color="#92b4ed" intensity={5} distance={8} decay={2}/></>;
  if(!high||size.width<600)return null;
  const lamps=[[-13,25],[-11,-12],[37,17],[33,-18]];
  return <>{lamps.filter(([x,z])=>Math.hypot(x-raid.player.x,z-raid.player.z)<32).map(([x,z])=><pointLight key={`${x}:${z}`} position={[x+.8,5.8,z]} color="#edc392" intensity={18} distance={13} decay={2}/>)}</>;
}
