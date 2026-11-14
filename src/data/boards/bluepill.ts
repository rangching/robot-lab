import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * STM32 Blue Pill（STM32F103C8T6 最小系統板）。實體約 53 × 22.8 mm。
 * 長邊沿 x 軸：Micro-USB 在左端（-x），4 支 SWD 燒錄針在右端（+x）。
 * 遠側那排（z < 0）從 USB 端開始是 PB12…PB9、5V、GND、3V3；
 * 靠近觀看者那排（z > 0）從 USB 端開始是 GND、GND、3V3、NRST、PB11…PC13、VBAT。
 */
export const BP_W = 5.3;
export const BP_D = 2.28;
export const BP_PCB_T = 0.16;
/** 排針塑膠座厚度與排針伸出長度（公分） */
export const BP_SPACER = 0.25;
export const BP_LEG = 0.6;

/** 板子圖面座標（mm，原點左下角＝USB 那端靠近觀看者的角）→ 3D 座標（cm，原點中心） */
export const bx = (mm: number) => mm / 10 - BP_W / 2;
export const bz = (mm: number) => BP_D / 2 - mm / 10;

const P = 2.54;
export const BP_MID_Y = BP_D * 5;
/** 兩排排針相距 0.6 英吋（15.24 mm），和 Nano 一樣：插上麵包板後每側還剩幾排孔 */
export const BP_ROW_NEAR = BP_MID_Y - 7.62;
export const BP_ROW_FAR = BP_MID_Y + 7.62;
/** 20 支腳置中 */
export const BP_PIN_X0 = (BP_W * 10 - 19 * P) / 2;

function row(ids: [string, string, PinKind, string][], yMm: number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: bx(BP_PIN_X0 + i * P), z: bz(yMm) }));
}

/** 可以承受 5 V 數位訊號的 FT 腳（只限數位輸入；類比腳 PA0–PA7、PB0、PB1 都不是 FT） */
export const BP_FT = ['PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA15', 'PB3', 'PB4', 'PB6', 'PB7', 'PB8', 'PB9', 'PB10', 'PB11', 'PB12', 'PB13', 'PB14', 'PB15'];

/**
 * 腳位 id 就是 STM32 的腳位名稱，和程式裡寫的一樣：digitalWrite(PC13, LOW) 就是 PC13。
 * 板子上的絲印省略了 P，印成 B12、A8、C13。
 */
