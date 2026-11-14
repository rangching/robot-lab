import type { BoardLesson, PinDef, PinKind } from '../types';

/** Uno 實體尺寸（公分） */
export const UNO_W = 6.86;
export const UNO_D = 5.34;
export const PCB_T = 0.16;

/** 板子圖面座標（mm，原點左下角）→ 3D 座標（cm，原點中心，z 朝向觀看者） */
export const mx = (mm: number) => mm / 10 - UNO_W / 2;
export const mz = (mm: number) => UNO_D / 2 - mm / 10;

const P = 2.54; // 2.54 mm 腳距

function row(ids: [string, string, PinKind, string][], startMm: number, yMm: number): PinDef[] {
  return ids.map(([id, label, kind, desc], i) => ({ id, label, kind, desc, x: mx(startMm + i * P), z: mz(yMm) }));
}

const DIG_Y = 50.8;
const PWR_Y = 2.54;

export const UNO_PINS: PinDef[] = [
  ...row(
    [
      ['SCL', 'SCL', 'bus', 'I²C 時脈線，和 A5 是同一條線'],
      ['SDA', 'SDA', 'bus', 'I²C 資料線，和 A4 是同一條線'],
      ['AREF', 'AREF', 'control', '類比參考電壓輸入，平常不用接'],
      ['GND3', 'GND', 'gnd', '接地，整個電路共用的 0 V'],
      ['D13', 'D13', 'digital', '數位腳，板上 L 燈接在這裡；也是 SPI 的 SCK'],
      ['D12', 'D12', 'digital', '數位腳；也是 SPI 的 MISO'],
      ['D11', '~D11', 'pwm', '數位腳＋PWM；也是 SPI 的 MOSI'],
      ['D10', '~D10', 'pwm', '數位腳＋PWM；也是 SPI 的 SS'],
      ['D9', '~D9', 'pwm', '數位腳＋PWM，適合調 LED 亮度、控制伺服機'],
      ['D8', 'D8', 'digital', '數位輸入／輸出'],
    ],
    21.4,
    DIG_Y,
  ),
  ...row(
    [
      ['D7', 'D7', 'digital', '數位輸入／輸出'],
      ['D6', '~D6', 'pwm', '數位腳＋PWM'],
      ['D5', '~D5', 'pwm', '數位腳＋PWM'],
      ['D4', 'D4', 'digital', '數位輸入／輸出'],
      ['D3', '~D3', 'pwm', '數位腳＋PWM；外部中斷 INT1'],
      ['D2', 'D2', 'digital', '數位腳；外部中斷 INT0，適合接編碼器'],
      ['D1', 'TX→1', 'bus', '序列埠傳送（TX），和 USB 共用，盡量別接東西'],
      ['D0', 'RX←0', 'bus', '序列埠接收（RX），和 USB 共用，盡量別接東西'],
    ],
    48.3,
    DIG_Y,
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
    PWR_Y,
  ),
  ...row(
    [
      ['A0', 'A0', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A1', 'A1', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A2', 'A2', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A3', 'A3', 'analog', '類比輸入：0–5 V 轉成 0–1023'],
      ['A4', 'A4', 'analog', '類比輸入；也是 I²C 的 SDA'],
      ['A5', 'A5', 'analog', '類比輸入；也是 I²C 的 SCL'],
    ],
    46.99,
    PWR_Y,
  ),
];

export const UNO_PIN_MAP: Record<string, PinDef> = Object.fromEntries(UNO_PINS.map((p) => [p.id, p]));

/** 板內本來就相通的腳位（電氣上同一個節點） */
export const UNO_INTERNAL_NETS: string[][] = [
  ['GND1', 'GND2', 'GND3'],
  ['SDA', 'A4'],
  ['SCL', 'A5'],
];

export const unoLesson: BoardLesson = {
  summary:
    'Uno 是全世界最多人拿來入門的開發板。主角是一顆 8 位元的 ATmega328P 微控制器，使用對新手很寬容的 5 V 邏輯；排母可以直接插杜邦線，不用焊接。網路上的範例多到數不完，各種「擴充板（shield）」也能直接疊在上面。',
  stats: [
    { k: '時脈', v: '16 MHz' },
    { k: 'FLASH', v: '32 KB' },
    { k: 'RAM', v: '2 KB' },
    { k: 'GPIO', v: '14 + 6' },
    { k: '邏輯電壓', v: '5 V' },
    { k: '參考價', v: '≈ US$25' },
  ],
  specs: [
    { k: '微控制器', v: 'ATmega328P（8 位元 AVR）' },
    { k: '時脈', v: '16 MHz' },
    { k: 'Flash 程式記憶體', v: '32 KB（其中 0.5 KB 給開機載入程式）' },
    { k: 'SRAM / EEPROM', v: '2 KB / 1 KB' },
    { k: '數位腳', v: '14 支（其中 6 支可輸出 PWM）' },
    { k: '類比輸入', v: '6 支（10 位元 ADC，0–1023）' },
    { k: '邏輯電壓', v: '5 V' },
    { k: '供電', v: 'USB 5 V，或電源插孔／VIN 7–12 V' },
    { k: '單腳電流', v: '建議 20 mA 以內（絕對上限 40 mA）' },
    { k: '通訊介面', v: 'UART、I²C、SPI' },
    { k: '連接電腦', v: 'USB-B，經 ATmega16U2 轉成序列埠' },
    { k: '尺寸／重量', v: '68.6 × 53.4 mm，約 25 g' },
  ],
  parts: [
    { id: 'mcu', num: 1, name: 'ATmega328P 微控制器', quiz: '找出板子的大腦：負責執行你的程式的那顆晶片', desc: '整塊板子的大腦。你寫的程式（sketch）就存在它裡面，每秒跑 1600 萬個時脈，控制每一支腳位。它插在 IC 座上，燒壞了可以直接拔起來換一顆。', at: [mx(48), 0.35, mz(14)], layer: 3 },
    { id: 'usb', num: 2, name: 'USB-B 接頭', quiz: '找出接電腦的那個方形 USB 接頭', desc: '接電腦的方形 USB 接頭（印表機常用的那種）。它同時負責三件事：供應 5 V 電源、上傳程式、和電腦互傳文字。', at: [mx(2), 0.55, mz(38)], layer: 2 },
    { id: 'u2', num: 3, name: 'ATmega16U2 USB 轉換晶片', quiz: '找出把 USB 翻譯成序列埠的小晶片', desc: '電腦講 USB，ATmega328P 只聽得懂序列埠（UART），這顆小晶片就是中間的翻譯員。上傳程式和序列埠監控視窗的文字都經過它。', at: [mx(16), 0.1, mz(30)], layer: 1 },
    { id: 'jack', num: 4, name: '電源插孔（7–12 V）', quiz: '找出接變壓器或電池盒的圓形電源插孔', desc: '5.5 × 2.1 mm 的圓形插孔，中心是正極。機器人離開電腦、靠電池跑的時候就從這裡供電。別超過 12 V，否則穩壓器會過熱。', at: [mx(5), 0.55, mz(7.7)], layer: 2 },
    { id: 'reg', num: 5, name: '5 V 穩壓器', quiz: '找出把 7–12 V 降成 5 V 的穩壓器', desc: '把電源插孔進來的 7–12 V 降成穩定的 5 V。多出來的電壓會變成熱，所以負載大時摸起來溫溫的很正常；但它推不動馬達。', at: [mx(16.5), 0.12, mz(8)], layer: 1 },
    { id: 'caps', num: 6, name: '電解電容', quiz: '找出兩顆圓柱形的電解電容', desc: '穩壓器前後的小型蓄電池。當旁邊有東西突然啟動、電壓掉一下時，它們先補上去，讓微控制器不會因此重新開機。', at: [mx(17), 0.3, mz(12.5)], layer: 2 },
    { id: 'dig', num: 7, name: '數位腳排母 D0–D13', quiz: '找出 D0–D13 的數位腳排母', desc: '每一支都能當輸入（按鈕、感測器）或輸出（LED、馬達驅動訊號）。標「~」的 3、5、6、9、10、11 能輸出 PWM，用來調亮度和馬達速度。左端還有 GND、AREF 和 I²C 的 SDA、SCL。', at: [mx(44), 0.45, mz(DIG_Y)], layer: 2 },
    { id: 'pwr', num: 8, name: '電源排母 POWER', quiz: '找出提供 5V、3.3V 和 GND 的電源排母', desc: '感測器和模組從這裡取電：5V、3.3V 和 GND。VIN 跟電源插孔相通；RESET 可以接外部按鈕來重新開機。', at: [mx(32.99), 0.45, mz(PWR_Y)], layer: 2 },
    { id: 'ana', num: 9, name: '類比輸入 A0–A5', quiz: '找出 A0–A5 類比輸入排母', desc: '量 0–5 V 的電壓並換算成 0–1023 的數字。可變電阻、光敏電阻、循跡感測器、搖桿都接這裡。A4、A5 同時也是 I²C 匯流排。', at: [mx(53.34), 0.45, mz(PWR_Y)], layer: 2 },
    { id: 'ledL', num: 10, name: 'L 燈（接 D13）', quiz: '找出接在 D13、不用接線就能閃的 L 燈', desc: '板子內建、接在 D13 的 LED。幾乎每個人的第一支程式都是讓它閃爍，連一條線都不用接。', at: [mx(24), 0.1, mz(44)], layer: 1 },
    { id: 'txrx', num: 11, name: 'TX／RX 指示燈', quiz: '找出上傳程式時會快速閃爍的 TX／RX 燈', desc: '板子透過 USB 傳送（TX）或接收（RX）資料時會閃。上傳程式時如果看到它們快速閃爍，代表和電腦的連線正常。', at: [mx(24), 0.1, mz(38.2)], layer: 1 },
    { id: 'on', num: 12, name: 'ON 電源燈', quiz: '找出通電就會亮的 ON 電源燈', desc: '只要有電就亮綠燈。如果它不亮，先檢查 USB 線、電池，以及 5V 是不是被短路到 GND。', at: [mx(62), 0.1, mz(38)], layer: 1 },
    { id: 'reset', num: 13, name: 'RESET 按鈕', quiz: '找出讓程式從頭跑起的 RESET 按鈕', desc: '按一下就讓程式從頭開始跑，像把電腦重新開機。存在晶片裡的程式不會被清掉。', at: [mx(6), 0.25, mz(50)], layer: 2 },
    { id: 'xtal', num: 14, name: '16 MHz 石英振盪器', quiz: '找出提供精準節拍的銀色石英振盪器', desc: '金屬殼裡的精準節拍器，負責 USB 轉換晶片的時脈。主晶片旁還有一顆很小的陶瓷振盪器。delay()、millis() 和序列埠速度都靠這些節拍才準。', at: [mx(14), 0.2, mz(23)], layer: 2 },
    { id: 'icsp', num: 15, name: 'ICSP 燒錄排針', quiz: '找出 2×3 的 ICSP 燒錄排針', desc: '六支排針，可以用外部燒錄器直接寫入微控制器，例如替新晶片燒開機載入程式。它也拉出了 SPI 匯流排（MISO、MOSI、SCK），有些擴充板會用到。', at: [mx(64.5), 0.4, mz(27)], layer: 2 },
  ],
  strengths: [
    '對新手寬容：5 V 邏輯和耐操的腳位，接錯幾次通常還活著',
    '社群超大：幾乎每個問題都有人問過，也有現成範例',
    '擴充板（shield）上百種：馬達驅動、繼電器、顯示器直接疊上去，不必接線',
    '主晶片插在 IC 座上，燒壞了拔下來換一顆就好',
  ],
  pitfalls: [
    '單支腳最多約 20 mA：LED 一定要串電阻；馬達和繼電器要經過驅動器或電晶體',
    '伺服機、馬達不要從板子的 5V 取電：給它們獨立電源，再把 GND 接在一起（共地）',
    '3.3 V 的感測器或模組不能直接接 5 V 訊號腳，要經過電位轉換',
    'D0、D1 和 USB 共用：上面接了東西時，程式可能會上傳失敗',
  ],
  pinGroups: [
    { title: '電源腳', kind: 'power', body: '5V、3.3V 是給感測器和模組用的輸出；GND 是整個電路共用的接地。VIN 是 7–12 V 的輸入。3.3V 最多只能供應約 50 mA。' },
    { title: '數位腳與 PWM', kind: 'pwm', body: 'D0–D13 以 0 V／5 V 兩種準位當輸入或輸出。3、5、6、9、10、11 旁的「~」代表 PWM：analogWrite() 可以平滑地調整亮度與速度。' },
    { title: '類比輸入', kind: 'analog', body: 'A0–A5 用 analogRead() 讀 0–5 V 的電壓，回傳 0–1023。數位腳不夠用時，它們也能當一般數位腳（D14–D19）。' },
    { title: '通訊匯流排', kind: 'bus', body: 'UART 在 D0（RX）、D1（TX），和 USB 共用；I²C 的 SDA、SCL 就是 A4、A5；SPI 在 D10–D13 和 ICSP 排針。' },
    { title: '外部中斷', kind: 'digital', body: 'D2、D3 能在訊號變化的瞬間觸發 attachInterrupt()，就算主程式正在忙也不會漏掉。接機器人輪子的編碼器很好用。' },
    { title: '控制腳', kind: 'control', body: 'RESET 接到 GND 會讓板子重新開機；AREF 可以設定類比量測的參考電壓，入門階段先不用管它。' },
  ],
  code: {
    title: '第一支程式：讓內建 L 燈閃爍',
    lang: 'ARDUINO C++',
    source: `// L 燈已經內建在板子上，接在 D13。
// LED_BUILTIN 是這支腳的現成名字。
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);     // 把 D13 設成輸出
  Serial.begin(9600);               // 打開和電腦之間的 USB 序列埠
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);  // 輸出 5 V：燈亮
  Serial.println("亮");              // 序列埠監控視窗會看到這行
  delay(500);                       // 等 0.5 秒
  digitalWrite(LED_BUILTIN, LOW);   // 輸出 0 V：燈滅
  Serial.println("滅");
  delay(500);
}`,
  },
  projects: [
    '第一台雙馬達小車：Uno＋馬達驅動擴充板',
    '超音波避障車：用 HC-SR04 量距離，太近就轉彎',
    '循跡車：紅外線感測器跟著黑線走',
    '伺服機機械手臂：四顆 SG90 加兩支搖桿',
    '桌上型氣象站：溫溼度感測器＋OLED 顯示器',
  ],
  facts: [
    '「Uno」是義大利文的「一」，用來紀念 Arduino 1.0 軟體正式發佈。',
    'Arduino 誕生在義大利北部的伊夫雷亞（Ivrea）。名字來自創辦人常去的一間酒吧，而酒吧的名字又來自一千年前統治當地的國王 Arduin。',
    '它的電路設計檔是公開授權的，所以市面上才有這麼多相容板與複製板。',
  ],
  quiz: [],
};

// 測驗題由零件資料產生
unoLesson.quiz = [
  { part: 'mcu', prompt: '找出板子的大腦：負責執行程式的微控制器', hint: '它是板子上最長的那顆黑色晶片，插在 IC 座上。', explain: 'ATmega328P 存放並執行你的程式，控制所有腳位。' },
  { part: 'usb', prompt: '程式要從電腦送進板子，線要插在哪裡？', hint: '板子左上方那個方形的銀色金屬接頭。', explain: 'USB-B 接頭同時負責供電、上傳程式和序列埠通訊。' },
  { part: 'jack', prompt: '機器人離開電腦、改用電池盒供電時，要插在哪裡？', hint: '板子左下方的黑色圓孔插座。', explain: '電源插孔接受 7–12 V，再由穩壓器降成 5 V。' },
  { part: 'reset', prompt: '程式卡住了，想讓它從頭跑起，該按哪一顆？', hint: 'USB 接頭旁邊的小按鈕。', explain: 'RESET 只是重新開機，程式本身不會被清掉。' },
  { part: 'ledL', prompt: '不接任何線就能被 Blink 程式點亮的燈在哪裡？', hint: '它接在 D13，位置在 USB 接頭右邊。', explain: 'L 燈接在 D13，是每個人第一支程式的主角。' },
  { part: 'ana', prompt: '可變電阻的中間腳要接到哪一排，才能用 analogRead() 讀值？', hint: '板子下方右邊那排 6 支腳，旁邊印著 ANALOG IN。', explain: 'A0–A5 會把 0–5 V 換算成 0–1023。' },
  { part: 'u2', prompt: '電腦講 USB、主晶片只懂序列埠，負責翻譯的晶片在哪裡？', hint: 'USB 接頭右邊、一顆很小的方形晶片。', explain: 'ATmega16U2 把 USB 轉成 UART，上傳程式都經過它。' },
  { part: 'reg', prompt: '把電池的 9 V 降成 5 V、負載大時會發熱的零件在哪裡？', hint: '它在電源插孔旁邊，有一片散熱用的金屬片。', explain: '線性穩壓器把多餘的電壓轉成熱，所以推不動馬達。' },
  { part: 'icsp', prompt: '想用外部燒錄器直接寫入主晶片，要接在哪一組排針？', hint: '板子右側邊緣、2×3 的六支排針。', explain: 'ICSP 排針可以繞過 USB 直接燒錄，也拉出了 SPI 匯流排。' },
  { part: 'xtal', prompt: '讓 delay() 和序列埠速度變準的節拍器在哪裡？', hint: '一顆橢圓形、亮銀色的金屬小元件。', explain: '16 MHz 石英振盪器提供精準的時脈。' },
];
