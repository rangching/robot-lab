import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Html } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { UnoModel, pinTop } from '../../three/boards/UnoModel';
import { SceneBase } from '../../three/SceneBase';
import { DragController } from '../../three/DragController';
import { DevExpose } from '../../three/DevExpose';
import { FOOTPRINTS } from '../../three/boards/pcbTexture';
import { unoLesson, mx, mz } from '../../data/boards/uno';
import { PIN_KIND_LABEL, type PinDef } from '../../data/types';
import { useLab, scrollToId, type View } from '../../lib/labStore';
import { useInView } from '../../lib/useInView';
import { useQuiz } from '../quiz/useQuiz';
import { useAssembly } from '../assembly/useAssembly';
import { IconRotate, IconTag, IconX, IconBulb, IconSkip, IconReset } from '../../lib/icons';
import { useProgress } from '../progress/store';
import { sfx } from '../music/sfx';
import { starsOf } from '../quiz/quizLogic';

const PART = Object.fromEntries(unoLesson.parts.map((p) => [p.id, p]));

const VIEWS: Record<View, [number, number, number, number, number, number]> = {
  iso: [5.4, 7.6, 9.0, 0, 0, 0.2],
  top: [0, 13.5, 0.01, 0, 0, 0],
  bottom: [0, -12.5, 0.6, 0, 0, 0],
  front: [0, 2.8, 12, 0, 0.2, 0],
};

function AutoRotate({ ctl, on }: { ctl: React.RefObject<CameraControlsImpl>; on: boolean }) {
  useFrame((_, dt) => {
    if (on && ctl.current) ctl.current.rotate(dt * 0.35, 0, false);
  });
  return null;
}

function SolderFlash({ at, t }: { at: [number, number, number]; t: number }) {
  const light = useRef<THREE.PointLight>(null!);
  const g = useRef<THREE.Group>(null!);
  const dirs = useMemo(() => Array.from({ length: 10 }, () => new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2)), [t]);
  useFrame(() => {
    const age = (performance.now() - t) / 1000;
    const k = Math.max(0, 1 - age / 0.7);
    if (light.current) light.current.intensity = k * 6;
    g.current?.children.forEach((c, i) => {
      c.position.copy(dirs[i]).multiplyScalar(age * 1.2);
      c.position.y -= age * age * 2;
      c.scale.setScalar(k * 0.05 + 0.001);
    });
  });
  return (
    <group position={[at[0], 0.3, at[2]]}>
      <pointLight ref={light} color="#ffb347" distance={3} />
      <group ref={g}>
        {dirs.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial color="#ffd27a" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function TargetGhost({ id }: { id: string }) {
  const m = useRef<THREE.Mesh>(null!);
  const fp = FOOTPRINTS[id];
  useFrame((s) => {
    (m.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.2 * Math.sin(s.clock.elapsedTime * 7);
  });
  return (
    <mesh ref={m} position={[mx(fp[0]), 0.02, mz(fp[1])]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[fp[2] / 10, fp[3] / 10]} />
      <meshBasicMaterial color="#0ea5e9" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function applyCamera(c: CameraControlsImpl | null, mode: string, smooth: boolean) {
  if (!c) return;
  const A = CameraControlsImpl.ACTION;
  if (mode === 'assembly') {
    void c.setLookAt(2.4, 18.5, 6.6, 2.4, 0, -0.2, smooth);
    c.mouseButtons.left = A.NONE;
    c.mouseButtons.right = A.ROTATE;
    c.touches.one = A.NONE;
  } else {
    void c.setLookAt(...VIEWS.iso, smooth);
    c.mouseButtons.left = A.ROTATE;
    c.mouseButtons.right = A.TRUCK;
    c.touches.one = A.TOUCH_ROTATE;
  }
}

function useBlink(period = 1000) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), period / 2);
    return () => clearInterval(t);
  }, [period]);
  return on;
}

