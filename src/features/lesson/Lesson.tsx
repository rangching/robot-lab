import { useEffect, useRef, useState, type ReactNode } from 'react';
import { unoLesson } from '../../data/boards/uno';
import { PIN_COLORS, PIN_KIND_LABEL, type PinKind } from '../../data/types';
import { LESSON_SECTIONS } from '../progress/completion';
import { useProgress } from '../progress/store';
import { useLab, scrollToId } from '../../lib/labStore';
import { highlight } from '../../lib/syntax';
import { IconCheck, IconCopy } from '../../lib/icons';

/** 區塊在畫面中停留 2.5 秒就算讀過 */
function Block({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const read = useProgress((s) => s.lessonRead.includes(id));
  useEffect(() => {
    const el = ref.current;
    if (!el || read || typeof IntersectionObserver === 'undefined') return;
    let t: number | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          t = window.setTimeout(() => {
            const p = useProgress.getState();
            p.markLesson(id);
            p.award(`lesson:${id}`, 15, `讀完：${title}`);
            if (useProgress.getState().lessonRead.length >= LESSON_SECTIONS.length) p.grantBadge('scholar');
          }, 2500);
        } else if (t) clearTimeout(t);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => { io.disconnect(); if (t) clearTimeout(t); };
  }, [id, title, read]);
  return (
    <section ref={ref} className="panel lesson-block" id={`lesson-${id}`}>
      <header>
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {read && <span className="chip green"><IconCheck size={12} /> 已讀</span>}
      </header>
      {children}
    </section>
  );
}

function CodeBox() {
  const [copied, setCopied] = useState(false);
  const { code } = unoLesson;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 忽略 */ }
  };
  return (
    <div className="code-box">
      <header>
        <span>{code.title} · {code.lang}</span>
        <button className="btn sm ghost" onClick={copy}>{copied ? <><IconCheck size={13} /> 已複製</> : <><IconCopy size={13} /> 複製</>}</button>
      </header>
      <pre>{code.source.split('\n').map((l, i) => <span key={i}>{highlight(l, i * 1000)}{'\n'}</span>)}</pre>
    </div>
  );
}

export function Lesson() {
  const read = useProgress((s) => s.lessonRead);
  const select = useLab((s) => s.select);
  const setMode = useLab((s) => s.setMode);
  const L = unoLesson;
  const kinds: PinKind[] = ['power', 'gnd', 'digital', 'pwm', 'analog', 'bus', 'control', 'nc'];
  return (
    <section className="section" id="lesson">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-num"><b>02</b>課程</span>
            <h2>Arduino Uno R3：你需要知道的事</h2>
            <p>每一段停留幾秒就會記成「已讀」並拿到 XP。點零件名稱，上方的 3D 模型會飛過去給你看。</p>
          </div>
          <span className="chip cyan">{read.length} / {LESSON_SECTIONS.length} 段已讀</span>
        </div>
        <div className="lesson-grid">
          <nav className="panel lesson-toc" aria-label="課程目錄">
            {LESSON_SECTIONS.map((s, i) => (
              <button key={s.id} onClick={() => scrollToId(`lesson-${s.id}`)}>
                <span>{String(i + 1).padStart(2, '0')}　{s.title}</span>
                {read.includes(s.id) && <span className="done">✓</span>}
              </button>
            ))}
          </nav>
          <div>
            <Block id="overview" title="一句話認識它" sub="Arduino · 2010">
              <p style={{ margin: 0, fontSize: 17 }}>{L.summary}</p>
              <div className="stat-tiles">
                {L.stats.map((s) => <div className="stat" key={s.k}><small>{s.k}</small><b>{s.v}</b></div>)}
              </div>
            </Block>
            <Block id="specs" title="規格" sub="把規格表翻成白話。">
              <table className="spec-table"><tbody>{L.specs.map((s) => <tr key={s.k}><th>{s.k}</th><td>{s.v}</td></tr>)}</tbody></table>
            </Block>
            <Block id="parts" title="板上零件" sub="15 個零件，編號和 3D 模型上的標籤一樣。點一下，鏡頭就會飛過去。">
              <div className="part-list">
                {L.parts.map((p) => (
                  <button key={p.id} className="part-item" onClick={() => { setMode('explore'); select(p.id); scrollToId('uno'); }}>
                    <span className="num">{p.num}</span>
                    <span><b>{p.name}</b><span>{p.desc}</span></span>
                  </button>
                ))}
              </div>
            </Block>
            <Block id="pros" title="優點與陷阱" sub="大家為什麼愛它，還有新手最常在哪裡跌倒。">
              <div className="pros-cons">
                <div className="pros"><h4>優點</h4><ul>{L.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div className="cons"><h4>注意</h4><ul>{L.pitfalls.map((s) => <li key={s}>{s}</li>)}</ul></div>
              </div>
            </Block>
            <Block id="pins" title="腳位" sub="感測器、馬達和電源接在哪裡。把滑鼠移到 3D 模型的排母上，可以看每一支腳的功能。">
              <div className="pin-groups">
                {L.pinGroups.map((g) => (
                  <div key={g.title} className="pin-group" style={{ ['--k' as string]: PIN_COLORS[g.kind] }}>
                    <b>{g.title}</b>
                    <p>{g.body}</p>
                  </div>
                ))}
              </div>
              <div className="legend">
                {kinds.map((k) => <span key={k}><i style={{ background: PIN_COLORS[k] }} />{PIN_KIND_LABEL[k]}</span>)}
              </div>
            </Block>
            <Block id="code" title="第一支程式" sub="複製到 Arduino IDE 上傳，或直接到工作台任務 1 模擬執行。">
              <CodeBox />
            </Block>
            <Block id="projects" title="適合的專題" sub="這塊板子最拿手的作品。">
              <ul className="list-check">{L.projects.map((s) => <li key={s}>{s}</li>)}</ul>
            </Block>
            <Block id="facts" title="小知識" sub="下次可以拿來跟朋友聊。">
              <div className="facts">{L.facts.map((f) => <div key={f} className="fact">{f}</div>)}</div>
            </Block>
          </div>
        </div>
      </div>
    </section>
  );
}
