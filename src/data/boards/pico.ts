import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * Raspberry Pi Pico（RP2040）。實體 51 × 21 mm，PCB 厚 1 mm。
 * 長邊沿 x 軸：Micro-USB 在左端（-x），SWD 除錯焊點在右端（+x）。
 * 官方腳位圖是「USB 朝上」：左排 1–20 腳在這裡是靠近觀看者那排，右排 40–21 腳是遠側那排。
 */
export const PICO_W = 5.1;
export const PICO_D = 2.1;
export const PICO_PCB_T = 0.1;
/** 排針塑膠座厚度與排針伸出長度（公分） */
export const PICO_SPACER = 0.25;
export const PICO_LEG = 0.6;

/** 板子圖面座標（mm，原點左下角＝USB 那端靠近觀看者的角）→ 3D 座標（cm，原點中心） */
export const px = (mm: number) => mm / 10 - PICO_W / 2;
export const pz = (mm: number) => PICO_D / 2 - mm / 10;

const P = 2.54;
/** 兩排相距 0.7 英吋（17.78 mm），第一支腳距板端 1.37 mm */
export const PICO_MID_Y = PICO_D * 5;
export const PICO_ROW_NEAR = PICO_MID_Y - 8.89;
export const PICO_ROW_FAR = PICO_MID_Y + 8.89;
export const PICO_PIN_X0 = 1.37;

type Row = [id: string, label: string, kind: PinKind, desc: string];

function row(ids: Row[], yMm: number, num: (i: number) => number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc: `第 ${num(i)} 腳｜${desc}`, x: px(PICO_PIN_X0 + i * P), z: pz(yMm) }));
}

const gp = (n: number, extra: string): Row => [`GP${n}`, `GP${n}`, 'pwm', `GPIO${n}：數位＋PWM；${extra}`];

/**
 * 腳位 id 用板子背面印的名字（GP0…GP28），和 MicroPython 的 Pin(數字) 一致：GP15 就寫 Pin(15)。
 * 注意「第幾腳」和「GP 幾號」是兩回事：第 20 腳是 GP15，不是 GP20。
 */
