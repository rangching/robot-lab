import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * BBC micro:bit V2：51.6 × 42 mm 的教育板，正面是 5×5 LED、按鈕 A／B、觸控 logo，下緣是金手指邊緣連接器。
 * 腳位與功能查證自官方 tech.microbit.org（edge-connector、schematic、power-supply 三頁）；
 * 背面零件位置、PCB 厚度、LED 間距是依照片估的教學用近似值。
 *
 * 座標：金手指（邊緣連接器）朝向觀看者（+z），logo 在遠側。
 * 板子圖面座標 mm，原點在左下角（從正面看），y 往 logo 方向增加。
 */
export const MB_W = 5.16;
export const MB_D = 4.2;
/** PCB 厚度（估計） */
export const MB_PCB_T = 0.12;

export const bx = (mm: number) => mm / 10 - MB_W / 2;
export const bz = (mm: number) => MB_D / 2 - mm / 10;

/** 邊緣連接器：每面 40 個 1.27 mm 間距的接點，5 個大圓環各佔 4 格 */
export const EDGE_PITCH = 1.27;
export const EDGE_X0 = (MB_W * 10 - 40 * EDGE_PITCH) / 2;
/** 圓環孔中心距板邊、窄條接點中心距板邊（mm） */
export const RING_Y = 4.6;
export const STRIP_Y = 2.0;
export const RING_HOLE_R = 2.0;

type Slot = { id: string; ring?: boolean; guard?: boolean };
/** 由左到右（從正面看）的 40 格；3V、GND 圓環兩側各有一條同電位的窄條 */
export const EDGE_SLOTS: Slot[] = [
  { id: 'P3' },
  ...Array(4).fill({ id: 'P0', ring: true }),
  { id: 'P4' }, { id: 'P5' }, { id: 'P6' }, { id: 'P7' },
  ...Array(4).fill({ id: 'P1', ring: true }),
  { id: 'P8' }, { id: 'P9' }, { id: 'P10' }, { id: 'P11' }, { id: 'P12' },
  ...Array(4).fill({ id: 'P2', ring: true }),
  { id: 'P13' }, { id: 'P14' }, { id: 'P15' }, { id: 'P16' },
  { id: '3V3', guard: true }, ...Array(4).fill({ id: '3V3', ring: true }), { id: '3V3', guard: true },
  { id: 'P19' }, { id: 'P20' },
  { id: 'GND', guard: true }, ...Array(4).fill({ id: 'GND', ring: true }), { id: 'GND', guard: true },
];
export const slotX = (i: number) => EDGE_X0 + EDGE_PITCH * (i + 0.5);
/** 某支腳在邊緣連接器上的中心 x（mm）；圓環取 4 格的中點 */
export function edgeX(id: string, ring: boolean) {
  const idx = EDGE_SLOTS.map((s, i) => [s, i] as const).filter(([s]) => s.id === id && !!s.ring === ring && !s.guard).map(([, i]) => i);
  return idx.reduce((a, i) => a + slotX(i), 0) / idx.length;
}
export const RINGS = ['P0', 'P1', 'P2', '3V3', 'GND'];

