import { useId } from 'react';
import { ITEMS, type ItemId } from './items';

/** Original equipment illustrations. SVG bounds follow the item's physical footprint. */
export function ItemArtwork({ item, rotated = false, className = '' }: { item: ItemId; rotated?: boolean; className?: string }) {
  const id = useId().replaceAll(':', ''), metal = `${id}-metal`, edge = `${id}-edge`, glass = `${id}-glass`, gold = `${id}-gold`, cloth = `${id}-cloth`;
  const bounds: Record<ItemId, [number, number]> = { scrap: [180, 90], electronics: [160, 160], medicine: [90, 180], sample: [90, 180], core: [120, 180], gold: [100, 100] };
  const [w, h] = bounds[item];
  return <svg className={`ex-item-art ${className}`} viewBox={`0 0 ${rotated ? h : w} ${rotated ? w : h}`} role="img" aria-label={`${ITEMS[item].name}图像`}>
    <defs>
      <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5dede"/><stop offset=".35" stopColor="#8faaa9"/><stop offset=".65" stopColor="#4d6468"/><stop offset="1" stopColor="#263b46"/></linearGradient>
      <linearGradient id={edge} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9eafb4"/><stop offset=".45" stopColor="#485c69"/><stop offset="1" stopColor="#1c2d38"/></linearGradient>
      <linearGradient id={glass} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#477b87"/><stop offset=".3" stopColor="#b3e5dc"/><stop offset=".65" stopColor="#719d9f"/><stop offset="1" stopColor="#203e52"/></linearGradient>
      <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0b6"/><stop offset=".4" stopColor="#d9ac5c"/><stop offset=".65" stopColor="#997044"/><stop offset="1" stopColor="#e4c275"/></linearGradient>
      <linearGradient id={cloth} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e0d9b9"/><stop offset=".55" stopColor="#bbb48f"/><stop offset="1" stopColor="#787d6f"/></linearGradient>
    </defs>
    <g transform={rotated ? `translate(${h} 0) rotate(90)` : undefined} strokeLinejoin="round">
      {item === 'scrap' && <>
        <path d="M23 31 132 16 160 35 159 68 48 81 22 65Z" fill="#162c38" opacity=".5"/>
        <path d="M23 25 132 12 159 29 49 44Z" fill={`url(#${metal})`} stroke="#bcc9c5"/>
        <path d="M49 44 159 29 157 62 48 76Z" fill={`url(#${edge})`} stroke="#788c91"/>
        <path d="M23 25 49 44 48 76 23 59Z" fill="#5c7376" stroke="#9cadae"/>
        <path d="m31 30 102-12m-64 21 57-7m-63 27 80-11m-85 18 40-5" fill="none" stroke="#d5d8c1" opacity=".45"/>
        <path d="m65 19 12 19v34m30-59 12 19v35" fill="none" stroke="#1e333b" strokeWidth="8"/>
        <path d="m65 19 12 19v34m30-59 12 19v35" fill="none" stroke="#7e8a84" strokeWidth="3"/>
        <circle cx="37" cy="53" r="6" fill="#233e44" stroke="#a6b8b3"/><circle cx="136" cy="46" r="3" fill="#c1c3ac"/>
      </>}
      {item === 'electronics' && <>
        <path d="M27 35 112 17 140 35 122 141 29 136Z" fill="#091f2b" opacity=".65"/>
        <path d="m24 26 94-11 20 18-14 103-98 4Z" fill="#244c43" stroke="#6d9c7c" strokeWidth="2"/>
        <path d="m31 35 76-9 17 16-12 81-74 6Z" fill="#315f50" stroke="#759781"/>
        <g fill="none" stroke="#83ab84" strokeWidth="2"><path d="m42 41 17 1 1 18h18m-40 46h20V94h22m32-55H96v27m-51 70V119h21v-13m26 21v-17h22"/><path d="M92 45v12h23m-15 33h12v26M51 80H37v14"/></g>
        <path d="M59 59h36v40H59Z" fill="#172d30" stroke="#86a493" strokeWidth="2"/><path d="M65 65h23v26H65Z" fill="#364b4b"/>
        {Array.from({ length: 6 }, (_, i) => <g key={i} stroke="#cabd83" strokeWidth="2"><path d={`M${62+i*6} 53v7m0 38v7`}/><path d={`M54 ${64+i*6}h5m36 0h6`}/></g>)}
        <path d="m34 134 74-6-1 10-73 6Z" fill="#b6a36d"/>
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`m${39+i*8} 134-1 7`} stroke="#514e36"/>)}
        <g fill="#c0c6a2"><circle cx="34" cy="32" r="3"/><circle cx="116" cy="37" r="3"/><circle cx="112" cy="119" r="3"/><circle cx="36" cy="121" r="3"/></g>
        <g fill="#172e36" stroke="#728b89"><rect x="38" y="46" width="10" height="17" rx="2"/><rect x="99" y="72" width="9" height="17" rx="2"/></g>
        <path d="M42 113h11v7H42Z" fill="#d9d4b8"/>
      </>}
      {item === 'medicine' && <>
        <path d="M24 18h44l5 144H22Z" fill="#17313b" opacity=".6"/>
        <path d="M19 15 64 12 70 32v121l-46 10-7-17Z" fill={`url(#${cloth})`} stroke="#d7ddc7"/>
        <path d="m64 12 6 20v121l-8-10V28Z" fill="#6c817b"/>
        <path d="M22 34h39v107H22Z" fill="#e3e4cd" opacity=".75"/>
        <path d="M25 38h33m-33 98h33" stroke="#9baa94" strokeWidth="2"/>
        <path d="M37 64h11v14h13v11H48v14H37V89H24V78h13Z" fill="#b76b62"/>
        <rect x="26" y="110" width="29" height="10" rx="1" fill="#7e938b"/>
        <path d="m20 20 38-3m-35 130 29-2m-28-96 23-2" stroke="#f5f0d6" opacity=".7"/>
        <path d="M25 17v12m7-12v12m7-12v12m7-12v12m7-12v12M25 145v10m7-10v10m7-10v10m7-10v10" stroke="#929f8c"/>
      </>}
      {item === 'sample' && <>
        <path d="M27 24h40l5 133-20 13-25-9Z" fill="#152d3b" opacity=".7"/>
        <path d="M22 33q0-10 23-10t23 10v122q-3 13-23 13t-23-13Z" fill={`url(#${edge})`} stroke="#9eabb3"/>
        <ellipse cx="45" cy="32" rx="23" ry="8" fill="#9eb1b8"/><path d="M25 35h40v19H25Z" fill="#344e62"/>
        <path d="M29 56h32v90H29Z" fill={`url(#${glass})`} stroke="#c4e6db"/>
        <path d="M35 84h20v56H35Z" fill="#9ccbba" opacity=".65"/><path d="M33 66v70" stroke="#ddf4e8" strokeWidth="3" opacity=".7"/>
        <path d="M26 116h37v23H26Z" fill="#d4dbc4"/><path d="M32 121h8v11h-8Zm13 0h12v3H45Zm0 6h12v3H45Z" fill="#547184"/>
        <path d="M25 149h40v7H25Z" fill="#29455a"/><path d="M31 26v-8h28v9" fill="#6b8392" stroke="#cad4d5"/>
        <path d="M28 47h34M31 161h27" stroke="#b8cbd2"/>
      </>}
      {item === 'core' && <>
        <path d="M24 30 87 15 108 31v122l-25 15-62-11Z" fill="#142538" opacity=".7"/>
        <path d="M18 25 85 12 103 27v125l-21 15-65-11Z" fill={`url(#${edge})`} stroke="#a8b6c2"/>
        <path d="M18 25 82 31v134l-65-9Z" fill="#354c63" stroke="#a2b7c4"/>
        <path d="m82 31 21-4v125l-21 13Z" fill="#203548"/>
        <path d="M23 37 76 42v28l-53-5Z" fill="#142d3c" stroke="#8baebf"/>
        <path d="m30 53 10-5 6 12 8-10 7 9 9-4" fill="none" stroke="#b9cfed" strokeWidth="2"/>
        <rect x="25" y="77" width="50" height="61" rx="3" fill="#1f3548" stroke="#7b96a8"/>
        <circle cx="50" cy="107" r="20" fill="#253a56" stroke="#b0a1d9" strokeWidth="2"/><circle cx="50" cy="107" r="13" fill="#7580af"/><circle cx="50" cy="107" r="6" fill="#d3c6f2"/>
        <path d="m45 83-7-17m15 17 9-15m-36 45-8 6m48-6 9 8" fill="none" stroke="#a59bc6" strokeWidth="3"/>
        <g stroke="#768791" strokeWidth="3">{Array.from({ length: 8 }, (_, i) => <path key={i} d={`M89 ${45+i*11}h8`}/>)}</g>
        <path d="M29 18v-8h34v13" fill="none" stroke="#a3b5bc" strokeWidth="5"/>
        <g fill="#ceceb0"><circle cx="24" cy="33" r="2"/><circle cx="73" cy="39" r="2"/><circle cx="24" cy="147" r="2"/><circle cx="73" cy="155" r="2"/></g>
        <path d="M32 144h25v6H32Z" fill="#b7bea9"/>
      </>}
      {item === 'gold' && <>
        <path d="M26 8h17l7 24 9-24h16L61 46H39Z" fill="#7d5661" stroke="#c19c97"/><path d="M34 8h6l12 35M65 8h-5L48 43" stroke="#c8b1a2" strokeWidth="3"/>
        <circle cx="51" cy="64" r="29" fill="#283840" opacity=".5"/><circle cx="49" cy="61" r="29" fill={`url(#${gold})`} stroke="#ead297" strokeWidth="2"/>
        <circle cx="49" cy="61" r="23" fill="none" stroke="#80633d"/><circle cx="49" cy="61" r="20" fill="none" stroke="#f3d7a0"/>
        <path d="m49 42 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1Z" fill="#ad8551" stroke="#f3d9a3"/>
        <path d="m27 56 6-10m-5 27 8 7m28-28-6-8m11 25-7 9" stroke="#e6c795" strokeWidth="2"/>
        <path d="m32 43 6-2m15 45 6-2" stroke="#75604a" opacity=".7"/>
      </>}
    </g>
  </svg>;
}

