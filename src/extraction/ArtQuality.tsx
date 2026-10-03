import { createContext, useContext, type ComponentProps } from 'react';

export const ArtQuality=createContext<'high'|'low'>('high');
export function SurfaceMaterial(props:ComponentProps<'meshStandardMaterial'>) {
  const quality=useContext(ArtQuality);
  if(quality==='high')return <meshStandardMaterial {...props}/>;
  const {color,map,transparent,opacity,vertexColors,side,emissive,emissiveIntensity,depthWrite}=props;
  return <meshLambertMaterial color={color} map={map} transparent={transparent} opacity={opacity} vertexColors={vertexColors} side={side} emissive={emissive} emissiveIntensity={emissiveIntensity} depthWrite={depthWrite}/>;
}
