import { useCallback, useMemo, useRef, useState } from 'react';
import { unoLesson } from '../../data/boards/uno';
import { sfx } from '../music/sfx';
import { useProgress } from '../progress/store';

export type PartStatus = 'tray' | 'placed' | 'soldered';

/** 托盤位置（x, z），板子右側與下方 */
export const TRAY: Record<string, [number, number]> = (() => {
  const t: Record<string, [number, number]> = {
    mcu: [6.6, -2.7],
    dig: [-0.2, 3.4],
    pwr: [-1.6, 4.1],
    ana: [1.4, 4.1],
  };
  const small = ['usb', 'jack', 'u2', 'reg', 'caps', 'ledL', 'txrx', 'on', 'reset', 'xtal', 'icsp'];
  small.forEach((id, i) => {
    t[id] = [5.0 + (i % 3) * 1.65, -1.2 + Math.floor(i / 3) * 1.45];
  });
  return t;
})();

const AT = Object.fromEntries(unoLesson.parts.map((p) => [p.id, p.at]));
const NAME = Object.fromEntries(unoLesson.parts.map((p) => [p.id, p.name]));
export const SNAP_DIST = 0.8;

export function snapOk(id: string, x: number, z: number) {
  const a = AT[id];
  return Math.hypot(x - a[0], z - a[2]) < SNAP_DIST;
}

/** 放錯位置時，找出最接近的其他零件位置（用來給提示） */
export function nearestPart(x: number, z: number): string | null {
  let best: string | null = null;
  let d = 1.2;
  for (const p of unoLesson.parts) {
    const dd = Math.hypot(x - p.at[0], z - p.at[2]);
    if (dd < d) { d = dd; best = p.id; }
  }
  return best;
}

export function useAssembly() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Record<string, PartStatus>>({});
  const [drag, setDrag] = useState<{ id: string; x: number; z: number } | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [done, setDone] = useState<{ secs: number } | null>(null);
  const [sparks, setSparks] = useState<{ id: string; t: number } | null>(null);
  const t0 = useRef(0);

  const start = useCallback(() => {
    const s: Record<string, PartStatus> = {};
    unoLesson.parts.forEach((p) => (s[p.id] = 'tray'));
    setStatus(s);
    setFailed({});
    setDone(null);
    setDrag(null);
    setRunning(true);
    setMsg({ kind: 'info', text: '把托盤上的零件拖回板子上它的絲印外框裡。小技巧：先放矮的零件，比較好對位。' });
    t0.current = performance.now();
    sfx('click');
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    setStatus({});
    setDrag(null);
    setDone(null);
    setMsg(null);
  }, []);

  const onPartDown = (id: string) => {
    if (!running || status[id] !== 'tray') return;
    const tr = TRAY[id];
    setDrag({ id, x: tr[0], z: tr[1] });
    sfx('click');
  };

  const onDragMove = ([x, z]: [number, number]) => setDrag((d) => (d ? { ...d, x, z } : d));

  const onDragEnd = (p: [number, number] | null) => {
    const d = drag;
    setDrag(null);
    if (!d || !p) return;
    const [x, z] = p;
    if (snapOk(d.id, x, z)) {
      setStatus((s) => ({ ...s, [d.id]: 'placed' }));
      sfx('snap');
      setMsg({ kind: 'ok', text: `「${NAME[d.id]}」放好了！點它一下把它焊上去。` });
    } else {
      setFailed((f) => ({ ...f, [d.id]: true }));
      const near = nearestPart(x, z);
      sfx('wrong');
      const back = Math.hypot(x - TRAY[d.id][0], z - TRAY[d.id][1]) < 0.6;
      if (!back)
        setMsg({ kind: 'bad', text: near && near !== d.id ? `那裡是「${NAME[near]}」的位置。已經用閃光標出正確外框，再試一次！` : `「${NAME[d.id]}」不屬於那裡。正確位置已經用閃光標出來了。` });
    }
  };

  const onPartClick = (id: string) => {
    if (!running || status[id] !== 'placed') return;
    const ns = { ...status, [id]: 'soldered' as PartStatus };
    setStatus(ns);
    setSparks({ id, t: performance.now() });
    sfx('solder');
    const left = Object.values(ns).filter((v) => v !== 'soldered').length;
    if (left === 0) {
      const secs = Math.round((performance.now() - t0.current) / 1000);
      setTimeout(() => sfx('power'), 350);
      setDone({ secs });
      setMsg({ kind: 'ok', text: '全部焊好了！通電測試……ON 燈亮了，板子復活！' });
      const p = useProgress.getState();
      p.award('assembly-done', 100, '把 Uno 組裝回去');
      p.setAssemblyDone();
      p.grantBadge('solder-master');
    } else {
      setMsg({ kind: 'ok', text: `焊好了。還剩 ${left} 個零件。` });
    }
  };

  const offsets = useMemo(() => {
    if (!running) return undefined;
    const o: Record<string, [number, number, number]> = {};
    for (const p of unoLesson.parts) {
      const st = status[p.id];
      if (drag?.id === p.id) o[p.id] = [drag.x - p.at[0], 0.9, drag.z - p.at[2]];
      else if (st === 'tray') o[p.id] = [TRAY[p.id][0] - p.at[0], 0, TRAY[p.id][1] - p.at[2]];
      else o[p.id] = [0, 0, 0];
    }
    return o;
  }, [running, status, drag]);

  const highlights = useMemo(() => {
    const h: Record<string, string> = {};
    for (const [id, s] of Object.entries(status)) if (s === 'placed') h[id] = '#f59e0b';
    return h;
  }, [status]);

  const counts = useMemo(() => {
    const v = Object.values(status);
    return { tray: v.filter((x) => x === 'tray').length, placed: v.filter((x) => x === 'placed').length, soldered: v.filter((x) => x === 'soldered').length, total: v.length };
  }, [status]);

  return {
    running,
    status,
    drag,
    failed,
    msg,
    done,
    sparks,
    counts,
    offsets,
    highlights,
    start,
    stop,
    onPartDown,
    onDragMove,
    onDragEnd,
    onPartClick,
  };
}
