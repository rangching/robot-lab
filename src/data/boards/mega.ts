import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/** Mega 2560 R3 實體尺寸（公分）：101.6 × 53.3 mm */
export const MEGA_W = 10.16;
export const MEGA_D = 5.33;
export const MEGA_PCB_T = 0.16;

/** 板子圖面座標（mm，原點左下角、USB 在左）→ 3D 座標（cm，原點中心，z 朝向觀看者） */
export const megaX = (mm: number) => mm / 10 - MEGA_W / 2;
export const megaZ = (mm: number) => MEGA_D / 2 - mm / 10;

const P = 2.54;

function row(ids: [string, string, PinKind, string][], startMm: number, yMm: number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: megaX(startMm + i * P), z: megaZ(yMm) }));
}

/** 和 Uno 相同的排母位置（擴充板相容），右邊再接出 Mega 專屬的排母 */
export const MEGA_DIG_Y = 50.8;
export const MEGA_PWR_Y = 2.54;
/** 通訊排母 D14–D21 起點 */
export const MEGA_COMM_X = 70.6;
/** 類比 A8–A15 起點 */
export const MEGA_ANA2_X = 69.85;
/** 右側 2×18 雙排母：兩欄 x，最上排 y */
export const MEGA_DBL_X: [number, number] = [93.98, 96.52];
export const MEGA_DBL_TOP_Y = 48.26;

const analog = (n: number, extra = ''): [string, string, PinKind, string] => [
  `A${n}`, `A${n}`, 'analog', `類比輸入：0–5 V 轉成 0–1023${extra}`,
];

/** 右側雙排母 D22–D53 的說明 */
function dblDesc(n: number): [PinKind, string] {
  if (n === 44 || n === 45 || n === 46) return ['pwm', `數位腳＋PWM（Timer5）；雙排母上唯三能 analogWrite() 的腳`];
  if (n === 50) return ['bus', '數位腳；也是 SPI 的 MISO'];
  if (n === 51) return ['bus', '數位腳；也是 SPI 的 MOSI'];
  if (n === 52) return ['bus', '數位腳；也是 SPI 的 SCK'];
  if (n === 53) return ['bus', '數位腳；也是 SPI 的 SS，用 SPI 時要設成輸出'];
  return ['digital', '數位輸入／輸出，適合接大量按鈕、LED、繼電器'];
}

function doubleHeader(): PinDef[] {
  const out: PinDef[] = [];
  const at = (col: 0 | 1, r: number) => ({ x: megaX(MEGA_DBL_X[col]), z: megaZ(MEGA_DBL_TOP_Y - r * P) });
  out.push({ id: '5V_A', label: '5V', kind: 'power', desc: '5 V 輸出，和電源排母的 5V 相通', ...at(0, 0) });
  out.push({ id: '5V_B', label: '5V', kind: 'power', desc: '5 V 輸出，和電源排母的 5V 相通', ...at(1, 0) });
  for (let r = 1; r <= 16; r++) {
    for (const col of [0, 1] as const) {
      const n = 22 + (r - 1) * 2 + col;
      const [kind, desc] = dblDesc(n);
      const label = kind === 'pwm' ? `~${n}` : `${n}`;
      out.push({ id: `D${n}`, label, kind, desc, ...at(col, r) });
    }
  }
  out.push({ id: 'GND4', label: 'GND', kind: 'gnd', desc: '接地，整個電路共用的 0 V', ...at(0, 17) });
  out.push({ id: 'GND5', label: 'GND', kind: 'gnd', desc: '接地，整個電路共用的 0 V', ...at(1, 17) });
  return out;
}

