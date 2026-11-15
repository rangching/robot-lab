import { P_JN_BUTTON, P_JN_DETECT, P_JN_LED, P_JN_TRACK } from '../../sim/programsJetson';
import { gndEps } from '../../sim/board';
import { useVision } from '../../sim/vision';
import type { Comp, CompType, Wire } from '../../sim/types';
import type { Ctx, Mission } from './missions';

// 只 import missions.ts 的型別，避免執行期的循環相依
const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);
const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => gndEps().some((g) => conn(c, a, g));
const ok = (c: Ctx) => !c.issues.some((i) => i.level === 'error');
function resBetween(c: Ctx, a: string, b: string, big = false) {
  return of(c, 'resistor').some((r) => (!big || (r.props.ohms ?? 220) >= 4700) && ((conn(c, a, `${r.id}:1`) && conn(c, b, `${r.id}:2`)) || (conn(c, a, `${r.id}:2`) && conn(c, b, `${r.id}:1`))));
}
const ledOn = (c: Ctx, pin: string) => of(c, 'led').some((l) => resBetween(c, pin, `${l.id}:A`) && toGnd(c, `${l.id}:K`));
const btnToGnd = (c: Ctx, pin: string) => of(c, 'button').some((b) => (conn(c, pin, `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, pin, `${b.id}:2`) && toGnd(c, `${b.id}:1`)));
const vis = () => useVision.getState();

/** 預先接好：第 12 腳 → 220Ω → LED → 第 14 腳 GND */
const LED_12 = (color = '#ff3b4f'): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: -2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: -2.6, props: { color } },
  ],
  wires: [
    { id: 'pw1', a: 'mcu:PIN12', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND3', color: '#334155' },
  ],
});

export const JETSON_MISSIONS: Mission[] = [
  {
    id: 'j1', board: 'jetson', num: 1, title: 'Jetson 的第一盞 LED', sub: 'Python · Jetson.GPIO · BOARD 模式', badge: 'jetson-hello',
    goal: 'Jetson 的排針和樹莓派長得一樣，程式也很像。差別是這次用 BOARD 模式：程式裡寫 12，就是排針上數過去的第 12 腳，不用再對照 BCM 編號表。',
    program: P_JN_LED, lib: ['led', 'resistor'],
    steps: [
      { text: '讀右邊的程式：GPIO.setmode(GPIO.BOARD) 之後，LED = 12 指的就是實體第 12 腳。', why: 'Jetson.GPIO 已經內建在 JetPack，用法刻意模仿樹莓派的 RPi.GPIO。也支援 BCM 模式，但 BOARD 模式直接看排針數就好，最不容易接錯。', ack: '我看懂了', check: (c) => c.acks.includes('j1-s0') },
      { text: '從元件庫加入「LED」和「電阻 220Ω」。', check: (c) => of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '第 12 腳 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND（第 14 腳就在旁邊）。', why: '把滑鼠移到排針上可以看每支腳的腳號。偶數腳在靠板邊那一排，所以第 12、14 腳都在外側。', check: (c) => ledOn(c, 'mcu:PIN12') },
      { text: '按「上傳並執行」，看 LED 閃 3 次。', why: 'Jetson 排針的訊號經過電位轉換晶片，推力很弱：點一顆指示燈沒問題，但繼電器、馬達一定要透過電晶體或驅動板。', check: (c) => c.running && ok(c) && c.obs.extLedOn >= 3 },
    ],
  },
  {
    id: 'j2', board: 'jetson', num: 2, title: '按鈕要自己上拉', sub: '外加 10kΩ · 浮接 · 數位輸入', badge: 'jetson-button',
    goal: 'LED 已經接在第 12 腳。這關在第 18 腳接按鈕。樹莓派可以用程式打開內建上拉電阻，但 Jetson.GPIO 會直接忽略這個設定，所以要自己加一顆 10kΩ 上拉電阻。',
    program: P_JN_BUTTON, lib: ['button', 'resistor', 'led'], preset: LED_12(),
    steps: [
      { text: '加入一顆「按鈕」和一顆「電阻 10kΩ」。', check: (c) => of(c, 'button').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) >= 4700) },
      { text: '按鈕一腳接第 18 腳，另一腳接 GND。', why: '按下去時，第 18 腳被拉到 0 V，程式讀到 LOW。', check: (c) => btnToGnd(c, 'mcu:PIN18') },
      { text: '10kΩ 電阻一腳接第 18 腳，另一腳接 3V3（第 1 或第 17 腳）。', why: '沒按的時候，電阻把第 18 腳輕輕拉到 3.3 V，讀到 HIGH；按下時按鈕直接接地，10kΩ 只會流過 0.33 mA，不會短路。少了它，腳位是「浮接」的，讀值會亂跳。', check: (c) => btnToGnd(c, 'mcu:PIN18') && resBetween(c, 'mcu:PIN18', 'mcu:3V3', true) },
      { text: '按「上傳並執行」，在右上角按住按鈕，看 LED 亮起來。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
  {
    id: 'j3', board: 'jetson', num: 3, title: 'AI 看到人就亮燈', sub: 'CSI 相機 · detectNet · TensorRT · 功耗模式', badge: 'jetson-ai',
    goal: '這才是 Jetson 真正的本事。LED 已經接在第 12 腳，相機插在 CAM0。程式用預先訓練好的神經網路在 GPU 上逐張分析畫面：認出「人」就亮燈，看到貓或瓶子就不亮。',
    program: P_JN_DETECT, lib: ['led', 'resistor'], preset: LED_12('#22e3ff'),
    steps: [
      { text: '讀程式：net.Detect(img) 這一行會把整張畫面丟給 GPU，回傳「看到什麼、在哪裡、有多確定」。', why: 'ssd-mobilenet-v2 是已經訓練好的物件偵測模型。第一次執行時，TensorRT 會針對這顆 GPU 把模型最佳化成「引擎」檔，所以要等幾分鐘；之後就直接載入。', ack: '我看懂了', check: (c) => c.acks.includes('j3-s0') },
      { text: '按「上傳並執行」，等右上角的相機畫面開始顯示 FPS。', why: 'FPS 是每秒處理幾張畫面。相機畫面直接進到 GPU 記憶體，不用經過 CPU 複製，這是 Jetson 跑得快的原因之一。', check: (c) => c.running && vis().cam && vis().frames >= 10 },
      { text: '在相機面板選「🧍 人」，看偵測框和 LED。', why: '框框旁的百分比是「信心分數」。程式裡的 threshold 是門檻，低於門檻的結果直接丟掉。', check: (c) => c.running && ok(c) && vis().personFrames >= 15 && c.obs.extLedOn >= 1 },
      { text: '改成「🐈 貓」或「🍾 瓶子」，確認 LED 會熄掉。', why: '模型分得出 90 種東西，程式只在名稱是 "person" 時開燈，這就是「辨識」和「偵測到東西」的差別。', check: (c) => c.running && vis().personFrames >= 15 && vis().otherFrames >= 15 },
      { text: '把功耗模式切到「MAXN SUPER」，看 FPS 變高。', why: '「Super」就是靠更高的 GPU 和記憶體時脈換來更快的推論。代價是更耗電、更熱，電池供電的機器人常常反而選 15W。', check: (c) => c.running && vis().modes.includes('MAXN') && vis().maxFps >= 90 },
    ],
  },
  {
    id: 'j4', board: 'jetson', num: 4, title: 'AI 雲台：伺服機盯著人', sub: '硬體 PWM · 比例控制 · 共地', badge: 'jetson-track',
    goal: '讓機器人「轉頭看人」。伺服機的訊號接第 15 腳（硬體 PWM），電源另外接並記得共地。程式把人在畫面中的左右位置換成角度，每張畫面只追一部分，動作才會平順。',
    program: P_JN_TRACK, lib: ['servo', 'psu'],
    steps: [
      { text: '加入「SG90 伺服機」和「外接 5V 電源」。', check: (c) => of(c, 'servo').length > 0 && of(c, 'psu').length > 0 },
      { text: '伺服機紅線 V+ 接電源 +5V，棕線 GND 接電源 GND。', why: '伺服機啟動瞬間的電流很大，從 Jetson 的 5V 腳取電可能讓電壓下陷，嚴重時整台重開機，AI 程式就跟著中斷。', check: (c) => of(c, 'servo').some((s) => of(c, 'psu').some((p) => conn(c, `${s.id}:V`, `${p.id}:P`) && conn(c, `${s.id}:GND`, `${p.id}:N`))) },
      { text: '橘色訊號線 SIG 接第 15 腳。', why: '第 15、33 腳可以輸出硬體 PWM，脈衝由硬體產生，不會被 Linux 打斷。實際使用前要先執行 jetson-io.py 把它設成 PWM，再重開機。', check: (c) => of(c, 'servo').some((s) => conn(c, `${s.id}:SIG`, 'mcu:PIN15')) },
      { text: '把外接電源的 GND 接到 Jetson 的任一支 GND（共地）。', check: (c) => of(c, 'psu').some((p) => toGnd(c, `${p.id}:N`)) },
      { text: '按「上傳並執行」，在相機面板選「🧍 人」並勾選「自動走動」，看伺服機跟著人左右轉。', why: '程式裡的「追蹤速度」是比例控制的增益：越大追得越快，但太大會衝過頭、來回抖。可以停下來改改看。', check: (c) => c.running && ok(c) && vis().trackGood >= 60 && vis().xMax - vis().xMin > 0.5 && c.obs.servoMax - c.obs.servoMin > 60 },
    ],
  },
];
