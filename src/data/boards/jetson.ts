import type { BoardLesson, PinDef, PinKind } from '../types';
import type { BoardData } from './registry';
import { BOARDS } from './index';

/**
 * NVIDIA Jetson Orin Nano Super 開發者套件（載板 P3768＋Orin Nano 8GB 模組）。
 * 載板約 100 × 79 mm；整套含散熱器與腳墊 103 × 90.5 × 34.8 mm。
 *
 * 擺法：為了方便在工作台上接線，讓 40 腳擴充排針 J12 靠近觀看者（+z），
 * I/O 面板（USB-C、網路孔、4 個 USB-A、DisplayPort、DC 電源孔）在遠側長邊，
 * 兩個 CSI 相機接頭在右側短邊，三個 M.2 插槽在背面。
 * 接頭沿著板邊的先後順序參考 NVIDIA 使用手冊的編號圖；精確座標是依外觀比例估計的，教學用。
 */
export const JET_W = 10.0;
export const JET_D = 7.9;
export const JET_PCB_T = 0.16;
/** 模組 PCB 底面距載板頂面的高度（SO-DIMM 連接器撐起來的空間），cm */
export const JET_MOD_Y = 0.55;
export const JET_MOD_T = 0.12;

/** 板子圖面座標（mm，原點左下角＝靠近觀看者的左角，y 往遠側）→ 3D 座標（cm，原點中心） */
export const jx = (mm: number) => mm / 10 - JET_W / 2;
export const jz = (mm: number) => JET_D / 2 - mm / 10;

const P = 2.54;
/** J12 排針中心 */
export const JET_HDR_X = 28.0;
export const JET_HDR_Y = 3.6;
/** 偶數腳（2、4、6…）在板邊那排，奇數腳（1、3、5…）在內側那排 */
const ODD_Y = JET_HDR_Y + P / 2;
const EVEN_Y = JET_HDR_Y - P / 2;
const COL0 = JET_HDR_X - 9.5 * P;

type Row = [id: string, label: string, kind: PinKind, desc: string];

/**
 * 40 支腳照實體腳號 1–40 排列。可以被程式控制的腳 id 一律用「PIN＋實體腳號」，
 * 和 Jetson.GPIO 的 BOARD 模式一致：程式寫 12，就是排針上的第 12 腳，不用再對照表。
 * 訊號名稱依 Orin Nano 開發者套件的 J12 腳位表。
 */
