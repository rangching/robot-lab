import { useEffect } from 'react';
import { botStop, useBot, type BotButton } from '../../sim/bot';
import { LAYOUTS } from '../../sim/drive';
import { layoutOf } from '../../sim/programsThreepi';

/**
 * Pololu 3pi+ 2040 的車上面板：OLED 畫面、按鈕 A／B／C、編碼器、循線與碰撞感測器的即時讀值。
 * 也負責把「目前程式用哪塊場地」告訴賽道墊，以及在程式停止時通知模擬。
 */
export function BotPanel({ running, programId }: { running: boolean; programId: string }) {
  const b = useBot();
  const layout = layoutOf(programId);
  useEffect(() => { useBot.getState().setLayout(layout); }, [layout]);
  useEffect(() => { if (!running) botStop(); }, [running]);
  const isLine = !!LAYOUTS[layout].path;
  const t = b.telem;
  const st = b.stats;
  const btn = (k: BotButton) => (
    <button
      key={k}
      className={`btn sm ${k === 'A' ? 'primary' : ''} ${b.held.includes(k) ? 'active' : ''}`}
      style={{ flex: 1, justifyContent: 'center' }}
      // 上傳中（程式還沒開始）按的不算數，等面板出現讀值才能按
      disabled={!running || !t}
      onPointerDown={() => b.press(k)}
      onPointerUp={() => b.release(k)}
      onPointerLeave={() => b.held.includes(k) && b.release(k)}
      title={k === 'A' ? '大部分程式都等你按 A 才出發' : k === 'B' ? '按鈕 B（也是 BOOTSEL）' : '按鈕 C'}
    >
      {k}
    </button>
  );
  return (
    <div style={{ display: 'grid', gap: 6, width: 240, padding: 8, border: '1px solid var(--line-strong)', borderRadius: 14, background: 'var(--panel-2)' }} aria-label="3pi+ 車上面板">
      <span className="row">
        <span>3pi+ 2040 · {LAYOUTS[layout].name}</span>
        <span className="mono" style={{ fontSize: 11 }}>{running ? '執行中' : '尚未執行'}</span>
      </span>
      <div className="mono" role="img" aria-label={`OLED 畫面：${b.oled.join(' ') || '空白'}`} style={{ background: '#04060a', color: '#9fe8ff', borderRadius: 8, padding: '6px 8px', fontSize: 11, lineHeight: 1.35, minHeight: 66, whiteSpace: 'pre' }}>
        {(b.oled.length ? b.oled : running ? [''] : ['', '  3pi+ 2040']).slice(0, 5).join('\n')}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>{(['A', 'B', 'C'] as const).map(btn)}</div>
      {t && (
        <>
          <span className="row mono" style={{ fontSize: 11 }}>
            <span>編碼器 L {t.counts[0]}　R {t.counts[1]}</span>
            <span>{Math.round(t.v)} cm/s</span>
          </span>
          <span className="row mono" style={{ fontSize: 11 }}>
            <span>馬達 {t.cmd[0]} / {t.cmd[1]}</span>
            <span>里程 {st ? Math.round(st.dist) : 0} cm</span>
          </span>
          <div aria-label={`循線感測器 DN1 到 DN5：${t.line.join('、')}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, alignItems: 'end' }}>
            {t.line.map((v, i) => (
              <div key={i} style={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
                <div style={{ width: '100%', height: 26, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 4, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${Math.min(100, v / 10)}%`, background: '#1e293b', borderRadius: 3 }} />
                </div>
                <span className="mono dim" style={{ fontSize: 9.5 }}>DN{i + 1}</span>
              </div>
            ))}
          </div>
          <span className="row mono" style={{ fontSize: 11 }}>
            <span>{t.calibrated ? '已校正（0–1000）' : '原始讀值（未校正）'}</span>
            <span>
              碰撞 <b style={{ color: t.bump[0] ? 'var(--red, #ef4444)' : 'var(--text-3)' }}>L</b>{' '}
              <b style={{ color: t.bump[1] ? 'var(--red, #ef4444)' : 'var(--text-3)' }}>R</b>
            </span>
          </span>
          {isLine && st && (
            <span className="row mono" style={{ fontSize: 11 }}>
              <span>圈數 {st.laps}{st.laps > 0 ? `（${(st.lapMs / 1000).toFixed(1)} 秒）` : ''}</span>
              <span>脫軌 {st.derails}　偏移 {st.wobble.toFixed(1)} cm</span>
            </span>
          )}
        </>
      )}
      {!running && <span className="dim" style={{ fontSize: 11 }}>按「上傳並執行」後，再按 A 讓車子出發</span>}
    </div>
  );
}