export const PICO_PINS: PinDef[] = [
  // 靠近觀看者那排：第 1 腳（USB 端）到第 20 腳
  ...row(
    [
      gp(0, 'UART0 的 TX（傳送）、I²C0 的 SDA'),
      gp(1, 'UART0 的 RX（接收）、I²C0 的 SCL'),
      ['GND1', 'GND', 'gnd', '接地；Pico 每 5 支腳就有一支 GND，方形焊墊就是它'],
      gp(2, 'SPI0 的 SCK、I²C1 的 SDA'),
      gp(3, 'SPI0 的 TX（MOSI）、I²C1 的 SCL'),
      gp(4, 'UART1 的 TX、I²C0 的 SDA；常拿來接 OLED'),
      gp(5, 'UART1 的 RX、I²C0 的 SCL'),
      ['GND2', 'GND', 'gnd', '接地'],
      gp(6, 'SPI0 的 SCK、I²C1 的 SDA'),
      gp(7, 'SPI0 的 TX、I²C1 的 SCL'),
      gp(8, 'UART1 的 TX、I²C0 的 SDA'),
      gp(9, 'UART1 的 RX、I²C0 的 SCL'),
      ['GND3', 'GND', 'gnd', '接地'],
      gp(10, 'SPI1 的 SCK、I²C1 的 SDA'),
      gp(11, 'SPI1 的 TX、I²C1 的 SCL'),
      gp(12, 'UART0 的 TX、SPI1 的 RX（MISO）'),
      gp(13, 'UART0 的 RX、SPI1 的 CSn'),
      ['GND4', 'GND', 'gnd', '接地'],
      gp(14, 'SPI1 的 SCK、I²C1 的 SDA'),
      gp(15, 'SPI1 的 TX、I²C1 的 SCL；這排最後一支，外接 LED 的好位置'),
    ],
    PICO_ROW_NEAR,
    (i) => i + 1,
  ),
  // 遠側那排：第 40 腳（USB 端）到第 21 腳
  ...row(
    [
      ['VIN', 'VBUS', 'power', 'VBUS：直接接 USB 的 5 V。插著 USB 時，伺服機這類 5 V 元件可以從這裡取電（電流看電腦 USB 埠的能力）'],
      ['VSYS', 'VSYS', 'power', 'VSYS：整塊板子的主電源輸入（1.8–5.5 V），經二極體接到 VBUS；用電池時從這裡餵電'],
      ['GND5', 'GND', 'gnd', '接地'],
      ['3V3_EN', '3V3_EN', 'control', '3V3_EN：拉到 GND 會關掉板上的 3.3 V 電源（整塊板子斷電）'],
      ['3V3', '3V3(OUT)', 'power', '3V3(OUT)：板上電源晶片輸出的 3.3 V，給感測器用；建議負載 300 mA 以內'],
      ['ADC_VREF', 'ADC_VREF', 'power', 'ADC_VREF：類比轉數位的參考電壓，預設接 3.3 V；要更準時可接外部參考電壓'],
      ['GP28', 'GP28', 'analog', 'GPIO28：ADC2 類比輸入；也能當一般數位腳'],
      ['AGND', 'AGND', 'gnd', 'AGND：給類比電路用的接地，接旋鈕、感測器時用它雜訊比較小'],
      ['GP27', 'GP27', 'analog', 'GPIO27：ADC1 類比輸入；也能當一般數位腳'],
      ['GP26', 'GP26', 'analog', 'GPIO26：ADC0 類比輸入；也能當一般數位腳'],
      ['RUN', 'RUN', 'control', 'RUN：重設腳，拉到 GND 就重新開機（Pico 沒有重設按鈕，常在這裡加一顆）'],
      gp(22, '沒有預設的通訊功能，當一般數位腳最單純'),
      ['GND6', 'GND', 'gnd', '接地'],
      gp(21, 'I²C0 的 SCL'),
      gp(20, 'I²C0 的 SDA'),
      gp(19, 'SPI0 的 TX（MOSI）'),
      gp(18, 'SPI0 的 SCK'),
      ['GND7', 'GND', 'gnd', '接地'],
      gp(17, 'SPI0 的 CSn、UART0 的 RX'),
      gp(16, 'SPI0 的 RX（MISO）、UART0 的 TX'),
    ],
    PICO_ROW_FAR,
    (i) => 40 - i,
  ),
];

export const PICO_PIN_MAP: Record<string, PinDef> = Object.fromEntries(PICO_PINS.map((p) => [p.id, p]));

export const PICO_GND = ['GND1', 'GND2', 'GND3', 'GND4', 'GND5', 'GND6', 'GND7', 'AGND'];
/** 板內相通：所有 GND；VSYS 經蕭特基二極體接到 VBUS（插 USB 時兩者都約 5 V） */
export const PICO_INTERNAL_NETS: string[][] = [PICO_GND, ['VIN', 'VSYS']];
/** 可以 analogRead 的腳 */
export const PICO_ADC = ['GP26', 'GP27', 'GP28'];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const PICO_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  mcu: [24.5, PICO_MID_Y, 7, 7],
  flash: [13.2, 6.4, 5.0, 4.0],
  usb: [2.2, PICO_MID_Y, 5.8, 8.0],
  bootsel: [11.6, 14.4, 4.4, 3.4],
  ledG: [6.4, 4.4, 1.6, 0.8],
  xtal: [18.6, 15.4, 3.2, 2.5],
  reg: [35.4, 13.6, 3.0, 3.0],
  ind: [35.6, 7.2, 3.6, 3.6],
  swd: [48.6, PICO_MID_Y, 2.2, 7.0],
  hdrN: [PICO_PIN_X0 + 9.5 * P, PICO_ROW_NEAR, 50.8, 2.6],
  hdrF: [PICO_PIN_X0 + 9.5 * P, PICO_ROW_FAR, 50.8, 2.6],
};

