import type { BoardLesson, PinDef, PinKind } from '../types';

/** Nano 實體尺寸（公分）：長邊沿 x 軸，USB 在左端 */
export const NANO_W = 4.32;
export const NANO_D = 1.8;
export const NANO_PCB_T = 0.16;
/** 排針塑膠座厚度與排針伸出長度（公分） */
export const NANO_SPACER = 0.25;
export const NANO_LEG = 0.6;

/** 板子圖面座標（mm，原點左下角＝USB 那端靠近觀看者的角）→ 3D 座標（cm，原點中心） */
export const nx = (mm: number) => mm / 10 - NANO_W / 2;
export const nz = (mm: number) => NANO_D / 2 - mm / 10;

const P = 2.54;
/** 兩排排針相距 0.6 英吋，跨在麵包板中間 */
export const NANO_ROW_NEAR = 9 - 7.62;
export const NANO_ROW_FAR = 9 + 7.62;
export const NANO_PIN_X0 = 3.82;

function row(ids: [string, string, PinKind, string][], yMm: number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: nx(NANO_PIN_X0 + i * P), z: nz(yMm) }));
}

export const NANO_PINS: PinDef[] = [
  // 遠端那排（從 USB 端開始）：TX1、RX0、RST、GND、D2–D12
  ...row(
    [
      ['D1', 'TX1', 'bus', '序列埠傳送（TX），和 USB 共用，盡量別接東西'],
      ['D0', 'RX0', 'bus', '序列埠接收（RX），和 USB 共用，盡量別接東西'],
      ['RST1', 'RST', 'control', '重設腳：接到 GND 就重新開機'],
      ['GND1', 'GND', 'gnd', '接地，和另一排的 GND 相通'],
      ['D2', 'D2', 'digital', '數位腳；外部中斷 INT0，適合接編碼器'],
      ['D3', 'D3', 'pwm', '數位腳＋PWM；外部中斷 INT1'],
      ['D4', 'D4', 'digital', '數位輸入／輸出'],
      ['D5', 'D5', 'pwm', '數位腳＋PWM'],
      ['D6', 'D6', 'pwm', '數位腳＋PWM'],
      ['D7', 'D7', 'digital', '數位輸入／輸出'],
      ['D8', 'D8', 'digital', '數位輸入／輸出'],
      ['D9', 'D9', 'pwm', '數位腳＋PWM，適合調 LED 亮度、控制伺服機'],
      ['D10', 'D10', 'pwm', '數位腳＋PWM；也是 SPI 的 SS'],
      ['D11', 'D11', 'pwm', '數位腳＋PWM；也是 SPI 的 MOSI'],
      ['D12', 'D12', 'digital', '數位腳；也是 SPI 的 MISO'],
    ],
    NANO_ROW_FAR,
  ),
  // 靠近觀看者那排（從 USB 端開始）：VIN、GND、RST、5V、A7–A0、AREF、3V3、D13
  ...row(
    [
      ['VIN', 'VIN', 'power', '外部電源輸入（7–12 V），經板上穩壓器降成 5 V'],
      ['GND2', 'GND', 'gnd', '接地，和另一排的 GND 相通'],
      ['RST2', 'RST', 'control', '重設腳：和另一支 RST 相通'],
      ['5V', '5V', 'power', '5 V 輸出給感測器；也可以直接餵進穩定的 5 V'],
      ['A7', 'A7', 'analog', '純類比輸入：只能 analogRead()，不能當數位腳'],
      ['A6', 'A6', 'analog', '純類比輸入：只能 analogRead()，不能當數位腳'],
      ['A5', 'A5', 'analog', '類比輸入；也是 I²C 的 SCL'],
      ['A4', 'A4', 'analog', '類比輸入；也是 I²C 的 SDA'],
      ['A3', 'A3', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A2', 'A2', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A1', 'A1', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A0', 'A0', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['AREF', 'REF', 'control', '類比參考電壓輸入，平常不用接'],
      ['3V3', '3V3', 'power', '3.3 V 輸出，電流很小（數十 mA），只夠給小感測器'],
      ['D13', 'D13', 'digital', '數位腳，板上 L 燈接在這裡；也是 SPI 的 SCK'],
    ],
    NANO_ROW_NEAR,
  ),
];

export const NANO_PIN_MAP: Record<string, PinDef> = Object.fromEntries(NANO_PINS.map((p) => [p.id, p]));

export const NANO_INTERNAL_NETS: string[][] = [
  ['GND1', 'GND2'],
  ['RST1', 'RST2'],
];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const NANO_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  usb: [2.6, 9, 9.2, 7.8],
  mcu: [22, 9, 9.9, 9.9],
  hdrF: [21.6, NANO_ROW_FAR, 38.6, 2.6],
  hdrN: [21.6, NANO_ROW_NEAR, 38.6, 2.6],
  reset: [32, 9, 4.4, 6.4],
  xtal: [12.6, 11.4, 5.6, 2.8],
  txrx: [10.6, 6.6, 3.8, 1.6],
  ledL: [13.4, 6.6, 1.8, 1.6],
  pow: [15.6, 6.6, 1.8, 1.6],
  icsp: [40.05, 9, 5.6, 8],
  u2: [24, 9, 10.6, 6.6],
  reg: [11.5, 9, 6.8, 7.2],
  diode: [5, 4.2, 4.2, 2.2],
};