export const BP_PINS: PinDef[] = [
  ...row(
    [
      ['PB12', 'B12', 'digital', 'PB12：數位腳；SPI2 的 NSS；FT（可承受 5 V 數位訊號）'],
      ['PB13', 'B13', 'bus', 'PB13：SPI2 的 SCK；FT'],
      ['PB14', 'B14', 'bus', 'PB14：SPI2 的 MISO；FT'],
      ['PB15', 'B15', 'bus', 'PB15：SPI2 的 MOSI；FT'],
      ['PA8', 'A8', 'pwm', 'PA8：數位＋PWM（TIM1 第 1 通道）；FT'],
      ['PA9', 'A9', 'bus', 'PA9：USART1 的 TX，序列埠燒錄（BOOT0＝1）時用它；也能 PWM；FT'],
      ['PA10', 'A10', 'bus', 'PA10：USART1 的 RX，序列埠燒錄時用它；也能 PWM；FT'],
      ['PA11', 'A11', 'bus', 'PA11：USB D−，已經接到板上的 USB 接頭，盡量別接別的東西；FT'],
      ['PA12', 'A12', 'bus', 'PA12：USB D+，板上的 R10 上拉電阻就接在這裡；FT'],
      ['PA15', 'A15', 'digital', 'PA15：數位腳（原本是 JTAG 的 JTDI）；FT'],
      ['PB3', 'B3', 'digital', 'PB3：數位腳（原本是 JTAG 的 JTDO）；FT'],
      ['PB4', 'B4', 'digital', 'PB4：數位腳（原本是 JTAG 的 NJTRST）；FT'],
      ['PB5', 'B5', 'digital', 'PB5：數位腳；I²C1 的 SMBA。注意：它不是 FT 腳，不能接 5 V'],
      ['PB6', 'B6', 'bus', 'PB6：I²C1 的 SCL；也能 PWM（TIM4 第 1 通道）；FT'],
      ['PB7', 'B7', 'bus', 'PB7：I²C1 的 SDA；也能 PWM（TIM4 第 2 通道）；FT'],
      ['PB8', 'B8', 'pwm', 'PB8：數位＋PWM（TIM4 第 3 通道）；CAN 的 RX；FT'],
      ['PB9', 'B9', 'pwm', 'PB9：數位＋PWM（TIM4 第 4 通道）；CAN 的 TX；FT'],
      ['5V', '5V', 'power', '直接連到 USB 的 5 V；也可以從這裡餵 5 V 給整塊板子（經板上穩壓器降成 3.3 V）'],
      ['GND1', 'G', 'gnd', '接地，和其他 GND 都相通'],
      ['3V3b', '3.3', 'power', '3.3 V，和另一排的 3.3 是同一條電源'],
    ],
    BP_ROW_FAR,
  ),
  ...row(
    [
      ['GND2', 'G', 'gnd', '接地'],
      ['GND3', 'G', 'gnd', '接地'],
      ['3V3', '3.3', 'power', '3.3 V 輸出（板上穩壓器供應），整塊板子的邏輯電壓；給感測器用'],
      ['NRST', 'R', 'control', '重設腳：拉到 GND 就重新開機，和 RESET 按鈕是同一條線'],
      ['PB11', 'B11', 'bus', 'PB11：I²C2 的 SDA；USART3 的 RX；FT'],
      ['PB10', 'B10', 'bus', 'PB10：I²C2 的 SCL；USART3 的 TX；FT'],
      ['PB1', 'B1', 'analog', 'PB1：ADC 第 9 通道；也能 PWM（TIM3 第 4 通道）；不是 FT'],
      ['PB0', 'B0', 'analog', 'PB0：ADC 第 8 通道；也能 PWM（TIM3 第 3 通道）；不是 FT'],
      ['PA7', 'A7', 'analog', 'PA7：ADC 第 7 通道；SPI1 的 MOSI；也能 PWM'],
      ['PA6', 'A6', 'analog', 'PA6：ADC 第 6 通道；SPI1 的 MISO；也能 PWM'],
      ['PA5', 'A5', 'analog', 'PA5：ADC 第 5 通道；SPI1 的 SCK'],
      ['PA4', 'A4', 'analog', 'PA4：ADC 第 4 通道；SPI1 的 NSS'],
      ['PA3', 'A3', 'analog', 'PA3：ADC 第 3 通道；USART2 的 RX；也能 PWM'],
      ['PA2', 'A2', 'analog', 'PA2：ADC 第 2 通道；USART2 的 TX；也能 PWM'],
      ['PA1', 'A1', 'analog', 'PA1：ADC 第 1 通道；也能 PWM（TIM2 第 2 通道）'],
      ['PA0', 'A0', 'analog', 'PA0：ADC 第 0 通道，讀旋鈕最方便；也能 PWM；不是 FT，最多 3.3 V'],
      ['PC15', 'C15', 'digital', 'PC15：接著板上的 32.768 kHz 石英，平常不建議拿來用'],
      ['PC14', 'C14', 'digital', 'PC14：接著板上的 32.768 kHz 石英，平常不建議拿來用'],
      ['PC13', 'C13', 'digital', 'PC13：板上 LED 接在這裡，寫 LOW 才會亮；只能吸入約 3 mA，別拿來直接推外接元件'],
      ['VBAT', 'VB', 'power', '備用電池輸入：接一顆鈕扣電池，斷電時即時時鐘（RTC）還能繼續走'],
    ],
    BP_ROW_NEAR,
  ),
];

export const BP_INTERNAL_NETS: string[][] = [
  ['GND1', 'GND2', 'GND3'],
  ['3V3', '3V3b'],
];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const BP_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  mcu: [34.0, BP_MID_Y, 10.4, 10.4],
  usb: [2.8, BP_MID_Y, 5.6, 7.8],
  r10: [8.2, 9.4, 2.4, 1.6],
  reg: [8.6, 13.6, 3.2, 2.2],
  xtal: [15.4, 10.6, 9.6, 4.4],
  boot: [24.0, 14.6, 7.8, 5.2],
  reset: [24.0, 8.0, 5.2, 3.2],
  xtal32: [42.6, 9.0, 6.4, 2.2],
  ledPwr: [44.6, 14.6, 2.0, 1.25],
  led13: [47.8, 14.6, 2.0, 1.25],
  swd: [51.0, BP_MID_Y, 4.4, 10.4],
  hdrF: [BP_W * 5, BP_ROW_FAR, 50.8, 2.6],
  hdrN: [BP_W * 5, BP_ROW_NEAR, 50.8, 2.6],
};

