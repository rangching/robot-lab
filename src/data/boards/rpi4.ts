import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * Raspberry Pi 4 Model B。實體 85 × 56 mm。
 * 擺法照官方機構圖：40 腳 GPIO 排針在遠側長邊（-z），網路孔與 USB 在右側短邊（+x），
 * USB-C、兩個 micro-HDMI、音源孔在靠近觀看者的長邊（+z），microSD 卡槽在背面左端。
 */
export const RPI_W = 8.5;
export const RPI_D = 5.6;
export const RPI_PCB_T = 0.14;

/** 板子圖面座標（mm，原點左下角，y 朝遠側）→ 3D 座標（cm，原點中心） */
export const rx = (mm: number) => mm / 10 - RPI_W / 2;
export const rz = (mm: number) => RPI_D / 2 - mm / 10;

const P = 2.54;
/** GPIO 排針：中心線距遠側邊 3.5 mm，左右置中在兩個固定孔之間（x = 32.5 mm） */
export const RPI_HDR_X = 32.5;
export const RPI_HDR_Y = 52.5;
/** 奇數腳（1、3、5…）在內側那排，偶數腳（2、4、6…）在板邊那排 */
const ODD_Y = RPI_HDR_Y - P / 2;
const EVEN_Y = RPI_HDR_Y + P / 2;
const COL0 = RPI_HDR_X - 9.5 * P;

type Row = [id: string, label: string, kind: PinKind, desc: string];

/**
 * 40 支腳照實體腳號 1–40 排列。可以被程式控制的腳 id 一律用「GPIO + BCM 編號」，
 * 和 gpiozero 程式裡寫的數字一致（LED(17) 就是 GPIO17，也就是實體第 11 腳）。
 */
