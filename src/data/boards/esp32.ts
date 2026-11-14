import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * ESP32 DevKit V1（DOIT 30 腳版）。實體約 51.4 × 28.3 mm。
 * 長邊沿 x 軸：Micro-USB 在左端（-x），ESP-WROOM-32 模組的天線在右端（+x）。
 * 把板子轉成「USB 朝下」來看時，左排（EN…VIN）在這裡是遠側那排、右排（D23…3V3）是靠近觀看者那排。
 */
export const ESP_W = 5.14;
export const ESP_D = 2.83;
export const ESP_PCB_T = 0.16;
/** 排針塑膠座厚度與排針伸出長度（公分） */
export const ESP_SPACER = 0.25;
export const ESP_LEG = 0.6;

/** 板子圖面座標（mm，原點左下角＝USB 那端靠近觀看者的角）→ 3D 座標（cm，原點中心） */
export const ex = (mm: number) => mm / 10 - ESP_W / 2;
export const ez = (mm: number) => ESP_D / 2 - mm / 10;

const P = 2.54;
/** 兩排排針相距 1 英吋（25.4 mm）：插在麵包板上，每一側只剩一排孔可以接線 */
export const ESP_ROW_NEAR = ESP_D * 5 - 12.7;
export const ESP_ROW_FAR = ESP_D * 5 + 12.7;
export const ESP_PIN_X0 = 7.0;
export const ESP_MID_Y = ESP_D * 5;

function row(ids: [string, string, PinKind, string][], yMm: number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: ex(ESP_PIN_X0 + i * P), z: ez(yMm) }));
}

/**
 * 腳位 id 一律用「D + GPIO 編號」，和 Arduino 程式裡寫的數字一致（digitalWrite(2, …) 就是 D2）；
 * 板子上印成 VP、VN、RX0、TX0、RX2、TX2 的腳，label 照板子上的字。
 */
export const ESP_PINS: PinDef[] = [
  // 遠側那排（從 USB 端開始）：VIN、GND、D13 … VP、EN
  ...row(
    [
      ['VIN', 'VIN', 'power', '接 USB 時這裡會有約 5 V；也可以反過來從這裡餵 5 V 給整塊板子'],
      ['GND1', 'GND', 'gnd', '接地，和另一排的 GND 相通'],
      ['D13', 'D13', 'pwm', 'GPIO13：數位＋PWM；ADC2；觸控 T4'],
      ['D12', 'D12', 'pwm', 'GPIO12：開機綁腳！開機瞬間被拉高，flash 電壓會設錯而開不了機；ADC2；觸控 T5'],
      ['D14', 'D14', 'pwm', 'GPIO14：數位＋PWM；ADC2；觸控 T6；開機時會短暫輸出訊號'],
      ['D27', 'D27', 'pwm', 'GPIO27：數位＋PWM；ADC2；觸控 T7'],
      ['D26', 'D26', 'pwm', 'GPIO26：數位＋PWM；DAC2 真正的類比電壓輸出；ADC2'],
      ['D25', 'D25', 'pwm', 'GPIO25：數位＋PWM；DAC1 真正的類比電壓輸出；ADC2'],
      ['D33', 'D33', 'pwm', 'GPIO33：數位＋PWM；ADC1（開著 Wi-Fi 也能讀）；觸控 T8'],
      ['D32', 'D32', 'pwm', 'GPIO32：數位＋PWM；ADC1（開著 Wi-Fi 也能讀）；觸控 T9'],
      ['D35', 'D35', 'analog', 'GPIO35：只能當輸入！ADC1；沒有內建上拉／下拉電阻'],
      ['D34', 'D34', 'analog', 'GPIO34：只能當輸入！ADC1，讀旋鈕最適合；沒有內建上拉／下拉電阻'],
      ['D39', 'VN', 'analog', 'GPIO39（SENSOR_VN）：只能當輸入；ADC1'],
      ['D36', 'VP', 'analog', 'GPIO36（SENSOR_VP）：只能當輸入；ADC1'],
      ['EN', 'EN', 'control', '致能／重設腳：拉到 GND 就重新開機，和 EN 按鈕是同一條線'],
    ],
    ESP_ROW_FAR,
  ),
  // 靠近觀看者那排（從 USB 端開始）：3V3、GND、D15 … D23
  ...row(
    [
      ['3V3', '3V3', 'power', '3.3 V 輸出（板上穩壓器供應），也是整塊板子的邏輯電壓；給感測器用'],
      ['GND2', 'GND', 'gnd', '接地，和另一排的 GND 相通'],
      ['D15', 'D15', 'pwm', 'GPIO15：開機綁腳（開機時要維持高電位）；ADC2；觸控 T3'],
      ['D2', 'D2', 'pwm', 'GPIO2：板上的藍色 LED 接在這裡；開機綁腳；ADC2；觸控 T2'],
      ['D4', 'D4', 'pwm', 'GPIO4：數位＋PWM；ADC2；觸控 T0'],
      ['D16', 'RX2', 'bus', 'GPIO16：第二組序列埠 UART2 的接收腳，接 GPS、藍牙模組很方便'],
      ['D17', 'TX2', 'bus', 'GPIO17：UART2 的傳送腳'],
      ['D5', 'D5', 'pwm', 'GPIO5：數位＋PWM；VSPI 的 SS；開機綁腳'],
      ['D18', 'D18', 'pwm', 'GPIO18：數位＋PWM；VSPI 的 SCK'],
      ['D19', 'D19', 'pwm', 'GPIO19：數位＋PWM；VSPI 的 MISO'],
      ['D21', 'D21', 'bus', 'GPIO21：I²C 預設的 SDA'],
      ['D3', 'RX0', 'bus', 'GPIO3：UART0 接收腳，和 USB 共用，上傳程式要靠它，盡量別接東西'],
      ['D1', 'TX0', 'bus', 'GPIO1：UART0 傳送腳，和 USB 共用；開機時會吐出一串除錯訊息'],
      ['D22', 'D22', 'bus', 'GPIO22：I²C 預設的 SCL'],
      ['D23', 'D23', 'pwm', 'GPIO23：數位＋PWM；VSPI 的 MOSI'],
    ],
    ESP_ROW_NEAR,
  ),
];

