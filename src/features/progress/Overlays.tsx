import { useUi } from './store';
import { LEVELS } from './levels';
import { IconBolt } from '../../lib/icons';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <IconBolt size={16} style={{ color: t.kind === 'badge' ? 'var(--violet)' : 'var(--amber)', flex: 'none' }} />
          <span style={{ flex: 1 }}>{t.text}</span>
          {t.xp ? <span className="xp">+{t.xp} XP</span> : null}
        </div>
      ))}
    </div>
  );
}

export function LevelUp() {
  const lv = useUi((s) => s.levelUp);
  const close = useUi((s) => s.closeLevelUp);
  if (!lv) return null;
  const next = LEVELS[lv.level];
  return (
    <div className="levelup" role="dialog" aria-label="升級" onClick={close}>
      <div>
        <div className="big">LEVEL {lv.level}</div>
        <h2>升級為「{lv.name}」</h2>
        <p>{next ? `下一個目標：${next.name}（${next.min} XP）` : '你已經是實驗室的首席工程師了！'}</p>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={close}>繼續加油</button>
      </div>
    </div>
  );
}