export const MEGA_PINS: PinDef[] = [
  ...row(
    [
      ['SCL', 'SCL', 'bus', 'I²C 時脈線，和 D21 是同一條線'],
      ['SDA', 'SDA', 'bus', 'I²C 資料線，和 D20 是同一條線'],
      ['AREF', 'AREF', 'control', '類比參考電壓輸入，平常不用接'],
      ['GND3', 'GND', 'gnd', '接地，整個電路共用的 0 V'],
      ['D13', '~13', 'pwm', '數位腳＋PWM；板上 L 燈接在這裡'],
      ['D12', '~12', 'pwm', '數位腳＋PWM'],
      ['D11', '~11', 'pwm', '數位腳＋PWM'],
      ['D10', '~10', 'pwm', '數位腳＋PWM'],
      ['D9', '~9', 'pwm', '數位腳＋PWM，適合調 LED 亮度、控制伺服機'],
      ['D8', '~8', 'pwm', '數位腳＋PWM'],
    ],
    21.4,
    MEGA_DIG_Y,
  ),
  ...row(
    [
      ['D7', '~7', 'pwm', '數位腳＋PWM'],
      ['D6', '~6', 'pwm', '數位腳＋PWM'],
      ['D5', '~5', 'pwm', '數位腳＋PWM'],
      ['D4', '~4', 'pwm', '數位腳＋PWM'],
      ['D3', '~3', 'pwm', '數位腳＋PWM；外部中斷 INT5'],
      ['D2', '~2', 'pwm', '數位腳＋PWM；外部中斷 INT4，適合接編碼器'],
      ['D1', 'TX0→1', 'bus', 'Serial（TX0），和 USB 共用，盡量別接東西'],
      ['D0', 'RX0←0', 'bus', 'Serial（RX0），和 USB 共用，盡量別接東西'],
    ],
    48.3,
    MEGA_DIG_Y,
  ),
  ...row(
    [
      ['D14', 'TX3 14', 'bus', 'Serial3 傳送（TX3）'],
      ['D15', 'RX3 15', 'bus', 'Serial3 接收（RX3）'],
      ['D16', 'TX2 16', 'bus', 'Serial2 傳送（TX2）'],
      ['D17', 'RX2 17', 'bus', 'Serial2 接收（RX2）'],
      ['D18', 'TX1 18', 'bus', 'Serial1 傳送（TX1）；也是外部中斷 INT3'],
      ['D19', 'RX1 19', 'bus', 'Serial1 接收（RX1）；也是外部中斷 INT2'],
      ['D20', 'SDA 20', 'bus', 'I²C 資料線；也是外部中斷 INT1'],
      ['D21', 'SCL 21', 'bus', 'I²C 時脈線；也是外部中斷 INT0'],
    ],
    MEGA_COMM_X,
    MEGA_DIG_Y,
  ),
  ...row(
    [
      ['NC', 'NC', 'nc', '沒有連接，保留給未來使用'],
      ['IOREF', 'IOREF', 'power', '告訴擴充板這塊板子的邏輯電壓（5 V）'],
      ['RESET', 'RESET', 'control', '接到 GND 就會讓板子重新開機'],
      ['3V3', '3.3V', 'power', '3.3 V 輸出，最多約 50 mA'],
      ['5V', '5V', 'power', '5 V 輸出，給感測器和小模組用'],
      ['GND1', 'GND', 'gnd', '接地，整個電路共用的 0 V'],
      ['GND2', 'GND', 'gnd', '接地，整個電路共用的 0 V'],
      ['VIN', 'VIN', 'power', '外部電源輸入（7–12 V），和電源插孔相通'],
    ],
    24.1,
    MEGA_PWR_Y,
  ),
  ...row([0, 1, 2, 3, 4, 5, 6, 7].map((n) => analog(n)), 46.99, MEGA_PWR_Y),
  ...row([8, 9, 10, 11, 12, 13, 14, 15].map((n) => analog(n, '；Mega 才有的第二排類比腳')), MEGA_ANA2_X, MEGA_PWR_Y),
  ...doubleHeader(),
];

