import { SurfaceMaterial } from './ArtQuality';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Raid } from './simulation';
import type { Loadout, WeaponId } from './model';
import { paint, strand, type Vec3 } from './art';
import { StaticModel } from './StaticModel';

function Ball({ at, size, color, metal = 0 }: { at: Vec3; size: Vec3; color: string; metal?: number }) {
  return <mesh position={at} scale={size} castShadow><sphereGeometry args={[1, 20, 14]} /><SurfaceMaterial color={color} roughness={.63} metalness={metal} /></mesh>;
}
function Block({ at, size, color, metal = 0 }: { at: Vec3; size: Vec3; color: string; metal?: number }) {
  return <mesh position={at} castShadow><boxGeometry args={size} /><SurfaceMaterial color={color} roughness={.55} metalness={metal} /></mesh>;
}
function Bone({ a, b, r, color }: { a: Vec3; b: Vec3; r: number; color: string }) {
  const { position, rotation, length } = useMemo(() => {
    const aa = new THREE.Vector3(...a), bb = new THREE.Vector3(...b), d = bb.clone().sub(aa);
    return { position: aa.add(bb).multiplyScalar(.5), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), length: Math.max(.001, d.length() - r * 2) };
  }, [a.join(), b.join(), r]);
  return <mesh position={position} quaternion={rotation} castShadow><capsuleGeometry args={[r, length, 5, 12]} /><SurfaceMaterial color={color} roughness={.58} /></mesh>;
}
function Lock({ points, radius, color = '#e0e3ef', flatten = .55 }: { points: Vec3[]; radius: number; color?: string; flatten?: number }) {
  const g = useMemo(() => strand(points, radius, flatten), [JSON.stringify(points), radius, flatten]);
  useEffect(() => () => g.dispose(), [g]);
  return <mesh geometry={g} castShadow><SurfaceMaterial color={color} roughness={.43} metalness={.08} /></mesh>;
}
function Ribbon({ side, at }: { side: number; at: Vec3 }) {
  return <group position={at}>
    <Ball at={[side * .065, 0, 0]} size={[.15, .075, .035]} color="#b22545" />
    <Ball at={[-side * .065, 0, .005]} size={[.15, .075, .035]} color="#c73451" />
    <Ball at={[0, 0, .035]} size={[.043, .05, .025]} color="#eed6d9" metal={.6} />
    <Lock points={[[0, -.025, 0], [side*.07,-.17,.015], [side*.025,-.3,.02]]} radius={.055} color="#ac2544" />
  </group>;
}

