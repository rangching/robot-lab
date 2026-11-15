import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { SceneBase } from '../../three/SceneBase';
import { BenchScene } from './BenchScene';
import { useBench, WIRE_COLORS, type MissionId } from './benchStore';
import { MISSION_MAP, MISSION_XP_DONE, MISSION_XP_STEP, missionsFor, type Ctx } from './missions';
import { CATALOG, LIB_ORDER } from '../../sim/catalog';
import { Engine, freshObserved, resetVisual, simVisual } from '../../sim/engine';
import { buildNets } from '../../sim/netlist';
import { freePrograms, parseCode } from '../../sim/programs';
import { WebPhone } from './WebPhone';
import { DroneRemote } from './DroneRemote';
import { AiCamera } from './AiCamera';
import { BotPanel } from './BotPanel';
import { DRONE_ONLY } from '../../sim/drone';
import type { CompType } from '../../sim/types';
import { useProgress } from '../progress/store';
import { boardData } from '../../data/boards/registry';
import { sfx } from '../music/sfx';
import { buzzerTone } from '../music/tone';
import { highlight } from '../../lib/syntax';
import { useInView } from '../../lib/useInView';
import { IconCheck, IconLock, IconPlay, IconStop, IconTrash, IconMax, IconChevron } from '../../lib/icons';
import { music } from '../music/music';

const LIB_ICON: Record<string, React.ReactNode> = {
  led: <svg viewBox="0 0 32 32"><path d="M10 18V11a6 6 0 0 1 12 0v7z" fill="#ff3b4f" opacity=".85" /><path d="M8 18h16M13 18v10M19 18v7" stroke="#c9ced6" strokeWidth="1.6" /></svg>,
  r220: <svg viewBox="0 0 32 32"><path d="M2 16h7M23 16h7" stroke="#c9ced6" strokeWidth="1.6" /><rect x="9" y="12" width="14" height="8" rx="3" fill="#d9c39a" /><path d="M12 12v8M15 12v8" stroke="#e0362c" strokeWidth="1.6" /><path d="M18 12v8" stroke="#6b3b1f" strokeWidth="1.6" /></svg>,
  r10k: <svg viewBox="0 0 32 32"><path d="M2 16h7M23 16h7" stroke="#c9ced6" strokeWidth="1.6" /><rect x="9" y="12" width="14" height="8" rx="3" fill="#d9c39a" /><path d="M12 12v8" stroke="#6b3b1f" strokeWidth="1.6" /><path d="M15 12v8" stroke="#111" strokeWidth="1.6" /><path d="M18 12v8" stroke="#ff9a1f" strokeWidth="1.6" /></svg>,
  button: <svg viewBox="0 0 32 32"><rect x="7" y="7" width="18" height="18" rx="3" fill="#9aa3ad" /><circle cx="16" cy="16" r="5.5" fill="#e94b5b" /></svg>,
  pot: <svg viewBox="0 0 32 32"><rect x="7" y="9" width="18" height="16" rx="2" fill="#2b6cb0" /><circle cx="16" cy="16" r="6" fill="#16181c" /><path d="M16 16l3-4" stroke="#fff" strokeWidth="1.6" /></svg>,
  buzzer: <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="#16181c" stroke="#555" /><circle cx="16" cy="16" r="2" fill="#000" /></svg>,
  servo: <svg viewBox="0 0 32 32"><rect x="5" y="11" width="20" height="12" rx="1.5" fill="#2f6fd6" /><circle cx="11" cy="11" r="3" fill="#2f6fd6" /><path d="M8 9h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>,
  hcsr04: <svg viewBox="0 0 32 32"><rect x="2" y="9" width="28" height="14" rx="2" fill="#103a63" /><circle cx="10" cy="16" r="5" fill="#c9ced6" /><circle cx="22" cy="16" r="5" fill="#c9ced6" /><circle cx="10" cy="16" r="3" fill="#222" /><circle cx="22" cy="16" r="3" fill="#222" /></svg>,
  psu: <svg viewBox="0 0 32 32"><rect x="4" y="9" width="24" height="14" rx="2" fill="#1b1d22" /><rect x="7" y="12" width="4" height="8" rx="2" fill="#36a852" /><rect x="13" y="12" width="4" height="8" rx="2" fill="#36a852" /><rect x="19" y="12" width="4" height="8" rx="2" fill="#36a852" /></svg>,
  propCw: <svg viewBox="0 0 32 32"><ellipse cx="16" cy="9" rx="3.5" ry="8" fill="#cbd5e1" transform="rotate(25 16 16)" /><ellipse cx="16" cy="23" rx="3.5" ry="8" fill="#cbd5e1" transform="rotate(25 16 16)" /><circle cx="16" cy="16" r="3" fill="#64748b" /></svg>,
  propCcw: <svg viewBox="0 0 32 32"><ellipse cx="16" cy="9" rx="3.5" ry="8" fill="#fb923c" transform="rotate(-25 16 16)" /><ellipse cx="16" cy="23" rx="3.5" ry="8" fill="#fb923c" transform="rotate(-25 16 16)" /><circle cx="16" cy="16" r="3" fill="#9a3412" /></svg>,
  lipo: <svg viewBox="0 0 32 32"><rect x="4" y="9" width="20" height="14" rx="2" fill="#d4d8de" /><path d="M24 13h5M24 19h5" stroke="#e0362c" strokeWidth="2" /><path d="M24 19h5" stroke="#1e293b" strokeWidth="2" /><text x="14" y="19" fontSize="7" textAnchor="middle" fill="#1e293b">1S</text></svg>,
};