const HEADER: Row[] = [
  ['3V3', '3V3', 'power', '實體第 1 腳：3.3 V 輸出，給感測器用；電流有限，不要拿來推馬達'],
  ['VIN', '5V', 'power', '實體第 2 腳：5 V，直接連到 USB-C 電源。可以給 5 V 模組供電，但絕對不能接到任何 GPIO'],
  ['GPIO2', 'GPIO2', 'bus', '實體第 3 腳：I²C 的 SDA。板上已經焊了 1.8 kΩ 上拉電阻，平常會被拉到 3.3 V'],
  ['VIN2', '5V', 'power', '實體第 4 腳：和第 2 腳相通的 5 V'],
  ['GPIO3', 'GPIO3', 'bus', '實體第 5 腳：I²C 的 SCL，也有 1.8 kΩ 上拉電阻；關機狀態下把它接地可以讓 Pi 開機'],
  ['GND1', 'GND', 'gnd', '實體第 6 腳：接地，8 支 GND 全部相通'],
  ['GPIO4', 'GPIO4', 'digital', '實體第 7 腳：一般數位腳；1-Wire 溫度感測器（DS18B20）預設用這支'],
  ['GPIO14', 'GPIO14', 'bus', '實體第 8 腳：序列埠 TXD。Linux 預設可能把它拿來當主控台，要用之前先在 raspi-config 設定'],
  ['GND2', 'GND', 'gnd', '實體第 9 腳：接地'],
  ['GPIO15', 'GPIO15', 'bus', '實體第 10 腳：序列埠 RXD'],
  ['GPIO17', 'GPIO17', 'digital', '實體第 11 腳：最常拿來接第一顆 LED 的一般數位腳'],
  ['GPIO18', 'GPIO18', 'pwm', '實體第 12 腳：硬體 PWM（PWM0），驅動伺服機最穩；也是 PCM 音訊的時脈腳'],
  ['GPIO27', 'GPIO27', 'digital', '實體第 13 腳：一般數位腳，有內建上拉／下拉電阻'],
  ['GND3', 'GND', 'gnd', '實體第 14 腳：接地'],
  ['GPIO22', 'GPIO22', 'digital', '實體第 15 腳：一般數位腳'],
  ['GPIO23', 'GPIO23', 'digital', '實體第 16 腳：一般數位腳'],
  ['3V3b', '3V3', 'power', '實體第 17 腳：和第 1 腳相通的 3.3 V'],
  ['GPIO24', 'GPIO24', 'digital', '實體第 18 腳：一般數位腳'],
  ['GPIO10', 'GPIO10', 'bus', '實體第 19 腳：SPI0 的 MOSI（Pi 送出資料）'],
  ['GND4', 'GND', 'gnd', '實體第 20 腳：接地'],
  ['GPIO9', 'GPIO9', 'bus', '實體第 21 腳：SPI0 的 MISO（Pi 接收資料）'],
  ['GPIO25', 'GPIO25', 'digital', '實體第 22 腳：一般數位腳'],
  ['GPIO11', 'GPIO11', 'bus', '實體第 23 腳：SPI0 的 SCLK 時脈'],
  ['GPIO8', 'GPIO8', 'bus', '實體第 24 腳：SPI0 的 CE0（選第一個 SPI 裝置）'],
  ['GND5', 'GND', 'gnd', '實體第 25 腳：接地'],
  ['GPIO7', 'GPIO7', 'bus', '實體第 26 腳：SPI0 的 CE1（選第二個 SPI 裝置）'],
  ['GPIO0', 'ID_SD', 'nc', '實體第 27 腳：保留給 HAT 擴充板上的 EEPROM，開機時用來辨認擴充板，一般不要接東西'],
  ['GPIO1', 'ID_SC', 'nc', '實體第 28 腳：和第 27 腳一組，保留給 HAT 的 EEPROM'],
  ['GPIO5', 'GPIO5', 'digital', '實體第 29 腳：一般數位腳'],
  ['GND6', 'GND', 'gnd', '實體第 30 腳：接地'],
  ['GPIO6', 'GPIO6', 'digital', '實體第 31 腳：一般數位腳'],
  ['GPIO12', 'GPIO12', 'pwm', '實體第 32 腳：硬體 PWM（PWM0，和 GPIO18 同一個通道）'],
  ['GPIO13', 'GPIO13', 'pwm', '實體第 33 腳：硬體 PWM（PWM1）'],
  ['GND7', 'GND', 'gnd', '實體第 34 腳：接地'],
  ['GPIO19', 'GPIO19', 'pwm', '實體第 35 腳：硬體 PWM（PWM1，和 GPIO13 同一個通道）；PCM 音訊的 FS'],
  ['GPIO16', 'GPIO16', 'digital', '實體第 36 腳：一般數位腳'],
  ['GPIO26', 'GPIO26', 'digital', '實體第 37 腳：一般數位腳'],
  ['GPIO20', 'GPIO20', 'digital', '實體第 38 腳：一般數位腳；PCM 音訊的 DIN'],
  ['GND8', 'GND', 'gnd', '實體第 39 腳：接地'],
  ['GPIO21', 'GPIO21', 'digital', '實體第 40 腳：一般數位腳；PCM 音訊的 DOUT'],
];

export const RPI_PINS: PinDef[] = HEADER.map(([id, label, kind, desc], i) => ({
  id,
  label,
  kind,
  desc,
  x: rx(COL0 + Math.floor(i / 2) * P),
  z: rz(i % 2 === 0 ? ODD_Y : EVEN_Y),
}));

/** 實體腳號（1–40） */
export const physOf = (id: string) => HEADER.findIndex((r) => r[0] === id) + 1;

export const RPI_INTERNAL_NETS: string[][] = [
  ['3V3', '3V3b'],
  ['VIN', 'VIN2'],
  ['GND1', 'GND2', 'GND3', 'GND4', 'GND5', 'GND6', 'GND7', 'GND8'],
];

