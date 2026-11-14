import { create } from 'zustand';
import { CATALOG } from '../../sim/catalog';
import { checkCircuit, hasError } from '../../sim/rules';
import { defaultParams, FREE_PROGRAMS, freePrograms, type ProgramDef } from '../../sim/programs';
import { splitEp, type Comp, type CompType, type Endpoint, type Issue, type Wire } from '../../sim/types';
import { MISSION_MAP, missionsFor } from './missions';
import { MCU, simBoard } from '../../sim/board';
import type { BoardId } from '../../data/types';
import { sfx } from '../music/sfx';
import { useProgress } from '../progress/store';

/** 開發板在工作台上佔的範圍（依目前的板子） */
function boardBox() {
  const { pos, half } = simBoard().bench;
  return { x0: pos[0] - half[0], x1: pos[0] + half[0], z0: pos[2] - half[1], z1: pos[2] + half[1] };
}

export const WIRE_COLORS = ['auto', '#0ea5e9', '#f59e0b', '#22c55e', '#f97316', '#8b5cf6', '#1e293b'];

function autoColor(a: Endpoint, b: Endpoint, comps: Comp[]) {
  const pins = [a, b].map((e) => splitEp(e));
  const isGnd = pins.some(([o, p]) => (o === MCU && p.startsWith('GND')) || (p === 'N' && comps.find((c) => c.id === o)?.type === 'psu') || p === 'GND' || p === 'K');
  const isPwr = pins.some(([o, p]) => (o === MCU && (p === '5V' || p === '3V3' || p === 'VIN')) || (p === 'P' && comps.find((c) => c.id === o)?.type === 'psu') || p === 'V' || p === 'VCC');
  if (isGnd && !isPwr) return '#334155';
  if (isPwr && !isGnd) return '#ef4444';
  return '#f59e0b';
}

function overlaps(x: number, z: number, w: number, d: number, comps: Comp[], skip?: string) {
  const m = 0.35;
  const BOX = boardBox();
  if (x + w / 2 > BOX.x0 - m && x - w / 2 < BOX.x1 + m && z + d / 2 > BOX.z0 - m && z - d / 2 < BOX.z1 + m) return true;
  return comps.some((c) => {
    if (c.id === skip) return false;
    const s = CATALOG[c.type];
    return Math.abs(c.x - x) < (s.w + w) / 2 + m && Math.abs(c.z - z) < (s.d + d) / 2 + m;
  });
}

/** 找最靠近開發板右側的空位 */
export function freeSpot(type: CompType, comps: Comp[]): [number, number] {
  const s = CATALOG[type];
  const cands: [number, number, number][] = [];
  for (let z = -3.4; z <= 4.6; z += 0.5) for (let x = 0.4 + s.w / 2; x <= 9.5; x += 0.5) cands.push([x, z, Math.hypot(x - 1.5, (z + 0.4) * 1.3)]);
  cands.sort((a, b) => a[2] - b[2]);
  for (const [x, z] of cands) if (!overlaps(x, z, s.w, s.d, comps)) return [x, z];
  return [4, 5];
}

export type MissionId = string;

interface BenchState {
  board: BoardId;
  missionId: MissionId;
  comps: Comp[];
  wires: Wire[];
  pending: Endpoint | null;
  wireColor: string;
  selected: string | null;
  running: boolean;
  runNonce: number;
  issues: Issue[];
  serial: string[];
  tag: string | null;
  params: Record<string, number>;
  freeProgramId: string;
  pot: Record<string, number>;
  pressed: Record<string, boolean>;
  distance: number;
  acks: string[];
  nid: number;
  program: () => ProgramDef;
  loadMission: (id: MissionId) => void;
  /** 換板子：清空工作台並載入這塊板子的第一個任務 */
  setBoard: (b: BoardId) => void;
  addComp: (type: CompType, props?: Comp['props']) => void;
  moveComp: (id: string, x: number, z: number) => void;
  removeComp: (id: string) => void;
  select: (id: string | null) => void;
  clickPin: (e: Endpoint) => void;
  cancelPending: () => void;
  removeWire: (id: string) => void;
  setWireColor: (c: string) => void;
  setParam: (k: string, v: number) => void;
  setFreeProgram: (id: string) => void;
  run: () => boolean;
  stop: () => void;
  ack: (k: string) => void;
  setPot: (id: string, v: number) => void;
  setPressed: (id: string, v: boolean) => void;
  setDistance: (v: number) => void;
  pushSerial: (line: string) => void;
  setTag: (t: string | null) => void;
  clearBench: () => void;
}