export const ESP_PIN_MAP: Record<string, PinDef> = Object.fromEntries(ESP_PINS.map((p) => [p.id, p]));

export const ESP_INTERNAL_NETS: string[][] = [['GND1', 'GND2']];

/** 只能當輸入的腳：不能輸出，也沒有內建上拉電阻 */
export const ESP_INPUT_ONLY = ['D34', 'D35', 'D36', 'D39'];
/** ADC2 的腳：Wi-Fi 開著的時候 analogRead() 讀不到 */
export const ESP_ADC2 = ['D4', 'D2', 'D15', 'D13', 'D12', 'D14', 'D27', 'D25', 'D26'];
/** 開機綁腳（strapping pins）中有拉出來、容易出事的 */
export const ESP_STRAPPING = ['D12', 'D15', 'D2', 'D5'];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const ESP_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  mcu: [35.65, ESP_MID_Y, 19.5, 18],
  antenna: [48.4, ESP_MID_Y, 6, 18],
  usb: [2.7, ESP_MID_Y, 5.6, 7.8],
  uart: [13.0, 9.6, 5, 5],
  reg: [13.0, 19.4, 6.6, 7.0],
  boot: [4.4, 5.9, 5.2, 3.2],
  en: [4.4, 22.4, 5.2, 3.2],
  ledBlue: [19.4, 6.6, 1.6, 0.8],
  pwrLed: [19.4, 21.7, 1.6, 0.8],
  hdrF: [ESP_PIN_X0 + 7 * P, ESP_ROW_FAR, 38.6, 2.6],
  hdrN: [ESP_PIN_X0 + 7 * P, ESP_ROW_NEAR, 38.6, 2.6],
};

const fx = (id: string) => ex(ESP_FOOTPRINTS[id][0]);
const fz = (id: string) => ez(ESP_FOOTPRINTS[id][1]);

