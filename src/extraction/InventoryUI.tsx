import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowRightLeft, Check, LockKeyhole, Package, RotateCw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ItemArtwork, GearArtwork } from './ItemArtwork';
import { WeaponArtwork } from './WeaponArtwork';
import { ITEMS, RARITIES, type ItemId } from './items';
import { arrange, cellCapacity, fits, itemSize, normalizeInventory, occupiedCells, planTransfer, stashGrid, type GridInventory, type ItemPlacement } from './inventory';
import { WEAPONS, type Profile } from './model';
import type { Raid, InventoryZone } from './simulation';

type Zone = InventoryZone | 'stash';
type Views = Partial<Record<Zone, GridInventory | null>>;
interface Selection { zone: Zone; index: number; item: ItemId; rotated: boolean }
interface Preview { zone: Zone; slot: ItemPlacement; valid: boolean }
interface Drag { selection: Selection; pointerId: number; startX: number; startY: number; x: number; y: number; anchorX: number; anchorY: number; cell: number; active: boolean }
interface ControlsConfig {
  views: Views;
  transfer: (source: Selection, zone: Zone, placement?: ItemPlacement) => boolean;
  canTransfer: (source: Selection, zone: Zone, placement: ItemPlacement) => boolean;
  quick: (source: Selection) => void;
  initial?: Selection;
}
const labels: Record<Zone, string> = { bag: '背包', secure: '安全箱', crate: '容器', stash: '仓库' };
const price = (value: number) => value.toLocaleString('zh-CN');

function useInventoryControls(config: ControlsConfig) {
  const [chosen, setChosen] = useState<Selection | null>(config.initial ?? null);
  const [drag, setDrag] = useState<Drag | null>(null), [preview, setPreview] = useState<Preview | null>(null);
  const dragRef = useRef<Drag | null>(null), suppressClick = useRef(false);
  const selection = chosen && config.views[chosen.zone]?.items[chosen.index] === chosen.item && config.views[chosen.zone]?.known[chosen.index] ? chosen : null;
  const live = useRef({ ...config, selection }); live.current = { ...config, selection };
  const locate = (x: number, y: number, s: Selection, anchorX = 0, anchorY = 0): Preview | null => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-grid-zone]');
    if (!hit) return null;
    for (const node of [hit]) {
      const zone = node.dataset.gridZone as Zone, inventory = live.current.views[zone], rect = node.getBoundingClientRect();
      if (!inventory || x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) continue;
      const cell = (rect.width - 2) / inventory.grid.columns;
      const slot = { x: Math.floor((x - rect.left - 1) / cell) - anchorX, y: Math.floor((y - rect.top - 1) / cell) - anchorY, rotated: s.rotated };
      return { zone, slot, valid: live.current.canTransfer(s, zone, slot) };
    }
    return null;
  };
  const move = (s: Selection, zone: Zone, slot?: ItemPlacement) => {
    const ok = live.current.transfer(s, zone, slot);
    if (ok) setChosen(s.zone === zone ? { ...s, rotated: slot?.rotated ?? s.rotated } : null);
    setPreview(null);
    return ok;
  };
  const rotate = () => {
    const active = dragRef.current?.active ? dragRef.current.selection : live.current.selection;
    if (!active) return;
    const s = { ...active, rotated: !active.rotated }; setChosen(s);
    if (dragRef.current?.active) {
      const d = { ...dragRef.current, selection: s, anchorX: 0, anchorY: 0 };
      dragRef.current = d; setDrag(d); setPreview(locate(d.x, d.y, s));
    } else if (s.zone !== 'crate') {
      const p = live.current.views[s.zone]?.slots[s.index];
      if (p && live.current.canTransfer(s, s.zone, { ...p, rotated: s.rotated })) move(s, s.zone, { ...p, rotated: s.rotated });
    }
  };
  useEffect(() => {
    const pointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const active = d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 7;
      if (!active) return;
      e.preventDefault();
      const next = { ...d, x: e.clientX, y: e.clientY, active };
      dragRef.current = next; setDrag(next); setPreview(locate(next.x, next.y, next.selection, next.anchorX, next.anchorY));
    };
    const pointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      if (d.active) {
        suppressClick.current = true;
        const target = locate(e.clientX, e.clientY, d.selection, d.anchorX, d.anchorY);
        if (target) move(d.selection, target.zone, target.slot);
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
      dragRef.current = null; setDrag(null); setPreview(null);
    };
    const cancel = () => { dragRef.current = null; setDrag(null); setPreview(null); };
    const keyboard = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches('input,select,textarea')) return;
      if (e.code === 'Escape' && dragRef.current?.active) { e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
      if (e.code === 'KeyR' && live.current.selection) {
        e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) rotate();
      }
      const s = live.current.selection;
      if (s && s.zone !== 'crate' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const p = live.current.views[s.zone]?.slots[s.index];
        if (p) move(s, s.zone, { x: p.x + Number(e.code === 'ArrowRight') - Number(e.code === 'ArrowLeft'), y: p.y + Number(e.code === 'ArrowDown') - Number(e.code === 'ArrowUp'), rotated: s.rotated });
      }
    };
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerUp); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel);
    window.addEventListener('keydown', keyboard, true);
    return () => {
      window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', keyboard, true);
    };
  }, []);
  return {
    selection, preview, drag, rotate, clear: () => { setChosen(null); setPreview(null); },
    choose: (s: Selection, quick = false) => {
      if (suppressClick.current) return;
      setChosen(s); if (quick) { live.current.quick(s); setChosen(null); }
    },
    down: (e: ReactPointerEvent<HTMLButtonElement>, s: Selection) => {
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey) return;
      const previous = live.current.selection;
      if (previous?.zone === s.zone && previous.index === s.index) s = { ...s, rotated: previous.rotated };
      const r = e.currentTarget.getBoundingClientRect(), size = itemSize(s.item, s.rotated), cell = r.width / size.width;
      e.currentTarget.setPointerCapture(e.pointerId);
      setChosen(s);
      dragRef.current = { selection: s, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, cell,
        anchorX: Math.min(size.width - 1, Math.floor((e.clientX - r.left) / cell)), anchorY: Math.min(size.height - 1, Math.floor((e.clientY - r.top) / cell)), active: false };
    },
    hover: (e: ReactPointerEvent, zone: Zone) => {
      if (dragRef.current?.active || !selection) return;
      const p = locate(e.clientX, e.clientY, selection);
      if (p?.zone === zone) setPreview(p);
    },
    leave: () => { if (!dragRef.current?.active) setPreview(null); },
    place: (zone: Zone, x: number, y: number) => { if (selection) move(selection, zone, { x, y, rotated: selection.rotated }); },
    transfer: (zone: Zone) => { if (selection) move(selection, zone); },
  };
}
type Controls = ReturnType<typeof useInventoryControls>;

