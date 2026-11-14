export type PinKind = 'power' | 'gnd' | 'digital' | 'pwm' | 'analog' | 'bus' | 'control' | 'nc';

/** 板子上的一支腳位（座標單位：公分，原點在板子中心，x 向右、z 向下） */
export interface PinDef {
  id: string;
  label: string;
  kind: PinKind;
  desc: string;
  x: number;
  z: number;
}

export interface PartDef {
  id: string;
  num: number;
  name: string;
  /** 測驗用的提問說法 */
  quiz: string;
  desc: string;
  /** 零件中心位置（3D，公分） */
  at: [number, number, number];
  /** 爆炸圖層級：越大浮得越高；負數代表往下（背面零件） */
  layer: number;
  /** 焊在背面的零件（3D 模型會翻轉到板子下方） */
  side?: 'top' | 'bottom';
}

export interface QuizQ {
  part: string;
  prompt: string;
  hint: string;
  explain: string;
}

export type BoardId = 'uno' | 'nano' | 'mega' | 'esp32' | 'nodemcu' | 'pico' | 'bluepill' | 'rpi4';

export interface BoardSummary {
  id: BoardId;
  num: number;
  name: string;
  maker: string;
  year: number;
  level: '入門' | '進階' | '高階';
  tagline: string;
  mcu: string;
  clock: string;
  flash: string;
  ram: string;
  gpio: string;
  analog: string;
  wireless: string;
  logic: string;
  price: string;
  locked: boolean;
}

export interface BoardLesson {
  summary: string;
  stats: { k: string; v: string }[];
  specs: { k: string; v: string }[];
  parts: PartDef[];
  strengths: string[];
  pitfalls: string[];
  pinGroups: { title: string; kind: PinKind; body: string }[];
  code: { title: string; lang: string; source: string };
  projects: string[];
  facts: string[];
  quiz: QuizQ[];
}

export const PIN_COLORS: Record<PinKind, string> = {
  power: '#e11d48',
  gnd: '#64748b',
  digital: '#0891b2',
  pwm: '#16a34a',
  analog: '#d97706',
  bus: '#7c3aed',
  control: '#ea580c',
  nc: '#94a3b8',
};

export const PIN_KIND_LABEL: Record<PinKind, string> = {
  power: '電源',
  gnd: '接地 GND',
  digital: '數位',
  pwm: '數位＋PWM',
  analog: '類比輸入',
  bus: '通訊匯流排',
  control: '控制（RESET）',
  nc: '未連接',
};
