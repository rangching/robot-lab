import { P_ESP_BLINK, P_ESP_POT, P_ESP_SERVO, P_ESP_WIFI } from '../../sim/programsEsp32';
import { gndEps } from '../../sim/board';
import { useWeb } from '../../sim/web';
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

/** 第 3 關預先接好：D18 → 220Ω → LED → GND */
const LED_D18 = (): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: -2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: -2.6, props: { color: '#22e3ff' } },
  ],
  wires: [
    { id: 'pw1', a: 'mcu:D18', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND2', color: '#334155' },
  ],
});

export const ESP32_MISSIONS: Mission[] = [
  {
    id: 'e1', board: 'esp32', num: 1, title: 'ESP32 報到：藍燈閃爍', sub: 'GPIO2 · 開發板管理員 · BOOT 鍵', badge: 'esp32-hello',
    goal: 'ESP32 的板上 LED 接在 GPIO2，不是 Arduino 習慣的 13。這關讓藍燈閃起來，順便記住第一次上傳最容易卡關的地方。',
    program: P_ESP_BLINK, lib: [],
    steps: [
      { text: '讀一下右邊的程式。和 Uno 的 Blink 只差兩個地方：LED 是 2 號腳，序列埠速度是 115200。', why: '在 ESP32 上，程式裡的數字就是 GPIO 編號：板子印 D2，程式就寫 2。', ack: '我看懂了', check: (c) => c.acks.includes('e1-s0') },
      { text: '真的上傳前：在「開發板管理員」安裝 esp32（Espressif Systems），再選「開發板 → DOIT ESP32 DEVKIT V1」。', why: '如果上傳一直停在「Connecting……_____」，就在那時按住板子上的 BOOT 鍵，看到百分比開始跑再放開。電腦完全認不到板子，則要安裝 CP210x 驅動程式，或換一條有資料線的 USB 線。', ack: '記住了', check: (c) => c.acks.includes('e1-s1') },
      { text: '按「上傳並執行」。', why: '上傳時程式是經過 CP2102 這顆晶片送進 ESP32 的。', check: (c) => c.running },
      { text: '看藍色 LED 閃 3 次。', why: 'HIGH 讓 GPIO2 輸出 3.3 V，不是 Uno 的 5 V。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'e2', board: 'esp32', num: 2, title: '3.3 V 的旋鈕', sub: '12 位元 ADC · 只能輸入的 D34', badge: 'esp32-adc',
    goal: 'ESP32 是 3.3 V 的世界：旋鈕要接 3V3，不能接 VIN 的 5 V。這關用只能輸入的 D34 讀旋鈕（0–4095），再用 D18 的 PWM 調 LED 亮度。',
    program: P_ESP_POT, lib: ['pot', 'led', 'resistor'],
    steps: [
      { text: '從元件庫加入「可變電阻」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'pot').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '可變電阻的兩端（1 和 2）分別接到 3V3 和 GND。', why: '接成 VIN 的話，旋鈕轉到底會送 5 V 進 ESP32，腳位可能直接燒壞。ESP32 插在麵包板上後，每支腳外側只剩最外面那一排孔能接線。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:3V3', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:3V3', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 D34。', why: 'D34 只能當輸入，拿來讀旋鈕剛好；它屬於 ADC1，之後開了 Wi-Fi 也照樣能讀。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:D34', `${p.id}:W`)) },
      { text: 'D18 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', why: '3.3 V 經過 220Ω 大約 6 mA，LED 會亮但比接 Uno 時暗一些。', check: (c) => ledOn(c, 'mcu:D18') },
      { text: '按「上傳並執行」，把旋鈕從一端轉到另一端，看序列埠的數字在 0–4095 之間跑。', why: '12 位元 ADC 把 0–3.3 V 切成 4096 格，比 Uno 的 1024 格細 4 倍。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'e3', board: 'esp32', num: 3, title: 'Wi-Fi 網頁開關燈', sub: 'WiFi.h · WebServer · 手機遙控', badge: 'esp32-wifi',
    goal: 'ESP32 最大的本事：連上 Wi-Fi，自己當一台小網頁伺服器。上一關的 LED 已經接在 D18，這關用「手機」連進 ESP32 的網頁開燈、關燈。',
    program: P_ESP_WIFI, lib: ['led', 'resistor'], preset: LED_D18(),
    steps: [
      { text: '讀程式：ssid 和 password 要換成你家的 Wi-Fi，而且必須是 2.4 GHz 的網路。', why: 'ESP32 的無線電只支援 2.4 GHz，連不上 5 GHz。手機熱點也可以，記得打開「最大相容性」或 2.4 GHz 模式。', ack: '我知道了', check: (c) => c.acks.includes('e3-s0') },
      { text: '按「上傳並執行」，等序列埠印出 IP 位址。', why: 'IP 是路由器發給 ESP32 的門牌號碼，手機和 ESP32 必須連在同一個 Wi-Fi，才找得到它。', check: (c) => c.running && !!useWeb.getState().ip },
      { text: '在工作台右下角的「手機」面板按「開燈」。', why: '手機的瀏覽器送出 GET /on 請求，ESP32 在 loop() 裡的 server.handleClient() 收到後，就執行 digitalWrite(LED, HIGH)。', check: (c) => c.running && ok(c) && useWeb.getState().on >= 1 && c.obs.extLedOn >= 1 },
      { text: '再按「關燈」。', check: (c) => c.running && useWeb.getState().on >= 1 && useWeb.getState().off >= 1 },
    ],
  },
  {
    id: 'e4', board: 'esp32', num: 4, title: '伺服機不斷電', sub: 'ESP32Servo · 共地 · Brownout', badge: 'esp32-servo',
    goal: 'ESP32 開 Wi-Fi 時本來就很吃電，再讓伺服機從同一個 USB 取電，電壓一掉 ESP32 就會自己重開機。這關幫伺服機接獨立電源，而且記得共地。',
    program: P_ESP_SERVO, lib: ['servo', 'psu'],
    steps: [
      { text: '加入「SG90 伺服機」和「外接 5V 電源」。', check: (c) => of(c, 'servo').length > 0 && of(c, 'psu').length > 0 },
      { text: '伺服機的紅線 V+ 接電源的 +5V，棕線 GND 接電源的 GND。', why: '伺服機用 5 V 比較有力；ESP32 的 3V3 電流不夠，接上去會轉不動。', check: (c) => of(c, 'servo').some((s) => of(c, 'psu').some((p) => conn(c, `${s.id}:V`, `${p.id}:P`) && conn(c, `${s.id}:GND`, `${p.id}:N`))) },
      { text: '橘色訊號線 SIG 接到 D13。', why: '伺服機只要訊號超過約 2.5 V 就認得出 HIGH，所以 ESP32 的 3.3 V 訊號可以直接用。', check: (c) => of(c, 'servo').some((s) => conn(c, `${s.id}:SIG`, 'mcu:D13')) },
      { text: '把外接電源的 GND 接到 ESP32 的 GND（共地）。', why: '少了共地，訊號沒有共同的 0 V 參考，伺服機會亂抖。序列埠如果出現「Brownout detector was triggered」，就是電壓掉太低讓 ESP32 重開機了。', check: (c) => of(c, 'psu').some((p) => toGnd(c, `${p.id}:N`)) },
      { text: '按「上傳並執行」，看伺服機從 0° 轉到 180° 再轉回來。', check: (c) => c.running && ok(c) && c.obs.servoMax > 150 && c.obs.servoMin < 30 },
    ],
  },
];
