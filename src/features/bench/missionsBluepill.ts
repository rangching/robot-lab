import { P_BP_BLINK, P_BP_IRQ, P_BP_POT, P_BP_SONAR } from '../../sim/programsBluepill';
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

/** 第 4 關預先接好：PA8 → 220Ω → LED → GND */
const LED_PA8 = (): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: -2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: -2.6, props: { color: '#34e07a' } },
  ],
  wires: [
    { id: 'pw1', a: 'mcu:PA8', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND1', color: '#334155' },
  ],
});

export const BLUEPILL_MISSIONS: Mission[] = [
  {
    id: 'bp1', board: 'bluepill', num: 1, title: 'Blue Pill 報到：反著亮的 PC13', sub: 'PC13 · 低電位點亮 · ST-Link', badge: 'bluepill-hello',
    goal: 'Blue Pill 的板上 LED 接在 PC13，而且要寫 LOW 才會亮——和 Arduino 剛好相反。這關讓它閃起來，順便弄懂剛買來的 Blue Pill 要怎麼把程式燒進去。',
    program: P_BP_BLINK, lib: [],
    steps: [
      { text: '讀一下右邊的程式：亮的時候寫 LOW、滅的時候寫 HIGH。', why: 'LED 的正極接 3.3 V、負極經電阻接 PC13。PC13 輸出 LOW 時兩端有電壓差，電流才流得過去；輸出 HIGH 時兩端都是 3.3 V，燈就熄了。', ack: '我看懂了', check: (c) => c.acks.includes('bp1-s0') },
      { text: '真的燒錄前：安裝「STM32 MCU based boards」，開發板選 Generic STM32F1 series → BluePill F103C8，再用 ST-Link 接 SWD 四支針（3.3、IO、CLK、G）。', why: '剛買來的 Blue Pill 沒有 USB bootloader，插 USB 只能供電。沒有 ST-Link 的話，也可以用 USB 轉 TTL 接 PA9／PA10，把 BOOT0 跳線跳到 1、按一下 RESET，選 Upload method「Serial」；燒完記得跳回 0。', ack: '記住了', check: (c) => c.acks.includes('bp1-s1') },
      { text: '按「上傳並執行」。', why: '用 SWD 燒錄時不必動 BOOT0 跳線，ST-Link 會直接接管晶片。', check: (c) => c.running },
      { text: '看 PC13 的綠燈閃 3 次。', why: 'PC13 只能吸入約 3 mA，點這顆小燈剛好；外接 LED、蜂鳴器請改用 PA8 這類一般腳位。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'bp2', board: 'bluepill', num: 2, title: '12 位元旋鈕調亮度', sub: 'analogReadResolution · PA0 · TIM1 PWM', badge: 'bluepill-adc',
    goal: 'STM32 的 ADC 有 12 位元（0–4095），但 Arduino 為了相容預設只給 10 位元。這關用 PA0 讀旋鈕，再用 PA8 的 PWM 調 LED 亮度。記住：類比腳最多只能進 3.3 V。',
    program: P_BP_POT, lib: ['pot', 'led', 'resistor'],
    steps: [
      { text: '從元件庫加入「可變電阻」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'pot').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '可變電阻的兩端（1 和 2）分別接到 3.3 和 G。', why: '接成 5V 的話，旋鈕轉到底會送 5 V 進 PA0。PA0 不是 5 V 容忍腳，會燒壞。Blue Pill 插在麵包板上後，每支腳外側還有兩排孔能接線。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:3V3', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:3V3', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 A0（PA0）。', why: 'PA0 是 ADC 第 0 通道；A0–A7、B0、B1 這 10 支腳都能讀類比電壓，全部在靠近你的那一排。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:PA0', `${p.id}:W`)) },
      { text: 'A8（PA8）→ 電阻 → LED 長腳（＋），LED 短腳（−）接 G。', why: 'PA8 接著 TIM1 的第 1 通道，analogWrite() 會用硬體計時器產生 PWM，不佔 CPU 時間。', check: (c) => ledOn(c, 'mcu:PA8') },
      { text: '按「上傳並執行」，把旋鈕從一端轉到另一端，看序列埠的數字在 0–4095 之間跑。', why: '沒寫 analogReadResolution(12) 的話最大只會到 1023。12 位元把 3.3 V 切成 4096 格，每格不到 1 mV。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'bp3', board: 'bluepill', num: 3, title: '5 V 容忍腳：超音波直接接', sub: 'FT 腳 · PB8／PB9 · pulseIn', badge: 'bluepill-ft',
    goal: 'HC-SR04 要 5 V 才量得準，回傳的 ECHO 也是 5 V。換成 ESP32 得先分壓，但 STM32 有一群標「FT」的腳能承受 5 V 的數位訊號。這關把 ECHO 直接接到 FT 腳 PB9。',
    program: P_BP_SONAR, lib: ['hcsr04'],
    steps: [
      { text: '從元件庫加入「超音波模組」。', check: (c) => of(c, 'hcsr04').length > 0 },
      { text: '模組的 VCC 接 5V、GND 接 G。', why: '5V 腳直接連 USB 的 5 V，供給超音波模組那一點點電流沒問題。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:VCC`, 'mcu:5V') && toGnd(c, `${h.id}:GND`)) },
      { text: 'TRIG 接到 B8（PB8）。', why: 'TRIG 只需要 HIGH 超過約 2 V 的觸發脈衝，3.3 V 的輸出就夠了。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:TRIG`, 'mcu:PB8')) },
      { text: 'ECHO 接到 B9（PB9）。', why: 'PB9 是 FT（Five-volt Tolerant）腳，晶片內部的保護結構讓它能承受 5 V 輸入。但類比腳 PA0–PA7、PB0、PB1 和 PB5 不是 FT，接過去上電前檢查就會擋下來。', check: (c) => of(c, 'hcsr04').some((h) => conn(c, `${h.id}:ECHO`, 'mcu:PB9')) },
      { text: '執行後拖曳「障礙物距離」滑桿，至少移動 30 cm，看序列埠的數字跟著變。', why: '72 MHz 的 STM32 量脈衝寬度的解析度比 Uno 細得多；進階做法是用計時器的「輸入捕捉」，完全不用 CPU 等待。', check: (c) => c.running && ok(c) && c.obs.distReads >= 3 && c.obs.distMax - c.obs.distMin >= 30 },
    ],
  },
  {
    id: 'bp4', board: 'bluepill', num: 4, title: '外部中斷：按一下切換燈', sub: 'attachInterrupt · volatile · 去彈跳', badge: 'bluepill-irq',
    goal: '輪詢是一直問「按了沒？」，中斷則是按鈕一動，硬體就立刻叫 CPU 過來處理。STM32 幾乎每支腳都能當外部中斷。上一關的 LED 已經接在 PA8，這關讓按鈕每按一下就切換一次亮滅。',
    program: P_BP_IRQ, lib: ['button', 'led', 'resistor'], preset: LED_PA8(),
    steps: [
      { text: '從元件庫加入「按鈕」。', check: (c) => of(c, 'button').length > 0 },
      { text: '按鈕一腳接 B12（PB12），另一腳接 G。', why: '程式把 PB12 設成 INPUT_PULLUP：沒按時是 HIGH，按下時被拉到 LOW，這個「從高掉到低」就是 FALLING 下降緣。STM32 每支一般腳都有內建上拉電阻。', check: (c) => of(c, 'button').some((b) => (conn(c, `${b.id}:1`, 'mcu:PB12') && toGnd(c, `${b.id}:2`)) || (conn(c, `${b.id}:2`, 'mcu:PB12') && toGnd(c, `${b.id}:1`))) },
      { text: '讀程式：onPress() 只把 flip 設成 true，真正切換燈的動作留在 loop() 裡做。', why: '中斷服務程式要越短越好；被中斷改的變數要加 volatile，告訴編譯器每次都要重新讀它。程式裡的 150 ms 檢查是用來濾掉按鈕的機械彈跳。', ack: '懂了', check: (c) => c.acks.includes('bp4-s2') },
      { text: '按「上傳並執行」，按 3 下按鈕：燈應該亮 → 滅 → 亮。', check: (c) => c.running && ok(c) && c.obs.extLedOn >= 2 },
    ],
  },
];
