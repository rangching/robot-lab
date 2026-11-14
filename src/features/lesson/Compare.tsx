import { BOARDS } from '../../data/boards';
import { useUi } from '../progress/store';
import { scrollToId } from '../../lib/labStore';
import { IconLock } from '../../lib/icons';

export function Compare() {
  const pushToast = useUi((s) => s.pushToast);
  return (
    <section className="section" id="compare">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-num"><b>04</b>比較</span>
            <h2>8 塊板子並排比一比</h2>
            <p>決定一個專題該用哪塊板子，看的就是這幾個數字。目前開放 Uno，其他板子完成 Uno 後陸續解鎖。</p>
          </div>
        </div>
        <div className="panel cmp-wrap">
          <table className="cmp">
            <thead>
              <tr>{['板子', '微控制器', '時脈', 'FLASH', 'RAM', 'GPIO', '類比輸入', '無線', '邏輯', '價格'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {BOARDS.map((b) => (
                <tr key={b.id} className={b.id === 'uno' ? 'on' : ''} onClick={() => (b.locked ? pushToast({ text: `${b.name}：完成 Uno 後的下一階段開放`, kind: 'info' }) : scrollToId('uno'))}>
                  <td><b>{b.name}{b.locked && <span className="lk"><IconLock size={11} /> 即將解鎖</span>}</b><small>{b.maker}</small></td>
                  <td>{b.mcu}</td><td>{b.clock}</td><td>{b.flash}</td><td>{b.ram}</td><td>{b.gpio}</td><td>{b.analog}</td><td>{b.wireless}</td>
                  <td style={{ color: b.logic === '5 V' ? 'var(--amber)' : 'var(--cyan)' }}>{b.logic}</td><td>{b.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>價格是一般零售參考價，依賣家而異。「邏輯」是 I/O 腳的電壓：千萬不要把 5 V 訊號直接接進 3.3 V 的板子。</p>
      </div>
    </section>
  );
}