function makeFace() {
  return paint(512, 512, c => {
    c.fillStyle = '#fff0e9'; c.fillRect(0, 0, 512, 512);
    const blush = (x: number) => {
      const gradient = c.createRadialGradient(x, 334, 0, x, 334, 47);
      gradient.addColorStop(0, '#ed879343'); gradient.addColorStop(1, '#ed879300');
      c.fillStyle=gradient;c.fillRect(x-50,284,100,100);
    };
    blush(93);blush(419);
    for(const x of [153,359]) {
      c.fillStyle='#80515c';c.beginPath();c.moveTo(x-59,215);c.quadraticCurveTo(x,187,x+61,218);c.quadraticCurveTo(x+5,178,x-59,215);c.fill();
      c.fillStyle='#fff9fa';c.beginPath();c.moveTo(x-65,252);c.quadraticCurveTo(x,213,x+62,249);c.quadraticCurveTo(x+2,319,x-65,252);c.fill();
      c.save();c.beginPath();c.moveTo(x-65,252);c.quadraticCurveTo(x,213,x+62,249);c.quadraticCurveTo(x+2,319,x-65,252);c.clip();
      const iris=c.createRadialGradient(x+1,251,3,x,266,35);iris.addColorStop(0,'#fff1b3');iris.addColorStop(.24,'#fa8461');iris.addColorStop(.72,'#c63346');iris.addColorStop(1,'#672c48');
      c.fillStyle=iris;c.beginPath();c.ellipse(x,263,32,41,0,0,Math.PI*2);c.fill();
      c.fillStyle='#4f2139';c.beginPath();c.ellipse(x,254,9,26,0,0,Math.PI*2);c.fill();
      c.strokeStyle='#ffd28fa0';c.lineWidth=3;c.beginPath();c.arc(x,266,25,.4,2.7);c.stroke();
      c.fillStyle='#ffffff';c.beginPath();c.ellipse(x-12,239,9,7,-.3,0,Math.PI*2);c.fill();c.beginPath();c.arc(x+13,279,4,0,Math.PI*2);c.fill();c.restore();
      c.strokeStyle='#403347';c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(x-65,252);c.quadraticCurveTo(x,213,x+62,249);c.stroke();
      c.lineWidth=3;c.beginPath();c.moveTo(x+62,249);c.lineTo(x+70,237);c.moveTo(x-65,252);c.lineTo(x-72,240);c.stroke();
    }
    c.strokeStyle='#da9c9a';c.lineWidth=2;c.beginPath();c.moveTo(253,303);c.lineTo(250,318);c.stroke();
    c.strokeStyle='#a66b79';c.lineWidth=3;c.beginPath();c.moveTo(237,366);c.quadraticCurveTo(256,378,275,364);c.stroke();
  });
}
function Face() {
  const texture=useMemo(makeFace,[]), geometry=useMemo(() => {
    const p:number[]=[],uv:number[]=[],idx:number[]=[],n=20;
    for(let y=0;y<=n;y++)for(let x=0;x<=n;x++) {
      const a=(x/n-.5)*1.72,b=(y/n-.5)*1.48;
      p.push(.431*Math.sin(a)*Math.cos(b),.476*Math.sin(b),.382*Math.cos(a)*Math.cos(b));uv.push(x/n,y/n);
      if(x<n&&y<n){const i=y*(n+1)+x;idx.push(i,i+1,i+n+1,i+1,i+n+2,i+n+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>{texture.dispose();geometry.dispose();},[texture,geometry]);
  return <mesh geometry={geometry} position={[0,2.23,.008]}><SurfaceMaterial map={texture} roughness={.8} side={THREE.DoubleSide}/></mesh>;
}

export function Rifle({ weapon='kestrel', suppressor=false, flashRef }: { weapon?: WeaponId; suppressor?: boolean; flashRef?: React.Ref<THREE.Group> }) {
  const length=weapon==='heron'?1.18:weapon==='shrike'?.68:.9;
  return <group>
    <StaticModel key={`${weapon}-${suppressor}`}>
    <Block at={[0,0,.17]} size={[.12,.13,.46]} color="#354655" metal={.55}/>
    <Block at={[0,.045,.48]} size={[.095,.09,.35]} color="#768391" metal={.65}/>
    <Block at={[0,-.11,.21]} size={[.085,.2,.13]} color="#202d3d"/>
    <Block at={[0,-.09,-.005]} size={[.065,.18,.08]} color="#152235"/>
    <Block at={[0,0,-.23]} size={[.105,.145,.24]} color="#5b6670"/>
    <Block at={[0,.105,.08]} size={[.055,.07,.13]} color="#182a3d" metal={.7}/>
    <Block at={[.064,.018,.12]} size={[.015,.025,.13]} color="#d75966"/>
    {[.38,.45,.52,.59].map(z=><Block key={z} at={[0,.072,z]} size={[.105,.012,.024]} color="#bdc3cb" metal={.8}/>)}
    <mesh position={[0,0,.65+length*.18]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.025,.025,length*.48,10]}/><SurfaceMaterial color="#202e3d" metalness={.85} roughness={.35}/></mesh>
    {weapon==='heron'&&<group position={[0,.145,.25]}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.058,.058,.25,12]}/><SurfaceMaterial color="#263344" metalness={.6}/></mesh><Ball at={[0,0,.13]} size={[.045,.045,.018]} color="#82b9d9" metal={.7}/></group>}
    {suppressor&&<mesh position={[0,0,.89+length*.15]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.05,.05,.3,12]}/><SurfaceMaterial color="#283b4a" metalness={.7}/></mesh>}
    </StaticModel>
    <group ref={flashRef} visible={false} position={[0,0,suppressor?1.15:.85+length*.18]}>
      <mesh rotation={[Math.PI/2,0,0]}><coneGeometry args={[.14,.36,7]}/><meshBasicMaterial color="#ffe0a2" transparent opacity={.92}/></mesh>
      <mesh><sphereGeometry args={[.1,8,6]}/><meshBasicMaterial color="#fffbe7"/></mesh>
    </group>
  </group>;
}