/** 每個零件在板上的外框（mm：中心 x, y, 寬, 高），給絲印與組裝用 */
export const MEGA_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  mcu: [54, 26, 16, 16],
  usb: [4, 38, 13, 12.4],
  u2: [16, 30, 6.2, 6.2],
  jack: [6, 7.7, 12, 9.4],
  reg: [16.5, 8, 7.2, 6.4],
  caps: [17, 12.5, 12, 11],
  dig: [44, 50.8, 49, 3],
  comm: [79.5, 50.8, 21, 3],
  pwr: [32.99, 2.54, 21, 3],
  ana: [55.88, 2.54, 21, 3],
  ana2: [78.74, 2.54, 21, 3],
  dbl: [95.25, 26.67, 5.6, 46.5],
  ledL: [24, 44, 3, 2],
  txrx: [24, 38.2, 3, 5],
  on: [69, 38, 3, 2],
  reset: [6, 50, 7, 7],
  xtal: [37, 30, 11, 4.6],
  icsp: [86.5, 27, 5.6, 8.2],
};

export const MEGA_PIN_MAP: Record<string, PinDef> = Object.fromEntries(MEGA_PINS.map((p) => [p.id, p]));

/** 板內本來就相通的腳位（電氣上同一個節點） */
export const MEGA_INTERNAL_NETS: string[][] = [
  ['GND1', 'GND2', 'GND3', 'GND4', 'GND5'],
  ['5V', '5V_A', '5V_B'],
  ['SDA', 'D20'],
  ['SCL', 'D21'],
];

const at = (x: number, y: number, mmy: number): [number, number, number] => [megaX(x), y, megaZ(mmy)];

