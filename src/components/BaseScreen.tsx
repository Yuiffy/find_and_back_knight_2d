import { useRef } from 'react';
import { countItem, GEAR_SLOTS, getArmorMaximum, ITEMS, RARITY_NAMES, SLOT_NAMES } from '../game/items';
import type { GearSlot, PlayerProfile } from '../types/game';

interface BaseScreenProps {
  profile: PlayerProfile;
  objective: string;
  notice: string | null;
  onBeginRaid: (entryId: 'foyer' | 'lift') => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: GearSlot) => void;
  onRepair: () => void;
  onUpgradeStash: () => void;
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
  onEquip,
  onUnequip,
  onRepair,
  onUpgradeStash,
  onExport,
  onImport,
  onReset,
  onPlayEnding,
}: BaseScreenProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const armorMax = getArmorMaximum(profile);
  const dust = countItem(profile.stash, 'echo_dust');

  return (
    <main className="base-shell">
      <header className="base-header">
        <div className="brand-lockup">
          <span className="eyebrow">SUI: ECHOES BELOW · FIRST DESCENT</span>
          <h1>岁己：空响撤离</h1>
          <p>把故事带回来，才算直播成功。</p>
        </div>
        <div className="header-actions" aria-label="存档操作">
          <span className="save-status">● 已自动存档</span>
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

      <section className="objective-banner">
        <span className="objective-index">当前主线</span>
        <div>
          <strong>{objective}</strong>
          <p>目标会显示在未知地图上。按 M 随时确认方向。</p>
        </div>
        <span className="objective-arrow">↗</span>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="base-grid">
        <section className="panel hero-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EXPLORER</span>
              <h2>远征者 · 岁己 SUI</h2>
            </div>
            <span className="online-badge">📡 弱信号</span>
          </div>

          <div className="hero-stage">
            <div className="hero-halo" />
            <img src="/assets/sui-bird.png" alt="岁己的小鸟形态" />
            <span className="floating-cookie cookie-one">🍪</span>
            <span className="floating-cookie cookie-two">🍪</span>
            <div className="hero-caption">
              <strong>“只是普通户外直播。”</strong>
              <span>—— 距离地表约 4,800 米</span>
            </div>
          </div>

          <div className="stat-row">
            <div><span>生命</span><strong>♥ ♥ ♥ ♥ ♥</strong></div>
            <div><span>蓝甲</span><strong>{'◆ '.repeat(profile.armorCondition)}{'◇ '.repeat(Math.max(0, armorMax - profile.armorCondition)) || '无'}</strong></div>
            <div><span>远征</span><strong>{profile.raidsStarted}</strong></div>
            <div><span>撤离</span><strong>{profile.successfulExtractions}</strong></div>
          </div>
        </section>

        <section className="panel loadout-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LOADOUT</span>
              <h2>本次携行</h2>
            </div>
            <span className="risk-label">死亡会遗失</span>
          </div>

          <div className="loadout-list">
            {GEAR_SLOTS.map((slot) => {
              const itemId = profile.loadout[slot];
              const item = itemId ? ITEMS[itemId] : null;
              return (
                <button
                  className={`loadout-slot ${item ? `rarity-${item.rarity}` : 'is-empty'}`}
                  key={slot}
                  type="button"
                  onClick={() => onUnequip(slot)}
                  disabled={!item}
                  title={item ? '点击卸下到仓库' : '从仓库选择装备'}
                >
                  <span className="slot-icon">{item?.icon ?? '＋'}</span>
                  <span className="slot-copy">
                    <small>{SLOT_NAMES[slot]}</small>
                    <strong>{item?.name ?? '空槽位'}</strong>
                    <em>{item?.description ?? '点击下方仓库物品进行装备'}</em>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="maintenance-row">
            <button type="button" className="secondary-button" onClick={onRepair} disabled={profile.armorCondition >= armorMax || dust < 2}>
              🛠 修复护甲 · 2 ✨
            </button>
            <span>库存 {dust} ✨</span>
          </div>

          <button className="deploy-button" type="button" onClick={() => onBeginRaid('foyer')} disabled={!profile.loadout.weapon}>
            <span>进入寂羽空洞</span>
            <small>建议等级：初次远征 · 最近撤离点 680m</small>
          </button>
          {profile.shortcutUnlocked && (
            <button className="shortcut-button" type="button" onClick={() => onBeginRaid('lift')} disabled={!profile.loadout.weapon}>
              ⇣ 从维护电梯进入荧菌裂谷深层
            </button>
          )}
          {profile.lostEcho && (
            <div className="lost-echo-alert">
              <span>◉</span>
              <div><strong>检测到遗失回声</strong><p>位于上次死亡地点。再次倒下将覆盖它。</p></div>
            </div>
          )}
        </section>

        <section className="panel stash-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">STORAGE</span>
              <h2>饼干台仓库</h2>
            </div>
            <span className="capacity">{profile.stash.length} / {profile.stashCapacity} 格</span>
          </div>

          <div className="stash-grid">
            {profile.stash.map((stack, index) => {
              const item = ITEMS[stack.itemId];
              const canEquip = ['weapon', 'armor', 'head', 'shoes'].includes(item.category);
              return (
                <button
                  className={`stash-item rarity-${item.rarity}`}
                  key={`${stack.itemId}-${index}`}
                  type="button"
                  onClick={() => canEquip && onEquip(item.id)}
                  disabled={!canEquip}
                  title={canEquip ? `装备 ${item.name}` : item.description}
                >
                  <span className="item-icon">{item.icon}</span>
                  <strong>{item.name}</strong>
                  <small>{RARITY_NAMES[item.rarity]} · {item.category}</small>
                  {stack.quantity > 1 && <b>×{stack.quantity}</b>}
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, profile.stashCapacity - profile.stash.length) }).map((_, index) => (
              <div className="stash-empty" key={`empty-${index}`}><span>·</span></div>
            ))}
          </div>

          <div className="upgrade-row">
            <div><strong>仓库扩建</strong><span>增加 4 格，并把远征背包升级为 8 格。</span></div>
            <button type="button" className="secondary-button" onClick={onUpgradeStash} disabled={profile.stashCapacity >= 16 || dust < 6}>
              {profile.stashCapacity >= 16 ? '已完成' : '扩建 · 6 ✨'}
            </button>
          </div>
        </section>

        <section className="panel intel-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EXPEDITION INTEL</span>
              <h2>寂羽空洞</h2>
            </div>
            <span className={profile.mapUnlocked ? 'map-ready' : 'map-unknown'}>{profile.mapUnlocked ? '地图已测绘' : '相对位置可用'}</span>
          </div>

          <div className={`mini-map ${profile.mapUnlocked ? 'is-unlocked' : ''}`} aria-label="寂羽空洞地图示意">
            <div className="map-line" />
            <span className="map-node node-base">⌂<small>前庭</small></span>
            <span className="map-node node-rift">◌<small>{profile.mapUnlocked ? '荧菌裂谷' : '未知区'}</small></span>
            <span className="map-node node-core">◇<small>{profile.mapUnlocked ? '静默机房' : '深层信号'}</small></span>
            <span className="map-you">▲ 你</span>
          </div>

          <ul className="intel-list">
            <li><span className={profile.successfulExtractions > 0 ? 'done' : ''}>01</span> 首次安全撤离</li>
            <li><span className={profile.mapUnlocked ? 'done' : ''}>02</span> 找回导航羽片</li>
            <li><span className={profile.shortcutUnlocked ? 'done' : ''}>03</span> 启动维护电梯</li>
            <li><span className={profile.bossDefeated ? 'done' : ''}>04</span> 取得回声核心</li>
          </ul>

          {profile.endingUnlocked && (
            <button className="signal-button" type="button" onClick={onPlayEnding}>📡 启动直播信标</button>
          )}
        </section>
      </div>

      <footer className="base-footer">
        <span>基地操作：点击物品装备 · 装备带入远征后会承担风险</span>
        <span>版本 0.1 · LOCAL PROFILE SERVICE</span>
      </footer>
    </main>
  );
}
