import type { BoardId, BoardLesson, BoardSummary, PinDef } from '../types';
import { BOARDS } from './index';
import { UNO_PINS, UNO_INTERNAL_NETS, UNO_FOOTPRINTS, UNO_W, UNO_D, unoLesson, mx, mz } from './uno';
import { megaData } from './mega';
import { esp32Data } from './esp32';
import { bluepillData } from './bluepill';
import { rpi4Data } from './rpi4';
import { picoData } from './pico';
import { nodemcuData } from './nodemcu';
import { stampflyData } from './stampfly';
import { jetsonData } from './jetson';
import { NANO_PINS, NANO_INTERNAL_NETS, NANO_FOOTPRINTS, NANO_W, NANO_D, nanoLesson, nx, nz } from './nano';

/** [相機 x, y, z, 目標 x, y, z] */
export type V6 = [number, number, number, number, number, number];

/**
 * 一塊板子的所有非 3D 資料。座標：cm，原點在板子中心，x 向右、z 朝觀看者，PCB 頂面 y = 0。
 * 3D 外觀另外放在 src/three/boards/visuals.tsx 的 BoardVisual。
 */
export interface BoardData {
  id: BoardId;
  /** 介面文字用的短名，例如「Uno 的 5V」 */
  short: string;
  summary: BoardSummary;
  lesson: BoardLesson;
  w: number;
  d: number;
  pins: PinDef[];
  /** 板內本來就相通的腳 */
  internalNets: string[][];
  /** 5 V 電源腳 id */
  supply: string[];
  /** 所有 GND 腳 id */
  gnd: string[];
  /** 只能類比讀取的腳（Nano 的 A6、A7） */
  analogOnly: string[];
  /** 邏輯電壓（預設 5）；3.3 V 的板子會多做「腳位不能接 5 V」等檢查 */
  logicV?: number;
  /** 板上 LED 接哪支腳（預設 D13） */
  ledPin?: string;
  /** 板上 LED 是低電位點亮（Blue Pill 的 PC13：寫 LOW 才亮） */
  ledActiveLow?: boolean;
  /** 可以承受 5 V 數位訊號的腳（STM32 的 FT 腳）；3.3 V 板子的 5 V 檢查會略過它們 */
  tolerant5v?: string[];
  /** 只能當輸入、沒有內建上拉電阻的腳（ESP32 的 GPIO34–39） */
  inputOnly?: string[];
  /** 可以輸出、但沒有內建上拉電阻的腳（NodeMCU 的 D0＝GPIO16） */
  noPullup?: string[];
  /** 開機時不能被拉高的開機綁腳（ESP32 的 D12） */
  strapLow?: string[];
  /** 和 USB 共用的序列埠腳（預設 D0、D1） */
  serialPins?: string[];
  /** 板內接死、沒有拉出排針的 GPIO（Stamp Fly 的馬達驅動腳）；程式可以寫，但工作台上不能接線 */
  internalPins?: string[];
  /** 腳位是排母還是排針（介面文字用，預設排母） */
  header?: '排母' | '排針';
  /** 零件外框（mm：中心 x, y, 寬, 高；原點在板子左下角） */
  footprints: Record<string, [number, number, number, number]>;
  mx: (mm: number) => number;
  mz: (mm: number) => number;
  /** 組裝托盤位置 [x, z, y?]（cm）；列在這裡的零件才會進入組裝遊戲 */
  tray: Record<string, [number, number, number?]>;
  stage: {
    floorY: number;
    /** 3D 檢視時腳位熱點的高度 */
    pinY: number;
    /** 爆炸圖時整塊板子往上抬多少（讓背面零件有空間往下飛） */
    explodeLift: number;
    /** 爆炸圖每一層的間距（預設 0.9） */
    explodeGap?: number;
    views: { iso: V6; top: V6; bottom: V6; front: V6 };
    asmCam: V6;
  };
  bench: {
    pos: [number, number, number];
    /** 佔地半寬 x、半深 z */
    half: [number, number];
    /** 模型原點（PCB 頂面）距離工作台面的高度 */
    lift: number;
    /** 接線端點相對 pos 的位置 */
    pin: (p: PinDef) => [number, number, number];
  };
}

const summaryOf = (id: BoardId) => BOARDS.find((b) => b.id === id)!;

