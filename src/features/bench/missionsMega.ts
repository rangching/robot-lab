import { P_BLINK_L, type ProgramDef } from '../../sim/programs';
import { gndEps } from '../../sim/board';
import type { CompType } from '../../sim/types';
// 只匯入型別：missions.ts 會反過來匯入本檔，避免執行期循環
import type { Ctx, Mission } from './missions';

const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);

const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => gndEps().some((g) => conn(c, a, g));
const ok = (c: Ctx) => !c.issues.some((i) => i.level === 'error');
function resBetween(c: Ctx, a: string, b: string) {
  return of(c, 'resistor').some((r) => (conn(c, a, `${r.id}:1`) && conn(c, b, `${r.id}:2`)) || (conn(c, a, `${r.id}:2`) && conn(c, b, `${r.id}:1`)));
}
const mapRange = (v: number, a: number, b: number, c: number, d: number) => Math.round(c + ((v - a) * (d - c)) / (b - a));

/** 雙排母上的按鈕（D22）控制 D44 的 LED */
export const P_MEGA_BUTTON: ProgramDef = {
  id: 'mega-button',
  title: '雙排母按鈕（D22 → D44）',
  outputs: ['D44'],
  code: `const int BUTTON = 22;   // 右端雙排母的第一支數位腳
const int LED = 44;      // 雙排母上的 PWM 腳

void setup() {
  pinMode(BUTTON, INPUT_PULLUP); ⟦s1⟧
  pinMode(LED, OUTPUT); ⟦s2⟧
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {   // 按下去了？ ⟦r⟧
    digitalWrite(LED, HIGH); ⟦on⟧
  } else {
    digitalWrite(LED, LOW); ⟦off⟧
  }
}`,
  *run(io) {
    io.pinMode('D22', 'INPUT_PULLUP');
    yield { at: 's1' };
    io.pinMode('D44', 'OUTPUT');
    yield { at: 's2' };
    for (;;) {
      const v = io.digitalRead('D22');
      yield { at: 'r', wait: 8 };
      if (v === 0) {
        io.digitalWrite('D44', 1);
        yield { at: 'on', wait: 8 };
      } else {
        io.digitalWrite('D44', 0);
        yield { at: 'off', wait: 8 };
      }
    }
  },
};

/** A8 讀旋鈕，D44 輸出 PWM */
export const P_MEGA_POT: ProgramDef = {
  id: 'mega-pot-a8',
  title: '可變電阻調亮度（A8 → D44 PWM）',
  outputs: ['D44'],
  code: `const int LED = 44;      // D44：Timer5 的 PWM 腳

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
  Serial.begin(9600); ⟦s2⟧
}

void loop() {
  int val = analogRead(A8);                // A8：Mega 的第二排類比腳 ⟦r⟧
  int bright = map(val, 0, 1023, 0, 255);  // 換成 PWM 範圍 ⟦m⟧
  analogWrite(LED, bright);                // 亮度 0–255 ⟦w⟧
  Serial.println(val); ⟦p⟧
  delay(100); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D44', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      const val = io.analogRead('A8');
      yield { at: 'r', wait: 4 };
      const b = mapRange(val, 0, 1023, 0, 255);
      yield { at: 'm', wait: 4 };
      io.analogWrite('D44', b);
      yield { at: 'w', wait: 4 };
      io.print(String(val));
      yield { at: 'p', wait: 4 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const MEGA_MISSIONS: Mission[] = [
  {
    id: 'g1', board: 'mega', num: 1, title: 'Mega 報到：Blink', sub: '選對開發板 · 同一支程式', badge: 'mega-hello',
    goal: 'Uno 的 Blink 一個字都不用改就能在 Mega 上跑：L 燈一樣接在 D13。這關順便記住上傳前要選的設定。',
    program: P_BLINK_L, lib: [],
    steps: [
      { text: '讀一下右邊的程式。它和 Uno 的 Blink 完全一樣。', why: 'LED_BUILTIN 在 Mega 上也是 13，所以範例程式可以直接沿用。', ack: '我看懂了', check: (c) => c.acks.includes('g1-s0') },
      { text: '真的上傳前，在 Arduino IDE 選「開發板 → Arduino Mega or Mega 2560」、「處理器 → ATmega2560 (Mega 2560)」。', why: '選成 Uno 的話，編譯出來的程式是給 ATmega328P 的，上傳時會因為晶片簽章不符而失敗。', ack: '記住了', check: (c) => c.acks.includes('g1-s1') },
      { text: '按「上傳並執行」。', why: 'TX／RX 燈快速閃爍，代表程式正經過 ATmega16U2 送進 ATmega2560。', check: (c) => c.running },
      { text: '看 Mega 的 L 燈閃 3 次。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'g2', board: 'mega', num: 2, title: '雙排母按鈕', sub: 'D22–D53 · INPUT_PULLUP', badge: 'mega-dbl',
    goal: '右端那條 2 × 18 的雙排母是 Mega 最大的寶庫。這關用 D22 讀按鈕、D44 點 LED，熟悉怎麼在長長的雙排母上找腳位。',
    program: P_MEGA_BUTTON, lib: ['button', 'led', 'resistor'],
    steps: [
      { text: '從元件庫加入「按鈕」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'button').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '按鈕的一腳接 D22，另一腳接 GND。', why: '雙排母最上面一排是 5V、最下面一排是 GND，中間由上往下是 22／23、24／25……一路到 52／53。偶數在左欄、奇數在右欄。', check: (c) => of(c, 'button').some((b) => (conn(c, 'mcu:D22', `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, 'mcu:D22', `${b.id}:2`) && toGnd(c, `${b.id}:1`))) },
      { text: 'D44 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', why: '雙排母上只有 44、45、46 能輸出 PWM；這關只用到開關，但下一關就會用到它的 PWM。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'mcu:D44', `${l.id}:A`) && toGnd(c, `${l.id}:K`)) },
      { text: '按「上傳並執行」，然後按住按鈕。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
  {
    id: 'g3', board: 'mega', num: 3, title: 'A8 旋鈕調亮度', sub: '第二排類比腳 · PWM', badge: 'mega-a8',
    goal: 'Uno 只有 A0–A5，Mega 一路排到 A15。這關改用 A8 讀旋鈕，再把數值送到 D44 的 PWM 調 LED 亮度。',
    program: P_MEGA_POT, lib: ['pot', 'led', 'resistor'],
    steps: [
      { text: '從元件庫加入「可變電阻」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'pot').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '可變電阻的兩端（1 和 2）分別接到 5V 和 GND。', why: '雙排母頂端那兩支 5V 也可以用，和電源排母的 5V 是同一條線。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:5V', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:5V', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 A8。', why: 'A8–A15 在板子下緣最右邊那排。程式裡直接寫 analogRead(A8) 就好。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:A8', `${p.id}:W`)) },
      { text: 'D44 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'mcu:D44', `${l.id}:A`) && toGnd(c, `${l.id}:K`)) },
      { text: '按「上傳並執行」，拖曳右下角的旋鈕從一端轉到另一端。', why: 'PWM 是快速開關：開的時間比例越高，LED 看起來越亮。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
];
