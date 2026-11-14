import { BOARDS } from '../../data/boards';
import { useUi } from '../progress/store';
import { switchBoard } from '../layout/nav';
import { isPlayable } from '../../data/boards/registry';
import { useProgress } from '../progress/store';
import { IconLock } from '../../lib/icons';

export function Compare() {
  const pushToast = useUi((s) => s.pushToast);
  const cur = useProgress((s) => s.board);
  const open = BOARDS.filter((b) => !b.locked && isPlayable(b.id)).map((b) => b.name.replace('Arduino ', '').replace(' R3', ''));
  return (
    <section className="section" id="compare">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-num"><b>04</b>比較</span>
            <h2>8 塊板子並排比一比</h2>
            <p>決定一個專題該用哪塊板子，看的就是這幾個數字。目前開放 {open.join('、')}，其他板子陸續推出；點開放的板子可以直接切換。</p>
          </div>
        </div>
        <div className="panel cmp-wrap">
          <table className="cmp">
            <thead>
              <tr>{['板子', '微控制器', '時脈', 'FLASH', 'RAM', 'GPIO', '類比輸入', '無線', '邏輯', '價格'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {BOARDS.map((b) => {
                const lock = b.locked || !isPlayable(b.id);
                return (
                <tr key={b.id} className={b.id === cur ? 'on' : ''} onClick={() => (lock ? pushToast({ text: `${b.name}：製作中，即將開放`, kind: 'info' }) : switchBoard(b.id))}>
                  <td><b>{b.name}{lock && <span className="lk"><IconLock size={11} /> 即將推出</span>}</b><small>{b.maker}</small></td>
                  <td>{b.mcu}</td><td>{b.clock}</td><td>{b.flash}</td><td>{b.ram}</td><td>{b.gpio}</td><td>{b.analog}</td><td>{b.wireless}</td>
                  <td style={{ color: b.logic === '5 V' ? 'var(--amber)' : 'var(--cyan)' }}>{b.logic}</td><td>{b.price}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>價格是一般零售參考價，依賣家而異。「邏輯」是 I/O 腳的電壓：千萬不要把 5 V 訊號直接接進 3.3 V 的板子。</p>
      </div>
    </section>
  );
}