function GridBoard({ zone, inventory, controls, scanning = -1, progress = 0 }: { zone: Zone; inventory: GridInventory; controls: Controls; scanning?: number; progress?: number }) {
  const variables = { '--grid-columns': inventory.grid.columns, '--grid-rows': inventory.grid.rows } as CSSProperties;
  const position = (slot: ItemPlacement, item: ItemId) => {
    const { width, height } = itemSize(item, slot.rotated);
    return { gridColumn: `${slot.x + 1} / span ${width}`, gridRow: `${slot.y + 1} / span ${height}` };
  };
  const selected = controls.selection;
  return <div className="ex-inventory-grid" style={variables} data-grid-zone={zone} role="grid" aria-label={`${labels[zone]}物品格`} aria-rowcount={inventory.grid.rows} aria-colcount={inventory.grid.columns}
    onPointerMove={e => controls.hover(e, zone)} onPointerLeave={controls.leave}>
    {Array.from({ length: cellCapacity(inventory.grid) }, (_, index) => <button key={`cell-${index}`} type="button" className="ex-grid-cell" role="gridcell" tabIndex={-1}
      aria-label={`${labels[zone]}空格 ${index % inventory.grid.columns + 1},${Math.floor(index / inventory.grid.columns) + 1}`}
      style={{ gridColumn: index % inventory.grid.columns + 1, gridRow: Math.floor(index / inventory.grid.columns) + 1 }}
      onClick={() => controls.place(zone, index % inventory.grid.columns, Math.floor(index / inventory.grid.columns))} />)}
    {inventory.items.map((item, index) => {
      const slot = inventory.slots[index]; if (!slot) return null;
      const known = inventory.known[index], size = itemSize(item, slot.rotated);
      const style = { ...position(slot, item), '--item-color': known ? ITEMS[item].color : '#8198aa' } as CSSProperties;
      if (!known) return <div key={`unknown-${index}`} className={`ex-grid-unknown ${index === scanning ? 'is-scanning' : ''}`} style={style} role="gridcell" aria-label={index === scanning ? '识别中' : '未识别物资'}>
        {index === scanning ? <Search size={22} /> : <span>?</span>}
        <small>{index === scanning ? '识别中' : '未识别'}</small>
        {index === scanning && <progress max=".7" value={progress} aria-label="当前物资识别进度" />}
      </div>;
      const s: Selection = { zone, index, item, rotated: slot.rotated }, chosen = selected?.zone === zone && selected.index === index;
      return <button key={`${index}-${item}`} type="button" role="gridcell" className={`ex-grid-item ${chosen ? 'is-selected' : ''} ${controls.drag?.active && controls.drag.selection.zone === zone && controls.drag.selection.index === index ? 'is-dragging' : ''}`}
        style={style} aria-label={`${labels[zone]} ${ITEMS[item].name}，${size.width}×${size.height}格`} aria-selected={chosen} data-item={item} data-item-index={index} data-x={slot.x} data-y={slot.y} data-rotated={slot.rotated} data-width={size.width}
        onPointerDown={e => controls.down(e, s)} onClick={e => controls.choose(s, e.ctrlKey || e.shiftKey || e.metaKey)} onDoubleClick={() => controls.choose(s, true)}>
        <ItemArtwork item={item} rotated={slot.rotated} />
        <span className="ex-grid-item-name">{ITEMS[item].name}</span><span className="ex-grid-item-size">{size.width}×{size.height}</span>
        {item === 'sample' || item === 'core' ? <span className="ex-grid-quest" title="委托物资">◆</span> : null}
      </button>;
    })}
    {controls.preview?.zone === zone && selected && <div className={`ex-grid-preview ${controls.preview.valid ? 'is-valid' : 'is-invalid'}`} style={{ left: `${controls.preview.slot.x / inventory.grid.columns * 100}%`, top: `${controls.preview.slot.y / inventory.grid.rows * 100}%`, width: `${itemSize(selected.item, controls.preview.slot.rotated).width / inventory.grid.columns * 100}%`, height: `${itemSize(selected.item, controls.preview.slot.rotated).height / inventory.grid.rows * 100}%` }} data-valid={controls.preview.valid} aria-hidden="true">
      {controls.preview.valid ? <Check size={18} /> : <XMark />}
    </div>}
  </div>;
}
function XMark() { return <span>×</span>; }
function DragGhost({ controls }: { controls: Controls }) {
  const d = controls.drag; if (!d?.active) return null;
  const { width, height } = itemSize(d.selection.item, d.selection.rotated);
  return <div className="ex-item-ghost" aria-hidden="true" style={{ left: d.x - d.anchorX * d.cell, top: d.y - d.anchorY * d.cell, width: width * d.cell, height: height * d.cell, '--item-color': ITEMS[d.selection.item].color } as CSSProperties}>
    <ItemArtwork item={d.selection.item} rotated={d.selection.rotated}/>
  </div>;
}
function ItemDetails({ selection, children }: { selection: Selection | null; children?: React.ReactNode }) {
  if (!selection) return <div className="ex-inventory-details is-empty"><Package size={25}/><div><strong>选择物资，查看用途与价值</strong><p>双击 / Ctrl 单击快速转移 · 拖动或点选空格摆放 · R 旋转</p></div></div>;
  const d = ITEMS[selection.item], size = itemSize(selection.item, selection.rotated);
  return <div className="ex-inventory-details" style={{ '--item-color': d.color } as CSSProperties} data-selected-item={selection.item}>
    <div className="ex-inspector-art"><ItemArtwork item={selection.item} rotated={selection.rotated}/></div>
    <div className="ex-inspector-copy"><span>{RARITIES[d.rarity]} · {size.width}×{size.height} 格 · {d.weight} kg</span><h3>{d.name}<b>₭ {price(d.value)}</b></h3><p>{d.description}</p></div>
    <div className="ex-inspector-actions">{children}</div>
  </div>;
}