const fx = (id: string) => px(PICO_FOOTPRINTS[id][0]);
const fz = (id: string) => pz(PICO_FOOTPRINTS[id][1]);

export const picoLesson: BoardLesson = {
  summary:
    'Raspberry Pi Pico 是樹莓派基金會在 2021 年推出的第一塊微控制器板，主角是他們自己設計的 RP2040 晶片：雙核心、264 KB RAM，一塊只要大約 4 美元。最有名的是它的「隨身碟模式」：按住 BOOTSEL 再插上 USB，電腦會多出一顆叫 RPI-RP2 的磁碟，把韌體檔拖進去就燒錄完成，不用裝任何驅動程式。入門最常用 MicroPython，寫 Python 就能控制馬達和感測器。它和 ESP32 一樣是 3.3 V 晶片，腳位不能接 5 V。',
  stats: [
    { k: '時脈', v: '133 MHz' },
    { k: 'FLASH', v: '2 MB' },
    { k: 'RAM', v: '264 KB' },
    { k: 'GPIO', v: '26' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$4' },
  ],
  specs: [
    { k: '微控制器', v: 'RP2040（雙核心 Arm Cortex-M0+），樹莓派自行設計' },
    { k: '時脈', v: '官方標示 133 MHz；2024 年起官方認證可跑到 200 MHz' },
    { k: 'Flash 程式記憶體', v: '2 MB（外接 QSPI flash，RP2040 本身沒有 flash）' },
    { k: 'SRAM', v: '264 KB（分成 6 個記憶庫，兩個核心可以同時存取）' },
    { k: 'GPIO', v: '26 支拉到排針：GP0–GP22 和 GP26–GP28' },
    { k: '類比輸入', v: '3 支 12 位元 ADC（GP26–GP28），MicroPython 的 read_u16() 回傳 0–65535；晶片內還有一個溫度感測器' },
    { k: 'PWM', v: '16 個通道（8 組 × 2），每支 GPIO 都能輸出 PWM' },
    { k: 'PIO', v: '2 組可程式 I/O、共 8 個狀態機，可以自己「做」出 WS2812、VGA 之類的通訊協定' },
    { k: '通訊介面', v: '2 組 UART、2 組 I²C、2 組 SPI，可以分配到很多組不同的腳位' },
    { k: '邏輯電壓', v: '3.3 V（腳位不能承受 5 V）' },
    { k: '供電', v: 'Micro-USB 5 V，或從 VSYS 餵 1.8–5.5 V；板上的升降壓電源晶片穩定輸出 3.3 V' },
    { k: '連接電腦', v: 'RP2040 內建 USB 1.1，不需要額外的 USB 轉序列晶片' },
    { k: '燒錄方式', v: '按住 BOOTSEL 插 USB → 出現 RPI-RP2 磁碟 → 拖進 .uf2 檔' },
    { k: '尺寸', v: '21 × 51 mm，邊緣是半孔（郵票孔），可以直接焊在其他電路板上' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'RP2040 微控制器', quiz: '找出板子的大腦：RP2040 晶片', desc: '正中央那顆 7 mm 見方的黑色晶片，是樹莓派第一次自己設計的微控制器。裡面有兩個 Cortex-M0+ 核心、264 KB RAM、USB 控制器和 8 個 PIO 狀態機。名字也有意思：RP＝Raspberry Pi，2＝雙核心，0＝M0+ 核心，4 代表 RAM 的大小等級，最後的 0 代表晶片裡沒有 flash。', at: [fx('mcu'), 0.08, fz('mcu')], layer: 3 },
    { id: 'flash', num: 2, name: '2 MB QSPI Flash', quiz: '找出存放程式的 flash 記憶體', desc: 'RP2040 本身沒有可以永久保存程式的記憶體，所以旁邊放了這顆 8 支腳的 flash 晶片。你寫的 MicroPython 程式、main.py、韌體都存在這裡；拔掉電源也不會消失。晶片用四條資料線（QSPI）高速讀取，程式可以直接從 flash 執行。', at: [fx('flash'), 0.08, fz('flash')], layer: 2.2 },
    { id: 'usb', num: 3, name: 'Micro-USB 接頭', quiz: '找出接電腦的 USB 接頭', desc: '供電、燒錄、序列埠（REPL）都走這個接頭。它直接接到 RP2040 內建的 USB 控制器，中間沒有 CH340 或 CP2102 這類翻譯晶片，所以不用安裝驅動程式。一樣要用有資料線的 USB 線，只能充電的線電腦會認不到。', at: [fx('usb'), 0.15, fz('usb')], layer: 2 },
    { id: 'bootsel', num: 4, name: 'BOOTSEL 按鈕', quiz: '找出讓 Pico 變成隨身碟的 BOOTSEL 按鈕', desc: '按住它再插上 USB，Pico 會進入燒錄模式，電腦出現一顆叫 RPI-RP2 的磁碟。把 MicroPython 或你編譯好的 .uf2 檔拖進去，Pico 會自動重新開機開始執行。它不是重設鍵；Pico 沒有重設按鈕，要重新開機就把 RUN 腳接到 GND。', at: [fx('bootsel'), 0.1, fz('bootsel')], layer: 2 },
    { id: 'ledG', num: 5, name: '綠色 LED（接 GP25）', quiz: '找出接在 GP25、Blink 會點亮的綠燈', desc: '接在 GP25 的板上 LED，Pico 版 Blink 的主角。GP25 沒有拉到排針上，所以這支腳只能用來控制這顆燈。注意：無線版的 Pico W 把 LED 改接到無線晶片上，程式要寫 Pin("LED")。', at: [fx('ledG'), 0.05, fz('ledG')], layer: 1 },
    { id: 'xtal', num: 6, name: '12 MHz 石英振盪器', quiz: '找出提供時脈的石英振盪器', desc: '這顆小小的金屬殼元件每秒穩定振動 1200 萬次，RP2040 把它倍頻成 125–133 MHz 的系統時脈，也用它產生 USB 需要的精準 48 MHz。USB 通訊對時間很挑剔，所以不能只靠晶片內部比較不準的振盪器。', at: [fx('xtal'), 0.05, fz('xtal')], layer: 1.4 },
    { id: 'reg', num: 7, name: 'RT6150 升降壓電源晶片', quiz: '找出把電池或 USB 電壓變成 3.3 V 的電源晶片', desc: '一般開發板用線性穩壓器，只能「降壓」；Pico 用的是升降壓（buck-boost）切換式電源：輸入 1.8 V 到 5.5 V 都能穩定輸出 3.3 V。所以兩顆三號電池（約 3 V）接到 VSYS 也能讓 Pico 正常工作。', at: [fx('reg'), 0.05, fz('reg')], layer: 1.4 },
    { id: 'ind', num: 8, name: '功率電感', quiz: '找出切換式電源旁邊的方形電感', desc: '切換式電源會用很快的速度開關電流，電感負責把能量暫時存起來再放出去，讓輸出電壓平順。因為一直在開關，3.3 V 上會有一點點漣波雜訊；要精準讀類比值時，可以把 GP23 設成 HIGH，讓電源改用雜訊比較小的模式。', at: [fx('ind'), 0.08, fz('ind')], layer: 1.4 },
    { id: 'swd', num: 9, name: 'SWD 除錯接點', quiz: '找出板子末端用來接除錯器的三個接點', desc: '板子最右端的三個接點是 SWCLK、GND、SWDIO。接上除錯器（例如另一塊 Pico 當 Debug Probe）就能逐行執行 C／C++ 程式、設中斷點、看變數。用 MicroPython 的話平常用不到它。', at: [fx('swd'), 0.02, fz('swd')], layer: 1 },
    { id: 'hdrN', num: 10, name: '排針（第 1–20 腳：GP0…GP15）', quiz: '找出從 GP0 開始、以 GP15 結尾的那一排排針', desc: '從 USB 端開始是第 1 腳 GP0、第 2 腳 GP1、第 3 腳 GND……一直到第 20 腳 GP15。每 5 支就有一支 GND。數位、PWM、I²C、SPI、UART 都能在這排找到。', at: [fx('hdrN'), -0.45, fz('hdrN')], layer: -1.3 },
    { id: 'hdrF', num: 11, name: '排針（第 21–40 腳：電源與 ADC）', quiz: '找出有 VBUS、3V3 和類比腳 GP26–GP28 的那一排排針', desc: '從 USB 端開始是第 40 腳 VBUS、VSYS、GND、3V3_EN、3V3(OUT)、ADC_VREF，接著是類比腳 GP28、AGND、GP27、GP26，再來是 RUN 和 GP22–GP16。電源和類比輸入都集中在這一排。', at: [fx('hdrF'), -0.45, fz('hdrF')], layer: -1.3 },
  ],
  strengths: [
    '拖曳就能燒錄：按住 BOOTSEL 插 USB，把 .uf2 檔拖進 RPI-RP2 磁碟就完成，不用裝驅動',
    '原生支援 MicroPython：插上電腦打開 Thonny，就能一行一行即時試程式（REPL）',
    '雙核心＋264 KB RAM，一塊約 US$4，價錢和 Nano 相容板差不多，效能卻高出許多',
    'PIO 可程式 I/O：用 8 個小狀態機自己做通訊協定，驅動 WS2812 燈條、紅外線、甚至 VGA 都很穩定',
    '每支 GPIO 都能 PWM；升降壓電源讓它用 2 顆電池到 5 V 都能工作',
    '邊緣是半孔設計，做成品時可以直接把 Pico 當模組焊在自己的電路板上',
  ],
  pitfalls: [
    '腳位是 3.3 V，不能直接接 5 V 訊號；HC-SR04 的 ECHO 要先分壓，或換 3.3 V 版模組',
    '「第幾腳」不等於「GP 幾號」：第 20 腳是 GP15，Pin(20) 其實是第 26 腳。接線時看背面印的 GP 名字',
    '只有 GP26、GP27、GP28 三支腳能讀類比值；旋鈕接到其他腳 ADC() 會直接報錯',
    '板上 LED 在 GP25，沒有拉出排針；Pico W 則要寫 Pin("LED")',
    '沒有重設按鈕：要重新開機就拔插 USB，或在 RUN 和 GND 之間接一顆按鈕',
    '原版 Pico 出貨時沒有焊排針（Pico H 才有），要自己焊，或買已焊好的版本',
    '伺服機和馬達不要從 3V3 取電；插著 USB 時可以用 VBUS（5 V），大一點的負載用外接電源並共地',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: 'VBUS 是 USB 進來的 5 V；VSYS 是主電源輸入（1.8–5.5 V），用電池時從這裡餵；3V3(OUT) 輸出 3.3 V 給感測器；ADC_VREF 是類比參考電壓。' },
    { title: '接地', kind: 'gnd', body: '一共 8 支 GND（方形焊墊），每 5 支腳就有一支，接線時找最近的那支就好。AGND 是給類比電路用的接地，雜訊比較小。' },
    { title: '數位腳與 PWM', kind: 'pwm', body: '程式裡寫的數字是 GP 編號：板子背面印 GP15，就寫 Pin(15)。每一支 GPIO 都能輸出 PWM，PWM(Pin(15)).duty_u16() 的範圍是 0–65535。' },
    { title: '類比輸入', kind: 'analog', body: 'GP26、GP27、GP28 分別是 ADC0、ADC1、ADC2。ADC(26).read_u16() 回傳 0–65535，對應 0–3.3 V；晶片實際是 12 位元，MicroPython 幫你放大到 16 位元的範圍。' },
    { title: '通訊匯流排', kind: 'bus', body: 'RP2040 的 UART、I²C、SPI 都能分配到好幾組腳位，例如 I²C0 可以用 GP4／GP5，也可以用 GP20／GP21。官方腳位圖上，同一種顏色標的就是同一組。' },
    { title: '控制腳', kind: 'control', body: 'RUN 接 GND 會重新開機；3V3_EN 接 GND 會關掉 3.3 V 電源。BOOTSEL 按鈕沒有拉到排針。' },
  ],
  code: {
    title: '第一支程式：讓板上 LED 閃爍並讀出晶片溫度',
    lang: 'MICROPYTHON',
    source: `# 先在 Thonny 右下角選「MicroPython (Raspberry Pi Pico)」
from machine import Pin, ADC
import time

led = Pin(25, Pin.OUT)          # 板上綠燈接在 GP25
sensor = ADC(4)                 # 第 5 個 ADC 通道接著晶片內的溫度感測器

while True:
    led.toggle()                # 亮 ↔ 滅
    v = sensor.read_u16() * 3.3 / 65535
    temp = 27 - (v - 0.706) / 0.001721
    print("晶片溫度：", round(temp, 1), "°C")
    time.sleep(0.5)`,
  },
  projects: [
    '循跡自走車：兩顆紅外線感測器接數位腳，用 PWM 控制馬達驅動板',
    'WS2812 彩色燈條機器人眼睛：用 PIO 精準送出燈條要的時序',
    '自製 USB 遊戲手把或巨集鍵盤：RP2040 能直接模擬成 USB 鍵盤、滑鼠',
    '電池供電的溫度記錄器：兩顆三號電池接 VSYS，把資料存在 flash 的檔案裡',
    '換成 Pico W：同樣的腳位多了 Wi-Fi，可以做手機遙控機器人',
  ],
  facts: [
    'RP2040 是樹莓派基金會第一顆自己設計的晶片，2021 年 1 月和 Pico 一起發表，首發價只要 4 美元。',
    '晶片名稱是一組編碼：RP（Raspberry Pi）、2（核心數）、0（Cortex-M0+）、4（RAM 大小等級）、0（內建 flash 等級，0 代表沒有）。',
    '2024 年推出的 Pico 2 換成 RP2350，有 Arm 和 RISC-V 兩種核心可以切換，腳位和尺寸與 Pico 相同。',
    '拖曳燒錄用的 .uf2 格式由微軟為 MakeCode 開發，檔案切成 512 位元組的區塊，剛好符合隨身碟的磁區大小。',
  ],
  quiz: [
    { part: 'mcu', prompt: '找出板子的大腦：RP2040 晶片', hint: '板子正中央那顆方形的黑色晶片。', explain: 'RP2040 是雙核心 Cortex-M0+，樹莓派自行設計。' },
    { part: 'flash', prompt: '你的 main.py 存在哪個零件裡？', hint: 'BOOTSEL 按鈕旁邊、有 8 支腳的小晶片。', explain: 'RP2040 沒有內建 flash，程式存在外接的 2 MB QSPI flash。' },
    { part: 'bootsel', prompt: '想讓 Pico 在電腦上變成 RPI-RP2 磁碟，插 USB 前要按住哪裡？', hint: 'USB 接頭附近那顆白色的按鈕。', explain: 'BOOTSEL 讓 Pico 開機時進入 USB 燒錄模式。' },
    { part: 'ledG', prompt: 'Pin(25) 控制的是哪顆燈？', hint: 'USB 接頭旁邊、靠近第 1 腳的小燈。', explain: '板上 LED 接在 GP25，這支腳沒有拉到排針。' },
    { part: 'usb', prompt: '要把 MicroPython 韌體送進 Pico，線要插在哪裡？', hint: '板子最左端的銀色小接頭。', explain: 'Micro-USB 直接接到 RP2040 內建的 USB 控制器。' },
    { part: 'xtal', prompt: '讓 USB 通訊時間準確的 12 MHz 元件在哪裡？', hint: 'RP2040 左上方、金屬外殼的小方塊。', explain: '石英振盪器提供穩定的 12 MHz，晶片再倍頻成系統時脈和 USB 的 48 MHz。' },
    { part: 'reg', prompt: '用兩顆三號電池也能讓 Pico 工作，靠的是哪個零件？', hint: 'RP2040 右邊、靠遠側的小晶片。', explain: 'RT6150 升降壓電源能把 1.8–5.5 V 都轉成穩定的 3.3 V。' },
    { part: 'ind', prompt: '切換式電源旁邊負責儲存能量的元件在哪裡？', hint: 'RP2040 右邊、靠近你這一側的方塊。', explain: '功率電感讓切換式電源的輸出變平順。' },
    { part: 'swd', prompt: '接除錯器、逐行執行 C 程式要用哪裡？', hint: '板子最右端、離 USB 最遠的三個接點。', explain: 'SWD 介面：SWCLK、GND、SWDIO。' },
    { part: 'hdrF', prompt: '旋鈕要接 GP26 和 3V3，該找哪一排排針？', hint: '離你比較遠、以 VBUS 開頭的那一排。', explain: '電源腳和 ADC 腳 GP26–GP28 都在第 21–40 腳這一排。' },
    { part: 'hdrN', prompt: '外接 LED 要接第 20 腳 GP15，該找哪一排？', hint: '靠近你這一側、從 GP0 開始的那一排。', explain: '第 1–20 腳是 GP0 到 GP15，中間穿插 GND。' },
  ],
};