function smallTray(ids: string[], x0: number, z0: number, dx: number, dz: number, cols = 3, y?: number): Record<string, [number, number, number?]> {
  return Object.fromEntries(ids.map((id, i) => [id, [x0 + (i % cols) * dx, z0 + Math.floor(i / cols) * dz, y]]));
}

export const unoData: BoardData = {
  id: 'uno',
  short: 'Uno',
  summary: summaryOf('uno'),
  lesson: unoLesson,
  w: UNO_W,
  d: UNO_D,
  pins: UNO_PINS,
  internalNets: UNO_INTERNAL_NETS,
  supply: ['5V', 'IOREF'],
  gnd: ['GND1', 'GND2', 'GND3'],
  analogOnly: [],
  footprints: UNO_FOOTPRINTS,
  mx,
  mz,
  tray: {
    mcu: [6.6, -2.7],
    dig: [-0.2, 3.4],
    pwr: [-1.6, 4.1],
    ana: [1.4, 4.1],
    ...smallTray(['usb', 'jack', 'u2', 'reg', 'caps', 'ledL', 'txrx', 'on', 'reset', 'xtal', 'icsp'], 5.0, -1.2, 1.65, 1.45),
  },
  stage: {
    floorY: -0.17,
    pinY: 0.87,
    explodeLift: 0,
    views: {
      iso: [5.4, 7.6, 9.0, 0, 0, 0.2],
      top: [0, 13.5, 0.01, 0, 0, 0],
      bottom: [0, -12.5, 0.6, 0, 0, 0],
      front: [0, 2.8, 12, 0, 0.2, 0],
    },
    asmCam: [2.4, 18.5, 6.6, 2.4, 0, -0.2],
  },
  bench: {
    pos: [-4.2, 0, -0.6],
    half: [3.7, 3.0],
    lift: 0,
    pin: (p) => [p.x, 0.87, p.z],
  },
};

/** Nano 在工作台上插在麵包板中間：PCB 頂面距台面 = 麵包板 0.85 + 塑膠座 0.25 + PCB 0.16 */
export const NANO_BENCH_LIFT = 1.26;
/** 接線插在排針外側第二個孔（同一直排電氣相通） */
export const NANO_BB_OFFSET = 0.508;

export const nanoData: BoardData = {
  id: 'nano',
  short: 'Nano',
  summary: summaryOf('nano'),
  lesson: nanoLesson,
  w: NANO_W,
  d: NANO_D,
  pins: NANO_PINS,
  internalNets: NANO_INTERNAL_NETS,
  supply: ['5V'],
  gnd: ['GND1', 'GND2'],
  analogOnly: ['A6', 'A7'],
  header: '排針',
  footprints: NANO_FOOTPRINTS,
  mx: nx,
  mz: nz,
  tray: {
    hdrF: [0.2, 2.0, 0],
    hdrN: [0.2, 2.8, 0],
    ...smallTray(['mcu', 'usb', 'reset', 'xtal', 'txrx', 'ledL', 'pow', 'icsp'], 3.0, -0.6, 1.1, 1.0, 4, -0.98),
  },
  stage: {
    floorY: -1.03,
    pinY: 0.06,
    explodeLift: 0.9,
    explodeGap: 0.55,
    views: {
      iso: [3.6, 5.2, 6.0, 0, -0.2, 0.1],
      top: [0, 9.0, 0.01, 0, 0, 0],
      bottom: [0, -8.5, 0.5, 0, 0, 0],
      front: [0, 1.6, 8.0, 0, -0.2, 0],
    },
    asmCam: [1.9, 14.0, 6.0, 1.9, -0.6, 0.1],
  },
  bench: {
    pos: [-3.6, 0, -0.6],
    half: [3.05, 1.95],
    lift: NANO_BENCH_LIFT,
    pin: (p) => [p.x, 0.87, p.z + Math.sign(p.z) * NANO_BB_OFFSET],
  },
};

export const BOARD_DATA: Partial<Record<BoardId, BoardData>> = {
  uno: unoData,
  nano: nanoData,
  mega: megaData,
  esp32: esp32Data,
  bluepill: bluepillData,
  rpi4: rpi4Data,
  pico: picoData,
  nodemcu: nodemcuData,
  stampfly: stampflyData,
  jetson: jetsonData,
};

export const explodeGap = (b: BoardData) => b.stage.explodeGap ?? 0.9;

export const boardData = (id: BoardId): BoardData => BOARD_DATA[id] ?? unoData;
export const isPlayable = (id: BoardId) => !!BOARD_DATA[id];