const fx = (id: string) => bx(BP_FOOTPRINTS[id][0]);
const fz = (id: string) => bz(BP_FOOTPRINTS[id][1]);

export const bluepillLesson: BoardLesson = {
  summary:
    'Blue Pill 是一片藍色、比口香糖再長一點的小板子，中間斜放著一顆 STM32F103C8T6：32 位元的 ARM Cortex-M3 核心、72 MHz，運算力大約是 Uno 的 10 倍，價格卻只要兩三美元。它沒有 Wi-Fi，但計時器、ADC、通訊介面又多又快，是從 Arduino 跨進「真正的工業級微控制器」最便宜的一步。要特別記住兩件事：它是 3.3 V 的晶片；板上 LED 接在 PC13，而且寫 LOW 才會亮。',
  stats: [
    { k: '時脈', v: '72 MHz' },
    { k: 'FLASH', v: '64 KB' },
    { k: 'RAM', v: '20 KB' },
    { k: 'GPIO', v: '32' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$2–3' },
  ],
  specs: [
    { k: '微控制器', v: 'STM32F103C8T6（ARM Cortex-M3，32 位元），LQFP-48 封裝' },
    { k: '時脈', v: '72 MHz（板上 8 MHz 石英，經 PLL 倍頻 9 倍）' },
    { k: 'Flash 程式記憶體', v: '64 KB（不少晶片實際上能用到 128 KB）' },
    { k: 'SRAM', v: '20 KB' },
    { k: 'GPIO', v: '拉出 32 支（PA0–PA15、PB0–PB15、PC13–PC15，扣掉 SWD 用的 PA13、PA14 和 BOOT1 用的 PB2）' },
    { k: '類比輸入', v: '10 支 12 位元 ADC（PA0–PA7、PB0、PB1），0–3.3 V 對應 0–4095' },
    { k: 'PWM', v: '4 個計時器（TIM1–TIM4），大約 15 支腳能輸出 PWM' },
    { k: '5 V 容忍', v: '標 FT 的腳（PA8–PA15、PB3、PB4、PB6–PB15）能承受 5 V 的數位輸入；類比腳不行' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '供電', v: 'Micro-USB 5 V、5V 腳或 3.3 腳；板上 3.3 V 穩壓器（印著 662K）' },
    { k: '單腳電流', v: '一般腳建議 8 mA 以內（上限 25 mA）；PC13–PC15 只能吸入約 3 mA' },
    { k: '通訊介面', v: '3 組 USART、2 組 I²C、2 組 SPI、1 組 CAN、1 組全速 USB' },
    { k: '燒錄方式', v: 'SWD（ST-Link）、序列埠（USB 轉 TTL 接 PA9／PA10，BOOT0 跳到 1），或先燒 USB bootloader' },
    { k: '尺寸', v: '約 22.8 × 53 mm' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'STM32F103C8T6 微控制器', quiz: '找出板子的大腦：斜放的 STM32 晶片', desc: '板子正中央那顆斜放 45° 的方形晶片，四邊各有 12 支細腳，總共 48 支。裡面是 ARM Cortex-M3 核心、64 KB flash、20 KB RAM，還有 ADC、計時器和各種通訊介面。斜著放是為了讓四邊的腳都能用最短的走線連到兩排排針。', at: [fx('mcu'), 0.06, fz('mcu')], layer: 3 },
    { id: 'usb', num: 2, name: 'Micro-USB 接頭', quiz: '找出接電腦的 USB 接頭', desc: '供電一定靠它；但剛買來的 Blue Pill 裡面沒有 USB bootloader，所以一開始不能像 Arduino 那樣直接用 USB 上傳程式，要先用 ST-Link 或序列埠燒錄。USB 的兩條資料線接到 PA11、PA12。', at: [fx('usb'), 0.15, fz('usb')], layer: 2 },
    { id: 'r10', num: 3, name: 'R10：USB 上拉電阻', quiz: '找出那顆有名的「放錯值」電阻 R10', desc: 'USB 規格要求 D+（PA12）用 1.5 kΩ 拉到 3.3 V，電腦才知道有全速裝置插上來。很多 Blue Pill 卻焊了 10 kΩ，有些電腦因此認不到板子。解法是在 PA12 和 3.3 之間再並聯一顆 1.8 kΩ，或把 R10 換掉。', at: [fx('r10'), 0.03, fz('r10')], layer: 1.4 },
    { id: 'reg', num: 4, name: '3.3 V 穩壓器（662K）', quiz: '找出把 5 V 降成 3.3 V 的穩壓器', desc: '只有米粒大的 SOT-23 小元件，上面印著 662K。它把 USB 的 5 V 降成晶片要的 3.3 V，最多只能提供大約 100–300 mA，所以別從 3.3 腳拉太多電給馬達或大顆模組。', at: [fx('reg'), 0.05, fz('reg')], layer: 1.4 },
    { id: 'xtal', num: 5, name: '8 MHz 石英振盪器', quiz: '找出讓晶片跑到 72 MHz 的 8 MHz 石英', desc: '銀色橢圓形的金屬殼。它提供穩定的 8 MHz 時脈，晶片內部的 PLL 再把它乘 9 倍變成 72 MHz。USB 通訊需要很準的時脈，所以靠這顆石英而不是內建的 RC 振盪器。', at: [fx('xtal'), 0.15, fz('xtal')], layer: 2 },
    { id: 'boot', num: 6, name: 'BOOT0／BOOT1 跳線', quiz: '找出決定開機模式的兩組黃色跳線帽', desc: '兩排三針加上兩顆跳線帽。BOOT0 平常在 0：開機執行你燒進 flash 的程式；跳到 1 再按 RESET，晶片就進入內建的序列埠燒錄模式，等 PA9／PA10 送程式進來。燒完記得跳回 0，不然下次開機又停在燒錄模式。', at: [fx('boot'), 0.3, fz('boot')], layer: 2.4 },
    { id: 'reset', num: 7, name: 'RESET 按鈕', quiz: '找出讓 STM32 重新開機的 RESET 按鈕', desc: '按一下就把 NRST 拉到 GND，晶片重新開機、程式從頭跑。切換 BOOT0 跳線之後一定要按它，新的開機模式才會生效。', at: [fx('reset'), 0.1, fz('reset')], layer: 2 },
    { id: 'xtal32', num: 8, name: '32.768 kHz 石英', quiz: '找出給即時時鐘用的 32.768 kHz 小石英', desc: '細細的圓柱形小石英，接在 PC14、PC15。32768 剛好是 2 的 15 次方，計數器數到這裡就是整整一秒，晶片內建的即時時鐘（RTC）靠它走時；配合 VBAT 的鈕扣電池，斷電也不會忘記時間。', at: [fx('xtal32'), 0.1, fz('xtal32')], layer: 1.6 },
    { id: 'ledPwr', num: 9, name: '紅色電源燈', quiz: '找出通電就亮的紅色電源燈', desc: '3.3 V 有電就會亮。插上 USB 卻沒亮，先換一條線，再檢查 3.3 或 5V 腳有沒有被短路到 GND。', at: [fx('ledPwr'), 0.05, fz('ledPwr')], layer: 1 },
    { id: 'led13', num: 10, name: 'PC13 LED（低電位點亮）', quiz: '找出接在 PC13、寫 LOW 才會亮的 LED', desc: '這顆 LED 的一端接 3.3 V、另一端經電阻接 PC13。所以 PC13 輸出 LOW 時電流才流得過去，燈才會亮——和 Arduino 的 L 燈剛好相反。PC13 的推力很弱，它只適合點這種小燈。', at: [fx('led13'), 0.05, fz('led13')], layer: 1 },
    { id: 'swd', num: 11, name: 'SWD 燒錄針（3.3／IO／CLK／GND）', quiz: '找出接 ST-Link 燒錄器的 4 支 SWD 針', desc: '板子末端那 4 支彎腳排針，從上到下是 3.3、SWDIO（PA13）、SWCLK（PA14）、GND。接上 ST-Link 燒錄器就能直接寫入程式，還能設中斷點、一行一行單步除錯，這是 Arduino Uno 做不到的。', at: [fx('swd'), 0.15, fz('swd')], layer: 2 },
    { id: 'hdrF', num: 12, name: '排針（B12…B9、5V、G、3.3）', quiz: '找出有 5V 腳和大部分 5 V 容忍腳的那一排排針', desc: '從 USB 端開始是 B12–B15、A8–A12、A15、B3–B9，最後是 5V、G、3.3。這排除了 B5 以外都是 FT 腳，可以接 5 V 的數位訊號；I²C1（B6、B7）和 SPI2（B13–B15）也在這排。', at: [fx('hdrF'), -0.45, fz('hdrF')], layer: -1.3 },
    { id: 'hdrN', num: 13, name: '排針（G、G、3.3、R…C13、VB）', quiz: '找出有類比輸入 A0–A7 的那一排排針', desc: '從 USB 端開始是 G、G、3.3、R（重設），接著 B11、B10、B1、B0、A7–A0，最後是 C15、C14、C13 和 VB。10 支 ADC 腳全部集中在這一排，但它們都不能接 5 V。', at: [fx('hdrN'), -0.45, fz('hdrN')], layer: -1.3 },
  ],
  strengths: [
    '32 位元 ARM Cortex-M3、72 MHz：同樣的運算比 Uno 快 10 倍以上，PID 控制、濾波都跑得動',
    '10 支 12 位元 ADC（0–4095），比 Uno 的 10 位元細 4 倍，讀感測器更精準',
    '4 個計時器、約 15 支 PWM 腳，控制多顆馬達和伺服機很從容',
    '大部分數位腳是 5 V 容忍的 FT 腳，接 5 V 的感測器訊號不必另外分壓',
    '用 ST-Link 可以設中斷點、單步除錯；也能用 Arduino IDE、STM32CubeIDE 或 PlatformIO 寫程式',
    '一片只要兩三美元，壞了也不心疼，適合放進機器人裡當專職的馬達控制器',
  ],
  pitfalls: [
    '板上 LED 在 PC13，而且是低電位點亮：digitalWrite(PC13, LOW) 才會亮',
    '剛買來不能直接用 USB 上傳：要用 ST-Link（SWD），或用 USB 轉 TTL 接 PA9／PA10、把 BOOT0 跳到 1 再按 RESET',
    '腳位是 3.3 V；只有標 FT 的數位腳能接 5 V 訊號，類比腳 PA0–PA7、PB0、PB1 和 PB5 接 5 V 會燒壞',
    'PC13–PC15 只能吸入約 3 mA，不要拿它們直接推 LED 以外的負載',
    'R10 常常焊錯成 10 kΩ，有些電腦認不到 USB；在 PA12 和 3.3 之間並一顆 1.8 kΩ 就好',
    '市面上不少「Blue Pill」用的是相容晶片（例如 CS32F103），ST-Link 燒錄時會報 ID 不符，要在設定裡放寬檢查',
    'Arduino 預設 analogRead() 只給 10 位元，要寫 analogReadResolution(12) 才會回傳 0–4095',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '5V 直接連 USB 的 5 V；3.3 是穩壓後的 3.3 V，兩排各有一支，彼此相通。VB 接鈕扣電池，讓斷電時 RTC 繼續走。三支 G 都相通。' },
    { title: '腳位命名', kind: 'digital', body: 'STM32 的腳分成 A、B、C 三組（埠），每組最多 16 支，程式裡直接寫 PA8、PB12、PC13。板子絲印省掉了 P，只印 A8、B12、C13。' },
    { title: 'PWM 腳', kind: 'pwm', body: '有計時器通道的腳才能 analogWrite()：PA0–PA3、PA6–PA10、PB0、PB1、PB6–PB9 最常用。STM32duino 預設 1 kHz、8 位元，和 Arduino 寫法一樣。' },
    { title: '類比輸入', kind: 'analog', body: 'PA0–PA7、PB0、PB1 共 10 支，接到兩顆 12 位元 ADC。最多只能進 3.3 V，而且它們都不是 FT 腳。' },
    { title: '通訊匯流排', kind: 'bus', body: 'USART1 在 PA9／PA10（也是序列埠燒錄用的腳）；I²C1 在 PB6／PB7、I²C2 在 PB10／PB11；SPI1 在 PA5–PA7、SPI2 在 PB13–PB15；USB 在 PA11／PA12。' },
    { title: '控制腳', kind: 'control', body: 'R（NRST）拉到 GND 就重新開機。BOOT0 跳線決定開機時要執行你的程式（0），還是進入序列埠燒錄模式（1）。' },
  ],
  code: {
    title: '第一支程式：PC13 呼吸燈',
    lang: 'ARDUINO C++',
    source: `// 上傳前：在「開發板管理員」安裝 STM32 MCU based boards（STMicroelectronics），
// 開發板選 Generic STM32F1 series，Board part number 選 BluePill F103C8，
// Upload method 選 STM32CubeProgrammer (SWD)，再接上 ST-Link。

void setup() {
  pinMode(PC13, OUTPUT);
  Serial.begin(115200);          // 預設走 USART1：PA9 (TX)、PA10 (RX)
}

void loop() {
  // PC13 的 LED 是「低電位點亮」：亮度要反過來算
  for (int i = 0; i < 20; i++) {
    int on = i;                  // 每個週期亮 i 毫秒
    for (int k = 0; k < 5; k++) {
      digitalWrite(PC13, LOW);   // LOW → 亮
      delay(on);
      digitalWrite(PC13, HIGH);  // HIGH → 滅
      delay(20 - on);
    }
  }
  Serial.println("呼吸一次");
}`,
  },
  projects: [
    '自平衡機器人：72 MHz 的運算力足夠每秒跑上千次姿態濾波和 PID',
    '四輪馬達控制器：用 4 個計時器同時產生 PWM，再用編碼器模式數輪子轉了幾圈',
    'CAN 匯流排小車：多塊 Blue Pill 用 CAN 串起來，各自管一組感測器或馬達',
    'USB 遊戲手把：用內建的 USB 介面，讓電腦把它當成鍵盤或搖桿',
    '機器人的「小腦」：Raspberry Pi 負責思考，Blue Pill 透過序列埠接收指令、即時控制馬達',
  ],
  facts: [
    '「Blue Pill」不是官方名字：這塊沒有品牌的中國製最小系統板因為是藍色、又長得像一顆膠囊，被社群取了這個外號。後來還出現了黑色的「Black Pill」。',
    '型號 STM32F103C8T6 每一段都有意思：F1 是主流系列、03 是性能線、C 代表 48 支腳、8 代表 64 KB flash、T 是 LQFP 封裝、6 代表工作溫度 −40～85 °C。',
    '很多標示 64 KB 的 C8 晶片，其實和 128 KB 的 CB 是同一片矽晶，只是出廠只保證前 64 KB，所以常常可以寫入 128 KB。',
    'STM32 的每支腳都能透過「重新對應（remap）」換到別的功能，同一個 USART 可以出現在不同的腳上，這也是它比 AVR 靈活的地方。',
  ],
  quiz: [
    { part: 'mcu', prompt: '找出板子的大腦：STM32F103C8T6', hint: '板子正中央，斜放 45° 的那顆方形晶片。', explain: '斜放的 LQFP-48 晶片，裡面是 72 MHz 的 ARM Cortex-M3 核心。' },
    { part: 'led13', prompt: '寫 digitalWrite(PC13, LOW) 會讓哪一顆燈亮起來？', hint: '靠近 SWD 那端、離 USB 最遠的那顆小燈。', explain: 'PC13 的 LED 是低電位點亮：一端接 3.3 V，PC13 拉低時電流才流得過。' },
    { part: 'boot', prompt: '想用序列埠燒錄，要先調整哪裡？', hint: '晶片和 USB 中間、戴著兩顆黃色跳線帽的排針。', explain: 'BOOT0 跳到 1 再按 RESET，晶片就會等 PA9／PA10 送程式進來。' },
    { part: 'swd', prompt: 'ST-Link 燒錄器要接在哪裡？', hint: '板子最右端、朝外伸出的 4 支彎腳排針。', explain: 'SWD 只要 3.3、SWDIO、SWCLK、GND 四條線，還能單步除錯。' },
    { part: 'r10', prompt: '電腦認不到 Blue Pill 的 USB，常常是哪顆電阻惹的禍？', hint: 'USB 接頭右邊、靠近你這一側的一顆小電阻。', explain: 'R10 應該是 1.5 kΩ，很多板子卻焊了 10 kΩ。' },
    { part: 'xtal', prompt: '讓晶片跑到 72 MHz 的時脈從哪裡來？', hint: 'USB 右邊、銀色橢圓形的金屬殼。', explain: '8 MHz 石英經過 PLL 乘 9 倍，就是 72 MHz。' },
    { part: 'xtal32', prompt: '即時時鐘（RTC）靠哪顆零件走時？', hint: '晶片右下方、細細的小圓柱。', explain: '32.768 kHz＝2¹⁵ Hz，數 32768 下剛好一秒。' },
    { part: 'reset', prompt: '切換完 BOOT0 跳線之後要按哪顆按鈕，新設定才會生效？', hint: '跳線帽下方、靠近你這一側的小按鈕。', explain: 'RESET 讓晶片重新開機，開機時才會讀 BOOT0 的狀態。' },
    { part: 'reg', prompt: '把 USB 的 5 V 降成 3.3 V 的零件在哪裡？', hint: 'USB 右邊、靠遠側的一顆米粒大的黑色元件，印著 662K。', explain: 'SOT-23 的小穩壓器，電流不大，別從 3.3 拉太多電。' },
    { part: 'hdrN', prompt: '旋鈕要接 PA0 讀類比電壓，該找哪一排排針？', hint: '靠近你這一側、以 G、G、3.3 開頭的那一排。', explain: '10 支 ADC 腳（A0–A7、B0、B1）都在這一排。' },
    { part: 'hdrF', prompt: '要從板子拿 5 V 給超音波模組，該找哪一排？', hint: '離你比較遠、以 B12 開頭的那一排，5V 在最右邊。', explain: '5V、G、3.3 在這排的最末端；這排大部分是 5 V 容忍的 FT 腳。' },
  ],
};