const HEADER: Row[] = [
  ['3V3', '3V3（第 1 腳）', 'power', '3.3 V 輸出，給感測器、上拉電阻用；電流有限，不要拿來推馬達'],
  ['VIN', '5V（第 2 腳）', 'power', '5 V 電源，可以給 5 V 模組供電，但絕對不能接到任何訊號腳'],
  ['PIN3', '第 3 腳', 'bus', 'I2C1_SDA（Linux 的 I²C 匯流排 7）。I²C 預設就是開啟的，用 i2cdetect -y -r 7 可以掃描裝置'],
  ['VIN2', '5V（第 4 腳）', 'power', '和第 2 腳相通的 5 V'],
  ['PIN5', '第 5 腳', 'bus', 'I2C1_SCL（I²C 匯流排 7 的時脈）'],
  ['GND1', 'GND（第 6 腳）', 'gnd', '接地，8 支 GND 全部相通'],
  ['PIN7', '第 7 腳', 'digital', 'GPIO09（也可當 AUDIO_MCLK）；預設是一般 GPIO'],
  ['PIN8', '第 8 腳', 'bus', 'UART1 的 TXD（Jetson 送出）。接 Arduino、ESP32 的序列埠時，記得 TX 對 RX'],
  ['GND2', 'GND（第 9 腳）', 'gnd', '接地'],
  ['PIN10', '第 10 腳', 'bus', 'UART1 的 RXD（Jetson 接收）'],
  ['PIN11', '第 11 腳', 'digital', 'UART1_RTS；預設當一般 GPIO 用'],
  ['PIN12', '第 12 腳', 'digital', 'I2S0_SCLK；預設是一般 GPIO，NVIDIA 範例程式常拿它接 LED'],
  ['PIN13', '第 13 腳', 'digital', 'SPI1_SCK；預設是一般 GPIO'],
  ['GND3', 'GND（第 14 腳）', 'gnd', '接地，就在第 12 腳隔壁'],
  ['PIN15', '第 15 腳', 'pwm', 'GPIO12，可以切成硬體 PWM（要先用 jetson-io.py 開啟再重開機），驅動伺服機最穩'],
  ['PIN16', '第 16 腳', 'digital', 'SPI1_CS1；預設是一般 GPIO'],
  ['3V3b', '3V3（第 17 腳）', 'power', '和第 1 腳相通的 3.3 V'],
  ['PIN18', '第 18 腳', 'digital', 'SPI1_CS0；預設是一般 GPIO，NVIDIA 範例常拿它接按鈕'],
  ['PIN19', '第 19 腳', 'digital', 'SPI0_MOSI；用 jetson-io.py 開啟 SPI 後才變成 SPI 腳'],
  ['GND4', 'GND（第 20 腳）', 'gnd', '接地'],
  ['PIN21', '第 21 腳', 'digital', 'SPI0_MISO'],
  ['PIN22', '第 22 腳', 'digital', 'SPI1_MISO'],
  ['PIN23', '第 23 腳', 'digital', 'SPI0_SCK'],
  ['PIN24', '第 24 腳', 'digital', 'SPI0_CS0'],
  ['GND5', 'GND（第 25 腳）', 'gnd', '接地'],
  ['PIN26', '第 26 腳', 'digital', 'SPI0_CS1'],
  ['PIN27', '第 27 腳', 'bus', 'I2C0_SDA（I²C 匯流排 1）。這條匯流排上本來就掛著板上的裝置，自己的感測器建議接第 3、5 腳'],
  ['PIN28', '第 28 腳', 'bus', 'I2C0_SCL（I²C 匯流排 1）'],
  ['PIN29', '第 29 腳', 'digital', 'GPIO01；一般 GPIO'],
  ['GND6', 'GND（第 30 腳）', 'gnd', '接地'],
  ['PIN31', '第 31 腳', 'digital', 'GPIO11；一般 GPIO'],
  ['PIN32', '第 32 腳', 'digital', 'GPIO07；腳位表標示可當 PWM，但 Jetson.GPIO 不一定認得它，PWM 請優先用第 15、33 腳'],
  ['PIN33', '第 33 腳', 'pwm', 'GPIO13，可以切成硬體 PWM（同樣要先用 jetson-io.py 開啟）'],
  ['GND7', 'GND（第 34 腳）', 'gnd', '接地'],
  ['PIN35', '第 35 腳', 'digital', 'I2S0_FS；預設是一般 GPIO'],
  ['PIN36', '第 36 腳', 'digital', 'UART1_CTS；預設是一般 GPIO'],
  ['PIN37', '第 37 腳', 'digital', 'SPI1_MOSI；預設是一般 GPIO'],
  ['PIN38', '第 38 腳', 'digital', 'I2S0_SDIN；預設是一般 GPIO'],
  ['GND8', 'GND（第 39 腳）', 'gnd', '接地'],
  ['PIN40', '第 40 腳', 'digital', 'I2S0_SDOUT；預設是一般 GPIO'],
];

export const JET_PINS: PinDef[] = HEADER.map(([id, label, kind, desc], i) => ({
  id,
  label,
  kind,
  desc,
  x: jx(COL0 + Math.floor(i / 2) * P),
  z: jz(i % 2 === 0 ? ODD_Y : EVEN_Y),
}));

/** 實體腳號（1–40） */
export const physOfJet = (id: string) => HEADER.findIndex((r) => r[0] === id) + 1;

/** 可以被程式讀寫的訊號腳 */
export const JET_IO = JET_PINS.filter((p) => /^PIN\d+$/.test(p.id)).map((p) => p.id);

export const JET_INTERNAL_NETS: string[][] = [
  ['3V3', '3V3b'],
  ['VIN', 'VIN2'],
  ['GND1', 'GND2', 'GND3', 'GND4', 'GND5', 'GND6', 'GND7', 'GND8'],
];

/** 模組（SO-DIMM）在載板上的位置與大小，mm */
export const JET_MOD = { x: 58.0, y: 34.0, w: 69.6, h: 45.0 };
/** 兩個 CSI 接頭的 y（mm），在右側短邊 */
export const JET_CAM_Y = { cam0: 30.0, cam1: 50.0 };
export const JET_CAM_X = 96.5;