export const esp32Lesson: BoardLesson = {
  summary:
    'ESP32 DevKit V1 是一塊大約 5 公分長的小板子，正中央那片銀色金屬蓋底下藏著一顆雙核心、最快 240 MHz 的 ESP32 晶片，還內建 Wi-Fi 和藍牙。同樣的價錢，它的運算力是 Uno 的幾十倍，記憶體多了兩百多倍，所以做「會上網的機器人」幾乎都從它開始。要特別記住的是：它是 3.3 V 的晶片，腳位不能直接接 5 V。',
  stats: [
    { k: '時脈', v: '240 MHz' },
    { k: 'FLASH', v: '4 MB' },
    { k: 'RAM', v: '520 KB' },
    { k: 'GPIO', v: '25' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$5' },
  ],
  specs: [
    { k: '微控制器', v: 'ESP32-D0WD（Xtensa LX6 雙核心 32 位元），裝在 ESP-WROOM-32 模組裡' },
    { k: '時脈', v: '最高 240 MHz（可降到 80／160 MHz 省電）' },
    { k: 'Flash 程式記憶體', v: '4 MB（外接在模組裡的 SPI flash）' },
    { k: 'SRAM', v: '520 KB' },
    { k: '無線通訊', v: 'Wi-Fi 802.11 b/g/n（2.4 GHz）；藍牙 4.2（傳統藍牙＋BLE）' },
    { k: 'GPIO', v: '30 腳版拉出 25 支，其中 GPIO34–39 只能當輸入' },
    { k: '類比輸入', v: '15 支 12 位元 ADC（0–4095）；ADC2 的 9 支在 Wi-Fi 開著時不能用' },
    { k: '類比輸出', v: '2 支 8 位元 DAC（GPIO25、GPIO26）' },
    { k: '其他', v: 'PWM（LEDC，16 個通道，幾乎每支輸出腳都能用）、9 支電容觸控腳、霍爾感測器' },
    { k: '邏輯電壓', v: '3.3 V（腳位不能承受 5 V）' },
    { k: '供電', v: 'Micro-USB 5 V，或從 VIN 餵 5 V；板上穩壓器降成 3.3 V' },
    { k: '單腳電流', v: '建議 20 mA 以內（絕對上限 40 mA）' },
    { k: '通訊介面', v: '3 組 UART、2 組 I²C、4 組 SPI（2 組可自由使用）、I²S、CAN' },
    { k: '連接電腦', v: 'Micro-USB，經 CP2102 USB 轉序列晶片（部分相容板用 CH340）' },
    { k: '尺寸', v: '約 28 × 51 mm' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'ESP-WROOM-32 模組', quiz: '找出板子的大腦：裝著 ESP32 晶片的模組', desc: '那片銀色金屬蓋就是整塊板子的大腦。蓋子底下有 ESP32 雙核心晶片、4 MB 的 flash 記憶體、40 MHz 的石英振盪器和射頻電路。金屬蓋是電磁屏蔽，讓無線訊號不會干擾其他電路，也擋住外來的雜訊。', at: [fx('mcu'), 0.2, fz('mcu')], layer: 3 },
    { id: 'antenna', num: 2, name: 'PCB 天線', quiz: '找出負責 Wi-Fi 和藍牙收發訊號的天線', desc: '模組最末端那段彎來彎去的金色線條，就是直接畫在電路板上的天線，Wi-Fi 和藍牙都靠它。它底下故意不鋪銅、也不放零件；裝進機器人時別讓金屬外殼或電池蓋住它，訊號才不會變差。', at: [fx('antenna'), 0.1, fz('antenna')], layer: 3.6 },
    { id: 'usb', num: 3, name: 'Micro-USB 接頭', quiz: '找出接電腦的 USB 接頭', desc: '供電、上傳程式、序列埠通訊都走這個接頭。和 Nano 一樣要注意：只能充電的線沒有資料線，插上去電腦會完全認不到板子。', at: [fx('usb'), 0.15, fz('usb')], layer: 2 },
    { id: 'uart', num: 4, name: 'CP2102 USB 轉序列晶片', quiz: '找出把 USB 翻譯成序列埠的晶片', desc: '電腦講 USB，ESP32 聽的是序列埠，這顆小方晶片負責翻譯。它還會自動控制 EN 和 BOOT，讓電腦能把 ESP32 切進「下載模式」。電腦認不到板子時，先去 Silicon Labs 安裝 CP210x 驅動程式。', at: [fx('uart'), 0.05, fz('uart')], layer: 1.4 },
    { id: 'reg', num: 5, name: 'AMS1117 3.3 V 穩壓器', quiz: '找出把 5 V 降成 3.3 V 的穩壓器', desc: '把 USB 或 VIN 的 5 V 降成 ESP32 要的 3.3 V。Wi-Fi 傳送的瞬間電流會衝到數百 mA，供電不穩時 ESP32 會自己重新開機，序列埠會印出「Brownout detector was triggered」。', at: [fx('reg'), 0.1, fz('reg')], layer: 1.4 },
    { id: 'boot', num: 6, name: 'BOOT 按鈕（GPIO0）', quiz: '找出上傳卡住時要按住的 BOOT 按鈕', desc: '開機時如果 GPIO0 是低電位，ESP32 會進入「等待燒錄」模式。這顆按鈕就是把 GPIO0 接到 GND。上傳時一直停在「Connecting……」，就在那時按住 BOOT，看到開始寫入再放開。', at: [fx('boot'), 0.1, fz('boot')], layer: 2 },
    { id: 'en', num: 7, name: 'EN 按鈕（重設）', quiz: '找出讓 ESP32 重新開機的 EN 按鈕', desc: '按一下就重新開機，作用和 Arduino 的 RESET 一樣。上傳完程式沒有動靜時按一下，程式就會從頭跑。', at: [fx('en'), 0.1, fz('en')], layer: 2 },
    { id: 'ledBlue', num: 8, name: '藍色 LED（接 GPIO2）', quiz: '找出接在 GPIO2、Blink 會點亮的藍燈', desc: '接在 GPIO2 的板上 LED，ESP32 版 Blink 的主角。GPIO2 也是開機綁腳，所以拿它接外部電路時，不要讓它在開機時被拉高。', at: [fx('ledBlue'), 0.05, fz('ledBlue')], layer: 1 },
    { id: 'pwrLed', num: 9, name: '紅色電源燈', quiz: '找出通電就亮的紅色電源燈', desc: '3.3 V 有電就會亮。插上 USB 卻沒亮，先換一條線，再檢查 3V3 或 VIN 有沒有被短路到 GND。', at: [fx('pwrLed'), 0.05, fz('pwrLed')], layer: 1 },
    { id: 'hdrF', num: 10, name: '排針（VIN、D13…VP、EN）', quiz: '找出有 VIN 和 D34、D35 的那一排排針', desc: '從 USB 端開始是 VIN、GND，接著是 D13、D12、D14、D27、D26、D25、D33、D32，再來是只能輸入的 D35、D34、VN、VP，最後是 EN。類比輸入幾乎都集中在這一排。', at: [fx('hdrF'), -0.45, fz('hdrF')], layer: -1.3 },
    { id: 'hdrN', num: 11, name: '排針（3V3、D15…D23）', quiz: '找出有 3V3 和 I²C 腳（D21、D22）的那一排排針', desc: '從 USB 端開始是 3V3、GND、D15、D2、D4、RX2、TX2、D5、D18、D19、D21、RX0、TX0、D22、D23。3.3 V 電源、I²C 和 SPI 都在這一排。', at: [fx('hdrN'), -0.45, fz('hdrN')], layer: -1.3 },
  ],
  strengths: [
    '內建 Wi-Fi＋藍牙：手機遙控、網頁儀表板、把資料送上雲端，都不用另外買模組',
    '雙核心 240 MHz、520 KB RAM：一個核心處理無線網路，另一個核心專心控制馬達',
    '12 位元 ADC（0–4095）比 Uno 的 10 位元細 4 倍，還有 2 支 DAC 和 9 支觸控腳',
    '幾乎每支輸出腳都能 PWM，控制多顆馬達、LED 時很自由',
    '一塊大約 US$5，比 Uno 便宜，可以用 Arduino IDE、MicroPython 或 ESP-IDF 寫程式',
  ],
  pitfalls: [
    '腳位是 3.3 V，不能直接接 5 V 的訊號（例如 HC-SR04 的 ECHO），要先分壓或用電位轉換模組',
    'GPIO34–39（D34、D35、VP、VN）只能當輸入，而且沒有內建上拉電阻，INPUT_PULLUP 對它們沒用',
    '開了 Wi-Fi 之後，ADC2 的腳（D4、D2、D15、D13、D12、D14、D27、D25、D26）analogRead() 會失效，旋鈕請接 ADC1 的 D32–D39',
    'D12 是開機綁腳，開機時被拉高會開不了機；D0、D2、D5、D15 也都和開機模式有關',
    '上傳一直停在「Connecting……」：按住 BOOT 直到開始寫入，或換一條有資料線的 USB 線',
    '板子插上麵包板後每側只剩一排孔，常見做法是用兩塊麵包板並排',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '3V3 輸出 3.3 V，是感測器的標準電源；VIN 在接 USB 時約 5 V，也可以從這裡餵 5 V 進來。兩排各有一支 GND，彼此相通。' },
    { title: '數位腳與 PWM', kind: 'pwm', body: '程式裡的腳位編號就是 GPIO 編號：板子上印 D18，程式就寫 18。幾乎每支能輸出的腳都能用 analogWrite()（或 ledcWrite()）輸出 PWM。' },
    { title: '只能輸入的腳', kind: 'analog', body: 'D34、D35、VP（GPIO36）、VN（GPIO39）只能當輸入，也沒有內建上拉電阻。它們都屬於 ADC1，開著 Wi-Fi 也能讀，拿來接旋鈕和類比感測器剛剛好。' },
    { title: '通訊匯流排', kind: 'bus', body: 'UART0 在 TX0／RX0，和 USB 共用；UART2 在 TX2／RX2，可以自由使用。I²C 預設 D21（SDA）、D22（SCL）；SPI 預設 D18、D19、D23、D5。' },
    { title: '類比與觸控', kind: 'analog', body: 'analogRead() 回傳 0–4095，對應 0–3.3 V。D25、D26 是 DAC，可以輸出真正的類比電壓；有 T 編號的腳能用 touchRead() 感應手指。' },
    { title: '控制腳', kind: 'control', body: 'EN 拉到 GND 就重新開機。BOOT 按鈕接在 GPIO0（沒有拉出排針），開機時按住就會進入燒錄模式。' },
  ],
  code: {
    title: '第一支程式：掃描附近的 Wi-Fi',
    lang: 'ARDUINO C++',
    source: `// 上傳前：在「開發板管理員」安裝 esp32（Espressif Systems），
// 再選「開發板 → DOIT ESP32 DEVKIT V1」。
#include <WiFi.h>

const int LED = 2;                  // 板上藍燈接在 GPIO2

void setup() {
  Serial.begin(115200);             // ESP32 習慣用 115200
  pinMode(LED, OUTPUT);
  WiFi.mode(WIFI_STA);              // 當成一般裝置，不當基地台
}

void loop() {
  digitalWrite(LED, HIGH);          // 掃描時亮藍燈
  int n = WiFi.scanNetworks();
  digitalWrite(LED, LOW);
  Serial.printf("找到 %d 個 Wi-Fi：\\n", n);
  for (int i = 0; i < n; i++) {
    Serial.printf("  %-24s %4d dBm\\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
  }
  delay(5000);
}`,
  },
  projects: [
    '手機遙控車：ESP32 開一個網頁，手機連上去就能按方向鍵開車',
    '藍牙搖桿機械手臂：用 BLE 接收手機或遊戲手把的指令',
    'Wi-Fi 溫濕度站：每分鐘把感測值送上雲端，在手機上看即時圖表',
    'ESP32-CAM 巡邏機器人：同一家族的相機板，邊走邊把畫面串流到瀏覽器',
    '觸控開關桌燈：用觸控腳當按鈕，再用 PWM 調亮度',
  ],
  facts: [
    'ESP32 由上海的樂鑫科技（Espressif）在 2016 年推出，前一代 ESP8266 就是第 5 塊板子 NodeMCU 的主角。',
    'DevKit V1 這個名字來自深圳的 DOIT 公司做的開發板，後來被大量仿製，所以同樣叫「DevKit V1」的板子有 30 腳和 36 腳等不同版本。',
    'ESP32 的兩個核心叫 PRO_CPU 和 APP_CPU：Arduino 程式預設跑在核心 1，Wi-Fi 和藍牙的工作則交給核心 0。',
    '深度睡眠時晶片本身只耗約 10 µA，用電池也能撐好幾個月；但開發板上的穩壓器和電源燈會吃掉更多電。',
  ],
  quiz: [
    { part: 'mcu', prompt: '找出板子的大腦：裝著 ESP32 晶片的模組', hint: '板子右半邊那片銀色的金屬蓋。', explain: 'ESP-WROOM-32 模組裡有雙核心晶片、4 MB flash 和射頻電路。' },
    { part: 'antenna', prompt: 'Wi-Fi 和藍牙的訊號從哪裡收發？', hint: '模組最右端、金屬蓋外面那段彎彎曲曲的金色線條。', explain: 'PCB 天線直接畫在模組的電路板上，周圍不要放金屬。' },
    { part: 'usb', prompt: '要把程式從電腦送進 ESP32，線要插在哪裡？', hint: '板子最左端、扁扁的銀色小接頭。', explain: 'Micro-USB 同時負責供電、上傳程式與序列埠通訊。' },
    { part: 'boot', prompt: '上傳一直卡在「Connecting……」，要按住哪一顆按鈕？', hint: 'USB 接頭旁邊有兩顆小按鈕，靠近 3V3 那一側的是它。', explain: 'BOOT 把 GPIO0 拉到 GND，讓 ESP32 開機時進入燒錄模式。' },
    { part: 'en', prompt: '想讓 ESP32 重新開機、程式從頭跑，要按哪裡？', hint: 'USB 旁邊、靠近 VIN 那一側的按鈕。', explain: 'EN 就是 ESP32 的重設鍵。' },
    { part: 'reg', prompt: '把 USB 的 5 V 降成 3.3 V 的零件在哪裡？', hint: 'USB 右邊、有一片大散熱焊片的黑色元件。', explain: 'AMS1117-3.3 供應整塊板子的 3.3 V。' },
    { part: 'uart', prompt: '負責把 USB 翻譯成序列埠的晶片在哪裡？', hint: 'USB 右邊、靠近觀看者那側的小方形晶片。', explain: 'CP2102 讓電腦能和 ESP32 溝通，還會自動切換燒錄模式。' },
    { part: 'ledBlue', prompt: '不接任何線就能被 Blink 點亮的燈在哪裡？', hint: '它接在 GPIO2，在 CP2102 旁邊。', explain: 'ESP32 DevKit V1 的板上 LED 接在 GPIO2，不是 Arduino 習慣的 13。' },
    { part: 'hdrF', prompt: '旋鈕要接只能輸入的 D34，該找哪一排排針？', hint: '離你比較遠、以 VIN 開頭的那一排。', explain: 'D34、D35、VP、VN 都在這一排，而且都屬於開 Wi-Fi 也能用的 ADC1。' },
    { part: 'hdrN', prompt: 'OLED 螢幕的 SDA、SCL 要接 D21、D22，該找哪一排？', hint: '靠近你這一側、以 3V3 開頭的那一排。', explain: 'I²C 預設的 D21、D22 和 3V3 電源在同一排。' },
    { part: 'pwrLed', prompt: '一插上 USB 就會亮的電源燈在哪裡？', hint: '穩壓器旁邊、靠遠側的那顆小燈。', explain: '紅色電源燈亮，代表 3.3 V 已經有電。' },
  ],
};