function SuiHead({ reducedMotion=false }: { reducedMotion?:boolean }) {
  const halo=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(halo.current)halo.current.rotation.y=reducedMotion?0:Math.sin(clock.elapsedTime*.7)*.05;});
  return <>
    <Ball at={[0,2.23,0]} size={[.428,.473,.38]} color="#ffece3"/>
    <Face/>
    {/* The silver crown, parted bangs and long side locks are sculpted curves. */}
    <mesh position={[0,2.28,-.035]} scale={[1,1.14,.89]} castShadow><sphereGeometry args={[.448,28,18,0,Math.PI*2,0,1.46]}/><SurfaceMaterial color="#dce0ee" roughness={.4}/></mesh>
    {[-1,1].map(side=><group key={side}>
      <Lock points={[[side*.12,2.64,.18],[side*.25,2.54,.33],[side*.27,2.4,.395],[side*.15,2.33,.38]]} radius={.14} color="#f4f2f6"/>
      <Lock points={[[side*.25,2.6,.12],[side*.4,2.39,.15],[side*.42,2.1,.23],[side*.38,1.97,.3]]} radius={.13}/>
      <Lock points={[[side*.4,2.33,-.11],[side*.47,2.1,.035],[side*.41,1.88,.16],[side*.46,1.84,.23]]} radius={.085} color="#d4d8e8"/>
      <Ball at={[side*.41,2.13,.06]} size={[.06,.075,.07]} color="#ffeadf"/>
      <Ball at={[side*.44,2.06,.095]} size={[.035,.045,.03]} color="#c54866" metal={.5}/>
    </group>)}
    <Lock points={[[0,2.64,.18],[-.035,2.54,.38],[.05,2.45,.41],[.045,2.36,.4]]} radius={.145} color="#ecebf4"/>
    <group rotation={[0,0,-.14]} position={[0,2.58,-.045]}>
      <Ball at={[0,.025,0]} size={[.475,.185,.405]} color="#ad2443"/>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,-.07,0]}><torusGeometry args={[.405,.025,6,32]}/><SurfaceMaterial color="#671e39" roughness={.5}/></mesh>
      <Ribbon side={-1} at={[-.32,.07,.245]}/>
      <Lock points={[[-.3,.03,.18],[-.44,.12,.27],[-.51,.2,.28]]} radius={.045} color="#f1e7d1"/>
    </group>
    <group ref={halo} position={[-.2,2.96,-.065]} rotation={[.28,0,-.32]}>
      <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.55,.012,6,64]}/><SurfaceMaterial color="#f5d591" emissive="#b8864d" emissiveIntensity={.25} metalness={.75} roughness={.27}/></mesh>
      {[-1,1].map(s=><mesh key={s} position={[s*.57,0,0]} rotation={[0,0,s*Math.PI/2]}><octahedronGeometry args={[.055,0]}/><SurfaceMaterial color="#ffe9bb" metalness={.65}/></mesh>)}
      {[0,1,2,3,4].map(i=><Ball key={i} at={[-.46+i*.065,0,.28+i*.025]} size={[.025,.013,.06]} color="#dcc08b" metal={.65}/>)}
    </group>
  </>;
}

