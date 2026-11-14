import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * NodeMCU DevKit 1.0（Amica 版，ESP-12E 模組）。實體約 49 × 26 mm，兩排排針相距 0.9 英吋。
 * 長邊沿 x 軸：Micro-USB 在左端（-x），ESP-12E 模組的天線在右端（+x）。
 * 把板子轉成「USB 朝下」來看時，左排（A0…Vin）在這裡是遠側那排、右排（D0…3V3）是靠近觀看者那排。
 */
export const NM_W = 4.9;
export const NM_D = 2.6;
export const NM_PCB_T = 0.16;
/** 排針塑膠座厚度與排針伸出長度（公分） */
export const NM_SPACER = 0.25;
export const NM_LEG = 0.6;

/** 板子圖面座標（mm，原點左下角＝USB 那端靠近觀看者的角）→ 3D 座標（cm，原點中心） */
export const qx = (mm: number) => mm / 10 - NM_W / 2;
export const qz = (mm: number) => NM_D / 2 - mm / 10;

const P = 2.54;
/** 兩排排針相距 0.9 英吋（22.86 mm）：插上麵包板後，每一側剛好剩一排孔可以接線 */
export const NM_MID_Y = NM_D * 5;
export const NM_ROW_NEAR = NM_MID_Y - 11.43;
export const NM_ROW_FAR = NM_MID_Y + 11.43;
export const NM_PIN_X0 = NM_W * 5 - 7 * P;

function row(ids: [string, string, PinKind, string][], yMm: number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: qx(NM_PIN_X0 + i * P), z: qz(yMm) }));
}

/**
 * 腳位 id 用板子上印的 D 編號（D0–D8），和 Arduino 程式裡的常數 D0–D8 一致；
 * 注意 D 編號不等於 GPIO 編號：D4 是 GPIO2，程式寫 digitalWrite(4, …) 動到的其實是 D2。
 * RX、TX 在 ESP8266 Arduino 核心裡的常數是 D9、D10，所以 id 用 D9、D10，label 照板子上的字。
 */
