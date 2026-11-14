import { useDrone } from '../../sim/drone';
import type { Stick } from '../../sim/flight';

const AXES: { k: keyof Stick; label: string; min: number }[] = [
  { k: 'thr', label: '油門', min: 0 },
  { k: 'roll', label: '橫滾', min: -1 },
  { k: 'yaw', label: '偏航', min: -1 },
  { k: 'pitch', label: '俯仰', min: -1 },
];

/** 高度曲線：藍線是實際高度、橘色虛線是目標（最近 10 秒） */
function AltChart() {
  const hist = useDrone((s) => s.hist);
  const W = 228;
  const H = 46;
  const top = 60; // cm
  if (hist.length < 2) return <div className="dim mono" style={{ fontSize: 11, height: H, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 8 }}>解鎖後這裡會畫出高度曲線</div>;
  const t1 = hist[hist.length - 1].t;
  const X = (t: number) => W - ((t1 - t) / 10000) * W;
  const Y = (v: number) => H - 4 - (Math.min(top, Math.max(0, v)) / top) * (H - 8);
  const line = (k: 'alt' | 'ref') => hist.map((h, i) => `${i ? 'L' : 'M'}${X(h.t).toFixed(1)},${Y(h[k]).toFixed(1)}`).join('');
  const showRef = hist.some((h) => h.ref > 0.5);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="高度曲線" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8 }}>
      {[20, 40].map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />)}
      {[20, 40].map((v) => <text key={v} x={3} y={Y(v) - 2} fontSize={9} fill="var(--text-3)">{v}</text>)}
      {showRef && <path d={line('ref')} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />}
      <path d={line('alt')} fill="none" stroke="#0ea5e9" strokeWidth={2} />
    </svg>
  );
}

/** 工作台上的遙控器（Atom JoyStick，透過 ESP-NOW 連到 StampS3） */
export function DroneRemote({ running }: { running: boolean }) {
  const stick = useDrone((s) => s.stick);
  const setStick = useDrone((s) => s.setStick);
  const center = useDrone((s) => s.center);
  const request = useDrone((s) => s.request);
  const t = useDrone((s) => s.telem);
  const status = !running ? '尚未執行' : t?.flipped ? '翻覆！馬達已切斷' : t?.landing ? '自動降落中' : t?.armed ? '已解鎖' : '已上鎖';
  const color = t?.flipped ? 'var(--red, #e11d48)' : t?.armed ? 'var(--green)' : 'var(--text-3)';
  return (
    <div style={{ display: 'grid', gap: 6, padding: 8, border: '1px solid var(--line-strong)', borderRadius: 14, background: 'var(--panel-2)', width: 248 }} aria-label="無人機遙控器">
      <span className="row"><span>🎮 遙控器 · ESP-NOW</span><span className="mono" style={{ fontSize: 11, color, fontWeight: 700 }}>{status}</span></span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className={`btn sm ${t?.armed ? 'active' : ''}`} style={{ flex: 1 }} disabled={!running} onClick={() => request('arm')}>解鎖</button>
        <button className="btn sm" style={{ flex: 1 }} disabled={!running} onClick={() => request('disarm')}>上鎖</button>
      </div>
      {running && t?.refused && !t.armed && <span className="mono" style={{ fontSize: 11, color: '#d97706' }}>上次拒絕：{t.refused}</span>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
        {AXES.map((a) => (
          <label key={a.k} title={a.k === 'thr' ? '油門：推力大小' : a.k === 'roll' ? '橫滾：往左／右傾' : a.k === 'pitch' ? '俯仰：機頭往下／抬起' : '偏航：原地轉向'}>
            <span className="row"><span>{a.label}</span><span className="mono">{Math.round(stick[a.k] * 100)}%</span></span>
            <input type="range" min={a.min} max={1} step={0.01} value={stick[a.k]} onChange={(e) => setStick(a.k, +e.target.value)} aria-label={a.label} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={() => setStick('thr', 0)}>油門歸零</button>
        <button className="btn sm" style={{ flex: 1 }} onClick={center}>搖桿回中</button>
      </div>
      <div className="mono" style={{ fontSize: 11.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <span>高度 {t ? t.alt.toFixed(1) : '—'} cm</span>
        <span>目標 {t && t.mode === 'alt' ? `${t.ref.toFixed(0)} cm` : '—'}</span>
        <span>電池 {t ? `${t.vbat.toFixed(2)} V` : '—'}</span>
        <span>傾斜 {t ? `${Math.round(Math.max(Math.abs(t.roll), Math.abs(t.pitch)))}°` : '—'}</span>
      </div>
      {running && <AltChart />}
      <span className="dim" style={{ fontSize: 10.5 }} title="綁繩最多讓它飛到 60 cm">畫面高度縮小顯示：1 m → 6 cm</span>
    </div>
  );
}
