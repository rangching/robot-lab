import { P_SF_FLY, P_SF_GROVE, P_SF_HOVER, P_SF_MOTOR, P_SF_RGB } from '../../sim/programsStampfly';
import { gndEps } from '../../sim/board';
import { useDrone } from '../../sim/drone';
import { MOTORS, MOTOR_DIR, MOTOR_SHAFT } from '../../sim/flight';
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
const batteryOk = (c: Ctx) => of(c, 'lipo').some((b) => conn(c, `${b.id}:P`, 'mcu:BAT') && toGnd(c, `${b.id}:N`));
/** 每顆馬達都裝了一支方向正確的槳 */
const propsOk = (c: Ctx) => MOTORS.every((m) => {
  const on = of(c, 'prop').filter((p) => conn(c, `${p.id}:HUB`, `mcu:${MOTOR_SHAFT[m]}`));
  return on.length === 1 && (on[0].props.dir ?? 'cw') === MOTOR_DIR[m];
});
const noProps = (c: Ctx) => !of(c, 'prop').some((p) => MOTORS.some((m) => conn(c, `${p.id}:HUB`, `mcu:${MOTOR_SHAFT[m]}`)));
const telem = () => useDrone.getState().telem;

/** 電池已經接好 */
const BATTERY = (): { comps: Comp[]; wires: Wire[] } => ({
  comps: [{ id: 'p1', type: 'lipo', x: 2.0, z: 3.2, props: {} }],
  wires: [
    { id: 'pw1', a: 'p1:P', b: 'mcu:BAT', color: '#ef4444' },
    { id: 'pw2', a: 'p1:N', b: 'mcu:GND3', color: '#334155' },
  ],
});

/** 電池＋四支方向正確的槳 */
const READY = (): { comps: Comp[]; wires: Wire[] } => {
  const b = BATTERY();
  const props: Comp[] = MOTORS.map((m, i) => ({ id: `q${i + 1}`, type: 'prop', x: 1.6 + (i % 2) * 2.4, z: -3.0 + Math.floor(i / 2) * 2.2, props: { dir: MOTOR_DIR[m] } }));
  return {
    comps: [...b.comps, ...props],
    wires: [...b.wires, ...MOTORS.map((m, i) => ({ id: `qw${i + 1}`, a: `q${i + 1}:HUB`, b: `mcu:${MOTOR_SHAFT[m]}`, color: '#0ea5e9' }))],
  };
};