export function FieldInventory({ raid, onChange }: { raid: Raid; onChange: () => void }) {
  const views = raid.inventories, crate = raid.crates.find(c => c.id === raid.search);
  const transfer = (s: Selection, zone: Zone, slot?: ItemPlacement) => {
    if (s.zone === 'stash' || zone === 'stash') return false;
    const ok = raid.transfer(s.zone, s.index, zone, slot, s.rotated); onChange(); return ok;
  };
  const controls = useInventoryControls({ views, transfer,
    canTransfer: (s, zone, slot) => s.zone !== 'stash' && zone !== 'stash' && raid.canTransfer(s.zone, s.index, zone, slot),
    quick: s => { transfer(s, s.zone === 'crate' || s.zone === 'secure' ? 'bag' : crate ? 'crate' : 'secure'); },
  });
  const selected = controls.selection, safe = selected ? fits({ ...views.secure!, items: [], slots: [] }, selected.item, { x: 0, y: 0, rotated: selected.rotated }) : false;
  const lootValue = crate?.loot.reduce((sum, item, index) => sum + (crate.identified[index] ? ITEMS[item].value : 0), 0) ?? 0;
  return <div className={`ex-field-inventory ${crate ? 'has-container' : ''}`}>
    <div className="ex-inventory-heading"><div><span className="ex-kicker">FIELD INVENTORY / 行动仍在继续</span><h1>{crate ? '搜索与收纳' : '战术背包'}</h1></div><span className={`ex-carry-weight ${raid.bagWeight > raid.maxWeight ? 'is-heavy' : ''}`}>{raid.bagWeight.toFixed(1)}<small> / {raid.maxWeight} kg</small>{raid.bagWeight > raid.maxWeight && <b>超重减速</b>}</span></div>
    <div className="ex-inventory-workspace">
      <aside className="ex-inventory-equipment">
        <div className="ex-inventory-operator"><img src={`${import.meta.env.BASE_URL}assets/fogharbor/sui-portrait.webp`} alt="岁己"/><span><strong>岁己 SUI</strong><small>已装备</small></span></div>
        <div className="ex-equipped-weapon"><WeaponArtwork weapon={raid.loadout.weapon}/><span>{WEAPONS[raid.loadout.weapon].name}</span></div>
        <div className="ex-equipped-grid"><div><GearArtwork kind="armor"/><span>{raid.player.armor ? `护甲 ${Math.ceil(raid.player.armor)}` : '未装备护甲'}</span></div><div><GearArtwork kind="medical"/><span>医疗包 ×{raid.meds}</span></div><div><GearArtwork kind="ammo"/><span>备弹 {raid.ammo}</span></div><div><GearArtwork kind="suppressor"/><span>{raid.loadout.suppressor ? '消音器' : '未装消音器'}</span></div></div>
        <p>搜索时无法开火。留意周围，随时关闭面板。</p>
      </aside>
      <section className="ex-personal-inventory">
        <header className="ex-grid-heading"><h2>随身背包 <small>{raid.usedCells}/{raid.capacity} 格</small></h2><button aria-label="整理背包" onClick={() => { raid.organize(); controls.clear(); onChange(); }}><SlidersHorizontal size={14}/><span>整理</span></button></header>
        <div className="ex-field-grid-scroll"><GridBoard zone="bag" inventory={views.bag!} controls={controls}/></div>
        <div className="ex-secure-row"><div><header className="ex-grid-heading"><h2><LockKeyhole size={13}/> 安全箱</h2></header><GridBoard zone="secure" inventory={views.secure!} controls={controls}/></div><p>2×2 格，只保管一件。<br/>失败仍能带回。<br/><small>刷新 / 关闭页面除外</small></p></div>
      </section>
      {crate && views.crate && <section className="ex-container-inventory">
        <header className="ex-grid-heading"><h2>{crate.name}<small>识别 {crate.revealed}/{crate.loot.length}</small></h2><Search size={16}/></header>
        <div className="ex-field-grid-scroll"><GridBoard zone="crate" inventory={views.crate} controls={controls} scanning={crate.identified.indexOf(false)} progress={crate.searched}/></div>
        <div className="ex-container-status"><span>{crate.revealed < crate.loot.length ? '正在逐件搜索…' : crate.loot.length ? '搜索完成' : '容器已清空'}<small>已识别价值 ₭ {price(lootValue)}</small></span><button className="ex-primary" aria-label="收纳已识别物资" disabled={!crate.revealed} onClick={() => { raid.takeAll(); controls.clear(); onChange(); }}><ArrowRightLeft size={14}/> 全部收纳</button></div>
      </section>}
    </div>
    <ItemDetails selection={selected}>
      <button aria-label="旋转选中物资" onClick={controls.rotate}><RotateCw size={14}/><span>旋转</span></button>
      {selected?.zone === 'crate' && <button className="ex-primary" onClick={() => controls.transfer('bag')}>收纳 <ArrowRightLeft size={14}/></button>}
      {selected?.zone === 'bag' && <>
        <button aria-label={`保护${ITEMS[selected.item].name}`} title={safe ? '移入安全箱，原物资放回来源' : '物品体积超过 2×2'} disabled={!safe} onClick={() => controls.transfer('secure')}><LockKeyhole size={14}/><span>{safe ? '保护' : '安全箱放不下'}</span></button>
        {crate && <button onClick={() => controls.transfer('crate')}>放回容器</button>}
        <button aria-label={`丢弃${ITEMS[selected.item].name}`} onClick={() => { raid.drop(selected.index); controls.clear(); onChange(); }}><Trash2 size={14}/><span>丢弃</span></button>
      </>}
      {selected?.zone === 'secure' && <button className="ex-primary" onClick={() => controls.transfer('bag')}>取回背包</button>}
    </ItemDetails>
    <p className="ex-inventory-hint"><span>拖动 / 点选空格摆放 · R 旋转 · 双击 / Ctrl 单击快速转移</span><span>ESC 关闭</span></p>
    <DragGhost controls={controls}/>
  </div>;
}