type Row = [id: string, label: string, kind: PinKind, desc: string];
const PINS: Row[] = [
  ['P0', '0', 'analog', '大圓環 0：數位、類比（0–1023）、PWM、觸控都可以。鱷魚夾最常夾這裡；V2 的 music 預設也會從 P0 送出聲音'],
  ['P1', '1', 'analog', '大圓環 1：數位、類比、PWM、觸控，功能和 P0 一樣'],
  ['P2', '2', 'analog', '大圓環 2：數位、類比、PWM、觸控，功能和 P0 一樣'],
  ['3V3', '3V', 'power', '大圓環 3V：3.3 V 輸出，給外接零件用。V2 留給邊緣連接器的電流約 190 mA，馬達、伺服機要另外供電'],
  ['GND', 'GND', 'gnd', '大圓環 GND：接地，外接電路一定要接回這裡'],
  ['P3', '3', 'analog', 'P3：和 LED 第 3 行（column）共用；要當 GPIO 先 display.off()，不然畫面會亂、讀值也會亂'],
  ['P4', '4', 'analog', 'P4：和 LED 第 1 行共用；要用先 display.off()'],
  ['P5', '5', 'digital', 'P5：板上按鈕 A，按下＝接地。外接電路別接在這裡，會和按鈕打架'],
  ['P6', '6', 'pwm', 'P6：和 LED 第 4 行共用；要用先 display.off()'],
  ['P7', '7', 'pwm', 'P7：和 LED 第 2 行共用；要用先 display.off()'],
  ['P8', '8', 'pwm', 'P8：沒有和板上零件共用的一般數位腳（V2 的 NFC 功能預設關閉），外接數位零件的首選'],
  ['P9', '9', 'pwm', 'P9：一般數位腳；V2 不再和 LED 共用，但接到 NFC 天線的預留功能，使用前不必特別設定'],
  ['P10', '10', 'analog', 'P10：和 LED 第 5 行共用，也能讀類比；要用先 display.off()'],
  ['P11', '11', 'digital', 'P11：板上按鈕 B，按下＝接地。外接電路別接在這裡'],
  ['P12', '12', 'nc', 'P12：官方保留給無障礙（accessibility）功能，建議不要使用'],
  ['P13', '13', 'bus', 'P13：SPI 的 SCK（時脈），不用 SPI 時也是一般數位腳'],
  ['P14', '14', 'bus', 'P14：SPI 的 MISO，不用 SPI 時也是一般數位腳'],
  ['P15', '15', 'bus', 'P15：SPI 的 MOSI，不用 SPI 時也是一般數位腳'],
  ['P16', '16', 'pwm', 'P16：一般數位腳＋PWM，常拿來接 NeoPixel 燈條或伺服機訊號'],
  ['P19', '19', 'bus', 'P19：外接 I²C 的 SCL，板上已有 4.7 kΩ 上拉。V2 的加速度計走另一條內部 I²C，不會互相干擾'],
  ['P20', '20', 'bus', 'P20：外接 I²C 的 SDA，板上已有 4.7 kΩ 上拉'],
];

export const MB_PINS: PinDef[] = PINS.map(([id, label, kind, desc]) => {
  const ring = RINGS.includes(id);
  return { id, label, kind, desc, x: bx(edgeX(id, ring)), z: bz(ring ? RING_Y : STRIP_Y) };
});

/** 5×5 LED 矩陣：中心與間距（mm） */
export const MATRIX_C: [number, number] = [MB_W * 5, 22.5];
export const MATRIX_PITCH = 4.4;
/** 第 x 行、第 y 列（y = 0 在最上面＝靠 logo）的 LED 中心（mm） */
export const ledMm = (x: number, y: number): [number, number] => [MATRIX_C[0] + (x - 2) * MATRIX_PITCH, MATRIX_C[1] + (2 - y) * MATRIX_PITCH];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const MB_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  matrix: [MATRIX_C[0], MATRIX_C[1], 21, 21],
  btnA: [6.2, 22.5, 6, 6],
  btnB: [MB_W * 10 - 6.2, 22.5, 6, 6],
  logo: [MB_W * 5, 37, 9, 5],
  micLed: [31.6, 37, 1.6, 1],
  edge: [MB_W * 5, 4, 50.8, 8],
  mcu: [37.5, 25, 7, 7],
  iface: [14, 27, 5, 5],
  motion: [12.5, 17, 2, 2],
  speaker: [MB_W * 5, 24, 11, 11],
  mic: [31.6, 35.5, 3.5, 2.6],
  usb: [24, 39, 8, 5.5],
  battery: [13.5, 38.5, 8, 6],
  reset: [33, 39.5, 5, 3.5],
  antenna: [46, 36, 8, 8],
  reg: [18.5, 33, 3, 3],
  leds: [28.6, 35.8, 2, 1.2],
};

const fx = (id: string) => bx(MB_FOOTPRINTS[id][0]);
const fz = (id: string) => bz(MB_FOOTPRINTS[id][1]);