export const megaLesson: BoardLesson = {
  summary:
    'Mega 2560 是 Arduino 家族的「大容量版」：一樣是 5 V、一樣用 Arduino IDE 寫程式，但腳位從 Uno 的 20 支暴增到 70 支，Flash 和 RAM 分別是 Uno 的 8 倍和 4 倍，還多了三組硬體序列埠。左半邊的排母位置和 Uno 完全一樣，所以大部分 Uno 擴充板可以直接疊上去；3D 印表機主機板、六足機器人、大型 LED 看板都愛用它。',
  stats: [
    { k: '時脈', v: '16 MHz' },
    { k: 'FLASH', v: '256 KB' },
    { k: 'RAM', v: '8 KB' },
    { k: 'GPIO', v: '54 + 16' },
    { k: '序列埠', v: '4 組' },
    { k: '參考價', v: '≈ US$45' },
  ],
  specs: [
    { k: '微控制器', v: 'ATmega2560（8 位元 AVR，100 腳 TQFP 表面黏著）' },
    { k: '時脈', v: '16 MHz' },
    { k: 'Flash 程式記憶體', v: '256 KB（其中 8 KB 給開機載入程式）' },
    { k: 'SRAM / EEPROM', v: '8 KB / 4 KB' },
    { k: '數位腳', v: '54 支（其中 15 支可輸出 PWM：2–13、44–46）' },
    { k: '類比輸入', v: '16 支（A0–A15，10 位元 ADC，0–1023）' },
    { k: '硬體序列埠', v: '4 組：Serial（0/1）、Serial1（19/18）、Serial2（17/16）、Serial3（15/14）' },
    { k: '外部中斷', v: '6 支：2、3、18、19、20、21' },
    { k: '邏輯電壓', v: '5 V' },
    { k: '供電', v: 'USB 5 V，或電源插孔／VIN 7–12 V' },
    { k: '單腳電流', v: '建議 20 mA 以內；全部腳位加總最多約 200 mA' },
    { k: '連接電腦', v: 'USB-B，經 ATmega16U2 轉成序列埠' },
    { k: '尺寸／重量', v: '101.6 × 53.3 mm，約 37 g' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'ATmega2560 微控制器', quiz: '找出板子的大腦：100 支腳的方形晶片', desc: '整塊板子的大腦，四邊各 25 支細腳、總共 100 支。和 Uno 不同，它直接焊在板子上（表面黏著），不能拔起來換；好處是塞得下 256 KB Flash、8 KB RAM 和 54 支數位腳。', at: at(54, 0.08, 26), layer: 3 },
    { id: 'usb', num: 2, name: 'USB-B 接頭', quiz: '找出接電腦的方形 USB 接頭', desc: '和 Uno 一樣的方形 USB-B 接頭：供應 5 V、上傳程式、和電腦互傳文字。上傳 200 KB 的大程式也是從這裡進去。', at: at(2, 0.55, 38), layer: 2 },
    { id: 'u2', num: 3, name: 'ATmega16U2 USB 轉換晶片', quiz: '找出把 USB 翻譯成序列埠的小晶片', desc: '把電腦的 USB 翻譯成 ATmega2560 聽得懂的序列埠（Serial0，也就是 D0、D1）。所以 D0、D1 接了東西時，上傳程式可能會失敗。', at: at(16, 0.1, 30), layer: 1 },
    { id: 'jack', num: 4, name: '電源插孔（7–12 V）', quiz: '找出接變壓器或電池盒的圓形電源插孔', desc: '5.5 × 2.1 mm 的圓形插孔，中心是正極。Mega 常常帶一堆感測器，建議用 9 V 變壓器，電壓越高穩壓器越燙。', at: at(5, 0.55, 7.7), layer: 2 },
    { id: 'reg', num: 5, name: '5 V 穩壓器', quiz: '找出把 7–12 V 降成 5 V 的穩壓器', desc: '把插孔進來的 7–12 V 降成 5 V，多出來的電壓變成熱。Mega 腳多、接的模組也多，總電流一大它就很燙；馬達和伺服機請另外供電。', at: at(16.5, 0.12, 8), layer: 1 },
    { id: 'caps', num: 6, name: '電解電容', quiz: '找出兩顆圓柱形的電解電容', desc: '穩壓器前後的小型蓄電池，負載突然變大、電壓掉一下時先補上，避免微控制器重新開機。', at: at(17, 0.3, 12.5), layer: 2 },
    { id: 'dig', num: 7, name: '數位腳排母 D0–D13', quiz: '找出和 Uno 位置一樣的 D0–D13 排母', desc: '位置和 Uno 一模一樣，擴充板才插得上去。差別是 Mega 的 D2–D13 每一支都能輸出 PWM；左端一樣有 GND、AREF 和 I²C 的 SDA、SCL。', at: at(44, 0.45, MEGA_DIG_Y), layer: 2 },
    { id: 'comm', num: 8, name: '通訊排母 D14–D21', quiz: '找出 TX1／RX1 那排、有三組序列埠的通訊排母', desc: 'Mega 多出來的通訊專區：Serial1、Serial2、Serial3 三組硬體序列埠，加上 I²C 的 SDA（20）、SCL（21）。藍牙模組、GPS、另一塊 Arduino 都可以各接一組，互不干擾，也不會卡住 USB。', at: at(79.5, 0.45, MEGA_DIG_Y), layer: 2 },
    { id: 'pwr', num: 9, name: '電源排母 POWER', quiz: '找出提供 5V、3.3V 和 GND 的電源排母', desc: '和 Uno 相同：5V、3.3V、GND 給模組取電，VIN 和電源插孔相通，RESET 可以接外部按鈕。', at: at(32.99, 0.45, MEGA_PWR_Y), layer: 2 },
    { id: 'ana', num: 10, name: '類比輸入 A0–A7', quiz: '找出 A0–A7 類比輸入排母', desc: '前 8 支類比輸入，A0–A5 的位置和 Uno 一樣。注意 Mega 的 I²C 不在 A4、A5，而是在 D20、D21——Uno 的 I²C 擴充板接到 Mega 上常常就是卡在這裡。', at: at(55.88, 0.45, MEGA_PWR_Y), layer: 2 },
    { id: 'ana2', num: 11, name: '類比輸入 A8–A15', quiz: '找出 Mega 才有的 A8–A15 第二排類比腳', desc: '多出來的 8 支類比輸入。16 支類比腳可以同時讀很多可變電阻、搖桿或灰階感測器，例如一整排循跡感測器。', at: at(78.74, 0.45, MEGA_PWR_Y), layer: 2 },
    { id: 'dbl', num: 12, name: '雙排數位排母 D22–D53', quiz: '找出板子右端、2 × 18 的雙排數位排母', desc: '右端的長條雙排母，有 32 支數位腳，頭尾還各有一對 5V 和 GND。適合接 4×4 鍵盤、大量 LED 或繼電器；其中 44–46 能輸出 PWM，50–53 是 SPI。', at: at(95.25, 0.45, 26.67), layer: 2 },
    { id: 'ledL', num: 13, name: 'L 燈（接 D13）', quiz: '找出接在 D13、不用接線就能閃的 L 燈', desc: '和 Uno 一樣接在 D13 的內建 LED。Blink 程式不用改一個字，在 Mega 上照樣會閃。', at: at(24, 0.1, 44), layer: 1 },
    { id: 'txrx', num: 14, name: 'TX／RX 指示燈', quiz: '找出上傳程式時會快速閃爍的 TX／RX 燈', desc: '只反映 USB 那一組（Serial0）的傳送與接收。Serial1–3 有資料進出時，這兩顆燈不會閃。', at: at(24, 0.1, 38.2), layer: 1 },
    { id: 'on', num: 15, name: 'ON 電源燈', quiz: '找出通電就會亮的 ON 電源燈', desc: '有電就亮綠燈。不亮時先檢查 USB 線和電源，再檢查 5V 有沒有被短路到 GND。', at: at(69, 0.1, 38), layer: 1 },
    { id: 'reset', num: 16, name: 'RESET 按鈕', quiz: '找出讓程式從頭跑起的 RESET 按鈕', desc: '按一下讓程式從頭跑，存在 Flash 裡的程式不會被清掉。', at: at(6, 0.25, 50), layer: 2 },
    { id: 'xtal', num: 17, name: '16 MHz 石英振盪器', quiz: '找出提供精準節拍的銀色石英振盪器', desc: '金屬殼裡的精準節拍器，讓 delay()、millis() 和四組序列埠的速度都準確。', at: at(37, 0.2, 30), layer: 2 },
    { id: 'icsp', num: 18, name: 'ICSP 燒錄排針', quiz: '找出 2×3 的 ICSP 燒錄排針', desc: '六支排針，用外部燒錄器直接寫入 ATmega2560，也拉出 SPI 匯流排。Mega 的 SPI 腳在 50–53，不是 Uno 的 10–13，所以 SPI 擴充板要靠這組排針才通用。', at: at(86.5, 0.4, 27), layer: 2 },
  ],
  strengths: [
    '腳位超多：54 支數位、16 支類比，一個專題接幾十個感測器也夠用',
    '四組硬體序列埠：藍牙、GPS、另一塊板子可以同時連，不用軟體序列埠硬湊',
    '256 KB Flash、8 KB RAM：大程式、大量文字和陣列也塞得下',
    '左半邊和 Uno 相容：大多數擴充板與 Uno 範例程式直接沿用',
  ],
  pitfalls: [
    'I²C 在 D20、D21，不在 A4、A5；SPI 在 50–53，不在 10–13。照 Uno 教學接線會不通',
    '主晶片是焊死的表面黏著元件，燒壞不能像 Uno 那樣拔起來換',
    '腳多不代表電流多：全部腳位加總最多約 200 mA，馬達、伺服機一定要另外供電',
    '板子很長：放進機器人底盤前先量好尺寸，固定孔位置也和 Uno 不完全一樣',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '電源排母和 Uno 相同：5V、3.3V、GND、VIN。右端雙排母的最上排是兩支 5V、最下排是兩支 GND，接一大排模組時取電很方便。' },
    { title: '數位腳與 PWM', kind: 'pwm', body: 'D0–D53 共 54 支。PWM 腳有 15 支：2–13 全部都可以，再加上 44、45、46。analogWrite() 在這些腳上可以平滑調整亮度和速度。' },
    { title: '類比輸入', kind: 'analog', body: 'A0–A15 共 16 支，用 analogRead() 讀 0–5 V，回傳 0–1023。也能當一般數位腳使用（D54–D69）。' },
    { title: '四組序列埠', kind: 'bus', body: 'Serial 在 0／1（和 USB 共用）、Serial1 在 19／18、Serial2 在 17／16、Serial3 在 15／14。程式裡寫 Serial1.begin(9600) 就能直接用，不需要額外函式庫。' },
    { title: 'I²C 與 SPI', kind: 'bus', body: 'I²C：SDA＝20、SCL＝21（左上角的 SDA、SCL 也是同一條線）。SPI：MISO＝50、MOSI＝51、SCK＝52、SS＝53，也拉到 ICSP 排針上。' },
    { title: '外部中斷', kind: 'digital', body: '2、3、18、19、20、21 共 6 支可以用 attachInterrupt()。四輪機器人每個輪子接一個編碼器也還有剩。' },
  ],
  code: {
    title: '用 Serial1 接藍牙模組：電腦和手機同時對話',
    lang: 'ARDUINO C++',
    source: `// Mega 有 4 組硬體序列埠。
// USB 用 Serial，藍牙模組（例如 HC-05）接在 Serial1：
//   模組 TX → 19（RX1）、模組 RX → 18（TX1）
void setup() {
  Serial.begin(9600);     // 和電腦對話
  Serial1.begin(9600);    // 和藍牙模組對話
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  if (Serial1.available()) {         // 手機傳來一個字
    char c = Serial1.read();
    Serial.print("手機說：");
    Serial.println(c);               // 轉貼到電腦的序列埠監控視窗
    if (c == '1') digitalWrite(LED_BUILTIN, HIGH);
    if (c == '0') digitalWrite(LED_BUILTIN, LOW);
  }
  if (Serial.available()) {          // 電腦打字，轉送到手機
    Serial1.write(Serial.read());
  }
}`,
  },
  projects: [
    '六足機器人：18 顆伺服機配伺服驅動板，Mega 負責步態運算',
    '3D 印表機控制板：Mega＋RAMPS 擴充板驅動步進馬達與加熱頭',
    '藍牙＋GPS 自走車：兩個模組各用一組硬體序列埠',
    '8 路循跡車：一排灰階感測器同時接到 A0–A7',
    '大型 LED 看板或鍵盤矩陣：雙排母一次拉出 32 支數位腳',
  ],
  facts: [
    '型號裡的「2560」來自晶片本身：ATmega2560 有 256 KB 的 Flash。',
    '它是許多開源 3D 印表機的心臟：RepRap 社群的 RAMPS 控制板就是設計成疊在 Mega 上。',
    'R3 版本和 Uno R3 同一年改版，加入了 SDA、SCL、IOREF 腳位，讓同一塊擴充板在兩塊板子上都找得到 I²C。',
  ],
  quiz: [],
};

