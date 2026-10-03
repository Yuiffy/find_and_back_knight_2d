import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowLeft,
  Backpack,
  Crosshair,
  Shield,
  HeartPulse,
  Volume2,
  VolumeX,
  Settings2,
  Package,
  Radio,
  ChevronRight,
  X,
  Download,
  Upload,
  HelpCircle,
  Pause,
  Play,
  LockKeyhole,
  Zap,
  Check,
  Skull,
} from 'lucide-react';
import {
  CONTRACTS,
  ITEMS,
  WEAPONS,
  SAVE_KEY,
  canDeploy,
  deploy,
  freshProfile,
  normalizeProfile,
  packCapacity,
  readProfile,
  recoverInterrupted,
  settle,
  stashCapacity,
  writeProfile,
  type ItemId,
  type Loadout,
  type Profile,
  type WeaponId,
} from './model';
import { Raid } from './simulation';
import { EXITS, OBSTACLES, POWER, RADAR, SECTORS } from './map';
import World, { type ViewBridge } from './World';
import { FieldAudio } from './audio';
import { WeaponArtwork } from './WeaponArtwork';
import './extraction.css';
import './visual.css';

const time = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60)
    .toString()
    .padStart(2, '0')}`;
const money = (value: number) => value.toLocaleString('zh-CN');
type Panel = '' | 'bag' | 'map' | 'pause' | 'help' | 'settings';
function ItemTile({
  item,
  children,
}: {
  item: ItemId;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="ex-item"
      style={{ '--item-color': ITEMS[item].color } as React.CSSProperties}
    >
      <span className="ex-item-code">{ITEMS[item].label}</span>
      <div>
        <strong>{ITEMS[item].name}</strong>
        <small>
          {ITEMS[item].weight} kg · ₭ {money(ITEMS[item].value)}
        </small>
      </div>
      {children}
    </div>
  );
}
function TacticalMap({ raid, small = false }: { raid: Raid; small?: boolean }) {
  return (
    <svg
      className={small ? 'ex-minimap' : 'ex-map-svg'}
      viewBox="-51 -51 102 102"
      role="img"
      aria-label="雾港战术地图：上北下南，绿色为撤离，黄色为供电，蓝色为雷达"
    >
      <rect x="-50" y="-50" width="100" height="100" fill="#172c28" />
      {[-40, -20, 0, 20, 40].map((x) => (
        <g key={x} stroke="#29423b" strokeWidth=".2">
          <path d={`M ${x} -50 V 50 M -50 ${x} H 50`} />
        </g>
      ))}
      <path
        d="M -5 -45 V 45 M -45 29 H 45 M -45 -17 H 45"
        stroke="#3f5145"
        strokeWidth="5"
      />
      {OBSTACLES.map((o, i) => (
        <rect
          key={i}
          x={o.x - o.w / 2}
          y={o.z - o.d / 2}
          width={o.w}
          height={o.d}
          fill="#7f8d75"
        />
      ))}
      {raid.crates
        .filter((c) => c.loot.length)
        .map((c) => (
          <rect
            key={c.id}
            x={c.x - 0.6}
            y={c.z - 0.6}
            width="1.2"
            height="1.2"
            fill="#e4c38c"
          />
        ))}
      {EXITS.map((e) => (
        <g key={e.id}>
          <circle
            cx={e.x}
            cy={e.z}
            r="3"
            fill="none"
            stroke={e.requiresPower && !raid.powered ? '#c88d5b' : '#a4e7b1'}
            strokeWidth=".7"
          />
          {!small && (
            <text
              x={e.x}
              y={e.z - 4.5}
              textAnchor="middle"
              fill="#c1ebc5"
              fontSize="2.6"
            >
              {e.requiresPower && !raid.powered ? '需供电' : '撤离'}
            </text>
          )}
        </g>
      ))}
      <rect
        x={POWER.x - 1}
        y={POWER.z - 1}
        width="2"
        height="2"
        fill="#efbd69"
      />
      <circle cx={RADAR.x} cy={RADAR.z} r="1.5" fill="#90b9ee" />
      {!small &&
        SECTORS.map((s) => (
          <text
            key={s.name}
            x={s.x}
            y={s.z + 8}
            textAnchor="middle"
            fill="#c1cec0"
            fontSize="3"
          >
            {s.name}
          </text>
        ))}
      {raid.lost && !raid.recovered && (
        <path
          d={`M ${raid.lost.x - 1} ${raid.lost.z - 1} l 2 2 m 0 -2 l -2 2`}
          stroke="#ee977e"
          strokeWidth="1"
        />
      )}
      {raid.enemies
        .filter((e) => e.hp > 0 && e.mode === 'engage')
        .map((e) => (
          <circle key={e.id} cx={e.x} cy={e.z} r=".9" fill="#ed936e" />
        ))}
      <g
        transform={`translate(${raid.player.x} ${raid.player.z}) rotate(${(-raid.player.angle * 180) / Math.PI})`}
      >
        <path d="M 0 2.3 L -1.6 -1.5 L 1.6 -1.5 Z" fill="#e8f9dd" />
      </g>
      <text x="-46" y="-43" fill="#e9ecd7" fontSize="4">
        N ↑
      </text>
    </svg>
  );
}
export default function ExtractionGame() {
  const [initial] = useState(() => readProfile());
  const [profile, setProfile] = useState(() =>
    recoverInterrupted(initial.profile),
  );
  const profileRef = useRef(profile);
  const [warning, setWarning] = useState(initial.warning);
  const [raid, setRaid] = useState<Raid | null>(null);
  const [loadout, setLoadout] = useState<Loadout>(() => ({
    weapon: 'kestrel',
    armor: profile.armors > 0,
    meds: Math.min(2, profile.meds),
    suppressor: false,
  }));
  const [tab, setTab] = useState<'briefing' | 'loadout' | 'stash'>('briefing');
  const [panel, setPanel] = useState<Panel>('');
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [frame, redraw] = useState(0);
  const [notice, setNotice] = useState('');
  const [operatorYaw, setOperatorYaw] = useState(-.18);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const inputKeys = useRef(new Set<string>()),
    manualClock = useRef(false);
  const audio = useRef(new FieldAudio());
  const bridge = useMemo<ViewBridge>(
    () => ({
      pointer: { x: 0, y: 0, active: false },
      project: () => ({ x: 0, y: 0 }),
    }),
    [],
  );
  const baseWorld = useMemo(() => {
    const world = new Raid(freshProfile(), {
      weapon: 'kestrel',
      armor: true,
      meds: 2,
      suppressor: false,
    });
    world.player.x = -14;
    world.player.z = 28;
    world.player.angle = -0.6;
    return world;
  }, []);
  const worldRaid = raid ?? baseWorld;
  const active = raid?.phase === 'raid';
  const commit = useCallback((p: Profile) => {
    profileRef.current = p;
    setProfile(p);
    if (!writeProfile(p))
      setWarning('浏览器无法保存。请导出存档，避免刷新后丢失进度。');
  }, []);
  useEffect(() => {
    if (initial.profile.active && !initial.warning) commit(profileRef.current);
  }, [initial, commit]);
  useEffect(() => {
    audio.current.muted = profile.settings.muted;
  }, [profile.settings.muted]);
  useEffect(() => () => audio.current.dispose(), []);
  const updateUI = useCallback(() => redraw((n) => n + 1), []);
  useEffect(() => {
    const keys = inputKeys.current;
    const clear = () => {
      keys.clear();
      if (raid) {
        raid.input.x = raid.input.z = 0;
        raid.input.fire = false;
        raid.input.sprint = false;
      }
    };
    const blur = () => {
      clear();
      if (raid?.phase === 'raid') {
        raid.paused = true;
        setPanel('pause');
      }
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    const keyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input,select,textarea'))
        return;
      const blockingMenu = ['pause', 'help', 'settings'].includes(
        panelRef.current,
      );
      if (
        raid?.phase === 'raid' &&
        !blockingMenu &&
        ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          event.code,
        )
      )
        event.preventDefault();
      audio.current.unlock();
      keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'KeyF') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
      if (!raid || raid.phase !== 'raid') return;
      if (event.code === 'Escape') {
        if (raid.search) raid.search = null;
        else setPanel((p) => (p ? '' : 'pause'));
      }
      if (blockingMenu) return;
      if (event.code === 'Tab') {
        raid.search = null;
        setPanel((p) => (p === 'bag' ? '' : 'bag'));
      }
      if (event.code === 'KeyM') {
        raid.search = null;
        setPanel((p) => (p === 'map' ? '' : 'map'));
      }
      if (event.code === 'KeyE' && !panelRef.current) {
        if (raid.search) raid.search = null;
        else raid.interact();
      }
      if (event.code === 'KeyR' && !panelRef.current) raid.startReload();
      if (event.code === 'KeyH' && !panelRef.current) raid.heal();
      updateUI();
    };
    const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const pointerUp = (event: PointerEvent) => {
      if (raid && event.pointerType === 'mouse') {
        raid.input.fire = false;
        raid.input.ads = false;
      }
    };
    const mouseUp = (e: MouseEvent) => {
      if (raid) {
        if (e.button === 0) raid.input.fire = false;
        if (e.button === 2) raid.input.ads = false;
      }
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('mouseup', mouseUp);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clear();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('mouseup', mouseUp);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [raid, updateUI]);
  useEffect(() => {
    if (raid) {
      raid.paused = ['pause', 'help', 'settings'].includes(panel);
      if (panel) {
        raid.input.fire = false;
        raid.input.ads = false;
      }
      if (raid.paused) inputKeys.current.clear();
    }
  }, [panel, raid]);
  useEffect(() => {
    let raf = 0,
      previous = performance.now(),
      lastUI = 0,
      settled = false;
    const update = (dt: number) => {
      if (!raid) return;
      const keys = inputKeys.current;
      if (keys.size) {
        raid.input.x =
          Number(keys.has('KeyD') || keys.has('ArrowRight')) -
          Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        raid.input.z =
          Number(keys.has('KeyS') || keys.has('ArrowDown')) -
          Number(keys.has('KeyW') || keys.has('ArrowUp'));
      } else if (!touchRef.current.move) raid.input.x = raid.input.z = 0;
      raid.input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      raid.input.crouch = keys.has('KeyC');
      raid.update(dt);
      for (const event of raid.events.splice(0)) audio.current.play(event);
      if (raid.phase !== 'raid' && !settled) {
        settled = true;
        commit(settle(profileRef.current, raid.result()));
        setPanel('');
        updateUI();
      }
    };
    const loop = (now: number) => {
      if (!manualClock.current) {
        const elapsed = Math.min((now - previous) / 1000, 0.1);
        for (let left = elapsed; left > 0; left -= 1 / 60)
          update(Math.min(left, 1 / 60));
      }
      previous = now;
      if (now - lastUI > 90) {
        updateUI();
        lastUI = now;
      }
      raf = requestAnimationFrame(loop);
    };
    window.advanceTime = async (milliseconds: number) => {
      manualClock.current = true;
      const ms = Math.min(120000, Math.max(0, milliseconds));
      for (let left = ms / 1000; left > 1e-8; left -= 1 / 60)
        update(Math.min(left, 1 / 60));
      updateUI();
    };
    window.render_game_to_text = () =>
      JSON.stringify(
        raid
          ? {
              ...raid.text(),
              panel: panelRef.current,
              profile: profileRef.current,
              visual: bridge.visual,
              screen: {
                player: bridge.project(raid.player.x, raid.player.z),
                enemies: raid.enemies
                  .filter((e) => e.hp > 0)
                  .map((e) => ({ id: e.id, ...bridge.project(e.x, e.z) })),
              },
            }
          : { mode: 'extraction', phase: 'base', profile: profileRef.current, visual: bridge.visual, operatorYaw },
      );
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [raid, commit, updateUI, bridge, operatorYaw]);
  const touchRef = useRef({ move: false, aim: false });
  function start() {
    if (!canDeploy(profile, loadout) || warning) return;
    const next = deploy(profile, loadout);
    if (!writeProfile(next)) {
      setWarning('无法写入出击记录，请检查浏览器存储后重试。');
      return;
    }
    commit(next);
    setRaid(new Raid(next, loadout));
    setPanel('');
    manualClock.current = false;
    audio.current.unlock();
    inputKeys.current.clear();
  }
  function home() {
    setRaid(null);
    setPanel('');
    setTab('briefing');
    setLoadout((l) => ({
      ...l,
      armor: profile.armors > 0,
      meds: Math.min(2, profile.meds),
      suppressor: l.suppressor && profile.suppressors > 0,
    }));
  }
  function purchase(
    kind: WeaponId | 'armor' | 'med' | 'suppressor' | 'pack' | 'stash',
  ) {
    const n = structuredClone(profile);
    const prices = {
      armor: 220,
      med: 65,
      suppressor: 300,
      pack: 800 + n.packLevel * 600,
      stash: 600 + n.stashLevel * 600,
    };
    const cost =
      kind in WEAPONS
        ? WEAPONS[kind as WeaponId].price
        : prices[kind as keyof typeof prices];
    if (n.credits < cost) {
      setNotice('资金不足 · 可出售带回的物资');
      return;
    }
    if (
      (kind === 'pack' && n.packLevel === 2) ||
      (kind === 'stash' && n.stashLevel === 2)
    )
      return;
    n.credits -= cost;
    if (kind in WEAPONS) n.guns[kind as WeaponId]++;
    else if (kind === 'armor') n.armors++;
    else if (kind === 'med') n.meds++;
    else if (kind === 'suppressor') n.suppressors++;
    else if (kind === 'pack') n.packLevel++;
    else n.stashLevel++;
    commit(n);
    setNotice('已加入仓库');
  }
  function sell(index: number) {
    const n = structuredClone(profile),
      [item] = n.stash.splice(index, 1);
    if (item) {
      n.credits += ITEMS[item].value;
      commit(n);
    }
  }
  function rescue() {
    if (Object.values(profile.guns).some((n) => n > 0)) return;
    const n = structuredClone(profile);
    n.guns.kestrel++;
    n.meds++;
    commit(n);
    setLoadout({ weapon: 'kestrel', armor: false, meds: 1, suppressor: false });
    setNotice('救援装备已领取 · 任何时候都能重新出发');
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify(profile, null, 2)], {
        type: 'application/json',
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = '雾港行动-存档.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSave(file?: File) {
    if (!file || active) return;
    try {
      const p = normalizeProfile(JSON.parse(await file.text()));
      if (p.active) throw new Error('请导入已结束行动的存档');
      commit(p);
      setWarning('');
      setNotice('存档已恢复');
      setLoadout({
        weapon: 'kestrel',
        armor: p.armors > 0,
        meds: Math.min(2, p.meds),
        suppressor: false,
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '无法读取存档');
    }
  }
  const contract = CONTRACTS[Math.min(profile.contract, 2)];
  const selectedCrate = raid?.crates.find((c) => c.id === raid.search);
  const modal = panel || (selectedCrate ? 'search' : '');
  void frame;
  return (
    <main
      className={`ex-app ${active ? 'is-raid' : 'is-base'} ${profile.settings.reducedMotion ? 'reduce-motion' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!raid && <div className="ex-base-backdrop" />}
      <div
        className="ex-world"
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') {
            bridge.pointer.x = e.clientX;
            bridge.pointer.y = e.clientY;
            bridge.pointer.active = true;
          }
        }}
        onMouseDown={(e) => {
          audio.current.unlock();
          if (!active || modal) return;
          if (e.button === 0) raid.input.fire = true;
          if (e.button === 2) raid.input.ads = true;
        }}
      >
        <World
          raid={worldRaid}
          base={!raid}
          quality={profile.settings.quality}
          bridge={bridge}
          loadout={raid?.loadout ?? loadout}
          reducedMotion={profile.settings.reducedMotion}
          baseRotation={operatorYaw}
        />
      </div>
      <div className="ex-cinematic-edge" aria-hidden="true" />
      {!raid && (
        <>
          <div className="ex-base-shade" />
          <header className="ex-header">
            <a className="ex-brand" href={import.meta.env.BASE_URL}>
              <span className="ex-brand-mark"><img src={`${import.meta.env.BASE_URL}assets/sui-bird.png`} alt="" /></span>
              <span>
                岁己 · 雾港行动<small>FOGHARBOR / SUI'S RETURN</small>
              </span>
            </a>
            <div className="ex-header-right">
              <span className="ex-online">● 离线行动 / 本地存档</span>
              <strong>₭ {money(profile.credits)}</strong>
              <button aria-label="设置" onClick={() => setPanel('settings')}>
                <Settings2 size={19} />
              </button>
            </div>
          </header>
          <nav className="ex-tabs" aria-label="基地导航">
            {(
              [
                ['briefing', '行动简报'],
                ['loadout', '装备整备'],
                ['stash', '仓库 / 后勤'],
              ] as const
            ).map(([id, name], i) => (
              <button
                key={id}
                className={tab === id ? 'selected' : ''}
                onClick={() => {
                  setTab(id);
                  setNotice('');
                }}
              >
                <small>0{i + 1}</small>
                {name}
              </button>
            ))}
          </nav>
          {warning && (
            <div className="ex-warning" role="alert">
              {warning}
              <button
                onClick={() => {
                  try {
                    const raw = localStorage.getItem(SAVE_KEY);
                    if (raw) localStorage.setItem(`${SAVE_KEY}.backup`, raw);
                    if (writeProfile(profile)) setWarning('');
                  } catch {
                    /* Keep warning visible. */
                  }
                }}
              >
                备份旧记录并启用保存
              </button>
            </div>
          )}
          {tab === 'briefing' && (
            <section className="ex-briefing">
              <span className="ex-kicker"><Radio size={13} /> 归航频段 07 / SIGNAL LOST</span>
              <h1>
                岁己的
                <br />
                <em>雾港行动</em>
              </h1>
              <p className="ex-intro">
                “饼干岁，收到请回话。”
                <br />
                带回信号，找到回家的方向。
              </p>
              <div className="ex-mission">
                <span className="ex-kicker">
                  <Radio size={14} /> 当前委托
                </span>
                <h2>
                  {profile.contract >= 3
                    ? '自由行动 / 重返禁区'
                    : contract.title}
                </h2>
                <p>
                  {profile.contract >= 3
                    ? '归航信号已接通。高危巡逻队已进入雾港，继续收集物资并提升装备。'
                    : contract.text}
                </p>
                <small>
                  {profile.contract >= 3
                    ? '高危轮次 · 额外巡逻队'
                    : `完成奖励 ₭ ${money(contract.reward)} · 必须成功撤离`}
                </small>
              </div>
              <div className="ex-brief-stats">
                <span>
                  <b>10:00</b>行动窗口
                </span>
                <span>
                  <b>04</b>探索区域
                </span>
                <span>
                  <b>02</b>撤离方案
                </span>
              </div>
              <button
                className="ex-primary ex-deploy"
                onClick={() => setTab('loadout')}
              >
                准备部署 <ArrowUpRight size={22} />
              </button>
              <button className="ex-link" onClick={() => setPanel('help')}>
                <HelpCircle size={15} /> 首次行动？查看生存手册
              </button>
            </section>
          )}
          {tab === 'briefing' && (
            <>
              <aside className="ex-operator-identity" aria-label="岁己角色展示">
                <span className="ex-kicker">OPERATOR / 07</span>
                <div><img src={`${import.meta.env.BASE_URL}assets/fogharbor/sui-portrait.webp`} alt="岁己红帽形象" /><span><strong>岁己 <em>SUI</em></strong><small>银喉长尾山雀 · 归航者</small></span></div>
                <p>“等我回来，还要给你们直播呢。”</p>
                <div className="ex-operator-turn">
                  <button aria-label="向左旋转岁己" onClick={() => setOperatorYaw(y => y - Math.PI / 4)}><ArrowLeft size={14} /></button>
                  <span>查看角色</span>
                  <button aria-label="向右旋转岁己" onClick={() => setOperatorYaw(y => y + Math.PI / 4)}><ChevronRight size={14} /></button>
                </div>
              </aside>
              <aside className="ex-location"><span>31° 14′ N / 121° 29′ E</span><p>雨蚀港区 · 南岸接应点</p><div><i /> 雨后晨雾 <span>单人 PVE</span></div></aside>
            </>
          )}
          {tab === 'loadout' && (
            <section className="ex-base-panel ex-loadout">
              <div className="ex-panel-heading">
                <div>
                  <span className="ex-kicker">
                    LOADOUT / {profile.raids + 1}
                  </span>
                  <h1>选择你愿意承担的风险</h1>
                </div>
                <Crosshair size={28} />
              </div>
              <div className="ex-loadout-grid">
                <div>
                  <h3>
                    主武器 <small>失败将遗失已部署装备</small>
                  </h3>
                  <div className="ex-weapons">
                    {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
                      <button
                        key={id}
                        className={`ex-weapon ${loadout.weapon === id ? 'selected' : ''}`}
                        onClick={() =>
                          setLoadout((l) => ({ ...l, weapon: id }))
                        }
                      >
                        <span className="ex-weapon-top">
                          {WEAPONS[id].type}
                          <small>库存 {profile.guns[id]}</small>
                        </span>
                        <WeaponArtwork weapon={id} />
                        <strong>{WEAPONS[id].name}</strong>
                        <small>{WEAPONS[id].description}</small>
                        <span className="ex-weapon-stats">
                          伤害 {WEAPONS[id].damage}{' '}
                          <span>射程 {WEAPONS[id].range} m</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="ex-kit-options">
                    <label>
                      <input
                        type="checkbox"
                        checked={loadout.armor}
                        onChange={(e) =>
                          setLoadout((l) => ({ ...l, armor: e.target.checked }))
                        }
                      />
                      <Shield size={18} />
                      <span>
                        复合护甲<small>75 点防护 · 库存 {profile.armors}</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={loadout.suppressor}
                        onChange={(e) =>
                          setLoadout((l) => ({
                            ...l,
                            suppressor: e.target.checked,
                          }))
                        }
                      />
                      <Crosshair size={18} />
                      <span>
                        消音器
                        <small>
                          枪声传播 26 → 9 m · 库存 {profile.suppressors}
                        </small>
                      </span>
                    </label>
                    <label>
                      <HeartPulse size={18} />
                      <span>
                        医疗包
                        <small>恢复 55 生命并止血 · 库存 {profile.meds}</small>
                      </span>
                      <select
                        aria-label="携带医疗包数量"
                        value={loadout.meds}
                        onChange={(e) =>
                          setLoadout((l) => ({
                            ...l,
                            meds: Number(e.target.value),
                          }))
                        }
                      >
                        {[0, 1, 2, 3].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <aside className="ex-deploy-brief">
                  <span className="ex-kicker">行动路线</span>
                  <h2>南岸 → 货场 → 撤离</h2>
                  <p>
                    先搜索出生点前方的补给箱。带回两件物资即可完成首次委托。
                  </p>
                  <p>
                    医疗站位于东侧；雷达位于最北端。更深处意味着更高收益，也有更强守卫。
                  </p>
                  <div>
                    <Backpack size={16} /> {packCapacity(profile)} 格背包 + 1
                    格保险箱
                  </div>
                  <div>
                    <LockKeyhole size={16} /> 死亡后仅保留保险格
                  </div>
                  <small>
                    刷新 / 关闭页面视作行动中断。请从暂停菜单离开或完成撤离。
                  </small>
                  <button
                    id="ex-deploy"
                    className="ex-primary"
                    disabled={!canDeploy(profile, loadout) || !!warning}
                    onClick={start}
                  >
                    部署进入雾港 <ArrowUpRight size={20} />
                  </button>
                  {!canDeploy(profile, loadout) && (
                    <p className="ex-danger-text">
                      库存不足，请在后勤采购或取消缺少的装备。
                    </p>
                  )}
                  {!Object.values(profile.guns).some((n) => n > 0) && (
                    <button onClick={rescue}>领取免费救援装备</button>
                  )}
                </aside>
              </div>
            </section>
          )}
          {tab === 'stash' && (
            <section className="ex-base-panel ex-stash">
              <div className="ex-panel-heading">
                <div>
                  <span className="ex-kicker">STORAGE & LOGISTICS</span>
                  <h1>每次归来，都留下积累</h1>
                </div>
                <strong>
                  {profile.stash.length} / {stashCapacity(profile)} 格
                </strong>
              </div>
              <div className="ex-stash-layout">
                <div>
                  <h3>
                    已带回物资 <small>出售换取装备与升级资金</small>
                  </h3>
                  <div className="ex-items">
                    {profile.stash.map((item, index) => (
                      <ItemTile key={`${index}-${item}`} item={item}>
                        <button onClick={() => sell(index)}>出售</button>
                      </ItemTile>
                    ))}
                  </div>
                  {!profile.stash.length && (
                    <div className="ex-empty">
                      <Package size={36} />
                      <h3>仓库正等着你回来</h3>
                      <p>撤离成功后，现场物资会自动存入这里。</p>
                    </div>
                  )}
                  <div className="ex-service-row">
                    <button onClick={exportSave}>
                      <Download size={15} /> 导出存档
                    </button>
                    <label className="ex-file">
                      <Upload size={15} /> 导入存档
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          void importSave(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <aside className="ex-shop">
                  <h3>后勤采购</h3>
                  {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
                    <div key={id}>
                      <span>
                        {WEAPONS[id].name}
                        <small>库存 {profile.guns[id]}</small>
                      </span>
                      <button onClick={() => purchase(id)}>
                        ₭ {WEAPONS[id].price}
                      </button>
                    </div>
                  ))}
                  {(
                    [
                      ['armor', '复合护甲', 220, profile.armors],
                      ['med', '医疗包', 65, profile.meds],
                      ['suppressor', '消音器', 300, profile.suppressors],
                    ] as const
                  ).map(([id, label, cost, stock]) => (
                    <div key={id}>
                      <span>
                        {label}
                        <small>库存 {stock}</small>
                      </span>
                      <button onClick={() => purchase(id)}>₭ {cost}</button>
                    </div>
                  ))}
                  <h3>基地升级</h3>
                  <div>
                    <span>
                      战术背包 Lv.{profile.packLevel + 1}
                      <small>增加 5 格 / 提高负重阈值</small>
                    </span>
                    <button
                      disabled={profile.packLevel >= 2}
                      onClick={() => purchase('pack')}
                    >
                      {profile.packLevel >= 2
                        ? '已满级'
                        : `₭ ${800 + profile.packLevel * 600}`}
                    </button>
                  </div>
                  <div>
                    <span>
                      仓库扩建 Lv.{profile.stashLevel + 1}
                      <small>增加 16 格 · 满仓时自动出售溢出物资</small>
                    </span>
                    <button
                      disabled={profile.stashLevel >= 2}
                      onClick={() => purchase('stash')}
                    >
                      {profile.stashLevel >= 2
                        ? '已满级'
                        : `₭ ${600 + profile.stashLevel * 600}`}
                    </button>
                  </div>
                  {!Object.values(profile.guns).some((n) => n > 0) && (
                    <button onClick={rescue}>领取免费救援装备</button>
                  )}
                </aside>
              </div>
            </section>
          )}
          <footer className="ex-base-footer">
            <span>
              岁己 / SUI <b>·</b> 成功撤离 {profile.wins} / {profile.raids}
            </span>
            <div>
              <a href="?mode=lantern">借光归来 · 2D</a>
              <a href="?mode=legacy">空响撤离 · 原版</a>
              <span>归航频段 / 07</span>
            </div>
          </footer>
          {notice && (
            <div
              className="ex-notice"
              role="status"
              onClick={() => setNotice('')}
            >
              {notice}
              <X size={14} />
            </div>
          )}
        </>
      )}
      {active && (
        <>
          <header className="ex-raid-top">
            <div className="ex-raid-objective">
              <span className="ex-kicker">
                雾港 / {profile.contract >= 3 ? '高危行动' : '标准行动'}
              </span>
              <strong>
                {profile.contract >= 3 ? '收集物资，安全撤离' : contract.title}
              </strong>
              <small>
                {profile.contract >= 3 ? '北境增派巡逻队' : contract.text}
              </small>
            </div>
            <div className="ex-raid-clock">
              <span>撤离窗口</span>
              <strong
                className={
                  raid.limit - raid.elapsed < 90 ? 'ex-danger-text' : ''
                }
              >
                {time(raid.limit - raid.elapsed)}
              </strong>
              <button aria-label="暂停" onClick={() => setPanel('pause')}>
                <Pause size={18} />
              </button>
            </div>
          </header>
          <button
            className="ex-map-button"
            aria-label="打开战术地图"
            onClick={() => setPanel('map')}
          >
            <TacticalMap raid={raid} small />
            <span>M / 战术地图</span>
          </button>
          <div className="ex-status">
            <div className="ex-sui-hud"><img src={`${import.meta.env.BASE_URL}assets/fogharbor/sui-portrait.webp`} alt="岁己" /><span>岁己 <b>SUI / 07</b></span></div>
            <div className="ex-health">
              <HeartPulse size={17} />
              <b>{Math.ceil(raid.player.hp)}</b>
              <span>
                <i style={{ width: `${raid.player.hp}%` }} />
              </span>
              {raid.player.bleed && <em>流血 · H 包扎</em>}
            </div>
            <div className="ex-substatus">
              <span>
                <Shield size={14} /> {Math.ceil(raid.player.armor)}
              </span>
              <span className="ex-stamina">
                体力 <i style={{ width: `${raid.player.stamina * 0.6}px` }} />
              </span>
              <span>
                {raid.input.crouch
                  ? '低姿降噪'
                  : raid.noise > 0.2
                    ? '枪声暴露'
                    : '静默'}
              </span>
            </div>
            <div className="ex-quick">
              <button
                onClick={() => {
                  raid.heal();
                  updateUI();
                }}
              >
                H 医疗 <b>{raid.meds}</b>
              </button>
              <button onClick={() => setPanel('bag')}>
                <Backpack size={14} /> {raid.bag.length}/{raid.capacity}
              </button>
              <button onClick={() => setPanel('help')}>?</button>
            </div>
          </div>
          <div className="ex-ammo">
            <span>{WEAPONS[raid.loadout.weapon].name}</span>
            <div>
              <strong>{raid.mag.toString().padStart(2, '0')}</strong>
              <i>/ {raid.ammo}</i>
            </div>
            <button
              onClick={() => {
                raid.startReload();
                updateUI();
              }}
            >
              {raid.reload ? `换弹中 ${raid.reload.toFixed(1)}s` : 'R 换弹'}
            </button>
          </div>
          {!modal && (
            <div className="ex-context">
              {raid.extraction > 0 ? (
                <div className="ex-extract-progress">
                  <Radio size={18} />
                  <strong>
                    接应中 · {(6 - raid.extraction).toFixed(1)} 秒
                  </strong>
                  <span>留在绿色区域内 · 受击会中断</span>
                  <progress max="6" value={raid.extraction} />
                </div>
              ) : raid.powerProgress || raid.radarProgress ? (
                <div className="ex-action-progress">
                  <Zap size={18} />
                  {raid.powerProgress ? '恢复电力' : '启动归航信号'}
                  <progress
                    max={raid.powerProgress ? 3 : 4}
                    value={raid.powerProgress || raid.radarProgress}
                  />
                </div>
              ) : raid.healing ? (
                <div className="ex-action-progress">
                  正在包扎 <progress max="2.5" value={2.5 - raid.healing} />
                </div>
              ) : raid.nearby ? (
                <button
                  className="ex-interact"
                  onClick={() => {
                    raid.interact();
                    updateUI();
                  }}
                >
                  <kbd>E</kbd>
                  {raid.nearby.name}
                  <ChevronRight size={18} />
                </button>
              ) : null}
            </div>
          )}
          {raid.toastTime > 0 && !modal && (
            <div className="ex-raid-toast" role="status">
              {raid.toast}
            </div>
          )}
          {raid.elapsed < 18 && !modal && (
            <div className="ex-initial-hint">
              WASD 移动 · 鼠标瞄准 / 左键射击 · E 搜索 · M 地图
            </div>
          )}
          <div className="ex-touch-controls">
            <div
              className="ex-touch-stick"
              aria-label="移动摇杆"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                touchRef.current.move = true;
                const r = e.currentTarget.getBoundingClientRect();
                raid.input.x =
                  (e.clientX - r.left - r.width / 2) / (r.width / 2);
                raid.input.z =
                  (e.clientY - r.top - r.height / 2) / (r.height / 2);
              }}
              onPointerMove={(e) => {
                if (!touchRef.current.move) return;
                const r = e.currentTarget.getBoundingClientRect();
                raid.input.x =
                  (e.clientX - r.left - r.width / 2) / (r.width / 2);
                raid.input.z =
                  (e.clientY - r.top - r.height / 2) / (r.height / 2);
              }}
              onPointerUp={() => {
                touchRef.current.move = false;
                raid.input.x = raid.input.z = 0;
              }}
              onPointerCancel={() => {
                touchRef.current.move = false;
                raid.input.x = raid.input.z = 0;
              }}
            >
              <span>移动</span>
            </div>
            <div
              className="ex-touch-stick ex-touch-aim"
              aria-label="瞄准射击摇杆"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                touchRef.current.aim = true;
                bridge.pointer.active = false;
                raid.input.fire = !modal;
                audio.current.unlock();
                const r = e.currentTarget.getBoundingClientRect();
                raid.input.aimX =
                  raid.player.x + (e.clientX - r.left - r.width / 2) * 0.5;
                raid.input.aimZ =
                  raid.player.z + (e.clientY - r.top - r.height / 2) * 0.5;
              }}
              onPointerMove={(e) => {
                if (!touchRef.current.aim) return;
                const r = e.currentTarget.getBoundingClientRect();
                raid.input.aimX =
                  raid.player.x + (e.clientX - r.left - r.width / 2) * 0.5;
                raid.input.aimZ =
                  raid.player.z + (e.clientY - r.top - r.height / 2) * 0.5;
              }}
              onPointerUp={() => {
                touchRef.current.aim = false;
                raid.input.fire = false;
              }}
              onPointerCancel={() => {
                touchRef.current.aim = false;
                raid.input.fire = false;
              }}
            >
              <Crosshair size={24} />
              <span>瞄准 / 射击</span>
            </div>
          </div>
        </>
      )}
      {modal && (
        <div
          className={`ex-overlay ${active && ['bag', 'map', 'search'].includes(modal) ? 'ex-live-overlay' : ''}`}
        >
          <section
            className={`ex-modal ex-modal-${modal}`}
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'search' ? '搜索容器' : '行动面板'}
          >
            <button
              className="ex-close"
              aria-label="关闭面板"
              onClick={() => {
                setPanel('');
                if (raid) raid.search = null;
                setConfirmAbandon(false);
                updateUI();
              }}
            >
              <X size={20} />
            </button>
            {modal === 'help' && (
              <>
                <span className="ex-kicker">FIELD MANUAL</span>
                <h1>先学会回来，再深入雾里。</h1>
                <div className="ex-help">
                  <div>
                    <h3>01 / 搜</h3>
                    <p>
                      靠近绿色物资箱，按 E 搜索。逐件识别后点击收纳。背包按 Tab
                      打开，保险格只保留一件物资；超过负重阈值会减速。
                    </p>
                  </div>
                  <div>
                    <h3>02 / 打</h3>
                    <p>
                      WASD 移动，鼠标瞄准，左键射击，右键精准瞄准，R 换弹。Shift
                      冲刺，C
                      低姿降噪。红色射线是敌人的开火预警，移到掩体后躲避。
                    </p>
                  </div>
                  <div>
                    <h3>03 / 撤</h3>
                    <p>
                      M
                      查看地图。南岸绿色圆圈常驻开放，北侧需要先恢复供电。在圈内停留
                      6
                      秒接应，受击和离开都会打断。失败会丢失装备，下一次可尝试回收遗体。
                    </p>
                  </div>
                  <div>
                    <h3>04 / 整备</h3>
                    <p>
                      H
                      使用医疗包，移动或受击打断。带回物资可出售，换购护甲、枪械和消音器。没有枪时可以领取免费救援装备。ESC
                      暂停；背包和地图不暂停。
                    </p>
                  </div>
                </div>
                <p className="ex-muted">
                  触屏：左摇杆移动，右摇杆瞄准并射击，点击屏幕按钮完成交互。F
                  切换全屏。
                </p>
                <button className="ex-primary" onClick={() => setPanel('')}>
                  明白，准备行动 <Check size={18} />
                </button>
              </>
            )}
            {modal === 'settings' && (
              <>
                <span className="ex-kicker">SYSTEM</span>
                <h1>行动设置</h1>
                <div className="ex-settings">
                  <button
                    onClick={() =>
                      commit({
                        ...profile,
                        settings: {
                          ...profile.settings,
                          muted: !profile.settings.muted,
                        },
                      })
                    }
                  >
                    {profile.settings.muted ? (
                      <VolumeX size={20} />
                    ) : (
                      <Volume2 size={20} />
                    )}
                    音效 <b>{profile.settings.muted ? '关闭' : '开启'}</b>
                  </button>
                  <button
                    onClick={() =>
                      commit({
                        ...profile,
                        settings: {
                          ...profile.settings,
                          quality:
                            profile.settings.quality === 'high'
                              ? 'low'
                              : 'high',
                        },
                      })
                    }
                  >
                    <Settings2 size={20} />
                    画质{' '}
                    <b>
                      {profile.settings.quality === 'high'
                        ? '高 · 实时阴影'
                        : '低 · 性能优先'}
                    </b>
                  </button>
                  <button
                    onClick={() =>
                      commit({
                        ...profile,
                        settings: {
                          ...profile.settings,
                          reducedMotion: !profile.settings.reducedMotion,
                        },
                      })
                    }
                  >
                    减少环境与界面动态{' '}
                    <b>{profile.settings.reducedMotion ? '开启' : '关闭'}</b>
                  </button>
                </div>
                <p className="ex-muted">
                  存档保存在当前浏览器。可以在仓库页导出备份。
                </p>
              </>
            )}
            {modal === 'pause' && raid && (
              <>
                <span className="ex-kicker">SIGNAL ON HOLD</span>
                <h1>行动已暂停</h1>
                <p>计时、敌人与伤势均已冻结。</p>
                <div className="ex-pause-actions">
                  <button className="ex-primary" onClick={() => setPanel('')}>
                    <Play size={18} /> 继续行动
                  </button>
                  <button onClick={() => setPanel('help')}>生存手册</button>
                  <button onClick={() => setPanel('settings')}>
                    音效与画质
                  </button>
                  <button
                    className="ex-danger-text"
                    onClick={() => {
                      if (!confirmAbandon) setConfirmAbandon(true);
                      else {
                        raid.paused = false;
                        raid.finish(false, '主动撤退 · 已部署装备遗失');
                        setPanel('');
                      }
                    }}
                  >
                    {confirmAbandon
                      ? '确认放弃：失去装备和普通物资'
                      : '放弃本次行动'}
                  </button>
                </div>
              </>
            )}
            {modal === 'map' && raid && (
              <>
                <span className="ex-kicker">
                  TACTICAL OVERVIEW / 地图不暂停行动
                </span>
                <h1>雨蚀港区</h1>
                <TacticalMap raid={raid} />
                <div className="ex-map-legend">
                  <span>◆ 物资</span>
                  <span>⚡ 供电 {raid.powered ? '已恢复' : '未恢复'}</span>
                  <span>● 雷达 {raid.radar ? '已启动' : '未启动'}</span>
                  <span>○ 撤离点</span>
                </div>
                <p className="ex-muted">
                  南岸常驻开放。北侧货运撤离需要货场电站供电。敌人只有交战时会出现在地图上。
                </p>
              </>
            )}
            {(modal === 'bag' || modal === 'search') && raid && (
              <>
                <span className="ex-kicker">
                  {modal === 'search' ? 'SEARCH & SECURE' : 'FIELD INVENTORY'} /
                  行动仍在继续
                </span>
                <h1>{modal === 'search' ? selectedCrate?.name : '战术背包'}</h1>
                {selectedCrate && modal === 'search' && (
                  <div className="ex-search">
                    <div className="ex-panel-heading">
                      <span>
                        识别 {selectedCrate.revealed} /{' '}
                        {selectedCrate.loot.length}
                      </span>
                      <button
                        onClick={() => {
                          raid.takeAll();
                          updateUI();
                        }}
                        disabled={
                          !selectedCrate.revealed ||
                          raid.bag.length >= raid.capacity
                        }
                      >
                        收纳已识别物资
                      </button>
                    </div>
                    <div className="ex-items">
                      {selectedCrate.loot.map((item, index) =>
                        index < selectedCrate.revealed ? (
                          <ItemTile key={`${item}-${index}`} item={item}>
                            <button
                              onClick={() => {
                                raid.take(index);
                                updateUI();
                              }}
                            >
                              收纳
                            </button>
                          </ItemTile>
                        ) : (
                          <div className="ex-item ex-unknown" key={index}>
                            <Package size={20} />
                            正在搜索{' '}
                            <progress
                              max=".7"
                              value={
                                selectedCrate.searched -
                                selectedCrate.revealed * 0.7
                              }
                            />
                          </div>
                        ),
                      )}
                    </div>
                    {!selectedCrate.loot.length && (
                      <p>容器已清空。按 E 或 ESC 关闭。</p>
                    )}
                  </div>
                )}
                <div className="ex-panel-heading">
                  <h3>
                    背包 {raid.bag.length} / {raid.capacity}
                  </h3>
                  <span
                    className={
                      raid.bagWeight > raid.maxWeight ? 'ex-danger-text' : ''
                    }
                  >
                    {raid.bagWeight.toFixed(1)} / {raid.maxWeight} kg{' '}
                    {raid.bagWeight > raid.maxWeight ? '· 超重减速' : ''}
                  </span>
                </div>
                <div className="ex-items">
                  {raid.bag.map((item, index) => (
                    <ItemTile key={`${item}-${index}`} item={item}>
                      <button
                        aria-label={`保护${ITEMS[item].name}`}
                        title="移入保险格"
                        onClick={() => {
                          raid.insure(index);
                          updateUI();
                        }}
                      >
                        <LockKeyhole size={15} />
                      </button>
                      <button
                        aria-label={`丢弃${ITEMS[item].name}`}
                        onClick={() => {
                          raid.drop(index);
                          updateUI();
                        }}
                      >
                        <X size={15} />
                      </button>
                    </ItemTile>
                  ))}
                </div>
                {!raid.bag.length && (
                  <p className="ex-muted">
                    背包为空 · 搜索物资箱并收纳战利品。
                  </p>
                )}
                <h3>
                  <LockKeyhole size={15} /> 保险格{' '}
                  <small>失败仍保留 1 件 · 页面中断除外</small>
                </h3>
                {raid.secure ? (
                  <ItemTile item={raid.secure} />
                ) : (
                  <div className="ex-secure-empty">
                    点击背包物品的锁形按钮，将高价值物资放入保险格。
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {raid && raid.phase !== 'raid' && profile.last && (
        <div className="ex-result-overlay">
          <section className="ex-result">
            <span className="ex-kicker">
              AFTER ACTION REPORT /{' '}
              {profile.last.id.toString().padStart(3, '0')}
            </span>
            <div className="ex-result-icon">
              <img src={`${import.meta.env.BASE_URL}assets/fogharbor/sui-portrait.webp`} alt="岁己" />
              {raid.phase === 'won' ? <Check size={34} /> : <Skull size={34} />}
            </div>
            <h1>
              {raid.phase === 'won'
                ? '欢迎回来，岁己。'
                : '雾里留下了你的回声。'}
            </h1>
            <p>{profile.last.reason}</p>
            {profile.last.contract && (
              <div className="ex-contract-done">
                <Radio size={18} />
                委托完成 · 奖励已到账
              </div>
            )}
            {profile.contract >= 3 && profile.last.contract && (
              <div className="ex-ending">
                <span className="ex-kicker">ENDING 01 / SIGNAL FOUND</span>
                <h2>“饼干岁们，听得见吗？”</h2>
                <p>
                  电波穿过雾港，抵达熟悉的频道。黑暗的屏幕亮起，一条条回应如灯火般浮现。岁己终于找到了回家的方向。
                </p>
                <strong>归航信号已接通 · 高危自由行动开放</strong>
              </div>
            )}
            <div className="ex-result-stats">
              <span>
                <b>{time(profile.last.seconds)}</b>行动时长
              </span>
              <span>
                <b>{profile.last.kills}</b>击破目标
              </span>
              <span>
                <b>{profile.last.items.length}</b>带回物资
              </span>
              <span>
                <b>+{money(profile.last.reward)}</b>行动报酬
              </span>
            </div>
            <div className="ex-result-loot">
              {profile.last.items.map((item, i) => (
                <span key={i} style={{ color: ITEMS[item].color }}>
                  {ITEMS[item].name}
                </span>
              ))}
            </div>
            {raid.phase === 'lost' && (
              <p className="ex-muted">
                下次行动可回收本轮遗留背包与武器；再次失败会覆盖旧遗体。保险格物资已存入仓库。
              </p>
            )}
            <button className="ex-primary" onClick={home}>
              返回基地 <ArrowLeft size={18} />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