export const NM_PINS: PinDef[] = [
  // 遠側那排（從 USB 端開始）：VIN、GND、RST、EN、3V3、GND、CLK … RSV、A0
  ...row(
    [
      ['VIN', 'Vin', 'power', '接 USB 時這裡約有 5 V（經過一顆保護二極體）；也可以從這裡餵 5 V 給整塊板子'],
      ['GND1', 'GND', 'gnd', '接地，和其他三支 GND 相通'],
      ['RST', 'RST', 'control', '重設腳：拉到 GND 就重新開機；做深度睡眠時要把 D0 接到這裡，計時器才叫得醒它'],
      ['EN', 'EN', 'control', '晶片致能腳，板上已經拉高；拉到 GND 晶片就停止運作'],
      ['3V3C', '3V3', 'power', '3.3 V 輸出，和另外兩支 3V3 相通'],
      ['GND4', 'GND', 'gnd', '接地，和其他三支 GND 相通'],
      ['CLK', 'CLK', 'nc', 'GPIO6：接到模組裡的 flash 記憶體（時脈線），一接東西程式就會當掉，別用'],
      ['SD0', 'SD0', 'nc', 'GPIO7：flash 的資料線，別用'],
      ['CMD', 'CMD', 'nc', 'GPIO11：flash 的指令線，別用'],
      ['SD1', 'SD1', 'nc', 'GPIO8：flash 的資料線，別用'],
      ['SD2', 'SD2', 'nc', 'GPIO9：flash 的資料線，別用'],
      ['SD3', 'SD3', 'nc', 'GPIO10：flash 的資料線；只有在特殊的 DIO 模式下才能勉強當 GPIO，初學先別碰'],
      ['RSV2', 'RSV', 'nc', '保留腳，沒有接任何東西'],
      ['RSV1', 'RSV', 'nc', '保留腳，沒有接任何東西'],
      ['A0', 'A0', 'analog', '唯一的類比輸入（ADC0）：analogRead() 回傳 0–1023；板上有分壓電阻，可以直接量 0–3.3 V'],
    ],
    NM_ROW_FAR,
  ),
  // 靠近觀看者那排（從 USB 端開始）：3V3、GND、TX、RX、D8 … D0
  ...row(
    [
      ['3V3', '3V3', 'power', '3.3 V 輸出（板上穩壓器供應），也是整塊板子的邏輯電壓；給感測器用'],
      ['GND2', 'GND', 'gnd', '接地，和其他三支 GND 相通'],
      ['D10', 'TX', 'bus', 'GPIO1：序列埠的傳送腳，和 USB 共用；開機時會吐出一串亂碼般的除錯訊息'],
      ['D9', 'RX', 'bus', 'GPIO3：序列埠的接收腳，和 USB 共用，上傳程式要靠它，盡量別接東西'],
      ['D8', 'D8', 'pwm', 'GPIO15：開機綁腳！板上有下拉電阻，開機時必須是低電位，被拉高就開不了機；SPI 的 CS'],
      ['D7', 'D7', 'pwm', 'GPIO13：數位＋PWM；SPI 的 MOSI'],
      ['D6', 'D6', 'pwm', 'GPIO12：數位＋PWM；SPI 的 MISO'],
      ['D5', 'D5', 'pwm', 'GPIO14：數位＋PWM；SPI 的 SCK。這塊板子上最「乾淨」的腳之一，接 LED 最放心'],
      ['GND3', 'GND', 'gnd', '接地，和其他三支 GND 相通'],
      ['3V3B', '3V3', 'power', '3.3 V 輸出，和另外兩支 3V3 相通'],
      ['D4', 'D4', 'pwm', 'GPIO2：模組上的藍色 LED 接在這裡（低電位亮）；開機綁腳，開機時要維持高電位'],
      ['D3', 'D3', 'pwm', 'GPIO0：FLASH 按鈕接在這裡；開機綁腳，開機時被拉低就會進入燒錄模式'],
      ['D2', 'D2', 'bus', 'GPIO4：數位＋PWM；I²C 預設的 SDA。沒有開機限制，接按鈕最安全'],
      ['D1', 'D1', 'bus', 'GPIO5：數位＋PWM；I²C 預設的 SCL。沒有開機限制'],
      ['D0', 'D0', 'digital', 'GPIO16：只能數位輸入輸出，不能 PWM、沒有內建上拉電阻；深度睡眠喚醒要把它接到 RST'],
    ],
    NM_ROW_NEAR,
  ),
];

export const NM_PIN_MAP: Record<string, PinDef> = Object.fromEntries(NM_PINS.map((p) => [p.id, p]));

export const NM_INTERNAL_NETS: string[][] = [
  ['GND1', 'GND2', 'GND3', 'GND4'],
  ['3V3', '3V3B', '3V3C'],
];

/** 開機時必須是低電位的腳（GPIO15） */
export const NM_STRAP_LOW = ['D8'];
/** 可以輸出、但沒有內建上拉電阻的腳（GPIO16） */
export const NM_NO_PULLUP = ['D0'];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const NM_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  mcu: [32.6, NM_MID_Y, 15.2, 16],
  antenna: [44.9, NM_MID_Y, 8.4, 16],
  usb: [2.7, NM_MID_Y, 5.6, 7.8],
  uart: [12.4, 8.2, 5, 5],
  reg: [12.4, 18.0, 6.6, 7.0],
  rst: [4.6, 20.6, 4.2, 3.2],
  flash: [4.6, 5.4, 4.2, 3.2],
  ledMod: [42.0, NM_MID_Y + 6.2, 1.6, 0.8],
  ledD0: [19.6, 7.2, 1.6, 0.8],
  hdrF: [NM_PIN_X0 + 7 * P, NM_ROW_FAR, 38.6, 2.6],
  hdrN: [NM_PIN_X0 + 7 * P, NM_ROW_NEAR, 38.6, 2.6],
};

