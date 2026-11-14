import { useEffect, useState } from 'react';
import { useProgress } from '../progress/store';
import { levelOf } from '../progress/levels';
import { IconFlame } from '../../lib/icons';

const NAV = [
  { id: 'board', label: '3D 檢視' },
  { id: 'bench', label: '工作台' },
  { id: 'lesson', label: '課程' },
  { id: 'drills', label: '測驗與組裝' },
  { id: 'compare', label: '比較' },
  { id: 'badges', label: '徽章' },
];

export function Hud() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak.days);
  const lv = levelOf(xp);
  const [active, setActive] = useState('board');

  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (ents) => {
        const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <header className="hud">
      <div className="container hud-inner">
        <a className="brand" href="#board">
          <span className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /><circle cx="12" cy="12" r="2.5" fill="#fef08a" stroke="none" /></svg>
          </span>
          <span>機器人實驗室<small>ROBOT LAB</small></span>
        </a>
        <nav className="hud-nav" aria-label="主選單">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={active === n.id ? 'on' : ''}>{n.label}</a>
          ))}
        </nav>
        <div className="hud-stats">
          <span className="streak" title={`連續學習 ${streak} 天`}><IconFlame size={15} />{streak}<span className="sr-only">天連續學習</span></span>
          <div className="lv" title={lv.nextName ? `再 ${lv.toNext} XP 升級為「${lv.nextName}」` : '最高等級'}>
            <span className="lv-badge">Lv.{lv.index + 1}</span>
            <div className="lv-meta">
              <span><b>{lv.name}</b><em className="mono" style={{ fontStyle: 'normal' }}>{xp} XP</em></span>
              <div className="progress-bar"><i style={{ width: `${lv.pct * 100}%` }} /></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
