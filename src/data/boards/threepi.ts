import type { BoardLesson, PinDef } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * Pololu 3pi+ 2040：直徑 9.7 cm 的圓形自走車，整塊控制板就是機器人的身體。
 * 腳位與功能查證自 Pololu 官方 3pi+ 2040 使用手冊（pololu.com/docs/0J86）與官方 MicroPython 函式庫原始碼；
 * 零件位置、輪距、感測器間距是依照片估的教學用近似值（官方沒有公開這些尺寸）。
 *
 * 座標：機頭（循線感測器那一側）朝遠方（−z），觀看者看到的是車尾（按鈕 A／B／C 在這一側）。
 * 板子圖面座標 mm，原點在外接正方形的左下角（車尾左側），y 往機頭增加。
 */
export const TP_W = 9.7;
export const TP_D = 9.7;
export const TP_PCB_T = 0.16;
export const TP_R = 48.5;
/** 兩個輪子中心的 x（mm）；輪距 85.5 mm 為估計值 */
export const TP_WHEEL_X: [number, number] = [TP_R - 42.75, TP_R + 42.75];
/** 輪子在 PCB 上的缺口（mm，半寬、半深） */
export const TP_SLOT = { hw: 5, hd: 17.5 };

export const tx = (mm: number) => mm / 10 - TP_W / 2;
export const tz = (mm: number) => TP_D / 2 - mm / 10;

/** 擴充排針（中間那排）：GP24、GP27、GP28、GP29 是板上沒用到的空腳 */
const HDR_Y = 87.5;
const HDR: [string, string, PinDef['kind'], string][] = [
  ['GND', 'GND', 'gnd', '接地，和電池負極、所有 GND 相通'],
  ['3V3', '3V3', 'power', '3.3 V 輸出，給外接感測器用；這台車的 GPIO 全部是 3.3 V，不能接 5 V 訊號'],
  ['GP24', 'GP24', 'pwm', 'GP24：板上沒用到的空腳，數位輸出入＋PWM'],
  ['GP27', 'GP27', 'analog', 'GP27：空腳，也能讀類比（ADC1，12 位元）'],
  ['GP28', 'GP28', 'analog', 'GP28：空腳，可讀類比（ADC2），也能當 I²C 或 UART0 的 TX'],
  ['GP29', 'GP29', 'analog', 'GP29：空腳，可讀類比（ADC3），也能當 I²C 或 UART0 的 RX'],
];
export const TP_PINS: PinDef[] = HDR.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: tx(TP_R + (i - 2.5) * 2.54), z: tz(HDR_Y) }));

/**
 * 板內接死的 GPIO（官方 MicroPython 函式庫）：
 * 馬達方向 GP10（右）、GP11（左），PWM GP14（右）、GP15（左）；編碼器 左 GP12／13、右 GP8／9；
 * 循線 DN1–DN5＝GP22–GP18、發射器 GP26（同一支腳也量電池電壓）；碰撞 BL GP17、BR GP16、發射器 GP23；
 * IMU I²C0 GP4／GP5；OLED SPI0 GP2／GP3、D/C GP0、RESET GP1；蜂鳴器 GP7；RGB LED 時脈 GP6；黃色 LED GP25。
 */
export const TP_INTERNAL_PINS = ['GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9', 'GP10', 'GP11', 'GP12', 'GP13', 'GP14', 'GP15', 'GP16', 'GP17', 'GP18', 'GP19', 'GP20', 'GP21', 'GP22', 'GP23', 'GP25', 'GP26'];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const TP_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  oled: [TP_R, 57, 36, 22],
  mcu: [TP_R, 34, 7, 7],
  flash: [38, 34, 5, 6],
  btnA: [33, 14, 7, 6],
  btnB: [TP_R, 14, 7, 6],
  btnC: [64, 14, 7, 6],
  yled: [58, 33, 2, 1.5],
  rgb: [TP_R, 79, 44, 3],
  buzzer: [24, 33, 9, 9],
  imu: [64, 38, 3, 2.5],
  mag: [69, 33, 2, 2],
  drv: [TP_R, 46, 44, 2.5],
  reg: [74, 22, 6, 5],
  usb: [24, 7, 9, 6],
  power: [73, 9, 7, 4],
  header: [TP_R, HDR_Y, 16, 2.5],
  line: [TP_R, 86, 42, 3],
  bumpL: [33, 91, 5, 3],
  bumpR: [64, 91, 5, 3],
  motorL: [26, TP_R, 22, 10],
  motorR: [71, TP_R, 22, 10],
  wheelL: [TP_WHEEL_X[0], TP_R, 7, 32],
  wheelR: [TP_WHEEL_X[1], TP_R, 7, 32],
  battery: [TP_R, 24, 44, 24],
  caster: [TP_R, 7, 8, 8],
};

