export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  xp: number;
  color: string;
  glyph: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-light', name: '第一盞燈', desc: '完成任務 1：讓 L 燈閃起來', xp: 30, color: '#7cff6b', glyph: 'bulb' },
  { id: 'resistor', name: '限流守護者', desc: '幫外接 LED 串上電阻再點亮', xp: 30, color: '#ffc24b', glyph: 'ohm' },
  { id: 'input', name: '聽得見按鈕', desc: '用 INPUT_PULLUP 讀到按鈕', xp: 30, color: '#22e3ff', glyph: 'button' },
  { id: 'analog', name: '類比魔法師', desc: '用可變電阻調出 PWM 亮度', xp: 30, color: '#ffc24b', glyph: 'knob' },
  { id: 'common-ground', name: '共地守門員', desc: '伺服機獨立供電，而且記得共地', xp: 30, color: '#a78bfa', glyph: 'ground' },
  { id: 'radar', name: '倒車雷達', desc: '用超音波量出距離', xp: 30, color: '#22e3ff', glyph: 'wave' },
  { id: 'zero-short', name: '零短路', desc: '完成 3 個任務且從沒短路過', xp: 40, color: '#7cff6b', glyph: 'shield' },
  { id: 'quiz-perfect', name: '一眼認出', desc: '找零件測驗 6 題全部一次答對', xp: 40, color: '#ff9f43', glyph: 'eye' },
  { id: 'solder-master', name: '焊接大師', desc: '把拆開的板子全部焊回去', xp: 40, color: '#ff5c7a', glyph: 'iron' },
  { id: 'scholar', name: '讀完說明書', desc: '讀完一塊板子課程的每一個區塊', xp: 30, color: '#a78bfa', glyph: 'book' },
  { id: 'free-builder', name: '自由創客', desc: '在自由建構模式成功執行一次', xp: 30, color: '#22e3ff', glyph: 'spark' },
  { id: 'streak3', name: '連續 3 天', desc: '連續三天回到實驗室', xp: 30, color: '#ffc24b', glyph: 'flame' },
  { id: 'streak7', name: '連續 7 天', desc: '連續一週回到實驗室', xp: 60, color: '#ff5c7a', glyph: 'flame' },
  { id: 'uno-master', name: 'Uno 全制霸', desc: 'Uno 完成度達到 100%', xp: 80, color: '#7cff6b', glyph: 'crown' },
  { id: 'nano-hello', name: 'Nano 報到', desc: '在 Nano 上跑起第一支程式', xp: 30, color: '#22e3ff', glyph: 'bulb' },
  { id: 'nano-a7', name: '純類比腳', desc: '用 Nano 的 A7 讀旋鈕調亮度', xp: 30, color: '#ffc24b', glyph: 'knob' },
  { id: 'nano-tune', name: '開機音效', desc: '讓 Nano 的蜂鳴器唱完一段旋律', xp: 30, color: '#a78bfa', glyph: 'wave' },
  { id: 'nano-master', name: 'Nano 全制霸', desc: 'Nano 完成度達到 100%', xp: 80, color: '#7cff6b', glyph: 'crown' },
  { id: 'mega-hello', name: 'Mega 報到', desc: '在 Mega 上跑起第一支程式', xp: 30, color: '#22e3ff', glyph: 'bulb' },
  { id: 'mega-dbl', name: '雙排母探險家', desc: '用 D22 的按鈕控制 D44 的 LED', xp: 30, color: '#a78bfa', glyph: 'button' },
  { id: 'mega-a8', name: '第二排類比', desc: '用 Mega 的 A8 讀旋鈕調亮度', xp: 30, color: '#ffc24b', glyph: 'knob' },
  { id: 'mega-master', name: 'Mega 全制霸', desc: 'Mega 完成度達到 100%', xp: 80, color: '#7cff6b', glyph: 'crown' },
  { id: 'esp32-hello', name: 'ESP32 報到', desc: '讓 ESP32 的藍色 LED 閃起來', xp: 30, color: '#22e3ff', glyph: 'bulb' },
  { id: 'esp32-adc', name: '3.3 V 守門員', desc: '旋鈕接 3V3，用 D34 讀出 0–4095', xp: 30, color: '#ffc24b', glyph: 'knob' },
  { id: 'esp32-wifi', name: '連上網了', desc: '用手機網頁遙控 ESP32 的 LED', xp: 40, color: '#a78bfa', glyph: 'wave' },
  { id: 'esp32-servo', name: '不會斷電', desc: '伺服機獨立供電，和 ESP32 共地', xp: 30, color: '#ff5c7a', glyph: 'ground' },
  { id: 'esp32-master', name: 'ESP32 全制霸', desc: 'ESP32 完成度達到 100%', xp: 80, color: '#7cff6b', glyph: 'crown' },
];