export const STAMPFLY_MISSIONS: Mission[] = [
  {
    id: 'sf1', board: 'stampfly', num: 1, title: 'Stamp Fly 報到：全彩燈', sub: 'M5StampS3 · USB-C · 不碰馬達的第一支程式', badge: 'sf-hello',
    goal: '無人機也是一塊開發板。第一支程式先讓 G39 的全彩燈閃起來，完全不碰馬達，確認上傳流程沒問題。',
    program: P_SF_RGB, lib: [],
    steps: [
      { text: '讀程式：全彩燈 WS2812 接在 G39，用 FastLED 程式庫控制。', why: 'WS2812 是「智慧 LED」，一支腳就能傳顏色資料，所以不能用 digitalWrite 直接點亮真的那顆燈（模擬器這裡簡化成亮／滅）。', ack: '我看懂了', check: (c) => c.acks.includes('sf1-s0') },
      { text: '真的上傳前：開發板選「M5StampS3」，用 USB-C 線接電腦。官方完整飛控用 PlatformIO 開啟專案。', why: '如果電腦認不到，按住 StampS3 側邊的按鈕再插 USB，讓它進入下載模式。', ack: '記住了', check: (c) => c.acks.includes('sf1-s1') },
      { text: '按「上傳並執行」，看機身前方的全彩燈閃 3 次。', why: '只插 USB 時程式就能跑；但馬達的電來自電池，所以這時候推不動馬達，很安全。', check: (c) => c.running && c.obs.blinksL >= 3 },
    ],
  },
  {
    id: 'sf2', board: 'stampfly', num: 2, title: '接電池、測馬達', sub: '電池極性 · MOSFET · 先拆槳', badge: 'sf-motor',
    goal: '馬達的電來自 1S 鋰電池。這關把電池接對極性，再用測試程式讓四顆馬達一顆一顆轉，確認每顆都正常。螺旋槳先不要裝！',
    program: P_SF_MOTOR, lib: ['lipo'],
    steps: [
      { text: '從元件庫加入「鋰電池」。', check: (c) => of(c, 'lipo').length > 0 },
      { text: '紅線（＋）接機尾的 BAT+，黑線（−）接 BAT−。', why: '鋰電池接反會把反向電壓灌進電源電路。真的飛機上電池接頭有防呆，但很多自組無人機沒有。', check: (c) => batteryOk(c) },
      { text: '確認四顆馬達上都沒有螺旋槳。', why: '這是飛控開發最重要的習慣：只要程式會動到馬達，就先拆槳。程式一寫錯，馬達會在你手上全速轉起來。', ack: '槳都拆了', check: (c) => c.acks.includes('sf2-s2') && noProps(c) },
      { text: '按「上傳並執行」，看四顆馬達依 FL → FR → RL → RR 輪流轉一秒。', why: 'GPIO 只有幾十 mA，推不動 1 A 的馬達；它只是去開關機臂根部的 MOSFET，大電流直接從電池流過馬達。', check: (c) => c.running && ok(c) && c.obs.motorsSpun.length === 4 },
    ],
  },
  {
    id: 'sf3', board: 'stampfly', num: 3, title: '正反槳：對角同向', sub: 'CW／CCW · 反扭力 · 翻覆', badge: 'sf-props',
    goal: '四顆馬達裡，左前、右後順時針轉；右前、左後逆時針轉。對角同向，反扭力才會互相抵消。這關把四支槳裝在對的馬達上。',
    program: P_SF_FLY, lib: ['prop', 'lipo'], preset: BATTERY(),
    steps: [
      { text: '從元件庫加入 2 支「CW 槳」和 2 支「CCW 槳」。', why: 'CW 和 CCW 槳的葉片是鏡像的。每顆馬達要配和它轉向一致的槳，空氣才會往下吹。', check: (c) => of(c, 'prop').filter((p) => p.props.dir !== 'ccw').length >= 2 && of(c, 'prop').filter((p) => p.props.dir === 'ccw').length >= 2 },
      { text: '把 CW 槳的槳轂接到左前（FL）和右後（RR）的馬達軸。', why: '機頭朝遠方；PCB 上每顆馬達旁邊都印了轉向箭頭。點槳轂、再點馬達頂端，就是把槳套上去。', check: (c) => (['FL', 'RR'] as const).every((m) => of(c, 'prop').some((p) => p.props.dir !== 'ccw' && conn(c, `${p.id}:HUB`, `mcu:${MOTOR_SHAFT[m]}`))) },
      { text: '把 CCW 槳裝到右前（FR）和左後（RL）。', check: (c) => propsOk(c) },
      { text: '按「上傳並執行」：上電前檢查會確認每支槳的方向。', why: '如果有一支裝反，那顆馬達會把空氣往上吹。飛控想把那一側抬起來，越修越歪，一推油門就翻過去。', check: (c) => c.running && ok(c) && propsOk(c) },
    ],
  },
  {
    id: 'sf4', board: 'stampfly', num: 4, title: '解鎖安全：油門歸零', sub: 'ESP-NOW 遙控 · 解鎖檢查 · 自穩', badge: 'sf-arm',
    goal: '飛控有一道「解鎖（arm）」關卡：油門沒歸零、機身不水平、電池沒電，都會拒絕解鎖。這關先故意被拒絕一次，再照正確流程起飛、降落。',
    program: P_SF_FLY, lib: ['prop', 'lipo'], preset: READY(),
    steps: [
      { text: '讀程式：遙控器按「解鎖」時，飛控會先檢查油門、水平、電池。', why: '遙控器（Atom JoyStick）和飛機之間用 ESP-NOW 直接通訊，不需要 Wi-Fi 基地台，延遲只有幾毫秒。', ack: '我看懂了', check: (c) => c.acks.includes('sf4-s0') },
      { text: '按「上傳並執行」。', check: (c) => c.running && ok(c) },
      { text: '在遙控器面板把油門推到 30% 以上，然後按「解鎖」：飛控應該拒絕你。', why: '如果解鎖的瞬間油門不在最低，馬達會直接以那個轉速衝出去。這是真實飛控一定有的保護。', check: (c) => c.running && c.obs.armRefused >= 1 },
      { text: '把油門拉回 0，再按一次「解鎖」。', check: (c) => c.running && c.obs.arms >= 1 },
      { text: '慢慢推油門讓它離地 10 cm 以上，再收油門、按「上鎖」。', why: '離地後試試看橫滾、俯仰搖桿：自穩模式下搖桿決定的是「傾斜角度」，放開搖桿它會自己回到水平。', check: (c) => c.running && c.obs.altMax >= 10 && c.obs.disarms >= 1 && !telem()?.armed },
    ],
  },
  {
    id: 'sf5', board: 'stampfly', num: 5, title: '定高懸停：調 PID', sub: 'ToF 測距 · P、I、D 各自的工作', badge: 'sf-pid',
    goal: '定高模式下，雷射測距量高度、PID 自動調油門。先只用 P 和 D 飛一次，看它停在哪裡；再加上 I，讓它準確停在目標高度。',
    program: P_SF_HOVER, lib: ['prop', 'lipo'], preset: READY(),
    steps: [
      { text: '讀程式：油門＝TRIM（懸停的猜測值）＋ P 項 ＋ I 項 − D 項。先保持 Ki = 0。', why: 'TRIM 是在滿電時量的。電池電壓一掉，同樣的油門推力就變小，這個猜測值就不準了。', ack: '我看懂了', check: (c) => c.acks.includes('sf5-s0') },
      { text: 'Ki = 0 時執行，按「解鎖」自動起飛，觀察它穩定停在目標「下方」好幾公分。', why: '只有 P 時，要多推一點油門就必須「先差一點」：誤差不能是 0，否則 P 項也是 0。這個永遠補不回來的差距叫穩態誤差。', check: (c) => c.running && c.params.ki === 0 && c.obs.lowHoverMs >= 2000 },
      { text: '停止，把 Ki 改成 40 以上，再執行、解鎖。', why: 'I 項把誤差一直累加：只要還停在下方，它就一點一點把油門往上加，直到誤差真的變成 0。', check: (c) => c.running && c.params.ki >= 40 && c.obs.arms >= 1 },
      { text: '讓它在目標高度 ±3 cm 內穩穩懸停 3 秒。', why: '想看 D 的作用，可以再把 Kd 改成 0 試試：少了「煞車」，高度會上下晃好幾次才停。', check: (c) => c.running && c.params.ki >= 40 && c.obs.hoverMs >= 3000 },
    ],
  },
  {
    id: 'sf6', board: 'stampfly', num: 6, title: 'Grove 起飛警示燈', sub: 'PORT.B · 3.3 V · 外掛模組', badge: 'sf-grove',
    goal: '幫飛機加一顆警示燈：解鎖時亮起，提醒旁邊的人「螺旋槳要轉了」。LED 接在黑色 Grove 埠 PORT.B 的 G1。',
    program: P_SF_GROVE, lib: ['led', 'resistor', 'prop', 'lipo'], preset: READY(),
    steps: [
      { text: '加入「LED」和「電阻 220Ω」。', check: (c) => of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: 'PORT.B 的 G1 → 電阻 → LED 長腳（＋），LED 短腳（−）接 PORT.B 的 GND。', why: 'G1 是 3.3 V 的 GPIO。Grove 埠旁邊那支 5V 是給模組的電源，千萬別接到 G 腳上。', check: (c) => of(c, 'led').some((l) => resBetween(c, 'mcu:GPIO1', `${l.id}:A`) && toGnd(c, `${l.id}:K`)) },
      { text: '按「上傳並執行」，然後在遙控器按「解鎖」（油門要在 0）。', why: '實際外掛模組時記得：飛機只有 37 公克，每多 1 公克都會吃掉推力和飛行時間。', check: (c) => c.running && ok(c) && c.obs.arms >= 1 && c.obs.extLedOn >= 1 },
    ],
  },
];
