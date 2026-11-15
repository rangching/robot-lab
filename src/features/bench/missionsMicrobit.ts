import { P_MB_CLAP, P_MB_CLIP, P_MB_HELLO, P_MB_LEVEL, P_MB_RADIO } from '../../sim/programsMicrobit';
import { FRIEND_GROUP, useMb } from '../../sim/microbit';
import { gndEps } from '../../sim/board';
import type { CompType } from '../../sim/types';
import type { Ctx, Mission } from './missions';

// 只 import missions.ts 的型別，避免執行期的循環相依
// 板上的東西（LED、按鈕、感測器、無線電）看 src/sim/microbit.ts 的統計；外接 LED 看電路模擬
const st = () => useMb.getState().stats;
const ran = (c: Ctx) => c.running && useMb.getState().running;
const of = (c: Ctx, t: CompType) => c.comps.filter((x) => x.type === t);
const conn = (c: Ctx, a: string, b: string) => c.nets.same(a, b);
const toGnd = (c: Ctx, a: string) => gndEps().some((g) => conn(c, a, g));
const ok = (c: Ctx) => !c.issues.some((i) => i.level === 'error');
function resBetween(c: Ctx, a: string, b: string) {
  return of(c, 'resistor').some((r) => (conn(c, a, `${r.id}:1`) && conn(c, b, `${r.id}:2`)) || (conn(c, a, `${r.id}:2`) && conn(c, b, `${r.id}:1`)));
}
const ledOn = (c: Ctx, pin: string) => of(c, 'led').some((l) => resBetween(c, pin, `${l.id}:A`) && toGnd(c, `${l.id}:K`));