/** ESP32 在工作台上插在麵包板中間：PCB 頂面距台面 = 麵包板 0.85 + 塑膠座 0.25 + PCB 0.16 */
export const ESP_BENCH_LIFT = 1.26;
/** 排針在麵包板 b／i 列，接線插在外側唯一剩下的 a／j 列（同一直排電氣相通） */
export const ESP_BB_OFFSET = 0.254;
/** 讓麵包板的孔對齊排針：排針中心相對板子中心的 x 位移 */
export const ESP_BB_SHIFT = ex(ESP_PIN_X0 + 7 * P);

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

export const esp32Data: BoardData = {
  id: 'esp32',
  short: 'ESP32',
  summary: BOARDS.find((b) => b.id === 'esp32')!,
  lesson: esp32Lesson,
  w: ESP_W,
  d: ESP_D,
  pins: ESP_PINS,
  internalNets: ESP_INTERNAL_NETS,
  // ESP32 沒有 5 V 的邏輯電源腳：3V3 走「3.3 V」那條路，VIN 走「VIN」那條路
  supply: [],
  gnd: ['GND1', 'GND2'],
  analogOnly: [],
  logicV: 3.3,
  ledPin: 'D2',
  inputOnly: ESP_INPUT_ONLY,
  strapLow: ['D12'],
  serialPins: ['D1', 'D3'],
  header: '排針',
  footprints: ESP_FOOTPRINTS,
  mx: ex,
  mz: ez,
  tray: {
    mcu: [5.3, -0.55, -0.98],
    antenna: [5.3, 1.45, -0.98],
    hdrF: [5.3, -2.55, 0],
    hdrN: [5.3, 2.95, 0],
    ...smallTray(['usb', 'uart', 'reg', 'boot', 'en', 'ledBlue', 'pwrLed'], 7.6, -1.3, 1.15, 1.05, 2, -0.98),
  },
  stage: {
    floorY: -1.03,
    pinY: 0.06,
    explodeLift: 1.2,
    views: {
      iso: [4.2, 6.0, 7.0, 0, -0.2, 0.1],
      top: [0, 10.5, 0.01, 0, 0, 0],
      bottom: [0, -10, 0.5, 0, 0, 0],
      front: [0, 1.8, 9.4, 0, -0.2, 0],
    },
    asmCam: [3.0, 14.5, 5.6, 3.0, -0.6, 0.2],
  },
  bench: {
    pos: [-4.0, 0, -0.6],
    half: [3.45, 1.95],
    lift: ESP_BENCH_LIFT,
    pin: (p) => [p.x, 0.87, p.z + Math.sign(p.z) * ESP_BB_OFFSET],
  },
};
