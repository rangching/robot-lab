import { P_BLINK_D9, P_BLINK_L, P_BUTTON, P_MELODY, P_POT, P_POT_A7, P_SERVO, P_SONAR, type ProgramDef } from '../../sim/programs';
import { gndEps } from '../../sim/board';
import type { BoardId } from '../../data/types';
import type { Nets } from '../../sim/netlist';
import type { Observed } from '../../sim/engine';
import type { Comp, CompType, Issue, Wire } from '../../sim/types';
import { MEGA_MISSIONS } from './missionsMega';
import { ESP32_MISSIONS } from './missionsEsp32';
import { BLUEPILL_MISSIONS } from './missionsBluepill';
import { RPI4_MISSIONS } from './missionsRpi4';
import { PICO_MISSIONS } from './missionsPico';
import { NODEMCU_MISSIONS } from './missionsNodemcu';
import { STAMPFLY_MISSIONS } from './missionsStampfly';
import { JETSON_MISSIONS } from './missionsJetson';
import { THREEPI_MISSIONS } from './missionsThreepi';
import { MICROBIT_MISSIONS } from './missionsMicrobit';

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
  board: BoardId;
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
export const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);
const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => gndEps().some((g) => conn(c, a, g));
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
    { id: 'pw1', a: 'mcu:D9', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND3', color: '#334155' },
  ],
});