type LibItem = { key: string; type: CompType; label: string; props?: { ohms?: number; dir?: 'cw' | 'ccw' } };
const LIB_ITEMS: LibItem[] = LIB_ORDER.flatMap((t): LibItem[] =>
  t === 'resistor'
    ? [{ key: 'r220', type: t, label: '電阻 220Ω', props: { ohms: 220 } }, { key: 'r10k', type: t, label: '電阻 10kΩ', props: { ohms: 10000 } }]
    : t === 'prop'
      ? [{ key: 'propCw', type: t, label: 'CW 槳', props: { dir: 'cw' } }, { key: 'propCcw', type: t, label: 'CCW 槳', props: { dir: 'ccw' } }]
      : [{ key: t, type: t, label: CATALOG[t].short }],
);

function useSimulation(onObsRef: React.MutableRefObject<ReturnType<typeof freshObserved>>) {
  const running = useBench((s) => s.running);
  const runNonce = useBench((s) => s.runNonce);
  useEffect(() => {
    if (!running) {
      resetVisual();
      buzzerTone(0);
      return;
    }
    const st = useBench.getState();
    const prog = st.program();
    let pendingSerial: string[] = [];
    const engine = new Engine(
      st.comps,
      st.wires,
      prog,
      st.params,
      () => {
        const s = useBench.getState();
        return { pressed: new Set(Object.keys(s.pressed).filter((k) => s.pressed[k])), pot: s.pot, distance: s.distance };
      },
      { serial: (l) => pendingSerial.push(l), tone: (f) => buzzerTone(f) },
    );
    onObsRef.current = engine.obs;
    simVisual.running = true;
    let raf = 0;
    let last = performance.now();
    let lastFlush = 0;
    let lastTag: string | null = null;
    const loop = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      engine.tick(dt);
      if (t - lastFlush > 70) {
        lastFlush = t;
        if (engine.tag !== lastTag) {
          lastTag = engine.tag;
          useBench.getState().setTag(engine.tag);
        }
        if (pendingSerial.length) {
          const lines = pendingSerial;
          pendingSerial = [];
          lines.forEach((l) => useBench.getState().pushSerial(l));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      engine.stop();
      resetVisual();
    };
  }, [running, runNonce, onObsRef]);
}

export function Bench() {
  const st = useBench();
  const progress = useProgress();
  const [wrapRef, inView] = useInView<HTMLDivElement>();
  const ctl = useRef<CameraControlsImpl>(null);
  const obsRef = useRef(freshObserved());
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useSimulation(obsRef);

  // 把輸入同步給 3D 畫面
  simVisual.pressed = st.pressed;
  simVisual.pot = st.pot;
  simVisual.distance = st.distance;

  const MISSIONS = missionsFor(st.board);
  const boardName = boardData(st.board).short;
  const mission = st.missionId === 'free' ? null : MISSION_MAP[st.missionId];
  const program = st.program();
  const parsed = useMemo(() => parseCode(program.code), [program]);
  const hlLine = st.tag ? parsed.tagLine[st.tag] : -1;
  const doneCount = mission ? progress.missionSteps[mission.id] ?? 0 : 0;
  // 任何一塊板子的任務 2 完成後解鎖自由建構
  const freeUnlocked = progress.missionsDone.some((id) => MISSION_MAP[id]?.num === 2);

  const unlocked = (i: number) => i === 0 || progress.missionsDone.includes(MISSIONS[i - 1].id);

  // 任務步驟檢查
  useEffect(() => {
    const t = setInterval(() => {
      const s = useBench.getState();
      if (s.missionId === 'free') {
        if (s.running && obsRef.current.runMs > 2000 && !s.issues.some((i) => i.level === 'error')) {
          const p = useProgress.getState();
          p.award('free-first-run', 20, '自由建構：第一次成功執行');
          p.grantBadge('free-builder');
        }
        return;
      }
      const m = MISSION_MAP[s.missionId];
      const p = useProgress.getState();
      let idx = p.missionSteps[m.id] ?? 0;
      if (idx >= m.steps.length) return;
      const ctx: Ctx = { comps: s.comps, wires: s.wires, nets: buildNets(s.comps, s.wires), running: s.running, params: s.params, acks: s.acks, obs: s.running ? obsRef.current : freshObserved(), issues: s.issues };
      const start = idx;
      while (idx < m.steps.length && m.steps[idx].check(ctx)) {
        p.award(`${m.id}:s${idx}`, MISSION_XP_STEP, `任務 ${m.num}・步驟 ${idx + 1} 完成`);
        idx++;
      }
      if (idx > start) {
        p.setMissionStep(m.id, idx);
        sfx('correct');
        if (idx >= m.steps.length) {
          p.completeMission(m.id);
          p.award(`${m.id}:done`, MISSION_XP_DONE, `完成任務 ${m.num}：${m.title}`);
          p.grantBadge(m.badge);
          const after = useProgress.getState();
          if (after.missionsDone.length >= 3 && after.shorts === 0) after.grantBadge('zero-short');
          setCelebrate(m.id);
        }
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  // 進入任務時開背景音樂淡入（若使用者開過音樂）
  const pickMission = (id: MissionId) => {
    st.loadMission(id);
    setCelebrate(null);
    sfx('click');
    music.nudgeOnActivity();
  };

  const run = () => {
    if (st.running) {
      st.stop();
      sfx('click');
      return;
    }
    st.run();
    music.nudgeOnActivity();
  };

  /** 依板子佔地取景：從板子左緣到元件區右側（x ≈ 9.5） */
  const frame = (kind: 'top' | 'iso', smooth: boolean, c = ctl.current) => {
    const { pos, half } = boardData(useBench.getState().board).bench;
    const left = pos[0] - half[0];
    const cx = Math.round(((left + 9.5) / 2 - 0.4) * 10) / 10; // Uno：0.4（與試做版相同）
    const k = Math.max(1, (9.5 - left) / 17.4);
    if (kind === 'top') void c?.setLookAt(cx, 19 * k, 2 * k, cx, 0, 0.6, smooth);
    else void c?.setLookAt(cx, 13.5 * k, 10.5 * k, cx, 0, 0.6, smooth);
  };
  const view = (kind: 'top' | 'iso') => frame(kind, true);
  useEffect(() => { frame('iso', true); }, [st.board]);

  // CameraControls 在 Canvas 內部掛載，用 callback ref 確保拿到實體後再設定
  const setCtl = (c: CameraControlsImpl | null) => {
    if (c && ctl.current !== c) {
      frame('iso', false, c);
      const A = CameraControlsImpl.ACTION;
      c.mouseButtons.left = A.NONE;
      c.mouseButtons.right = A.ROTATE;
      c.mouseButtons.middle = A.TRUCK;
      c.touches.one = A.NONE;
      c.touches.two = A.TOUCH_DOLLY_TRUCK;
    }
    (ctl as React.MutableRefObject<CameraControlsImpl | null>).current = c;
  };

  const errors = st.issues.filter((i) => i.level === 'error');
  const warns = st.issues.filter((i) => i.level === 'warn');
  const hasPot = st.comps.filter((c) => c.type === 'pot');
  const hasBtn = st.comps.filter((c) => c.type === 'button');
  const hasSonar = st.comps.some((c) => c.type === 'hcsr04');
  // 無人機的程式（名稱結尾 -rc）顯示遙控器；網頁程式（-wifi）顯示手機
  const isRc = st.board === 'stampfly' && /-rc$/.test(program.id);
  // Jetson 的 AI 程式（名稱結尾 -ai）顯示相機畫面
  const isAi = /-ai$/.test(program.id);

  const fullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen();
    } catch { /* 忽略 */ }
  };

  const nextMission = celebrate ? MISSIONS[MISSIONS.findIndex((m) => m.id === celebrate) + 1] : undefined;

  return (
    <div className="bench-grid" ref={wrapRef}>
      {/* 左：任務 */}
      <div className="bench-col">
        <div className="panel mission-list" role="list">
          {MISSIONS.map((m, i) => {
            const done = progress.missionsDone.includes(m.id);
            const lock = !unlocked(i);
            return (
              <button key={m.id} className={`mission-btn ${st.missionId === m.id ? 'on' : ''} ${done ? 'done' : ''}`} disabled={lock} onClick={() => pickMission(m.id as MissionId)}>
                <span className="mn">{done ? <IconCheck size={14} /> : lock ? <IconLock size={13} /> : m.num}</span>
                <span>{m.title}<small>{m.sub}</small></span>
                <span className="xp">+{m.steps.length * MISSION_XP_STEP + MISSION_XP_DONE}</span>
              </button>
            );
          })}
          <button className={`mission-btn ${st.missionId === 'free' ? 'on' : ''}`} disabled={!freeUnlocked} onClick={() => pickMission('free')} title={freeUnlocked ? '' : '完成任一塊板子的任務 2 後解鎖'}>
            <span className="mn">{freeUnlocked ? '∞' : <IconLock size={13} />}</span>
            <span>自由建構<small>{freeUnlocked ? '想接什麼就接什麼' : '完成任務 2 後解鎖'}</small></span>
            <span className="xp" />
          </button>
        </div>

        {mission ? (
          <div className="panel steps">
            <span className="kicker">{boardName} 任務 {mission.num} / {MISSIONS.length}</span>
            <h3>{mission.title}</h3>
            <p className="goal">{mission.goal}</p>
            <ol>
              {mission.steps.map((s, i) => {
                const state = i < doneCount ? 'done' : i === doneCount ? 'cur' : '';
                return (
                  <li key={i} className={`step ${state}`}>
                    <span className="ic">{i < doneCount ? <IconCheck size={12} /> : i + 1}</span>
                    <span>
                      {s.text}
                      {state !== '' && s.why && <span className="why">{s.why}</span>}
                      {state === 'cur' && s.ack && (
                        <button className="btn sm primary" style={{ marginTop: 8 }} onClick={() => st.ack(`${mission.id}-s${i}`)}>{s.ack}</button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            {doneCount >= mission.steps.length && <p className="goal" style={{ marginTop: 12, color: 'var(--green)' }}>✓ 任務完成！可以繼續玩，或挑戰下一關。</p>}
          </div>
        ) : (
          <div className="panel free-picker">
            <span className="kicker">自由建構</span>
            <p className="goal muted" style={{ margin: 0, fontSize: 14 }}>挑一支範例程式，照程式裡的腳位自己接線。按執行前一樣會做安全檢查。</p>
            <label htmlFor="free-prog" className="dim" style={{ fontSize: 13 }}>範例程式</label>
            <select id="free-prog" value={st.freeProgramId} onChange={(e) => st.setFreeProgram(e.target.value)} disabled={st.running}>
              {freePrograms(st.board).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* 右：工作台＋程式 */}
      <div className="bench-main">
      <div className="panel bench-stage" ref={stageRef}>
        <div className="bench-bar">
          <button className={`btn ${st.running ? 'danger' : 'go'}`} onClick={run}>
            {st.running ? <><IconStop size={14} /> 停止</> : <><IconPlay size={14} /> 上傳並執行</>}
          </button>
          {st.running && <span className="chip green">● 執行中</span>}
          {st.pending && <span className="chip cyan">接線中：點另一支腳完成，點空白處取消</span>}
          <span className="spacer" />
          <span className="wire-colors" aria-label="線的顏色">
            {WIRE_COLORS.map((c) => (
              <button key={c} className={st.wireColor === c ? 'on' : ''} title={c === 'auto' ? '自動配色（電源紅、GND 灰）' : c} onClick={() => st.setWireColor(c)} style={{ background: c === 'auto' ? 'conic-gradient(#ef4444 0 33%, #334155 0 66%, #f59e0b 0)' : c }} />
            ))}
          </span>
          <div className="seg">
            <button onClick={() => view('iso')}>立體</button>
            <button onClick={() => view('top')}>俯視</button>
          </div>
          <button className="btn sm icon ghost" onClick={st.clearBench} disabled={st.running} title="清空工作台"><IconTrash size={14} /></button>
          <button className="btn sm icon ghost" onClick={fullscreen} title="全螢幕"><IconMax size={14} /></button>
        </div>

        <div className="canvas-wrap">
          <Canvas shadows dpr={[1, 2]} camera={{ position: [0.4, 13.5, 10.5], fov: 38 }} frameloop={inView ? 'always' : 'never'} onPointerMissed={() => { st.cancelPending(); st.select(null); }}>
            <SceneBase floorY={-0.02} />
            <CameraControls ref={setCtl} makeDefault minDistance={5} maxDistance={32} smoothTime={0.3} maxPolarAngle={1.3} />
            <BenchScene />
          </Canvas>

          <div className="bench-msg" aria-live="polite">
            {errors.slice(0, 3).map((e, i) => (
              <div key={'e' + i} className="err"><b>✕</b><span>{e.text}</span></div>
            ))}
            {warns.slice(0, 2).map((e, i) => (
              <div key={'w' + i} className="warn"><b>!</b><span>{e.text}</span></div>
            ))}
          </div>

          {(hasPot.length > 0 || hasBtn.length > 0 || hasSonar || /-wifi$/.test(program.id) || isRc || isAi || st.board === 'threepi') && (
            <div className="panel controls-float">
              {/-wifi$/.test(program.id) && <WebPhone running={st.running} />}
              {isRc && <DroneRemote running={st.running} />}
              {isAi && <AiCamera running={st.running} />}
              {st.board === 'threepi' && <BotPanel running={st.running} programId={program.id} />}
              {hasPot.map((p, i) => (
                <label key={p.id}>
                  <span className="row"><span>旋鈕{hasPot.length > 1 ? ` #${i + 1}` : ''}</span><span className="mono">{Math.round((st.pot[p.id] ?? 0.5) * 100)}%</span></span>
                  <input type="range" min={0} max={1} step={0.01} value={st.pot[p.id] ?? 0.5} onChange={(e) => st.setPot(p.id, +e.target.value)} />
                </label>
              ))}
              {hasSonar && (
                <label>
                  <span className="row"><span>障礙物距離</span><span className="mono">{st.distance} cm</span></span>
                  <input type="range" min={3} max={150} step={1} value={st.distance} onChange={(e) => st.setDistance(+e.target.value)} />
                </label>
              )}
              {hasBtn.map((b, i) => (
                <button
                  key={b.id}
                  className={`btn sm ${st.pressed[b.id] ? 'active' : ''}`}
                  onPointerDown={() => st.setPressed(b.id, true)}
                  onPointerUp={() => st.setPressed(b.id, false)}
                  onPointerLeave={() => st.pressed[b.id] && st.setPressed(b.id, false)}
                >
                  按住按鈕{hasBtn.length > 1 ? ` #${i + 1}` : ''}
                </button>
              ))}
            </div>
          )}
          <div className="bench-hint">點腳位開始接線 · 點線刪除 · 拖曳元件移動 · 右鍵拖曳旋轉 · 滾輪縮放</div>

          {celebrate && (
            <div className="result-card">
              <div className="panel">
                <span className="kicker">任務完成</span>
                <h3 style={{ fontSize: 26, margin: '8px 0' }}>{MISSION_MAP[celebrate].title}</h3>
                <p className="muted" style={{ margin: '0 0 16px' }}>+{MISSION_MAP[celebrate].steps.length * MISSION_XP_STEP + MISSION_XP_DONE} XP，還拿到一枚新徽章！</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {nextMission ? (
                    <button className="btn primary" onClick={() => pickMission(nextMission.id as MissionId)}>下一關：{nextMission.title} <IconChevron size={14} /></button>
                  ) : (
                    <button className="btn primary" onClick={() => pickMission('free')}>前往自由建構 <IconChevron size={14} /></button>
                  )}
                  <button className="btn" onClick={() => setCelebrate(null)}>留在這裡繼續玩</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lib" role="toolbar" aria-label="元件庫">
          {LIB_ITEMS.filter((it) => st.board === 'stampfly' || !DRONE_ONLY.has(it.type)).map((it) => {
            const allowed = st.missionId === 'free' || (mission?.lib.includes(it.type) ?? false);
            return (
              <button key={it.key} onClick={() => st.addComp(it.type, it.props)} disabled={st.running} style={{ opacity: allowed ? 1 : 0.45 }} title={CATALOG[it.type].desc}>
                {LIB_ICON[it.key]}
                {it.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bench-code">
        <div className="panel code-run code-box">
          <header>
            <span>{program.title}</span>
            <span>{/^\s*(from|import)\s/m.test(program.code) ? 'PYTHON' : 'ARDUINO C++'}</span>
          </header>
          <pre aria-label="程式碼">
            {parsed.lines.map((ln, i) => {
              const parts = ln.split(/\{\{(\w+)\}\}/);
              return (
                <span key={i} className={`ln ${i === hlLine && st.running ? 'hl' : ''}`}>
                  <i>{i + 1}</i>
                  {parts.map((part, j) => {
                    if (j % 2 === 1) {
                      const def = program.params?.find((p) => p.key === part);
                      return (
                        <input
                          key={j}
                          className="param"
                          type="number"
                          value={st.params[part] ?? def?.def ?? 0}
                          min={def?.min}
                          max={def?.max}
                          disabled={st.running}
                          aria-label={def?.label ?? part}
                          title={st.running ? '先停止才能修改' : `可以修改：${def?.label ?? part}`}
                          onChange={(e) => st.setParam(part, Math.max(0, +e.target.value || 0))}
                          onBlur={(e) => st.setParam(part, Math.max(def?.min ?? 0, Math.min(def?.max ?? 99999, +e.target.value || def?.def || 0)))}
                        />
                      );
                    }
                    return <span key={j}>{highlight(part, j * 100)}</span>;
                  })}
                  {'\n'}
                </span>
              );
            })}
          </pre>
        </div>
        <div className="panel serial">
          <header>
            <span>序列埠監控視窗 · {/Serial\.begin\((\d+)\)/.exec(program.code)?.[1] ?? '9600'} baud</span>
            <span>{st.serial.length} 行</span>
          </header>
          <SerialView lines={st.serial} />
        </div>
      </div>
      </div>
    </div>
  );
}

function SerialView({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return <pre ref={ref}>{lines.length ? lines.join('\n') : <span className="dim">（執行後，Serial.print 的文字會出現在這裡）</span>}</pre>;
}