export const useBench = create<BenchState>((set, get) => ({
  board: 'uno',
  missionId: 'm1',
  comps: [],
  wires: [],
  pending: null,
  wireColor: 'auto',
  selected: null,
  running: false,
  runNonce: 0,
  issues: [],
  serial: [],
  tag: null,
  params: defaultParams(MISSION_MAP.m1.program),
  freeProgramId: FREE_PROGRAMS[1].id,
  pot: {},
  pressed: {},
  distance: 40,
  acks: [],
  nid: 1,

  program: () => {
    const { missionId, freeProgramId } = get();
    const list = freePrograms(get().board);
    if (missionId === 'free') return list.find((p) => p.id === freeProgramId) ?? list[0];
    return MISSION_MAP[missionId].program;
  },

  setBoard: (b) => {
    set({ board: b, comps: [], wires: [], freeProgramId: freePrograms(b)[1].id });
    get().loadMission(missionsFor(b)[0]?.id ?? 'free');
  },

  loadMission: (id) => {
    const m = id === 'free' ? null : MISSION_MAP[id];
    if (id !== 'free' && !m) return;
    const preset = m?.preset;
    const list = freePrograms(get().board);
    const prog = m ? m.program : list.find((p) => p.id === get().freeProgramId) ?? list[0];
    set({
      missionId: id,
      comps: preset ? preset.comps.map((c) => ({ ...c, props: { ...c.props } })) : id === 'free' ? get().comps : [],
      wires: preset ? preset.wires.map((w) => ({ ...w })) : id === 'free' ? get().wires : [],
      pending: null,
      selected: null,
      running: false,
      issues: [],
      serial: [],
      tag: null,
      params: defaultParams(prog),
      acks: [],
      pot: {},
      pressed: {},
    });
  },

  addComp: (type, props = {}) => {
    if (get().running) return;
    const n = get().nid;
    const [x, z] = freeSpot(type, get().comps);
    const c: Comp = { id: `c${n}`, type, x, z, props: { ...(type === 'led' ? { color: '#ff3b4f' } : {}), ...(type === 'resistor' ? { ohms: 220 } : {}), ...props } };
    set((s) => ({ comps: [...s.comps, c], nid: n + 1, selected: c.id, issues: [] }));
    sfx('snap');
  },

  moveComp: (id, x, z) => set((s) => ({ comps: s.comps.map((c) => (c.id === id ? { ...c, x: Math.max(-1, Math.min(12, x)), z: Math.max(-5, Math.min(7, z)) } : c)) })),

  removeComp: (id) => {
    if (get().running) return;
    set((s) => ({
      comps: s.comps.filter((c) => c.id !== id),
      wires: s.wires.filter((w) => !w.a.startsWith(id + ':') && !w.b.startsWith(id + ':')),
      selected: null,
      pending: s.pending?.startsWith(id + ':') ? null : s.pending,
      issues: [],
    }));
    sfx('click');
  },

  select: (selected) => set({ selected }),

  clickPin: (e) => {
    const { pending, wires, running, comps, wireColor } = get();
    if (running) return;
    if (!pending) {
      set({ pending: e });
      sfx('click');
      return;
    }
    if (pending === e) {
      set({ pending: null });
      return;
    }
    const dup = wires.some((w) => (w.a === pending && w.b === e) || (w.a === e && w.b === pending));
    if (!dup) {
      const n = get().nid;
      const color = wireColor === 'auto' ? autoColor(pending, e, comps) : wireColor;
      set({ wires: [...wires, { id: `w${n}`, a: pending, b: e, color }], nid: n + 1, issues: [] });
      sfx('wire');
    }
    set({ pending: null });
  },

  cancelPending: () => set({ pending: null }),

  removeWire: (id) => {
    if (get().running) return;
    set((s) => ({ wires: s.wires.filter((w) => w.id !== id), issues: [] }));
    sfx('click');
  },

  setWireColor: (wireColor) => set({ wireColor }),
  setParam: (k, v) => set((s) => ({ params: { ...s.params, [k]: v } })),
  setFreeProgram: (id) => {
    const list = freePrograms(get().board);
    const p = list.find((x) => x.id === id) ?? list[0];
    set({ freeProgramId: id, params: defaultParams(p), running: false, issues: [] });
  },

  run: () => {
    const { comps, wires } = get();
    const prog = get().program();
    // 參數超出範圍時先夾回合理值
    const params = { ...get().params };
    for (const d of prog.params ?? []) params[d.key] = Math.max(d.min, Math.min(d.max, params[d.key] || d.def));
    set({ params });
    const issues = checkCircuit(comps, wires, prog.outputs);
    if (hasError(issues)) {
      set({ issues, running: false });
      sfx('alarm');
      if (issues.some((i) => i.code === 'short' || i.code === 'pin-short' || i.code === 'rails')) useProgress.getState().addShort();
      return false;
    }
    set((s) => ({ issues, running: true, runNonce: s.runNonce + 1, serial: [], tag: null, pending: null }));
    sfx('power');
    return true;
  },

  stop: () => set({ running: false, tag: null }),
  ack: (k) => set((s) => ({ acks: s.acks.includes(k) ? s.acks : [...s.acks, k] })),
  setPot: (id, v) => set((s) => ({ pot: { ...s.pot, [id]: v } })),
  setPressed: (id, v) => set((s) => ({ pressed: { ...s.pressed, [id]: v } })),
  setDistance: (distance) => set({ distance }),
  pushSerial: (line) => set((s) => ({ serial: [...s.serial.slice(-79), line] })),
  setTag: (tag) => set({ tag }),
  clearBench: () => {
    if (get().running) return;
    set({ comps: [], wires: [], pending: null, selected: null, issues: [] });
  },
}));
