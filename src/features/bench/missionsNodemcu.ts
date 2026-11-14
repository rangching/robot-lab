import { P_NM_BLINK, P_NM_BUTTON, P_NM_POT, P_NM_WIFI } from '../../sim/programsNodemcu';
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

/** 第 3 關預先接好：D5 → 220Ω → LED → GND */
const LED_D5 = (): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: -2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: -2.6, props: { color: '#22e3ff' } },
  ],
  wires: [
    { id: 'pw1', a: 'mcu:D5', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND3', color: '#334155' },
  ],
});

export const NODEMCU_MISSIONS: Mission[] = [
  {
    id: 'nm1', board: 'nodemcu', num: 1, title: 'NodeMCU 報到：顛倒的藍燈', sub: 'LED_BUILTIN · 低電位亮 · 開發板管理員', badge: 'nodemcu-hello',
    goal: 'NodeMCU 的 LED_BUILTIN 是焊在模組上的藍燈，接在 D4（GPIO2），而且接成「低電位才亮」。這關讓它閃起來，順便記住寫 LOW 反而是開燈。',
    program: P_NM_BLINK, lib: [],
    steps: [
      { text: '讀一下右邊的程式：開燈那一行寫的是 LOW，關燈才是 HIGH。', why: '藍燈的正極接在 3.3 V、負極接到 GPIO2。GPIO2 輸出 LOW（0 V）時，燈的兩端才有電壓差、電流才流得過去。', ack: '我看懂了', check: (c) => c.acks.includes('nm1-s0') },
      { text: '真的上傳前：在「開發板管理員」安裝 esp8266（ESP8266 Community），再選「開發板 → NodeMCU 1.0 (ESP-12E Module)」。', why: 'Amica 版用 CP2102，要裝 CP210x 驅動；LoLin 版用 CH340，要裝 CH34x 驅動。上傳一直失敗時，按住 FLASH、按一下 RST，再放開 FLASH，就能手動進入燒錄模式。', ack: '記住了', check: (c) => c.acks.includes('nm1-s1') },
      { text: '按「上傳並執行」。', why: '開機瞬間序列埠會先吐出一小段亂碼，那是 ESP8266 用 74880 鮑率印的開機訊息，不是程式壞掉。', check: (c) => c.running },
      { text: '看模組上的藍燈閃 3 次。', why: '序列埠印「亮（LOW）」的時候燈是亮的，和 Uno 剛好相反。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'nm2', board: 'nodemcu', num: 2, title: '唯一的類比腳 A0', sub: '0–1023 · 3V3 供電 · D5 PWM', badge: 'nodemcu-adc',
    goal: 'NodeMCU 只有一支類比腳 A0，所以要好好珍惜。這關把旋鈕接在 3V3 和 GND 之間，用 A0 讀出 0–1023，再用 D5 的 PWM 調 LED 亮度。',
    program: P_NM_POT, lib: ['pot', 'led', 'resistor'],
    steps: [
      { text: '從元件庫加入「可變電阻」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'pot').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '可變電阻的兩端（1 和 2）分別接到 3V3 和 GND。', why: '接成 Vin 的話，旋鈕轉到底會送 5 V 進 A0。NodeMCU 插在麵包板上後，每支腳外側只剩一排孔能接線。', check: (c) => of(c, 'pot').some((p) => (conn(c, 'mcu:3V3', `${p.id}:1`) && toGnd(c, `${p.id}:2`)) || (conn(c, 'mcu:3V3', `${p.id}:2`) && toGnd(c, `${p.id}:1`))) },
      { text: '中間腳（W）接到 A0。', why: 'ESP8266 晶片自己只能量 0–1 V，NodeMCU 在 A0 前面加了分壓電阻，才能直接量 0–3.3 V。', check: (c) => of(c, 'pot').some((p) => conn(c, 'mcu:A0', `${p.id}:W`)) },
      { text: 'D5 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', why: 'ESP8266 每支腳建議只輸出 12 mA 以內；3.3 V 經過 220Ω 大約 6 mA，剛好安全。', check: (c) => ledOn(c, 'mcu:D5') },
      { text: '按「上傳並執行」，把旋鈕從一端轉到另一端，看序列埠的數字在 0–1023 之間跑。', why: 'val / 4 把 1024 格壓成 256 階，剛好對上 analogWrite() 預設的 0–255。', check: (c) => c.running && ok(c) && c.obs.potMax - c.obs.potMin > 0.6 && c.obs.ledMax - c.obs.ledMin > 0.5 },
    ],
  },
  {
    id: 'nm3', board: 'nodemcu', num: 3, title: 'Wi-Fi 網頁開關燈', sub: 'ESP8266WiFi · ESP8266WebServer · 手機遙控', badge: 'nodemcu-wifi',
    goal: 'NodeMCU 就是為了上網而生的。上一關的 LED 已經接在 D5，這關讓 NodeMCU 連上 Wi-Fi、開一個小網頁，再用「手機」開燈、關燈。',
    program: P_NM_WIFI, lib: ['led', 'resistor'], preset: LED_D5(),
    steps: [
      { text: '讀程式：函式庫是 ESP8266WiFi.h 和 ESP8266WebServer.h，名字和 ESP32 的不一樣；ssid、password 要換成你家的 2.4 GHz Wi-Fi。', why: 'ESP8266 的無線電只支援 2.4 GHz。同一份 ESP32 程式搬過來，通常只要換掉這兩個 #include 和伺服器的型別名稱。', ack: '我知道了', check: (c) => c.acks.includes('nm3-s0') },
      { text: '按「上傳並執行」，等序列埠印出 IP 位址。', why: '一連串的點代表還在連線。連不上時，先確認密碼、再確認不是 5 GHz 的網路。', check: (c) => c.running && !!useWeb.getState().ip },
      { text: '在工作台右上角的「手機」面板按「開燈」。', why: '手機送出 GET /on，NodeMCU 在 loop() 裡的 server.handleClient() 收到後，就執行 digitalWrite(LED, HIGH)。外接 LED 是一般接法，HIGH 就是亮。', check: (c) => c.running && ok(c) && useWeb.getState().on >= 1 && c.obs.extLedOn >= 1 },
      { text: '再按「關燈」。', check: (c) => c.running && useWeb.getState().on >= 1 && useWeb.getState().off >= 1 },
    ],
  },
  {
    id: 'nm4', board: 'nodemcu', num: 4, title: 'D2 不是 2：腳位編號陷阱', sub: 'D 編號 vs GPIO · INPUT_PULLUP · 開機綁腳', badge: 'nodemcu-dpin',
    goal: '板子上印的 D2 其實是 GPIO4，程式裡如果寫數字 2，動到的會是 D4（GPIO2）。這關用 D2 接按鈕、D6 接 LED，練習一律寫「D2、D6」這種名字，並避開開機綁腳。',
    program: P_NM_BUTTON, lib: ['button', 'led', 'resistor'],
    steps: [
      { text: '先記住對照：D1＝GPIO5、D2＝GPIO4、D4＝GPIO2、D5＝GPIO14、D6＝GPIO12、D8＝GPIO15。', why: 'ESP8266 Arduino 核心幫每個 D 編號定義了常數，寫 D2 編譯器會換成 4。寫錯成數字，程式照樣編譯得過，只是動到別支腳，最難除錯。', ack: '記住了', check: (c) => c.acks.includes('nm4-s0') },
      { text: '加入「按鈕」、「LED」和「電阻 220Ω」。', check: (c) => of(c, 'button').length > 0 && of(c, 'led').length > 0 && of(c, 'resistor').length > 0 },
      { text: '按鈕一腳接 D2，另一腳接 GND。', why: '不要選 D3、D4、D8：D3、D4 開機時被拉低、D8 開機時被拉高都會開不了機；D0 則沒有內建上拉電阻，INPUT_PULLUP 對它沒用。', check: (c) => of(c, 'button').some((b) => (conn(c, 'mcu:D2', `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, 'mcu:D2', `${b.id}:2`) && toGnd(c, `${b.id}:1`))) },
      { text: 'D6 → 電阻 → LED 長腳（＋），LED 短腳（−）接 GND。', check: (c) => ledOn(c, 'mcu:D6') },
      { text: '按「上傳並執行」，按住按鈕讓 LED 亮起來。', why: 'INPUT_PULLUP 讓 D2 平常是 HIGH，按下去接到 GND 變成 LOW，程式就點亮 D6。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
];
