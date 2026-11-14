import { P_PI_BUTTON, P_PI_FLASK, P_PI_LED, P_PI_SERVO } from '../../sim/programsRpi4';
import { gndEps } from '../../sim/board';
import { useWeb } from '../../sim/web';
import type { Comp, CompType, Wire } from '../../sim/types';
import type { Ctx, Mission } from './missions';

// 只 import missions.ts 的型別，避免執行期的循環相依
const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);
const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => gndEps().some((g) => conn(c, a, g));
const ok = (c: Ctx) => !c.issues.some((i) => i.level === 'error');
function resBetween(c: Ctx, a: string, b: string) {
  return of(c, 'resistor').some((r) => (conn(c, a, `${r.id}:1`) && conn(c, b, `${r.id}:2`)) || (conn(c, a, `${r.id}:2`) && conn(c, b, `${r.id}:1`)));
}
const ledOn = (c: Ctx, pin: string) => of(c, 'led').some((l) => resBetween(c, pin, `${l.id}:A`) && toGnd(c, `${l.id}:K`));

/** 第 2、4 關預先接好：GPIO17 → 220Ω → LED → GND（實體第 11 → 第 9 腳） */
const LED_17 = (color = '#ff3b4f'): { comps: Comp[]; wires: Wire[] } => ({
  comps: [
    { id: 'p1', type: 'resistor', x: 1.6, z: -2.6, props: { ohms: 220 } },
    { id: 'p2', type: 'led', x: 4.0, z: -2.6, props: { color } },
  ],
  wires: [
    { id: 'pw1', a: 'mcu:GPIO17', b: 'p1:1', color: '#f59e0b' },
    { id: 'pw2', a: 'p1:2', b: 'p2:A', color: '#f59e0b' },
    { id: 'pw3', a: 'p2:K', b: 'mcu:GND2', color: '#334155' },
  ],
});

