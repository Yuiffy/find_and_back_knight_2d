import { lazy, Suspense, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

const LanternGame = lazy(() => import('./lantern/LanternGame'));
const OriginalGame = lazy(() => import('./App').then((module) => ({ default: module.App })));

export function Experience() {
  const legacy = new URL(window.location.href).searchParams.get('mode') === 'legacy';
  useEffect(() => { document.title = legacy ? '岁己：空响撤离' : '岁己 · 借光归来'; }, [legacy]);
  return (
    <Suspense fallback={<main className="game-loading">正在点亮归灯站...</main>}>
      {legacy ? <><OriginalGame /><a className="lantern-legacy-back" href={import.meta.env.BASE_URL} title="返回借光归来" onClick={(event) => {
        let raidActive = window.__SUI_GAME_STATE__?.mode === 'raid';
        try {
          // The saved raid starts before the lazily loaded canvas publishes its state.
          raidActive ||= Boolean(JSON.parse(localStorage.getItem('sui-echoes-below.save.v1') ?? 'null')?.activeRaid);
        } catch { /* The visible scene state is still available when storage is blocked. */ }
        if (raidActive && !window.confirm('原版远征尚未结束。离开会按原版的放弃规则处理当前装备，确定返回借光归来吗？')) event.preventDefault();
      }}><ArrowLeft size={15} />借光归来</a></> : <LanternGame />}
    </Suspense>
  );
}
