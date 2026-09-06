import { ArrowBigUp, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, Feather, Hand, Mouse, MoveHorizontal, Space, Sword, type LucideIcon } from 'lucide-react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { Control, ControlLesson } from './model';

const ACTIONS: Record<ControlLesson, { name: string; icon: LucideIcon }> = {
  move: { name: '移动', icon: MoveHorizontal },
  attack: { name: '攻击', icon: Sword },
  jump: { name: '跳跃', icon: ArrowUp },
  dash: { name: '冲刺', icon: Feather },
  interact: { name: '互动', icon: Hand },
};

export function InputGlyph({ lesson }: { lesson: ControlLesson }) {
  if (lesson === 'move') return <span className="lantern-key-pair"><kbd title="左方向键"><ArrowLeft /></kbd><kbd title="右方向键"><ArrowRight /></kbd></span>;
  if (lesson === 'attack') return <span className="lantern-mouse-key" title="鼠标左键"><Mouse /><i /></span>;
  const Glyph = lesson === 'jump' ? Space : lesson === 'dash' ? ArrowBigUp : CornerDownLeft;
  return <kbd title={lesson === 'jump' ? '空格键' : lesson === 'dash' ? 'Shift' : 'Enter'}><Glyph /></kbd>;
}

interface Props {
  lesson: ControlLesson | null;
  touch: boolean;
  showCoach: boolean;
  canInteract: boolean;
  onControl: (control: Control, down: boolean) => void;
  onInteract: () => void;
}

export function ControlHints({ lesson, touch, showCoach, canInteract, onControl, onInteract }: Props) {
  const ActiveIcon = lesson ? ACTIONS[lesson].icon : Hand;

  function pointer(control: Control, down: boolean, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (down) event.currentTarget.setPointerCapture(event.pointerId);
    onControl(control, down);
  }

  function keyboard(control: Control, down: boolean, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) onControl(control, down);
  }

  function controlButton(control: Control, controlLesson: ControlLesson, label: string, content: ReactNode) {
    return <button type="button" aria-label={`${label}（操作栏）`} title={label} className={lesson === controlLesson ? 'is-guided' : ''}
      onPointerDown={(event) => pointer(control, true, event)} onPointerUp={(event) => pointer(control, false, event)}
      onPointerCancel={(event) => pointer(control, false, event)} onLostPointerCapture={() => onControl(control, false)}
      onKeyDown={(event) => keyboard(control, true, event)} onKeyUp={(event) => keyboard(control, false, event)}
      onBlur={() => onControl(control, false)} onContextMenu={(event) => event.preventDefault()}>{content}</button>;
  }

  return <>
    {lesson && lesson !== 'interact' && showCoach && <aside className="lantern-control-coach" data-lesson={lesson} aria-label={`${ACTIONS[lesson].name}操作提示`}>
      <span className="lantern-coach-input" aria-hidden="true">{touch ? <Hand size={25} /> : <InputGlyph lesson={lesson} />}</span>
      <ArrowRight className="lantern-coach-connector" size={16} aria-hidden="true" />
      <ActiveIcon size={24} aria-hidden="true" />
      <strong>{ACTIONS[lesson].name}</strong>
    </aside>}
    {!touch && <nav className="lantern-control-strip" aria-label="操作栏">
      <div className="lantern-control-group">
        <div className="lantern-control-directions">
          {controlButton('left', 'move', '向左', <ArrowLeft size={20} />)}
          {controlButton('right', 'move', '向右', <ArrowRight size={20} />)}
        </div><span>移动</span>
      </div>
      {(['attack', 'jump', 'dash'] as const).map((id) => {
        const Icon = ACTIONS[id].icon;
        return <div className="lantern-control-group" key={id}>
          {controlButton(id, id, ACTIONS[id].name, <><InputGlyph lesson={id} /><Icon className="lantern-control-action" size={17} /></>)}
          <span>{ACTIONS[id].name}</span>
        </div>;
      })}
      <div className="lantern-control-group"><button type="button" aria-label="互动（操作栏）" title="互动" disabled={!canInteract} className={lesson === 'interact' ? 'is-guided' : ''} onClick={onInteract}><InputGlyph lesson="interact" /><Hand className="lantern-control-action" size={17} /></button><span>互动</span></div>
    </nav>}
  </>;
}