/** 零件外框（mm：中心 x, y, 寬, 高）；接頭會稍微超出板邊，和實物一樣 */
export const RPI_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  soc: [29.0, 32.5, 15, 15],
  ram: [44.5, 32.5, 10, 14],
  gpio: [RPI_HDR_X, RPI_HDR_Y, 50.8, 5.08],
  sd: [6.5, 28.0, 13, 12],
  usbc: [11.2, 3.2, 9, 7.4],
  hdmi: [32.75, 3.4, 20, 7.5],
  eth: [76.7, 45.75, 21.3, 16],
  usb3: [77.5, 27.0, 17.5, 13.5],
  usb2: [77.5, 9.0, 17.5, 13.5],
  wifi: [13.5, 41.0, 10, 11],
  antenna: [3.2, 45.0, 4.4, 9],
  usbCtl: [60.5, 24.0, 7, 7],
  pmic: [19.5, 15.0, 6, 6],
  audio: [53.5, 6.0, 7, 12.5],
  csi: [45.0, 11.5, 4, 22],
  dsi: [2.6, 28.0, 4, 22],
  poe: [62.0, 44.5, 5.08, 5.08],
  pwrLed: [1.6, 8.4, 1.6, 0.8],
  actLed: [1.6, 11.0, 1.6, 0.8],
};

const fx = (id: string) => rx(RPI_FOOTPRINTS[id][0]);
const fz = (id: string) => rz(RPI_FOOTPRINTS[id][1]);