/** 零件外框（mm：中心 x, y, 寬, 高）；I/O 接頭會稍微超出遠側板邊，和實物一樣 */
export const JET_FOOTPRINTS: Record<string, [number, number, number, number]> = {
  som: [JET_MOD.x, JET_MOD.y, JET_MOD.w, JET_MOD.h],
  soc: [54.0, 36.0, 15, 15],
  ram: [70.0, 36.0, 12, 14],
  heatsink: [JET_MOD.x, JET_MOD.y, 64, 42],
  fan: [JET_MOD.x, JET_MOD.y, 40, 40],
  sd: [84.0, 13.5, 12, 12],
  gpio: [JET_HDR_X, JET_HDR_Y, 50.8, 5.08],
  btn: [5.0, 30.0, 5.08, 15.24],
  sodimm: [JET_MOD.x, 54.5, 70, 5],
  usbc: [8.0, 75.5, 9, 7.5],
  eth: [24.0, 71.5, 16, 21.5],
  usb: [50.0, 72.0, 32, 17.5],
  dp: [74.0, 74.0, 19, 12],
  dcjack: [90.0, 72.5, 9, 14],
  csi: [JET_CAM_X, 40.0, 4, 36],
  pwrLed: [6.2, 9.0, 1.6, 0.8],
  m2m80: [50.0, 30.0, 80, 22],
  m2m30: [28.0, 58.0, 30, 22],
  wifi: [74.0, 58.0, 30, 22],
};

const fx = (id: string) => jx(JET_FOOTPRINTS[id][0]);
const fz = (id: string) => jz(JET_FOOTPRINTS[id][1]);

