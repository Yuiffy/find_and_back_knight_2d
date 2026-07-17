import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BaseScreen } from './components/BaseScreen';
import { addItem, addStacks, removeItem } from './game/inventory';
import { getArmorMaximum, getCurrentObjective, ITEMS } from './game/items';
import { saveRepository } from './services/saveRepository';
import { publishDomainEvent } from './services/gameNetworkBoundary';
import type { GearSlot, PlayerProfile, RaidResult, TextGameState } from './types/game';

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
    if (mode !== 'base') return;
    const textState: TextGameState = { mode: 'base', objective };
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

  function handleEquip(itemId: string): void {
    const item = ITEMS[itemId];
    if (!item || !['weapon', 'armor', 'head', 'shoes'].includes(item.category)) return;
    const slot = item.category as GearSlot;
    const withoutNew = removeItem(profile.stash, itemId, 1);
    if (!withoutNew) return;
    const oldItemId = profile.loadout[slot];
    const nextStash = oldItemId ? addItem(withoutNew, oldItemId) : withoutNew;
    const next = {
      ...profile,
      stash: nextStash,
      loadout: { ...profile.loadout, [slot]: itemId },
    };
    if (slot === 'armor') next.armorCondition = getArmorMaximum(next);
    commit(next, `${item.icon} 已装备：${item.name}`);
  }

  function handleUnequip(slot: GearSlot): void {
    const itemId = profile.loadout[slot];
    if (!itemId) return;
    if (profile.stash.length >= profile.stashCapacity) {
      setNotice('仓库已满，暂时无法卸下装备。');
      return;
    }
    const next = {
      ...profile,
      stash: addItem(profile.stash, itemId),
      loadout: { ...profile.loadout, [slot]: null },
      armorCondition: slot === 'armor' ? 0 : profile.armorCondition,
    };
    commit(next, `${ITEMS[itemId].name} 已放回仓库。`);
  }

  function handleRepair(): void {
    const armorMax = getArmorMaximum(profile);
    const nextStash = removeItem(profile.stash, 'echo_dust', 2);
    if (!nextStash || profile.armorCondition >= armorMax) return;
    commit({ ...profile, stash: nextStash, armorCondition: armorMax }, '护甲已完全修复。');
  }

  function handleUpgradeStash(): void {
    if (profile.stashCapacity >= 16) return;
    const nextStash = removeItem(profile.stash, 'echo_dust', 6);
    if (!nextStash) return;
    commit({ ...profile, stash: nextStash, stashCapacity: 16, backpackCapacity: 8 }, '仓库扩建完成，远征背包也扩为 8 格。');
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
        backpack: [],
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
      const next = saveRepository.save({
        ...profile,
        stash: addStacks(profile.stash, result.backpack),
        armorCondition: result.armorCondition,
        successfulExtractions: profile.successfulExtractions + 1,
        mapUnlocked: nextMapUnlocked,
        shortcutUnlocked: profile.shortcutUnlocked || result.shortcutUnlocked,
        bossDefeated: nextBossDefeated,
        endingUnlocked: profile.endingUnlocked || nextBossDefeated,
        lostEcho: result.recoveredEcho ? null : profile.lostEcho,
        activeRaid: null,
      });
      setProfile(next);
      setNotice(`安全撤离成功：${result.backpack.reduce((sum, stack) => sum + stack.quantity, 0)} 件战利品已入仓。`);
      setMode('base');
      return;
    }

    const carriedGear = Object.values(profile.loadout)
      .filter((itemId): itemId is string => Boolean(itemId))
      .map((itemId) => ({ itemId, quantity: 1 }));
    const lostItems = addStacks(result.backpack, carriedGear);
    const deathPosition = result.deathPosition ?? { x: 180, y: 560 };
    const next = saveRepository.save({
      ...profile,
      loadout: {
        weapon: 'rust_nail',
        armor: null,
        head: null,
        shoes: 'soft_boots',
      },
      armorCondition: 0,
      deaths: profile.deaths + 1,
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

  function handlePlayEnding(): void {
    const next = saveRepository.save({ ...profile, endingSeen: true });
    setProfile(next);
    setMode('ending');
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
        <img className="ending-bird" src="/assets/sui-bird.png" alt="岁己望向重新亮起的直播信标" />
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
      onEquip={handleEquip}
      onUnequip={handleUnequip}
      onRepair={handleRepair}
      onUpgradeStash={handleUpgradeStash}
      onExport={() => saveRepository.export(profile)}
      onImport={handleImport}
      onReset={handleReset}
      onPlayEnding={handlePlayEnding}
    />
  );
}
