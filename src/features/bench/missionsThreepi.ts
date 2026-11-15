import { P_TP_BUMP, P_TP_DRIVE, P_TP_LINE_P, P_TP_ODO, P_TP_PID, P_TP_TURN } from '../../sim/programsThreepi';
import { useBot } from '../../sim/bot';
import type { Ctx, Mission } from './missions';

// 只 import missions.ts 的型別，避免執行期的循環相依
// 3pi+ 不用接線：每一關都是「寫程式 → 按 A → 看車子怎麼跑」，檢查的是模擬器的統計（src/sim/drive.ts）
const bot = () => useBot.getState();
const stats = () => bot().stats;
const bumps = () => (stats()?.bumpsL ?? 0) + (stats()?.bumpsR ?? 0);
const odoErr = () => {
  const o = bot().odo;
  return o ? o.actual - o.target : null;
};
const ran = (c: Ctx) => c.running && !!stats();

export const THREEPI_MISSIONS: Mission[] = [
  {
    id: 'tp1', board: 'threepi', num: 1, title: '3pi+ 出發：前進、倒車', sub: 'robot.Motors · set_speeds · 按 A 才出發', badge: 'tp-drive',
    goal: '3pi+ 不用接線，整台就是機器人。第一支程式讓它往前開一段、再倒車回來，順便認識每支範例都有的「按 A 才出發」。',
    program: P_TP_DRIVE, lib: [],
    steps: [
      { text: '讀程式：motors.set_speeds(左輪, 右輪)，範圍 −6000～6000，正數往前、負數倒車。', why: '兩個輪子各自控制，這叫差速驅動。6000 是官方函式庫的 MAX_SPEED。', ack: '我看懂了', check: (c) => c.acks.includes('tp1-s0') },
      { text: '真的車子要先做兩件事：打開電源開關（馬達的電來自電池），然後把車子放在地上。', why: '只插 USB 時程式照樣會跑，但馬達不會轉。放在桌上按 A，它會直接開下桌。', ack: '記住了', check: (c) => c.acks.includes('tp1-s1') },
      { text: '按「上傳並執行」，再按右下角面板上的 A。', why: '程式一開始停在 while not button_a.check()，等你把手移開才出發。', check: (c) => ran(c) && (stats()?.maxAdvance ?? 0) >= 5 },
      { text: '看它往前開、再倒車回到起點附近。', why: '前進和倒車的時間一樣，所以會回到差不多的位置；看看墊子上的尺，它前進了幾公分？', check: (c) => ran(c) && stats()!.maxAdvance >= 10 && stats()!.dist >= stats()!.maxAdvance * 1.6 },
      { text: '把速度改成 3000（時間不變），再上傳一次、按 A。', why: '速度加倍、時間不變，距離大約也加倍。Standard 版速度 6000 大約是每秒 1.5 公尺。', check: (c) => ran(c) && c.params.spd >= 3000 && stats()!.maxAdvance >= 40 },
    ],
  },
  {
    id: 'tp2', board: 'threepi', num: 2, title: '原地轉 90°', sub: '差速轉彎 · 開迴路控制的極限', badge: 'tp-turn',
    goal: '左輪往後、右輪往前，車子就會原地左轉。這關用「轉多久」來控制角度，調到剛好 90°，再看看這個方法有什麼問題。',
    program: P_TP_TURN, lib: [],
    steps: [
      { text: '讀程式：set_speeds(−速度, 速度) 是原地左轉；轉完用編碼器算出實際轉了幾度。', why: '兩輪反方向、同速，車子中心不動，繞著自己轉。每個輪子沿著直徑 8.55 cm 的圓走，走的弧長除以半徑就是角度。', ack: '我看懂了', check: (c) => c.acks.includes('tp2-s0') },
      { text: '上傳並執行，按 A，看序列埠印出轉了幾度。', check: (c) => c.running && bot().lastTurn !== null },
      { text: '調整「轉多久」的毫秒數，讓它轉 85°～95°。每改一次都要重新上傳、按 A。', why: '這叫「開迴路」：只下指令、不看結果。轉太多就把毫秒調小，轉太少就調大。', check: (c) => c.running && Math.abs((bot().lastTurn ?? 0) - 90) <= 5 },
      { text: '毫秒數不要動，只把速度改成 2000，再轉一次。', why: '速度一變，同樣的時間轉出來的角度就完全不同；換地板、輪子沾灰塵也一樣。要轉得準，得一邊轉一邊量：下一關的編碼器、或是 IMU 的陀螺儀。', check: (c) => c.running && c.params.spd >= 2000 && (bot().lastTurn ?? 0) >= 120 },
    ],
  },
  {
    id: 'tp3', board: 'threepi', num: 3, title: '編碼器量距離', sub: 'robot.Encoders · counts 換算公分 · 閉迴路', badge: 'tp-odo',
    goal: '輪子轉一圈，編碼器數到 358.3；輪子直徑 3.2 cm，一圈走 10.05 cm。用這兩個數字，讓車子不管速度多少，都停在你指定的距離。',
    program: P_TP_ODO, lib: [],
    steps: [
      { text: '讀程式：35.6 counts／cm 是怎麼來的？358.3 ÷（π × 3.2）≈ 35.6。', why: '358.3 是馬達軸上的 12 counts 乘上 29.86 的減速比。程式一直讀編碼器，兩輪平均到達目標就停車，這叫「閉迴路」。', ack: '我算過了', check: (c) => c.acks.includes('tp3-s0') },
      { text: '上傳並執行、按 A：車子要停在 30 cm（誤差 2 cm 內），看墊子上的尺對一下。', why: '序列埠會同時印出編碼器算的距離和「尺量」的實際距離。', check: (c) => c.running && bot().odo !== null && Math.abs(odoErr()!) <= 2 },
      { text: '把目標改成 50 cm，再跑一次。', why: '注意左、右的計數不一樣，車子也稍微歪了：世界上沒有兩顆完全一樣的馬達。進階做法是比較兩輪計數，把快的那輪調慢一點。', check: (c) => c.running && c.params.cm >= 50 && (bot().odo?.target ?? 0) >= 50 && Math.abs(odoErr()!) <= 2 },
      { text: '最後把速度提高到 5000，看它停在哪裡。', why: '車子有慣性，程式發現「到了」才煞車，跑得越快衝得越遠。真正的機器人會在快到的時候先減速。', check: (c) => c.running && c.params.spd >= 5000 && (odoErr() ?? 0) > 2 },
    ],
  },
  {
    id: 'tp4', board: 'threepi', num: 4, title: '撞到就轉彎', sub: 'robot.BumpSensors · 左右分開判斷', badge: 'tp-bump',
    goal: '車頭的保險桿被撞到時，底下的紅外線感測器會發現。讓車子在擺了木塊的場地裡亂逛：左邊撞到往右轉，右邊撞到往左轉。',
    program: P_TP_BUMP, lib: [],
    steps: [
      { text: '讀程式：bump.calibrate() 在開機時記下「沒被壓」的讀值，之後 left_is_pressed()／right_is_pressed() 才判斷得準。', why: '3pi+ 的碰撞感測器不是機械按鍵，而是用紅外線看保險桿有沒有往後退，所以要先校正，校正時別碰保險桿。', ack: '我看懂了', check: (c) => c.acks.includes('tp4-s0') },
      { text: '上傳並執行、按 A，看它第一次撞到木塊後倒車轉開。', check: (c) => ran(c) && bumps() >= 1 },
      { text: '讓它自己逛：撞到 5 次以上、總共跑 2 公尺。', why: '撞到後一定要先倒車再轉，不然原地轉彎時保險桿還頂著木塊，會一直卡住。', check: (c) => ran(c) && bumps() >= 5 && stats()!.dist >= 200 },
      { text: '觀察：車子側面擦到牆的時候，碰撞開關有反應嗎？', why: '沒有。兩顆感測器只看得到正前方左右兩側。真正的掃地機器人會在側面也裝距離感測器，你可以從擴充排針外接。', ack: '側面撞到它不知道', check: (c) => c.acks.includes('tp4-s3') },
    ],
  },
  {
    id: 'tp5', board: 'threepi', num: 5, title: '循線：P 控制', sub: 'robot.LineSensors · 校正 · 加權平均', badge: 'tp-line',
    goal: '5 顆循線感測器做加權平均，算出黑線在車頭的哪裡（0～4000，2000 是正中間）。偏右就讓左輪快一點，偏左就讓右輪快一點：偏越多修越多，這就是比例（P）控制。',
    program: P_TP_LINE_P, lib: [],
    steps: [
      { text: '讀程式：l 是 DN2～DN5 讀值的加權平均，p = l − 2000 就是「偏了多少」。', why: '這是官方 line_follower.py 的算法。中間三顆都看不到線時，就照上次偏的方向給 0 或 4000，讓車子繼續往那邊找。', ack: '我看懂了', check: (c) => c.acks.includes('tp5-s0') },
      { text: '上傳並執行、按 A，看它原地左右擺動做校正。', why: '每顆感測器的靈敏度都不一樣，校正時記下每顆看到的最白和最黑，之後就能換算成 0～1000。面板上的讀值會從「原始」變成「已校正」。', check: (c) => c.running && !!bot().telem?.calibrated },
      { text: '校正完它會自己開始循線，讓它跑完一圈。', check: (c) => ran(c) && stats()!.laps >= 1 },
      { text: '把最高速度提高到 3000，跑一圈不脫軌。', why: 'kp 太小，彎道修不回來會甩出去；kp 太大，直線上會左右扭個不停。試試看把 kp 改成 2 或 60 會怎樣。', check: (c) => ran(c) && c.params.spd >= 3000 && stats()!.laps >= 1 && stats()!.derails === 0 },
    ],
  },
  {
    id: 'tp6', board: 'threepi', num: 6, title: '循線：加上 D 變 PD', sub: '微分項 · 預判衝過頭 · 調參', badge: 'tp-pid',
    goal: '換到彎來彎去的賽道、速度拉到 5000，只靠 P 會修正得太慢、衝出彎道。加上微分（D）：看偏移量「變化得多快」，在衝過頭之前就先收手。',
    program: P_TP_PID, lib: [],
    steps: [
      { text: '讀程式：d = p − last_p 是這一輪和上一輪的偏移差，pid = (p × kp + d × kd) // 10。', why: 'P 看「現在偏多少」，D 看「正在往哪邊偏、多快」。線正在快速往中間回來時，D 會提前減少修正量，車子就不會甩過頭。', ack: '我看懂了', check: (c) => c.acks.includes('tp6-s0') },
      { text: '先維持 kd = 0、速度 5000，上傳並執行、按 A，看它在急彎甩出賽道。', why: '高速時車子還沒轉回來，線就已經跑到感測器外面了。', check: (c) => ran(c) && c.params.kd === 0 && c.params.spd >= 4000 && stats()!.derails >= 1 },
      { text: '把 kd 加到 100 以上（試試 300），速度維持 5000 以上，連續跑兩圈不脫軌。', why: '每台車、每種地板的最佳參數都不同。調參的順序通常是：先加大 kp 直到開始抖，再加 kd 把抖動壓下來。', check: (c) => ran(c) && c.params.kd >= 100 && c.params.spd >= 5000 && stats()!.laps >= 2 && stats()!.derails === 0 },
      { text: '比較面板上的「偏移」：kd = 0 和 kd = 300 時，平均偏離黑線中心差多少？', why: '偏移越小，代表車子越貼著線跑，彎道也能跑得更快。這就是循線競速比賽裡大家拚命調的東西。', ack: '看到差別了', check: (c) => c.acks.includes('tp6-s3') },
    ],
  },
];