const fx = (id: string) => qx(NM_FOOTPRINTS[id][0]);
const fz = (id: string) => qz(NM_FOOTPRINTS[id][1]);

export const nodemcuLesson: BoardLesson = {
  summary:
    'NodeMCU 是一塊不到 5 公分長的小板子，主角是右邊那顆銀色的 ESP-12E 模組，裡面裝著 ESP8266 晶片。它在 2014 年前後掀起一波「人人都能讓東西上網」的熱潮：一塊大約 US$3，就有 80 MHz 的 32 位元處理器和 Wi-Fi。它比 ESP32 簡單很多，只有一支類比腳、沒有藍牙，但做「會上網的小感測器」綽綽有餘。和 ESP32 一樣，它是 3.3 V 晶片，腳位不能直接接 5 V。',
  stats: [
    { k: '時脈', v: '80 MHz' },
    { k: 'FLASH', v: '4 MB' },
    { k: 'RAM', v: '≈ 80 KB' },
    { k: 'GPIO', v: '11' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$3' },
  ],
  specs: [
    { k: '微控制器', v: 'ESP8266EX（Tensilica L106 單核心 32 位元），裝在 ESP-12E 模組裡' },
    { k: '時脈', v: '80 MHz（可以超頻到 160 MHz）' },
    { k: 'Flash 程式記憶體', v: '4 MB（外接在模組裡的 SPI flash）' },
    { k: 'SRAM', v: '約 80 KB 給使用者程式（另有一部分給 Wi-Fi 使用）' },
    { k: '無線通訊', v: 'Wi-Fi 802.11 b/g/n（2.4 GHz）；沒有藍牙' },
    { k: 'GPIO', v: 'D0–D8 加上 RX、TX 共 11 支；SD0–SD3、CMD、CLK 接著 flash，不能用' },
    { k: '類比輸入', v: '只有 A0 一支，10 位元（0–1023）；板上分壓讓它可以量 0–3.3 V' },
    { k: 'PWM', v: 'D1–D8 都可以用 analogWrite()（軟體產生，預設 1 kHz、0–255）；D0 不行' },
    { k: '邏輯電壓', v: '3.3 V（腳位不能承受 5 V）' },
    { k: '供電', v: 'Micro-USB 5 V，或從 Vin 餵 5 V；板上 AMS1117 降成 3.3 V' },
    { k: '單腳電流', v: '建議 12 mA 以內，比 Arduino 小很多' },
    { k: '通訊介面', v: '1 組完整 UART（另有一組只能傳送的 UART1 在 D4）、軟體 I²C、SPI' },
    { k: '連接電腦', v: 'Micro-USB，Amica 版用 CP2102，常見的 LoLin 版用 CH340' },
    { k: '尺寸', v: '約 26 × 49 mm（Amica 版）' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'ESP-12E 模組', quiz: '找出板子的大腦：裝著 ESP8266 晶片的模組', desc: '那片銀色金屬蓋底下有 ESP8266 晶片、4 MB flash 和 26 MHz 的石英振盪器。這顆模組本身就能單獨使用，NodeMCU 只是幫它加上 USB、穩壓器和排針，讓它能插在麵包板上。', at: [fx('mcu'), 0.2, fz('mcu')], layer: 3 },
    { id: 'antenna', num: 2, name: 'PCB 天線', quiz: '找出負責 Wi-Fi 收發訊號的天線', desc: '模組末端那段之字形的金色走線就是 Wi-Fi 天線。ESP8266 只有 Wi-Fi、沒有藍牙，所以只要這一段天線。裝進機器人時別用金屬蓋住它。', at: [fx('antenna'), 0.1, fz('antenna')], layer: 3.6 },
    { id: 'usb', num: 3, name: 'Micro-USB 接頭', quiz: '找出接電腦的 USB 接頭', desc: '供電、上傳程式、序列埠通訊都走這個接頭。電腦完全沒反應時，先懷疑手上那條是不是只能充電的線。', at: [fx('usb'), 0.15, fz('usb')], layer: 2 },
    { id: 'uart', num: 4, name: 'CP2102 USB 轉序列晶片', quiz: '找出把 USB 翻譯成序列埠的晶片', desc: '把電腦的 USB 翻譯成 ESP8266 聽得懂的序列埠，還會自動控制 RST 和 FLASH，讓上傳時不必手按按鈕。市面上另一種常見的 LoLin 版改用 CH340，驅動程式不同。', at: [fx('uart'), 0.05, fz('uart')], layer: 1.4 },
    { id: 'reg', num: 5, name: 'AMS1117 3.3 V 穩壓器', quiz: '找出把 5 V 降成 3.3 V 的穩壓器', desc: '把 USB 或 Vin 的 5 V 降成 3.3 V。Wi-Fi 傳送時電流會瞬間衝到 300 mA 左右，供電太弱的話板子會一直重新開機，序列埠只看到一堆亂碼。', at: [fx('reg'), 0.1, fz('reg')], layer: 1.4 },
    { id: 'rst', num: 6, name: 'RST 按鈕（重設）', quiz: '找出讓 NodeMCU 重新開機的 RST 按鈕', desc: '按一下就重新開機，程式從 setup() 重新跑。上傳完沒有動靜，或想再看一次開機訊息時按它。', at: [fx('rst'), 0.1, fz('rst')], layer: 2 },
    { id: 'flash', num: 7, name: 'FLASH 按鈕（GPIO0）', quiz: '找出接在 GPIO0、上傳失敗時要按住的 FLASH 按鈕', desc: '把 GPIO0（D3）接到 GND。開機時 GPIO0 是低電位，ESP8266 就會進入「等待燒錄」模式。自動切換失靈、上傳一直失敗時，按住 FLASH 再按一下 RST 就能手動進入燒錄模式。程式跑起來後，它也可以當成一顆普通按鈕讀取。', at: [fx('flash'), 0.1, fz('flash')], layer: 2 },
    { id: 'ledMod', num: 8, name: '模組上的藍色 LED（GPIO2）', quiz: '找出 Blink 會點亮、接在 D4 的藍色 LED', desc: '焊在 ESP-12E 模組上的小藍燈，接在 GPIO2（板子上印 D4），就是程式裡的 LED_BUILTIN。它接成「低電位才亮」：digitalWrite(LED_BUILTIN, LOW) 反而是開燈，第一次用的人幾乎都會被嚇到。', at: [fx('ledMod'), 0.15, fz('ledMod')], layer: 4 },
    { id: 'ledD0', num: 9, name: '板上的第二顆 LED（GPIO16）', quiz: '找出 USB 旁邊、接在 D0 的第二顆 LED', desc: 'Amica 版在 USB 旁邊多放了一顆 LED，接在 GPIO16（D0），一樣是低電位亮，程式裡叫 LED_BUILTIN_AUX。這塊板子沒有電源燈，所以插上 USB 時看到的閃光其實是開機訊息經過的痕跡。', at: [fx('ledD0'), 0.05, fz('ledD0')], layer: 1 },
    { id: 'hdrF', num: 10, name: '排針（Vin、RST…A0）', quiz: '找出有 A0 和 Vin 的那一排排針', desc: '從 USB 端開始是 Vin、GND、RST、EN、3V3、GND，接著 CLK、SD0、CMD、SD1、SD2、SD3 這六支都接著 flash，最後是兩支保留腳和唯一的類比腳 A0。這一排真正能拿來接感測器的，幾乎只有 A0 和電源。', at: [fx('hdrF'), -0.45, fz('hdrF')], layer: -1.3 },
    { id: 'hdrN', num: 11, name: '排針（3V3、TX…D0）', quiz: '找出有 D0–D8 數位腳的那一排排針', desc: '從 USB 端開始是 3V3、GND、TX、RX、D8、D7、D6、D5、GND、3V3、D4、D3、D2、D1、D0。所有能用的數位腳都在這一排，I²C 預設的 D1、D2 也在這裡。', at: [fx('hdrN'), -0.45, fz('hdrN')], layer: -1.3 },
  ],
  strengths: [
    '一塊大約 US$3 就有 Wi-Fi，是讓感測器上網最便宜的方法之一',
    '80 MHz 的 32 位元處理器、4 MB flash，比 Uno 快很多、能放的程式大很多',
    '可以用 Arduino IDE、MicroPython 寫程式，網路上的範例和函式庫非常多',
    'Amica 版的排針相距 0.9 英吋，插在一般麵包板上兩側都還留一排孔可以接線',
    '深度睡眠只耗約 20 µA，做電池供電的溫濕度站很合適',
  ],
  pitfalls: [
    '腳位是 3.3 V，不能直接接 5 V 的訊號，每支腳的電流也只建議 12 mA 以內',
    '板子上印的 D 編號不是 GPIO 編號：D4 是 GPIO2、D2 是 GPIO4。程式裡寫 D4 最保險，直接寫數字 4 會動到 D2',
    '模組上的 LED 是低電位亮：digitalWrite(LED_BUILTIN, LOW) 是開燈、HIGH 是關燈',
    '只有 A0 一支類比腳，要讀兩個以上的類比感測器就得外加 ADC 模組（例如 ADS1115）',
    'D3、D4 開機時要是高電位，D8 開機時要是低電位；接錯東西會讓板子開不了機',
    'D0 不能 PWM、沒有內建上拉電阻；SD0–SD3、CMD、CLK 接著 flash，千萬別接東西',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '三支 3V3 都輸出 3.3 V，給感測器用；Vin 在接 USB 時約 5 V，也可以從這裡餵 5 V 進來。四支 GND 彼此相通。' },
    { title: '數位腳與 PWM', kind: 'pwm', body: 'D1–D8 都能數位輸入輸出，也都能 analogWrite()。程式裡請寫板子上的名字（D5），因為 D5 其實是 GPIO14，直接寫 5 會動到 D1。' },
    { title: '唯一的類比腳', kind: 'analog', body: 'A0 是唯一的類比輸入，analogRead() 回傳 0–1023。ESP8266 晶片本身只能量 0–1 V，NodeMCU 在 A0 前面加了分壓電阻，所以可以直接量 0–3.3 V。' },
    { title: '通訊匯流排', kind: 'bus', body: 'TX／RX 和 USB 共用。I²C 預設 D2（SDA）、D1（SCL）；SPI 用 D5（SCK）、D6（MISO）、D7（MOSI）、D8（CS）。' },
    { title: '控制腳', kind: 'control', body: 'RST 拉到 GND 就重新開機；EN 是晶片致能。深度睡眠時把 D0 接到 RST，時間到 D0 送出一個低電位脈衝把晶片叫醒。' },
    { title: '不能用的腳', kind: 'nc', body: 'CLK、SD0、CMD、SD1、SD2、SD3 接著模組裡的 flash 記憶體，程式就存在那裡；接了東西會讓程式直接當掉。RSV 是保留腳，什麼都沒接。' },
  ],
  code: {
    title: '第一支程式：連上 Wi-Fi，用藍燈報平安',
    lang: 'ARDUINO C++',
    source: `// 上傳前：在「開發板管理員」安裝 esp8266（ESP8266 Community），
// 再選「開發板 → NodeMCU 1.0 (ESP-12E Module)」。
#include <ESP8266WiFi.h>

const char* ssid = "你家的Wi-Fi";      // 只支援 2.4 GHz
const char* password = "密碼";

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);       // 模組上的藍燈，接在 D4（GPIO2）
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));  // 連線中：藍燈閃
    delay(250);
  }
  digitalWrite(LED_BUILTIN, LOW);     // 低電位＝亮：連上了就恆亮
  Serial.print("連上了！IP：");
  Serial.println(WiFi.localIP());
}

void loop() {
  Serial.printf("訊號強度 %d dBm\\n", WiFi.RSSI());
  delay(3000);
}`,
  },
  projects: [
    'Wi-Fi 溫濕度站：每 10 分鐘醒來量一次、上傳雲端，再進入深度睡眠省電',
    '手機遙控小燈或繼電器：NodeMCU 開一個網頁，手機按鈕就能開關',
    '機器人的「上網背包」：讓 Uno 透過序列埠請 NodeMCU 幫忙收發網路訊息',
    '植物澆水提醒：A0 讀土壤濕度，太乾就傳通知到手機',
    'Wi-Fi 遙控車：搭配 L298N 或 L9110 馬達驅動板，用手機網頁開車',
  ],
  facts: [
    'ESP8266 是樂鑫科技在 2014 年推出的晶片，原本只是賣給廠商的「Wi-Fi 轉序列埠」模組，後來大家發現可以直接在它上面寫程式，才紅了起來。',
    '「NodeMCU」原本是一套用 Lua 語言寫程式的開源韌體，開發板才是後來為了這套韌體設計的；現在大多數人反而用 Arduino 或 MicroPython 寫它。',
    '同樣叫 NodeMCU 的板子有好幾種：Amica（窄版，排針相距 0.9 英吋）、LoLin V3（寬版，在麵包板上兩側都沒有孔可以接線），還有更早的 DevKit 0.9。',
    'ESP8266 晶片內部的 ADC 只能量 0–1 V，NodeMCU 在 A0 前面用 220 kΩ 和 100 kΩ 做了分壓，才讓它能量 0–3.3 V。',
  ],
  quiz: [
    { part: 'mcu', prompt: '找出板子的大腦：裝著 ESP8266 晶片的模組', hint: '右半邊那片銀色的金屬蓋。', explain: 'ESP-12E 模組裡有 ESP8266 晶片、4 MB flash 和石英振盪器。' },
    { part: 'antenna', prompt: 'Wi-Fi 訊號從哪裡收發？', hint: '模組最右端、金屬蓋外面那段之字形的金色走線。', explain: 'PCB 天線直接畫在模組的電路板上，ESP8266 只有 Wi-Fi，沒有藍牙。' },
    { part: 'usb', prompt: '要把程式從電腦送進 NodeMCU，線要插在哪裡？', hint: '板子最左端、扁扁的銀色小接頭。', explain: 'Micro-USB 同時負責供電、上傳程式與序列埠通訊。' },
    { part: 'flash', prompt: '自動燒錄失靈時，要按住哪一顆按鈕再按 RST？', hint: 'USB 旁邊兩顆按鈕中，靠近 D 腳那一側的是它。', explain: 'FLASH 按鈕把 GPIO0 拉到 GND，讓 ESP8266 開機時進入燒錄模式。' },
    { part: 'rst', prompt: '想讓 NodeMCU 重新開機，要按哪一顆？', hint: 'USB 旁邊、靠近 Vin 那一側的按鈕。', explain: 'RST 就是 NodeMCU 的重設鍵。' },
    { part: 'reg', prompt: '把 USB 的 5 V 降成 3.3 V 的零件在哪裡？', hint: 'USB 右邊、有一片大散熱焊片的黑色元件。', explain: 'AMS1117-3.3 供應整塊板子的 3.3 V。' },
    { part: 'uart', prompt: '負責把 USB 翻譯成序列埠的晶片在哪裡？', hint: 'USB 右邊、靠近數位腳那側的小方形晶片。', explain: 'Amica 版用 CP2102，LoLin 版則用 CH340。' },
    { part: 'ledMod', prompt: 'Blink 程式的 LED_BUILTIN 點亮的是哪一顆燈？', hint: '它不在主板上，而是焊在銀色模組上。', explain: 'ESP-12E 模組上的藍燈接在 GPIO2（D4），而且是低電位亮。' },
    { part: 'ledD0', prompt: '接在 D0（GPIO16）的第二顆 LED 在哪裡？', hint: 'CP2102 旁邊的小燈。', explain: 'Amica 版多了一顆接在 GPIO16 的 LED，程式裡叫 LED_BUILTIN_AUX。' },
    { part: 'hdrF', prompt: '旋鈕要接 A0，該找哪一排排針？', hint: '離你比較遠、以 Vin 開頭的那一排。', explain: '唯一的類比腳 A0 在這一排最末端，旁邊是不能用的 flash 腳。' },
    { part: 'hdrN', prompt: 'OLED 的 SDA、SCL 要接 D2、D1，該找哪一排？', hint: '靠近你這一側、以 3V3 開頭的那一排。', explain: 'D0–D8 所有數位腳都在這一排。' },
  ],
};

