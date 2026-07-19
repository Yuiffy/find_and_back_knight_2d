import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  COLLECTIBLE_KIND_NAMES,
  countItem,
  GEAR_SLOTS,
  getArmorMaximum,
  getClueRecords,
  getMarketLockReason,
  getObjectiveSteps,
  ITEMS,
  loadoutToPurchaseStacks,
  MARKET_ITEM_IDS,
  quoteMarketOrder,
  RARITY_COLORS,
  RARITY_NAMES,
  SLOT_NAMES,
  STARTER_STANDARD_LOADOUT,
} from '../game/items';
import { MAP_REGISTRY, isEntryUnlocked, isMapUnlocked } from '../game/maps';
import { occupiedGridCells } from '../game/inventory';
import type { GearSlot, PlayerProfile } from '../types/game';
import {
  InventoryGrid,
  rotateInventoryDragPayload,
  type InventoryDragPayload,
  type InventorySource,
} from './InventoryGrid';

type BaseTab = 'storage' | 'workshop' | 'market' | 'collection' | 'clues';

interface BaseScreenProps {
  profile: PlayerProfile;
  objective: string;
  notice: string | null;
  onBeginRaid: (mapId: string, entryId: string) => void;
  onMoveItem: (payload: InventoryDragPayload, target: Exclude<InventorySource, 'loadout'>, x: number, y: number) => void;
  onRotateItem: (payload: InventoryDragPayload) => void;
  onQuickTransfer: (payload: InventoryDragPayload) => void;
  onSplitItem: (payload: InventoryDragPayload) => void;
  onCompactGrid: (source: 'warehouse' | 'backpack') => void;
  onDepositBackpack: () => void;
  onExhibitCollectible: (itemId: string) => void;
  onWithdrawCollectible: (itemId: string) => void;
  onUpgradeWorkshop: () => void;
  onEquipItem: (payload: InventoryDragPayload, slot: GearSlot) => void;
  onBuy: (itemId: string, quantity?: number) => void;
  onQuickBuy: (offerId: 'last-loadout' | 'starter-standard') => void;
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
  onDepositBackpack,
  onExhibitCollectible,
  onWithdrawCollectible,
  onUpgradeWorkshop,
  onEquipItem,
  onBuy,
  onQuickBuy,
  onSell,
  onRepair,
  onUpgradeWarehouse,
  onExport,
  onImport,
  onReset,
}: BaseScreenProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const deployButtonRef = useRef<HTMLButtonElement>(null);
  const entryModalRef = useRef<HTMLElement>(null);
  const firstEntryRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<BaseTab>('storage');
  const [entryOpen, setEntryOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryDragPayload | null>(null);
  const [activeDrag, setActiveDrag] = useState<InventoryDragPayload | null>(null);
  const activeDragRef = useRef<InventoryDragPayload | null>(null);
  const armorMax = getArmorMaximum(profile);
  const dust = countItem(profile.warehouse, 'echo_dust');
  const warehouseCells = profile.warehouseSize.width * profile.warehouseSize.height;
  const bagCells = profile.backpack.width * profile.backpack.height;
  const clues = getClueRecords(profile);
  const objectiveSteps = getObjectiveSteps(profile);
  const availableMaps = Object.values(MAP_REGISTRY).filter((map) => isMapUnlocked(map, profile as unknown as Record<string, unknown>));
  const discoveredItems = profile.discoveredItems ?? [];
  const selectedItem = selected?.itemId ? ITEMS[selected.itemId] : null;
  const selectedStack = selected?.uid && (selected.source === 'warehouse' || selected.source === 'backpack')
    ? (selected.source === 'warehouse' ? profile.warehouse : profile.backpack.items).find((item) => item.uid === selected.uid)
    : null;
  const starterQuote = quoteMarketOrder(STARTER_STANDARD_LOADOUT, profile);
  const lastLoadoutStacks = profile.lastDeployedLoadout ? loadoutToPurchaseStacks(profile.lastDeployedLoadout) : [];
  const lastLoadoutQuote = quoteMarketOrder(lastLoadoutStacks, profile);

  useEffect(() => {
    if (!entryOpen) return undefined;
    firstEntryRef.current?.focus();
    const handleModalKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEntryOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(entryModalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleModalKey);
    return () => {
      window.removeEventListener('keydown', handleModalKey);
      deployButtonRef.current?.focus();
    };
  }, [entryOpen]);

  useEffect(() => {
    const rotateActiveDrag = (event: KeyboardEvent) => {
      if (entryOpen || event.key.toLowerCase() !== 'r' || !activeDragRef.current?.uid) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rotated = rotateInventoryDragPayload(activeDragRef.current);
      activeDragRef.current = rotated;
      setActiveDrag(rotated);
    };
    window.addEventListener('keydown', rotateActiveDrag);
    return () => window.removeEventListener('keydown', rotateActiveDrag);
  }, [entryOpen]);

  useEffect(() => {
    const moveInventoryDrag = (event: globalThis.PointerEvent) => {
      const drag = activeDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const next = {
        ...drag,
        pointerX: event.clientX,
        pointerY: event.clientY,
        dragMoved: drag.dragMoved || Math.hypot(event.clientX - (drag.dragStartX ?? event.clientX), event.clientY - (drag.dragStartY ?? event.clientY)) > 4,
      };
      activeDragRef.current = next;
      setActiveDrag(next);
    };
    const endInventoryDragOnMiss = (event: globalThis.PointerEvent) => {
      const pointerId = event.pointerId;
      requestAnimationFrame(() => {
        if (activeDragRef.current?.pointerId === pointerId) endInventoryDrag();
      });
    };
    const cancelInventoryDrag = () => endInventoryDrag();
    const cancelWhenHidden = () => {
      if (document.hidden) endInventoryDrag();
    };
    window.addEventListener('pointermove', moveInventoryDrag);
    window.addEventListener('pointerup', endInventoryDragOnMiss);
    window.addEventListener('pointercancel', endInventoryDragOnMiss);
    window.addEventListener('blur', cancelInventoryDrag);
    document.addEventListener('visibilitychange', cancelWhenHidden);
    return () => {
      window.removeEventListener('pointermove', moveInventoryDrag);
      window.removeEventListener('pointerup', endInventoryDragOnMiss);
      window.removeEventListener('pointercancel', endInventoryDragOnMiss);
      window.removeEventListener('blur', cancelInventoryDrag);
      document.removeEventListener('visibilitychange', cancelWhenHidden);
    };
  }, []);

  useEffect(() => {
    if (!selected?.uid) return undefined;
    const rotateSelected = (event: KeyboardEvent) => {
      if (entryOpen || event.key.toLowerCase() !== 'r') return;
      if (activeDragRef.current?.uid) return;
      event.preventDefault();
      onRotateItem(selected);
    };
    window.addEventListener('keydown', rotateSelected);
    return () => window.removeEventListener('keydown', rotateSelected);
  }, [entryOpen, onRotateItem, selected]);

  function beginInventoryDrag(payload: InventoryDragPayload): void {
    activeDragRef.current = payload;
    setActiveDrag(payload);
  }

  function endInventoryDrag(): void {
    activeDragRef.current = null;
    setActiveDrag(null);
  }

  function beginLoadoutDrag(event: PointerEvent<HTMLButtonElement>, slot: GearSlot, itemId: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginInventoryDrag({
      source: 'loadout',
      slot,
      itemId,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      dragStartX: event.clientX,
      dragStartY: event.clientY,
      dragMoved: false,
    });
  }

  function handleEquipmentSlotPointerUp(event: PointerEvent<HTMLButtonElement>, slot: GearSlot): void {
    const payload = activeDragRef.current;
    if (!payload || payload.pointerId !== event.pointerId || !payload.dragMoved) return;
    if (payload.source !== 'loadout') onEquipItem(payload, slot);
    setSelected(null);
    endInventoryDrag();
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
          <span className="credits-badge">◈ {profile.credits} 小鸟币</span>
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
        <button className={activeTab === 'collection' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('collection')}>收藏室</button>
        <button className={activeTab === 'clues' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('clues')}>线索簿</button>
        <span className="base-objective"><small>当前目标</small>{objective}</span>
        <ol className="objective-step-list" aria-label="远征进度">
          {objectiveSteps.map((step) => <li className={step.done ? 'done' : ''} key={step.id}>{step.done ? '✓' : '○'} {step.label}</li>)}
        </ol>
      </nav>

      {notice && <div className="notice" role="status">{notice}</div>}

      {selectedItem && selected && (
        <div className="selection-toolbar" role="toolbar" aria-label="所选物品操作">
          <span>{selectedItem.icon} <strong>{selectedItem.name}</strong>{selected.source === 'loadout' && <small>{selectedItem.description}</small>}</span>
          {selected.source !== 'loadout' && <button type="button" onClick={() => onRotateItem(selected)}>↻ 旋转（R / 右键）</button>}
          {selectedStack && selectedStack.quantity > 1 && <button type="button" onClick={() => { onSplitItem(selected); setSelected(null); }}>½ 拆分堆叠</button>}
          {selected.source !== 'loadout' && <button type="button" onClick={() => { onQuickTransfer(selected); setSelected(null); }}>⇆ 快速转移</button>}
          {selected.source === 'loadout' && <button type="button" onClick={() => { onMoveItem(selected, 'warehouse', -1, -1); setSelected(null); }}>卸到仓库</button>}
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
                    aria-pressed={isSelected}
                    onPointerDown={(event) => item && beginLoadoutDrag(event, slot, item.id)}
                    onPointerUpCapture={(event) => handleEquipmentSlotPointerUp(event, slot)}
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
                    <div>
                      <small>{SLOT_NAMES[slot]}</small>
                      <strong>{item?.name ?? '空槽位'}</strong>
                      <em>{item?.description ?? '从仓库或背包拖入，也可先选择物品再点击此处。'}</em>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="loadout-summary">
              <span>生命 ♥♥♥♥♥</span>
              <span>蓝甲 {'◆'.repeat(profile.armorCondition)}{'◇'.repeat(Math.max(0, armorMax - profile.armorCondition)) || '无'}{armorMax > 0 ? ' · 换装不维修' : ''}</span>
            </div>
          </aside>

          <section className="bag-column panel">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">FIELD BAG</span><h2>随身背包</h2></div>
              <div className="panel-tools"><span className="capacity">{occupiedGridCells(profile.backpack.items)} / {bagCells} 格</span><button type="button" onClick={() => onCompactGrid('backpack')}>自动整理</button><button type="button" onClick={onDepositBackpack} disabled={profile.backpack.items.length === 0}>一键入库</button></div>
            </div>
            <p className="grid-explainer">拖动时亮框显示完整落点；按 R 可即时旋转，空间冲突会自动寻找空位。右键旋转，双击快速卸回仓库。</p>
            {profile.loadout.backpack && bagCells > 0 ? (
              <InventoryGrid
                ariaLabel={`${profile.backpack.width}乘${profile.backpack.height}随身背包`}
                items={profile.backpack.items}
                size={profile.backpack}
                source="backpack"
                selected={selected}
                activeDrag={activeDrag}
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
              activeDrag={activeDrag}
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
            <div><span className="eyebrow">SAFE STORAGE</span><h2>仓库扩建 · Lv.{profile.warehouseLevel}</h2><p>扩容安全仓库，给从远征带回来的大件藏品留出展示前的周转空间。</p></div>
            <button className="secondary-button" type="button" onClick={onUpgradeWarehouse} disabled={profile.warehouseLevel >= 3}>{profile.warehouseLevel >= 3 ? '最高等级' : `扩建 · ◈ ${profile.warehouseLevel === 1 ? 90 : 240}`}</button>
          </article>
          <article className="panel service-card">
            <span className="service-icon">🧪</span>
            <div><span className="eyebrow">CRAFT BENCH</span><h2>制造台 · Lv.{profile.workshopLevel}</h2><p>提升制造台会解锁更可靠的远征补给与高级装备报价。下一次升级使用小鸟币支付。</p></div>
            <button className="secondary-button" type="button" onClick={onUpgradeWorkshop} disabled={profile.workshopLevel >= 3}>{profile.workshopLevel >= 3 ? '最高等级' : `升级 · ◈ ${profile.workshopLevel === 1 ? 120 : 360}`}</button>
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
            <section className="quick-resupply" aria-labelledby="quick-resupply-title">
              <div className="quick-resupply-heading">
                <div><span className="eyebrow">QUICK RESUPPLY</span><h3 id="quick-resupply-title">快速整备</h3></div>
                <small>物品送入仓库，需在装备页手动换装。</small>
              </div>
              <div className="quick-resupply-list">
                <article className="quick-resupply-offer">
                  <div>
                    <strong>复购上次整备</strong>
                    <small>{profile.lastDeployedLoadout ? (lastLoadoutQuote.reason ?? '按最近一次出发时穿戴的装备重新报价。') : '尚未开始过远征，暂无可复购整备。'}</small>
                    {lastLoadoutStacks.length > 0 && <span className="kit-items">{lastLoadoutStacks.map(({ itemId, quantity }) => `${ITEMS[itemId].icon} ${ITEMS[itemId].name}${quantity > 1 ? ` ×${quantity}` : ''}`).join(' · ')}</span>}
                  </div>
                  <button type="button" disabled={!profile.lastDeployedLoadout || Boolean(lastLoadoutQuote.reason) || profile.credits < lastLoadoutQuote.totalPrice} onClick={() => onQuickBuy('last-loadout')}>
                    {lastLoadoutQuote.totalPrice > 0 ? `一键复购 · ◈ ${lastLoadoutQuote.totalPrice}` : '暂无整备'}
                  </button>
                </article>
                <article className="quick-resupply-offer">
                  <div>
                    <strong>新手制式套装</strong>
                    <small>{starterQuote.reason ?? '旧羽钉与折羽背包，适合重新开始整备。'}</small>
                    <span className="kit-items">{STARTER_STANDARD_LOADOUT.map(({ itemId }) => `${ITEMS[itemId].icon} ${ITEMS[itemId].name}`).join(' · ')}</span>
                  </div>
                  <button type="button" disabled={Boolean(starterQuote.reason) || profile.credits < starterQuote.totalPrice} onClick={() => onQuickBuy('starter-standard')}>
                    一键购买 · ◈ {starterQuote.totalPrice}
                  </button>
                </article>
              </div>
            </section>
            <div className="offer-list">
              {MARKET_ITEM_IDS.map((itemId) => {
                const item = ITEMS[itemId];
                const lockReason = getMarketLockReason(itemId, profile);
                const locked = Boolean(lockReason);
                return (
                  <div className={`offer-row rarity-${item.rarity}${locked ? ' is-locked' : ''}`} key={itemId}>
                    <span className="offer-icon">{locked ? '？' : item.icon}</span>
                    <div><strong>{locked ? '未识别的回收货' : item.name}</strong><small>{locked ? lockReason : item.description}</small></div>
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

      {activeTab === 'collection' && (
        <section className="collection-room-layout">
          <article className="panel collection-room">
            <div className="panel-heading compact-panel-heading">
              <div><span className="eyebrow">SUI ARCHIVE</span><h2>岁己收藏室</h2></div>
              <span className="capacity">{profile.collectionItems.length} 件已陈列</span>
            </div>
            <p className="collection-room-intro">藏品必须先安全撤离、再从基地仓库放入展柜。它们不再占用仓库格子，也不会在下次远征中丢失；需要时可取回，但会重新占用仓库空间。</p>
            <div className="collection-shelves">
              {profile.collectionItems.length === 0 && <div className="empty-collection">展柜还空着。试着在远征容器里寻找带有红色光环的珍贵藏品。</div>}
              {profile.collectionItems.map((itemId) => {
                const item = ITEMS[itemId];
                return <article className={`collection-display rarity-${item.rarity}`} key={itemId} style={{ '--collectible-color': RARITY_COLORS[item.rarity] } as CSSProperties}>
                  <span>{item.icon}</span><div><small>{item.collectibleKind ? COLLECTIBLE_KIND_NAMES[item.collectibleKind] : '未分类'} · {RARITY_NAMES[item.rarity]}藏品</small><strong>{item.name}</strong><p>{item.description}</p><button type="button" onClick={() => onWithdrawCollectible(itemId)}>取回到仓库</button></div>
                </article>;
              })}
            </div>
          </article>
          <aside className="panel collection-staging">
            <div className="panel-heading compact-panel-heading"><div><span className="eyebrow">READY TO DISPLAY</span><h2>仓库待陈列</h2></div></div>
            <p className="collection-room-intro">陈列会消耗仓库中的一件对应藏品；重复物仍可留在仓库出售或继续收集。</p>
            <div className="display-candidate-list">
              {profile.warehouse.filter((entry) => ITEMS[entry.itemId].category === 'collectible' && !profile.collectionItems.includes(entry.itemId)).map((entry) => {
                const item = ITEMS[entry.itemId];
                return <div className={`display-candidate rarity-${item.rarity}`} key={entry.uid}><span>{item.icon}</span><div><strong>{item.name}</strong><small>{item.collectibleKind ? COLLECTIBLE_KIND_NAMES[item.collectibleKind] : '未分类'} · 持有 ×{entry.quantity}</small></div><button type="button" onClick={() => onExhibitCollectible(entry.itemId)}>陈列</button></div>;
              })}
              {profile.warehouse.every((entry) => ITEMS[entry.itemId].category !== 'collectible' || profile.collectionItems.includes(entry.itemId)) && <p className="empty-market">仓库中没有未陈列的藏品。</p>}
            </div>
          </aside>
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
        <button ref={deployButtonRef} className="deploy-button" type="button" onClick={() => setEntryOpen(true)}>
          选择入口并开始远征
        </button>
      </footer>

      {entryOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEntryOpen(false)}>
          <section ref={entryModalRef} className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="eyebrow">DEPLOYMENT</span>
            <h2 id="entry-title">选择地图与入口</h2>
            <p>每轮只加载一张完整地图；普通入口会在多个安全投放点中轮换，深层电梯则直接前往远端区域。</p>
            {availableMaps.map((map, mapIndex) => (
              <div className="destination-group" key={map.id}>
                <h3>{map.name}<small>{map.subtitle}</small></h3>
                {Object.values(map.entries).map((entry, entryIndex) => {
                  const unlocked = isEntryUnlocked(entry, profile as unknown as Record<string, unknown>);
                  const entryZone = map.zones.find((zone) => zone.id === entry.zoneId);
                  return (
                    <button
                      ref={mapIndex === 0 && entryIndex === 0 ? firstEntryRef : undefined}
                      className="entry-option"
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onBeginRaid(map.id, entry.id)}
                      key={`${map.id}:${entry.id}`}
                    >
                      <span>{map.id === 'outpost_01' ? '⚔️' : (map.id === 'relay_01' ? '📡' : (entry.id === 'lift' ? '⇣' : '⌂'))}</span>
                      <div><strong>{entry.name}</strong><small>{unlocked ? (map.id === 'outpost_01' ? '大型搜打撤战场 · 随机出生 · 远距撤离 · 拟态拾荒者' : `${map.name} · ${entryZone?.risk ?? 'I'} 级区域`) : '需要先启动维护电梯'}</small></div>
                    </button>
                  );
                })}
              </div>
            ))}
            {!profile.bossDefeated && <p className="destination-locked">带回回声核心后，天线深场目的地将解锁。</p>}
            <button className="text-button modal-cancel" type="button" onClick={() => setEntryOpen(false)}>取消</button>
          </section>
        </div>
      )}
    </main>
  );
}