megaLesson.quiz = [
  { part: 'mcu', prompt: '找出板子的大腦：負責執行程式的微控制器', hint: '板子中央那顆方形、四邊都有細腳的晶片。', explain: 'ATmega2560 有 100 支腳、256 KB Flash，直接焊在板子上。' },
  { part: 'comm', prompt: 'GPS 模組想用一組不跟 USB 搶的硬體序列埠，要接到哪一排？', hint: '上排右邊、標著 TX1、RX1 的那排。', explain: '通訊排母 D14–D21 有 Serial1–3 三組序列埠。' },
  { part: 'dbl', prompt: '要接 4×4 薄膜鍵盤需要 8 支數位腳，哪一區腳位最充裕？', hint: '板子最右端那條長長的雙排母。', explain: 'D22–D53 共 32 支數位腳，頭尾還有 5V 和 GND。' },
  { part: 'ana2', prompt: 'Mega 比 Uno 多出來的 8 支類比輸入在哪裡？', hint: '下排最右邊、標著 A8–A15 的排母。', explain: 'A8–A15 讓 Mega 一共有 16 支類比輸入。' },
  { part: 'icsp', prompt: 'SPI 擴充板要在 Uno 和 Mega 上都能用，應該走哪一組排針？', hint: '主晶片右邊、2×3 的六支排針。', explain: 'Mega 的 SPI 在 50–53，ICSP 排針則和 Uno 位置相同。' },
  { part: 'usb', prompt: '程式要從電腦送進板子，線要插在哪裡？', hint: '板子左上方那個方形的銀色金屬接頭。', explain: 'USB-B 接頭同時負責供電、上傳程式和序列埠通訊。' },
  { part: 'jack', prompt: '機器人改用電池盒供電時，要插在哪裡？', hint: '板子左下方的黑色圓孔插座。', explain: '電源插孔接受 7–12 V，再由穩壓器降成 5 V。' },
  { part: 'ledL', prompt: '不接任何線就能被 Blink 程式點亮的燈在哪裡？', hint: '它接在 D13，在 USB 接頭右邊。', explain: 'L 燈接在 D13，Uno 的 Blink 程式在 Mega 上照樣能用。' },
  { part: 'u2', prompt: '負責把 USB 翻譯成序列埠的晶片在哪裡？', hint: 'USB 接頭右邊、一顆很小的方形晶片。', explain: 'ATmega16U2 把 USB 轉成 Serial0（D0、D1）。' },
  { part: 'reset', prompt: '程式卡住了，想讓它從頭跑起，該按哪一顆？', hint: 'USB 接頭上方的小按鈕。', explain: 'RESET 只是重新開機，程式不會被清掉。' },
  { part: 'xtal', prompt: '讓 millis() 和四組序列埠速度都準確的節拍器在哪裡？', hint: '一顆橢圓形、亮銀色的金屬小元件。', explain: '16 MHz 石英振盪器提供精準的時脈。' },
];