export const RPI4_MISSIONS: Mission[] = [
  {
    id: 'r1', board: 'rpi4', num: 1, title: 'Pi 的第一盞 LED', sub: 'Python · gpiozero · BCM 編號', badge: 'rpi4-hello',
    goal: 'Pi 4 的排針上沒有內建 LED 可以閃，所以第一關就自己接一顆。重點是分清楚兩套編號：程式寫的 GPIO17，其實插在實體第 11 腳。',
    program: P_PI_LED, lib: ['led', 'resistor'],
    steps: [
      { text: '讀右邊的程式：這次是 Python。LED(17) 的 17 是 BCM 編號，不是第幾支腳。', why: 'Pi 不用「上傳」：程式存在 Pi 自己的 microSD 卡裡，在終端機輸入 python3 blink.py 就直接執行。gpiozero 已經內建在 Raspberry Pi OS。', ack: '我看懂了', check: (c) => c.acks.includes('r1-s0') },
      { text: '從元件庫加入「LED」和「電阻 220Ω」。', check: (c) => of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: 'GPIO17（實體第 11 腳）→ 電阻 → LED 長腳（＋），LED 短腳（−）接 GND（第 9 腳就在旁邊）。', why: '把滑鼠移到排針上可以看每支腳的實體腳號。3.3 V 經過 220Ω 大約 6 mA，剛好在 Pi 建議的單腳 16 mA 以內。', check: (c) => ledOn(c, 'mcu:GPIO17') },
      { text: '按「上傳並執行」，看 LED 閃 3 次。', why: '真的在 Pi 上操作時，按 Ctrl+C 就能結束程式；gpiozero 會自動把腳位恢復成安全的輸入狀態。', check: (c) => c.running && ok(c) && c.obs.extLedOn >= 3 },
    ],
  },
  {
    id: 'r2', board: 'rpi4', num: 2, title: '按鈕叫燈亮', sub: 'Button · 內建上拉 · 事件', badge: 'rpi4-button',
    goal: 'LED 已經接在 GPIO17。這關在 GPIO27 接一顆按鈕，用 gpiozero 的「事件」寫法：按下去自動開燈，放開自動關燈，主程式什麼都不用做。',
    program: P_PI_BUTTON, lib: ['button', 'led', 'resistor'], preset: LED_17(),
    steps: [
      { text: '加入一顆「按鈕」。', check: (c) => of(c, 'button').length > 0 },
      { text: '按鈕一腳接 GPIO27（實體第 13 腳），另一腳接 GND。', why: 'Button(27) 預設會打開 Pi 內建的上拉電阻：沒按時讀到高電位，按下去被拉到 GND 變低電位，所以不用另外加電阻。', check: (c) => of(c, 'button').some((b) => (conn(c, 'mcu:GPIO27', `${b.id}:1`) && toGnd(c, `${b.id}:2`)) || (conn(c, 'mcu:GPIO27', `${b.id}:2`) && toGnd(c, `${b.id}:1`))) },
      { text: '讀程式：when_pressed = led.on 後面沒有括號。', why: '加了括號會「馬上」開燈一次；不加括號是把這個動作交給按鈕，等事件發生時才執行。pause() 讓程式停在原地，不然 Python 跑到最後一行就結束了。', ack: '記住了', check: (c) => c.acks.includes('r2-s2') },
      { text: '按「上傳並執行」，在右上角按住按鈕，看 LED 亮起來。', check: (c) => c.running && ok(c) && c.obs.pressLit },
    ],
  },
  {
    id: 'r3', board: 'rpi4', num: 3, title: '伺服機要穩', sub: '硬體 PWM · pigpio · 共地', badge: 'rpi4-servo',
    goal: 'Linux 同時在做很多事，用一般 GPIO 產生的脈衝會忽快忽慢，伺服機就會抖。這關把訊號接到有硬體 PWM 的 GPIO18，電源另外接，並記得共地。',
    program: P_PI_SERVO, lib: ['servo', 'psu'],
    steps: [
      { text: '加入「SG90 伺服機」和「外接 5V 電源」。', check: (c) => of(c, 'servo').length > 0 && of(c, 'psu').length > 0 },
      { text: '伺服機紅線 V+ 接電源 +5V，棕線 GND 接電源 GND。', why: '從 Pi 的 5V 腳取電也轉得動，但伺服機啟動的瞬間電流會讓電壓下陷，Pi 可能出現電壓不足甚至重開機。', check: (c) => of(c, 'servo').some((s) => of(c, 'psu').some((p) => conn(c, `${s.id}:V`, `${p.id}:P`) && conn(c, `${s.id}:GND`, `${p.id}:N`))) },
      { text: '橘色訊號線 SIG 接 GPIO18（實體第 12 腳）。', why: 'GPIO12、13、18、19 有硬體 PWM，脈衝由硬體產生，不會被 Linux 打斷。程式裡的 PiGPIOFactory 會用 pigpio 來產生精準的脈衝。', check: (c) => of(c, 'servo').some((s) => conn(c, `${s.id}:SIG`, 'mcu:GPIO18')) },
      { text: '把外接電源的 GND 接到 Pi 的任一支 GND（共地）。', why: '8 支 GND 全部相通，挑最近的就好。少了共地，3.3 V 的訊號沒有共同的 0 V 參考，伺服機會亂抖。', check: (c) => of(c, 'psu').some((p) => toGnd(c, `${p.id}:N`)) },
      { text: '按「上傳並執行」，看伺服機從 0° 轉到 180° 再轉回來。', why: '真的在 Pi 上做時，要先在終端機輸入 sudo pigpiod 啟動背景服務。', check: (c) => c.running && ok(c) && c.obs.servoMax > 150 && c.obs.servoMin < 30 },
    ],
  },
  {
    id: 'r4', board: 'rpi4', num: 4, title: '用手機遙控 Pi', sub: 'Flask · 區網 · 網頁伺服器', badge: 'rpi4-web',
    goal: 'Pi 是一台完整的 Linux 電腦，裝 Python 的 Flask 就能當網頁伺服器。LED 已經接在 GPIO17，這關讓手機連進 Pi 的網頁開燈、關燈。',
    program: P_PI_FLASK, lib: ['led', 'resistor'], preset: LED_17('#22e3ff'),
    steps: [
      { text: '讀程式：@app.route("/on") 代表「有人打開 /on 這一頁，就執行底下的函式」。', why: 'Flask 要先安裝：sudo apt install python3-flask。host="0.0.0.0" 讓同一個區網裡的手機也連得進來，預設只有 Pi 自己能連。', ack: '我看懂了', check: (c) => c.acks.includes('r4-s0') },
      { text: '按「上傳並執行」，等終端機印出網址。', why: '192.168.1.42 是路由器發給 Pi 的區網位址，冒號後的 5000 是 Flask 預設的埠號。在 Pi 上輸入 hostname -I 也能查到自己的 IP。', check: (c) => c.running && !!useWeb.getState().ip },
      { text: '在工作台右上角的「手機」面板按「開燈」。', why: '手機瀏覽器送出 GET /on，Flask 收到後執行 turn_on()，裡面的 led.on() 就把 GPIO17 拉到 3.3 V。', check: (c) => c.running && ok(c) && useWeb.getState().on >= 1 && c.obs.extLedOn >= 1 },
      { text: '再按「關燈」。', check: (c) => c.running && useWeb.getState().on >= 1 && useWeb.getState().off >= 1 },
    ],
  },
];
