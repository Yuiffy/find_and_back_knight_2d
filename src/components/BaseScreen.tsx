import { useEffect, useRef, useState, type DragEvent } from 'react';
import { countItem, GEAR_SLOTS, getArmorMaximum, getClueRecords, ITEMS, MARKET_ITEM_IDS, SLOT_NAMES } from '../game/items';
import { occupiedGridCells } from '../game/inventory';
import type { GearSlot, PlayerProfile } from '../types/game';
import {
  InventoryGrid,
  readInventoryDrag,
  rotateInventoryDragPayload,
  writeInventoryDrag,
  type InventoryDragPayload,
  type InventorySource,
} from './InventoryGrid';

type BaseTab = 'storage' | 'workshop' | 'market' | 'clues';

interface BaseScreenProps {
  profile: PlayerProfile;
  objective: string;
  notice: string | null;
  onBeginRaid: (entryId: 'foyer' | 'lift') => void;
  onMoveItem: (payload: InventoryDragPayload, target: Exclude<InventorySource, 'loadout'>, x: number, y: number) => void;
  onRotateItem: (payload: InventoryDragPayload) => void;
  onQuickTransfer: (payload: InventoryDragPayload) => void;
  onSplitItem: (payload: InventoryDragPayload) => void;
  onCompactGrid: (source: 'warehouse' | 'backpack') => void;
  onEquipItem: (payload: InventoryDragPayload, slot: GearSlot) => void;
  onBuy: (itemId: string, quantity?: number) => void;
  onSell: (uid: string, sellAll?: boolean) => void;
  onRepair: () => void;
  onUpgradeWarehouse: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export function BaseScreen({
  profile,
  objective,
  notice,
  onBeginRaid,
  onMoveItem,
  onRotateItem,
  onQuickTransfer,
  onSplitItem,
  onCompactGrid,
  onEquipItem,
  onBuy,
  onSell,
  onRepair,
  onUpgradeWarehouse,
  onExport,
  onImport,
  onReset,
}: BaseScreenProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const firstEntryRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<BaseTab>('storage');
  const [entryOpen, setEntryOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryDragPayload | null>(null);
  const activeDragRef = useRef<InventoryDragPayload | null>(null);
  const armorMax = getArmorMaximum(profile);
  const dust = countItem(profile.warehouse, 'echo_dust');
  const warehouseCells = profile.warehouseSize.width * profile.warehouseSize.height;
  const bagCells = profile.backpack.width * profile.backpack.height;
  const clues = getClueRecords(profile);
  const discoveredItems = profile.discoveredItems ?? [];
  const selectedItem = selected?.itemId ? ITEMS[selected.itemId] : null;
  const selectedStack = selected?.uid && (selected.source === 'warehouse' || selected.source === 'backpack')
    ? (selected.source === 'warehouse' ? profile.warehouse : profile.backpack.items).find((item) => item.uid === selected.uid)
    : null;

  useEffect(() => {
    if (!entryOpen) return undefined;
    firstEntryRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEntryOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [entryOpen]);

  useEffect(() => {
    const rotateActiveDrag = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'r' || !activeDragRef.current?.uid) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activeDragRef.current = rotateInventoryDragPayload(activeDragRef.current);
    };
    window.addEventListener('keydown', rotateActiveDrag);
    return () => window.removeEventListener('keydown', rotateActiveDrag);
  }, []);

  useEffect(() => {
    if (!selected?.uid) return undefined;
    const rotateSelected = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'r') return;
      if (activeDragRef.current?.uid) return;
      event.preventDefault();
      onRotateItem(selected);
    };
    window.addEventListener('keydown', rotateSelected);
    return () => window.removeEventListener('keydown', rotateSelected);
  }, [onRotateItem, selected]);

  function beginInventoryDrag(payload: InventoryDragPayload): void {
    activeDragRef.current = payload;
  }

  function endInventoryDrag(): void {
    activeDragRef.current = null;
  }

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
          <span className="credits-badge">◈ {profile.credits} 羽币</span>
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
        <button className={activeTab === 'market' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('market')}>拾荒交易台</button>
        <button className={activeTab === 'clues' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('clues')}>线索簿</button>
        <span className="base-objective"><small>电台低语</small>{objective}</span>
      </nav>

      {notice && <div className="notice" role="status">{notice}</div>}

      {selectedItem && selected && (
        <div className="selection-toolbar" role="toolbar" aria-label="所选物品操作">
          <span>{selectedItem.icon} <strong>{selectedItem.name}</strong></span>
          {selected.source !== 'loadout' && <button type="button" onClick={() => onRotateItem(selected)}>↻ 旋转（R / 右键）</button>}
          {selectedStack && selectedStack.quantity > 1 && <button type="button" onClick={() => { onSplitItem(selected); setSelected(null); }}>½ 拆分堆叠</button>}
          {selected.source !== 'loadout' && <button type="button" onClick={() => { onQuickTransfer(selected); setSelected(null); }}>⇆ 快速转移</button>}
          <button type="button" onClick={() => setSelected(null)}>取消选择</button>
        </div>
      )}

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
                    onDragStart={(event) => item && writeInventoryDrag(event, { source: 'loadout', slot, itemId: item.id })}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => acceptSlotDrop(event, slot)}
                    onClick={() => {
                      if (selected && selected.source !== 'loadout') {
                        onEquipItem(selected, slot);
                        setSelected(null);
                      } else if (item) {
                        setSelected(isSelected ? null : { source: 'loadout', slot, itemId: item.id });
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
              <div className="panel-tools"><span className="capacity">{occupiedGridCells(profile.backpack.items)} / {bagCells} 格</span><button type="button" onClick={() => onCompactGrid('backpack')}>自动整理</button></div>
            </div>
            <p className="grid-explainer">拖动时亮框显示完整落点；空间冲突会自动寻找空位。右键旋转，双击快速卸回仓库。</p>
            {profile.loadout.backpack && bagCells > 0 ? (
              <InventoryGrid
                ariaLabel={`${profile.backpack.width}乘${profile.backpack.height}随身背包`}
                items={profile.backpack.items}
                size={profile.backpack}
                source="backpack"
                selected={selected}
                getActiveDrag={() => activeDragRef.current}
                onSelect={setSelected}
                onDragStart={beginInventoryDrag}
                onDragEnd={endInventoryDrag}
                onDropItem={(payload, x, y) => onMoveItem(payload, 'backpack', x, y)}
                onRotateItem={onRotateItem}
                onQuickTransfer={onQuickTransfer}
              />
            ) : (
              <div className="no-backpack">请先把背包装到装备栏</div>
            )}
            <div className="bag-warning">撤离前死亡：装备和背包内物品都会成为遗失回声。</div>
          </section>

          <section className="warehouse-column panel">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">SAFE STORAGE</span><h2>基地仓库</h2></div>
              <div className="panel-tools"><span className="capacity">{occupiedGridCells(profile.warehouse)} / {warehouseCells} 格 · {profile.warehouseSize.width}×{profile.warehouseSize.height}</span><button type="button" onClick={() => onCompactGrid('warehouse')}>合并并整理</button></div>
            </div>
            <p className="grid-explainer">同类物品会自动合并。双击直接装入背包；拖拽时鼠标抓住的是物品上的具体格子。</p>
            <InventoryGrid
              ariaLabel={`${profile.warehouseSize.width}乘${profile.warehouseSize.height}基地仓库`}
              items={profile.warehouse}
              size={profile.warehouseSize}
              source="warehouse"
              selected={selected}
              getActiveDrag={() => activeDragRef.current}
              onSelect={setSelected}
              onDragStart={beginInventoryDrag}
              onDragEnd={endInventoryDrag}
              onDropItem={(payload, x, y) => onMoveItem(payload, 'warehouse', x, y)}
              onRotateItem={onRotateItem}
              onQuickTransfer={onQuickTransfer}
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
          <article className="panel service-card">
            <span className="service-icon">🩹</span>
            <div><span className="eyebrow">FIELD SUPPLY</span><h2>远征补给</h2><p>便携修补片现在可在远征中按 R 使用，恢复 1 点蓝甲。补货请前往交易台。</p></div>
            <button className="secondary-button" type="button" onClick={() => setActiveTab('market')}>查看补给报价</button>
          </article>
        </section>
      )}

      {activeTab === 'market' && (
        <section className="market-layout">
          <article className="panel market-card">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">SCAVENGER EXCHANGE</span><h2>拾荒者补给</h2></div>
              <strong className="market-balance">◈ {profile.credits}</strong>
            </div>
            <p className="market-intro">购买物会自动合并并放入基地仓库。深入空洞后，交易台会解锁新的回收货。</p>
            <div className="offer-list">
              {MARKET_ITEM_IDS.map((itemId) => {
                const item = ITEMS[itemId];
                const mapLocked = ['echo_lance', 'survey_lens'].includes(itemId) && !profile.mapUnlocked;
                const deepLocked = ['storm_feather', 'survey_pack'].includes(itemId) && !profile.bossDefeated;
                const locked = mapLocked || deepLocked;
                return (
                  <div className={`offer-row rarity-${item.rarity}${locked ? ' is-locked' : ''}`} key={itemId}>
                    <span className="offer-icon">{locked ? '？' : item.icon}</span>
                    <div><strong>{locked ? '未识别的回收货' : item.name}</strong><small>{locked ? (mapLocked ? '找回导航数据后开放' : '带回机房核心后开放') : item.description}</small></div>
                    <div className="offer-actions">
                      <button type="button" disabled={locked || profile.credits < (item.buyPrice ?? 0)} onClick={() => onBuy(itemId)}>×1 · ◈ {item.buyPrice}</button>
                      {item.stackLimit > 1 && <button type="button" disabled={locked || profile.credits < (item.buyPrice ?? 0) * 5} onClick={() => onBuy(itemId, 5)}>×5 · ◈ {(item.buyPrice ?? 0) * 5}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
          <article className="panel market-card">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">SELL FROM SAFE STORAGE</span><h2>出售仓库物品</h2></div>
            </div>
            <p className="market-intro">只显示基地仓库内的物品；装备和随身背包不会被误卖。可卖 1 件，也可一次出售整组。</p>
            <div className="sell-list">
              {profile.warehouse.length === 0 && <p className="empty-market">仓库里没有可出售的东西。</p>}
              {profile.warehouse.map((stack) => {
                const item = ITEMS[stack.itemId];
                return (
                  <div className="sell-row" key={stack.uid}>
                    <span>{item.icon}</span><div><strong>{item.name}</strong><small>持有 ×{stack.quantity}</small></div>
                    <div className="sell-actions">
                      <button type="button" disabled={!item.sellPrice} onClick={() => onSell(stack.uid)}>{item.sellPrice ? `卖 1 · ◈ ${item.sellPrice}` : '关键物品'}</button>
                      {Boolean(item.sellPrice && stack.quantity > 1) && <button type="button" className="sell-all" onClick={() => onSell(stack.uid, true)}>整组 · ◈ {(item.sellPrice ?? 0) * stack.quantity}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      )}

      {activeTab === 'clues' && (
        <section className="clue-layout">
          <article className="panel clue-book">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">FIELD NOTES</span><h2>岁己的线索簿</h2></div>
              <span className="capacity">{clues.filter((clue) => clue.resolved).length} / {clues.length} 已确认</span>
            </div>
            <p className="clue-intro">这里不下发任务。经过区域、聆听回声或发现关键物时，岁己会把推测记下来；验证后的记录会归档变灰。</p>
            <div className="clue-list">
              {clues.map((clue) => (
                <article className={`clue-entry${clue.resolved ? ' is-resolved' : ''}`} key={clue.id}>
                  <span>{clue.resolved ? '✓' : clue.icon}</span>
                  <div><small>{clue.tag} · {clue.resolved ? '已确认' : '待验证'}</small><h3>{clue.title}</h3><p>{clue.text}</p></div>
                </article>
              ))}
              <div className="clue-entry is-hidden"><span>…</span><div><small>未记录</small><h3>空洞里还有别的声音</h3><p>靠近异常光点并按 E 聆听，新的文字会自动留在这里。</p></div></div>
            </div>
          </article>
          <aside className="clue-side">
            <article className="panel room-map-card progressive-map" aria-label="逐步解锁的寂羽空洞房间图">
              <span className="map-room room-foyer">失落前庭<br /><small>入口 / 撤离</small></span>
              <span className={`map-room room-shaft${profile.successfulExtractions > 0 ? '' : ' is-unknown'}`}>{profile.successfulExtractions > 0 ? '回声竖井' : '未命名高处'}</span>
              <span className={`map-room room-rift${profile.mapUnlocked ? '' : ' is-unknown'}`}>{profile.mapUnlocked ? '荧菌裂谷' : '破碎坐标'}<br /><small>{profile.mapUnlocked ? '地图已恢复' : '轮廓不明'}</small></span>
              <span className={`map-room room-machine${profile.shortcutUnlocked ? '' : ' is-unknown'}`}>{profile.shortcutUnlocked ? '静默机房' : '深层噪点'}<br /><small>{profile.bossDefeated ? '核心已取回' : '信号活动'}</small></span>
              <span className={`map-route route-vertical${profile.successfulExtractions > 0 ? '' : ' is-unknown'}`} />
              <span className={`map-route route-upper${profile.mapUnlocked ? '' : ' is-unknown'}`} />
              <span className="map-home-marker">▲ 基地入口</span>
            </article>
            <article className="panel collection-card">
              <div><span className="eyebrow">COLLECTION</span><h2>物品图鉴</h2></div>
              <p>{discoveredItems.length} / {Object.keys(ITEMS).length} 种已带回或识别</p>
              <div>{Object.values(ITEMS).map((item) => <span className={discoveredItems.includes(item.id) ? '' : 'is-undiscovered'} title={discoveredItems.includes(item.id) ? item.name : '未发现'} key={item.id}>{discoveredItems.includes(item.id) ? item.icon : '？'}</span>)}</div>
            </article>
          </aside>
        </section>
      )}

      <footer className="base-command-bar">
        <div>
          {profile.lostEcho
            ? <strong className="echo-warning">◉ 遗失回声等待找回；再次死亡会覆盖</strong>
            : <span>{profile.endingUnlocked && !profile.endingSeen ? '回声核心正与天线墓园共鸣——结局需要在远征现场触发。' : '物品：拖拽精确放置 · 右键旋转 · 双击快速转移。'}</span>}
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
