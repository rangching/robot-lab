import { P_PICO_BLINK, P_PICO_BUTTON, P_PICO_MELODY, P_PICO_POT } from '../../sim/programsPico';
import { gndEps } from '../../sim/board';
import type { Comp, CompType, Wire } from '../../sim/types';
import type { Ctx, Mission } from './missions';

// 只 import missions.ts 的型別，避免執行期的循環相依
const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);
const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => gndEps().some((g) => conn(c, a, g));
const ok = (c: Ctx) => !c.issues.some((i) => i.level === 'error');
function resBetween(c: Ctx, a: string, b: string) {
  return of(c, 'resistor').some((r) => (conn(c, a, `${r.id}:1`) && conn(c, b, `${r.id}:2`)) || (conn(c, a, `${r.id}:2`) && conn(c, b, `${r.id}:1`)));
}
const ledOn = (c: Ctx, pin: string) => of(c, 'led').some((l) => resBetween(c, pin, `${l.id}:A`) && toGnd(c, `${l.id}:K`));

/** 第 3 關預先接好：GP15 → 220Ω → LED → GND（第 2 關做過的那一組） */
const LED_GP15 = (): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: 2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: 2.6, props: { color: '#7cff6b' } },
  ],
  wires: [
    { id: 'pw1', a: 'mcu:GP15', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND4', color: '#334155' },
  ],
});

