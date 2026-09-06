import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import Phaser from 'phaser';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, BookOpen, Check, Feather, Flame, Hand, Heart, Home, Keyboard, Mail, Maximize, Pause, Play, RotateCcw, Sparkles, Sprout, Sword, Volume2, VolumeX, X } from 'lucide-react';
import { LanternScene, type LanternSnapshot } from './LanternScene';
import { ControlHints, InputGlyph } from './ControlHints';
import { formatTime, loadProgress, normalizeProgress, RELICS, ROOMS, saveProgress, settleProgress, WEAPONS, type Control, type RelicId, type Weapon } from './model';

function Dialog({ title, children, onClose, restoreFocus, className = '' }: { title: string; children: ReactNode; onClose: () => void; restoreFocus: () => void; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const restoreFocusRef = useRef(restoreFocus);
  closeRef.current = onClose;
  restoreFocusRef.current = restoreFocus;
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => restoreFocusRef.current();
  }, []);
  return <div className="lantern-scrim">
    <section ref={ref} className={`lantern-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <button className="lantern-icon lantern-dialog-close" type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={20} /></button>
      {children}
    </section>
  </div>;
}

function RelicIcon({ id, size = 25 }: { id: RelicId; size?: number }) {
  return id === 'bell' ? <Bell size={size} /> : id === 'letter' ? <Mail size={size} /> : <Sprout size={size} />;
}

export default function LanternGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LanternScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [progress, setProgress] = useState(() => { const p = loadProgress(); saveProgress(p); return p; });
  const progressRef = useRef(progress);
  const [snapshot, setSnapshot] = useState<LanternSnapshot | null>(null);
  const [runId, setRunId] = useState(0);
  const [collection, setCollection] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [touch, setTouch] = useState(false);
  const runSettled = useRef(-1);
  const autoDepart = useRef(false);
  const stateRef = useRef<LanternSnapshot | null>(null);
  stateRef.current = snapshot;

  function commitProgress(next: typeof progress) {
    const normalized = normalizeProgress(next);
    progressRef.current = normalized;
    setProgress(normalized);
    setStorageError(!saveProgress(normalized));
  }

  useEffect(() => {
    setTouch(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    container.replaceChildren();
    setLoadError('');
    const scene = new LanternScene({
      progress: progressRef.current,
      onReady: () => {
        if (!active) return;
        if (autoDepart.current) { autoDepart.current = false; scene.depart(); }
      },
      onLoadError: () => { if (active) setLoadError('温室暂时没能打开。'); },
      onState: (state) => { if (active) { stateRef.current = state; setSnapshot(state); } },
      onStart: () => { if (active) commitProgress({ ...progressRef.current, attempts: progressRef.current.attempts + 1 }); },
      onLearnControl: (lesson) => {
        if (active) commitProgress({ ...progressRef.current, learnedControls: [...new Set([...(progressRef.current.learnedControls ?? []), lesson])] });
      },
      onResult: (result) => {
        if (!active || runSettled.current === runId) return;
        runSettled.current = runId;
        commitProgress(settleProgress(progressRef.current, result));
      },
    });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: container.clientWidth,
      height: container.clientHeight,
      transparent: true,
      antialias: true,
      audio: { noAudio: true },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1500 }, debug: false } },
      scale: { mode: Phaser.Scale.RESIZE, width: container.clientWidth, height: container.clientHeight },
      scene: [scene],
    });
    gameRef.current = game;
    const previousText = window.render_game_to_text;
    const previousAdvance = window.advanceTime;
    window.render_game_to_text = () => JSON.stringify(stateRef.current ?? { mode: 'lantern', phase: 'loading' });
    // Positive steps own the clock until advanceTime(0) returns it to live RAF.
    // This avoids counting browser/automation latency as player movement.
    window.advanceTime = async (milliseconds: number) => {
      if (!active || !scene.sys.isActive()) return;
      if (milliseconds <= 0) { game.loop.wake(); return; }
      const duration = Math.max(0, Math.min(30_000, milliseconds));
      const step = 1000 / 60;
      const start = performance.now();
      game.loop.sleep();
      for (let elapsed = 0; elapsed < duration; elapsed += step) game.step(start + elapsed, Math.min(step, duration - elapsed));
      stateRef.current = scene.snapshot();
      setSnapshot(stateRef.current);
    };
    return () => {
      active = false;
      scene.clearControls();
      game.destroy(true);
      game.loop.wake();
      gameRef.current = null;
      sceneRef.current = null;
      window.render_game_to_text = previousText;
      window.advanceTime = previousAdvance;
      container.replaceChildren();
    };
    // Progress changes do not rebuild a live expedition. A new run takes a new snapshot.
  }, [runId]);

  const home = snapshot?.phase === 'home';
  const ended = snapshot?.phase === 'won' || snapshot?.phase === 'lost';
  const activeRun = snapshot?.phase === 'outbound' || snapshot?.phase === 'returning';
  const boss = snapshot?.enemies.find((enemy) => enemy.kind === 'keeper');
  const bossVisible = activeRun && snapshot.roomId === 'belfry' && boss && snapshot.player.x > 4270;
  const controlsVisible = progress.controlsVisible !== false;
  const lesson = controlsVisible ? snapshot?.guidance?.lesson ?? null : null;
  const selectedWeapon = WEAPONS[progress.weapon];

  function restart(depart: boolean) {
    autoDepart.current = depart;
    setCollection(false);
    setConfirmLeave(false);
    setSnapshot(null);
    stateRef.current = null;
    setRunId((id) => id + 1);
  }

  function chooseWeapon(weapon: Weapon) {
    sceneRef.current?.setWeapon(weapon);
    const next = { ...progress, weapon };
    commitProgress(next);
  }

  function toggleAudio() {
    const next = { ...progress, muted: !progress.muted };
    commitProgress(next);
    sceneRef.current?.setMuted(next.muted);
  }

  function toggleControls() {
    sceneRef.current?.clearControls();
    commitProgress({ ...progressRef.current, controlsVisible: progressRef.current.controlsVisible === false });
  }

  function replayControlHints() {
    commitProgress({ ...progressRef.current, controlsVisible: true, learnedControls: [] });
    sceneRef.current?.resetControlLessons();
  }

  function touchDown(control: Control, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sceneRef.current?.setControl(control, true);
  }
  function touchUp(control: Control, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    sceneRef.current?.setControl(control, false);
  }
  const touchButton = (control: Control, title: string, icon: ReactNode, className = '') => <button
    type="button" className={`lantern-touch-button ${className}${lesson === control || (lesson === 'move' && (control === 'left' || control === 'right')) ? ' is-guided' : ''}`} aria-label={title} title={title}
    onPointerDown={(e) => touchDown(control, e)} onPointerUp={(e) => touchUp(control, e)} onPointerCancel={(e) => touchUp(control, e)} onLostPointerCapture={() => sceneRef.current?.setControl(control, false)}
    onContextMenu={(e) => e.preventDefault()}>{icon}</button>;

  return <main data-phase={snapshot?.phase} className={`lantern-game${snapshot?.coreTaken ? ' has-light' : ''}${touch ? ' is-touch' : ''}${controlsVisible ? ' has-control-hints' : ''}${progress.returns > 0 ? ' has-weapon-choice' : ''}`}>
    <div className="lantern-canvas" ref={containerRef} tabIndex={-1} aria-label="借光归来游戏世界" />
    {!snapshot && <div className="lantern-loading"><Flame size={30} /><span>温室的风正在吹来...</span></div>}
    {loadError && <div className="lantern-loading" role="alert"><span>{loadError}</span><button type="button" className="lantern-primary" onClick={() => restart(false)}><RotateCcw size={18} />重新打开</button></div>}
    <header className="lantern-top">
      <div className="lantern-identity">
        <span className="lantern-kicker">岁己 SUI</span>
        <h1>借光归来</h1>
        {snapshot && <div className="lantern-vitals" aria-label={`生命 ${snapshot.health}/${snapshot.maxHealth}`}>
          {Array.from({ length: snapshot.maxHealth }, (_, i) => <Heart key={i} size={19} className={i < snapshot.health ? 'is-full' : ''} aria-hidden="true" />)}
          <span className={`lantern-weapon${snapshot.empowered ? ' is-lit' : ''}`} title={snapshot.weapon === 'feather' ? '回旋羽' : '羽刃'}>{snapshot.weapon === 'feather' ? <Feather size={19} /> : <Sword size={19} />}</span>
        </div>}
      </div>
      <div className="lantern-tools">
        <button className="lantern-icon lantern-hints-toggle" type="button" aria-label={controlsVisible ? '隐藏操作提示' : '显示操作提示'} aria-pressed={controlsVisible} title={controlsVisible ? '隐藏操作提示' : '显示操作提示'} onClick={(event) => { toggleControls(); if (event.detail > 0) event.currentTarget.blur(); }}><Keyboard size={19} /></button>
        {home && progress.relics.length > 0 && <button className="lantern-icon" type="button" aria-label="纪念品" title="纪念品" onClick={() => { sceneRef.current?.setPaused(true); setCollection(true); }}><BookOpen size={19} /></button>}
        <button className="lantern-icon" type="button" aria-label={progress.muted ? '开启声音' : '关闭声音'} title={progress.muted ? '开启声音' : '关闭声音'} onClick={(event) => { toggleAudio(); if (event.detail > 0) event.currentTarget.blur(); }}>{progress.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <button className="lantern-icon lantern-fullscreen" type="button" aria-label="全屏" title="全屏" onClick={() => { const scale = gameRef.current?.scale; if (scale?.isFullscreen) scale.stopFullscreen(); else scale?.startFullscreen(); }}><Maximize size={18} /></button>
        {!ended && <button className="lantern-icon" type="button" aria-label="暂停" title="暂停" onClick={() => sceneRef.current?.setPaused(true)}><Pause size={18} /></button>}
      </div>
    </header>

    {home && !snapshot?.paused && <section className="lantern-home-copy" aria-label="归灯站">
      {progress.returns === 0 && <><div className="lantern-home-line" /><p>“天黑之前，<br />带一盏灯回来。”</p></>}
      {progress.returns > 0 && <span className="lantern-home-memory">窗边的灯，亮过 {progress.returns} 次。</span>}
      {progress.returns > 0 && <div className="lantern-weapons" role="group" aria-label="选择武器">
        <button type="button" aria-pressed={progress.weapon === 'blade'} onClick={() => chooseWeapon('blade')}><Sword size={17} />羽刃</button>
        <button type="button" aria-pressed={progress.weapon === 'feather'} onClick={() => chooseWeapon('feather')}><Feather size={17} />回旋羽</button>
      </div>}
      {progress.returns > 0 && <div className="lantern-weapon-detail" aria-label="当前武器属性">
        <div><strong>{selectedWeapon.category}</strong><span>出手间隔 <b>{selectedWeapon.cooldownMs / 1000} 秒</b></span></div>
        <p>{selectedWeapon.traits}</p>
      </div>}
      <button type="button" className="lantern-primary" onClick={() => sceneRef.current?.depart()}>进入温室<ArrowRight size={18} /></button>
    </section>}

    {activeRun && snapshot && <>
      <div className="lantern-route-heading">
        <span>{snapshot.room}</span>
        <div className="lantern-path" aria-label="旅途位置">{ROOMS.map((room) => <i key={room.id} className={`${snapshot.visited.includes(room.id) ? 'visited' : ''} ${room.id === snapshot.roomId ? 'current' : ''}`} title={snapshot.visited.includes(room.id) ? room.name : '未抵达'} />)}</div>
      </div>
      <div className={`lantern-objective${snapshot.coreTaken && snapshot.lightMs < 30_000 ? ' is-urgent' : ''}`}>
        <span className="lantern-objective-icon">{snapshot.coreTaken ? <Flame size={22} /> : <Sparkles size={20} />}</span>
        <div><strong>{snapshot.objective}</strong><span>{snapshot.target.direction === 'left' ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}{snapshot.target.name}</span></div>
        {snapshot.coreTaken && <time>{formatTime(snapshot.lightMs)}</time>}
      </div>
      {snapshot.coreTaken && <div className="lantern-cargo" aria-label="本轮收获"><span><Flame size={17} />温室灯芯</span>{snapshot.relic && <span><RelicIcon id={snapshot.relic} size={17} />{RELICS[snapshot.relic].name}</span>}</div>}
      {snapshot.routeChoice && !snapshot.paused && <div className="lantern-route-choice" role="group" aria-label="接下来的路">
        <button type="button" onClick={() => sceneRef.current?.chooseDestination('home')}><ArrowLeft size={21} /><span><strong>带灯芯回家</strong><small>归灯站</small></span></button>
        <button type="button" onClick={() => sceneRef.current?.chooseDestination('relic')}><span><strong>去钟楼看看</strong><small>{RELICS[snapshot.offeredRelic].name} · 钟卫守候</small></span><ArrowRight size={21} /></button>
      </div>}
      {bossVisible && <div className="lantern-boss" aria-label={`钟卫生命 ${boss.hp}/${boss.maxHp}`}><span>最后的钟卫</span><div><i style={{ width: `${boss.hp / boss.maxHp * 100}%` }} /></div><small>{boss.phase === 'windup' ? (boss.pattern === 'wave' ? '钟鸣' : '蓄势') : boss.phase === 'recover' ? '失衡' : '护壳'}</small></div>}
      {snapshot.interaction && !snapshot.paused && <div className="lantern-interaction">
        {snapshot.extraction > 0 ? <div className="lantern-extracting"><Flame size={20} /><span>灯火正在落定</span><i style={{ width: `${Math.min(1, snapshot.extraction) * 100}%` }} /></div>
          : <button className={`lantern-context-button${lesson === 'interact' ? ' is-guided' : ''}`} type="button" disabled={!snapshot.interaction.enabled} onClick={() => sceneRef.current?.interact()}>
            {controlsVisible && !touch && snapshot.interaction.enabled ? <InputGlyph lesson="interact" /> : <Hand size={18} />}{snapshot.interaction.label}
          </button>}
      </div>}
      {snapshot.message && !snapshot.paused && <div className="lantern-message" role="status" key={snapshot.message}>{snapshot.message}</div>}
    </>}

    {snapshot && !snapshot.paused && !ended && controlsVisible && <ControlHints lesson={lesson} touch={touch}
      showCoach={!snapshot.interaction && !snapshot.routeChoice && !snapshot.message}
      canInteract={Boolean(snapshot.interaction?.enabled)}
      onControl={(control, down) => sceneRef.current?.setControl(control, down)} onInteract={() => sceneRef.current?.interact()} />}

    {home && <a className="lantern-archive" href={`${import.meta.env.BASE_URL}?mode=legacy`}><BookOpen size={14} />原版远征<ArrowRight size={13} /></a>}
    {storageError && <div className="lantern-storage-error" role="alert">浏览器未能保存这次进度。</div>}

    {touch && !snapshot?.paused && !ended && <div className="lantern-touch" aria-label="触屏操作">
      <div className="lantern-touch-move">{touchButton('left', '向左', <ArrowLeft />)}{touchButton('right', '向右', <ArrowRight />)}{touchButton('down', '向下瞄准', <ArrowDown size={19} />, 'lantern-touch-aim')}</div>
      <div className="lantern-touch-actions">{touchButton('dash', '冲刺', <Feather size={22} />)}{touchButton('jump', '跳跃', <ArrowUp size={26} />)}{touchButton('attack', '攻击', <Sword size={25} />, 'lantern-touch-attack')}</div>
    </div>}

    {snapshot?.paused && !collection && <Dialog title={confirmLeave ? '返回灯站' : '暂停'} restoreFocus={() => containerRef.current?.focus()} onClose={() => { setConfirmLeave(false); sceneRef.current?.setPaused(false); }}>
      <Flame className="lantern-dialog-symbol" size={34} />
      <span className="lantern-kicker">归灯站的灯还亮着</span>
      <h2>{confirmLeave ? '先回去歇一歇？' : '风暂时停下了。'}</h2>
      {confirmLeave ? <><p>这次未带回的收获，会留在温室里。</p><div className="lantern-dialog-actions"><button type="button" className="lantern-primary" onClick={() => restart(false)}><Home size={18} />回到灯站</button><button type="button" className="lantern-secondary" onClick={() => setConfirmLeave(false)}>继续留下</button></div></>
        : <><div className="lantern-hint-settings">
          <label><Keyboard size={18} /><span>操作提示</span><input type="checkbox" checked={controlsVisible} onChange={toggleControls} /></label>
          <button type="button" onClick={replayControlHints}><RotateCcw size={15} />重看操作提示</button>
        </div><div className="lantern-dialog-actions"><button type="button" className="lantern-primary" onClick={() => sceneRef.current?.setPaused(false)}><Play size={18} />继续旅途</button>{!home && <button type="button" className="lantern-secondary" onClick={() => setConfirmLeave(true)}><Home size={17} />回到灯站</button>}</div></>}
    </Dialog>}

    {ended && snapshot.result && <Dialog title={snapshot.phase === 'won' ? '灯已归来' : '旅途结束'} restoreFocus={() => containerRef.current?.focus()} onClose={() => restart(false)} className="lantern-result">
      <div className={`lantern-result-art ${snapshot.phase}`}><img src={`${import.meta.env.BASE_URL}assets/sui-bird.png`} alt="岁己" /><Flame size={40} /></div>
      <span className="lantern-kicker">{snapshot.phase === 'won' ? '一盏灯，一次归来' : '你没有失去重新出发的勇气'}</span>
      <h2>{snapshot.phase === 'won' ? '灯亮了。你也回来了。' : '这次，先歇一歇。'}</h2>
      <p>{snapshot.phase === 'won' ? (snapshot.relic ? RELICS[snapshot.relic].story : '窗里传来一句：“回来啦。”') : snapshot.result.reason}</p>
      <div className="lantern-result-facts"><span>旅途 <strong>{formatTime(snapshot.result.durationMs)}</strong></span><span>平息守卫 <strong>{snapshot.result.kills}</strong></span>{snapshot.phase === 'won' && <span><Check size={15} />灯芯已安放</span>}</div>
      {snapshot.phase === 'won' && progress.returns === 1 && <div className="lantern-unlock"><Feather size={18} /><span>窗台上，多了一片回旋羽。</span></div>}
      {snapshot.phase === 'won' && snapshot.relic && <div className="lantern-relic-found"><RelicIcon id={snapshot.relic} size={20} />{RELICS[snapshot.relic].name}</div>}
      <div className="lantern-dialog-actions"><button type="button" className="lantern-primary" onClick={() => restart(true)}><RotateCcw size={18} />{snapshot.phase === 'won' ? '再去一次' : '重新出发'}</button><button type="button" className="lantern-secondary" onClick={() => restart(false)}><Home size={17} />留在灯站</button></div>
    </Dialog>}

    {collection && <Dialog title="带回家的纪念品" restoreFocus={() => containerRef.current?.focus()} onClose={() => { setCollection(false); sceneRef.current?.setPaused(false); }}>
      <BookOpen className="lantern-dialog-symbol" size={30} /><span className="lantern-kicker">窗台上的小小世界</span><h2>带回家的纪念品</h2>
      <div className="lantern-collection">{progress.relics.map((id) => <article key={id}><span style={{ color: RELICS[id].color }}><RelicIcon id={id} size={32} /></span><div><h3>{RELICS[id].name}</h3><p>{RELICS[id].story}</p></div></article>)}</div>
    </Dialog>}
  </main>;
}
