import { useWeb } from '../../sim/web';
import { useBoard } from '../../lib/useBoard';

/** 工作台上的「手機瀏覽器」：連到板子上的網頁伺服器，按鈕會送出 GET /on、/off */
export function WebPhone({ running }: { running: boolean }) {
  const board = useBoard();
  const ip = useWeb((s) => s.ip);
  const led = useWeb((s) => s.led);
  const request = useWeb((s) => s.request);
  const ready = running && !!ip;
  return (
    <div style={{ display: 'grid', gap: 6, padding: 8, border: '1px solid var(--line-strong)', borderRadius: 14, background: 'var(--panel-2)' }} aria-label="手機瀏覽器">
      <span className="row"><span>📱 手機</span><span className="mono" style={{ fontSize: 11 }}>{ready ? 'Wi-Fi：RobotLab' : running ? `等 ${board.short} 連線…` : '尚未執行'}</span></span>
      <div className="mono" style={{ fontSize: 11.5, padding: '4px 8px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--line)', color: ready ? 'var(--text)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ready ? `http://${ip}/` : 'http://…'}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className={`btn sm ${ready && led ? 'active' : ''}`} style={{ flex: 1 }} disabled={!ready} onClick={() => request('/on')}>開燈</button>
        <button className={`btn sm ${ready && !led ? 'active' : ''}`} style={{ flex: 1 }} disabled={!ready} onClick={() => request('/off')}>關燈</button>
      </div>
    </div>
  );
}