export const rpi4Lesson: BoardLesson = {
  summary:
    'Raspberry Pi 4 Model B 不是微控制器，而是一台只有信用卡大小的完整電腦：四核心 1.5 GHz 的處理器、1 到 8 GB 記憶體，插上 microSD 卡就能開機進 Linux，接螢幕、鍵盤、網路線都行。做機器人時，它通常當「大腦」：看相機、跑 AI、連網路、規劃路線；Arduino 之類的小板子則當「小腦」，負責準時控制馬達。它的 40 支 GPIO 一樣能點燈、讀按鈕，但只有 3.3 V，而且沒有類比輸入。',
  stats: [
    { k: '處理器', v: '4 × 1.5 GHz' },
    { k: 'RAM', v: '1–8 GB' },
    { k: '儲存', v: 'microSD' },
    { k: 'GPIO', v: '40 腳' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$35–75' },
  ],
  specs: [
    { k: '系統單晶片', v: 'Broadcom BCM2711：4 核心 Cortex-A72（ARMv8，64 位元）' },
    { k: '時脈', v: '1.5 GHz（2021 年後出貨的新版晶片預設 1.8 GHz）' },
    { k: '記憶體', v: 'LPDDR4-3200，有 1、2、4、8 GB 四種版本' },
    { k: '儲存', v: 'microSD 卡（放作業系統和所有檔案）；也可以設定從 USB 隨身碟或 SSD 開機' },
    { k: '作業系統', v: 'Raspberry Pi OS（Debian Linux），也能裝 Ubuntu、ROS 2' },
    { k: '網路', v: 'Gigabit 有線網路；Wi-Fi 5（2.4／5 GHz 802.11ac）；藍牙 5.0＋BLE' },
    { k: 'USB', v: '2 個 USB 3.0（藍色）＋2 個 USB 2.0（黑色）' },
    { k: '影像輸出', v: '2 個 micro-HDMI，最高兩台 4K 螢幕；另有 DSI 排線接頭可接官方觸控螢幕' },
    { k: '相機', v: 'CSI 排線接頭，接 Raspberry Pi 官方相機模組' },
    { k: 'GPIO', v: '40 腳排針（26 支可用的 GPIO），支援 I²C、SPI、UART、4 支硬體 PWM 腳' },
    { k: '類比輸入', v: '沒有！要讀旋鈕或類比感測器，得外接 ADC 晶片（例如 MCP3008、ADS1115）' },
    { k: '邏輯電壓', v: '3.3 V（GPIO 不能承受 5 V）' },
    { k: '供電', v: 'USB-C 5 V／3 A；或從 GPIO 的 5V 腳餵電；加裝 PoE HAT 可用網路線供電' },
    { k: '尺寸', v: '85 × 56 mm，四個 M2.5 固定孔' },
  ],
  parts: [
    { id: 'soc', num: 1, name: 'BCM2711 系統單晶片', quiz: '找出 Pi 的大腦：四核心處理器', desc: '那片銀色金屬蓋底下是 Broadcom BCM2711：四顆 Cortex-A72 核心、繪圖處理器、影像解碼器全都在同一顆晶片裡，所以叫「系統單晶片」（SoC）。金屬蓋是導熱用的，長時間跑滿會到 80 °C 以上而自動降速，做機器人建議加散熱片或風扇。', at: [fx('soc'), 0.1, fz('soc')], layer: 3 },
    { id: 'ram', num: 2, name: 'LPDDR4 記憶體', quiz: '找出 1–8 GB 的記憶體晶片', desc: 'SoC 右邊那顆黑色晶片就是 RAM。Pi 4 依容量分成 1、2、4、8 GB 版本，外觀幾乎一樣，只有這顆晶片的型號不同。跑 ROS 2 或 AI 模型建議選 4 GB 以上。', at: [fx('ram'), 0.08, fz('ram')], layer: 2.6 },
    { id: 'gpio', num: 3, name: '40 腳 GPIO 排針', quiz: '找出接 LED、按鈕、感測器的 40 腳排針', desc: '兩排共 40 支公排針，是 Pi 和電子世界之間的橋樑。注意兩套編號：「實體腳號」是從第 1 腳（板子上方塊焊墊）開始數的 1–40；「BCM 編號」是晶片內部的 GPIO 號碼，程式裡寫的是後者。GPIO17 其實在實體第 11 腳。', at: [fx('gpio'), 0, fz('gpio')], layer: 2.2 },
    { id: 'sd', num: 4, name: 'microSD 卡槽（背面）', quiz: '找出放作業系統的 microSD 卡槽', desc: 'Pi 沒有內建硬碟，整個 Linux 系統都裝在這張 microSD 卡裡。卡槽在背面左端。最常見的悲劇是直接拔電源：卡片正在寫入就斷電，檔案系統會壞掉、再也開不了機。關機請用 sudo shutdown now，等綠燈不再閃才拔電。', at: [fx('sd'), -0.08, fz('sd')], layer: -1.4, side: 'bottom' },
    { id: 'usbc', num: 5, name: 'USB-C 電源輸入', quiz: '找出供電用的 USB-C 接頭', desc: 'Pi 4 只吃電、不傳資料的 USB-C 孔，需要 5 V／3 A 的電源。手機充電器常常不夠力：電壓一掉，畫面右上角會出現閃電圖示，系統變慢甚至當機。機器人上通常用降壓模組從電池轉出 5 V。', at: [fx('usbc'), 0.1, fz('usbc')], layer: 1.6 },
    { id: 'hdmi', num: 6, name: '兩個 micro-HDMI', quiz: '找出接螢幕的兩個 micro-HDMI 接頭', desc: '可以同時接兩台螢幕，最高 4K。要注意是「micro」HDMI，比一般 HDMI 小很多，需要轉接線。只接一台時要插靠近 USB-C 的 HDMI0，開機畫面才會出現。', at: [fx('hdmi'), 0.1, fz('hdmi')], layer: 1.6 },
    { id: 'audio', num: 7, name: '3.5 mm 音源／影像孔', quiz: '找出 3.5 mm 的耳機孔', desc: '四極的 3.5 mm 孔，除了耳機的立體聲，還藏了一路類比電視訊號（複合視訊）。讓機器人說話、發出提示音，接一顆小喇叭就行。', at: [fx('audio'), 0.1, fz('audio')], layer: 1.6 },
    { id: 'csi', num: 8, name: 'CSI 相機排線接頭', quiz: '找出接相機模組的排線接頭', desc: '標著 CAMERA 的細長接頭。把黑色卡榫往上拉開，插入相機排線（藍色那面朝網路孔），再壓回去。機器人要「看」東西——循線、認人臉、辨識物體——都從這裡開始。', at: [fx('csi'), 0.1, fz('csi')], layer: 1.2 },
    { id: 'dsi', num: 9, name: 'DSI 螢幕排線接頭', quiz: '找出接官方觸控螢幕的 DSI 接頭', desc: '板子左端標著 DISPLAY 的排線接頭，接官方的 7 吋觸控螢幕。做成有操作面板的機器人或互動展示時很方便，而且不會佔用 HDMI。', at: [fx('dsi'), 0.1, fz('dsi')], layer: 1.2 },
    { id: 'eth', num: 10, name: 'Gigabit 網路孔', quiz: '找出插網路線的 RJ45 接頭', desc: '有線網路比 Wi-Fi 穩定得多，第一次設定、或要大量傳影像時很好用。搭配 PoE HAT 擴充板，一條網路線就能同時供電和上網。', at: [fx('eth'), 0.1, fz('eth')], layer: 2 },
    { id: 'usb3', num: 11, name: 'USB 3.0 埠（藍色）', quiz: '找出速度最快的藍色 USB 3.0 埠', desc: '藍色舌片代表 USB 3.0，速度約是 USB 2.0 的十倍。外接 SSD、深度相機（例如 RealSense）這類要大量傳資料的裝置，請插這兩個。', at: [fx('usb3'), 0.1, fz('usb3')], layer: 2 },
    { id: 'usb2', num: 12, name: 'USB 2.0 埠（黑色）', quiz: '找出黑色的 USB 2.0 埠', desc: '鍵盤、滑鼠、USB 麥克風、接 Arduino 的 USB 線，插這兩個就夠了，把藍色的留給需要速度的裝置。', at: [fx('usb2'), 0.1, fz('usb2')], layer: 2 },
    { id: 'wifi', num: 13, name: 'Wi-Fi／藍牙模組', quiz: '找出 Wi-Fi 和藍牙晶片的金屬屏蔽罩', desc: '左上角那個銀色小金屬罩底下是無線晶片，同時負責 2.4／5 GHz Wi-Fi 和藍牙 5.0。用藍牙連遊戲手把遙控機器人，就是靠它。', at: [fx('wifi'), 0.1, fz('wifi')], layer: 2.4 },
    { id: 'antenna', num: 14, name: '無線天線', quiz: '找出 Wi-Fi 天線所在的板角', desc: '無線模組旁邊、板子最左上角那一小塊就是天線。把 Pi 裝進金屬外殼或貼在馬達旁邊，訊號會明顯變差。', at: [fx('antenna'), 0.02, fz('antenna')], layer: 2.4 },
    { id: 'usbCtl', num: 15, name: 'VL805 USB 3.0 控制晶片', quiz: '找出負責 USB 3.0 的控制晶片', desc: 'BCM2711 本身沒有 USB 3.0，所以另外放了這顆 VIA VL805，透過 PCIe 和 SoC 相連，再分出四個 USB 埠。', at: [fx('usbCtl'), 0.05, fz('usbCtl')], layer: 1.4 },
    { id: 'pmic', num: 16, name: '電源管理晶片（PMIC）', quiz: '找出把 5 V 分成各種電壓的電源管理晶片', desc: '把 USB-C 進來的 5 V 轉成 SoC、記憶體、GPIO 各自需要的電壓（3.3 V、1.8 V、1.1 V……）。GPIO 的 3V3 腳也是它供應的。', at: [fx('pmic'), 0.05, fz('pmic')], layer: 1.4 },
    { id: 'poe', num: 17, name: 'PoE 排針', quiz: '找出網路孔旁邊的 4 支 PoE 排針', desc: '網路孔旁邊的 2 × 2 小排針，接上 PoE HAT 後，Pi 就能從支援 PoE 的網路交換器取電，固定式的監控機器人很適合。', at: [fx('poe'), 0, fz('poe')], layer: 1.8 },
    { id: 'pwrLed', num: 18, name: '紅色電源燈（PWR）', quiz: '找出紅色的電源指示燈', desc: '有電就亮。如果它在閃或熄掉，代表電壓不足，先換一個 5 V／3 A 的電源。', at: [fx('pwrLed'), 0.05, fz('pwrLed')], layer: 1 },
    { id: 'actLed', num: 19, name: '綠色活動燈（ACT）', quiz: '找出讀寫 SD 卡時會閃的綠燈', desc: '讀寫 microSD 卡時會閃。開不了機時它的閃法就是錯誤代碼：例如長閃 4 次、短閃 4 次代表找不到開機檔案。關機後等它不再閃，才能拔電源。', at: [fx('actLed'), 0.05, fz('actLed')], layer: 1 },
  ],
  strengths: [
    '一整台 Linux 電腦：可以用 Python、C++、Node.js 寫程式，直接在板子上編輯、執行，不用每次從電腦上傳',
    '算力夠跑相機影像辨識、語音辨識、小型 AI 模型，還能跑機器人作業系統 ROS 2',
    'Wi-Fi、藍牙、有線網路、4 個 USB 都內建，遠端用 SSH 或 VNC 操控很方便',
    'CSI 接頭插上官方相機就能錄影、拍照、做電腦視覺',
    '社群和教學資源非常多，幾乎任何感測器都找得到 Python 範例',
  ],
  pitfalls: [
    '沒有類比輸入：旋鈕、光敏電阻、類比感測器都不能直接讀，要外接 ADC 晶片（MCP3008、ADS1115），或交給 Arduino 讀完再傳給 Pi',
    'GPIO 只能 3.3 V：接 5 V 的訊號（例如 HC-SR04 的 ECHO）會燒壞晶片，要先用電阻分壓或電位轉換模組',
    '程式裡的 GPIO 編號（BCM）和實體腳號不同：LED(17) 要接實體第 11 腳，不是第 17 腳',
    '直接拔電源可能讓 microSD 卡上的系統損毀；關機請用 sudo shutdown now',
    '電源不足（閃電圖示）會讓系統變慢、USB 裝置斷線；一定要用 5 V／3 A 的電源',
    'Linux 不是即時系統：軟體 PWM 會抖，伺服機請用硬體 PWM 腳（GPIO18 等）配合 pigpio，或外接 PCA9685 舵機驅動板',
    '單支 GPIO 建議 16 mA 以內，全部加起來不要超過約 50 mA；馬達一定要用馬達驅動板',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '實體第 1、17 腳是 3.3 V；第 2、4 腳是 5 V，直接連到 USB-C 電源。5V 腳可以給模組供電，但千萬別碰到任何 GPIO。' },
    { title: '接地', kind: 'gnd', body: '共有 8 支 GND（第 6、9、14、20、25、30、34、39 腳），全部相通。外接電源一定要和這裡共地。' },
    { title: '一般 GPIO', kind: 'digital', body: '程式裡寫 BCM 編號：LED(17)、Button(27)。每支都有內建上拉／下拉電阻，gpiozero 的 Button 預設就會開上拉。' },
    { title: '硬體 PWM', kind: 'pwm', body: 'GPIO12、13、18、19 有硬體 PWM（兩個通道），脈衝時間由硬體產生，不受 Linux 忙碌影響，驅動伺服機最穩。其他腳也能用軟體 PWM 調 LED 亮度。' },
    { title: '通訊匯流排', kind: 'bus', body: 'I²C 在 GPIO2（SDA）、GPIO3（SCL）；SPI0 在 GPIO10、9、11、8、7；序列埠在 GPIO14（TXD）、GPIO15（RXD）。要先用 raspi-config 打開對應的介面。' },
    { title: '保留腳', kind: 'nc', body: 'ID_SD、ID_SC（第 27、28 腳）保留給 HAT 擴充板的 EEPROM，開機時 Pi 用它認出擴充板，一般專題別接。' },
  ],
  code: {
    title: '第一支程式：用 Python 讓 LED 閃爍',
    lang: 'PYTHON',
    source: `# 存成 blink.py，在 Pi 的終端機輸入：python3 blink.py
# gpiozero 已經內建在 Raspberry Pi OS 裡，不用另外安裝
from gpiozero import LED
from time import sleep

led = LED(17)          # BCM 編號 17＝實體第 11 腳

while True:
    led.on()           # GPIO17 輸出 3.3 V
    print("亮")
    sleep(0.5)         # 單位是「秒」，不是毫秒
    led.off()
    print("滅")
    sleep(0.5)

# 按 Ctrl＋C 結束程式`,
  },
  projects: [
    '相機循線車：用 OpenCV 找出地上的黑線，算出方向再控制馬達',
    'ROS 2 自走機器人：Pi 跑導航和地圖，Arduino 負責馬達和編碼器',
    '人臉追蹤雲台：相機找到人臉，兩顆伺服機轉頭跟著看',
    '語音助理機器人：USB 麥克風收音，辨識指令後用喇叭回答',
    '網頁遙控巡邏車：Flask 開一個網頁，手機上就能看即時影像和開車',
  ],
  facts: [
    'Raspberry Pi 由英國劍橋的 Raspberry Pi 基金會推動，最初的目標是讓學生買得起一台能寫程式的電腦；第一代在 2012 年推出。',
    'Pi 4 在 2019 年 6 月發表，8 GB 版本在 2020 年才加入；官方承諾這塊板子至少生產到 2034 年 1 月，適合需要長期供貨的專案。',
    '第一批 Pi 4 的 USB-C 線路有小瑕疵，遇到某些帶晶片的高階 USB-C 線會認不出來，之後的版本才修正。',
    'Pi 4 沒有重開機按鈕：關機後把 GPIO3（實體第 5 腳）短暫接到 GND，就能把它叫醒。',
    'Raspberry Pi 4 不需要 Arduino IDE：程式就在 Pi 自己的 Linux 上執行，寫完直接 python3 檔名.py 就會跑。',
  ],
  quiz: [
    { part: 'soc', prompt: '找出 Pi 的大腦：四核心處理器在哪裡？', hint: '板子正中央、反光的銀色正方形金屬蓋。', explain: 'BCM2711 系統單晶片把 CPU、GPU 和影像解碼器整合在一起。' },
    { part: 'gpio', prompt: 'LED、按鈕、感測器要接在哪裡？', hint: '沿著板子長邊的兩排長長的金色排針。', explain: '40 腳 GPIO 排針，程式裡用的是 BCM 編號。' },
    { part: 'sd', prompt: 'Pi 的作業系統裝在哪裡？', hint: '它不在正面。翻到背面，看左端的金屬卡槽。', explain: 'microSD 卡就是 Pi 的硬碟，直接拔電源可能讓它損毀。' },
    { part: 'usbc', prompt: '要幫 Pi 4 供電，電源線插哪裡？', hint: '靠近你這一側、最左邊的小橢圓接頭。', explain: 'USB-C 需要 5 V／3 A，不足時會出現閃電圖示。' },
    { part: 'hdmi', prompt: '要接螢幕，該找哪個接頭？', hint: '靠近你這一側、中間兩個一模一樣的小接頭。', explain: '兩個 micro-HDMI，單螢幕時插靠近 USB-C 的 HDMI0。' },
    { part: 'usb3', prompt: '外接 SSD 想要最快的速度，要插哪一組 USB？', hint: '右側中間那組，舌片是藍色的。', explain: '藍色的是 USB 3.0，比黑色的 USB 2.0 快約十倍。' },
    { part: 'eth', prompt: '要插有線網路線，接頭在哪裡？', hint: '右側最遠那個、最大的方形金屬接頭。', explain: 'Gigabit 網路孔，加 PoE HAT 還能用網路線供電。' },
    { part: 'csi', prompt: '相機模組的排線要插在哪裡？', hint: '標著 CAMERA，在 HDMI 和耳機孔之間的細長接頭。', explain: 'CSI 接頭專門接相機，拉開卡榫插入排線再壓回去。' },
    { part: 'actLed', prompt: '關機時要等哪顆燈不再閃，才能拔電源？', hint: 'USB-C 旁邊、板子最左邊緣的兩顆小燈，綠色那顆。', explain: 'ACT 燈代表正在讀寫 SD 卡。' },
    { part: 'wifi', prompt: '藍牙手把要靠哪個晶片連線？', hint: '左上角、靠近排針起點的銀色小方罩。', explain: 'Wi-Fi／藍牙模組同時負責 Wi-Fi 5 和藍牙 5.0。' },
    { part: 'ram', prompt: '1 GB 還是 8 GB？看哪顆晶片就知道？', hint: '大腦右邊那顆黑色晶片。', explain: 'LPDDR4 記憶體晶片的型號決定容量。' },
  ],
};

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