const fx = (id: string) => tx(TP_FOOTPRINTS[id][0]);
const fz = (id: string) => tz(TP_FOOTPRINTS[id][1]);

export const threepiLesson: BoardLesson = {
  summary:
    '3pi+ 2040 是一台直徑不到 10 公分的圓形小車，買來就是一台完整的機器人：兩顆附編碼器的減速馬達、5 顆往下看的循線感測器、前方左右兩個碰撞開關、會量傾斜和轉向的 IMU、128×64 的 OLED 螢幕，全部焊在同一塊圓形電路板上，大腦是和 Raspberry Pi Pico 同一顆 RP2040。出廠就裝好 MicroPython，插上 USB 會出現一個隨身碟，改完程式存檔就能跑。前面的板子學的是「接線」，這塊板子學的是「控制」：怎麼讓車子走直、轉準、停準，最後用 PID 讓它沿著黑線飛快地跑。如果說 Stamp Fly 是空中機器人，3pi+ 就是它在地面上的搭檔。',
  stats: [
    { k: '時脈', v: '133 MHz' },
    { k: 'FLASH', v: '16 MB' },
    { k: '直徑', v: '9.7 cm' },
    { k: '最高速', v: '1.5 m/s' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$180' },
  ],
  specs: [
    { k: '主控', v: 'RP2040（雙核心 Arm Cortex-M0+，和 Raspberry Pi Pico 同一顆）' },
    { k: '記憶體', v: '264 KB SRAM、16 MB flash' },
    { k: '馬達', v: '2 顆微型金屬減速馬達。Standard 版 30:1（實際 29.86:1）最高約 1.5 m/s；Turtle 版 75:1 約 0.4 m/s；Hyper 版 15:1 約 4 m/s' },
    { k: '馬達電源', v: '電池先升壓到穩定的 8 V 再給馬達，所以電池快沒電時速度也不會變慢' },
    { k: '編碼器', v: '磁性編碼器，馬達軸每轉 12 counts；乘上減速比，Standard 版輪子轉一圈約 358.3 counts' },
    { k: '循線感測器', v: '5 顆紅外線反射式（DN1–DN5，由左到右接 GP22、GP21、GP20、GP19、GP18），發射器由 GP26 控制' },
    { k: '碰撞開關', v: '前方左右各一（BL＝GP17、BR＝GP16），也是用紅外線偵測保險桿有沒有被壓下，發射器 GP23' },
    { k: 'IMU', v: 'LSM6DSO（3 軸加速度＋3 軸陀螺儀）＋LIS3MDL（3 軸磁力計），接在 I²C0（SDA GP4、SCL GP5）' },
    { k: '顯示與聲音', v: '128×64 OLED（SH1106，SPI0）、蜂鳴器（GP7）、6 顆 RGB LED（GP3 資料、GP6 時脈）、黃色 LED（GP25，低電位點亮）' },
    { k: '按鈕', v: 'A（GP25，和黃色 LED 共用）、B（同時是 BOOTSEL）、C（GP0，和 OLED 的 D/C 共用）' },
    { k: '電池', v: '4 顆 AAA（建議鎳氫充電電池，4.8 V；鹼性電池 6 V 也可以）；電池電壓經 1/11 分壓接到 GP26 量測' },
    { k: '擴充', v: '中間排針有 4 支沒用到的空腳：GP24、GP27、GP28、GP29（後三支能讀類比）' },
    { k: '尺寸重量', v: '直徑 9.7 cm、高約 3.6 cm；不含電池約 100 g' },
    { k: '開發環境', v: '出廠預載 MicroPython（官方 pololu_3pi_2040_robot 函式庫）；也能用 Raspberry Pi Pico C/C++ SDK 或 Arduino' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'RP2040 微控制器', quiz: '找出整台車的大腦：RP2040', desc: '和 Raspberry Pi Pico 同一顆晶片：雙核心 133 MHz。一個核心可以專心跑循線的控制迴圈，另一個處理螢幕和聲音。它本身沒有 flash，程式存在旁邊那顆記憶體晶片裡。', at: [fx('mcu'), 0.05, fz('mcu')], layer: 1.4 },
    { id: 'flash', num: 2, name: '16 MB Flash 記憶體', quiz: '找出存放 MicroPython 和你的程式的記憶體晶片', desc: 'RP2040 每次開機都從這顆晶片讀程式。MicroPython 直譯器、官方函式庫和你寫的 main.py 都放在這裡；插上 USB 時，它的一部分會變成電腦上的隨身碟。', at: [fx('flash'), 0.05, fz('flash')], layer: 1.4 },
    { id: 'oled', num: 3, name: '128×64 OLED 螢幕', quiz: '找出顯示文字和讀值的 OLED 螢幕', desc: '自走車跑起來以後沒辦法一直接著電腦看序列埠，所以把電壓、感測器讀值、PID 參數直接秀在車上的螢幕最方便。它用 SPI 和 RP2040 溝通，驅動晶片是 SH1106。', at: [fx('oled'), 0.3, fz('oled')], layer: 2.6 },
    { id: 'btnA', num: 4, name: '按鈕 A', quiz: '找出程式最常用來「按了才出發」的按鈕 A', desc: '幾乎每支範例都會先等你按 A：讓你先把車子放好、手離開，它才開始跑。按鈕 A 和黃色 LED 共用 GP25，函式庫會自動切換讀和寫。', at: [fx('btnA'), 0.15, fz('btnA')], layer: 1.8 },
    { id: 'btnB', num: 5, name: '按鈕 B（BOOTSEL）', quiz: '哪一顆按鈕同時也是 BOOTSEL，按著插 USB 能重灌韌體？', desc: '平常可以當一般按鈕讀取；但它其實接在 flash 的片選線上，就是 RP2040 的 BOOTSEL。按住它再按重置，車子會變成 USB 隨身碟，可以拖一個 .uf2 檔重灌整個韌體。', at: [fx('btnB'), 0.15, fz('btnB')], layer: 1.8 },
    { id: 'btnC', num: 6, name: '按鈕 C', quiz: '找出和 OLED 共用腳位的按鈕 C', desc: '按鈕 C 接在 GP0，和 OLED 的 D/C（資料／命令切換）是同一支腳。函式庫會在更新螢幕的空檔偷偷讀按鈕，所以兩個都能用。', at: [fx('btnC'), 0.15, fz('btnC')], layer: 1.8 },
    { id: 'yled', num: 7, name: '黃色 LED（GP25）', quiz: '找出接在 GP25、寫 0 才會亮的黃色 LED', desc: '最簡單的狀態燈。它是「低電位點亮」：腳位輸出 0 時電流才流得過去。因為和按鈕 A 共用 GP25，按著 A 時它也會被影響。', at: [fx('yled'), 0.05, fz('yled')], layer: 1.4 },
    { id: 'rgb', num: 8, name: 'RGB LED × 6', quiz: '找出車頭那排六顆全彩 LED', desc: '六顆可以各自設定顏色的全彩 LED，用 SPI 的資料線和時脈線串起來控制。循線時可以用顏色顯示線在左邊還是右邊，比看螢幕還快。', at: [fx('rgb'), 0.05, fz('rgb')], layer: 1.6 },
    { id: 'buzzer', num: 9, name: '蜂鳴器（GP7）', quiz: '找出會嗶嗶叫、還能演奏音樂的蜂鳴器', desc: '用 PWM 改變頻率就能發出不同音高。官方函式庫可以用一串音符字串播放旋律，也能在背景播放，不會卡住你的控制迴圈。', at: [fx('buzzer'), 0.1, fz('buzzer')], layer: 1.8 },
    { id: 'imu', num: 10, name: 'LSM6DSO 加速度計＋陀螺儀', quiz: '找出量轉了幾度、有沒有被撞歪的 IMU', desc: '陀螺儀量每秒轉幾度，積分起來就是轉了幾度，比用時間或編碼器估計轉彎更準，因為輪子打滑也騙不了它。加速度計可以偵測車子被撞、被拿起來或翻倒。', at: [fx('imu'), 0.05, fz('imu')], layer: 1.4 },
    { id: 'mag', num: 11, name: 'LIS3MDL 磁力計', quiz: '找出像指南針一樣量地磁的晶片', desc: '量地球磁場，知道車頭朝哪個方位。不過馬達裡有磁鐵、電流也會產生磁場，用之前要先轉一圈做校正。', at: [fx('mag'), 0.05, fz('mag')], layer: 1.4 },
    { id: 'drv', num: 12, name: '馬達驅動晶片 × 2', quiz: '找出讓 GPIO 推得動馬達的 H 橋驅動晶片', desc: '每顆馬達配一顆 H 橋驅動晶片：GPIO 給方向（DIR）和速度（PWM），晶片負責把 8 V 的大電流送進馬達、也能反轉。左馬達用 GP11／GP15，右馬達用 GP10／GP14。', at: [fx('drv'), 0.05, fz('drv')], layer: 1.4 },
    { id: 'reg', num: 13, name: '電源穩壓電路', quiz: '找出把電池升壓成穩定 8 V 給馬達的電源電路', desc: '4 顆 AAA 從 6 V 一路掉到 4 V 多，如果直接接馬達，電池越用車子越慢，PID 參數也會跟著失準。這裡先升壓成穩定的 8 V 給馬達，再另外降成 3.3 V 給 RP2040 和感測器。', at: [fx('reg'), 0.1, fz('reg')], layer: 1.6 },
    { id: 'usb', num: 14, name: 'USB-C 接頭', quiz: '找出上傳程式、讓車子變成隨身碟的 USB 接頭', desc: '接電腦後會出現一個隨身碟，main.py 就在裡面，用任何編輯器改完存檔就好；也可以用 Thonny 開 MicroPython 的互動視窗。只插 USB 時馬達不會轉：馬達的電來自電池。', at: [fx('usb'), 0.2, fz('usb')], layer: 2 },
    { id: 'power', num: 15, name: '電源開關', quiz: '找出切換電池電源的開關', desc: '控制電池有沒有接進電路。換程式時可以只插 USB、關掉電池，車子就不會突然衝出桌面。', at: [fx('power'), 0.15, fz('power')], layer: 1.8 },
    { id: 'header', num: 16, name: '擴充排針（GP24、GP27–29）', quiz: '找出可以外接感測器的擴充排針', desc: '板子上幾乎每支腳都有工作了，只剩 GP24、GP27、GP28、GP29 四支空腳拉到這排孔。後三支能讀類比，想加距離感測器或伺服機就接這裡。', at: [fx('header'), 0.25, fz('header')], layer: 2 },
    { id: 'line', num: 17, name: '循線感測器 × 5（背面）', quiz: '翻到背面，找出車頭那排往下看地板的循線感測器', desc: '每顆都是一對紅外線發射器和接收器：白色地板反光強、黑色膠帶反光弱。讀到的是「電容放電要多久」，越黑放電越慢、數字越大。5 顆排成一排，就能算出黑線在車頭的左邊還是右邊。', at: [fx('line'), -0.1, fz('line')], layer: -1.3, side: 'bottom' },
    { id: 'bumpL', num: 18, name: '左碰撞感測器（背面）', quiz: '翻到背面，找出偵測左前方保險桿被壓下的感測器', desc: '車頭的塑膠保險桿被撞到時會往後退一點，擋住這裡的紅外線，就知道「左邊撞到了」。所以碰撞開關不是機械按鍵，用之前要先 calibrate()，而且只感覺得到正前方左右兩側的撞擊。', at: [fx('bumpL'), -0.1, fz('bumpL')], layer: -1.3, side: 'bottom' },
    { id: 'bumpR', num: 19, name: '右碰撞感測器（背面）', quiz: '翻到背面，找出偵測右前方撞擊的感測器', desc: '和左邊那顆一樣的原理。兩顆分開，程式才知道該往哪邊轉開：左邊撞到就往右轉，右邊撞到就往左轉。', at: [fx('bumpR'), -0.1, fz('bumpR')], layer: -1.3, side: 'bottom' },
    { id: 'motorL', num: 20, name: '左馬達＋編碼器（背面）', quiz: '翻到背面，找出帶動左輪、尾端有磁性編碼器的馬達', desc: '微型金屬減速馬達：馬達本身轉得很快，經過約 30:1 的齒輪才傳到輪子，力氣變大、速度變慢。尾端有一片小磁鐵和霍爾感測器，馬達每轉一圈送出 12 個計數，這就是「編碼器」。', at: [fx('motorL'), -0.5, fz('motorL')], layer: -2, side: 'bottom' },
    { id: 'motorR', num: 21, name: '右馬達＋編碼器（背面）', quiz: '翻到背面，找出帶動右輪的馬達', desc: '和左馬達一模一樣，但世界上沒有兩顆完全相同的馬達：給同樣的速度，左右輪轉速總會差一點點，車子就會慢慢偏。編碼器讓你量出差多少，再用程式補回來。', at: [fx('motorR'), -0.5, fz('motorR')], layer: -2, side: 'bottom' },
    { id: 'wheelL', num: 22, name: '左輪', quiz: '找出左邊那顆 32 mm 的輪子', desc: '直徑 32 mm，轉一圈前進約 10 公分（π × 3.2 cm）。輪子穿過電路板的缺口，所以車子的外形可以保持完整的圓形，原地轉彎時不會卡到東西。', at: [fx('wheelL'), -0.5, fz('wheelL')], layer: -2.4, side: 'bottom' },
    { id: 'wheelR', num: 23, name: '右輪', quiz: '找出右邊那顆輪子', desc: '兩個輪子各自獨立控制，這叫「差速驅動」：一樣快就直走，一快一慢就轉彎，一正一反就原地旋轉。整台車沒有方向盤，轉彎全靠兩輪的速度差。', at: [fx('wheelR'), -0.5, fz('wheelR')], layer: -2.4, side: 'bottom' },
    { id: 'battery', num: 24, name: '電池座（4 × AAA）', quiz: '翻到背面，找出放 4 顆 AAA 電池的電池座', desc: '建議用鎳氫充電電池（每顆 1.2 V，共 4.8 V）。電池放在車子最低的地方，重心低，急轉彎才不容易翻。', at: [fx('battery'), -0.4, fz('battery')], layer: -1.7, side: 'bottom' },
    { id: 'caster', num: 25, name: '滾珠腳輪（背面）', quiz: '翻到背面，找出車尾撐住車身的滾珠', desc: '兩個輪子站不穩，所以車尾加一顆可以往任何方向滾的小鋼珠當第三個支點。它沒有動力，只負責不讓車子往後倒。', at: [fx('caster'), -0.5, fz('caster')], layer: -2, side: 'bottom' },
  ],
  strengths: [
    '買來就是完整的機器人：馬達、編碼器、循線、碰撞、IMU、螢幕都焊好了，不用接線就能開始寫控制程式',
    '出廠預載 MicroPython：插 USB 就出現隨身碟，改 main.py 存檔就能跑，不用安裝編譯環境',
    '馬達由穩定的 8 V 供電，電池電量不影響速度，調好的 PID 參數不會隔天就失準',
    '附編碼器和 IMU：可以學「閉迴路控制」，從開迴路的「轉 300 毫秒」進步到「真的轉 90 度」',
    '圓形車身、原地轉彎：在迷宮、相撲、循線比賽都很好用；RP2040 雙核心跑得動 PID',
  ],
  pitfalls: [
    '第一次跑動態程式一定先把車子放在地上：在桌上按 A，它會直接衝下桌',
    '只插 USB 時馬達不會轉，那是正常的：馬達的電來自電池，記得打開電源開關',
    '循線前一定要校正：讓 5 顆感測器都看過白底和黑線，不然讀值範圍不對，算出來的線位置會亂跳',
    '用時間控制轉彎（轉 300 毫秒）很不準：速度、電池、地板摩擦一變就差很多；要轉準，請用編碼器或陀螺儀量',
    '碰撞感測器只感覺得到前方左右，車子側面或屁股撞牆它不知道；它也需要開機時 calibrate()，校正時別碰保險桿',
    '按鈕 A 和黃色 LED、按鈕 C 和 OLED 共用腳位：自己用 machine.Pin 直接操作這些腳時要小心，最好透過官方函式庫',
  ],
  pinGroups: [
    { title: '擴充排針', kind: 'pwm', body: 'GP24、GP27、GP28、GP29 是板上唯一沒用到的四支腳；GP27–29 可以讀類比（ADC1–3），GP28／29 也能當 I²C 或 UART。旁邊有 3V3 和 GND 可以供電給外接模組。' },
    { title: '馬達與編碼器', kind: 'motor', body: '左馬達：方向 GP11、PWM GP15、編碼器 GP12／GP13；右馬達：方向 GP10、PWM GP14、編碼器 GP8／GP9。都已經接死在板上，用 robot.Motors() 和 robot.Encoders() 控制。' },
    { title: '循線與碰撞', kind: 'digital', body: '循線 DN1–DN5 接 GP22–GP18，發射器 GP26（同一支腳也量電池電壓）；碰撞 BL＝GP17、BR＝GP16，發射器 GP23。' },
    { title: 'I²C 與 SPI', kind: 'bus', body: 'IMU 在 I²C0（SDA GP4、SCL GP5）；OLED 和 RGB LED 共用 SPI0 的資料線 GP3，OLED 時脈 GP2、RGB LED 時脈 GP6。' },
    { title: '電源', kind: 'power', body: '4 顆 AAA → 升壓 8 V 給馬達、降壓 3.3 V 給邏輯。所有 GPIO 都是 3.3 V，不能接 5 V 訊號。' },
    { title: '接地', kind: 'gnd', body: '外接模組一定要和車子共地，接排針上的 GND。' },
  ],
  code: {
    title: '第一支程式：在螢幕顯示電池電壓',
    lang: 'MICROPYTHON',
    source: `# 3pi+ 2040 出廠就有 MicroPython：插上 USB，打開隨身碟裡的 main.py 改完存檔
# 這支程式不會動到馬達，可以放心在桌上跑
from pololu_3pi_2040_robot import robot
import time

display = robot.Display()
battery = robot.Battery()
yellow = robot.YellowLED()

while True:
    mv = battery.get_level_millivolts()     # 電池電壓（毫伏）
    display.fill(0)
    display.text("3pi+ 2040", 0, 0)
    display.text("Battery:", 0, 20)
    display.text(str(mv) + " mV", 0, 32)
    display.show()
    yellow.on()
    time.sleep_ms(200)
    yellow.off()
    time.sleep_ms(800)`,
  },
  projects: [
    '循線競速：用 PID 讓它沿著黑色膠帶全速跑，挑戰一圈最短時間',
    '迷宮解題：沿著左牆走，記下每個路口，第二趟直接走最短路線',
    '迷你相撲：在圓形擂台上用碰撞感測器找對手、用循線感測器偵測白色邊界',
    '用陀螺儀走正方形：不靠時間、不靠編碼器，量到 90° 就轉下一個角',
    '和 Stamp Fly 合作：無人機在空中找目標，用 Wi-Fi 模組告訴地上的 3pi+ 開過去',
  ],
  facts: [
    '3pi+ 的前身是 Pololu 更早推出的初代 3pi，是很多循線比賽的入門車。3pi+ 2040 把大腦換成 RP2040，也是這個系列第一台出廠就跑 MicroPython 的版本。',
    'Pololu 有三種減速比可以選：Turtle 慢但力氣大、Standard 剛好、Hyper 每秒約 4 公尺，快到官方都提醒很容易撞壞，比較適合有經驗的人。',
    '循線感測器量的不是電壓，而是「時間」：先把小電容充電，再看它放電要多久。越黑反光越少，放電越慢，數字越大。',
    '官方循線範例的算法很簡單：5 顆讀值做加權平均得到 0–4000 的線位置，2000 就是正中間，再用 PID 算出左右輪速度差。',
  ],
  quiz: [
    { part: 'mcu', prompt: '找出整台車的大腦：RP2040', hint: '螢幕後方（靠車尾）的小方形晶片。', explain: 'RP2040 雙核心 133 MHz，和 Raspberry Pi Pico 同一顆。' },
    { part: 'line', prompt: '翻到背面：車子怎麼知道黑線在左邊還是右邊？', hint: '車頭底下那一排 5 顆小元件。', explain: '5 顆紅外線循線感測器，讀值做加權平均就是線的位置。' },
    { part: 'motorL', prompt: '翻到背面：哪個零件告訴程式「輪子轉了幾圈」？', hint: '馬達尾端裝了一片小磁鐵。', explain: '磁性編碼器：馬達每轉 12 counts，乘上減速比約 358 counts／輪一圈。' },
    { part: 'bumpR', prompt: '翻到背面：車子右前方撞到牆，是哪個感測器發現的？', hint: '車頭底下、循線感測器前面靠右。', explain: '右碰撞感測器偵測保險桿被壓下，用紅外線而不是機械開關。' },
    { part: 'btnB', prompt: '哪一顆按鈕同時也是 BOOTSEL？', hint: '車尾三顆按鈕的中間那一顆。', explain: '按鈕 B 接在 flash 片選，按住再重置就能重灌韌體。' },
    { part: 'reg', prompt: '為什麼電池快沒電時車子還是一樣快？找出關鍵的電路', hint: '靠右後方、有電感的那一區。', explain: '升壓電路把電池變成穩定的 8 V 再給馬達。' },
    { part: 'imu', prompt: '想讓車子「真的」轉 90 度，該讀哪顆晶片？', hint: '螢幕右後方的小晶片。', explain: 'LSM6DSO 的陀螺儀量轉動速度，積分就是轉過的角度。' },
    { part: 'header', prompt: '想加一顆距離感測器，接在哪裡？', hint: '車頭、螢幕前方那排小孔。', explain: '擴充排針的 GP24、GP27–29 是唯一沒用到的空腳。' },
    { part: 'caster', prompt: '只有兩個輪子，車子怎麼站得穩？', hint: '翻到背面，車尾正中間。', explain: '滾珠腳輪當第三個支點。' },
    { part: 'oled', prompt: '跑起來後要看感測器讀值，最方便看哪裡？', hint: '車子正中間最大的那塊。', explain: '128×64 OLED 螢幕，車子不用接電腦也能顯示讀值。' },
  ],
};

/** 輪軸在 PCB 底面下方多深（cm，估計） */
export const TP_AXLE_DROP = 0.6;
/** PCB 頂面距地面的高度：板厚＋輪軸深度＋輪子半徑 1.6 cm（輪子上緣會穿出板子缺口） */
export const TP_LIFT = TP_PCB_T + TP_AXLE_DROP + 1.6;
/** 擴充排針的頂端（相對 PCB 頂面） */
export const TP_PIN_TOP = 0.55;
/** 工作台上車子畫成實際大小的幾倍：1 m 的賽道墊在畫面上是 25 cm */
export const TP_BENCH_SCALE = 0.25;

export const threepiData: BoardData = {
  id: 'threepi',
  short: '3pi+',
  summary: BOARDS.find((b) => b.id === 'threepi')!,
  lesson: threepiLesson,
  w: TP_W,
  d: TP_D,
  pins: TP_PINS,
  internalNets: [],
  supply: [],
  gnd: ['GND'],
  analogOnly: [],
  logicV: 3.3,
  ledPin: 'GP25',
  ledActiveLow: true,
  serialPins: [],
  internalPins: TP_INTERNAL_PINS,
  header: '排針',
  footprints: TP_FOOTPRINTS,
  mx: tx,
  mz: tz,
  tray: {
    oled: [7.4, -2.4, -0.62],
    ...Object.fromEntries(['mcu', 'flash', 'btnA', 'btnB', 'btnC', 'yled', 'rgb', 'buzzer', 'imu', 'mag', 'drv', 'reg', 'usb', 'power', 'header'].map((id, i) => [id, [6.4 + (i % 3) * 1.5, -0.4 + Math.floor(i / 3) * 1.1, -0.62]])),
  },
  stage: {
    floorY: -TP_LIFT - 0.02,
    pinY: TP_PIN_TOP,
    explodeLift: 1.6,
    explodeGap: 0.75,
    views: {
      iso: [7.2, 9.4, 11.6, 0, -0.6, 0.2],
      top: [0, 16.5, 0.01, 0, 0, 0],
      bottom: [0, -15.5, 0.6, 0, -1, 0],
      front: [0, 2.6, 14.5, 0, -0.6, 0],
    },
    asmCam: [3.6, 22, 8, 3.6, -0.6, -0.2],
  },
  bench: {
    // 賽道墊 100 × 70 cm，畫面上縮成 25 × 17.5（墊子中心在 pos）
    pos: [-3.0, 0, 0.2],
    half: [12.5, 8.75],
    lift: TP_LIFT,
    pin: (p) => [p.x, TP_LIFT + TP_PIN_TOP, p.z],
  },
};
