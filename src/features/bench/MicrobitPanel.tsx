import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { FRIEND_GROUP, mbStop, setMbToneHook, useMb, type MbButton } from '../../sim/microbit';
import { buzzerTone } from '../music/tone';

/** 5×5 LED 的小畫面（亮度 0–9） */
function Matrix({ m, size = 14, label }: { m: number[]; size?: number; label: string }) {
  const lit = m.filter((v) => v > 0).length;
  return (
    <div role="img" aria-label={`${label}：${lit} 顆 LED 亮著`} style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${size}px)`, gap: Math.round(size / 3), padding: 8, background: '#0b0d12', borderRadius: 8, justifyContent: 'center' }}>
      {m.map((v, i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: 3, background: v > 0 ? `rgba(255, 48, 48, ${0.25 + (v / 9) * 0.75})` : '#2a1414', boxShadow: v > 0 ? `0 0 ${v}px rgba(255, 60, 60, .8)` : 'none' }} />
      ))}
    </div>
  );
}

/** 傾斜板：拖曳圓點＝把板子往那個方向壓低 */
function TiltPad() {
  const tilt = useMb((s) => s.tilt);
  const setTilt = useMb((s) => s.setTilt);
  const ref = useRef<HTMLDivElement>(null);
  const S = 96;
  const move = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    setTilt(nx * 1024, ny * 1024);
  };
  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
      <div
        ref={ref}
        role="slider"
        aria-label={`傾斜：左右 ${tilt.x}、前後 ${tilt.y} 毫 g`}
        aria-valuenow={tilt.x}
        tabIndex={0}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => { if (e.buttons) move(e); }}
        onDoubleClick={() => setTilt(0, 0)}
        onKeyDown={(e) => {
          const d = 128;
          if (e.key === 'ArrowLeft') setTilt(tilt.x - d, tilt.y);
          else if (e.key === 'ArrowRight') setTilt(tilt.x + d, tilt.y);
          else if (e.key === 'ArrowUp') setTilt(tilt.x, tilt.y - d);
          else if (e.key === 'ArrowDown') setTilt(tilt.x, tilt.y + d);
          else if (e.key === ' ' || e.key === 'Enter') setTilt(0, 0);
          else return;
          e.preventDefault();
        }}
        style={{ position: 'relative', width: S, height: S, borderRadius: 10, border: '1px solid var(--line-strong)', background: 'radial-gradient(circle, var(--panel) 0 30%, var(--panel-2) 31%)', touchAction: 'none', cursor: 'grab' }}
      >
        <span style={{ position: 'absolute', left: `${50 + (tilt.x / 1024) * 50}%`, top: `${50 + (tilt.y / 1024) * 50}%`, width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 7, background: '#22e3ff', boxShadow: '0 0 6px #22e3ff' }} />
      </div>
      <span className="mono dim" style={{ fontSize: 10 }}>x {tilt.x}　y {tilt.y}（雙擊歸零）</span>
    </div>
  );
}

/**
 * micro:bit V2 面板：LED 畫面、按鈕 A／B、觸控 logo，以及依程式用到的感測器顯示對應的控制：
 * 傾斜板＋搖一搖、光線、溫度、指南針、麥克風（背景噪音＋拍手）、無線電（朋友的 micro:bit）。
 */
export function MicrobitPanel({ running, code }: { running: boolean; code: string }) {
  const s = useMb();
  useEffect(() => { if (!running) mbStop(); }, [running]);
  useEffect(() => {
    setMbToneHook(buzzerTone);
    return () => { buzzerTone(0); setMbToneHook(() => {}); };
  }, []);
  const uses = (k: string) => code.includes(k);
  const btn = (k: MbButton, text: string) => (
    <button
      key={k}
      className={`btn sm ${s.held.includes(k) ? 'active' : ''}`}
      style={{ flex: 1, justifyContent: 'center' }}
      disabled={!running || !s.running}
      onPointerDown={() => s.press(k)}
      onPointerUp={() => s.release(k)}
      onPointerLeave={() => s.held.includes(k) && s.release(k)}
      title={k === 'logo' ? '按住＝手指摸著 logo' : `按鈕 ${k}`}
    >
      {text}
    </button>
  );
  const slider = (label: string, key: 'light' | 'temp' | 'noise' | 'heading', min: number, max: number, unit = '') => (
    <label key={key} style={{ display: 'grid', gap: 2 }}>
      <span className="row" style={{ fontSize: 11 }}><span>{label}</span><span className="mono">{Math.round(s[key])}{unit}</span></span>
      <input type="range" min={min} max={max} value={s[key]} onChange={(e) => s.set({ [key]: Number(e.target.value) })} aria-label={label} />
    </label>
  );
  return (
    <div style={{ display: 'grid', gap: 6, width: 248, padding: 8, border: '1px solid var(--line-strong)', borderRadius: 14, background: 'var(--panel-2)' }} aria-label="micro:bit 面板">
      <span className="row">
        <span>micro:bit V2</span>
        <span className="mono" style={{ fontSize: 11 }}>
          {s.micOn && <b style={{ color: '#ff5c5c', marginRight: 6 }} title="麥克風指示燈">● MIC</b>}
          {running ? '執行中' : '尚未執行'}
        </span>
      </span>
      <Matrix m={s.matrix} label="LED 畫面" />
      <div style={{ display: 'flex', gap: 6 }}>
        {btn('A', 'A')}
        {btn('logo', '摸 logo')}
        {btn('B', 'B')}
      </div>

      {uses('accelerometer') && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TiltPad />
          <div style={{ display: 'grid', gap: 6, flex: 1 }}>
            <button className="btn sm" disabled={!running || !s.running} onClick={() => s.shake()} style={{ justifyContent: 'center' }}>搖一搖</button>
            <span className="dim" style={{ fontSize: 10.5 }}>拖曳圓點＝把板子往那邊壓低；3D 板子會跟著傾斜。</span>
          </div>
        </div>
      )}
      {uses('read_light_level') && slider('環境光線（0 暗–255 亮）', 'light', 0, 255)}
      {uses('temperature') && slider('晶片溫度', 'temp', 0, 40, ' °C')}
      {uses('compass') && slider('機頭方位（0＝北）', 'heading', 0, 359, '°')}
      {uses('microphone') && (
        <div style={{ display: 'grid', gap: 4 }}>
          {slider('背景噪音', 'noise', 0, 220)}
          <button className="btn sm primary" disabled={!running || !s.running} onClick={() => s.clap()} style={{ justifyContent: 'center' }}>👏 拍手</button>
        </div>
      )}
      {uses('radio') && (
        <div style={{ display: 'grid', gap: 4, padding: 6, border: '1px dashed var(--line-strong)', borderRadius: 10 }}>
          <span className="row" style={{ fontSize: 11 }}>
            <span>朋友的 micro:bit</span>
            <span className="mono">群組 {FRIEND_GROUP}{s.radioOn ? `／你的 ${s.group}` : ''}</span>
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Matrix m={s.friendMatrix} size={8} label="朋友的 LED 畫面" />
            <div className="mono" style={{ fontSize: 10.5, lineHeight: 1.4, flex: 1 }} aria-live="polite">
              {s.log.length === 0 && <span className="dim">還沒有訊息</span>}
              {s.log.slice(-4).map((m, i) => (
                <div key={i} style={{ color: m.lost ? 'var(--text-3)' : undefined }}>
                  {m.from === 'me' ? '你 →' : '← 朋友'} {m.text}{m.lost ? '（沒人收到）' : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {!running && <span className="dim" style={{ fontSize: 11 }}>按「上傳並執行」後，就能按按鈕、摸 logo、傾斜板子</span>}
    </div>
  );
}
