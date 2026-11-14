import { P_BLINK_D9, P_BLINK_L, P_BUTTON, P_POT, P_SERVO, P_SONAR, type ProgramDef } from '../../sim/programs';
import type { Nets } from '../../sim/netlist';
import type { Observed } from '../../sim/engine';
import type { Comp, CompType, Issue, Wire } from '../../sim/types';

export interface Ctx {
  comps: Comp[];
  wires: Wire[];
  nets: Nets;
  running: boolean;
  params: Record<string, number>;
  acks: string[];
  obs: Observed;
  issues: Issue[];
}

export interface MStep {
  text: string;
  why?: string;
  ack?: string;
  check: (c: Ctx) => boolean;
}

export interface Mission {
  id: string;
  num: number;
  title: string;
  sub: string;
  goal: string;
  badge: string;
  program: ProgramDef;
  /** 預先擺好的元件與接線（承接上一關） */
  preset?: { comps: Comp[]; wires: Wire[] };
  lib: CompType[];
  steps: MStep[];
}

// ---------- 檢查小工具 ----------
const GND = ['uno:GND1', 'uno:GND2', 'uno:GND3'];
export const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);
const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => GND.some((g) => conn(c, a, g));
const ok = (c: Ctx) => !c.issues.some((i) => i.level === 'error');

/** 找到「一腳接 pin、另一腳接 target」的電阻 */
function resBetween(c: Ctx, a: string, b: string) {
  return of(c, 'resistor').some((r) => (conn(c, a, `${r.id}:1`) && conn(c, b, `${r.id}:2`)) || (conn(c, a, `${r.id}:2`) && conn(c, b, `${r.id}:1`)));
}

const LED_PRESET = (): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: -2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: -2.6, props: { color: '#ff3b4f' } },
  ],
  wires: [
    { id: 'pw1', a: 'uno:D9', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'uno:GND3', color: '#334155' },
  ],
});