export const jetsonLesson: BoardLesson = {
  summary:
    'Jetson Orin Nano Super 開發者套件是 NVIDIA 給機器人和邊緣 AI 用的小電腦：一片插在載板上的運算模組，裡面有 6 核心 Arm 處理器，加上一顆擁有 1024 個 CUDA 核心、32 個 Tensor 核心的 GPU，AI 算力 67 TOPS。它和 Raspberry Pi 一樣跑 Linux、有 40 腳排針，最大的不同是那顆 GPU：相機畫面不用傳到雲端，在機器人身上就能即時認出人、車、手勢，速度快到每秒處理幾十張畫面。做機器人時，它通常當「看得見的大腦」，馬達和即時控制再交給 Arduino、ESP32 這類小板子。',
  stats: [
    { k: 'AI 算力', v: '67 TOPS' },
    { k: 'GPU', v: '1024 CUDA' },
    { k: 'CPU', v: '6 × 1.7 GHz' },
    { k: 'RAM', v: '8 GB' },
    { k: '邏輯電壓', v: '3.3 V' },
    { k: '參考價', v: '≈ US$249' },
  ],
  specs: [
    { k: '運算模組', v: 'Jetson Orin Nano 8GB，260 腳 SO-DIMM 規格，插在開發者套件的載板上' },
    { k: 'CPU', v: '6 核心 Arm Cortex-A78AE（64 位元），Super 模式最高 1.7 GHz' },
    { k: 'GPU', v: 'NVIDIA Ampere 架構：1024 個 CUDA 核心＋32 個 Tensor 核心' },
    { k: 'AI 算力', v: '67 TOPS（INT8、稀疏運算的峰值）；原版開發者套件更新到 JetPack 6.2 也能解鎖' },
    { k: '記憶體', v: '8 GB LPDDR5，頻寬 102 GB/s，CPU 和 GPU 共用同一塊' },
    { k: '儲存', v: '模組上的 microSD 卡槽；載板背面兩個 M.2 Key-M 插槽可裝 NVMe SSD（2280 是 PCIe 3.0 ×4、2230 是 ×2）' },
    { k: '作業系統', v: 'JetPack 6（以 Ubuntu 22.04 為基礎的 Jetson Linux，內含 CUDA、cuDNN、TensorRT）' },
    { k: '相機', v: '2 個 MIPI CSI-2 接頭（22 腳、0.5 mm 間距）：CAM0 是 2 lane，CAM1 可用 2 或 4 lane；也能插 USB 相機' },
    { k: '影像輸出', v: '只有 DisplayPort；不支援 HDMI 和 USB-C 輸出畫面，要接 HDMI 螢幕得用 DP 轉 HDMI 轉接頭' },
    { k: 'USB', v: '4 個 USB 3.2 Type-A（10 Gbps）＋1 個 USB-C（只傳資料，也是刷機用的 Recovery 埠）' },
    { k: '網路', v: 'Gigabit 有線網路；背面 M.2 Key-E 插槽已附 Wi-Fi／藍牙網卡' },
    { k: 'GPIO', v: '40 腳擴充排針 J12，排列和 Raspberry Pi 相容；2 組 I²C、UART、SPI、2 支硬體 PWM' },
    { k: '邏輯電壓', v: '3.3 V（不能接 5 V 訊號）' },
    { k: '供電', v: 'DC 圓孔 5.5 × 2.5 mm，原廠附 19 V 變壓器；USB-C 不能拿來供電' },
    { k: '功耗模式', v: '7 W 到 25 W 之間可選，另有不設功耗上限、時脈最高的 MAXN SUPER' },
    { k: '尺寸', v: '整套 103 × 90.5 × 34.8 mm（含散熱器、風扇與腳墊）' },
  ],
  parts: [
    { id: 'som', num: 1, name: 'Orin Nano 8GB 運算模組', quiz: '找出插在載板上的運算模組', desc: '真正的電腦其實是這片小小的模組：處理器、GPU、記憶體都在上面，像筆電記憶體一樣斜插進 SO-DIMM 插槽、再壓平固定。底下那片大的叫「載板」，只負責把訊號拉成各種接頭。量產機器人時，可以只買模組，配自己設計的載板。', at: [fx('som'), JET_MOD_Y + 0.06, fz('som')], layer: 2.6 },
    { id: 'soc', num: 2, name: 'Orin 系統單晶片（CPU＋GPU）', quiz: '找出藏在散熱器底下的 AI 大腦', desc: '6 顆 Cortex-A78AE 處理器核心和 1024 個 CUDA 核心的 Ampere GPU 全在這顆晶片裡。GPU 適合同時做大量相同的小計算，正好就是神經網路需要的；Tensor 核心更專門加速矩陣乘法，67 TOPS 的算力主要來自它們。', at: [fx('soc'), JET_MOD_Y + 0.2, fz('soc')], layer: 3.2 },
    { id: 'ram', num: 3, name: 'LPDDR5 記憶體', quiz: '找出 8 GB 的 LPDDR5 記憶體', desc: 'CPU 和 GPU 共用這 8 GB，不用像桌機顯示卡那樣把資料搬來搬去，相機畫面一進來 GPU 就能直接用。跑大型語言模型時，模型大小幾乎就被這 8 GB 卡住，所以邊緣端常用壓縮過（量化）的小模型。', at: [fx('ram'), JET_MOD_Y + 0.2, fz('ram')], layer: 3.2 },
    { id: 'heatsink', num: 4, name: '鋁製散熱器', quiz: '找出蓋在模組上的大塊散熱鰭片', desc: '滿載時模組會吃到 25 W 左右，熱量全靠這塊鋁鰭片帶走。溫度太高時晶片會自動降頻，AI 的 FPS 就跟著掉；把它裝進密閉機殼時，一定要留進出風的路。', at: [fx('heatsink'), 1.3, fz('heatsink')], layer: 4.0 },
    { id: 'fan', num: 5, name: 'PWM 散熱風扇', quiz: '找出散熱器上的風扇', desc: '系統會依溫度用 PWM 自動調整轉速：開機時轉一下，跑 AI 時才轉快。風扇一直狂轉，通常代表正在跑重的模型，或是功耗模式開到最高。', at: [fx('fan'), 2.1, fz('fan')], layer: 4.8 },
    { id: 'gpio', num: 6, name: '40 腳擴充排針（J12）', quiz: '找出接 LED、按鈕、感測器的 40 腳排針', desc: '排列刻意和 Raspberry Pi 一樣，很多 Pi 的擴充板（HAT）都插得上去。Jetson.GPIO 函式庫的用法也模仿 RPi.GPIO。建議用 BOARD 模式：程式裡寫的數字就是排針上的實體腳號，例如 12 就是第 12 腳。', at: [fx('gpio'), 0, fz('gpio')], layer: 2.2 },
    { id: 'sd', num: 7, name: 'microSD 卡槽（在模組上）', quiz: '找出放作業系統的 microSD 卡槽', desc: '卡槽不在載板上，而是在模組底下靠前的邊緣，要從散熱器下面把卡推進去。整個 JetPack 系統就裝在這張卡裡；想要更快的開機和模型載入，可以改把系統裝在背面的 NVMe SSD。', at: [fx('sd'), 0.45, fz('sd')], layer: 1.4 },
    { id: 'dcjack', num: 8, name: 'DC 電源孔（19 V）', quiz: '找出接變壓器的 DC 電源孔', desc: '5.5 × 2.5 mm 的圓孔，接原廠附的 19 V 變壓器。這塊板子沒有電源開關，插上電就自動開機。機器人上通常用降壓模組或電池直接供電，電壓和電流都要留餘裕，不然跑 AI 時會掉電當機。', at: [fx('dcjack'), 0.1, fz('dcjack')], layer: 1.6 },
    { id: 'dp', num: 9, name: 'DisplayPort 輸出', quiz: '找出這塊板子唯一的螢幕輸出', desc: '整塊板子只有這一個影像輸出，沒有 HDMI。手邊只有 HDMI 螢幕時，買一條 DP 轉 HDMI 的轉接線就行。做機器人時常常不接螢幕，改用網路遠端登入（SSH）。', at: [fx('dp'), 0.1, fz('dp')], layer: 1.6 },
    { id: 'usb', num: 10, name: '4 個 USB 3.2 Type-A', quiz: '找出接鍵盤、相機、光達的 USB 埠', desc: '兩組雙層 USB-A，每個 10 Gbps，每一組最多供 3 A。USB 相機、深度相機、光達、鍵盤滑鼠都插這裡。', at: [fx('usb'), 0.1, fz('usb')], layer: 2 },
    { id: 'eth', num: 11, name: 'Gigabit 網路孔', quiz: '找出插網路線的 RJ45 接頭', desc: '第一次設定、或要把相機畫面串流回電腦時，有線網路最穩定。接上網路線後，就能從電腦用 SSH 登入 Jetson 寫程式。', at: [fx('eth'), 0.1, fz('eth')], layer: 2 },
    { id: 'usbc', num: 12, name: 'USB-C（資料／刷機）', quiz: '找出只傳資料、不能供電的 USB-C', desc: '這個 USB-C 不能給板子供電！它是用來接電腦的：可以當 USB 裝置（電腦會看到一個網路介面，Jetson 的位址是 192.168.55.1），也是重新刷系統時的 Recovery 埠。', at: [fx('usbc'), 0.1, fz('usbc')], layer: 1.6 },
    { id: 'csi', num: 13, name: '兩個 MIPI CSI 相機接頭', quiz: '找出接相機排線的兩個 CSI 接頭', desc: 'CAM0、CAM1 兩個 22 腳排線接頭，相機畫面直接進到晶片裡的影像處理器，比 USB 相機延遲更低、也不吃 CPU。Raspberry Pi 相機模組 v2 是 15 腳排線，要換一條 15 轉 22 腳的線才能接。', at: [fx('csi'), 0.1, fz('csi')], layer: 1.2 },
    { id: 'btn', num: 14, name: '按鍵排針（J14）', quiz: '找出接電源鍵、重開機與 Recovery 跳線的排針', desc: '12 支腳，可以外接電源鍵、重開機鍵。最常用的是 Recovery：把 FC REC 和旁邊的 GND 用跳線帽短路再通電，板子就會進入刷機模式，讓電腦重新灌系統。', at: [fx('btn'), 0, fz('btn')], layer: 1.8 },
    { id: 'sodimm', num: 15, name: 'SO-DIMM 260 腳插槽', quiz: '找出模組插進去的長條插槽', desc: '模組的金手指就插在這條插槽裡，260 支接點把 PCIe、USB、相機、GPIO 等所有訊號接到載板。拆模組前要先斷電，再把兩側的卡榫往外扳開。', at: [fx('sodimm'), 0.2, fz('sodimm')], layer: 1.4 },
    { id: 'm2m80', num: 16, name: 'M.2 Key-M 2280 插槽（背面）', quiz: '找出背面可以裝長條 NVMe SSD 的插槽', desc: 'PCIe 3.0 ×4，可以裝一般長度（80 mm）的 NVMe SSD。系統裝在 SSD 上，開機、載入模型、存錄影都比 microSD 快很多，是最值得的升級。', at: [fx('m2m80'), -0.2, fz('m2m80')], layer: -1.6, side: 'bottom' },
    { id: 'm2m30', num: 17, name: 'M.2 Key-M 2230 插槽（背面）', quiz: '找出背面那個短的 M.2 插槽', desc: 'PCIe 3.0 ×2，只能裝 30 mm 長的小 SSD。可以拿來當第二顆硬碟存資料集和錄影。', at: [fx('m2m30'), -0.2, fz('m2m30')], layer: -1.6, side: 'bottom' },
    { id: 'wifi', num: 18, name: 'Wi-Fi／藍牙網卡（M.2 Key-E，背面）', quiz: '找出背面那張 Wi-Fi 網卡', desc: '開發者套件附的無線網卡插在背面的 Key-E 插槽，兩條細細的天線線接到外面的天線。機器人在場地上跑時，就靠它讓電腦連進來看畫面。', at: [fx('wifi'), -0.2, fz('wifi')], layer: -1.6, side: 'bottom' },
    { id: 'pwrLed', num: 19, name: '電源指示燈', quiz: '找出通電就會亮的電源燈', desc: '插上電就亮。燈亮了但螢幕沒畫面時，先檢查是不是插在 DisplayPort、microSD 卡有沒有裝好。', at: [fx('pwrLed'), 0.05, fz('pwrLed')], layer: 1 },
  ],
  strengths: [
    '67 TOPS 的 GPU 算力：物件偵測、人體姿勢、深度估計、小型語言模型都能直接在機器人上跑，不用連雲端',
    'CUDA、cuDNN、TensorRT 都內建在 JetPack：PyTorch 訓練好的模型轉成 TensorRT 引擎後，速度常常能再快好幾倍',
    '兩個 CSI 相機接頭＋4 個 USB 3.2，雙眼相機、深度相機、光達一次接上',
    '一樣是 Linux 電腦：Python、ROS 2、OpenCV、Docker 都能用，40 腳排針的寫法和 Raspberry Pi 很像',
    '背面有 NVMe SSD 插槽，系統和資料集都能放在快速的固態硬碟上',
  ],
  pitfalls: [
    'USB-C 不能供電！一定要用 DC 圓孔接 19 V 變壓器（或規格相符的電源），用手機充電器是開不了機的',
    'Jetson.GPIO 會忽略 pull_up_down 參數：沒辦法用程式開內建上拉，按鈕一定要自己加 10kΩ 上拉（或下拉）電阻，不然沒按時讀值會亂跳',
    '排針的 3.3 V 訊號經過電位轉換晶片，推力很弱：LED 只適合當指示燈，繼電器、馬達、大量 LED 一定要透過電晶體或驅動板',
    '硬體 PWM（第 15、33 腳）預設沒開，要先執行 sudo /opt/nvidia/jetson-io/jetson-io.py 設定、重開機後才能用',
    '只有 DisplayPort，沒有 HDMI；也沒有影片硬體編碼器，錄影或串流壓縮影片要靠 CPU',
    '功耗模式會大幅影響速度：AI 跑太慢時，先看是不是停在低功耗模式，或是散熱不良在降頻',
    'Linux 不是即時系統：馬達的 PID、編碼器計數交給 Arduino、ESP32，Jetson 專心做視覺和決策',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '第 1、17 腳是 3.3 V；第 2、4 腳是 5 V。5V 腳可以給模組供電，但千萬別碰到任何訊號腳。' },
    { title: '接地', kind: 'gnd', body: '共有 8 支 GND（第 6、9、14、20、25、30、34、39 腳），全部相通；外接電源一定要和這裡共地。' },
    { title: '一般 GPIO', kind: 'digital', body: '除了電源、GND、I²C、UART，其他腳預設都是 GPIO。Jetson.GPIO 用 GPIO.setmode(GPIO.BOARD) 之後，程式裡的數字就是實體腳號。注意：不能用程式開內建上拉電阻。' },
    { title: '硬體 PWM', kind: 'pwm', body: '第 15、33 腳可以切成硬體 PWM，用 GPIO.PWM(腳號, 頻率) 產生精準的脈衝，驅動伺服機或調 LED 亮度。要先用 jetson-io.py 開啟。' },
    { title: '通訊匯流排', kind: 'bus', body: 'I²C 有兩組：第 3、5 腳是匯流排 7，第 27、28 腳是匯流排 1；序列埠 UART1 在第 8（TXD）、10（RXD）腳。SPI 在第 19、21、23、24、26 腳，要先用 jetson-io.py 開啟。' },
  ],
  code: {
    title: '第一支程式：用 Jetson.GPIO 讓 LED 閃爍',
    lang: 'PYTHON',
    source: `# 存成 blink.py，在終端機輸入：python3 blink.py
import Jetson.GPIO as GPIO   # JetPack 已內建，用法和 RPi.GPIO 幾乎一樣
import time

LED = 12                     # 排針上的第 12 腳
GPIO.setmode(GPIO.BOARD)     # BOARD 模式：數字＝實體腳號
GPIO.setup(LED, GPIO.OUT, initial=GPIO.LOW)

try:
    while True:
        GPIO.output(LED, GPIO.HIGH)   # 3.3 V：燈亮
        time.sleep(0.5)               # 單位是秒
        GPIO.output(LED, GPIO.LOW)    # 0 V：燈滅
        time.sleep(0.5)
finally:
    GPIO.cleanup()           # 按 Ctrl＋C 結束時，把腳位恢復成輸入`,
  },
  projects: [
    '會認人的迎賓機器人：CSI 相機偵測到人就揮手、說歡迎光臨',
    '自走車避障：深度相機加物件偵測，看到行人自動減速繞開',
    '分類機械手臂：相機辨識瓶罐種類，告訴 Arduino 把它推進對應的回收桶',
    '人體姿勢遙控：對著相機舉手、揮手，機器人就前進、轉彎',
    '會聊天的桌上機器人：在 Jetson 上跑小型語言模型和語音辨識，不用連網路',
  ],
  facts: [
    'Jetson Orin Nano Super 開發者套件在 2024 年 12 月推出，售價 249 美元，大約是前一代開發者套件的一半。',
    '「Super」不是新硬體：原版 Orin Nano 開發者套件更新到 JetPack 6.2 後，GPU 和記憶體的時脈拉高，一樣能解鎖 Super 的效能。',
    'CPU 型號 Cortex-A78AE 的「AE」是 Automotive Enhanced（車用強化），可以把兩顆核心鎖在一起互相比對結果，這是汽車安全系統用的設計。',
    'TOPS 是「每秒兆次運算」。67 TOPS 是用 8 位元整數、並且利用稀疏運算算出來的峰值；實際模型能跑多快，還要看模型大小和最佳化做得好不好。',
    'NVIDIA 刻意把 40 腳排針排得和 Raspberry Pi 一樣，所以很多 Pi 的擴充板和教學都能拿來參考。',
  ],
  quiz: [
    { part: 'usbc', prompt: '哪一個接頭看起來能插電，其實不能供電？', hint: '遠側一排接頭裡，最左邊那個小小的橢圓孔。', explain: 'USB-C 只傳資料和刷機，供電要用 DC 圓孔。' },
    { part: 'dcjack', prompt: '19 V 變壓器要插在哪裡？', hint: '遠側一排接頭裡，最右邊那個黑色圓孔。', explain: 'DC 電源孔，插上電就自動開機。' },
    { part: 'gpio', prompt: 'LED、按鈕、感測器要接在哪裡？', hint: '最靠近你的那條長長的金色雙排針。', explain: '40 腳擴充排針 J12，排列和 Raspberry Pi 相容。' },
    { part: 'csi', prompt: '相機排線要插在哪裡？', hint: '板子右側短邊的兩個細長接頭。', explain: '兩個 MIPI CSI 接頭：CAM0 和 CAM1。' },
    { part: 'dp', prompt: '要接螢幕，該找哪個接頭？', hint: '遠側一排、DC 電源孔左邊那個一邊斜角的接頭。', explain: '只有 DisplayPort，HDMI 螢幕要用轉接頭。' },
    { part: 'fan', prompt: '跑 AI 時越轉越快的是什麼？', hint: '最高的那一層，圓形的。', explain: 'PWM 風扇會依溫度自動調整轉速。' },
    { part: 'sd', prompt: '作業系統的 microSD 卡要插在哪裡？', hint: '不在載板上；看模組靠近你那一側的底下。', explain: '卡槽在模組上，從散熱器下面推進去。' },
    { part: 'eth', prompt: '要插有線網路線，接頭在哪裡？', hint: '遠側一排裡最大的方形金屬接頭。', explain: 'Gigabit 網路孔，接上後就能用 SSH 登入。' },
    { part: 'btn', prompt: '要讓板子進入刷機（Recovery）模式，跳線帽要插在哪裡？', hint: '板子左側那排 2 × 6 的小排針。', explain: '按鍵排針 J14：FC REC 和 GND 短路再通電。' },
    { part: 'm2m80', prompt: '想把系統裝在更快的 NVMe SSD，要插在哪？', hint: '翻到背面，中間那條最長的插槽。', explain: 'M.2 Key-M 2280，PCIe 3.0 ×4。' },
    { part: 'heatsink', prompt: '模組的熱量靠什麼帶走？', hint: '蓋在模組上面、一片片的金屬鰭片。', explain: '鋁製散熱器；太熱時晶片會降頻，AI 就變慢。' },
  ],
};

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols: number, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

