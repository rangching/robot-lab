import { BADGES } from './badges';
import { useProgress } from './store';
import { BadgeGlyph } from '../../lib/icons';
import { LEVELS, levelOf } from './levels';

export function Badges() {
  const got = useProgress((s) => s.badges);
  const xp = useProgress((s) => s.xp);
  const resetAll = useProgress((s) => s.resetAll);
  const lv = levelOf(xp);
  const n = Object.keys(got).length;
  return (
    <section className="section" id="badges">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-num"><b>05</b>成就</span>
            <h2>徽章牆</h2>
            <p>已收集 {n} / {BADGES.length} 枚。每枚徽章都會加 XP，幫你從實習生一路升到首席工程師。</p>
          </div>
          <div className="panel" style={{ padding: '12px 16px', minWidth: 260 }}>
            <span className="kicker">工程師階級</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {LEVELS.map((l, i) => (
                <span key={l.name} className={`chip ${i < lv.index ? 'green' : i === lv.index ? 'cyan' : ''}`}>Lv.{i + 1} {l.name}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="badge-shelf">
          {BADGES.map((b) => (
            <div key={b.id} className={`badge-item ${got[b.id] ? 'got' : 'locked'}`}>
              <BadgeGlyph glyph={b.glyph} color={b.color} />
              <b>{b.name}</b>
              <small>{b.desc}</small>
              <small className="mono" style={{ color: got[b.id] ? 'var(--green)' : undefined }}>{got[b.id] ? `已獲得 · ${got[b.id]}` : `+${b.xp} XP`}</small>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="btn sm ghost" onClick={() => { if (window.confirm('確定要清除所有學習進度、XP 和徽章嗎？這個動作無法復原。')) resetAll(); }}>清除學習進度</button>
        </p>
      </div>
    </section>
  );
}
