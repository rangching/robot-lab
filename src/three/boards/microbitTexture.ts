import * as THREE from 'three';
import { EDGE_SLOTS, EDGE_PITCH, MB_W, MB_D, MB_FOOTPRINTS, RING_HOLE_R, RING_Y, slotX, edgeX, RINGS } from '../../data/boards/microbit';

const W = 2048;
const H = Math.round((W * MB_D) / MB_W);
const L = MB_W * 10; // mm
const D = MB_D * 10;
const S = W / L; // px / mm
/** 圓角半徑、金手指窄條長度、圓環焊墊高度（mm） */
export const MB_CORNER = 3;
export const STRIP_LEN = 4.2;
export const RING_PAD_TOP = 8.2;
/** V2 圓環兩側的缺口（mm） */
export const NOTCH_W = 0.7;
export const NOTCH_D = 2.4;

type Map2 = (v: number) => number;

/** 每個圓環佔的 4 格範圍（mm）：[左緣, 右緣] */
export function ringSpan(id: string): [number, number] {
  const idx = EDGE_SLOTS.map((s, i) => [s, i] as const).filter(([s]) => s.id === id && s.ring).map(([, i]) => i);
  return [slotX(idx[0]) - EDGE_PITCH / 2, slotX(idx[idx.length - 1]) + EDGE_PITCH / 2];
}
/** 所有缺口的中心 x（mm），由左到右 */
export function notchXs(): number[] {
  return RINGS.flatMap((id) => ringSpan(id)).sort((a, b) => a - b);
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 黑色板子＋若隱若現的走線；圓角外、圓環孔、缺口挖成透明 */
function base(g: CanvasRenderingContext2D, px: Map2, py: Map2, seed: number) {
  g.fillStyle = '#17191e';
  roundRect(g, 0, 0, W, H, MB_CORNER * S);
  g.fill();
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const r = rng(seed);
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(120, 130, 150, ${0.06 + r() * 0.07})`;
    g.lineWidth = 3 + r() * 3;
    g.beginPath();
    let x = r() * W;
    let y = H * 0.25 + r() * H * 0.7;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 380;
      else y += (r() - 0.5) * 300;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  edgeConnector(g, px, py);
  // 挖孔：圓環孔＋V2 的缺口
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (const id of RINGS) {
    g.beginPath();
    g.arc(px(edgeX(id, true)), py(RING_Y), RING_HOLE_R * S, 0, Math.PI * 2);
    g.fill();
  }
  for (const x of notchXs()) {
    const y0 = Math.min(py(0), py(NOTCH_D));
    g.fillRect(px(x - NOTCH_W / 2), y0, NOTCH_W * S, Math.abs(py(NOTCH_D) - py(0)) + 2);
  }
  g.restore();
}

/** 金手指：窄條＋五個大圓環焊墊 */
function edgeConnector(g: CanvasRenderingContext2D, px: Map2, py: Map2) {
  g.fillStyle = '#d9a944';
  EDGE_SLOTS.forEach((s, i) => {
    if (s.ring) return;
    const x = slotX(i);
    g.fillRect(px(x - EDGE_PITCH * 0.32), Math.min(py(0), py(STRIP_LEN)), EDGE_PITCH * 0.64 * S, STRIP_LEN * S);
  });
  for (const id of RINGS) {
    const [a, b] = ringSpan(id);
    const cx = edgeX(id, true);
    g.beginPath();
    // 下半部是長方形（到板邊），上半部是半圓
    const rr = (b - a) / 2 - 0.15;
    g.moveTo(px(cx - rr), py(0));
    g.lineTo(px(cx - rr), py(RING_Y));
    g.arc(px(cx), py(RING_Y), rr * S, Math.PI, 0, py(1) > py(0));
    g.lineTo(px(cx + rr), py(0));
    g.closePath();
    g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: Map2, py: Map2) {
  return (t: string, x: number, y: number, size: number, opts: { align?: CanvasTextAlign; weight?: number; color?: string; font?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    g.fillStyle = opts.color ?? 'rgba(246, 247, 249, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.weight ?? 700} ${size * S}px ${opts.font ?? '"JetBrains Mono", monospace'}`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

export function makeMicrobitTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  base(g, px, py, 11);
  const text = makeText(g, px, py);
  const labels: Record<string, string> = { P0: '0', P1: '1', P2: '2', '3V3': '3V', GND: 'GND' };
  for (const id of RINGS) text(labels[id], edgeX(id, true), RING_PAD_TOP + 1.6, 1.9, { weight: 800 });
  // 按鈕旁的 A／B
  const [ax, ay] = MB_FOOTPRINTS.btnA;
  const [bxm, by] = MB_FOOTPRINTS.btnB;
  text('A', ax, ay + 5.2, 2.6, { weight: 800 });
  text('B', bxm, by + 5.2, 2.6, { weight: 800 });
  // LED 矩陣的白色外框
  const [mx, my, mw, mh] = MB_FOOTPRINTS.matrix;
  g.strokeStyle = 'rgba(240, 242, 245, 0.18)';
  g.lineWidth = 0.25 * S;
  roundRect(g, px(mx - mw / 2), py(my + mh / 2), mw * S, mh * S, 1.2 * S);
  g.stroke();
  // 觸控 logo：金色的圓角外框＋兩個點（示意）
  const [lx, ly, lw, lh] = MB_FOOTPRINTS.logo;
  g.strokeStyle = '#d9a944';
  g.lineWidth = 0.75 * S;
  roundRect(g, px(lx - lw / 2), py(ly + lh / 2), lw * S, lh * S, (lh / 2) * S);
  g.stroke();
  g.fillStyle = '#d9a944';
  for (const dx of [-1.8, 1.8]) {
    g.beginPath();
    g.arc(px(lx + dx), py(ly), 0.75 * S, 0, Math.PI * 2);
    g.fill();
  }
  // 麥克風收音孔
  const [mcx, mcy] = MB_FOOTPRINTS.micLed;
  g.fillStyle = '#050506';
  g.beginPath();
  g.arc(px(mcx + 2.2), py(mcy), 0.45 * S, 0, Math.PI * 2);
  g.fill();
  text('V2', 47.5, 39.5, 1.3, { color: 'rgba(240,242,245,.45)' });
  return finish(c);
}

export function makeMicrobitBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // 背面：u 沿 +x、y 不翻轉（見 Pcb 的背面平面方向）；不能左右對調
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  base(g, px, py, 47);
  const text = makeText(g, px, py);
  // 背面的腳位編號，印在窄條上方（從背面看是反的，這裡照正面座標寫）
  EDGE_SLOTS.forEach((s, i) => {
    if (s.ring || s.guard) return;
    text(s.id.replace('P', ''), slotX(i), STRIP_LEN + 1.6, 0.85, { color: 'rgba(240,242,245,.75)' });
  });
  // 2.4 GHz 天線：彎彎曲曲的銅箔
  const [ax, ay] = MB_FOOTPRINTS.antenna;
  g.strokeStyle = '#c9963c';
  g.lineWidth = 0.6 * S;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(px(ax - 4), py(ay - 4));
  for (let k = 0; k < 5; k++) {
    const x = ax - 4 + k * 2;
    g.lineTo(px(x), py(ay + 3.5));
    g.lineTo(px(x + 1), py(ay + 3.5));
    g.lineTo(px(x + 1), py(ay - 3));
    g.lineTo(px(x + 2), py(ay - 3));
  }
  g.stroke();
  text('ANT', ax, ay - 5.5, 0.9, { color: 'rgba(240,242,245,.6)' });
  text('micro:bit', 25.8, 13.5, 2.2, { weight: 800, color: 'rgba(240,242,245,.8)' });
  text('SPEAKER', MB_FOOTPRINTS.speaker[0], MB_FOOTPRINTS.speaker[1] - 7.2, 0.9, { color: 'rgba(240,242,245,.6)' });
  text('MIC', MB_FOOTPRINTS.mic[0], MB_FOOTPRINTS.mic[1] - 2.5, 0.8, { color: 'rgba(240,242,245,.6)' });
  text('RESET', MB_FOOTPRINTS.reset[0], MB_FOOTPRINTS.reset[1] - 3, 0.8, { color: 'rgba(240,242,245,.6)' });
  text('BATTERY', MB_FOOTPRINTS.battery[0], MB_FOOTPRINTS.battery[1] - 4.2, 0.8, { color: 'rgba(240,242,245,.6)' });
  text('USB', MB_FOOTPRINTS.usb[0], MB_FOOTPRINTS.usb[1] - 4, 0.8, { color: 'rgba(240,242,245,.6)' });
  return finish(c);
}
