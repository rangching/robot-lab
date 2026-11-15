import * as THREE from 'three';
import { TP_PINS, TP_W, TP_D, TP_R, TP_FOOTPRINTS, TP_WHEEL_X, TP_SLOT } from '../../data/boards/threepi';

const W = 2048;
const H = Math.round((W * TP_D) / TP_W);
const L = TP_W * 10; // mm
const D = TP_D * 10;
const S = W / L; // px / mm

type Map2 = (v: number) => number;

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

/** 圓形板子＋兩個輪子缺口（缺口挖空成透明） */
function base(g: CanvasRenderingContext2D, px: Map2, py: Map2, seed: number) {
  g.fillStyle = '#123b2c';
  g.beginPath();
  g.arc(px(TP_R), py(TP_R), TP_R * S, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(110, 190, 150, ${0.08 + r() * 0.09})`;
    g.lineWidth = 3 + r() * 4;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 420;
      else y += (r() - 0.5) * 420;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    const y = r() * H;
    g.fillStyle = '#c9cdd3';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#081a13';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
  // 板邊一圈白色絲印
  g.strokeStyle = 'rgba(240, 242, 245, 0.5)';
  g.lineWidth = 0.35 * S;
  g.beginPath();
  g.arc(px(TP_R), py(TP_R), (TP_R - 1.6) * S, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // 輪子缺口
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (const wx of TP_WHEEL_X) {
    const x0 = wx < TP_R ? 0 : wx - TP_SLOT.hw;
    const x1 = wx < TP_R ? wx + TP_SLOT.hw : L;
    g.fillRect(px(x0), Math.min(py(TP_R - TP_SLOT.hd), py(TP_R + TP_SLOT.hd)), (x1 - x0) * S, 2 * TP_SLOT.hd * S);
  }
  g.restore();
}

function makeText(g: CanvasRenderingContext2D, px: Map2, py: Map2) {
  return (t: string, x: number, y: number, size: number, opts: { align?: CanvasTextAlign; weight?: number; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    g.fillStyle = opts.color ?? 'rgba(246, 247, 249, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

const pinMm = (p: { x: number; z: number }) => [(p.x + TP_W / 2) * 10, (TP_D / 2 - p.z) * 10] as const;

export function makeThreepiTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  base(g, px, py, 23);
  const text = makeText(g, px, py);

  g.fillStyle = 'rgba(205, 210, 216, 0.85)';
  for (const id of ['mcu', 'flash', 'imu', 'mag', 'yled']) {
    const [x, y, w, h] = TP_FOOTPRINTS[id];
    g.fillRect(px(x - w / 2 - 0.3), py(y + h / 2 + 0.3), (w + 0.6) * S, (h + 0.6) * S);
  }
  // 擴充排針的金色焊環
  for (const p of TP_PINS) {
    const [x, y] = pinMm(p);
    g.fillStyle = '#d9a944';
    g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#050506';
    g.beginPath(); g.arc(px(x), py(y), 0.45 * S, 0, Math.PI * 2); g.fill();
    text(p.label, x, y - 2.2, 0.62, { color: p.kind === 'power' ? 'rgba(255,140,150,.95)' : 'rgba(240,242,245,.9)' });
  }
  text('▲ FRONT', TP_R, 93, 1.3, { color: 'rgba(125,211,252,.95)' });
  text('3pi+ 2040', TP_R, 70.5, 2.1, { weight: 800 });
  text('A', 33, 9.2, 1.6, { weight: 800 });
  text('B', TP_R, 9.2, 1.6, { weight: 800 });
  text('C', 64, 9.2, 1.6, { weight: 800 });
  text('USB', 24, 12.5, 0.9);
  text('POWER', 73, 13, 0.85);
  text('RP2040', TP_R, 29.5, 0.75, { weight: 600, color: 'rgba(240,242,245,.75)' });
  text('BUZZER', 24, 26.5, 0.75, { weight: 600, color: 'rgba(240,242,245,.75)' });
  text('8V', 74, 27.5, 0.8, { color: 'rgba(255,190,120,.95)' });
  text('L', TP_WHEEL_X[0] + 9, 66, 1.3, { color: 'rgba(240,242,245,.6)' });
  text('R', TP_WHEEL_X[1] - 9, 66, 1.3, { color: 'rgba(240,242,245,.6)' });
  return finish(c);
}

export function makeThreepiBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // 背面：u 沿 +x、y 不翻轉（見 Pcb 的背面平面方向）；不能左右對調
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  base(g, px, py, 61);
  const text = makeText(g, px, py);
  // 循線感測器的位置與編號
  const [lx, ly] = TP_FOOTPRINTS.line;
  for (let i = 0; i < 5; i++) {
    const x = lx + (i - 2) * 9.5;
    text(`DN${i + 1}`, x, ly - 3.2, 0.8, { color: 'rgba(240,242,245,.85)' });
  }
  text('BL', TP_FOOTPRINTS.bumpL[0], TP_FOOTPRINTS.bumpL[1] + 2.6, 0.9);
  text('BR', TP_FOOTPRINTS.bumpR[0], TP_FOOTPRINTS.bumpR[1] + 2.6, 0.9);
  text('4 × AAA', TP_R, 24, 1.4, { color: 'rgba(240,242,245,.55)' });
  text('Pololu 3pi+ 2040', TP_R, 62, 1.2, { color: 'rgba(240,242,245,.6)' });
  return finish(c);
}
