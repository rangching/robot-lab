import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * M5Stamp Fly（K138）：M5Stack 在 2024 年推出的開源迷你四軸，整片 PCB 就是機身。
 * 官方規格：81.5 × 81.5 × 31 mm、36.8 g（含電池）、1S 300 mAh 高壓鋰電、716 空心杯馬達。
 * 這裡的外框與零件位置是依照片估的教學用近似值；腳位與匯流排依官方文件與開源韌體。
 *
 * 座標：機頭朝遠方（−z），觀看者看到的是機尾（Grove 埠、電池接頭在這一側）。
 * 板子圖面座標 mm，原點在左下角（機尾左側），y 往機頭增加。
 */
export const SF_W = 8.15;
export const SF_D = 8.15;
export const SF_PCB_T = 0.12;
/** 機身中段（放 StampS3 與感測器的長方形）在圖面座標的範圍（mm） */
export const SF_BODY = { x0: 25.75, x1: 55.75, y0: 20.75, y1: 60.75 };
/** 馬達中心離機身中心的距離（mm，x、y 各方向） */
export const SF_MOTOR_OFF = 25.5;
export const SF_C = 40.75;

export const sx = (mm: number) => mm / 10 - SF_W / 2;
export const sz = (mm: number) => SF_D / 2 - mm / 10;

/** Grove 接頭（HY2.0-4P）腳距 2 mm；訊號 1、訊號 2、5V、GND */
const GROVE_Y = 23.5;
function grove(cx: number, ids: [string, string, PinKind, string][]): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: sx(cx - 3 + i * 2), z: sz(GROVE_Y) }));
}

export const SF_MOTOR_MM: Record<'FL' | 'FR' | 'RL' | 'RR', [number, number]> = {
  FL: [SF_C - SF_MOTOR_OFF, SF_C + SF_MOTOR_OFF],
  FR: [SF_C + SF_MOTOR_OFF, SF_C + SF_MOTOR_OFF],
  RL: [SF_C - SF_MOTOR_OFF, SF_C - SF_MOTOR_OFF],
  RR: [SF_C + SF_MOTOR_OFF, SF_C - SF_MOTOR_OFF],
};
const motorPin = (m: keyof typeof SF_MOTOR_MM, label: string, desc: string): PinDef => ({ id: `M${m}`, label, kind: 'motor', desc, x: sx(SF_MOTOR_MM[m][0]), z: sz(SF_MOTOR_MM[m][1]) });

export const SF_PINS: PinDef[] = [
  ...grove(33, [
    ['GPIO15', 'G15', 'bus', 'PORT.A（紅色 Grove）的訊號腳 G15。這個埠是給 I²C 感測器用的，也可以當一般 GPIO'],
    ['GPIO13', 'G13', 'bus', 'PORT.A 的另一支訊號腳 G13'],
    ['VIN', '5V', 'power', 'PORT.A 的 5 V 電源輸出，給外接模組用；不能接到 G 腳（StampS3 是 3.3 V 晶片）'],
    ['GND1', 'GND', 'gnd', '接地，和所有 GND、BAT− 相通'],
  ]),
  ...grove(48.5, [
    ['GPIO1', 'G1', 'pwm', 'PORT.B（黑色 Grove）的訊號腳 G1：數位＋PWM，也能讀類比（ADC1）'],
    ['GPIO2', 'G2', 'pwm', 'PORT.B 的訊號腳 G2：數位＋PWM，也能讀類比（ADC1）'],
    ['VIN2', '5V', 'power', 'PORT.B 的 5 V 電源輸出，和 PORT.A 的 5V 相通'],
    ['GND2', 'GND', 'gnd', '接地'],
  ]),
  { id: 'BAT', label: 'BAT+', kind: 'power', desc: '電池正極（紅線）。1S 鋰電池 3.5–4.35 V，直接餵給四顆馬達的驅動 MOSFET', x: sx(SF_C - 1), z: sz(GROVE_Y) },
  { id: 'GND3', label: 'BAT−', kind: 'gnd', desc: '電池負極（黑線），也就是整台飛機的 GND', x: sx(SF_C + 1), z: sz(GROVE_Y) },
  motorPin('FL', 'FL 馬達', '左前馬達（GPIO5 控制），從上往下看順時針轉：要裝 CW 槳'),
  motorPin('FR', 'FR 馬達', '右前馬達（GPIO42 控制），從上往下看逆時針轉：要裝 CCW 槳'),
  motorPin('RL', 'RL 馬達', '左後馬達（GPIO10 控制），從上往下看逆時針轉：要裝 CCW 槳'),
  motorPin('RR', 'RR 馬達', '右後馬達（GPIO41 控制），從上往下看順時針轉：要裝 CW 槳'),
];