function Ponytail({ side }: { side: number }) {
  return <group position={[side*.4,2.37,-.18]}>
    <Ribbon side={side} at={[side*.035,0,.025]}/>
    {[0,1,2,3].map(i=><Lock key={i} points={[[side*.03,-.035,-i*.028],[side*(.16+i*.01),-.27,-.08],[side*(.18-i*.025),-.53,-.05],[side*(.3-i*.015),-.72,.02],[side*(.12+i*.03),-.83,.14]]} radius={.1-i*.009} color={i%2?'#c7cedf':'#e8e8f2'}/>)}
  </group>;
}
function Wing({ side }: { side: number }) {
  return <group position={[side*.28,1.48,-.2]} rotation={[0,side*.12,side*-.15]}>
    {[0,1,2,3,4,5].map(i=><Lock key={i} points={[[0,0,0],[side*(.18+i*.03),.16+i*.09,-.05],[side*(.35+i*.055),.31+i*.135,-.09]]} radius={.077-i*.006} color={i>3?'#bec9df':'#edf0f5'} flatten={.4}/>)}
  </group>;
}
function SuiBody({ loadout }: { loadout: Loadout }) {
  const plaid=useMemo(()=>paint(256,256,c=>{
    c.fillStyle='#30313f';c.fillRect(0,0,256,256);
    for(let i=0;i<4;i++){c.fillStyle='#8a7e855a';c.fillRect(i*64,0,22,256);c.fillRect(0,i*64,256,22);c.fillStyle='#b3a2a033';c.fillRect(i*64+28,0,2,256);c.fillRect(0,i*64+28,256,2);}
  }),[]);
  useEffect(()=>()=>plaid.dispose(),[plaid]);
  const skirt=useMemo(()=>{
    const g=new THREE.CylinderGeometry(.28,.47,.38,48,1,true), pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){const s=i%49%2?.95:1.05;pos.setX(i,pos.getX(i)*s);pos.setZ(i,pos.getZ(i)*s);}g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>skirt.dispose(),[skirt]);
  return <>
    <Ball at={[0,1.4,0]} size={[.295,.37,.19]} color="#f5ece6"/>
    <Ball at={[0,1.62,0]} size={[.33,.24,.215]} color="#e9e6ed"/>
    <Bone a={[0,1.72,0]} b={[0,1.93,0]} r={.09} color="#ffe7dd"/>
    <mesh position={[0,1.88,.008]}><cylinderGeometry args={[.108,.12,.095,20]}/><SurfaceMaterial color="#484456"/></mesh>
    <Ribbon side={1} at={[0,1.79,.215]}/>
    {[-1,1].map(s=><group key={s}>
      <Block at={[s*.23,1.72,.08]} size={[.042,.22,.14]} color="#403e4d"/>
      <Ribbon side={s} at={[s*.38,1.57,.085]}/>
    </group>)}
    <mesh geometry={skirt} position={[0,1.02,0]} castShadow><SurfaceMaterial map={plaid} roughness={.92} side={THREE.DoubleSide}/></mesh>
    <mesh position={[0,1.25,0]}><cylinderGeometry args={[.295,.3,.08,32]}/><SurfaceMaterial color="#a22c4b"/></mesh>
    <mesh position={[0,1.25,.306]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.055,.014,6,16]}/><SurfaceMaterial color="#d4c8b9" metalness={.8} roughness={.25}/></mesh>
    <Lock points={[[.29,1.19,.18],[.43,1.03,.04],[.39,.93,-.06],[.29,1.12,-.14]]} radius={.018} color="#c5bfbb"/>
    <Lock points={[[.35,1.13,.16],[.35,.9,.2],[.31,.75,.22]]} radius={.045} color="#ecedf2"/>
    {loadout.armor&&<group>
      <Ball at={[0,1.5,.21]} size={[.27,.225,.065]} color="#555969"/>
      <Block at={[0,1.52,.275]} size={[.27,.026,.012]} color="#c9415e"/>
      {[-1,1].map(s=><Block key={s} at={[s*.115,1.41,.265]} size={[.08,.1,.05]} color="#363e4f"/>)}
    </group>}
    <Ball at={[0,1.4,-.265]} size={[.225,.275,.09]} color="#434d62"/>
    <Block at={[0,1.46,-.355]} size={[.21,.1,.04]} color="#b75065"/>
    <Ball at={[.16,1.34,-.34]} size={[.075,.09,.035]} color="#dfb985"/>
  </>;
}
function SuiLeg({ side }: { side: number }) {
  return <group>
    <Bone a={[0,0,0]} b={[0,-.39,.01]} r={.107} color="#ffe3d7"/>
    <Bone a={[0,-.39,.01]} b={[0,-.7,.01]} r={.081} color="#34364b"/>
    <Ball at={[0,-.77,.065]} size={[.118,.11,.195]} color="#30374c" metal={.12}/>
    <Block at={[0,-.851,.052]} size={[.215,.055,.34]} color="#18243a"/>
    <Block at={[0,-.68,.105]} size={[.18,.035,.035]} color="#c2bbc8" metal={.6}/>
    <Lock points={[[side*.06,-.12,.085],[-side*.06,-.22,.095],[side*.06,-.34,.073]]} radius={.014} color="#6c4c5d"/>
  </group>;
}

