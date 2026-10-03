import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Raid } from './simulation';
import type { Loadout } from './model';
import { SuiCharacter, BirdCompanion, EnemyOperator } from './Characters';
import { HarborEnvironment, HarborMarkers, BaseStage, Atmosphere, PracticalLights } from './Harbor';
import { ART_VERSION, SUI_IDENTITY } from './art';
import { ArtQuality } from './ArtQuality';
import { CombatEffects } from './CombatEffects';

export interface ViewBridge {
  pointer: { x: number; y: number; active: boolean };
  project: (x: number, z: number, height?: number) => { x: number; y: number };
  visual?: { version:string; protagonist:typeof SUI_IDENTITY; drawCalls:number; triangles:number; fps:number; quality:string; reducedMotion:boolean; scene:string };
}
function Reticle({raid,bridge}:{raid:Raid;bridge:ViewBridge}) {
  const group=useRef<THREE.Group>(null),hit=useRef<THREE.Group>(null);
  useFrame(()=>{
    if(!group.current)return;
    group.current.visible=!raid.paused&&!raid.search&&bridge.pointer.active;
    group.current.position.set(raid.input.aimX,1,raid.input.aimZ);group.current.scale.setScalar((raid.input.ads?.65:1)+raid.recoil*.3);
    if(hit.current){
      hit.current.visible=!!raid.hitFeedback;
      for(const m of hit.current.children)( (m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(raid.hitFeedback?.kind==='kill'?'#f29aa6':raid.hitFeedback?.kind==='armor'?'#94cef5':'#fff1cc');
      hit.current.scale.setScalar(raid.hitFeedback?.kind==='kill'?1.5:1);
    }
  });
  return <group ref={group}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.22,.245,32]}/><meshBasicMaterial color="#fff2cf" depthTest={false} transparent opacity={.85}/></mesh>
    <group ref={hit}>{[-1,1].map(x=>[-1,1].map(z=><mesh key={`${x}-${z}`} position={[x*.14,.035,z*.14]} rotation={[0,x*z*Math.PI/4,0]}><boxGeometry args={[.04,.04,.17]}/><meshBasicMaterial depthTest={false} toneMapped={false}/></mesh>))}</group>
  </group>;
}
function CameraRig({raid,base,bridge,reducedMotion}:{raid:Raid;base:boolean;bridge:ViewBridge;reducedMotion:boolean}) {
  const {camera,size,set}=useThree(),baseCamera=useRef(camera),raidCamera=useMemo(()=>new THREE.PerspectiveCamera(47,1,.1,250),[]),ray=useMemo(()=>new THREE.Raycaster(),[]),plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,1,0),-1),[]),point=useMemo(()=>new THREE.Vector3(),[]);
  useEffect(()=>{set({camera:base?baseCamera.current:raidCamera});},[base,set,raidCamera]);
  useEffect(()=>{
    bridge.project=(x,z,height=1)=>{const p=new THREE.Vector3(x,height,z).project(camera);return{x:(p.x+1)/2*size.width,y:(-p.y+1)/2*size.height};};
  },[camera,size,bridge]);
  useFrame(()=>{
    const ratio=size.width/size.height;
    if(base) {
      const portrait=size.width<600,short=size.height<500;
      const viewHeight=portrait?7.1:short?5.4:5.3,viewWidth=viewHeight*ratio;
      const centerX=-viewWidth*(portrait?.24:.22),centerY=portrait?1.55:1.42;
      camera.position.set(centerX,centerY+2.2,9);camera.lookAt(centerX,centerY,0);
      if(camera instanceof THREE.OrthographicCamera)camera.zoom=size.height/viewHeight;
    } else {
      const p=raid.player;
      const age=raid.elapsed-raid.lastShot,kick=reducedMotion?0:Math.exp(-age*32)*Math.sin(age*65)*raid.recoil*.09;
      camera.position.set(p.x+Math.cos(p.angle)*kick,ratio<1?43:24,p.z+(ratio<1?42:23)+Math.sin(p.angle)*kick);camera.lookAt(p.x,0,p.z);
      if(camera instanceof THREE.PerspectiveCamera)camera.aspect=ratio;
    }
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    if(!base&&bridge.pointer.active){ray.setFromCamera(new THREE.Vector2(bridge.pointer.x/size.width*2-1,-bridge.pointer.y/size.height*2+1),camera);if(ray.ray.intersectPlane(plane,point)){raid.input.aimX=point.x;raid.input.aimZ=point.z;}}
  },-1);
  return null;
}
function Sun({raid,base,high}:{raid:Raid;base:boolean;high:boolean}) {
  const light=useRef<THREE.DirectionalLight>(null);
  useFrame(()=>{if(!light.current)return;const x=base?0:raid.player.x,z=base?0:raid.player.z;
    light.current.position.set(x-12,base?9:34,z+12);light.current.target.position.set(x,0,z);light.current.target.updateMatrixWorld();
  });
  return <directionalLight ref={light} intensity={base?2.5:2.45} color="#e5d2bb" castShadow={high}
    shadow-mapSize={[1024,1024]} shadow-camera-left={base?-9:-30} shadow-camera-right={base?9:30}
    shadow-camera-top={base?9:34} shadow-camera-bottom={base?-9:-34} shadow-camera-far={100} shadow-bias={-.00025} shadow-normalBias={.025}/>;
}
function CinematicLight() {
  const {gl,scene,camera,size}=useThree();
  const composer=useMemo(()=>{
    const c=new EffectComposer(gl);c.addPass(new RenderPass(scene,camera));
    const glow=new ShaderPass({
      uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1440,900)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 resolution;varying vec2 vUv;
        vec3 bright(vec2 offset){vec3 c=texture2D(tDiffuse,vUv+offset).rgb;return max(vec3(0.),c-1.3);}
        void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 s=2.5/resolution;
          vec3 glow=(bright(vec2(s.x,0.))+bright(vec2(-s.x,0.))+bright(vec2(0.,s.y))+bright(vec2(0.,-s.y)))*.038;
          gl_FragColor=vec4(c.rgb+glow,c.a);}`,
    });c.addPass(glow);c.addPass(new OutputPass());return c;
  },[gl,scene,camera]);
  useEffect(()=>{composer.setPixelRatio(gl.getPixelRatio());composer.setSize(size.width,size.height);(composer.passes[1] as ShaderPass).uniforms.resolution.value.set(size.width,size.height);},[composer,gl,size]);
  useEffect(()=>()=>{composer.passes.forEach(p=>p.dispose());composer.dispose();},[composer]);
  useFrame((_,dt)=>composer.render(dt),1);
  return null;
}
function Evidence({bridge,base,quality,reducedMotion}:{bridge:ViewBridge;base:boolean;quality:string;reducedMotion:boolean}) {
  const {gl}=useThree(),frames=useRef({t:0,n:0,fps:60});
  useFrame((_,dt)=>{
    const f=frames.current;f.t+=dt;f.n++;if(f.t>.75){f.fps=Math.round(f.n/f.t);f.t=0;f.n=0;}
    bridge.visual={version:ART_VERSION,protagonist:SUI_IDENTITY,drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,fps:f.fps,quality,reducedMotion,scene:base?'sui-equipment-stage':'weathered-harbor'};
    gl.info.reset();
  });return null;
}
class RenderBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="ex-gpu-error">3D 场景启动失败。请开启浏览器硬件加速后刷新。<a href="?mode=lantern">进入 2D 借光归来</a></div>:this.props.children;}
}
function Scene({raid,base,quality,bridge,loadout,reducedMotion,baseRotation}:{raid:Raid;base:boolean;quality:'high'|'low';bridge:ViewBridge;loadout:Loadout;reducedMotion:boolean;baseRotation:number}) {
  const {size}=useThree(),high=quality==='high';
  return <ArtQuality.Provider value={quality}>
    {!base&&<><color attach="background" args={['#73899e']}/><fogExp2 attach="fog" args={['#8ca5b8',.009]}/></>}
    <ambientLight intensity={base?.62:.52} color="#c3d4eb"/>
    <hemisphereLight args={['#c4dcf4','#394659',base?1.55:1.7]}/>
    <Sun raid={raid} base={base} high={high}/><PracticalLights raid={raid} base={base} high={high}/>
    {base?<BaseStage/>:<><HarborEnvironment reducedMotion={reducedMotion}/><HarborMarkers raid={raid}/></>}
    <SuiCharacter raid={raid} base={base} loadout={loadout} reducedMotion={reducedMotion} baseRotation={baseRotation}/><BirdCompanion raid={raid} base={base} reducedMotion={reducedMotion}/>
    {!base&&raid.enemies.map(e=><EnemyOperator key={e.id} raid={raid} id={e.id}/>)}
    {!base&&<><CombatEffects raid={raid}/><Reticle raid={raid} bridge={bridge}/></>}
    <Atmosphere raid={raid} base={base} reducedMotion={reducedMotion} high={high}/>
    <CameraRig raid={raid} base={base} bridge={bridge} reducedMotion={reducedMotion}/><Evidence bridge={bridge} base={base} quality={quality} reducedMotion={reducedMotion}/>
    {high&&!base&&size.width>900&&<CinematicLight/>}
  </ArtQuality.Provider>;
}
export default function World({raid,base,quality,bridge,loadout,reducedMotion=false,baseRotation=-.18}:{raid:Raid;base:boolean;quality:'high'|'low';bridge:ViewBridge;loadout?:Loadout;reducedMotion?:boolean;baseRotation?:number}) {
  return <RenderBoundary><Canvas orthographic shadows={quality==='high'} dpr={[1,quality==='high'?1.5:1]} camera={{position:[0,34,30],near:.1,far:250,zoom:25}}
    gl={{alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.05}}
    onCreated={({gl})=>{gl.setClearColor(0,0);gl.shadowMap.type=THREE.PCFShadowMap;gl.info.autoReset=false;}}>
    <Scene raid={raid} base={base} quality={quality} bridge={bridge} loadout={loadout??raid.loadout} reducedMotion={reducedMotion} baseRotation={baseRotation}/>
  </Canvas></RenderBoundary>;
}