/** 工作台上 Pi 墊著 3 mm 的銅柱，PCB 頂面距台面 0.45 cm */
export const RPI_BENCH_LIFT = 0.45;
/** 排針針尖高度（相對 PCB 頂面）；杜邦線母頭就套在這裡 */
export const RPI_PIN_TOP = 0.85;

export const rpi4Data: BoardData = {
  id: 'rpi4',
  short: 'Pi 4',
  summary: BOARDS.find((b) => b.id === 'rpi4')!,
  lesson: rpi4Lesson,
  w: RPI_W,
  d: RPI_D,
  pins: RPI_PINS,
  internalNets: RPI_INTERNAL_NETS,
  // 5V 腳用 'VIN' 這個 id：模擬器才會把它當成「不能碰 GPIO 的 5 V」來檢查
  supply: [],
  gnd: ['GND1', 'GND2', 'GND3', 'GND4', 'GND5', 'GND6', 'GND7', 'GND8'],
  analogOnly: [],
  logicV: 3.3,
  // Pi 的 ACT 燈不接在排針上：給一個不存在的腳，任務改看外接 LED
  ledPin: 'ACT',
  inputOnly: [],
  strapLow: [],
  // 序列埠不是用來上傳程式的，接東西不用警告
  serialPins: [],
  header: '排針',
  footprints: RPI_FOOTPRINTS,
  mx: rx,
  mz: rz,
  tray: {
    gpio: [0, 3.8],
    eth: [6.6, -2.3],
    usb3: [8.9, -2.3],
    usb2: [11.1, -2.3],
    soc: [6.4, -0.2],
    ram: [8.3, -0.2],
    wifi: [9.9, -0.2],
    usbCtl: [11.3, -0.2],
    csi: [12.6, 1.9],
    dsi: [13.4, 1.9],
    ...smallTray(['hdmi', 'usbc', 'audio', 'pmic'], 6.7, 1.7, 1.75, 0, 4),
    ...smallTray(['poe', 'antenna', 'pwrLed', 'actLed'], 6.6, 3.4, 1.3, 0, 4),
  },
  stage: {
    floorY: -0.32,
    pinY: RPI_PIN_TOP,
    explodeLift: 0.7,
    views: {
      iso: [8.2, 10.6, 13.2, 0.4, 0.2, 0.2],
      top: [0, 17.5, 0.01, 0, 0, 0],
      bottom: [0, -16.5, 0.6, 0, 0, 0],
      front: [0, 3.6, 16.0, 0.4, 0.4, 0],
    },
    asmCam: [4.6, 23.0, 7.6, 4.6, 0, 0.2],
  },
  bench: {
    pos: [-4.5, 0, -0.4],
    half: [4.4, 2.95],
    lift: RPI_BENCH_LIFT,
    pin: (p) => [p.x, RPI_BENCH_LIFT + RPI_PIN_TOP, p.z],
  },
};