export function SuiCharacter({ raid, base = false, loadout, reducedMotion = false, baseRotation=-.18 }: { raid: Raid; base?: boolean; loadout: Loadout; reducedMotion?: boolean; baseRotation?:number }) {
  const root=useRef<THREE.Group>(null), body=useRef<THREE.Group>(null), head=useRef<THREE.Group>(null), left=useRef<THREE.Group>(null), right=useRef<THREE.Group>(null),
    tails=useRef<THREE.Group>(null), wings=useRef<THREE.Group>(null), hands=useRef<THREE.Group>(null), gun=useRef<THREE.Group>(null), flash=useRef<THREE.Group>(null),
    animation=useRef({ t:0, shot:0, mag:raid.mag, hp:raid.player.hp, crouch:0 });
  useFrame((_,dt)=>{
    if(!root.current||!body.current)return;
    const a=animation.current,p=raid.player;
    if(!raid.paused||base)a.t+=Math.min(dt,.05);
    const moving=!base&&p.moving, speed=raid.input.sprint?15:10, stride=moving?Math.sin(a.t*speed):0;
    root.current.position.set(base?0:p.x,0,base?0:p.z); root.current.rotation.y=base?baseRotation:p.angle;
    root.current.visible=base||p.hp>0;
    a.crouch=THREE.MathUtils.damp(a.crouch,!base&&raid.input.crouch?.23:0,12,dt);
    body.current.position.y=(reducedMotion?0:Math.sin(a.t*2.4)*.012+Math.abs(stride)*.04)-a.crouch;
    body.current.rotation.z=p.hurt&&!base?Math.sin(a.t*36)*.045:0;
    if(left.current)left.current.rotation.x=stride*.46;
    if(right.current)right.current.rotation.x=-stride*.46;
    if(head.current)head.current.rotation.z=reducedMotion?0:Math.sin(a.t*.7)*.025;
    if(tails.current){tails.current.rotation.x=reducedMotion?0:Math.sin(a.t*speed-.8)*(moving?.12:.018);tails.current.rotation.z=reducedMotion?0:Math.sin(a.t*1.9)*.018;}
    if(wings.current)wings.current.rotation.x=reducedMotion?0:Math.sin(a.t*2)*.055+(raid.input.sprint&&moving?.12:0);
    if(a.mag>raid.mag){a.shot=.085;} a.mag=raid.mag;
    a.shot=Math.max(0,a.shot-dt);
    if(flash.current)flash.current.visible=!base&&a.shot>0;
    if(gun.current){gun.current.position.z=-a.shot*.9;gun.current.rotation.x=-a.shot*.7;}
    if(hands.current){hands.current.rotation.x=!base&&raid.reload?Math.sin(raid.reload*7)*.18+.28:0;hands.current.rotation.z=!base&&raid.healing?.22:0;}
  });
  return <group ref={root} name="sui-playable-character">
    {!base&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.055,0]}><ringGeometry args={[.55,.6,48]}/><meshBasicMaterial color="#d9eafa" transparent opacity={.65}/></mesh>}
    <group ref={body}>
      <StaticModel key={`body-${loadout.armor}`}><SuiBody loadout={loadout}/></StaticModel>
      <group ref={left} position={[-.165,.89,0]}><StaticModel><SuiLeg side={-1}/></StaticModel></group><group ref={right} position={[.165,.89,0]}><StaticModel><SuiLeg side={1}/></StaticModel></group>
      <group ref={head}><StaticModel><SuiHead reducedMotion={reducedMotion}/></StaticModel></group>
      <group ref={tails}><StaticModel><Ponytail side={-1}/><Ponytail side={1}/></StaticModel></group>
      <group ref={wings}><StaticModel><Wing side={-1}/><Wing side={1}/></StaticModel></group>
      <group ref={hands}>
        <StaticModel>
        <Bone a={[-.37,1.69,0]} b={[-.45,1.39,.22]} r={.115} color="#e8e7f0"/>
        <Bone a={[-.45,1.39,.22]} b={[.05,1.4,.67]} r={.105} color="#f0edf3"/>
        <Bone a={[.37,1.69,0]} b={[.44,1.35,.22]} r={.115} color="#e8e7f0"/>
        <Bone a={[.44,1.35,.22]} b={[.22,1.42,.4]} r={.085} color="#f0edf3"/>
        <Ball at={[.05,1.4,.68]} size={[.075,.073,.082]} color="#ffe5df"/>
        <Ball at={[.22,1.42,.42]} size={[.068,.065,.08]} color="#ffe5df"/>
        </StaticModel>
        <group position={[.19,1.46,.35]}><group ref={gun}><Rifle weapon={loadout.weapon} suppressor={loadout.suppressor} flashRef={flash}/></group></group>
      </group>
    </group>
  </group>;
}