export const PICO_MISSIONS: Mission[] = [
  {
    id: 'pc1', board: 'pico', num: 1, title: 'Pico 報到：綠燈閃爍', sub: 'BOOTSEL · UF2 · MicroPython', badge: 'pico-hello',
    goal: 'Pico 最受歡迎的寫法是 MicroPython：先把 MicroPython 韌體「拖」進 Pico，之後就能直接寫 Python。這關讓接在 GP25 的綠色 LED 閃起來。',
    program: P_PICO_BLINK, lib: [],
    steps: [
      { text: '第一次使用：按住 BOOTSEL 再插上 USB，電腦會出現一顆叫 RPI-RP2 的磁碟。', why: '把 MicroPython 的 .uf2 韌體檔拖進這顆磁碟，Pico 會自動重新開機，磁碟消失就代表燒錄完成。之後寫 Python 程式都不用再按 BOOTSEL。', ack: '記住了', check: (c) => c.acks.includes('pc1-s0') },
      { text: '讀一下右邊的程式。Python 用「縮排」決定哪些程式在迴圈裡，沒有大括號也沒有分號。', why: 'while True: 底下縮排的那幾行會一直重複，作用和 Arduino 的 loop() 一樣。在 Thonny 裡按「執行」就會跑，存成 main.py 則每次通電都會自動執行。', ack: '我看懂了', check: (c) => c.acks.includes('pc1-s1') },
      { text: '按「上傳並執行」。', why: 'MicroPython 一行一行直譯程式，所以不用像 C++ 那樣先編譯；Thonny 透過 USB 把程式送進 Pico。', check: (c) => c.running },
      { text: '看綠色 LED 閃 3 次。', why: 'value(1) 讓 GP25 輸出 3.3 V。GP25 沒有拉到排針上，它專門用來控制這顆燈。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'pc2', board: 'pico', num: 2, title: '腳號偵探：按鈕開燈', sub: '第 20 腳 ≠ GP20 · PULL_UP', badge: 'pico-pins',
    goal: 'Pico 最容易接錯的地方：程式寫的是「GP 編號」，不是「第幾腳」。這關把 LED 接在第 20 腳（GP15），按鈕接在第 19 腳（GP14），按下按鈕就開燈。',
    program: P_PICO_BUTTON, lib: ['led', 'resistor', 'button'],
    steps: [
      { text: '從元件庫加入「LED」、「電阻 220Ω」和「按鈕」。', check: (c) => of(c, 'led').length > 0 && of(c, 'button').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: 'GP15 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', why: 'GP15 是靠近你這排的最後一支腳，也就是第 20 腳。如果你接到第 20 號 GPIO（GP20），它其實在另一排的第 26 腳。', check: (c) => ledOn(c, 'mcu:GP15') },
      { text: '按鈕一腳接 GP14，另一腳接 GND。', why: '程式用 Pin.PULL_UP 打開內建上拉電阻：沒按時 GP14 被拉到 3.3 V（讀到 1），按下去變成接地（讀到 0）。Pico 的每支 GPIO 都有內建上拉和下拉。', check: (c) => of(c, 'button').some((b) => (conn(c, 'mcu:GP14', `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, 'mcu:GP14', `${b.id}:2`) && toGnd(c, `${b.id}:1`))) },
      { text: '按「上傳並執行」，按住工作台上的按鈕，看 LED 亮起來。', why: '3.3 V 經過 220Ω 大約 6 mA，LED 會比接 Uno 時暗一點，但看得很清楚。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
  {
    id: 'pc3', board: 'pico', num: 3, title: '只有三支的類比腳', sub: 'ADC(26) · read_u16 · duty_u16', badge: 'pico-adc',
    goal: 'Pico 只有 GP26、GP27、GP28 三支腳能讀類比電壓。上一關的 LED 已經接在 GP15，這關用 GP26 讀旋鈕，再用 PWM 控制 LED 亮度。',
    program: P_PICO_POT, lib: ['pot', 'led', 'resistor'], preset: LED_GP15(),
    steps: [
      { text: '加入一個「可變電阻」。', check: (c) => of(c, 'pot').length > 0 },
      { text: '可變電阻的兩端（1 和 2）分別接到 3V3 和 GND（用 AGND 更好）。', why: '要接 3V3(OUT)，不能接 VBUS 的 5 V，不然旋鈕轉到底會送 5 V 進 GP26。AGND 是給類比電路用的接地，雜訊比較小；它在板子裡和其他 GND 相通。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:3V3', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:3V3', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 GP26。', why: 'GP26 就是 ADC0，在遠側那排、AGND 旁邊。接到其他 GP 腳的話，ADC() 會直接報錯。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:GP26', `${p.id}:W`)) },
      { text: '按「上傳並執行」，把旋鈕從一端轉到另一端，看序列埠的數字在 0–65535 之間跑。', why: 'RP2040 的 ADC 其實是 12 位元（0–4095），MicroPython 把它放大到 16 位元的範圍，和 duty_u16() 一樣，所以讀到的值可以直接拿去設亮度。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'pc4', board: 'pico', num: 4, title: 'PWM 開機音效', sub: 'freq() 決定音高 · duty_u16(32768)', badge: 'pico-tune',
    goal: 'MicroPython 沒有 tone()，但 PWM 就能發聲：freq() 設定頻率（音高），duty_u16(32768) 讓一半時間 HIGH 一半時間 LOW。被動蜂鳴器接 GP18，播一段開機音效。',
    program: P_PICO_MELODY, lib: ['buzzer'],
    steps: [
      { text: '加入一個「蜂鳴器」。', check: (c) => of(c, 'buzzer').length > 0 },
      { text: '蜂鳴器的 ＋ 接到 GP18。', why: 'GP18 在遠側那排、從 USB 數過來第 17 支（第 24 腳）。每支 GPIO 都能 PWM，所以換別支也可以，只要程式一起改。', check: (c) => of(c, 'buzzer').some((b) => conn(c, 'mcu:GP18', `${b.id}:P`)) },
      { text: '蜂鳴器的 − 接到 GND。', why: '被動蜂鳴器自己不會震盪，要靠 PWM 送出方波：每秒切換 523 次就是 Do，1047 次就是高八度的 Do。', check: (c) => of(c, 'buzzer').some((b) => conn(c, 'mcu:GP18', `${b.id}:P`) && toGnd(c, `${b.id}:N`)) },
      { text: '按「上傳並執行」，聽完一整段旋律（記得打開喇叭）。', check: (c) => c.running && ok(c) && c.obs.tones >= 6 },
    ],
  },
];
