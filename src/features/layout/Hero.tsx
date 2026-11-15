import { Stage } from '../viewer/Stage';
import { BOARDS } from '../../data/boards';
import { useProgress, useUi } from '../progress/store';
import { completion, nextAction } from '../progress/completion';
import { go, switchBoard } from './nav';
import { useBoard } from '../../lib/useBoard';
import { isPlayable } from '../../data/boards/registry';
import { IconLock, IconChevron } from '../../lib/icons';

function Ring({ pct }: { pct: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" aria-label={`完成度 ${Math.round(pct * 100)}%`}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} stroke="#e6edf5" strokeWidth="7" fill="none" />
        <circle cx="42" cy="42" r={r} stroke="url(#rg)" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s' }} />
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#22c55e" /></linearGradient>
        </defs>
      </svg>
      <b>{Math.round(pct * 100)}%</b>
    </div>
  );
}

export function Hero() {
  const p = useProgress();
  const board = useBoard();
  const bp = p.boards[board.id];
  const comp = completion(p, board.id);
  const next = nextAction(p, board.id);
  const uno = board.summary;
  const pushToast = useUi((s) => s.pushToast);
  const row = (label: string, v: number, extra?: string) => (
    <div><span>{label}</span><span className={v >= 1 ? 'ok' : ''}>{extra ?? `${Math.round(v * 100)}%`}</span></div>
  );
  return (
    <section className="hero" id="board">
      <div className="container">
        <div className="hero-grid">
          <div className="panel hero-info">
            <div className="hero-meta"><span>{uno.maker.toUpperCase()} · {uno.year}</span><span>{String(uno.num).padStart(2, '0')} / {String(BOARDS.length).padStart(2, '0')}</span></div>
            <div>
              <span className="kicker">做機器人一定會碰到的 {BOARDS.length} 塊開發板</span>
              <h1>{uno.name}</h1>
              <p className="tagline">{uno.tagline}</p>
            </div>
            <div className="hero-chips">
              <span className="chip green">{uno.level}</span>
              <span className="chip">{uno.mcu}</span>
              <span className="chip">{uno.logic} 邏輯</span>
              <span className="chip">{uno.clock}</span>
            </div>
            <div className="ring-row">
              <Ring pct={comp.pct} />
              <div className="ring-list">
                {row('工作台任務', comp.missions, `${comp.doneSteps}/${comp.totalSteps} 步`)}
                {row('課程', comp.lesson)}
                {row('找零件測驗', comp.quiz, `${bp?.quizBest ?? 0}/6`)}
                {row('拆裝組裝', comp.asm, bp?.assemblyDone ? '完成' : '未完成')}
              </div>
            </div>
            <div className="next-card">
              <span className="kicker">下一步</span>
              <p>{next.text}</p>
              <button className="btn primary sm" onClick={() => go(next.target, next.mission)}>{next.cta} <IconChevron size={14} /></button>
            </div>
          </div>
          <Stage />
        </div>
        <div className="board-strip" role="list" aria-label={`${BOARDS.length} 塊開發板`}>
          {BOARDS.map((b) => {
            const lock = b.locked || !isPlayable(b.id);
            const pct = lock ? 0 : completion(p, b.id).pct;
            return (
              <button
                key={b.id}
                role="listitem"
                aria-current={b.id === board.id ? 'true' : undefined}
                className={`board-card ${b.id === board.id ? 'on' : ''} ${lock ? 'locked' : ''}`}
                onClick={() => (lock ? pushToast({ text: `${b.name}：製作中，即將開放`, kind: 'info' }) : switchBoard(b.id))}
                title={b.tagline}
              >
                <span className="n">{String(b.num).padStart(2, '0')} · {b.level}</span>
                <span className="t">{b.name}</span>
                {lock ? <span className="lock"><IconLock size={13} /></span> : <span className="pct mono">{Math.round(pct * 100)}%</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