export function Stage() {
  const { mode, selected, explode, labels, rotate, view, viewNonce, setMode, select, setExplode, toggleLabels, toggleRotate, setView } = useLab();
  const [wrapRef, inView] = useInView<HTMLDivElement>();
  const ctl = useRef<CameraControlsImpl>(null);
  const [hoverPin, setHoverPin] = useState<PinDef | null>(null);
  const blink = useBlink(1000);
  const quizBest = useProgress((s) => s.quizBest);

  const flyTo = useCallback((id: string) => {
    const p = PART[id];
    const c = ctl.current;
    if (!p || !c) return;
    const y = useLab.getState().explode * p.layer * 0.9 + p.at[1];
    void c.setLookAt(p.at[0] + 1.6, y + 3.4, p.at[2] + 3.8, p.at[0], y, p.at[2], true);
  }, []);

  const quiz = useQuiz(flyTo);
  const asm = useAssembly();
  // 組裝完成後先讓使用者看 ON 燈亮起，再顯示結算卡
  const [asmCard, setAsmCard] = useState(false);
  useEffect(() => {
    if (!asm.done) { setAsmCard(false); return; }
    const t = setTimeout(() => setAsmCard(true), 2600);
    return () => clearTimeout(t);
  }, [asm.done]);

  // 視角切換
  useEffect(() => {
    const v = VIEWS[view];
    void ctl.current?.setLookAt(...v, true);
  }, [view, viewNonce]);

  // 選取零件 → 鏡頭飛過去
  useEffect(() => {
    if (selected && mode === 'explore') flyTo(selected);
  }, [selected, mode, flyTo]);

  // 模式切換：遊戲邏輯
  useEffect(() => {
    if (mode === 'quiz') {
      asm.stop();
      quiz.start();
    } else if (mode === 'assembly') {
      quiz.stop();
      asm.start();
    } else {
      quiz.stop();
      asm.stop();
    }
    applyCamera(ctl.current, mode, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // CameraControls 掛載在 Canvas 內部，可能比模式切換晚出現；掛載時補套用一次
  const setCtl = useCallback((c: CameraControlsImpl | null) => {
    const prev = ctl.current;
    (ctl as React.MutableRefObject<CameraControlsImpl | null>).current = c;
    if (c && c !== prev) applyCamera(c, useLab.getState().mode, false);
  }, []);

  const onExplorePart = (id: string) => {
    select(id);
    sfx('click');
  };

  const lights = mode === 'assembly' ? { ON: asm.done ? 1 : 0, L: asm.done && blink ? 1 : 0 } : { ON: 1, L: blink ? 1 : 0 };

  const modelProps =
    mode === 'quiz'
      ? { highlights: quiz.flash, onPartClick: (id: string) => quiz.onPartClick(id) }
      : mode === 'assembly'
        ? { offsets: asm.offsets, highlights: asm.highlights, onPartDown: (id: string) => asm.onPartDown(id), onPartClick: (id: string) => asm.onPartClick(id) }
        : {
            explode,
            highlights: selected ? { [selected]: '#0ea5e9' } : undefined,
            onPartClick: (id: string) => onExplorePart(id),
            pins: true,
            onPinOver: (p: PinDef | null) => setHoverPin(p),
          };

  const sel = selected ? PART[selected] : null;
  const stars = starsOf(quiz.score, quiz.total);

  return (
    <div className="panel stage" ref={wrapRef} id="stage">
      <div className="stage-toolbar">
        <div className="seg" role="tablist" aria-label="模式">
          <button className={mode === 'explore' ? 'on' : ''} onClick={() => setMode('explore')}>3D 檢視</button>
          <button className={mode === 'quiz' ? 'on' : ''} onClick={() => setMode('quiz')}>找零件測驗</button>
          <button className={mode === 'assembly' ? 'on' : ''} onClick={() => setMode('assembly')}>拆裝組裝</button>
        </div>
        {mode !== 'assembly' && (
          <div className="seg" aria-label="視角">
            {(['iso', 'top', 'bottom', 'front'] as View[]).map((v) => (
              <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {{ iso: '立體', top: '正面', bottom: '背面', front: '側面' }[v]}
              </button>
            ))}
          </div>
        )}
        {mode === 'explore' && (
          <div className="seg">
            <button className={rotate ? 'on' : ''} onClick={toggleRotate} title="自動旋轉"><IconRotate size={14} /> 旋轉</button>
            <button className={labels ? 'on' : ''} onClick={toggleLabels} title="零件編號"><IconTag size={14} /> 標籤</button>
            <label className="explode">
              拆開
              <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} aria-label="爆炸圖" />
            </label>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', inset: 0 }}>
        <Canvas shadows dpr={[1, 2]} camera={{ position: [5.4, 7.6, 9.0], fov: 35 }} frameloop={inView ? 'always' : 'never'} gl={{ antialias: true, alpha: true }} onPointerMissed={() => mode === 'explore' && select(null)}>
          <Suspense fallback={null}>
            <SceneBase floorY={-0.17} />
            <DevExpose name="__stageProject" />
            <CameraControls ref={setCtl} makeDefault minDistance={2.5} maxDistance={20} dollyToCursor smoothTime={0.35} />
            <AutoRotate ctl={ctl} on={rotate && mode === 'explore'} />
            <UnoModel lights={lights} {...modelProps} />

            {mode === 'explore' && labels &&
              unoLesson.parts.map((p) => (
                <Html key={p.id} position={[p.at[0], p.at[1] * 2 + 0.3 + explode * p.layer * 0.9, p.at[2]]} zIndexRange={[1, 0]} center>
                  <div className="part-tag" onClick={() => onExplorePart(p.id)} title={p.name}>{p.num}</div>
                </Html>
              ))}

            {mode === 'explore' && hoverPin && (
              <Html position={pinTop(hoverPin)} zIndexRange={[1, 0]}>
                <div className="pin-tip">
                  <b>{hoverPin.label}</b> · {PIN_KIND_LABEL[hoverPin.kind]}
                  <span>{hoverPin.desc}</span>
                </div>
              </Html>
            )}

            {mode === 'assembly' && (
              <>
                <DragController active={!!asm.drag} onMove={asm.onDragMove} onEnd={asm.onDragEnd} />
                {asm.drag && asm.failed[asm.drag.id] && <TargetGhost id={asm.drag.id} />}
                {asm.sparks && <SolderFlash key={asm.sparks.t} at={PART[asm.sparks.id].at} t={asm.sparks.t} />}
              </>
            )}
          </Suspense>
        </Canvas>
      </div>

      {/* 檢視模式：零件說明 */}
      {mode === 'explore' && sel && (
        <div className="panel stage-side" role="dialog" aria-label={sel.name}>
          <button className="btn sm icon ghost close" onClick={() => select(null)} aria-label="關閉"><IconX size={14} /></button>
          <span className="kicker">零件 {String(sel.num).padStart(2, '0')} / 15</span>
          <h4>{sel.name}</h4>
          <p>{sel.desc}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn sm" onClick={() => { const i = sel.num % 15; select(unoLesson.parts[i].id); }}>下一個零件</button>
            <button className="btn sm ghost" onClick={() => scrollToId('lesson')}>看課程</button>
          </div>
        </div>
      )}
      {mode === 'explore' && !sel && <div className="stage-hint">拖曳旋轉 · 滾輪縮放 · 點零件看說明 · 滑到排母上看腳位</div>}

      {/* 測驗 */}
      {mode === 'quiz' && quiz.active && !quiz.done && quiz.q && (
        <div className="panel quiz-panel">
          <div className="q">
            <small>第 {quiz.idx + 1} 題 / {quiz.total}</small>
            <p>{quiz.q.prompt}</p>
          </div>
          <div className="dots" aria-label="作答進度">
            {Array.from({ length: quiz.total }, (_, i) => (
              <i key={i} className={quiz.results[i] ?? (i === quiz.idx ? 'cur' : '')} />
            ))}
          </div>
          <button className="btn sm" onClick={quiz.hint}><IconBulb size={14} /> 提示</button>
          <button className="btn sm ghost" onClick={quiz.skip}><IconSkip size={14} /> 跳過</button>
          {quiz.feedback && <div className={`fb ${quiz.feedback.kind}`}>{quiz.feedback.text}</div>}
        </div>
      )}
      {mode === 'quiz' && quiz.done && (
        <div className="result-card">
          <div className="panel">
            <span className="kicker">測驗結果</span>
            <div className="stars" aria-label={`${stars} 顆星`}>
              {[0, 1, 2].map((i) => <span key={i} className={i < stars ? '' : 'off'}>★</span>)}
            </div>
            <h3 style={{ fontSize: 28, margin: '6px 0' }}>{quiz.score} / {quiz.total}</h3>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              {quiz.score === quiz.total ? '全部一次答對，眼力滿分！' : quiz.score >= 4 ? '很不錯！再挑戰一次拿滿分。' : '多旋轉、放大看看，下次一定更好。'}
              <br />歷史最佳：{Math.max(quizBest, quiz.score)} / {quiz.total}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn primary" onClick={quiz.start}><IconReset size={14} /> 再挑戰</button>
              <button className="btn" onClick={() => setMode('explore')}>回到 3D 檢視</button>
            </div>
          </div>
        </div>
      )}

      {/* 組裝 */}
      {mode === 'assembly' && asm.running && !asm.done && (
        <div className="panel quiz-panel top">
          <div className="q">
            <small>放好 {asm.counts.placed + asm.counts.soldered} · 焊好 {asm.counts.soldered} / {asm.counts.total}</small>
            <p>{asm.counts.placed > 0 ? '點一下發黃光的零件把它焊上去' : '把零件從托盤拖到板子上的絲印外框'}</p>
          </div>
          <div className="progress-bar" style={{ width: 160 }}>
            <i style={{ width: `${(asm.counts.soldered / Math.max(1, asm.counts.total)) * 100}%` }} />
          </div>
          <button className="btn sm ghost" onClick={asm.start}><IconReset size={14} /> 重來</button>
        </div>
      )}
      {mode === 'assembly' && asm.running && !asm.done && asm.msg && (
        <div className={`fb ${asm.msg.kind} stage-fb`} role="status">{asm.msg.text}</div>
      )}
      {mode === 'assembly' && !asm.done && <div className="stage-hint">左鍵拖曳零件 · 右鍵拖曳旋轉 · 滾輪縮放</div>}
      {mode === 'assembly' && asm.done && asmCard && (
        <div className="result-card">
          <div className="panel">
            <span className="kicker">組裝完成</span>
            <h3 style={{ fontSize: 26, margin: '8px 0' }}>板子復活了！</h3>
            <p className="muted" style={{ margin: '0 0 16px' }}>15 個零件全部歸位，用時 {asm.done.secs} 秒。ON 燈亮起，L 燈也開始閃了。</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn primary" onClick={asm.start}><IconReset size={14} /> 再組一次</button>
              <button className="btn" onClick={() => setMode('explore')}>回到 3D 檢視</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