export const UNO_MISSIONS: Mission[] = [
  {
    id: 'm1', board: 'uno', num: 1, title: '讓 L 燈閃起來', sub: '不用接線 · 認識 setup／loop', badge: 'first-light',
    goal: '每個 Arduino 人的第一步：上傳程式，讓板子內建的 L 燈一亮一滅。',
    program: P_BLINK_L, lib: [],
    steps: [
      { text: '讀一下右邊的程式：setup() 開機只跑一次，loop() 會一直重複。', why: 'Arduino 程式永遠是這兩個區塊。', ack: '我看懂了', check: (c) => c.acks.includes('m1-s0') },
      { text: '按工作台上方的「上傳並執行」。', why: '上傳時 TX／RX 燈會快速閃爍，代表電腦正在把程式送進晶片。', check: (c) => c.running },
      { text: '看 L 燈閃 3 次。', why: 'HIGH 讓 D13 輸出 5 V，LOW 輸出 0 V。', check: (c) => c.running && c.obs.blinksL >= 3 },
      { text: '把程式裡的等待時間改成 100，再按一次「上傳並執行」。', why: 'delay() 的單位是毫秒；數字越小，燈閃得越快。', check: (c) => c.running && c.params.ms <= 150 && c.obs.blinksL >= 4 },
    ],
  },
  {
    id: 'm2', board: 'uno', num: 2, title: '點亮外接 LED', sub: '限流電阻 · LED 極性', badge: 'resistor',
    goal: '把一顆 LED 接到 D9。重點是串一顆 220Ω 電阻，還有分清楚長腳和短腳。',
    program: P_BLINK_D9, lib: ['led', 'resistor'],
    steps: [
      { text: '從下方元件庫加入「LED」和「電阻 220Ω」。', check: (c) => of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '用杜邦線把 Uno 的 D9 接到電阻的任一腳。', why: '先點一支腳，再點另一支腳，就會拉出一條線。', check: (c) => of(c, 'resistor').some((r) => conn(c, 'mcu:D9', `${r.id}:1`) || conn(c, 'mcu:D9', `${r.id}:2`)) },
      { text: '電阻的另一腳接到 LED 的長腳（＋）。', why: '電阻限制電流：(5 V − 2 V) ÷ 220 Ω ≈ 14 mA，剛好在安全範圍。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'mcu:D9', `${l.id}:A`)) },
      { text: 'LED 的短腳（−）接到 Uno 的 GND。', why: '電流要回到 GND 才算完成一個迴路。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'mcu:D9', `${l.id}:A`) && toGnd(c, `${l.id}:K`)) },
      { text: '按「上傳並執行」，看外接 LED 閃爍。', check: (c) => c.running && ok(c) && c.obs.extLedOn >= 2 },
    ],
  },
  {
    id: 'm3', board: 'uno', num: 3, title: '按鈕控制 LED', sub: 'digitalRead · INPUT_PULLUP', badge: 'input',
    goal: '上一關的 LED 電路已經幫你接好了。這次加一顆按鈕：按住才亮。',
    program: P_BUTTON, lib: ['button', 'led', 'resistor'], preset: LED_PRESET(),
    steps: [
      { text: '加入一顆「按鈕」。', check: (c) => of(c, 'button').length > 0 },
      { text: '按鈕的一腳接到 D2。', check: (c) => of(c, 'button').some((b) => conn(c, 'mcu:D2', `${b.id}:1`) || conn(c, 'mcu:D2', `${b.id}:2`)) },
      { text: '按鈕的另一腳接到 GND。', why: 'INPUT_PULLUP 讓 D2 平常被內部電阻拉到 HIGH；按下後接通 GND，就讀到 LOW。所以不用外加電阻！', check: (c) => of(c, 'button').some((b) => (conn(c, 'mcu:D2', `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, 'mcu:D2', `${b.id}:2`) && toGnd(c, `${b.id}:1`))) },
      { text: '按「上傳並執行」，然後按住工作台上的按鈕（或右下角的「按住按鈕」）。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
  {
    id: 'm4', board: 'uno', num: 4, title: '旋鈕調亮度', sub: 'analogRead · PWM', badge: 'analog',
    goal: '用可變電阻當旋鈕：A0 讀到 0–1023，再用 PWM 把 LED 調亮或調暗。',
    program: P_POT, lib: ['pot', 'led', 'resistor'], preset: LED_PRESET(),
    steps: [
      { text: '加入一個「可變電阻」。', check: (c) => of(c, 'pot').length > 0 },
      { text: '可變電阻的兩端（1 和 2）分別接到 5V 和 GND。', why: '兩端之間形成 0–5 V 的分壓，旋鈕決定中間腳拿到多少電壓。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:5V', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:5V', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 A0。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:A0', `${p.id}:W`)) },
      { text: '執行後拖曳右下角的旋鈕滑桿，從一端轉到另一端，看亮度跟著變。', why: 'PWM 其實是快速開關：開的時間比例越高，看起來越亮。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'm5', board: 'uno', num: 5, title: '伺服機來回擺', sub: '獨立供電 · 共地', badge: 'common-ground',
    goal: '伺服機轉動時很吃電，不要從 Uno 的 5V 取電。這關學會用外接電源，而且一定要共地。',
    program: P_SERVO, lib: ['servo', 'psu'],
    steps: [
      { text: '加入「SG90 伺服機」和「外接 5V 電源」。', check: (c) => of(c, 'servo').length > 0 && of(c, 'psu').length > 0 },
      { text: '伺服機的紅線 V+ 接電源的 +5V，棕線 GND 接電源的 GND。', check: (c) => of(c, 'servo').some((s) => of(c, 'psu').some((p) => conn(c, `${s.id}:V`, `${p.id}:P`) && conn(c, `${s.id}:GND`, `${p.id}:N`))) },
      { text: '橘色訊號線 SIG 接到 D9。', check: (c) => of(c, 'servo').some((s) => conn(c, `${s.id}:SIG`, 'mcu:D9')) },
      { text: '把外接電源的 GND 接到 Uno 的 GND（共地）。', why: '訊號的 HIGH／LOW 是「相對於 GND」的電壓。兩邊 GND 不相連，伺服機就看不懂 Uno 在說什麼。', check: (c) => of(c, 'psu').some((p) => toGnd(c, `${p.id}:N`)) },
      { text: '按「上傳並執行」，看伺服機從 0° 轉到 180° 再轉回來。', check: (c) => c.running && ok(c) && c.obs.servoMax > 150 && c.obs.servoMin < 30 },
    ],
  },
  {
    id: 'm6', board: 'uno', num: 6, title: '超音波倒車雷達', sub: 'pulseIn · 序列埠', badge: 'radar',
    goal: '用 HC-SR04 量前方障礙物的距離，把結果印在序列埠監控視窗。',
    program: P_SONAR, lib: ['hcsr04'],
    steps: [
      { text: '加入「HC-SR04 超音波」模組。', check: (c) => of(c, 'hcsr04').length > 0 },
      { text: 'VCC 接 5V、GND 接 GND。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:VCC`, 'mcu:5V') && toGnd(c, `${h.id}:GND`)) },
      { text: 'TRIG 接 D9、ECHO 接 D10。', why: 'TRIG 負責「喊一聲」，ECHO 回報「聽到回音花了多久」。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:TRIG`, 'mcu:D9') && conn(c, `${h.id}:ECHO`, 'mcu:D10')) },
      { text: '執行後拖曳「障礙物距離」滑桿，至少移動 30 cm，看序列埠的數字跟著變。', why: '距離 = 時間 × 音速 ÷ 2（聲音要去再回來）。', check: (c) => c.running && ok(c) && c.obs.distReads >= 3 && c.obs.distMax - c.obs.distMin >= 30 },
    ],
  },
];

export const NANO_MISSIONS: Mission[] = [
  {
    id: 'n1', board: 'nano', num: 1, title: 'Nano 報到：Blink', sub: 'Mini-USB · 選對開發板', badge: 'nano-hello',
    goal: '同一顆晶片、同一支程式。這關把 Uno 的 Blink 搬到 Nano 上，順便記住真的上傳時最常卡關的兩個設定。',
    program: P_BLINK_L, lib: [],
    steps: [
      { text: '讀一下右邊的程式。它和 Uno 的 Blink 一個字都沒改：Nano 的 L 燈一樣接在 D13。', why: '程式只認晶片，不認板子的外型。', ack: '我看懂了', check: (c) => c.acks.includes('n1-s0') },
      { text: '真的上傳前，在 Arduino IDE 選「開發板 → Arduino Nano」、「處理器 → ATmega328P」。', why: '相容板如果一直上傳逾時，處理器改選 ATmega328P (Old Bootloader)；電腦完全認不到板子，就是要裝 CH340 驅動程式，或換一條有資料線的 Mini-USB 線。', ack: '記住了', check: (c) => c.acks.includes('n1-s1') },
      { text: '按「上傳並執行」。', why: 'TX／RX 燈快速閃爍，代表程式正在送進晶片。', check: (c) => c.running },
      { text: '看 Nano 的 L 燈閃 3 次。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'n2', board: 'nano', num: 2, title: 'A7 旋鈕調亮度', sub: '純類比腳 · 麵包板 · PWM', badge: 'nano-a7',
    goal: 'A6、A7 是 Nano 才有的兩支純類比腳。拿 A7 讀旋鈕，再用 D3 的 PWM 調 LED 亮度。線都插在麵包板上，和排針同一直排就算接到。',
    program: P_POT_A7, lib: ['pot', 'led', 'resistor'],
    steps: [
      { text: '從元件庫加入「可變電阻」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'pot').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '可變電阻的兩端（1 和 2）分別接到 5V 和 GND。', why: '麵包板上，Nano 的每支腳外側都有一排相通的孔；線插在那裡，就等於接在那支腳上。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:5V', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:5V', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 A7。', why: 'A6、A7 只能 analogRead()。用來讀旋鈕剛好，D 腳就能留給 LED、按鈕這些數位用途。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:A7', `${p.id}:W`)) },
      { text: 'D3 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', why: 'Nano 的 PWM 腳和 Uno 一樣是 3、5、6、9、10、11，只是板子上通常不印「~」。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'mcu:D3', `${l.id}:A`) && toGnd(c, `${l.id}:K`)) },
      { text: '按「上傳並執行」，拖曳右下角的旋鈕從一端轉到另一端。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'n3', board: 'nano', num: 3, title: '蜂鳴器開機音效', sub: 'tone() · 被動蜂鳴器', badge: 'nano-tune',
    goal: '幫你的迷你機器人加一段開機音效：被動蜂鳴器接 D8，用 tone() 播出 Do Mi Sol Do。',
    program: P_MELODY, lib: ['buzzer'],
    steps: [
      { text: '加入一個「蜂鳴器」。', check: (c) => of(c, 'buzzer').length > 0 },
      { text: '蜂鳴器的 ＋ 接到 D8。', check: (c) => of(c, 'buzzer').some((b) => conn(c, 'mcu:D8', `${b.id}:P`)) },
      { text: '蜂鳴器的 − 接到 GND。', why: '被動蜂鳴器裡沒有震盪電路，要靠 tone() 送出方波：頻率越高，音調越高。', check: (c) => of(c, 'buzzer').some((b) => conn(c, 'mcu:D8', `${b.id}:P`) && toGnd(c, `${b.id}:N`)) },
      { text: '按「上傳並執行」，聽完一整段旋律（記得打開喇叭）。', check: (c) => c.running && ok(c) && c.obs.tones >= 6 },
    ],
  },
];

export const MISSIONS_BY_BOARD: Partial<Record<BoardId, Mission[]>> = {
  uno: UNO_MISSIONS,
  nano: NANO_MISSIONS,
  mega: MEGA_MISSIONS,
  esp32: ESP32_MISSIONS,
  bluepill: BLUEPILL_MISSIONS,
  rpi4: RPI4_MISSIONS,
  pico: PICO_MISSIONS,
  nodemcu: NODEMCU_MISSIONS,
  stampfly: STAMPFLY_MISSIONS,
  jetson: JETSON_MISSIONS,
  threepi: THREEPI_MISSIONS,
  microbit: MICROBIT_MISSIONS,
};
export const missionsFor = (b: BoardId): Mission[] => MISSIONS_BY_BOARD[b] ?? [];
export const MISSIONS: Mission[] = Object.values(MISSIONS_BY_BOARD).flat() as Mission[];
export const MISSION_MAP: Record<string, Mission> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const MISSION_XP_STEP = 15;
export const MISSION_XP_DONE = 50;