/** 工作台上載板墊著 4 個腳座，PCB 頂面距台面 0.7 cm（背面的 M.2 卡才不會碰到桌面） */
export const JET_BENCH_LIFT = 0.7;
/** 排針針尖高度（相對 PCB 頂面）；杜邦線母頭就套在這裡 */
export const JET_PIN_TOP = 0.85;

export const jetsonData: BoardData = {
  id: 'jetson',
  short: 'Jetson',
  summary: BOARDS.find((b) => b.id === 'jetson')!,
  lesson: jetsonLesson,
  w: JET_W,
  d: JET_D,
  pins: JET_PINS,
  internalNets: JET_INTERNAL_NETS,
  // 5V 腳用 'VIN' 這個 id：模擬器才會把它當成「不能碰訊號腳的 5 V」來檢查
  supply: [],
  gnd: ['GND1', 'GND2', 'GND3', 'GND4', 'GND5', 'GND6', 'GND7', 'GND8'],
  analogOnly: [],
  logicV: 3.3,
  // 電源燈不接在排針上：給一個不存在的腳，任務改看外接 LED
  ledPin: 'PWR',
  inputOnly: [],
  // Jetson.GPIO 會忽略 pull_up_down：每支訊號腳都要自己加上拉電阻
  noPullup: JET_IO,
  strapLow: [],
  serialPins: [],
  header: '排針',
  footprints: JET_FOOTPRINTS,
  mx: jx,
  mz: jz,
  tray: {
    som: [9.9, -2.3],
    heatsink: [9.9, 2.5],
    fan: [15.4, 2.5],
    usb: [15.4, -1.6],
    sodimm: [15.4, -4.0],
    gpio: [-2.2, 5.6, 0],
    btn: [2.6, 5.6, 0],
    ...smallTray(['soc', 'ram', 'eth', 'dp', 'dcjack', 'usbc', 'csi', 'sd', 'pwrLed'], 6.6, 5.6, 2.0, 1.8, 5),
  },
  stage: {
    floorY: -0.62,
    pinY: JET_PIN_TOP,
    explodeLift: 0.9,
    views: {
      iso: [9.6, 12.6, 15.6, 0.3, 0.6, 0.2],
      top: [0, 21.0, 0.01, 0, 0, 0],
      bottom: [0, -19.5, 0.6, 0, 0, 0],
      front: [0, 4.6, 19.0, 0.3, 0.8, 0],
    },
    asmCam: [5.4, 29.0, 10.0, 5.4, 0, 1.4],
  },
  bench: {
    pos: [-5.6, 0, -0.5],
    half: [5.0, 4.0],
    lift: JET_BENCH_LIFT,
    pin: (p) => [p.x, JET_BENCH_LIFT + JET_PIN_TOP, p.z],
  },
};