/** 組裝托盤位置 [x, z]（cm）：排母與小零件排在板子下方，長條雙排母和主晶片放右側（取景接近正方形） */
const MEGA_TRAY: Record<string, [number, number, number?]> = (() => {
  const t: Record<string, [number, number, number?]> = {
    dig: [-2.6, 4.0],
    pwr: [1.2, 4.0],
    ana: [3.8, 4.0],
    comm: [-3.6, 5.1],
    ana2: [-0.8, 5.1],
    dbl: [6.4, -0.4],
    mcu: [6.4, 3.9],
  };
  const small = ['usb', 'jack', 'u2', 'reg', 'caps', 'ledL', 'txrx', 'on', 'reset', 'xtal', 'icsp'];
  small.forEach((id, i) => {
    t[id] = [-4.3 + (i % 6) * 1.75, 6.7 + Math.floor(i / 6) * 1.5];
  });
  return t;
})();

/** 多板註冊用的資料（介面 BoardData 由 registry.ts 定義） */
export const megaData: BoardData = {
  id: 'mega',
  short: 'Mega',
  summary: BOARDS.find((b) => b.id === 'mega')!,
  lesson: megaLesson,
  w: MEGA_W,
  d: MEGA_D,
  pins: MEGA_PINS,
  internalNets: MEGA_INTERNAL_NETS,
  supply: ['5V', '5V_A', '5V_B', 'IOREF'],
  gnd: ['GND1', 'GND2', 'GND3', 'GND4', 'GND5'],
  analogOnly: [],
  footprints: MEGA_FOOTPRINTS,
  mx: megaX,
  mz: megaZ,
  tray: MEGA_TRAY,
  stage: {
    floorY: -0.17,
    pinY: 0.87,
    explodeLift: 0,
    views: {
      iso: [8.4, 11.4, 13.6, 0.2, 0, 0.2],
      top: [0, 18.5, 0.01, 0, 0, 0],
      bottom: [0, -17.5, 0.6, 0, 0, 0],
      front: [0, 3.6, 16.5, 0, 0.2, 0],
    },
    asmCam: [1.2, 29, 10.4, 1.2, 0, 0.4],
  },
  bench: {
    /** 右緣約在 x = -0.6，元件擺在右側 */
    pos: [-5.9, 0, -0.6],
    half: [5.3, 2.9],
    lift: 0,
    pin: (p) => [p.x, 0.87, p.z],
  },
};