export const SF_INTERNAL_NETS: string[][] = [['GND1', 'GND2', 'GND3'], ['VIN', 'VIN2']];
/** 板內接死的 GPIO：四顆馬達（經 MOSFET）、WS2812 全彩燈、蜂鳴器 */
export const SF_INTERNAL_PINS = ['GPIO5', 'GPIO42', 'GPIO10', 'GPIO41', 'GPIO39', 'GPIO40'];

/** 零件外框（mm：中心 x, y, 寬, 高） */
export const SF_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  stamp: [SF_C, 47, 24, 18],
  imu: [SF_C, 33.5, 3, 2.5],
  mag: [34.5, 32.5, 2, 2],
  baro: [47, 32.5, 2.5, 2],
  ina: [31, 29.5, 3, 3],
  buzzer: [51, 29.5, 5, 5],
  rgb: [34.5, 58.5, 2.5, 2.5],
  tofF: [SF_C, 59.3, 4.4, 2.4],
  drv: [28.2, 58.6, 2.9, 2.4],
  groveA: [33, GROVE_Y, 8.6, 5],
  groveB: [48.5, GROVE_Y, 8.6, 5],
  bat: [SF_C, GROVE_Y, 5.6, 4.2],
  mFL: [...SF_MOTOR_MM.FL, 7, 7],
  mFR: [...SF_MOTOR_MM.FR, 7, 7],
  mRL: [...SF_MOTOR_MM.RL, 7, 7],
  mRR: [...SF_MOTOR_MM.RR, 7, 7],
  flow: [SF_C, 36, 7, 7],
  tofD: [SF_C, 48, 4.4, 2.4],
};

const fx = (id: string) => sx(SF_FOOTPRINTS[id][0]);
const fz = (id: string) => sz(SF_FOOTPRINTS[id][1]);

