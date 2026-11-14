import { create } from 'zustand';
import { MCU } from './board';
import { CATALOG } from './catalog';
import type { Nets } from './netlist';
import { ep, type Comp } from './types';
import { MOTORS, MOTOR_DIR, MOTOR_SHAFT, NO_STICK, type Hardware, type MotorId, type PropState, type Stick } from './flight';

/**
 * 模擬 M5Stamp Fly 的遙控器（Atom JoyStick，透過 ESP-NOW 直接和 StampS3 對話，不經過 Wi-Fi 基地台）。
 * 畫面上的遙控器面板寫入搖桿與解鎖請求；飛控程式（generator）每輪取出請求，引擎每 0.1 秒回寫遙測資料。
 */
export interface Telemetry {
  armed: boolean;
  flipped: boolean;
  landing: boolean;
  mode: 'direct' | 'stab' | 'alt';
  /** 高度與目標（cm） */
  alt: number;
  ref: number;
  vbat: number;
  roll: number;
  pitch: number;
  yaw: number;
  /** 最近一次解鎖被拒絕的原因 */
  refused: string | null;
}

export interface DroneStore {
  stick: Stick;
  req: 'arm' | 'disarm' | null;
  telem: Telemetry | null;
  /** 最近 10 秒的高度紀錄（cm） */
  hist: { t: number; alt: number; ref: number }[];
  setStick: (k: keyof Stick, v: number) => void;
  center: () => void;
  request: (r: 'arm' | 'disarm') => void;
  take: () => 'arm' | 'disarm' | undefined;
  setTelem: (t: Telemetry, time: number) => void;
  clearRun: () => void;
}

export const useDrone = create<DroneStore>((set, get) => ({
  stick: { ...NO_STICK },
  req: null,
  telem: null,
  hist: [],
  setStick: (k, v) => set((s) => ({ stick: { ...s.stick, [k]: v } })),
  center: () => set((s) => ({ stick: { ...s.stick, roll: 0, pitch: 0, yaw: 0 } })),
  request: (req) => set({ req }),
  take: () => {
    const r = get().req;
    if (r) set({ req: null });
    return r ?? undefined;
  },
  setTelem: (telem, t) => set((s) => ({ telem, hist: [...s.hist.filter((h) => t - h.t < 10000), { t, alt: telem.alt, ref: telem.ref }] })),
  clearRun: () => set({ req: null, telem: null, hist: [] }),
}));

/** 從接線判斷：每顆馬達裝了什麼槳、電池有沒有接對 */
export function droneHardware(comps: Comp[], nets: Nets): Hardware & { propIds: Record<MotorId, string[]> } {
  const props = { FL: null, FR: null, RL: null, RR: null } as Record<MotorId, PropState>;
  const propIds = { FL: [], FR: [], RL: [], RR: [] } as Record<MotorId, string[]>;
  for (const m of MOTORS) {
    const shaft = ep(MCU, MOTOR_SHAFT[m]);
    for (const c of comps) {
      if (c.type !== 'prop' || !nets.same(ep(c.id, 'HUB'), shaft)) continue;
      propIds[m].push(c.id);
      props[m] = (c.props.dir ?? 'cw') === MOTOR_DIR[m] ? 'ok' : 'wrong';
    }
  }
  const battery = comps.some((c) => c.type === 'lipo' && nets.same(ep(c.id, 'P'), ep(MCU, 'BAT')) && nets.same(ep(c.id, 'N'), ep(MCU, 'GND3')));
  return { props, propIds, battery };
}

/** 給介面用：元件是不是無人機專用（只在 Stamp Fly 的工作台出現） */
export const DRONE_ONLY = new Set(['prop', 'lipo']);
export const isDroneComp = (t: string) => DRONE_ONLY.has(t) && t in CATALOG;