export function BirdCompanion({ raid, base=false, reducedMotion=false }: { raid: Raid; base?: boolean; reducedMotion?: boolean }) {
  const root=useRef<THREE.Group>(null),wings=useRef<THREE.Group>(null),time=useRef(0);
  useFrame((_,dt)=>{if(!root.current)return;if(!raid.paused)time.current+=dt;const t=reducedMotion?0:time.current;
    const x=base?0:raid.player.x,z=base?0:raid.player.z;
    root.current.position.set(x+1.05+Math.sin(t*.8)*.1,2.18+Math.sin(t*2.4)*.1,z-.35);root.current.rotation.y=-.28;
    root.current.visible=base||raid.player.hp>0;if(wings.current)wings.current.rotation.z=Math.sin(t*8)*.2;
  });
  return <group ref={root} name="sui-bird-companion">
    <StaticModel>
    <Ball at={[0,0,0]} size={[.21,.19,.21]} color="#eef1f7"/>
    <Ball at={[.09,.08,.155]} size={[.017,.026,.009]} color="#263044"/><Ball at={[-.09,.08,.155]} size={[.017,.026,.009]} color="#263044"/>
    <mesh position={[0,.025,.225]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[.047,.09,6]}/><SurfaceMaterial color="#f2af68"/></mesh>
    <Lock points={[[0,-.035,-.16],[.03,-.03,-.31],[.04,.04,-.48]]} radius={.075} color="#697888"/>
    </StaticModel>
    <group ref={wings}><StaticModel>{[-1,1].map(s=><Ball key={s} at={[s*.21,.035,0]} size={[.17,.045,.07]} color="#748195"/>)}</StaticModel></group>
  </group>;
}

export function EnemyOperator({ raid, id }: { raid: Raid; id: number }) {
  const root=useRef<THREE.Group>(null),legs=useRef<THREE.Group>(null),flash=useRef<THREE.Group>(null),anim=useRef({t:0,x:0,z:0,windup:0});
  const enemy=raid.enemies.find(e=>e.id===id)!,color=enemy.elite?'#694554':'#3b4d60';
  useFrame((_,dt)=>{
    if(!root.current)return;const a=anim.current;if(!raid.paused)a.t+=dt;
    root.current.position.set(enemy.x,enemy.hp>0?0:.1,enemy.z);root.current.rotation.y=enemy.angle;root.current.rotation.x=enemy.hp>0?0:-Math.PI/2;
    if(legs.current)legs.current.rotation.x=enemy.hp>0&&Math.hypot(enemy.x-a.x,enemy.z-a.z)>.0001?Math.sin(a.t*11)*.18:0;
    if(flash.current)flash.current.visible=a.windup>0&&enemy.windup===0&&enemy.hp>0;a.windup=enemy.windup;a.x=enemy.x;a.z=enemy.z;
  });
  return <group ref={root} name={enemy.elite?'elite-guard':'harbor-guard'}>
    <group ref={legs}><StaticModel>{[-1,1].map(s=><group key={s}><Bone a={[s*.17,.83,0]} b={[s*.18,.2,0]} r={.14} color="#26384d"/><Ball at={[s*.18,.13,.08]} size={[.15,.14,.23]} color="#19283a"/></group>)}</StaticModel></group>
    <StaticModel>
    <Ball at={[0,1.18,0]} size={[.37,.42,.26]} color={color}/>
    <Block at={[0,1.19,.24]} size={[.52,.47,.12]} color="#253345"/>
    {[-1,1].map(s=><Block key={s} at={[s*.14,1.06,.325]} size={[.12,.14,.04]} color="#697182"/>)}
    <Ball at={[0,1.78,0]} size={[.285,.32,.275]} color="#42556a"/>
    <Ball at={[0,1.64,.245]} size={[.14,.105,.075]} color="#1d2b3f"/>
    {[-1,1].map(s=><Ball key={s} at={[s*.117,1.83,.255]} size={[.072,.045,.025]} color={enemy.elite?'#f08b85':'#d9b990'} metal={.45}/>)}
    <Bone a={[.35,1.4,.02]} b={[.22,1.17,.42]} r={.12} color={color}/>
    <Bone a={[-.35,1.4,.02]} b={[-.04,1.2,.6]} r={.12} color={color}/>
    <Block at={[0,1.2,-.3]} size={[.44,.5,.22]} color={enemy.elite?'#603645':'#4b5769'}/>
    {enemy.elite&&<Block at={[0,1.46,-.45]} size={[.5,.08,.08]} color="#d45671"/>}
    </StaticModel>
    <group position={[.2,1.25,.3]}><Rifle weapon={enemy.elite?'heron':'kestrel'} flashRef={flash}/></group>
  </group>;
}