/** NodeMCU 插在麵包板中間：PCB 頂面距台面 = 麵包板 0.85 + 塑膠座 0.25 + PCB 0.16 */
export const NM_BENCH_LIFT = 1.26;
/** 排針在麵包板 b／i 列附近，接線插在最外側的 a／j 列（同一直排電氣相通） */
export const NM_BB_OFFSET = 0.381;
/** 讓麵包板的孔對齊排針：排針中心相對板子中心的 x 位移 */
export const NM_BB_SHIFT = qx(NM_PIN_X0 + 7 * P);

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

export const nodemcuData: BoardData = {
  id: 'nodemcu',
  short: 'NodeMCU',
  summary: BOARDS.find((b) => b.id === 'nodemcu')!,
  lesson: nodemcuLesson,
  w: NM_W,
  d: NM_D,
  pins: NM_PINS,
  internalNets: NM_INTERNAL_NETS,
  // 3.3 V 板子沒有 5 V 的邏輯電源腳：3V3 走「3.3 V」那條路，VIN 走「VIN」那條路
  supply: [],
  gnd: ['GND1', 'GND2', 'GND3', 'GND4'],
  analogOnly: ['A0'],
  logicV: 3.3,
  ledPin: 'D4',
  ledActiveLow: true,
  inputOnly: [],
  noPullup: NM_NO_PULLUP,
  strapLow: NM_STRAP_LOW,
  serialPins: ['D10', 'D9'],
  header: '排針',
  footprints: NM_FOOTPRINTS,
  mx: qx,
  mz: qz,
  tray: {
    mcu: [5.0, -0.5, -0.98],
    antenna: [5.0, 1.4, -0.98],
    hdrF: [5.0, -2.45, 0],
    hdrN: [5.0, 2.85, 0],
    ...smallTray(['usb', 'uart', 'reg', 'rst', 'flash', 'ledMod', 'ledD0'], 6.9, -1.3, 1.05, 1.05, 2, -0.98),
  },
  stage: {
    floorY: -1.03,
    pinY: 0.06,
    explodeLift: 1.2,
    views: {
      iso: [4.0, 5.8, 6.8, 0, -0.2, 0.1],
      top: [0, 10.0, 0.01, 0, 0, 0],
      bottom: [0, -9.6, 0.5, 0, 0, 0],
      front: [0, 1.8, 9.0, 0, -0.2, 0],
    },
    asmCam: [3.0, 15.5, 5.0, 3.0, -0.6, -0.3],
  },
  bench: {
    pos: [-4.0, 0, -0.6],
    half: [3.3, 1.95],
    lift: NM_BENCH_LIFT,
    pin: (p) => [p.x, 0.87, p.z + Math.sign(p.z) * NM_BB_OFFSET],
  },
};