export const nanoLesson: BoardLesson = {
  summary:
    'Nano 把 Uno 的大腦（同一顆 ATmega328P）塞進一塊 18 × 45 mm、只有 7 公克的小板子。兩排排針的間距剛好跨在麵包板中間的溝槽上，整塊插上去就能接線。程式和函式庫跟 Uno 幾乎通用，在 Uno 學會的東西可以直接搬過來；代價是沒有電源插孔，也不能疊擴充板。',
  stats: [
    { k: '時脈', v: '16 MHz' },
    { k: 'FLASH', v: '32 KB' },
    { k: 'RAM', v: '2 KB' },
    { k: 'GPIO', v: '14 + 8' },
    { k: '邏輯電壓', v: '5 V' },
    { k: '參考價', v: '≈ US$4–25' },
  ],
  specs: [
    { k: '微控制器', v: 'ATmega328P（8 位元 AVR，TQFP-32 表面黏著封裝）' },
    { k: '時脈', v: '16 MHz' },
    { k: 'Flash 程式記憶體', v: '32 KB（開機載入程式佔 0.5 KB；舊版相容板佔 2 KB）' },
    { k: 'SRAM / EEPROM', v: '2 KB / 1 KB' },
    { k: '數位腳', v: '14 支（D0–D13，其中 6 支可輸出 PWM）' },
    { k: '類比輸入', v: '8 支（A0–A7，10 位元；A6、A7 只能當類比輸入）' },
    { k: '邏輯電壓', v: '5 V' },
    { k: '供電', v: 'Mini-USB 5 V、VIN 7–12 V，或直接從 5V 腳餵穩定的 5 V' },
    { k: '單腳電流', v: '建議 20 mA 以內（絕對上限 40 mA）' },
    { k: '通訊介面', v: 'UART、I²C（A4／A5）、SPI（D10–D13）' },
    { k: '連接電腦', v: 'Mini-USB，經 USB 轉序列晶片（原廠 FT232RL，相容板多為 CH340）' },
    { k: '尺寸／重量', v: '18 × 45 mm，約 7 g' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'ATmega328P 微控制器', quiz: '找出板子的大腦', desc: '和 Uno 是同一顆晶片，只是換成扁平的表面黏著封裝，斜 45 度焊在板子正中央。這種封裝多出兩支類比腳，所以 Nano 比 Uno 多了 A6、A7。它直接焊死在板上，壞了不能像 Uno 那樣拔起來換。', at: [nx(22), 0.08, nz(9)], layer: 3 },
    { id: 'usb', num: 2, name: 'Mini-USB 接頭', quiz: '找出接電腦的 USB 接頭', desc: '比 Uno 的方形 USB-B 小很多的梯形接頭，供電、上傳程式、序列埠通訊都靠它。注意：不少 Mini-USB 線只能充電、沒有資料線，插上去電腦會完全認不到板子。', at: [nx(2.6), 0.2, nz(9)], layer: 2 },
    { id: 'hdrF', num: 3, name: '排針（數位側）', quiz: '找出 D2–D12 那一排排針', desc: '從 USB 端開始是 TX1、RX0、RST、GND，接著是 D2 到 D12。排針朝下焊，整塊板子可以直接插進麵包板；麵包板同一直排的孔是相通的，線插在旁邊的孔就等於接到這支腳。', at: [nx(21.6), -0.45, nz(NANO_ROW_FAR)], layer: -1.3 },
    { id: 'hdrN', num: 4, name: '排針（類比與電源側）', quiz: '找出 A0–A7 和電源腳那一排排針', desc: '從 USB 端開始是 VIN、GND、RST、5V，再來是 A7 到 A0、AREF、3V3，最後一支是 D13。電源和類比輸入都在這一排。', at: [nx(21.6), -0.45, nz(NANO_ROW_NEAR)], layer: -1.3 },
    { id: 'reset', num: 5, name: 'RESET 按鈕', quiz: '找出 RESET 按鈕', desc: '板子中間的小按鈕，按一下程式就從頭開始跑。上傳程式時，USB 晶片也會自動幫你按一次。', at: [nx(32), 0.12, nz(9)], layer: 2 },
    { id: 'xtal', num: 6, name: '16 MHz 石英振盪器', quiz: '找出提供節拍的石英振盪器', desc: '主晶片的節拍器。delay()、millis() 和序列埠的速度準不準，都看它。', at: [nx(12.6), 0.08, nz(11.4)], layer: 1 },
    { id: 'txrx', num: 7, name: 'TX／RX 指示燈', quiz: '找出 TX／RX 指示燈', desc: 'USB 有資料進出時會閃。上傳時如果它們完全沒閃，多半是驅動程式沒裝，或是線材只能充電。', at: [nx(10.6), 0.05, nz(6.6)], layer: 1 },
    { id: 'ledL', num: 8, name: 'L 燈（接 D13）', quiz: '找出接在 D13 的 L 燈', desc: '接在 D13 的內建 LED，Blink 程式的主角。因為 D13 上掛著這顆燈，把它當輸入腳時讀值會受影響，按鈕最好接別的腳。', at: [nx(13.4), 0.05, nz(6.6)], layer: 1 },
    { id: 'pow', num: 9, name: 'POW 電源燈', quiz: '找出 POW 電源燈', desc: '通電就亮。不亮的時候，先換一條 USB 線，再檢查 5V 有沒有被短路到 GND。', at: [nx(15.6), 0.05, nz(6.6)], layer: 1 },
    { id: 'icsp', num: 10, name: 'ICSP 燒錄排針', quiz: '找出 ICSP 燒錄排針', desc: '離 USB 最遠那端的 2×3 排針，可以用燒錄器直接寫入晶片，例如幫相容板換上新版的開機載入程式。', at: [nx(40.05), 0.35, nz(9)], layer: 2 },
    { id: 'u2', num: 11, name: 'USB 轉序列晶片（CH340）', quiz: '找出 USB 轉序列晶片', desc: '焊在背面。電腦講 USB、主晶片只聽得懂序列埠，靠它翻譯。原廠板用 FTDI 的 FT232RL，便宜的相容板多半用 CH340，有些電腦要先裝驅動程式才認得到。', at: [nx(24), -0.28, nz(9)], layer: -0.7, side: 'bottom' },
    { id: 'reg', num: 12, name: '5 V 穩壓器', quiz: '找出 5 V 穩壓器', desc: '焊在背面。把 VIN 進來的 7–12 V 降到 5 V。它的體積很小、散熱有限，所以 Nano 用 VIN 供電時，能分給其他模組的電流比 Uno 更少。', at: [nx(11.5), -0.3, nz(9)], layer: -0.7, side: 'bottom' },
    { id: 'diode', num: 13, name: '蕭特基二極體', quiz: '找出防止倒灌的二極體', desc: '焊在背面、靠近 USB 接頭。它只讓 USB 的電流進板子、不讓電倒灌回電腦；同時接了 USB 和外部電源時，它負責保護電腦的 USB 埠。', at: [nx(5), -0.22, nz(4.2)], layer: -0.7, side: 'bottom' },
  ],
  strengths: [
    '插麵包板剛剛好：兩排排針跨在中間的溝槽上，做原型和做成品都用得上',
    '和 Uno 同一顆晶片，程式與函式庫幾乎不用改',
    '小又輕（約 7 g），塞得進小車、穿戴裝置和迷你機械手臂',
    '相容板大約 US$4，燒壞了也不心疼；還多了 A6、A7 兩支類比輸入',
  ],
  pitfalls: [
    '相容板多用 CH340 USB 晶片，有些電腦要先安裝驅動程式才認得到',
    '上傳一直逾時？在 Arduino IDE 的「處理器」改選 ATmega328P (Old Bootloader) 試試',
    'A6、A7 只能 analogRead()，不能 digitalRead() 也不能當輸出',
    '沒有電源插孔、穩壓器又小：馬達和伺服機一定要獨立供電，再把 GND 接在一起',
    '很多 Mini-USB 線只能充電，電腦認不到板子時先換一條線',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: 'VIN 接 7–12 V 的外部電源；5V 可以輸出 5 V，也可以反過來直接餵進穩定的 5 V；3V3 只能供應很小的電流。兩排各有一支 GND，彼此相通。' },
    { title: '數位腳與 PWM', kind: 'pwm', body: 'D0–D13 的用法和 Uno 一模一樣。PWM 腳也同樣是 3、5、6、9、10、11，只是很多 Nano 板上不印「~」，要自己記。' },
    { title: '類比輸入', kind: 'analog', body: 'A0–A7 共 8 支，回傳 0–1023。A0–A5 也能當數位腳（D14–D19）；A6、A7 是 Nano 多出來的「純類比」腳，只能用 analogRead()。' },
    { title: '通訊匯流排', kind: 'bus', body: 'UART 在 D0（RX0）、D1（TX1），和 USB 共用；I²C 是 A4（SDA）、A5（SCL）；SPI 在 D10–D13，也拉到 ICSP 排針。' },
    { title: '外部中斷', kind: 'digital', body: 'D2、D3 一樣可以用 attachInterrupt()，適合接輪子的編碼器，或需要立刻反應的感測器。' },
    { title: '控制腳', kind: 'control', body: '兩支 RST 都接到同一條重設線，拉到 GND 就重新開機；REF（AREF）設定類比量測的參考電壓。' },
  ],
  code: {
    title: '第一支程式：用 A7 旋鈕調 L 燈閃爍速度',
    lang: 'ARDUINO C++',
    source: `// Nano 和 Uno 是同一顆晶片，Uno 的程式不用改就能跑。
// 上傳前在 Arduino IDE 選：
//   開發板 → Arduino Nano
//   處理器 → ATmega328P（相容板失敗就改選 Old Bootloader）
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);     // L 燈接在 D13
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A7);        // A7 是 Nano 才有的純類比腳
  Serial.println(knob);             // 0–1023
  digitalWrite(LED_BUILTIN, HIGH);
  delay(100 + knob);                // 轉旋鈕就能改變閃爍速度
  digitalWrite(LED_BUILTIN, LOW);
  delay(100 + knob);
}`,
  },
  projects: [
    '迷你循跡車：Nano＋麵包板，整台車比手掌還小',
    '藍牙遙控車：Nano＋HC-05 藍牙模組＋馬達驅動板',
    '兩輪自平衡車：Nano＋MPU-6050 陀螺儀＋步進馬達驅動器',
    '六足機器人：Nano＋PCA9685 伺服機驅動板，一次控制 16 顆伺服機',
    '桌上小夥伴：Nano＋OLED 表情螢幕＋觸碰感測器',
  ],
  facts: [
    'Nano 在 2008 年推出，比 Uno 還早兩年；最早的版本用的是記憶體只有一半的 ATmega168。',
    '「Nano」後來變成一整個家族：Nano Every、Nano 33 BLE、Nano RP2040 Connect、Nano ESP32 都沿用同樣的尺寸和腳位排列。',
    '兩排排針相距 0.6 英吋（15.24 mm），和傳統的大型 DIP 晶片一樣，所以 Nano 可以像一顆大晶片那樣插在麵包板上。',
  ],
  quiz: [
    { part: 'mcu', prompt: '找出板子的大腦：負責執行程式的微控制器', hint: '板子正中間、轉了 45 度的黑色方形晶片。', explain: 'Nano 的 ATmega328P 是表面黏著封裝，和 Uno 是同一顆晶片。' },
    { part: 'usb', prompt: '要把程式從電腦送進 Nano，線要插在哪裡？', hint: '板子最左端、小小的銀色梯形接頭。', explain: 'Mini-USB 同時負責供電、上傳程式與序列埠通訊。' },
    { part: 'u2', prompt: '負責把 USB 翻譯成序列埠的晶片在哪裡？', hint: '它不在正面！按「背面」翻過來，中間那顆兩側有腳的長方形晶片。', explain: 'CH340（或原廠的 FT232RL）讓電腦和 ATmega328P 能互相溝通。' },
    { part: 'reg', prompt: '用 VIN 供電時，把 9 V 降成 5 V 的零件在哪裡？', hint: '也在背面，靠近 USB 那一側、有一片大焊腳的元件。', explain: '穩壓器把多出來的電壓變成熱；Nano 的穩壓器很小，別讓它扛太多負載。' },
    { part: 'reset', prompt: '程式卡住了，想讓它從頭跑起，該按哪裡？', hint: '板子中間偏右的小按鈕。', explain: 'RESET 只是重新開機，晶片裡的程式不會被清除。' },
    { part: 'ledL', prompt: '不接任何線就能被 Blink 點亮的燈在哪裡？', hint: 'USB 旁邊那排小燈裡，標著 L 的那一顆。', explain: 'L 燈接在 D13。' },
    { part: 'hdrN', prompt: '可變電阻的中間腳要接到 A0–A7，該找哪一排排針？', hint: '靠近你這一側、有 VIN 和 5V 的那一排。', explain: '類比輸入和電源腳在同一排。' },
    { part: 'hdrF', prompt: '按鈕要接 D2，該找哪一排排針？', hint: '離你比較遠、以 TX1 和 RX0 開頭的那一排。', explain: 'D2–D12 在同一排；D13 則在另一排的最後一支。' },
    { part: 'diode', prompt: '防止 USB 的電倒灌回電腦的小零件在哪裡？', hint: '翻到背面，USB 接頭旁邊的小黑色元件。', explain: '蕭特基二極體只讓電流往一個方向走。' },
    { part: 'icsp', prompt: '想用燒錄器幫相容板換開機載入程式，要接哪裡？', hint: '離 USB 最遠的那一端，2×3 的六支排針。', explain: 'ICSP 排針可以繞過 USB，直接寫入主晶片。' },
  ],
};
