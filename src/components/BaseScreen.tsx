import { useEffect, useRef, useState, type DragEvent } from 'react';
import { countItem, GEAR_SLOTS, getArmorMaximum, ITEMS, SLOT_NAMES } from '../game/items';
import { occupiedGridCells } from '../game/inventory';
import type { GearSlot, PlayerProfile } from '../types/game';
import {
  InventoryGrid,
  readInventoryDrag,
  writeInventoryDrag,
  type InventoryDragPayload,
  type InventorySource,
} from './InventoryGrid';

type BaseTab = 'storage' | 'workshop' | 'missions';

interface BaseScreenProps {
  profile: PlayerProfile;
  objective: string;
  notice: string | null;
  onBeginRaid: (entryId: 'foyer' | 'lift') => void;
  onMoveItem: (payload: InventoryDragPayload, target: Exclude<InventorySource, 'loadout'>, x: number, y: number) => void;
  onEquipItem: (payload: InventoryDragPayload, slot: GearSlot) => void;
  onRepair: () => void;
  onUpgradeWarehouse: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onPlayEnding: () => void;
}

export function BaseScreen({
  profile,
  objective,
  notice,
  onBeginRaid,
  onMoveItem,
  onEquipItem,
  onRepair,
  onUpgradeWarehouse,
  onExport,
  onImport,
  onReset,
  onPlayEnding,
}: BaseScreenProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const firstEntryRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<BaseTab>('storage');
  const [entryOpen, setEntryOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryDragPayload | null>(null);
  const armorMax = getArmorMaximum(profile);
  const dust = countItem(profile.warehouse, 'echo_dust');
  const warehouseCells = profile.warehouseSize.width * profile.warehouseSize.height;
  const bagCells = profile.backpack.width * profile.backpack.height;

  useEffect(() => {
    if (!entryOpen) return undefined;
    firstEntryRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEntryOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [entryOpen]);

  function acceptSlotDrop(event: DragEvent<HTMLButtonElement>, slot: GearSlot): void {
    event.preventDefault();
    const payload = readInventoryDrag(event);
    if (payload) onEquipItem(payload, slot);
    setSelected(null);
  }

  return (
    <main className="base-shell base-shell-v2">
      <header className="compact-header">
        <div className="brand-lockup compact-brand">
          <span className="eyebrow">SUI: ECHOES BELOW</span>
          <h1>饼干台整备间</h1>
          <p>只把需要的东西装进背包；留在仓库里的物品不会随远征丢失。</p>
        </div>
        <div className="header-actions" aria-label="存档操作">
          <span className="save-status">● 自动存档</span>
          <button className="text-button" type="button" onClick={onExport}>导出</button>
          <button className="text-button" type="button" onClick={() => importRef.current?.click()}>导入</button>
          <button className="text-button danger" type="button" onClick={onReset}>重置</button>
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <nav className="base-tabs" aria-label="基地功能">
        <button className={activeTab === 'storage' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('storage')}>装备与仓库</button>
        <button className={activeTab === 'workshop' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('workshop')}>工作台</button>
        <button className={activeTab === 'missions' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('missions')}>任务与地图</button>
        <span className="base-objective"><small>当前目标</small>{objective}</span>
      </nav>

      {notice && <div className="notice" role="status">{notice}</div>}

      {activeTab === 'storage' && (
        <section className="storage-workspace">
          <aside className="equipment-column panel">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">LOADOUT</span><h2>身上装备</h2></div>
              <span className="risk-label">进图后有风险</span>
            </div>
            <div className="equipment-slots">
              {GEAR_SLOTS.map((slot) => {
                const itemId = profile.loadout[slot];
                const item = itemId ? ITEMS[itemId] : null;
                const isSelected = selected?.source === 'loadout' && selected.slot === slot;
                return (
                  <button
                    className={`equipment-slot${item ? ` rarity-${item.rarity}` : ' is-empty'}${isSelected ? ' is-selected' : ''}`}
                    key={slot}
                    type="button"
                    draggable={Boolean(item)}
                    aria-pressed={isSelected}
                    onDragStart={(event) => item && writeInventoryDrag(event, { source: 'loadout', slot })}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => acceptSlotDrop(event, slot)}
                    onClick={() => {
                      if (selected && selected.source !== 'loadout') {
                        onEquipItem(selected, slot);
                        setSelected(null);
                      } else if (item) {
                        setSelected(isSelected ? null : { source: 'loadout', slot });
                      }
                    }}
                  >
                    <span>{item?.icon ?? '＋'}</span>
                    <div><small>{SLOT_NAMES[slot]}</small><strong>{item?.name ?? '空槽位'}</strong></div>
                  </button>
                );
              })}
            </div>
            <div className="loadout-summary">
              <span>生命 ♥♥♥♥♥</span>
              <span>蓝甲 {'◆'.repeat(profile.armorCondition)}{'◇'.repeat(Math.max(0, armorMax - profile.armorCondition)) || '无'}</span>
            </div>
          </aside>

          <section className="bag-column panel">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">FIELD BAG</span><h2>随身背包</h2></div>
              <span className="capacity">{occupiedGridCells(profile.backpack.items)} / {bagCells} 格</span>
            </div>
            <p className="grid-explainer">拖进这里的物品会带进地图，也会占用搜刮空间。</p>
            {profile.loadout.backpack && bagCells > 0 ? (
              <InventoryGrid
                ariaLabel={`${profile.backpack.width}乘${profile.backpack.height}随身背包`}
                items={profile.backpack.items}
                size={profile.backpack}
                source="backpack"
                selected={selected}
                onSelect={setSelected}
                onDropItem={(payload, x, y) => onMoveItem(payload, 'backpack', x, y)}
              />
            ) : (
              <div className="no-backpack">请先把背包装到装备栏</div>
            )}
            <div className="bag-warning">撤离前死亡：装备和背包内物品都会成为遗失回声。</div>
          </section>

          <section className="warehouse-column panel">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">SAFE STORAGE</span><h2>基地仓库</h2></div>
              <span className="capacity">{occupiedGridCells(profile.warehouse)} / {warehouseCells} 格 · {profile.warehouseSize.width}×{profile.warehouseSize.height}</span>
            </div>
            <p className="grid-explainer">仓库处于基地保护中。拖动物品整理位置，或拖到左侧装备/背包。</p>
            <InventoryGrid
              ariaLabel={`${profile.warehouseSize.width}乘${profile.warehouseSize.height}基地仓库`}
              items={profile.warehouse}
              size={profile.warehouseSize}
              source="warehouse"
              selected={selected}
              onSelect={setSelected}
              onDropItem={(payload, x, y) => onMoveItem(payload, 'warehouse', x, y)}
            />
          </section>
        </section>
      )}

      {activeTab === 'workshop' && (
        <section className="subpage-grid">
          <article className="panel service-card">
            <span className="service-icon">🛠</span>
            <div><span className="eyebrow">REPAIR</span><h2>护甲维修</h2><p>消耗基地仓库中的 2 份空响尘，把当前护甲修满。</p></div>
            <button className="secondary-button" type="button" onClick={onRepair} disabled={profile.armorCondition >= armorMax || dust < 2}>修复 · 2 ✨</button>
          </article>
          <article className="panel service-card">
            <span className="service-icon">🏗️</span>
            <div><span className="eyebrow">EXPANSION</span><h2>仓库扩建</h2><p>将安全仓库从 9×10 扩建到 10×10，不改变随身背包。</p></div>
            <button className="secondary-button" type="button" onClick={onUpgradeWarehouse} disabled={profile.warehouseSize.width >= 10 || dust < 6}>{profile.warehouseSize.width >= 10 ? '已完成' : '扩建 · 6 ✨'}</button>
          </article>
          <article className="panel service-card is-coming">
            <span className="service-icon">⚗️</span>
            <div><span className="eyebrow">CRAFTING</span><h2>制造与出售</h2><p>接口已经预留；下一版加入图纸、报价和批量制造。</p></div>
            <span className="coming-label">后续开放</span>
          </article>
        </section>
      )}

      {activeTab === 'missions' && (
        <section className="mission-layout">
          <article className="panel mission-card">
            <span className="eyebrow">CURRENT OBJECTIVE</span>
            <h2>{objective}</h2>
            <p>未知地图也会显示你、主目标和撤离点的相对方位。远征中按 M 查看二维房间图。</p>
            <ol className="mission-list">
              <li className={profile.successfulExtractions > 0 ? 'done' : ''}>首次安全撤离</li>
              <li className={profile.mapUnlocked ? 'done' : ''}>找回导航羽片</li>
              <li className={profile.shortcutUnlocked ? 'done' : ''}>启动维护电梯</li>
              <li className={profile.bossDefeated ? 'done' : ''}>取得回声核心</li>
            </ol>
            {profile.endingUnlocked && <button className="signal-button" type="button" onClick={onPlayEnding}>📡 启动直播信标</button>}
          </article>
          <article className="panel room-map-card" aria-label="寂羽空洞二维房间示意图">
            <span className="map-room room-foyer">前庭<br /><small>入口 / 撤离</small></span>
            <span className="map-room room-shaft">回声竖井</span>
            <span className="map-room room-rift">荧菌裂谷<br /><small>{profile.mapUnlocked ? '导航羽片' : '未知目标'}</small></span>
            <span className="map-room room-machine">静默机房<br /><small>深层信号</small></span>
            <span className="map-route route-vertical" />
            <span className="map-route route-upper" />
            <span className="map-home-marker">▲ 基地入口</span>
          </article>
        </section>
      )}

      <footer className="base-command-bar">
        <div>
          {profile.lostEcho ? <strong className="echo-warning">◉ 遗失回声等待找回；再次死亡会覆盖</strong> : <span>提示：也可点击物品，再点击目标格或装备槽。</span>}
        </div>
        <button className="deploy-button" type="button" onClick={() => setEntryOpen(true)} disabled={!profile.loadout.weapon || !profile.loadout.backpack}>
          选择入口并开始远征
        </button>
      </footer>

      {entryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEntryOpen(false)}>
          <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="eyebrow">DEPLOYMENT</span>
            <h2 id="entry-title">选择远征入口</h2>
            <p>入口只决定出生房间；身上装备和随身背包内容都会带入。</p>
            <button ref={firstEntryRef} className="entry-option" type="button" onClick={() => onBeginRaid('foyer')}>
              <span>⌂</span><div><strong>失落前庭</strong><small>风险 I · 适合初次探索 · 最近撤离点</small></div>
            </button>
            <button className="entry-option" type="button" disabled={!profile.shortcutUnlocked} onClick={() => onBeginRaid('lift')}>
              <span>⇣</span><div><strong>维护电梯中层站</strong><small>{profile.shortcutUnlocked ? '风险 II · 直接进入二维地图中层' : '需要先在裂谷启动电梯'}</small></div>
            </button>
            <button className="text-button modal-cancel" type="button" onClick={() => setEntryOpen(false)}>取消</button>
          </section>
        </div>
      )}
    </main>
  );
}