/** Pico 在工作台上插在麵包板中間：PCB 頂面距台面 = 麵包板 0.85 + 塑膠座 0.25 + PCB 0.1 */
export const PICO_BENCH_LIFT = 1.2;
/**
 * 麵包板溝槽中心到 e／f 列 0.15"（0.381 cm）：Pico 的排針剛好落在 c／h 列，
 * 外側還剩 a、b／i、j 兩列能接線；接線插在最外側的 a／j 列。
 */
export const PICO_BB_GAP = 0.381;
export const PICO_BB_OFFSET = 0.508;

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

export const picoData: BoardData = {
  id: 'pico',
  short: 'Pico',
  summary: BOARDS.find((b) => b.id === 'pico')!,
  lesson: picoLesson,
  w: PICO_W,
  d: PICO_D,
  pins: PICO_PINS,
  internalNets: PICO_INTERNAL_NETS,
  // 3.3 V 板子：3V3 走「3.3 V」那條路，VBUS（id 'VIN'）走「VIN」那條路
  supply: [],
  gnd: PICO_GND,
  analogOnly: [],
  logicV: 3.3,
  ledPin: 'GP25',
  inputOnly: [],
  strapLow: [],
  // USB 是 RP2040 原生的，GP0／GP1 不和 USB 共用
  serialPins: [],
  header: '排針',
  footprints: PICO_FOOTPRINTS,
  mx: px,
  mz: pz,
  tray: {
    mcu: [4.6, -0.4, -0.92],
    hdrF: [4.6, -2.4, 0],
    hdrN: [4.6, 2.6, 0],
    ...smallTray(['flash', 'usb', 'bootsel', 'xtal', 'reg', 'ind', 'ledG', 'swd'], 6.6, -1.3, 1.15, 1.0, 2, -0.92),
  },
  stage: {
    floorY: -0.97,
    pinY: 0.06,
    explodeLift: 1.2,
    views: {
      iso: [4.0, 5.6, 6.4, 0, -0.2, 0.1],
      top: [0, 9.6, 0.01, 0, 0, 0],
      bottom: [0, -9.2, 0.5, 0, 0, 0],
      front: [0, 1.7, 8.8, 0, -0.2, 0],
    },
    asmCam: [2.6, 13.5, 5.4, 2.6, -0.6, 0.2],
  },
  bench: {
    pos: [-4.0, 0, -0.6],
    half: [3.3, 1.95],
    lift: PICO_BENCH_LIFT,
    pin: (p) => [p.x, 0.87, p.z + Math.sign(p.z) * PICO_BB_OFFSET],
  },
};