export function GearArtwork({ kind }: { kind: 'armor' | 'medical' | 'ammo' | 'suppressor' }) {
  const id = useId().replaceAll(':', '');
  return <svg className="ex-gear-art" viewBox="0 0 140 100" aria-hidden="true">
    <defs><linearGradient id={`${id}-gear`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#98b0ba"/><stop offset="1" stopColor="#29475a"/></linearGradient></defs>
    {kind === 'armor' && <><path d="M42 11h16l5 15h15l5-15h16l8 31-6 46H34l-5-46Z" fill={`url(#${id}-gear)`} stroke="#b2bdc0"/><path d="M45 34h43v44H45Z" fill="#304551" stroke="#778e94"/><path d="M44 18v23m46-23v23M46 46h40M40 79h57" stroke="#172f3a" strokeWidth="7"/><path d="M50 54h13v21H50Zm17 0h13v21H67Z" fill="#62797b"/><path d="M45 39h43" stroke="#d2b0a1" strokeWidth="3"/></>}
    {kind === 'medical' && <><path d="M33 25h68l9 12v43l-12 7H30l-5-12V36Z" fill="#526b60" stroke="#a4b7a0"/><path d="M35 36h64v43H35Z" fill="#6a8070" stroke="#253e3c"/><path d="M51 25v-8h33v8" fill="none" stroke="#96ad96" strokeWidth="5"/><path d="M61 45h12v12h12v11H73v12H61V68H48V57h13Z" fill="#e0d8bd"/><path d="M32 33h68M37 82h57" stroke="#d1caa5" strokeDasharray="3 2"/></>}
    {kind === 'suppressor' && <><path d="m20 64 83-30 14 13-83 31Z" fill={`url(#${id}-gear)`} stroke="#94a8ad"/><ellipse cx="110" cy="41" rx="9" ry="8" fill="#1c323c" stroke="#8fa6a9"/><ellipse cx="28" cy="72" rx="9" ry="8" fill="#6b858e"/><path d="m37 59 9 13m9-20 9 13m8-19 9 12m8-17 8 11" stroke="#344954" strokeWidth="5"/></>}
    {kind === 'ammo' && <>{[0,1,2,3].map(i=><g key={i} transform={`translate(${36+i*18} ${i%2*7})`}><path d="M0 23 6 8l6 15v58H0Z" fill="#ac925f" stroke="#e0c999"/><path d="M0 23h12v20H0Z" fill="#aa7156"/><path d="M0 74h12M3 45v25" stroke="#edce8c"/></g>)}</>}
  </svg>;
}
