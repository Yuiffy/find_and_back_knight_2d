import type { WeaponId } from './model';

/** Equipment diagrams share the silhouette and accents of the carried 3D rifles. */
export function WeaponArtwork({ weapon }: { weapon:WeaponId }) {
  const long=weapon==='heron',short=weapon==='shrike';
  return <svg className="ex-weapon-art" viewBox="0 0 320 120" aria-hidden="true">
    <defs><linearGradient id={`steel-${weapon}`} x2="0" y2="1"><stop stopColor="#d5dce1"/><stop offset=".5" stopColor="#7d93a5"/><stop offset="1" stopColor="#41556d"/></linearGradient></defs>
    <path d="M24 57H79L88 65V78H40L24 86Z" fill="#52667c" stroke="#9aa9b6"/>
    <rect x="39" y="62" width="32" height="4" rx="1" fill="#273b51"/>
    <path d="M79 50H160L172 65L158 80H89L79 73Z" fill={`url(#steel-${weapon})`} stroke="#c7d0d6" strokeWidth="1.2"/>
    <path d="M103 79L96 102H108L116 79ZM140 80L145 104H164L158 80Z" fill="#354b62" stroke="#8d9caa"/>
    <path d="M116 81H137L134 91H116Z" fill="none" stroke="#98a8b9" strokeWidth="2"/>
    <rect x="169" y="51" width={short?44:77} height="21" rx="2" fill="#6d8597" stroke="#c2cdd4"/>
    {[0,1,2,3,4,5].filter(i=>!short||i<3).map(i=><path key={i} d={`M${175+i*11} 54v15`} stroke="#2d4259" strokeWidth="3"/>)}
    <rect x={short?214:247} y="57" width={long?59:short?30:33} height="6" rx="1" fill="#a0aeba"/>
    <rect x={short?242:long?300:278} y="55" width="8" height="10" fill="#344960"/>
    <path d="M82 48H172M95 44v4m10-4v4m10-4v4m10-4v4m10-4v4m10-4v4m10-4v4" stroke="#bdc5cb" strokeWidth="2"/>
    {long?<g><rect x="120" y="26" width="60" height="12" rx="5" fill="#3d516a" stroke="#aab7c5"/><path d="M127 38v10m38-10v10" stroke="#8699a9" strokeWidth="3"/><ellipse cx="178" cy="32" rx="3" ry="6" fill="#94c6d4"/></g>:<g><rect x="108" y="35" width="18" height="13" rx="3" fill="#2c4058" stroke="#93a8b8"/><rect x="111" y="38" width="12" height="7" fill="#9ba6a4"/></g>}
    <rect x="91" y="57" width="25" height="3" fill="#d99ca3"/><circle cx="150" cy="59" r="2" fill="#e0d3bb"/>
    <path d="M12 112h296" stroke="#829aad" opacity=".16"/>
  </svg>;
}
