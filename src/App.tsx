import { useEffect } from 'react';
import { Hud } from './features/layout/Hud';
import { Hero } from './features/layout/Hero';
import { Bench } from './features/bench/Bench';
import { Lesson } from './features/lesson/Lesson';
import { Drills } from './features/layout/Drills';
import { Compare } from './features/lesson/Compare';
import { Badges } from './features/progress/BadgeWall';
import { Toasts, LevelUp } from './features/progress/Overlays';
import { Player } from './features/music/Player';
import { useProgress } from './features/progress/store';
import { completion } from './features/progress/completion';
import { music } from './features/music/music';
import { setSfxEnabled } from './features/music/sfx';
import { go, syncBoard } from './features/layout/nav';
import { BOARD_DATA } from './data/boards/registry';
import { BADGES } from './features/progress/badges';
import type { BoardId } from './data/types';

export default function App() {
  const touchStreak = useProgress((s) => s.touchStreak);
  const p = useProgress();
  const doneBoards = (Object.keys(BOARD_DATA) as BoardId[]).filter((b) => completion(p, b).pct >= 0.999).join(',');

  useEffect(() => {
    touchStreak();
    syncBoard();
    const s = useProgress.getState().settings;
    setSfxEnabled(s.sfxOn);
    music.init({
      track: s.track,
      volume: s.volume,
      onChange: (patch) => useProgress.getState().setSettings(patch),
      get: () => ({ musicOn: useProgress.getState().settings.musicOn, nudged: useProgress.getState().settings.nudged }),
    });
    // 網址 hash 直接開啟測驗或組裝
    const h = location.hash.slice(1);
    if (h === 'quiz' || h === 'assembly') setTimeout(() => go(h), 300);
  }, [touchStreak]);

  // 每塊板子完成度 100% 時頒「全制霸」徽章（徽章 id：板子 id + '-master'）
  useEffect(() => {
    if (!doneBoards) return;
    for (const b of doneBoards.split(',')) if (BADGES.some((x) => x.id === `${b}-master`)) useProgress.getState().grantBadge(`${b}-master`);
  }, [doneBoards]);

  // 換板子時同步模擬器與工作台
  const board = useProgress((s) => s.board);
  useEffect(() => { syncBoard(); }, [board]);

  return (
    <>
      <a className="sr-only" href="#lesson">跳到課程</a>
      <Hud />
      <main>
        <Hero />
        <section className="section" id="bench">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="section-num"><b>01</b>工作台</span>
                <h2>在工作台上接線，按下執行</h2>
                <p>從元件庫拿元件，點一支腳再點另一支腳就能拉線。按「上傳並執行」前，實驗室會先幫你檢查短路、漏接電阻和沒共地。跟著任務一步一步做，或在自由建構模式想接什麼就接什麼。</p>
              </div>
            </div>
            <p className="mobile-note chip amber" style={{ height: 'auto', padding: '6px 12px', marginBottom: 12 }}>工作台在平板或電腦上操作最順手；手機也能用，用兩指縮放和移動視角。</p>
            <Bench />
          </div>
        </section>
        <Lesson />
        <Drills />
        <Compare />
        <Badges />
      </main>
      <footer className="site">
        <div className="container">機器人實驗室 · 已開放 {Object.values(BOARD_DATA).map((b) => b!.short).join('、')} · 3D 模型、文字與配樂皆為原創 · 進度只存在這個瀏覽器</div>
      </footer>
      <Toasts />
      <LevelUp />
      <Player />
    </>
  );
}