export const microbitLesson: BoardLesson = {
  summary:
    'micro:bit 是英國 BBC 為了讓每個中學生都能寫程式而做的口袋電腦，臺灣的中小學資訊課也很常用。它和前面的板子最大的不同是：不用接線就能玩。正面有 25 顆 LED 排成的小螢幕、兩顆按鈕和一個會感應手指的 logo；背面有加速度計、指南針、喇叭、麥克風，還有可以和另一塊 micro:bit 互傳訊息的無線電。想接外部零件時，用鱷魚夾夾住下緣的五個大圓環就好，不用麵包板也不用焊接。程式可以用積木（MakeCode）或 MicroPython 寫，這裡用 MicroPython，從 Pico 學到的 Python 可以直接用上。',
  stats: [
    { k: '時脈', v: '64 MHz' },
    { k: 'FLASH', v: '512 KB' },
    { k: 'RAM', v: '128 KB' },
    { k: '尺寸', v: '5.2 × 4.2 cm' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$20' },
  ],
  specs: [
    { k: '主控', v: 'Nordic nRF52833（Arm Cortex-M4，含浮點運算），跑使用者程式和藍牙' },
    { k: '介面晶片', v: '另一顆小 MCU 負責 USB：把板子變成隨身碟（MICROBIT 磁碟）、轉接序列埠。V2.0 用 NXP KL27，V2.2 改用 nRF52820，邊緣連接器碰不到它' },
    { k: '顯示', v: '5×5 紅色 LED 矩陣，每顆有 10 段亮度（0–9）；也能反過來當光線感測器' },
    { k: '輸入', v: '按鈕 A（P5）、按鈕 B（P11）、觸控 logo（V2 新增，電容式）' },
    { k: '感測器', v: 'LSM303AGR 加速度計＋磁力計（走內部 I²C）、溫度（量的是處理器晶片溫度）、光線（用 LED 矩陣量）、MEMS 麥克風（V2）' },
    { k: '聲音', v: 'V2 背面有內建喇叭；MicroPython 的 music 預設同時從喇叭和 P0 送出聲音' },
    { k: '無線', v: '2.4 GHz 無線電（micro:bit 之間互傳，用「群組」分頻道）＋藍牙低功耗 5.0' },
    { k: '邊緣連接器', v: '25 個接點：5 個大圓環（0、1、2、3V、GND，可夾鱷魚夾、插 4 mm 香蕉頭）＋20 個窄條（要插專用擴充板才接得到）' },
    { k: '類比輸入', v: 'P0、P1、P2 隨時可用；P3、P4、P10 也能讀，但要先關掉 LED 畫面' },
    { k: '電源', v: 'USB 5 V（板上降壓成 3.3 V）或 2 × AAA 電池（3 V，背面 JST 接頭）；V2 的穩壓器可以供 300 mA，邊緣連接器建議最多用約 190 mA' },
    { k: '尺寸', v: '51.6 × 42 mm，V2 的金手指在大圓環兩側多了缺口，鱷魚夾比較不會滑掉' },
    { k: '開發環境', v: 'MakeCode（積木或 JavaScript）、MicroPython（python.microbit.org）、Arduino、C++（CODAL）' },
  ],
  parts: [
    { id: 'matrix', num: 1, name: '5×5 LED 矩陣', quiz: '找出可以顯示圖案、捲動文字的 LED 螢幕', desc: '25 顆紅色 LED 排成 5 行 5 列。它其實是「掃描」顯示的：同一時間只點亮一列，換得夠快，眼睛就以為全部一起亮。所以 LED 的行線會佔用 P3、P4、P6、P7、P10 這五支腳。關燈時讓 LED 反過來當感測器，還能量環境亮度。', at: [fx('matrix'), 0.05, fz('matrix')], layer: 1.6 },
    { id: 'btnA', num: 2, name: '按鈕 A', quiz: '找出左邊的按鈕 A', desc: '接在 P5，按下時把腳位拉到 GND。MicroPython 有兩種讀法：is_pressed() 問「現在有沒有按著」，was_pressed() 問「上次問完之後有沒有按過」，後者不會漏掉很快的一下。', at: [fx('btnA'), 0.15, fz('btnA')], layer: 2 },
    { id: 'btnB', num: 3, name: '按鈕 B', quiz: '找出右邊的按鈕 B', desc: '接在 P11，用法和按鈕 A 一樣。同時按住 A 和 B 也可以當成第三種輸入，很多遊戲用它當「重新開始」。', at: [fx('btnB'), 0.15, fz('btnB')], layer: 2 },
    { id: 'logo', num: 4, name: '觸控 logo', quiz: '找出 V2 新增、用手指摸就有反應的 logo', desc: 'V2 才有的電容式觸控感應：手指靠近時電容變大，晶片量得到。它不像按鈕會動，所以不會磨損；用 pin_logo.is_touched() 讀。', at: [fx('logo'), 0.03, fz('logo')], layer: 1.3 },
    { id: 'micLed', num: 5, name: '麥克風指示燈', quiz: '找出 logo 旁邊、麥克風在用時會亮的小燈', desc: '程式一開始用麥克風，這顆燈就會亮，提醒旁邊的人「它正在聽」。這是 V2 為了隱私特別加的設計，程式沒辦法偷偷關掉它。', at: [fx('micLed'), 0.03, fz('micLed')], layer: 1.3 },
    { id: 'edge', num: 6, name: '邊緣連接器（金手指）', quiz: '找出下緣可以夾鱷魚夾的金手指', desc: '5 個大圓環（0、1、2、3V、GND）可以直接夾鱷魚夾，中間的窄條要插專用擴充板才接得到。大圓環正反兩面是相通的；V2 在圓環旁邊多切了缺口，讓鱷魚夾咬得更穩。', at: [fx('edge'), 0.02, fz('edge')], layer: 1.1 },
    { id: 'mcu', num: 7, name: 'nRF52833 處理器（背面）', quiz: '翻到背面，找出跑你的程式的主處理器', desc: 'Nordic 的 nRF52833：64 MHz 的 Arm Cortex-M4，內建 512 KB flash、128 KB RAM，還有 2.4 GHz 無線電。你寫的 MicroPython 程式、藍牙、micro:bit 之間的無線電全靠它。', at: [fx('mcu'), -0.08, fz('mcu')], layer: -1.4, side: 'bottom' },
    { id: 'iface', num: 8, name: 'USB 介面晶片（背面）', quiz: '翻到背面，找出讓 micro:bit 變成隨身碟的介面晶片', desc: '插上電腦時出現的 MICROBIT 磁碟就是它做的：你把 .hex 檔拖進去，它幫你寫進主處理器。它還負責 USB 序列埠。它和主處理器分開，所以程式寫壞了也不會讓板子「變磚」。', at: [fx('iface'), -0.08, fz('iface')], layer: -1.4, side: 'bottom' },
    { id: 'motion', num: 9, name: '加速度計＋磁力計（背面）', quiz: '翻到背面，找出知道板子傾斜、被搖晃的動作感測器', desc: 'LSM303AGR 一顆晶片裡有加速度計和磁力計。加速度計量的是重力往哪邊，所以知道板子怎麼傾斜，也能認出「搖一搖」「正面朝上」這些手勢；磁力計就是電子指南針，用之前要先轉一圈校正。', at: [fx('motion'), -0.06, fz('motion')], layer: -1.3, side: 'bottom' },
    { id: 'speaker', num: 10, name: '喇叭（背面）', quiz: '翻到背面，找出 V2 才有的內建喇叭', desc: 'V1 要外接蜂鳴器才有聲音，V2 背面直接焊了一顆喇叭。music.play() 可以播內建旋律，audio.play(Sound.GIGGLE) 還能播笑聲、打招呼這類音效。', at: [fx('speaker'), -0.15, fz('speaker')], layer: -1.9, side: 'bottom' },
    { id: 'mic', num: 11, name: 'MEMS 麥克風（背面）', quiz: '翻到背面，找出聽得到拍手聲的麥克風', desc: '很小的矽晶片麥克風，聲音從正面 logo 旁的小孔進來。microphone.sound_level() 給 0–255 的音量，was_event(SoundEvent.LOUD) 可以抓到拍手這種突然變大聲的瞬間。', at: [fx('mic'), -0.06, fz('mic')], layer: -1.3, side: 'bottom' },
    { id: 'usb', num: 12, name: 'Micro-USB 接頭', quiz: '找出接電腦、上傳程式的 Micro-USB 接頭', desc: '供電、上傳程式、序列埠都靠這條線。上傳時背面的黃色指示燈會閃，閃完程式就自動開始跑。', at: [fx('usb'), -0.15, fz('usb')], layer: -1.8, side: 'bottom' },
    { id: 'battery', num: 13, name: '電池接頭（JST）', quiz: '找出接 2 顆 AAA 電池盒的白色接頭', desc: '接 2 × AAA 電池盒（3 V），micro:bit 就能離開電腦，掛在身上當計步器或名牌。注意它只能接 3 V 左右，不能接 9 V 電池。', at: [fx('battery'), -0.18, fz('battery')], layer: -1.8, side: 'bottom' },
    { id: 'reset', num: 14, name: '重置／電源按鈕', quiz: '找出背面按一下重新開始、長按會關機的按鈕', desc: '按一下：程式從頭開始跑。V2 長按會進入省電關機，再按一下才醒來。', at: [fx('reset'), -0.12, fz('reset')], layer: -1.6, side: 'bottom' },
    { id: 'antenna', num: 15, name: '2.4 GHz 天線', quiz: '找出板子角落那段彎彎曲曲的天線', desc: '無線電和藍牙都從這段銅箔走線發射出去，它本身就是電路板上畫出來的天線。把手指或金屬壓在這裡，訊號距離會變短。', at: [fx('antenna'), -0.02, fz('antenna')], layer: -1.1, side: 'bottom' },
    { id: 'reg', num: 16, name: '3.3 V 穩壓器', quiz: '找出把 USB 的 5 V 降成 3.3 V 的穩壓器', desc: 'USB 給的是 5 V，這顆晶片把它降成穩定的 3.3 V。V2 可以供到 300 mA，扣掉板上自己要用的，邊緣連接器建議最多拿約 190 mA。', at: [fx('reg'), -0.08, fz('reg')], layer: -1.4, side: 'bottom' },
    { id: 'leds', num: 17, name: '電源與 USB 指示燈', quiz: '找出背面插上電就亮、上傳時會閃的小燈', desc: '紅燈代表有電；黃燈在上傳程式、USB 傳資料時會閃。V2 的紅燈在省電關機時會變暗閃爍。', at: [fx('leds'), -0.05, fz('leds')], layer: -1.2, side: 'bottom' },
  ],
  strengths: [
    '不用接線就能玩：LED 螢幕、按鈕、觸控、加速度計、指南針、喇叭、麥克風全部焊好在板子上',
    '鱷魚夾就能接外部零件：五個大圓環不用麵包板也不用焊接，最適合國小、國中的第一堂實作課',
    '兩塊 micro:bit 之間可以用無線電互傳，一行 radio.send() 就能做投票器、猜拳、遙控車',
    '程式從積木到 Python 都能寫：MakeCode 積木可以一鍵切換成 JavaScript 或 Python 對照著學',
    '介面晶片和主處理器分開，不怕程式寫壞讓板子變磚；拖一個 .hex 檔就能重灌',
  ],
  pitfalls: [
    '用了 LED 畫面就不能拿 P3、P4、P6、P7、P10 當一般腳：它們同時是 LED 的行線，外接零件請優先用 P0、P1、P2、P8、P16',
    'P5、P11 是按鈕 A／B，P12 官方保留給無障礙功能，P19／P20 是 I²C：這幾支腳不要隨便接東西',
    '鱷魚夾只夾得到五個大圓環；中間的窄條要用專用擴充板（edge connector breakout）才接得到',
    '3V 圓環的電流有限（約 190 mA），伺服機、馬達要另外接電池，並和 micro:bit 共地（GND 接在一起）',
    '無線電的「群組」不同就收不到：radio.config(group=…) 兩邊要設一樣，教室裡每組最好用不同群組，才不會互相干擾',
    '溫度量的是處理器晶片，不是空氣：插著 USB 跑程式時通常會比室溫高 1–3 °C',
    '電子指南針用之前要先 compass.calibrate()，而且馬達、磁鐵、喇叭附近都會讓它亂指',
  ],
  pinGroups: [
    { title: '大圓環 0、1、2', kind: 'analog', body: 'P0、P1、P2 可以數位讀寫、讀類比（0–1023）、PWM、觸控，鱷魚夾直接夾。V2 的 music 預設也會從 P0 送出聲音。' },
    { title: '電源圓環', kind: 'power', body: '3V 提供 3.3 V，GND 接地；兩個圓環兩側各有一條同電位的窄條。外接電路一定要接回 GND。' },
    { title: '和 LED 共用', kind: 'pwm', body: 'P3、P4、P6、P7、P10 是 LED 矩陣的行線，要拿來用得先 display.off()。P5、P11 是按鈕 A、B。' },
    { title: '一般數位腳', kind: 'digital', body: 'P8、P9、P16 沒有和板上零件共用，外接按鈕、燈、伺服機訊號優先用它們（要插擴充板）。' },
    { title: 'SPI 與 I²C', kind: 'bus', body: 'P13／P14／P15 是 SPI（SCK／MISO／MOSI），P19／P20 是外接 I²C（SCL／SDA，已有上拉）。V2 的板上感測器走另一條內部 I²C。' },
    { title: '保留腳', kind: 'nc', body: 'P12 官方保留給無障礙功能，不建議使用。' },
    { title: '接地', kind: 'gnd', body: '所有外接零件的負極、電池盒的負極，都要回到 GND 圓環。' },
  ],
  code: {
    title: '第一支程式：捲動文字、按鈕換表情',
    lang: 'MICROPYTHON',
    source: `# 打開 python.microbit.org，貼上程式後按「傳送到 micro:bit」
from microbit import *

display.scroll("HI")              # 字會從右往左捲過去

while True:
    if button_a.was_pressed():
        display.show(Image.HAPPY)
    elif button_b.was_pressed():
        display.show(Image.SAD)
    elif pin_logo.is_touched():   # V2 才有的觸控 logo
        display.show(Image.HEART)
    sleep(50)`,
  },
  projects: [
    '電子骰子：搖一搖就顯示 1–6 的點數，再加上喇叭音效',
    '教室投票器：每個人用自己的 micro:bit 按 A 或 B，老師那塊用無線電統計票數',
    '計步器：電池盒掛在鞋子上，用加速度計數步數，按 A 顯示今天走了幾步',
    '植物照顧員：兩根釘子插在土裡接 P0 和 3V，量土壤乾溼，太乾就發出聲音',
    '和 3pi+ 合作：micro:bit 當遙控器，傾斜它就用無線電告訴小車往哪邊開',
  ],
  facts: [
    'BBC 在 2016 年送了大約一百萬塊 micro:bit 給英國的七年級學生，每人一塊，目標是讓下一代從「用電腦」變成「做東西」。',
    '5×5 的 LED 也能當光線感測器：LED 被光照到時會產生一點點電流，micro:bit 趁顯示的空檔偷偷量這個電流。',
    'V2 在 2020 年推出，加了喇叭、麥克風和觸控 logo；外觀上最好認的差別是金手指圓環旁邊多了缺口。',
    '「群組」其實不是真的切換無線電頻道，而是在每個封包裡加上群組編號，收到不同群組的封包就直接丟掉。',
  ],
  quiz: [
    { part: 'matrix', prompt: '為什麼用了 LED 畫面以後，P3、P4 就不能隨便接東西？找出原因所在的零件', hint: '正面中間那 25 顆燈。', explain: 'LED 矩陣的行線就是 P3、P4、P6、P7、P10。' },
    { part: 'motion', prompt: '翻到背面：「搖一搖就擲骰子」是哪顆晶片感覺到的？', hint: '背面左下方很小的方形晶片。', explain: 'LSM303AGR 的加速度計量得到重力方向和搖晃。' },
    { part: 'speaker', prompt: '翻到背面：V2 不用外接蜂鳴器也能發出聲音，靠的是什麼？', hint: '背面正中間那顆黑色圓形零件。', explain: 'V2 內建喇叭，music 預設同時從喇叭和 P0 輸出。' },
    { part: 'logo', prompt: '哪個零件沒有按鍵、用手指摸就會有反應？', hint: '正面最上方的金色圖案。', explain: 'V2 的觸控 logo 用電容感應手指。' },
    { part: 'edge', prompt: '想用鱷魚夾接一顆外部 LED，要夾在哪裡？', hint: '板子下緣的金色部分，有五個大洞。', explain: '邊緣連接器的大圓環 0、1、2、3V、GND 可以直接夾。' },
    { part: 'iface', prompt: '翻到背面：插上電腦出現的 MICROBIT 隨身碟，是哪顆晶片做的？', hint: '背面左側、靠近 USB 的晶片。', explain: '介面晶片負責 USB 拖放燒錄和序列埠。' },
    { part: 'micLed', prompt: '麥克風正在聽的時候，哪顆燈一定會亮？', hint: '正面 logo 右邊的小燈。', explain: '麥克風指示燈，V2 為了隱私而設計。' },
    { part: 'mcu', prompt: '翻到背面：兩塊 micro:bit 互傳訊息的無線電，內建在哪顆晶片裡？', hint: '背面右側最大的方形晶片。', explain: 'nRF52833 內建 2.4 GHz 無線電與藍牙。' },
    { part: 'btnB', prompt: '找出接在 P11 的按鈕', hint: '正面右邊。', explain: '按鈕 B 接在 P11，按下時接地。' },
    { part: 'battery', prompt: '想讓 micro:bit 離開電腦、掛在身上跑，要接在哪裡？', hint: '上緣、USB 旁邊的白色小接頭。', explain: 'JST 電池接頭，接 2 × AAA（3 V）。' },
  ],
};

/** 背面零件最厚的是喇叭（cm，估計）；板子平放在工作台時墊高這麼多 */
export const MB_BACK_H = 0.3;
export const MB_LIFT = MB_PCB_T + MB_BACK_H;
/** 鱷魚夾夾在金手指上的高度（相對 PCB 頂面） */
export const MB_PIN_TOP = 0.05;

export const microbitData: BoardData = {
  id: 'microbit',
  short: 'micro:bit',
  summary: BOARDS.find((b) => b.id === 'microbit')!,
  lesson: microbitLesson,
  w: MB_W,
  d: MB_D,
  pins: MB_PINS,
  internalNets: [],
  supply: [],
  gnd: ['GND'],
  analogOnly: [],
  logicV: 3.3,
  // 沒有單顆的板上 LED（畫面是 5×5 矩陣，由 src/sim/microbit.ts 模擬）；給一個不存在的腳
  ledPin: 'MATRIX',
  serialPins: [],
  footprints: MB_FOOTPRINTS,
  mx: bx,
  mz: bz,
  tray: {
    matrix: [6.8, -1.6, -0.42],
    btnA: [5.6, 0.8, -0.42],
    btnB: [7.4, 0.8, -0.42],
    logo: [8.6, -1.6, -0.42],
    micLed: [8.8, 0.8, -0.42],
  },
  stage: {
    floorY: -MB_LIFT - 0.02,
    pinY: MB_PIN_TOP + 0.05,
    explodeLift: 1.2,
    explodeGap: 0.7,
    views: {
      iso: [4.6, 6.2, 7.6, 0, -0.2, 0.1],
      top: [0, 9.5, 0.01, 0, 0, 0],
      bottom: [0, -9, 0.6, 0, -0.3, 0],
      front: [0, 1.8, 8.6, 0, -0.2, 0],
    },
    asmCam: [3.2, 13, 6, 3.2, -0.4, 0],
  },
  bench: {
    pos: [-4.2, 0, -1.4],
    half: [MB_W / 2, MB_D / 2],
    lift: MB_LIFT,
    pin: (p) => [p.x, MB_LIFT + MB_PIN_TOP, p.z],
  },
};