export const stampflyLesson: BoardLesson = {
  summary:
    'M5Stamp Fly 是一台手掌大、不到 40 公克的四軸無人機，但它其實是一塊開發板：整片電路板就是機身，四個角各插一顆空心杯馬達，中間的 StampS3 模組是 ESP32-S3 雙核心大腦。飛行需要的感測器全部焊在板上：量姿態的 IMU、量高度的氣壓計和雷射測距、看地面移動的光流感測器。韌體是開源的，可以自己改 PID、加功能。它和前面八塊板子最大的不同是：程式寫錯不只是燈不亮，而是會撞牆。所以這塊板子的重點是「安全的開發流程」。',
  stats: [
    { k: '時脈', v: '240 MHz' },
    { k: 'FLASH', v: '8 MB' },
    { k: '重量', v: '36.8 g' },
    { k: '控制迴圈', v: '400 Hz' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$50' },
  ],
  specs: [
    { k: '主控', v: 'M5StampS3 模組：ESP32-S3FN8（Xtensa LX7 雙核心 32 位元）' },
    { k: '時脈', v: '最高 240 MHz' },
    { k: 'Flash／SRAM', v: '8 MB／512 KB' },
    { k: '無線通訊', v: 'Wi-Fi 2.4 GHz、BLE 5；遙控器用 ESP-NOW 直接連線（不經過基地台）' },
    { k: '姿態感測', v: 'BMI270 六軸 IMU（加速度＋陀螺儀，SPI）＋BMM150 地磁計（I²C）' },
    { k: '高度感測', v: 'BMP280 氣壓計＋2 顆 VL53L3 雷射測距（往下量高度、往前偵測障礙）' },
    { k: '位移感測', v: 'PMW3901 光流感測器（往下看地面紋理，估計水平飄移）' },
    { k: '電量監測', v: 'INA3221 電壓／電流監測' },
    { k: '動力', v: '4 顆 716 空心杯馬達（17600 KV），每顆由一顆 MOSFET 以 150 kHz PWM 驅動' },
    { k: '電池', v: '1S 300 mAh 高壓鋰電池（標稱 3.7 V、充飽 4.35 V）' },
    { k: '擴充', v: '2 個 Grove 埠：PORT.A（G13、G15）、PORT.B（G1、G2）；另有蜂鳴器與 WS2812 全彩燈' },
    { k: '匯流排', v: 'I²C：G3／G4；SPI：MOSI G14、SCK G44、MISO G43（BMI270 的 CS 是 G46、PMW3901 的 CS 是 G12）' },
    { k: '尺寸', v: '81.5 × 81.5 × 31 mm（含槳）' },
    { k: '開發環境', v: 'PlatformIO＋Arduino 框架（官方開源韌體），也可以用 Arduino IDE、ESP-IDF' },
  ],
  parts: [
    { id: 'stamp', num: 1, name: 'M5StampS3 主控模組', quiz: '找出整台飛機的大腦：ESP32-S3 模組', desc: '機身正中央那塊小模組，裡面是 ESP32-S3 雙核心晶片和 8 MB flash。它要每秒跑 400 次「讀感測器 → 算 PID → 改馬達轉速」，同時用 ESP-NOW 收遙控器的指令。側邊的 USB-C 用來上傳程式和看序列埠。', at: [fx('stamp'), 0.3, fz('stamp')], layer: 3 },
    { id: 'imu', num: 2, name: 'BMI270 IMU（加速度＋陀螺儀）', quiz: '找出量傾斜角度與旋轉速度的 IMU', desc: '飛控最重要的感測器。陀螺儀量每秒轉幾度、加速度計量重力方向，兩個合起來算出飛機現在歪了幾度。它刻意放在機身正中央：離重心越近，馬達振動和轉動造成的誤差越小。', at: [fx('imu'), 0.05, fz('imu')], layer: 1.4 },
    { id: 'mag', num: 3, name: 'BMM150 地磁計', quiz: '找出像指南針一樣感測地球磁場的晶片', desc: '電子指南針，用來知道機頭朝哪個方位。陀螺儀算出來的航向會慢慢飄，靠它來校正。馬達和電池電流產生的磁場會干擾它，所以要做校準。', at: [fx('mag'), 0.05, fz('mag')], layer: 1.4 },
    { id: 'baro', num: 4, name: 'BMP280 氣壓計', quiz: '找出用氣壓變化估計高度的感測器', desc: '每升高約 8 公尺，氣壓下降約 1 hPa。它的解析度能分辨十幾公分的高度變化，但會受溫度和螺旋槳氣流影響，所以低空定高主要還是靠雷射測距。', at: [fx('baro'), 0.05, fz('baro')], layer: 1.4 },
    { id: 'ina', num: 5, name: 'INA3221 電壓／電流監測', quiz: '找出隨時盯著電池電壓的監測晶片', desc: '量電池電壓和電流。鋰電池電壓一掉，同樣的油門推力就變小，韌體會用電壓去修正油門；電壓太低時也會提醒你該降落，避免把電池過放。', at: [fx('ina'), 0.05, fz('ina')], layer: 1.4 },
    { id: 'buzzer', num: 6, name: '蜂鳴器（G40）', quiz: '找出解鎖、低電量時會叫的蜂鳴器', desc: '用聲音回報狀態：開機、解鎖、低電量都有不同的叫聲。飛機飛在空中時你沒空看螢幕，聲音是最直接的警示。', at: [fx('buzzer'), 0.1, fz('buzzer')], layer: 1.8 },
    { id: 'rgb', num: 7, name: 'WS2812 全彩燈（G39）', quiz: '找出顯示飛行狀態的全彩 LED', desc: '一顆可以顯示任何顏色的「智慧 LED」，只要一支腳就能控制。韌體用不同顏色代表上鎖、解鎖、定高、低電量。', at: [fx('rgb'), 0.05, fz('rgb')], layer: 1.4 },
    { id: 'tofF', num: 8, name: 'VL53L3 雷射測距（前方）', quiz: '找出機頭前方偵測障礙物的雷射測距', desc: '發出看不見的紅外雷射，量光線來回的時間算距離，最遠約 3 公尺。朝前的這顆用來偵測障礙物。', at: [fx('tofF'), 0.1, fz('tofF')], layer: 1.8 },
    { id: 'drv', num: 9, name: '馬達驅動 MOSFET（×4）', quiz: '找出讓 GPIO 推得動馬達的 MOSFET 開關', desc: 'GPIO 腳最多只能給幾十 mA，一顆空心杯馬達卻要 1 A 以上。所以每顆馬達配一顆 MOSFET 當「電子開關」：GPIO 只負責開關它，大電流直接從電池流過馬達。四個機臂根部各有一顆。', at: [fx('drv'), 0.05, fz('drv')], layer: 1.4 },
    { id: 'groveA', num: 10, name: 'Grove PORT.A（紅色）', quiz: '找出紅色的 Grove 擴充埠 PORT.A', desc: 'M5Stack 的慣例：紅色是 PORT.A，給 I²C 感測器用。四條線依序是 G15、G13、5V、GND，插上 Grove 線就能接外掛模組，不用焊接。', at: [fx('groveA'), 0.3, fz('groveA')], layer: 2 },
    { id: 'groveB', num: 11, name: 'Grove PORT.B（黑色）', quiz: '找出黑色的 Grove 擴充埠 PORT.B', desc: '黑色是 PORT.B，給一般 GPIO 用：G1、G2 可以數位輸出入、PWM，也能讀類比。想幫飛機加一顆警示燈或外接感測器，接這裡。', at: [fx('groveB'), 0.3, fz('groveB')], layer: 2 },
    { id: 'bat', num: 12, name: '電池接頭（BAT+／BAT−）', quiz: '找出接鋰電池的電源接頭', desc: '1S 鋰電池從這裡供電給四顆馬達。插著 USB 時程式照樣能跑，但 USB 的電流只夠 StampS3，馬達要靠電池。紅線一定接 BAT+、黑線接 BAT−。', at: [fx('bat'), 0.2, fz('bat')], layer: 2 },
    { id: 'mFL', num: 13, name: '左前馬達 FL（GPIO5）', quiz: '找出左前方、由 GPIO5 控制的馬達', desc: '716 空心杯馬達：直徑 7 mm、長 16 mm，轉速可達每分鐘數萬轉。左前這顆從上往下看是順時針轉，要裝 CW 槳。', at: [fx('mFL'), 0.4, fz('mFL')], layer: 2.4 },
    { id: 'mFR', num: 14, name: '右前馬達 FR（GPIO42）', quiz: '找出右前方、由 GPIO42 控制的馬達', desc: '右前這顆逆時針轉，要裝 CCW 槳。對角的兩顆馬達轉向相同，兩組的反扭力互相抵消，飛機才不會原地打轉。', at: [fx('mFR'), 0.4, fz('mFR')], layer: 2.4 },
    { id: 'mRL', num: 15, name: '左後馬達 RL（GPIO10）', quiz: '找出左後方、由 GPIO10 控制的馬達', desc: '左後這顆和右前是同一組，都是逆時針轉，裝 CCW 槳。', at: [fx('mRL'), 0.4, fz('mRL')], layer: 2.4 },
    { id: 'mRR', num: 16, name: '右後馬達 RR（GPIO41）', quiz: '找出右後方、由 GPIO41 控制的馬達', desc: '右後這顆和左前是同一組，順時針轉，裝 CW 槳。', at: [fx('mRR'), 0.4, fz('mRR')], layer: 2.4 },
    { id: 'flow', num: 17, name: 'PMW3901 光流感測器（背面）', quiz: '翻到背面，找出往下看地面的光流感測器', desc: '其實是一顆超低解析度的相機，每秒拍上百張地面照片，比對紋理移動多少，就知道飛機往哪邊飄。在純色、反光的地板上它會「看不到」，飛機就容易漂走。', at: [fx('flow'), -0.15, fz('flow')], layer: -1.3, side: 'bottom' },
    { id: 'tofD', num: 18, name: 'VL53L3 雷射測距（背面）', quiz: '翻到背面，找出往下量離地高度的雷射測距', desc: '朝下的這顆是定高模式的主角：量出離地高度，交給高度 PID 去調油門。它最遠約 3 公尺，再高就要換氣壓計接手。', at: [fx('tofD'), -0.1, fz('tofD')], layer: -1.3, side: 'bottom' },
  ],
  strengths: [
    '感測器全內建：IMU、地磁、氣壓、雙雷射測距、光流、電量監測，一次學完整套飛控',
    '官方韌體開源（PlatformIO＋Arduino），可以直接改 PID、加飛行模式，看得懂就改得動',
    'ESP32-S3 雙核心 240 MHz：一個核心跑 400 Hz 控制迴圈，另一個處理 ESP-NOW 遙控與遙測',
    '不到 40 公克、空心杯小馬達，撞到也不太會受傷，適合室內練習',
    '2 個 Grove 埠：不用焊接就能外掛感測器或警示燈',
  ],
  pitfalls: [
    '測試馬達、改程式時一定先拆槳：程式一錯，馬達會在你手上全速轉起來',
    '正反槳要裝對：對角同向，裝反的那顆會把空氣往上吹，一推油門就翻',
    '解鎖前油門一定歸零；遙控器要先開，飛機才找得到它（ESP-NOW 要配對）',
    '只插 USB 時馬達不會轉，那是正常的：馬達的電來自電池',
    '光流感測器在純色、反光、太暗的地板上會失效，飛機會慢慢飄走；練習時在地上鋪有花紋的墊子',
    '高壓鋰電池充飽是 4.35 V，要用對的充電器；飛到電壓低於 3.4 V 左右就該降落，過放會讓電池鼓脹',
  ],
  pinGroups: [
    { title: '電池與電源', kind: 'power', body: 'BAT+／BAT− 接 1S 鋰電池，供電給馬達。Grove 埠的 5V 是給外接模組的電源輸出；StampS3 本身是 3.3 V 晶片，G 腳不能接 5 V。' },
    { title: 'Grove PORT.A（紅）', kind: 'bus', body: 'G15、G13、5V、GND。依 M5Stack 慣例給 I²C 感測器用，也可以當一般 GPIO。' },
    { title: 'Grove PORT.B（黑）', kind: 'pwm', body: 'G1、G2、5V、GND。一般 GPIO：數位輸出入、PWM、類比輸入都可以，外接警示燈或感測器最方便。' },
    { title: '馬達與螺旋槳', kind: 'motor', body: '四顆馬達接在 GPIO5（FL）、GPIO42（FR）、GPIO10（RL）、GPIO41（RR），經 MOSFET 驅動，沒有拉出排針。左前、右後順時針（CW 槳），右前、左後逆時針（CCW 槳）。' },
    { title: '板內匯流排', kind: 'bus', body: 'I²C 在 G3／G4（地磁、氣壓、雷射測距、電量監測）；SPI 在 G14、G44、G43（IMU 與光流），各自用 G46、G12 當片選。這些都已經接死在板上。' },
    { title: '接地', kind: 'gnd', body: '所有 GND 和 BAT− 在板內相通。外接模組一定要和飛機共地。' },
  ],
  code: {
    title: '第一支程式：讓全彩燈換顏色',
    lang: 'ARDUINO C++',
    source: `// 開發板選「M5StampS3」（或在 PlatformIO 用 board = m5stack-stamps3）
// 需要安裝 FastLED 程式庫。這支程式不會動到馬達，可以放心上傳。
#include <FastLED.h>

const int RGB_PIN = 39;            // WS2812 全彩燈接在 G39
CRGB led[1];

void setup() {
  FastLED.addLeds<WS2812, RGB_PIN, GRB>(led, 1);
  FastLED.setBrightness(40);       // 燈很亮，調暗一點
  Serial.begin(115200);
}

void loop() {
  CRGB colors[] = { CRGB::Red, CRGB::Green, CRGB::Blue };
  for (CRGB c : colors) {
    led[0] = c;
    FastLED.show();
    delay(500);
  }
}`,
  },
  projects: [
    '定高懸停：用雷射測距＋高度 PID，讓它自己停在 50 公分高',
    '手勢起飛：拿在手上往上一拋，IMU 偵測到自由落體就自動啟動馬達',
    '避障飛行：前方雷射測距看到牆就自動減速、後退',
    '飛行記錄器：把姿態、高度、電壓用 Wi-Fi 傳到電腦，畫成曲線來調 PID',
    '群飛表演：幾台 Stamp Fly 用 ESP-NOW 互相廣播位置，排隊形',
  ],
  facts: [
    'Stamp Fly 的開源韌體出自日本的開發者，程式註解裡有不少日文；控制迴圈旁邊就註明了它是由計時器中斷、每秒觸發 400 次。',
    'ESP-NOW 是樂鑫自家的無線協定：不用連 Wi-Fi 基地台，兩個 ESP32 之間直接互傳短訊息，延遲只有幾毫秒，很適合當遙控器。',
    '控制迴圈每 2.5 毫秒跑一次。換句話說，你眨一次眼的時間，飛控已經修正姿態一百多次了。',
    '這裡介紹的是 2024 年的初代 K138。M5Stack 之後推出了 v1.1（改用 StampS3A），規格有些不同，買的時候看清楚版本。',
  ],
  quiz: [
    { part: 'stamp', prompt: '找出整台飛機的大腦：ESP32-S3 模組', hint: '機身正中央最大的那塊方形模組。', explain: 'M5StampS3 裡是 ESP32-S3 雙核心晶片，負責 400 Hz 的控制迴圈與 ESP-NOW 遙控。' },
    { part: 'imu', prompt: '飛控靠哪顆晶片知道機身歪了幾度？', hint: '刻意放在機身正中央、離重心最近的小晶片。', explain: 'BMI270 的陀螺儀和加速度計合起來算出姿態角。' },
    { part: 'tofD', prompt: '翻到背面：定高模式靠哪個感測器量離地高度？', hint: '背面、朝下的小黑方塊，比光流感測器小。', explain: '朝下的 VL53L3 雷射測距量出高度，交給高度 PID。' },
    { part: 'flow', prompt: '翻到背面：飛機怎麼知道自己在水平方向飄移？', hint: '背面有一顆帶圓形鏡頭的感測器。', explain: 'PMW3901 光流感測器看地面紋理的移動，估計水平飄移。' },
    { part: 'mFL', prompt: '找出由 GPIO5 控制、要裝 CW 槳的馬達', hint: '機頭朝遠方，它在左前角。', explain: '左前 FL 馬達順時針轉，和右後 RR 是同一組。' },
    { part: 'mFR', prompt: '右前方的馬達是哪一顆？它該裝哪一種槳？', hint: '機頭朝遠方，右邊遠處那個角。', explain: '右前 FR 馬達逆時針轉，要裝 CCW 槳。' },
    { part: 'bat', prompt: '鋰電池要插在哪裡？', hint: '機尾正中間、兩個 Grove 埠之間的小接頭。', explain: 'BAT+／BAT− 供電給馬達；只插 USB 時馬達不會轉。' },
    { part: 'drv', prompt: 'GPIO 推不動 1 A 的馬達，是靠什麼零件放大的？', hint: '機臂根部的小三腳元件。', explain: '每顆馬達配一顆 MOSFET 當電子開關，大電流直接從電池流過馬達。' },
    { part: 'groveB', prompt: '想外接一顆警示燈，最方便接哪個埠？', hint: '機尾右邊、黑色的那個接頭。', explain: 'PORT.B 的 G1、G2 是一般 GPIO，可以數位輸出、PWM。' },
    { part: 'ina', prompt: '哪顆晶片隨時盯著電池電壓，提醒你該降落？', hint: '機身靠左後方的小方形晶片。', explain: 'INA3221 量電池電壓與電流。' },
  ],
};

/** 工作台：飛機放在綁繩測試架的泡棉墊上。PCB 頂面距台面＝墊子 1.0＋電池 0.48＋PCB 0.12 */
export const SF_BENCH_LIFT = 1.6;
/** 腳位熱點的高度（相對 PCB 頂面）：Grove 埠頂端、馬達軸頂端 */
export const SF_PIN_TOP = 0.62;
export const SF_SHAFT_TOP = 1.25;

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

export const stampflyData: BoardData = {
  id: 'stampfly',
  short: 'Stamp Fly',
  summary: BOARDS.find((b) => b.id === 'stampfly')!,
  lesson: stampflyLesson,
  w: SF_W,
  d: SF_D,
  pins: SF_PINS,
  internalNets: SF_INTERNAL_NETS,
  // 沒有 5 V 邏輯電源腳：Grove 的 5V 走「VIN」那條路
  supply: [],
  gnd: ['GND1', 'GND2', 'GND3'],
  analogOnly: [],
  logicV: 3.3,
  ledPin: 'GPIO39',
  serialPins: [],
  internalPins: SF_INTERNAL_PINS,
  header: '排母',
  footprints: SF_FOOTPRINTS,
  mx: sx,
  mz: sz,
  tray: {
    stamp: [6.6, -2.6, -0.62],
    ...smallTray(['mFL', 'mFR', 'mRL', 'mRR'], 5.6, -0.6, 1.2, 1.3, 2, -0.62),
    ...smallTray(['groveA', 'groveB', 'bat', 'imu', 'mag', 'baro', 'ina', 'buzzer', 'rgb', 'tofF'], 8.2, -0.8, 1.2, 1.0, 2, -0.62),
  },
  stage: {
    floorY: -0.75,
    pinY: SF_PIN_TOP,
    explodeLift: 0.9,
    explodeGap: 0.7,
    views: {
      iso: [6.0, 8.6, 10.2, 0, 0, 0.2],
      top: [0, 14.5, 0.01, 0, 0, 0],
      bottom: [0, -13.5, 0.6, 0, 0, 0],
      front: [0, 3.0, 13.0, 0, 0.3, 0],
    },
    asmCam: [3.4, 20.5, 7.5, 3.4, -0.4, -0.2],
  },
  bench: {
    pos: [-4.8, 0, -0.5],
    half: [4.2, 4.2],
    lift: SF_BENCH_LIFT,
    pin: (p) => [p.x, SF_BENCH_LIFT + (p.kind === 'motor' ? SF_SHAFT_TOP : SF_PIN_TOP), p.z],
  },
};
