import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BaseScreen } from './components/BaseScreen';
import type { InventoryDragPayload } from './components/InventoryGrid';
import {
  addStacks,
  cloneGridItems,
  compactGridItems,
  gridItemsToStacks,
  insertGridItemSmart,
  insertGridStack,
  insertGridStacks,
  makeGridUid,
  moveOrMergeGridItem,
  removeGridQuantity,
  rotateGridItem,
  splitGridItem,
  validateGrid,
} from './game/inventory';
import {
  getArmorMaximum,
  getCurrentObjective,
  getDeathPersistentClues,
  ITEMS,
  loadoutToPurchaseStacks,
  quoteMarketOrder,
  STARTER_STANDARD_LOADOUT,
} from './game/items';
import { EMPTY_DEATH_LOADOUT, saveRepository } from './services/saveRepository';
import { publishDomainEvent } from './services/gameNetworkBoundary';
import type { GearSlot, GridItem, GridSize, PlayerProfile, RaidResult, RaidRunState, RaidTransition, TextGameState } from './types/game';

type AppMode = 'base' | 'raid' | 'ending';

const GameCanvas = lazy(() => import('./components/GameCanvas').then((module) => ({
  default: module.GameCanvas,
})));

export function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => saveRepository.load());
  const [mode, setMode] = useState<AppMode>('base');
  const [raidMapId, setRaidMapId] = useState('hollow_01');
  const [raidEntryId, setRaidEntryId] = useState('foyer');
  const [raidRunState, setRaidRunState] = useState<RaidRunState | null>(null);
  const [notice, setNotice] = useState<string | null>('饼干台上线。浏览器自动存档已启用。');
  const objective = getCurrentObjective(profile);

  useEffect(() => {
    if (mode === 'raid') return;
    const textState: TextGameState = {
      mode,
      objective: mode === 'ending' ? '直播频道已经连通；结局一 · 尚未归巢' : objective,
    };
    window.__SUI_GAME_STATE__ = textState;
  }, [mode, objective]);

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify(
      window.__SUI_GAME_STATE__ ?? { mode, objective },
    );
    if (!window.advanceTime) {
      window.advanceTime = (milliseconds: number) => new Promise((resolve) => {
        window.setTimeout(resolve, Math.max(0, milliseconds));
      });
    }
  }, [mode, objective]);

  function commit(next: PlayerProfile, message?: string): void {
    const saved = saveRepository.save(next);
    setProfile(saved);
    if (message) setNotice(message);
  }

  function getGrid(source: 'warehouse' | 'backpack'): { items: GridItem[]; size: GridSize } {
    return source === 'warehouse'
      ? { items: profile.warehouse, size: profile.warehouseSize }
      : { items: profile.backpack.items, size: profile.backpack };
  }

  function handleMoveItem(
    payload: InventoryDragPayload,
    target: 'warehouse' | 'backpack',
    x: number,
    y: number,
  ): void {
    const targetGrid = getGrid(target);
    if (payload.source === target && payload.uid) {
      const result = moveOrMergeGridItem(targetGrid.items, targetGrid.size, payload.uid, x, y, payload.rotated);
      if (!result) {
        setNotice('那里放不下：物品不能重叠，也不能超出格子。');
        return;
      }
      commit(target === 'warehouse'
        ? { ...profile, warehouse: result.items }
        : { ...profile, backpack: { ...profile.backpack, items: result.items } },
      result.merged ? '同类物品已合并到一个堆叠。' : (result.autoPlaced ? '落点被占用，已放到最近的可用空位。' : '物品位置已调整。'));
      return;
    }

    if (payload.source === 'loadout' && payload.slot) {
      const itemId = profile.loadout[payload.slot];
      if (!itemId) return;
      if (payload.slot === 'backpack' && (target === 'backpack' || profile.backpack.items.length > 0)) {
        setNotice('先把随身背包清空，才能卸下背包本体。');
        return;
      }
      const gridItem: GridItem = { uid: makeGridUid(itemId), itemId, quantity: 1, x, y, rotated: false };
      const result = insertGridItemSmart(targetGrid.items, targetGrid.size, gridItem, { x, y });
      if (!result) {
        setNotice('目标区域没有足够的连续空间。');
        return;
      }
      const nextLoadout = { ...profile.loadout, [payload.slot]: null };
      commit({
        ...profile,
        loadout: nextLoadout,
        warehouse: target === 'warehouse' ? result.items : profile.warehouse,
        backpack: payload.slot === 'backpack'
          ? { width: 0, height: 0, items: [] }
          : { ...profile.backpack, items: target === 'backpack' ? result.items : profile.backpack.items },
        armorCondition: payload.slot === 'armor' ? 0 : profile.armorCondition,
      }, `${ITEMS[itemId].name} 已卸下。`);
      return;
    }

    if ((payload.source === 'warehouse' || payload.source === 'backpack') && payload.uid) {
      const sourceGrid = getGrid(payload.source);
      const item = sourceGrid.items.find((entry) => entry.uid === payload.uid);
      if (!item) return;
      const sourceItems = sourceGrid.items.filter((entry) => entry.uid !== payload.uid).map((entry) => ({ ...entry }));
      const result = insertGridItemSmart(targetGrid.items, targetGrid.size, { ...item, rotated: payload.rotated ?? item.rotated }, { x, y });
      if (!result) {
        setNotice(`${ITEMS[item.itemId].name} 没有可用空间；可以先旋转或点击「自动整理」。`);
        return;
      }
      commit({
        ...profile,
        warehouse: payload.source === 'warehouse'
          ? sourceItems
          : (target === 'warehouse' ? result.items : profile.warehouse),
        backpack: {
          ...profile.backpack,
          items: payload.source === 'backpack'
            ? sourceItems
            : (target === 'backpack' ? result.items : profile.backpack.items),
        },
        ...(target === 'warehouse' && payload.source !== 'warehouse' ? { warehouse: result.items } : {}),
        ...(target === 'backpack' && payload.source !== 'backpack' ? { backpack: { ...profile.backpack, items: result.items } } : {}),
      }, result.merged
        ? `${ITEMS[item.itemId].name} 已并入现有堆叠。`
        : (result.autoPlaced ? `${ITEMS[item.itemId].name} 已自动放入最近空位。` : `${ITEMS[item.itemId].name} 已转移。`));
    }
  }

  function handleRotateItem(payload: InventoryDragPayload): void {
    if ((payload.source !== 'warehouse' && payload.source !== 'backpack') || !payload.uid) return;
    const grid = getGrid(payload.source);
    const item = grid.items.find((entry) => entry.uid === payload.uid);
    if (!item) return;
    const definition = ITEMS[item.itemId];
    if (definition.size.width === definition.size.height) {
      setNotice(`${definition.name} 是正方形，不需要旋转。`);
      return;
    }
    const rotated = rotateGridItem(grid.items, grid.size, payload.uid);
    if (!rotated) {
      setNotice('当前位置没有旋转所需空间；先移动物品或自动整理。');
      return;
    }
    commit(payload.source === 'warehouse'
      ? { ...profile, warehouse: rotated }
      : { ...profile, backpack: { ...profile.backpack, items: rotated } }, `${definition.name} 已旋转。`);
  }

  function handleCompactGrid(source: 'warehouse' | 'backpack'): void {
    const grid = getGrid(source);
    const compacted = compactGridItems(grid.items, grid.size);
    if (!compacted) {
      setNotice('自动整理失败：当前容器装不下这些物品。');
      return;
    }
    commit(source === 'warehouse'
      ? { ...profile, warehouse: compacted }
      : { ...profile, backpack: { ...profile.backpack, items: compacted } }, '已合并堆叠，并按体积自动整理。');
  }

  function handleDepositBackpack(): void {
    if (profile.backpack.items.length === 0) {
      setNotice('随身背包已经是空的。');
      return;
    }
    const warehouse = insertGridStacks(profile.warehouse, profile.warehouseSize, gridItemsToStacks(profile.backpack.items));
    if (!warehouse) {
      setNotice('仓库没有足够的连续空间；先整理或扩建仓库后再一键入库。');
      return;
    }
    const itemCount = profile.backpack.items.reduce((total, item) => total + item.quantity, 0);
    commit({ ...profile, warehouse, backpack: { ...profile.backpack, items: [] } }, `一键入库完成：${itemCount} 件物品已转入安全仓库。`);
  }

  function handleUpgradeWorkshop(): void {
    const costs = [0, 120, 360];
    if (profile.workshopLevel >= 3) {
      setNotice('制造台已达到最高等级。');
      return;
    }
    const price = costs[profile.workshopLevel] ?? 360;
    if (profile.credits < price) {
      setNotice(`升级制造台需要 ${price} 小鸟币。`);
      return;
    }
    const nextLevel = profile.workshopLevel + 1;
    commit({ ...profile, credits: profile.credits - price, workshopLevel: nextLevel }, `制造台升级至 Lv.${nextLevel}；新的补给与高级装备报价已解锁。`);
  }

  function handleExhibitCollectible(itemId: string): void {
    const candidate = profile.warehouse.find((item) => item.itemId === itemId);
    const definition = ITEMS[itemId];
    if (!candidate || definition?.category !== 'collectible') return;
    const warehouse = removeGridQuantity(profile.warehouse, itemId, 1);
    if (!warehouse) return;
    commit({
      ...profile,
      warehouse,
      collectionItems: Array.from(new Set([...profile.collectionItems, itemId])),
      discoveredItems: Array.from(new Set([...profile.discoveredItems, itemId])),
    }, `${definition.icon} ${definition.name} 已陈列到收藏室。`);
  }

  function handleWithdrawCollectible(itemId: string): void {
    const definition = ITEMS[itemId];
    if (!profile.collectionItems.includes(itemId) || definition?.category !== 'collectible') return;
    const warehouse = insertGridStack(profile.warehouse, profile.warehouseSize, { itemId, quantity: 1 });
    if (!warehouse) {
      setNotice('仓库没有足够的连续空间收回该藏品；先整理或扩建仓库。');
      return;
    }
    commit({
      ...profile,
      warehouse,
      collectionItems: profile.collectionItems.filter((entry) => entry !== itemId),
    }, `${definition.icon} ${definition.name} 已取回到仓库。`);
  }

  function handleQuickTransfer(payload: InventoryDragPayload): void {
    if (payload.source === 'warehouse') handleMoveItem(payload, 'backpack', -1, -1);
    if (payload.source === 'backpack') handleMoveItem(payload, 'warehouse', -1, -1);
  }

  function handleSplitItem(payload: InventoryDragPayload): void {
    if ((payload.source !== 'warehouse' && payload.source !== 'backpack') || !payload.uid) return;
    const grid = getGrid(payload.source);
    const source = grid.items.find((entry) => entry.uid === payload.uid);
    if (!source || source.quantity < 2) return;
    const split = splitGridItem(grid.items, grid.size, payload.uid);
    if (!split) {
      setNotice('没有空间放置拆出的新堆叠；先整理或移走一些物品。');
      return;
    }
    commit(payload.source === 'warehouse'
      ? { ...profile, warehouse: split }
      : { ...profile, backpack: { ...profile.backpack, items: split } },
    `${ITEMS[source.itemId].name} 已拆为 ${source.quantity - Math.floor(source.quantity / 2)} 与 ${Math.floor(source.quantity / 2)} 两组。`);
  }

  function handleMarketPurchase(stacks: readonly { itemId: string; quantity: number }[], label: string): void {
    const quote = quoteMarketOrder(stacks, profile);
    if (quote.reason) {
      setNotice(quote.reason);
      return;
    }
    if (profile.credits < quote.totalPrice) {
      setNotice(`购买${label}需要 ${quote.totalPrice} 小鸟币。`);
      return;
    }
    const warehouse = insertGridStacks(profile.warehouse, profile.warehouseSize, quote.stacks);
    if (!warehouse) {
      setNotice('仓库没有足够的连续空间收下整单物品；先整理或出售一些物品。');
      return;
    }
    const purchased = quote.stacks.map(({ itemId, quantity }) => `${ITEMS[itemId].icon} ${ITEMS[itemId].name}${quantity > 1 ? ` ×${quantity}` : ''}`).join('、');
    commit({
      ...profile,
      warehouse,
      credits: profile.credits - quote.totalPrice,
      discoveredItems: Array.from(new Set([...profile.discoveredItems, ...quote.stacks.map((stack) => stack.itemId)])),
    }, `购入${label}：${purchased}，已自动合并并放入仓库。`);
  }

  function handleBuy(itemId: string, quantity = 1): void {
    handleMarketPurchase([{ itemId, quantity }], ITEMS[itemId]?.name ?? '物品');
  }

  function handleQuickBuy(offerId: 'last-loadout' | 'starter-standard'): void {
    if (offerId === 'starter-standard') {
      handleMarketPurchase(STARTER_STANDARD_LOADOUT, '新手制式套装');
      return;
    }
    if (!profile.lastDeployedLoadout) {
      setNotice('尚未开始过远征，暂无可复购整备。');
      return;
    }
    handleMarketPurchase(loadoutToPurchaseStacks(profile.lastDeployedLoadout), '上次整备');
  }

  function handleSell(uid: string, sellAll = false): void {
    const itemStack = profile.warehouse.find((entry) => entry.uid === uid);
    if (!itemStack) return;
    const definition = ITEMS[itemStack.itemId];
    const price = definition.sellPrice ?? 0;
    if (price <= 0) {
      setNotice(`${definition.name} 是关键物品，交易台拒绝收购。`);
      return;
    }
    const quantity = sellAll ? itemStack.quantity : 1;
    const warehouse = itemStack.quantity > quantity
      ? profile.warehouse.map((entry) => entry.uid === uid ? { ...entry, quantity: entry.quantity - quantity } : { ...entry })
      : profile.warehouse.filter((entry) => entry.uid !== uid).map((entry) => ({ ...entry }));
    commit({ ...profile, warehouse, credits: profile.credits + price * quantity }, `售出 ${quantity} 个 ${definition.name}，获得 ${price * quantity} 羽币。`);
  }

  function handleEquipItem(payload: InventoryDragPayload, slot: GearSlot): void {
    if (payload.source === 'loadout') return;
    if (!payload.uid) return;
    const sourceGrid = getGrid(payload.source);
    const gridItem = sourceGrid.items.find((entry) => entry.uid === payload.uid);
    if (!gridItem) return;
    const item = ITEMS[gridItem.itemId];
    if (item.category !== slot) {
      setNotice(`${item.name} 不能放进「${slot}」装备位。`);
      return;
    }
    const sourceItems = sourceGrid.items.filter((entry) => entry.uid !== payload.uid).map((entry) => ({ ...entry }));
    const oldItemId = profile.loadout[slot];
    const warehouseAfterTake = payload.source === 'warehouse' ? sourceItems : cloneGridItems(profile.warehouse);
    const warehouseWithOld = oldItemId
      ? insertGridStack(warehouseAfterTake, profile.warehouseSize, { itemId: oldItemId, quantity: 1 })
      : warehouseAfterTake;
    if (!warehouseWithOld) {
      setNotice('仓库没有空间放回当前装备。');
      return;
    }

    const nextLoadout = { ...profile.loadout, [slot]: item.id };
    let nextBackpack = {
      ...profile.backpack,
      items: payload.source === 'backpack' ? sourceItems : profile.backpack.items,
    };
    if (slot === 'backpack') {
      const nextSize = {
        width: item.stats?.gridWidth ?? 0,
        height: item.stats?.gridHeight ?? 0,
      };
      if (!validateGrid(nextBackpack.items, nextSize)) {
        setNotice('当前背包里的物品放不进这个新背包，请先整理或清空。');
        return;
      }
      nextBackpack = { ...nextSize, items: nextBackpack.items };
    }
    const next = {
      ...profile,
      warehouse: warehouseWithOld,
      backpack: nextBackpack,
      loadout: nextLoadout,
    };
    if (slot === 'armor') next.armorCondition = Math.min(profile.armorCondition, getArmorMaximum(next));
    commit(next, `${item.icon} 已装备：${item.name}`);
  }

  function handleRepair(): void {
    const armorMax = getArmorMaximum(profile);
    const nextWarehouse = removeGridQuantity(profile.warehouse, 'echo_dust', 2);
    if (!nextWarehouse || profile.armorCondition >= armorMax) return;
    commit({ ...profile, warehouse: nextWarehouse, armorCondition: armorMax }, '护甲已完全修复。');
  }

  function handleUpgradeWarehouse(): void {
    const upgrades = [
      { level: 1, width: 10, height: 10, price: 90 },
      { level: 2, width: 11, height: 11, price: 240 },
    ];
    const upgrade = upgrades.find((entry) => entry.level === profile.warehouseLevel);
    if (!upgrade) {
      setNotice('安全仓库已达到最高等级。');
      return;
    }
    if (profile.credits < upgrade.price) {
      setNotice(`仓库扩建需要 ${upgrade.price} 小鸟币。`);
      return;
    }
    const nextSize = { width: upgrade.width, height: upgrade.height };
    if (!validateGrid(profile.warehouse, nextSize)) {
      setNotice('扩建前请先整理仓库内无法放置的物品。');
      return;
    }
    commit({
      ...profile,
      credits: profile.credits - upgrade.price,
      warehouseLevel: profile.warehouseLevel + 1,
      warehouseSize: nextSize,
    }, `安全仓库升级至 Lv.${profile.warehouseLevel + 1}：容量扩展为 ${nextSize.width}×${nextSize.height}。`);
  }

  function handleBeginRaid(mapId: string, entryId: string): void {
    const raidId = profile.raidsStarted + 1;
    const next = saveRepository.save({
      ...profile,
      raidsStarted: raidId,
      lastDeployedLoadout: { ...profile.loadout },
      activeRaid: {
        raidId,
        mapId,
        startedAt: new Date().toISOString(),
        backpack: cloneGridItems(profile.backpack.items),
        entryId,
      },
    });
    setProfile(next);
    setRaidMapId(mapId);
    setRaidEntryId(entryId);
    setRaidRunState(null);
    setNotice(null);
    publishDomainEvent({
      type: 'raid.started',
      raidId,
      mapId,
      entryId,
      at: new Date().toISOString(),
    });
    setMode('raid');
  }

  const handleRaidTransition = useCallback((transition: RaidTransition) => {
    setRaidRunState(transition.runState);
    setRaidMapId(transition.targetMapId);
    setRaidEntryId(transition.targetEntryId);
    setNotice(null);
  }, []);

  const handleRaidResult = useCallback((result: RaidResult) => {
    publishDomainEvent({
      type: 'raid.settled',
      raidId: profile.raidsStarted,
      mapId: result.mapId,
      result,
      at: new Date().toISOString(),
    });
    if (result.outcome === 'extracted') {
      const nextMapUnlocked = profile.mapUnlocked || result.mapUnlocked;
      const extractedCore = result.backpack.some((stack) => stack.itemId === 'echo_core');
      const nextBossDefeated = profile.bossDefeated || (result.bossDefeated && extractedCore);
      const nextLostEcho = profile.lostEcho
        ? (result.remainingLostEchoItems?.length
          ? { ...profile.lostEcho, items: result.remainingLostEchoItems.map((item) => ({ ...item })) }
          : null)
        : null;
      const next = saveRepository.save({
        ...profile,
        backpack: { ...profile.backpack, items: cloneGridItems(result.backpack) },
        loadout: { ...result.loadout },
        armorCondition: result.armorCondition,
        successfulExtractions: profile.successfulExtractions + 1,
        mapUnlocked: nextMapUnlocked,
        shortcutUnlocked: profile.shortcutUnlocked || result.shortcutUnlocked,
        bossDefeated: nextBossDefeated,
        endingUnlocked: profile.endingUnlocked || nextBossDefeated,
        endingSeen: profile.endingSeen || Boolean(result.endingTriggered),
        discoveredItems: Array.from(new Set([
          ...profile.discoveredItems,
          ...(result.discoveredItems ?? []),
          ...result.backpack.map((item) => item.itemId),
        ])),
        discoveredClues: Array.from(new Set([
          ...profile.discoveredClues,
          ...(result.discoveredClues ?? []),
          ...(nextBossDefeated ? ['home-trace'] : []),
        ])),
        lostEcho: nextLostEcho,
        activeRaid: null,
      });
      setProfile(next);
      setRaidRunState(null);
      if (result.endingTriggered) {
        setMode('ending');
        return;
      }
      setNotice(`安全撤离成功：${result.backpack.reduce((sum, stack) => sum + stack.quantity, 0)} 件物品仍在随身背包，请在整备页卸入基地仓库。`);
      setMode('base');
      return;
    }

    const carriedGear = Object.values(result.loadout)
      .filter((itemId): itemId is string => Boolean(itemId))
      .map((itemId) => ({ itemId, quantity: 1 }));
    const lostItems = addStacks(gridItemsToStacks(result.backpack), carriedGear);
    const deathPosition = result.deathPosition ?? { x: 240, y: 1940 };
    const next = saveRepository.save({
      ...profile,
      loadout: { ...EMPTY_DEATH_LOADOUT },
      backpack: { width: 0, height: 0, items: [] },
      armorCondition: 0,
      deaths: profile.deaths + 1,
      discoveredItems: Array.from(new Set([...profile.discoveredItems, ...(result.discoveredItems ?? [])])),
      discoveredClues: Array.from(new Set([
        ...profile.discoveredClues,
        ...getDeathPersistentClues(profile.discoveredClues, result.discoveredClues ?? []),
      ])),
      shortcutUnlocked: profile.shortcutUnlocked || result.shortcutUnlocked,
      lostEcho: {
        mapId: result.mapId,
        x: deathPosition.x,
        y: deathPosition.y,
        items: lostItems,
        createdAtRaid: profile.raidsStarted,
      },
      activeRaid: null,
    });
    setProfile(next);
    setRaidRunState(null);
    setNotice('远征失败。装备与背包物品留在死亡地点的遗失遗体中；从安全仓库重新配装，或下一轮前去取回。');
    setMode('base');
  }, [profile]);

  async function handleImport(file: File): Promise<void> {
    try {
      const imported = await saveRepository.import(file);
      setProfile(imported);
      setNotice('存档导入成功。');
    } catch (error) {
      setNotice(error instanceof Error ? `导入失败：${error.message}` : '导入失败。');
    }
  }

  function handleReset(): void {
    if (!window.confirm('确定重置全部进度吗？建议先导出备份。')) return;
    setProfile(saveRepository.reset());
    setNotice('已创建新的本地存档。');
  }

  if (mode === 'raid') {
    return (
      <Suspense fallback={<main className="game-loading">正在打开远征地图…</main>}>
        <GameCanvas
          profile={profile}
          mapId={raidMapId}
          entryId={raidEntryId}
          runState={raidRunState}
          onResult={handleRaidResult}
          onTransition={handleRaidTransition}
        />
      </Suspense>
    );
  }

  if (mode === 'ending') {
    return (
      <main className="ending-screen">
        <div className="signal-rings" />
        <span className="ending-cookie">🍪</span>
        <img
          className="ending-bird"
          src={`${import.meta.env.BASE_URL}assets/sui-bird.png`}
          alt="岁己望向重新亮起的直播信标"
        />
        <h1>收到请回答</h1>
        <p>回声核心重新点亮了空洞上空的频道。<br />遥远的屏幕上，第一条弹幕穿过黑暗：<br /><strong>“岁己，你的麦没关。”</strong></p>
        <span className="ending-label">结局一 · 尚未归巢</span>
        <button type="button" className="secondary-button" onClick={() => setMode('base')}>回到饼干台</button>
      </main>
    );
  }

  return (
    <BaseScreen
      profile={profile}
      objective={objective}
      notice={notice}
      onBeginRaid={handleBeginRaid}
      onMoveItem={handleMoveItem}
      onRotateItem={handleRotateItem}
      onQuickTransfer={handleQuickTransfer}
      onSplitItem={handleSplitItem}
      onCompactGrid={handleCompactGrid}
      onDepositBackpack={handleDepositBackpack}
      onExhibitCollectible={handleExhibitCollectible}
      onWithdrawCollectible={handleWithdrawCollectible}
      onUpgradeWorkshop={handleUpgradeWorkshop}
      onEquipItem={handleEquipItem}
      onBuy={handleBuy}
      onQuickBuy={handleQuickBuy}
      onSell={handleSell}
      onRepair={handleRepair}
      onUpgradeWarehouse={handleUpgradeWarehouse}
      onExport={() => saveRepository.export(profile)}
      onImport={handleImport}
      onReset={handleReset}
    />
  );
}
