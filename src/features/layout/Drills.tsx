import { useProgress } from '../progress/store';
import { go } from './nav';
import { IconPlay } from '../../lib/icons';

export function Drills() {
  const quizBest = useProgress((s) => s.quizBest);
  const asmDone = useProgress((s) => s.assemblyDone);
  return (
    <section className="section" id="drills">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-num"><b>03</b>測驗與組裝</span>
            <h2>親手找、親手裝，才記得住</h2>
            <p>兩個練習都在最上方的 3D 模型上進行。讀一百遍說明，不如自己找一次零件。</p>
          </div>
        </div>
        <div className="grid-2">
          <div className="panel drill-card">
            <span className="kicker">測驗 · 約一分鐘</span>
            <h3>找零件</h3>
            <p className="muted" style={{ margin: 0 }}>題目說出零件的用途，你在 3D 模型上點出它。可以旋轉、放大、翻到背面，就像拿著真的板子。</p>
            <ol>
              <li>看題目，例如「負責執行程式的大腦在哪裡？」</li>
              <li>點零件。不確定可以看提示，或跳過看答案。</li>
              <li>只有不看提示、第一次就點對才算分。</li>
            </ol>
            <div className="row">
              <button className="btn primary" onClick={() => go('quiz')}><IconPlay size={13} /> 開始測驗</button>
              <span className="best">6 題 · 最佳 {quizBest}/6</span>
            </div>
          </div>
          <div className="panel drill-card">
            <span className="kicker">組裝 · 幾分鐘</span>
            <h3>拆開，再焊回去</h3>
            <p className="muted" style={{ margin: 0 }}>板子拆成一盤零件。把每顆晶片、接頭、排母放回它的絲印外框，再一個一個焊上去。</p>
            <ol>
              <li>從托盤拖起一個零件。</li>
              <li>放到板子上對應的白色外框，靠近就會自動吸附。</li>
              <li>點一下發黃光的零件把它焊好。全部焊完，板子就會通電。</li>
            </ol>
            <div className="row">
              <button className="btn primary" onClick={() => go('assembly')}><IconPlay size={13} /> 開始組裝</button>
              <span className="best">15 個零件 · {asmDone ? '已完成 ✓' : '尚未完成'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
