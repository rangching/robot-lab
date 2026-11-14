import type { CompType } from './types';

export interface CompPin {
  id: string;
  label: string;
  dx: number;
  dz: number;
  color?: string;
}

export interface CompSpec {
  type: CompType;
  name: string;
  short: string;
  w: number;
  d: number;
  pins: CompPin[];
  desc: string;
}

/** 每個元件做成「小模組板」：底板＋標好名字的接線端子，方便初學者接線 */
export const CATALOG: Record<CompType, CompSpec> = {
  led: {
    type: 'led', name: 'LED', short: 'LED', w: 1.3, d: 1.5,
    pins: [{ id: 'A', label: '+', dx: -0.3, dz: 0.5 }, { id: 'K', label: '−', dx: 0.3, dz: 0.5 }],
    desc: '發光二極體。長腳（＋，陽極）接高電位、短腳（−，陰極）接 GND；一定要串電阻。',
  },
  resistor: {
    type: 'resistor', name: '電阻', short: '電阻', w: 2.0, d: 0.9,
    pins: [{ id: '1', label: '1', dx: -0.75, dz: 0.18 }, { id: '2', label: '2', dx: 0.75, dz: 0.18 }],
    desc: '限制電流。沒有方向性，兩腳可以互換。',
  },
  button: {
    type: 'button', name: '按鈕', short: '按鈕', w: 1.5, d: 1.5,
    pins: [{ id: '1', label: '1', dx: -0.4, dz: 0.55 }, { id: '2', label: '2', dx: 0.4, dz: 0.55 }],
    desc: '按下時 1 和 2 接通，放開就斷開。',
  },
  pot: {
    type: 'pot', name: '可變電阻', short: '可變電阻', w: 1.8, d: 1.7,
    pins: [{ id: '1', label: '1', dx: -0.55, dz: 0.6 }, { id: 'W', label: 'W', dx: 0, dz: 0.6 }, { id: '2', label: '2', dx: 0.55, dz: 0.6 }],
    desc: '旋鈕式分壓器。兩端接 5V 和 GND，中間腳（W）輸出 0–5 V。',
  },
  buzzer: {
    type: 'buzzer', name: '蜂鳴器', short: '蜂鳴器', w: 1.4, d: 1.5,
    pins: [{ id: 'P', label: '+', dx: -0.3, dz: 0.55 }, { id: 'N', label: '−', dx: 0.3, dz: 0.55 }],
    desc: '被動蜂鳴器，用 tone() 送方波就會發聲。',
  },
  servo: {
    type: 'servo', name: 'SG90 伺服機', short: '伺服機', w: 2.6, d: 1.8,
    pins: [
      { id: 'GND', label: 'GND', dx: -0.6, dz: 0.7, color: '#7a4a2a' },
      { id: 'V', label: 'V+', dx: 0, dz: 0.7, color: '#e0362c' },
      { id: 'SIG', label: 'SIG', dx: 0.6, dz: 0.7, color: '#ff9a1f' },
    ],
    desc: '可以轉到指定角度（0–180°）的小馬達。棕＝GND、紅＝V+、橘＝訊號。',
  },
  hcsr04: {
    type: 'hcsr04', name: 'HC-SR04 超音波', short: '超音波', w: 4.4, d: 2.0,
    pins: [
      { id: 'VCC', label: 'VCC', dx: -0.9, dz: 0.75 },
      { id: 'TRIG', label: 'TRIG', dx: -0.3, dz: 0.75 },
      { id: 'ECHO', label: 'ECHO', dx: 0.3, dz: 0.75 },
      { id: 'GND', label: 'GND', dx: 0.9, dz: 0.75 },
    ],
    desc: '發出超音波、量回音時間來算距離（2–400 cm）。需要 5 V。',
  },
  psu: {
    type: 'psu', name: '外接 5V 電源', short: '5V 電源', w: 2.6, d: 1.7,
    pins: [{ id: 'P', label: '+5V', dx: -0.5, dz: 0.6 }, { id: 'N', label: 'GND', dx: 0.5, dz: 0.6 }],
    desc: '電池盒＋穩壓模組，專門給馬達、伺服機用的獨立電源。',
  },
};

export const LIB_ORDER: CompType[] = ['led', 'resistor', 'button', 'pot', 'buzzer', 'servo', 'hcsr04', 'psu'];