/** Blue Pill 在工作台上插在麵包板中間：PCB 頂面距台面 = 麵包板 0.85 + 塑膠座 0.25 + PCB 0.16 */
export const BP_BENCH_LIFT = 1.26;
/** 接線插在排針外側第二個孔（板子邊緣蓋住了第一個孔；同一直排電氣相通） */
export const BP_BB_OFFSET = 0.508;
/** 20 支腳是偶數，排針中心落在兩孔之間：麵包板往 +x 挪半格對齊 */
export const BP_BB_SHIFT = 0.127;

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

export const bluepillData: BoardData = {
  id: 'bluepill',
  short: 'Blue Pill',
  summary: BOARDS.find((b) => b.id === 'bluepill')!,
  lesson: bluepillLesson,
  w: BP_W,
  d: BP_D,
  pins: BP_PINS,
  internalNets: BP_INTERNAL_NETS,
  supply: ['5V'],
  gnd: ['GND1', 'GND2', 'GND3'],
  analogOnly: [],
  logicV: 3.3,
  ledPin: 'PC13',
  ledActiveLow: true,
  tolerant5v: BP_FT,
  serialPins: ['PA11', 'PA12'],
  header: '排針',
  footprints: BP_FOOTPRINTS,
  mx: bx,
  mz: bz,
  tray: {
    hdrF: [5.6, -2.45, 0],
    hdrN: [5.6, 2.55, 0],
    mcu: [4.4, -0.5, -0.98],
    ...smallTray(['usb', 'xtal', 'r10', 'reg', 'boot', 'reset', 'xtal32', 'ledPwr', 'led13', 'swd'], 5.9, -1.0, 1.2, 1.05, 4, -0.98),
  },
  stage: {
    floorY: -1.03,
    pinY: 0.06,
    explodeLift: 1.2,
    views: {
      iso: [4.2, 5.8, 6.8, 0, -0.2, 0.1],
      top: [0, 10.0, 0.01, 0, 0, 0],
      bottom: [0, -9.5, 0.5, 0, 0, 0],
      front: [0, 1.7, 9.0, 0, -0.2, 0],
    },
    asmCam: [3.4, 15.0, 5.8, 3.4, -0.6, 0.2],
  },
  bench: {
    pos: [-4.0, 0, -0.6],
    half: [3.45, 1.95],
    lift: BP_BENCH_LIFT,
    pin: (p) => [p.x, 0.87, p.z + Math.sign(p.z) * BP_BB_OFFSET],
  },
};
