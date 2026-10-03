import { useId } from 'react';
import { ITEMS, type ItemId } from './items';

/** Original illustrations of recognizable food, hardware and everyday keepsakes. */
export function LifestyleArtwork({ item, rotated, className = '' }: { item: ItemId; rotated: boolean; className?: string }) {
  const id = useId().replaceAll(':', ''), d = ITEMS[item], w = d.width * 90, h = d.height * 90;
  const cream = `${id}-cream`, foil = `${id}-foil`, metal = `${id}-metal`, pack = `${id}-pack`;
  return <svg className={`ex-item-art ${className}`} viewBox={`0 0 ${rotated ? h : w} ${rotated ? w : h}`} role="img" aria-label={`${d.name}图像`}>
    <defs>
      <linearGradient id={cream} x2="1" y2="1"><stop stopColor="#f4eacf"/><stop offset=".5" stopColor="#a8c484"/><stop offset="1" stopColor="#627f53"/></linearGradient>
      <linearGradient id={foil} x2=".6" y2="1"><stop stopColor="#f1d5a0"/><stop offset=".45" stopColor="#b86549"/><stop offset="1" stopColor="#633535"/></linearGradient>
      <linearGradient id={metal} x2="1" y2="1"><stop stopColor="#d2dfe1"/><stop offset=".42" stopColor="#727f8b"/><stop offset="1" stopColor="#233546"/></linearGradient>
      <linearGradient id={pack} x2="1" y2="1"><stop stopColor="#e9edcd"/><stop offset=".5" stopColor="#bdce9c"/><stop offset="1" stopColor="#677c66"/></linearGradient>
    </defs>
    <g transform={rotated ? `translate(${h} 0) rotate(90)` : undefined} strokeLinejoin="round">
      {item === 'dq_pistachio' && <>
        <path d="m22 74 50-4-6 83-38 7Z" fill="#152d3b" opacity=".6"/>
        <path d="m58 57 15-39q7-5 8 3L70 66" fill="#e9d8bb" stroke="#b89b82" strokeWidth="2"/>
        <ellipse cx="44" cy="75" rx="30" ry="10" fill="#e3e2c1" stroke="#d6ca9e"/>
        <path d="M18 73q0-17 12-21-10-14 8-23 5-4 8-12 14 5 13 16 14 5 11 18 9 8 2 20Z" fill={`url(#${cream})`} stroke="#d8e3b7"/>
        <path d="M30 52q20 7 37-4M35 32q17 7 23 0M24 64q24 9 45-3" fill="none" stroke="#f4edcf" strokeWidth="4"/>
        {[[31,47],[49,39],[54,62],[26,67],[64,54]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="3" ry="2" transform={`rotate(-25 ${x} ${y})`} fill="#577244"/>)}
        <path d="m16 78 57-2-7 71-41 4Z" fill="#b64045" stroke="#e18177"/><path d="m20 83 5 59 10 3-3-64Z" fill="#e27d66" opacity=".6"/>
        <path d="M26 97h37l-1 22-33 2Z" fill="#f3e5c3"/><text x="44" y="114" fontSize="19" textAnchor="middle" fill="#b33b42" fontWeight="bold">DQ</text>
        <path d="m27 131 34-2" stroke="#eac0a0" strokeWidth="2"/><text x="45" y="140" fontSize="7" textAnchor="middle" fill="#fae4be">PISTACHIO</text>
      </>}
      {item === 'beef_jerky' && <>
        <path d="m15 23 140-6 15 11-4 53-143 2Z" fill="#132a38" opacity=".65"/>
        <path d="m12 19 142-6 13 10-6 51-143 4Z" fill={`url(#${foil})`} stroke="#dcac84"/>
        <path d="m19 24 139-6m-136 53 136-4" stroke="#d9b17a" strokeWidth="3"/><path d="m24 26 33-1v40l-31 2Z" fill="#722d32"/>
        <text x="41" y="42" fontSize="11" textAnchor="middle" fill="#ffe4ad" fontWeight="bold">BEEF</text><text x="41" y="55" fontSize="8" textAnchor="middle" fill="#efd3a4">JERKY</text>
        <path d="m70 39 26-12 20 5 30 20-7 11-28-4-24 4-14-8Z" fill="#6f362d" stroke="#d3a06d" strokeWidth="2"/>
        <path d="m84 35 9 17 9-15 12 20 6-13m-39 14 48-6" stroke="#b57749" fill="none" strokeWidth="2"/>
        <path d="m17 20 7 5m125-9 7 4m-137 8 4 30" stroke="#f9dfaa" opacity=".6"/>
      </>}
      {item === 'sicily_lemon' && <>
        <path d="M26 24h35l7 32v100q-20 13-43 0V55Z" fill="#172d38" opacity=".5"/>
        <path d="M29 27h29v14l9 19v88q0 17-23 17t-23-17V60l8-18Z" fill="#ddcc87" stroke="#f2deac"/>
        <path d="M31 27h24v17H31Z" fill="#dce5c2"/><rect x="27" y="13" width="33" height="17" rx="3" fill="#7b996b" stroke="#d1d8a0"/>
        <path d="M23 59h41v86H23Z" fill="#f1e7be"/><path d="M26 65h35v19H26Z" fill="#8aab79"/>
        <text x="43" y="77" textAnchor="middle" fontSize="8" fill="#fff7d9">西西里</text>
        <circle cx="38" cy="109" r="16" fill="#f1c851" stroke="#ad9d4a"/><circle cx="53" cy="121" r="17" fill="#db9c77" stroke="#af805c"/>
        <circle cx="53" cy="121" r="13" fill="#f1c8a1"/><path d="m53 108 0 26m-12-19 24 12m-24 0 24-12" stroke="#d69f7f" strokeWidth="2"/>
        <path d="M29 93q11-18 20-9-11 11-20 9" fill="#6d8c54"/><path d="M28 46v13m-2 91v31" stroke="#fff5d2" strokeWidth="3" opacity=".7"/>
      </>}
      {(item === 'rtx_3050' || item === 'rtx_5070ti') && <>
        <path d={`M16 50 ${w-34} 35 ${w-13} 53v89L29 148Z`} fill="#102a34" opacity=".7"/>
        <path d={`M15 45 ${w-35} 31 ${w-18} 45 ${w-33} 62 15 66Z`} fill={`url(#${metal})`} stroke="#9cabaf"/>
        <path d={`M15 62 ${w-18} 46v85L16 141Z`} fill="#2c3f4f" stroke="#8b9da9" strokeWidth="2"/>
        <path d={`m${w-18} 46 7 7v78l-7 1Z`} fill="#a7b4ae"/><path d={`M${w-12} 68v20m0 8v21`} stroke="#394a59" strokeWidth="3"/>
        {Array.from({length:item==='rtx_3050'?2:3},(_,i)=>{
          const x=49+i*(item==='rtx_3050'?71:82),y=96;
          return <g key={i}><circle cx={x} cy={y} r="29" fill="#162b39" stroke="#7b8e9c" strokeWidth="2"/>
            {Array.from({length:9},(_,k)=><path key={k} d={`M${x+3} ${y-5}q-8-24 9-22l4 12-7 12Z`} fill="#637686" stroke="#92a1a9" strokeWidth=".4" transform={`rotate(${k*40} ${x} ${y})`}/>)}
            <circle cx={x} cy={y} r="8" fill="#afbcba" stroke="#374a5b"/><circle cx={x} cy={y} r="3" fill="#3d5363"/>
          </g>;
        })}
        <path d={`M27 136h${w-73}v9H27Z`} fill="#b6a065"/>
        {Array.from({length:Math.floor((w-73)/8)},(_,i)=><path key={i} d={`M${31+i*8} 137v7`} stroke="#e4d899" strokeWidth="3"/>)}
        <text x={w/2-4} y="57" fontSize={item==='rtx_3050'?13:17} textAnchor="middle" fill={item==='rtx_3050'?'#cbdecf':'#e4cfa7'} fontWeight="bold">{item==='rtx_3050'?'RTX 3050':'RTX 5070 Ti'}</text>
      </>}
      {(item === 'cpu_9800x3d' || item === 'cpu_12400f') && <>
        <rect x="12" y="12" width="68" height="68" rx="5" fill="#9ac1be" fillOpacity=".25" stroke="#c1d9d4"/>
        <path d="M20 22h49v45H20Z" fill="#477468" stroke="#91b7a6"/>
        <path d="m22 18 48 3 4 45-48 3Z" fill={`url(#${metal})`} stroke="#e4e2d0"/>
        <path d="m27 24 37 2 3 33-35 4Z" fill="#c5cecf"/><path d="M32 26h27v5H32Z" fill={item==='cpu_9800x3d'?'#b17c61':'#627fbd'}/>
        <text x="47" y="43" fontSize="8" textAnchor="middle" fill="#263b4c" fontWeight="bold">{item==='cpu_9800x3d'?'RYZEN':'CORE i5'}</text>
        <text x="47" y="54" fontSize="8" textAnchor="middle" fill="#263b4c" fontWeight="bold">{item==='cpu_9800x3d'?'9800X3D':'12400F'}</text>
        <path d="M20 70h50M22 76h6m5 0h6m5 0h6m5 0h6" stroke="#d2b369" strokeWidth="2"/>
      </>}
      {item === 'cat_food' && <>
        <path d="m33 21 105-3 17 133-23 16-104-2Z" fill="#142939" opacity=".65"/>
        <path d="m30 18 105-5 15 132-19 16-108-5Z" fill="#d0bc97" stroke="#ecdbb7"/>
        <path d="m30 18 11 11 80-4 14-12M31 143l101 5" fill="none" stroke="#998260" strokeWidth="4"/>
        <path d="M31 47h101v87H31Z" fill="#bd7063"/><text x="81" y="62" fontSize="13" textAnchor="middle" fill="#fff0d0" fontWeight="bold">CAT FOOD</text>
        <path d="M59 95 52 74l21 10h22l19-11-3 29q-2 28-28 26-31-2-24-33Z" fill="#efe2c0" stroke="#875c54"/>
        <path d="m59 84 3 10m39-10-2 10" stroke="#da9a87" strokeWidth="4"/><ellipse cx="72" cy="102" rx="3" ry="4" fill="#48574c"/><ellipse cx="96" cy="102" rx="3" ry="4" fill="#48574c"/>
        <path d="m81 111 5 0-3 4Zm-16 0-16-3m16 9-14 4m47-10 17-3m-17 9 15 4" stroke="#77654e" fill="#aa796b"/>
        <g fill="#98714c"><ellipse cx="50" cy="139" rx="6" ry="4"/><ellipse cx="63" cy="141" rx="6" ry="4"/><ellipse cx="115" cy="138" rx="6" ry="4"/></g>
      </>}
      {item === 'cat_litter' && <>
        <path d="m26 21 118-4 18 224-25 14-107-7Z" fill="#142a38" opacity=".65"/>
        <path d="m24 18 118-5 15 224-25 13-109-7Z" fill={`url(#${pack})`} stroke="#dce6ba"/>
        <path d="m24 18 15 11 92-4 11-12m-112 207 106 7" fill="none" stroke="#5f8067" strokeWidth="5"/>
        <path d="M34 57h99v70H34Z" fill="#678c79"/><text x="83" y="87" fontSize="24" textAnchor="middle" fill="#f1eaca" fontWeight="bold">TOFU</text><text x="83" y="111" fontSize="16" textAnchor="middle" fill="#d6e2bc">豆腐猫砂</text>
        <path d="m57 150 16-22 12 13 15-14 15 22-6 34H62Z" fill="#e3e6c5" stroke="#7e987f"/><path d="M72 156h3m22 0h3m-16 7 4 5-7 0Z" stroke="#648170" strokeWidth="3"/>
        <path d="M48 203h73" stroke="#9aae8d" strokeWidth="12"/>{Array.from({length:7},(_,i)=><path key={i} d={`m${48+i*10} 199-2 8`} stroke="#e3dfbd" strokeWidth="4"/>)}
        <text x="85" y="227" fontSize="10" textAnchor="middle" fill="#536f59">4 kg · HOME SUPPLY</text>
      </>}
      {(item === 'swim_pass' || item === 'gym_pass') && <>
        <path d="m12 24 62-5 6 49-62 6Z" fill="#162b39" opacity=".7"/>
        <path d="m9 21 63-5 6 49-63 6Z" fill={item==='swim_pass'?'#729bce':'#887aac'} stroke="#d5d8da" strokeWidth="2"/>
        <path d="m14 27 56-4" stroke="#d8e5ef"/><rect x="55" y="49" width="14" height="10" rx="1" fill="#d3d4bc"/>
        {item==='swim_pass'?<><path d="M20 45q6-8 12 0t12 0M20 53q6-8 12 0t12 0" stroke="#d2e4ef" strokeWidth="3" fill="none"/><circle cx="35" cy="36" r="4" fill="#f5dfb4"/></>:<><path d="M26 37v15m19-16v15M20 35v19m30-20v19m-25-10h20" stroke="#e5d3bc" strokeWidth="5"/></>}
        <text x="42" y="65" fontSize="7" textAnchor="middle" fill="#f7f2de">{item==='swim_pass'?'SWIM / 游泳卡':'GYM / 健身卡'}</text>
      </>}
      {item === 'sichuan_hotpot' && <>
        <path d="m14 20 141-6 13 51-143 11Z" fill="#122b38" opacity=".6"/>
        <path d="m11 16 142-5 12 49-143 11Z" fill="#a14d3e" stroke="#dfb17b"/><path d="m21 21 135-5m-130 48 134-9" stroke="#efcda1" strokeWidth="3"/>
        <path d="m35 24 60-2 3 33-60 3Z" fill="#f0d5a3"/><text x="66" y="39" fontSize="12" textAnchor="middle" fill="#7e382f" fontWeight="bold">四川火锅</text><text x="67" y="51" fontSize="9" textAnchor="middle" fill="#9d5a3e">岁己可以</text>
        <path d="m118 26q22-10 16 8l-12 13-11-1q19-11 7-20" fill="#d76e4b" stroke="#f3ac6e"/><path d="m118 26 7-8" stroke="#879466" strokeWidth="4"/>
      </>}
      {item === 'biscuit_note' && <>
        <path d="m18 13 51 4 2 58-56-3Z" fill="#142b39" opacity=".5"/><path d="m15 10 51 4 2 59-54-3Z" fill="#e4d9b6" stroke="#f1e3c6"/>
        <path d="m53 13 13 1 1 15Z" fill="#bdb390"/>
        <circle cx="37" cy="30" r="10" fill="#c89d64" stroke="#967954"/><circle cx="33" cy="27" r="2" fill="#755646"/><circle cx="42" cy="30" r="2" fill="#755646"/><circle cx="36" cy="35" r="2" fill="#755646"/>
        <text x="39" y="48" textAnchor="middle" fontSize="8" fill="#6d7766">收到请回答</text><path d="m22 54 34 2m-30 5 20 2" stroke="#9da48b"/>
      </>}
      {item === 'tarnished_camera' && <>
        <path d="M31 52h98l22 23v68l-26 16-97-11Z" fill="#112a39" opacity=".6"/>
        <path d="m29 46 101-5 15 25-19 11-98-10Z" fill="#bdc2b1" stroke="#e4e5d1"/><path d="m28 67 98 10v76l-98-13Z" fill="#556873" stroke="#aab7b7"/><path d="m126 77 19-11v73l-19 14Z" fill="#263d4f"/>
        <circle cx="76" cy="104" r="27" fill="#1c3246" stroke="#abbac0" strokeWidth="4"/><circle cx="76" cy="104" r="19" fill="#48738b" stroke="#162f42"/><circle cx="76" cy="104" r="11" fill="#182f45"/><path d="m65 95 12-4" stroke="#b0d4de" strokeWidth="3"/>
        <rect x="39" y="76" width="20" height="13" fill="#ece4b9"/><rect x="101" y="85" width="15" height="9" fill="#ca968d"/>
        <path d="M50 133h47v33H50Z" fill="#ddd9bb" stroke="#9ba6a1"/><path d="M57 139h33v17H57Z" fill="#8bb6b8"/><path d="m61 154 9-9 7 6 9-9" fill="#688979"/>
      </>}
    </g>
  </svg>;
}