export const MICROBIT_MISSIONS: Mission[] = [
  {
    id: 'mb1', board: 'microbit', num: 1, title: 'micro:bit 報到：捲動文字、換表情', sub: 'display.scroll · was_pressed · 觸控 logo', badge: 'mb-hello',
    goal: 'micro:bit 不用接任何線就能玩。第一支程式讓 HI 從 LED 螢幕捲過去，再用按鈕 A、B 和 V2 才有的觸控 logo 切換表情。',
    program: P_MB_HELLO, lib: [],
    steps: [
      { text: '讀程式：from microbit import * 一次把螢幕、按鈕、感測器都匯入。', why: 'display 是 LED 螢幕、button_a／button_b 是兩顆按鈕、pin_logo 是觸控 logo、Image 裡有內建圖案。真的板子在 python.microbit.org 寫好後按「傳送」，或把下載的 .hex 檔拖進 MICROBIT 磁碟。', ack: '我看懂了', check: (c) => c.acks.includes('mb1-s0') },
      { text: '按「上傳並執行」，看 HI 從右往左捲過去。', why: 'scroll() 每 150 毫秒把畫面往左移一欄。5×5 太小，一次只放得下一個字，所以長的文字都用捲的。', check: (c) => ran(c) && st().scrolled.includes('HI') },
      { text: '在面板上按 A，再按 B，看表情換成笑臉和哭臉。', why: 'was_pressed() 問的是「上次問完之後有沒有按過」，所以就算你按得很快、剛好在 sleep(50) 的時候按，也不會漏掉。', check: (c) => ran(c) && st().shown.includes('HAPPY') && st().shown.includes('SAD') },
      { text: '按住「摸 logo」，看愛心出現。', why: 'logo 是電容式觸控：手指靠近時電容變大，晶片量得到變化。它沒有會動的零件，所以不會按壞。', check: (c) => ran(c) && st().shown.includes('HEART') },
    ],
  },
  {
    id: 'mb2', board: 'microbit', num: 2, title: '傾斜水平儀＋電子骰子', sub: 'accelerometer · get_x／get_y · was_gesture', badge: 'mb-tilt',
    goal: '加速度計量的是重力往哪邊拉。把板子往哪邊壓低，那一邊的讀數就變大。這關讓一個亮點滾向比較低的那一邊，搖一搖還會擲骰子。',
    program: P_MB_LEVEL, lib: [],
    steps: [
      { text: '讀程式：(x + 1024) × 5 // 2048 把 −1024～1024 的讀數換算成 0～4，剛好是第幾行。', why: '板子平放時 x、y 都接近 0，亮點停在正中間；往右壓到底 x 約 1024，換算出來是 4（最右邊那行）。min／max 防止超出 0～4。', ack: '我算過了', check: (c) => c.acks.includes('mb2-s0') },
      { text: '上傳並執行，在面板上拖曳傾斜板的圓點，讓亮點分別碰到上、下、左、右四個邊。', why: '3D 畫面裡的板子也會跟著傾斜。真的板子上就是用手拿著轉：像在玩迷宮滾珠。', check: (c) => ran(c) && ['L', 'R', 'U', 'D'].every((e) => st().tiltEdges.includes(e)) },
      { text: '按「搖一搖」擲骰子三次。', why: '「搖一搖」不是單一讀數，而是函式庫看到加速度在短時間內大幅變化，替你判斷出來的手勢。其他手勢還有 face up、face down、left、right 等。', check: (c) => ran(c) && st().rolls.length >= 3 },
      { text: '觀察：擲骰子時，亮點有沒有跟著傾斜移動？', why: '沒有。sleep(1500) 的這 1.5 秒裡，程式只是在等，迴圈沒有再去讀加速度計。想要「一邊顯示一邊偵測」，就不能用長長的 sleep。', ack: '等待的時候它什麼都不做', check: (c) => c.acks.includes('mb2-s3') },
    ],
  },
  {
    id: 'mb3', board: 'microbit', num: 3, title: '鱷魚夾接外部 LED', sub: '大圓環 P0 · write_digital · 不用麵包板', badge: 'mb-clip',
    goal: 'micro:bit 下緣的五個大圓環可以直接夾鱷魚夾。這關用三條鱷魚夾線接一顆外部 LED 到 P0，按 A 開燈、按 B 關燈。',
    program: P_MB_CLIP, lib: ['led', 'resistor'],
    steps: [
      { text: '從元件庫加入「LED」和「電阻 220Ω」。', check: (c) => of(c, 'led').length > 0 && of(c, 'resistor').some((r) => (r.props.ohms ?? 220) < 1000) },
      { text: '大圓環 0（P0）→ 電阻 → LED 長腳（＋），LED 短腳（−）接 GND 圓環。', why: 'micro:bit 是 3.3 V，經過 220Ω 大約 6 mA，夠 LED 亮了。鱷魚夾一定要夾住整個圓環，不要碰到旁邊的窄條，不然會和隔壁的 P3、P4 短路。', check: (c) => ledOn(c, 'mcu:P0') },
      { text: '上傳並執行，按 A 讓外部 LED 亮起來，再按 B 關掉。', why: 'write_digital(1) 讓 P0 輸出 3.3 V，write_digital(0) 輸出 0 V。螢幕上的打勾和叉叉讓你不用看 LED 也知道程式跑到哪。', check: (c) => ran(c) && ok(c) && c.obs.extLedOn >= 1 && st().shown.includes('NO') },
      { text: '想想看：如果把 LED 改接到窄條 P3，會發生什麼事？', why: 'P3 是 LED 螢幕的第 3 行線。程式一用螢幕，P3 就會被掃描訊號一直切換，外部 LED 會亂閃，螢幕那一行也會不正常。外接零件請優先用 P0、P1、P2，窄條則用 P8、P16 這類沒共用的腳。', ack: 'P3 和螢幕共用', check: (c) => c.acks.includes('mb3-s3') },
    ],
  },
  {
    id: 'mb4', board: 'microbit', num: 4, title: '拍手開燈', sub: 'microphone · SoundEvent.LOUD · 門檻與誤觸發', badge: 'mb-sound',
    goal: 'V2 背面有一顆麥克風。拍一下手，螢幕全亮、喇叭嗶一聲；再拍一下就關掉。順便看看「門檻」設得不好會發生什麼事。',
    program: P_MB_CLAP, lib: [],
    steps: [
      { text: '讀程式：was_event(SoundEvent.LOUD) 只在音量「從門檻以下跨上來」的那一瞬間成立一次。', why: '如果改用 sound_level() > 門檻，拍一下手的那 0.1 秒裡迴圈會跑好幾圈，燈就會開開關關好幾次。用「事件」就只算一次。', ack: '我看懂了', check: (c) => c.acks.includes('mb4-s0') },
      { text: '上傳並執行，按兩次「拍手」：燈開、燈關。', why: '程式一用麥克風，logo 旁邊的麥克風指示燈就會亮起來（面板上的 ● MIC）。這是為了讓旁邊的人知道它在聽，程式關不掉。', check: (c) => ran(c) && st().toggles >= 2 },
      { text: '把「背景噪音」拉到 110 以上，什麼都不按，看燈會不會自己亂開亂關。', why: '教室的吵雜聲在門檻上下飄來飄去，每次飄上去都算一次「大聲」。這就是誤觸發。', check: (c) => ran(c) && st().noiseMax >= 110 && st().falseToggles >= 1 },
      { text: '背景噪音維持 110 以上，把門檻調到 190 以上，重新上傳；拍手兩次，而且不能有誤觸發。', why: '門檻要高過環境噪音、又低於拍手聲。真實世界的感測器幾乎都要這樣「依現場調參數」，沒有一個數字到處都適用。', check: (c) => ran(c) && c.params.th >= 190 && st().noiseMax >= 110 && st().toggles >= 2 && st().falseToggles === 0 },
    ],
  },
  {
    id: 'mb5', board: 'microbit', num: 5, title: '無線電猜拳', sub: 'radio.send · receive · 群組', badge: 'mb-radio',
    goal: '兩塊 micro:bit 不用接線，就能用內建的 2.4 GHz 無線電互傳訊息。面板上有一塊「朋友的 micro:bit」：搖一搖出拳，把拳送給朋友，等它回拳再判斷輸贏。',
    program: P_MB_RADIO, lib: [],
    steps: [
      { text: '讀程式：radio.send() 送出一段文字，radio.receive() 收一則訊息，沒有就回傳 None。', why: '整個教室的 micro:bit 都在同一個頻段上，所以要用 radio.config(group=…) 分「群組」，只有同一群組的訊息才會收下來。', ack: '我看懂了', check: (c) => c.acks.includes('mb5-s0') },
      { text: '群組先用預設的 1，上傳並執行，按「搖一搖」出拳。', why: '朋友的 micro:bit 設在群組 7，你的訊息它收不到，所以等了 2 秒還是沒有回音，螢幕顯示問號。', check: (c) => ran(c) && c.params.group !== FRIEND_GROUP && st().timeouts >= 1 },
      { text: `把群組改成 ${FRIEND_GROUP}，重新上傳，連續猜拳三回合。`, why: '群組一樣以後，朋友收到你的拳就會回一個拳給你。笑臉是贏、哭臉是輸、睡臉是平手。', check: (c) => ran(c) && c.params.group === FRIEND_GROUP && st().rounds >= 3 },
      { text: '想想看：「群組」能防止別人偷看你的訊息嗎？', why: '不能。群組只是在每個封包加上一個編號，收到別的群組就丟掉；任何人把群組設成一樣就收得到。要保密得自己加密。', ack: '群組不是密碼', check: (c) => c.acks.includes('mb5-s3') },
    ],
  },
];