export const MISSIONS: Mission[] = [
  {
    id: 'm1', num: 1, title: '讓 L 燈閃起來', sub: '不用接線 · 認識 setup／loop', badge: 'first-light',
    goal: '每個 Arduino 人的第一步：上傳程式，讓板子內建的 L 燈一亮一滅。',
    program: P_BLINK_L, lib: [],
    steps: [
      { text: '讀一下右邊的程式：setup() 開機只跑一次，loop() 會一直重複。', why: 'Arduino 程式永遠是這兩個區塊。', ack: '我看懂了', check: (c) => c.acks.includes('m1-read') },
      { text: '按工作台上方的「上傳並執行」。', why: '上傳時 TX／RX 燈會快速閃爍，代表電腦正在把程式送進晶片。', check: (c) => c.running },
      { text: '看 L 燈閃 3 次。', why: 'HIGH 讓 D13 輸出 5 V，LOW 輸出 0 V。', check: (c) => c.running && c.obs.blinksL >= 3 },
      { text: '把程式裡的等待時間改成 100，再按一次「上傳並執行」。', why: 'delay() 的單位是毫秒；數字越小，燈閃得越快。', check: (c) => c.running && c.params.ms <= 150 && c.obs.blinksL >= 4 },
    ],
  },
  {
    id: 'm2', num: 2, title: '點亮外接 LED', sub: '限流電阻 · LED 極性', badge: 'resistor',
    goal: '把一顆 LED 接到 D9。重點是串一顆 220Ω 電阻，還有分清楚長腳和短腳。',
    program: P_BLINK_D9, lib: ['led', 'resistor'],
    steps: [
      { text: '從下方元件庫加入「LED」和「電阻 220Ω」。', check: (c) => of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '用杜邦線把 Uno 的 D9 接到電阻的任一腳。', why: '先點一支腳，再點另一支腳，就會拉出一條線。', check: (c) => of(c, 'resistor').some((r) => conn(c, 'uno:D9', `${r.id}:1`) || conn(c, 'uno:D9', `${r.id}:2`)) },
      { text: '電阻的另一腳接到 LED 的長腳（＋）。', why: '電阻限制電流：(5 V − 2 V) ÷ 220 Ω ≈ 14 mA，剛好在安全範圍。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'uno:D9', `${l.id}:A`)) },
      { text: 'LED 的短腳（−）接到 Uno 的 GND。', why: '電流要回到 GND 才算完成一個迴路。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'uno:D9', `${l.id}:A`) && toGnd(c, `${l.id}:K`)) },
      { text: '按「上傳並執行」，看外接 LED 閃爍。', check: (c) => c.running && ok(c) && c.obs.extLedOn >= 2 },
    ],
  },
  {
    id: 'm3', num: 3, title: '按鈕控制 LED', sub: 'digitalRead · INPUT_PULLUP', badge: 'input',
    goal: '上一關的 LED 電路已經幫你接好了。這次加一顆按鈕：按住才亮。',
    program: P_BUTTON, lib: ['button', 'led', 'resistor'], preset: LED_PRESET(),
    steps: [
      { text: '加入一顆「按鈕」。', check: (c) => of(c, 'button').length > 0 },
      { text: '按鈕的一腳接到 D2。', check: (c) => of(c, 'button').some((b) => conn(c, 'uno:D2', `${b.id}:1`) || conn(c, 'uno:D2', `${b.id}:2`)) },
      { text: '按鈕的另一腳接到 GND。', why: 'INPUT_PULLUP 讓 D2 平常被內部電阻拉到 HIGH；按下後接通 GND，就讀到 LOW。所以不用外加電阻！', check: (c) => of(c, 'button').some((b) => (conn(c, 'uno:D2', `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, 'uno:D2', `${b.id}:2`) && toGnd(c, `${b.id}:1`))) },
      { text: '按「上傳並執行」，然後按住工作台上的按鈕（或右下角的「按住按鈕」）。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
  {
    id: 'm4', num: 4, title: '旋鈕調亮度', sub: 'analogRead · PWM', badge: 'analog',
    goal: '用可變電阻當旋鈕：A0 讀到 0–1023，再用 PWM 把 LED 調亮或調暗。',
    program: P_POT, lib: ['pot', 'led', 'resistor'], preset: LED_PRESET(),
    steps: [
      { text: '加入一個「可變電阻」。', check: (c) => of(c, 'pot').length > 0 },
      { text: '可變電阻的兩端（1 和 2）分別接到 5V 和 GND。', why: '兩端之間形成 0–5 V 的分壓，旋鈕決定中間腳拿到多少電壓。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'uno:5V', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'uno:5V', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 A0。', check: (c) => of(c, 'pot').some((p) => conn(c, 'uno:A0', `${p.id}:W`)) },
      { text: '執行後拖曳右下角的旋鈕滑桿，從一端轉到另一端，看亮度跟著變。', why: 'PWM 其實是快速開關：開的時間比例越高，看起來越亮。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'm5', num: 5, title: '伺服機來回擺', sub: '獨立供電 · 共地', badge: 'common-ground',
    goal: '伺服機轉動時很吃電，不要從 Uno 的 5V 取電。這關學會用外接電源，而且一定要共地。',
    program: P_SERVO, lib: ['servo', 'psu'],
    steps: [
      { text: '加入「SG90 伺服機」和「外接 5V 電源」。', check: (c) => of(c, 'servo').length > 0 && of(c, 'psu').length > 0 },
      { text: '伺服機的紅線 V+ 接電源的 +5V，棕線 GND 接電源的 GND。', check: (c) => of(c, 'servo').some((s) => of(c, 'psu').some((p) => conn(c, `${s.id}:V`, `${p.id}:P`) && conn(c, `${s.id}:GND`, `${p.id}:N`))) },
      { text: '橘色訊號線 SIG 接到 D9。', check: (c) => of(c, 'servo').some((s) => conn(c, `${s.id}:SIG`, 'uno:D9')) },
      { text: '把外接電源的 GND 接到 Uno 的 GND（共地）。', why: '訊號的 HIGH／LOW 是「相對於 GND」的電壓。兩邊 GND 不相連，伺服機就看不懂 Uno 在說什麼。', check: (c) => of(c, 'psu').some((p) => toGnd(c, `${p.id}:N`)) },
      { text: '按「上傳並執行」，看伺服機從 0° 轉到 180° 再轉回來。', check: (c) => c.running && ok(c) && c.obs.servoMax > 150 && c.obs.servoMin < 30 },
    ],
  },
  {
    id: 'm6', num: 6, title: '超音波倒車雷達', sub: 'pulseIn · 序列埠', badge: 'radar',
    goal: '用 HC-SR04 量前方障礙物的距離，把結果印在序列埠監控視窗。',
    program: P_SONAR, lib: ['hcsr04'],
    steps: [
      { text: '加入「HC-SR04 超音波」模組。', check: (c) => of(c, 'hcsr04').length > 0 },
      { text: 'VCC 接 5V、GND 接 GND。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:VCC`, 'uno:5V') && toGnd(c, `${h.id}:GND`)) },
      { text: 'TRIG 接 D9、ECHO 接 D10。', why: 'TRIG 負責「喊一聲」，ECHO 回報「聽到回音花了多久」。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:TRIG`, 'uno:D9') && conn(c, `${h.id}:ECHO`, 'uno:D10')) },
      { text: '執行後拖曳「障礙物距離」滑桿，至少移動 30 cm，看序列埠的數字跟著變。', why: '距離 = 時間 × 音速 ÷ 2（聲音要去再回來）。', check: (c) => c.running && ok(c) && c.obs.distReads >= 3 && c.obs.distMax - c.obs.distMin >= 30 },
    ],
  },
];

export const MISSION_MAP = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const MISSION_XP_STEP = 15;
export const MISSION_XP_DONE = 50;