export function StashInventory({ profile, onCommit, onSell }: { profile: Profile; onCommit: (profile: Profile) => void; onSell: (index: number) => void }) {
  const inventory = normalizeInventory(profile.stash, stashGrid(profile), profile.stashLayout).inventory;
  const transfer = (s: Selection, zone: Zone, slot?: ItemPlacement) => {
    if (zone !== 'stash' || s.zone !== 'stash') return false;
    const plan = planTransfer(inventory, s.index, inventory, slot);
    if (!plan) return false;
    onCommit({ ...profile, stashLayout: plan.target.slots }); return true;
  };
  const initial = inventory.items[0] ? { zone: 'stash' as const, index: 0, item: inventory.items[0], rotated: inventory.slots[0].rotated } : undefined;
  const controls = useInventoryControls({ views: { stash: inventory }, transfer, initial,
    canTransfer: (s, zone, slot) => zone === 'stash' && s.zone === 'stash' && !!planTransfer(inventory, s.index, inventory, slot), quick: () => {} });
  const selected = controls.selection;
  return <div className="ex-stash-inventory">
    <header className="ex-grid-heading"><h2>已带回物资 <small>{occupiedCells(inventory.items)} / {cellCapacity(inventory.grid)} 格</small></h2><button aria-label="整理仓库" onClick={() => { const next = arrange(inventory); if (next) onCommit({ ...profile, stashLayout: next.slots }); controls.clear(); }}><SlidersHorizontal size={14}/> 整理</button></header>
    <div className="ex-stash-grid-scroll"><GridBoard zone="stash" inventory={inventory} controls={controls}/></div>
    <ItemDetails selection={selected}>
      <button aria-label="旋转选中物资" onClick={controls.rotate}><RotateCw size={14}/> 旋转</button>
      <button aria-label="出售" className="ex-primary" onClick={() => { if (selected) { onSell(selected.index); controls.clear(); } }}>出售 · ₭ {selected ? price(ITEMS[selected.item].value) : '0'}</button>
    </ItemDetails>
    <DragGhost controls={controls}/>
  </div>;
}

export function LootSummary({ item }: { item: ItemId }) {
  const d = ITEMS[item];
  return <div className="ex-loot-summary" style={{ '--item-color': d.color } as CSSProperties}><ItemArtwork item={item}/><span><strong>{d.name}</strong><small>{d.width}×{d.height} 格 · ₭ {price(d.value)}</small></span></div>;
}
