import { LABEL_ICON, LABEL_ZH, POWER_MODES, useVision, type VisionLabel } from '../../sim/vision';

const BOX_COLOR: Record<VisionLabel, string> = { person: '#76b900', cat: '#22e3ff', bottle: '#ffb020' };
const TARGETS: (VisionLabel | null)[] = ['person', 'cat', 'bottle', null];

/**
 * 工作台上的「CSI 相機畫面」：使用者決定鏡頭前有什麼、在畫面哪裡、功耗模式；
 * Jetson 的 AI 程式把偵測結果寫回 useVision，這裡畫出偵測框與 FPS。
 */
export function AiCamera({ running }: { running: boolean }) {
  const v = useVision();
  const live = running && v.cam;
  const mode = POWER_MODES.find((m) => m.id === v.mode)!;
  // 畫面座標：寬 160、高 90，地板在 y = 84
  const FLOOR = 84;
  const glyph = v.target ? { person: 58, cat: 26, bottle: 30 }[v.target] : 0;
  return (
    <div style={{ display: 'grid', gap: 6, width: 252, padding: 8, border: '1px solid var(--line-strong)', borderRadius: 14, background: 'var(--panel-2)' }} aria-label="AI 相機畫面">
      <span className="row">
        <span>📷 CSI 相機 · detectNet</span>
        <span className="mono" style={{ fontSize: 11 }}>{live ? `${v.fps} FPS` : running ? '載入模型…' : '尚未執行'}</span>
      </span>
      <svg viewBox="0 0 160 90" style={{ width: '100%', borderRadius: 8, background: '#0b1220', display: 'block' }} role="img" aria-label={live ? `畫面中偵測到：${v.dets.map((d) => LABEL_ZH[d.label]).join('、') || '沒有東西'}` : '相機尚未開啟'}>
        <defs>
          <linearGradient id="aicam-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#25324a" />
            <stop offset="1" stopColor="#1a2436" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="160" height={FLOOR - 20} fill="url(#aicam-wall)" />
        <rect x="0" y={FLOOR - 20} width="160" height={110 - FLOOR} fill="#2c2620" />
        <rect x="104" y="10" width="34" height="24" rx="2" fill="#31415e" stroke="#3d5072" />
        {v.target && (
          <text x={v.x * 160} y={FLOOR - 2} fontSize={glyph} textAnchor="middle" style={{ opacity: live ? 1 : 0.55 }}>{LABEL_ICON[v.target]}</text>
        )}
        {live && v.dets.map((d, i) => {
          const w = d.w * 160;
          const h = d.h * 90;
          const x = d.cx * 160 - w / 2;
          const y = FLOOR - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="none" stroke={BOX_COLOR[d.label]} strokeWidth="1.2" />
              <rect x={x} y={y - 8} width={Math.max(w, 40)} height="8" fill={BOX_COLOR[d.label]} />
              <text x={x + 2} y={y - 2} fontSize="6" fill="#0b1220" fontFamily="JetBrains Mono, monospace" fontWeight="700">{d.label} {Math.round(d.conf * 100)}%</text>
            </g>
          );
        })}
        {!live && <text x="80" y="40" fontSize="7" fill="#9fb0c8" textAnchor="middle">{running ? 'TensorRT 引擎載入中…' : '按「上傳並執行」打開相機'}</text>}
        <text x="4" y="8" fontSize="5.5" fill="#cfe8d6" fontFamily="JetBrains Mono, monospace">{live ? `● REC  ${mode.label}` : ''}</text>
      </svg>
      <div className="seg" style={{ display: 'flex' }} role="group" aria-label="鏡頭前的東西">
        {TARGETS.map((t) => (
          <button key={t ?? 'none'} className={v.target === t ? 'on' : ''} style={{ flex: 1, padding: '4px 0', justifyContent: 'center' }} onClick={() => v.setTarget(t)} title={t ? LABEL_ZH[t] : '鏡頭前沒有東西'}>
            {t ? `${LABEL_ICON[t]} ${LABEL_ZH[t]}` : '空'}
          </button>
        ))}
      </div>
      <label>
        <span className="row"><span>左右位置</span><span className="mono">{Math.round(v.x * 100)}%</span></span>
        <input type="range" min={0} max={1} step={0.01} value={v.x} disabled={v.auto} onChange={(e) => v.setX(+e.target.value)} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={v.auto} onChange={(e) => v.setAuto(e.target.checked)} />
        <span>自動走動（目標在畫面裡來回走）</span>
      </label>
      <div className="seg" style={{ display: 'flex' }} role="group" aria-label="功耗模式">
        {POWER_MODES.map((m) => (
          <button key={m.id} className={v.mode === m.id ? 'on' : ''} style={{ flex: 1, padding: '4px 0', justifyContent: 'center', fontSize: 11.5 }} onClick={() => v.setMode(m.id)} title={m.note}>{m.label}</button>
        ))}
      </div>
      <span className="dim" style={{ fontSize: 11 }}>{mode.note}（FPS 為示意值）</span>
    </div>
  );
}
