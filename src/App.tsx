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
import { getArmorMaximum, getCurrentObjective, ITEMS } from './game/items';
import { saveRepository } from './services/saveRepository';
import { publishDomainEvent } from './services/gameNetworkBoundary';
import type { GearSlot, GridItem, GridSize, PlayerProfile, RaidResult, TextGameState } from './types/game';

type AppMode = 'base' | 'raid' | 'ending';

const GameCanvas = lazy(() => import('./components/GameCanvas').then((module) => ({
  default: module.GameCanvas,
})));

export function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => saveRepository.load());
  const [mode, setMode] = useState<AppMode>('base');
  const [raidEntryId, setRaidEntryId] = useState<'foyer' | 'lift'>('foyer');
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

  function handleBuy(itemId: string, quantity = 1): void {
    const item = ITEMS[itemId];
    const unitPrice = item?.buyPrice ?? 0;
    const price = unitPrice * quantity;
    const unlocked = !['echo_lance', 'survey_lens'].includes(itemId) || profile.mapUnlocked;
    const deepUnlocked = !['storm_feather', 'survey_pack'].includes(itemId) || profile.bossDefeated;
    if (!item || price <= 0 || quantity <= 0 || !unlocked || !deepUnlocked || profile.credits < price) return;
    const warehouse = insertGridStack(profile.warehouse, profile.warehouseSize, { itemId, quantity });
    if (!warehouse) {
      setNotice('仓库没有空间收货；先整理或出售一些物品。');
      return;
    }
    commit({
      ...profile,
      warehouse,
      credits: profile.credits - price,
      discoveredItems: Array.from(new Set([...profile.discoveredItems, itemId])),
    }, `购入 ${item.icon} ${item.name}${quantity > 1 ? ` ×${quantity}` : ''}，已自动合并并放入仓库。`);
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
    if (slot === 'armor') next.armorCondition = getArmorMaximum(next);
    commit(next, `${item.icon} 已装备：${item.name}`);
  }

  function handleRepair(): void {
    const armorMax = getArmorMaximum(profile);
    const nextWarehouse = removeGridQuantity(profile.warehouse, 'echo_dust', 2);
    if (!nextWarehouse || profile.armorCondition >= armorMax) return;
    commit({ ...profile, warehouse: nextWarehouse, armorCondition: armorMax }, '护甲已完全修复。');
  }

  function handleUpgradeWarehouse(): void {
    if (profile.warehouseSize.width >= 10) return;
    const nextWarehouse = removeGridQuantity(profile.warehouse, 'echo_dust', 6);
    if (!nextWarehouse) return;
    commit({ ...profile, warehouse: nextWarehouse, warehouseSize: { width: 10, height: 10 } }, '基地仓库已扩建为 10×10；随身背包保持不变。');
  }

  function handleBeginRaid(entryId: 'foyer' | 'lift'): void {
    const raidId = profile.raidsStarted + 1;
    const next = saveRepository.save({
      ...profile,
      raidsStarted: raidId,
      activeRaid: {
        raidId,
        mapId: 'hollow_01',
        startedAt: new Date().toISOString(),
        backpack: cloneGridItems(profile.backpack.items),
        entryId,
      },
    });
    setProfile(next);
    setRaidEntryId(entryId);
    setNotice(null);
    publishDomainEvent({
      type: 'raid.started',
      raidId,
      mapId: 'hollow_01',
      entryId,
      at: new Date().toISOString(),
    });
    setMode('raid');
  }

  const handleRaidResult = useCallback((result: RaidResult) => {
    publishDomainEvent({
      type: 'raid.settled',
      raidId: profile.raidsStarted,
      mapId: 'hollow_01',
      result,
      at: new Date().toISOString(),
    });
    if (result.outcome === 'extracted') {
      const nextMapUnlocked = profile.mapUnlocked || result.mapUnlocked;
      const extractedCore = result.backpack.some((stack) => stack.itemId === 'echo_core');
      const nextBossDefeated = profile.bossDefeated || (result.bossDefeated && extractedCore);
      const recoveredWarehouse = insertGridStacks(profile.warehouse, profile.warehouseSize, result.recoveredItems);
      const next = saveRepository.save({
        ...profile,
        warehouse: recoveredWarehouse ?? profile.warehouse,
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
        discoveredClues: Array.from(new Set([...profile.discoveredClues, ...(result.discoveredClues ?? [])])),
        lostEcho: result.recoveredEcho && recoveredWarehouse ? null : profile.lostEcho,
        activeRaid: null,
      });
      setProfile(next);
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
    const lostItems = addStacks(addStacks(gridItemsToStacks(result.backpack), result.recoveredItems), carriedGear);
    const deathPosition = result.deathPosition ?? { x: 240, y: 1940 };
    const next = saveRepository.save({
      ...profile,
      loadout: {
        weapon: 'rust_nail',
        armor: null,
        head: null,
        shoes: 'soft_boots',
        backpack: 'field_pack',
      },
      backpack: { width: 4, height: 5, items: [] },
      armorCondition: 0,
      deaths: profile.deaths + 1,
      discoveredItems: Array.from(new Set([...profile.discoveredItems, ...(result.discoveredItems ?? [])])),
      discoveredClues: Array.from(new Set([...profile.discoveredClues, ...(result.discoveredClues ?? [])])),
      shortcutUnlocked: profile.shortcutUnlocked || result.shortcutUnlocked,
      lostEcho: {
        mapId: 'hollow_01',
        x: deathPosition.x,
        y: deathPosition.y,
        items: lostItems,
        createdAtRaid: profile.raidsStarted,
      },
      activeRaid: null,
    });
    setProfile(next);
    setNotice('远征失败。饼干岁送来了救济羽钉；遗失装备将在下一轮的死亡地点出现一次。');
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
      <Suspense fallback={<main className="game-loading">正在打开寂羽空洞…</main>}>
        <GameCanvas profile={profile} entryId={raidEntryId} onResult={handleRaidResult} />
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
      onEquipItem={handleEquipItem}
      onBuy={handleBuy}
      onSell={handleSell}
      onRepair={handleRepair}
      onUpgradeWarehouse={handleUpgradeWarehouse}
      onExport={() => saveRepository.export(profile)}
      onImport={handleImport}
      onReset={handleReset}
    />
  );
}
