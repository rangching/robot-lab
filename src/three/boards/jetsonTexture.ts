import * as THREE from 'three';
import { JET_PINS, JET_W, JET_D, JET_FOOTPRINTS, JET_CAM_X, JET_CAM_Y, physOfJet } from '../../data/boards/jetson';

const W = 2048;
const H = Math.round((W * JET_D) / JET_W);
const L = JET_W * 10; // 板長 mm
const D = JET_D * 10; // 板寬 mm
const S = W / L; // px / mm

/** 四個固定孔（工作台的腳座也鎖在這裡） */
export const JET_HOLES: [number, number][] = [[2.8, 13.0], [97.2, 13.0], [2.8, 66.0], [97.2, 66.0]];

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

const pinMm = (p: { x: number; z: number }) => [(p.x + JET_W / 2) * 10, (JET_D / 2 - p.z) * 10] as const;

/** 深綠黑色防焊漆＋若隱若現的走線、過孔 */
function base(g: CanvasRenderingContext2D, seed: number) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#173a2c');
  grad.addColorStop(1, '#0f2a20');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(120, 200, 150, ${0.05 + r() * 0.07})`;
    g.lineWidth = 2 + r() * 4;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 420;
      else y += (r() - 0.5) * 300;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 120; i++) {
    const x = r() * W;
    const y = r() * H;
    g.fillStyle = '#b89a4a';
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#081a12';
    g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(244, 248, 245, 0.94)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

/** J12、J14 的焊墊（第 1 腳方形）與固定孔 */
function pads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  const pad = (x: number, y: number, square: boolean) => {
    g.fillStyle = '#d6b45a';
    if (square) g.fillRect(px(x) - 0.85 * S, py(y) - 0.85 * S, 1.7 * S, 1.7 * S);
    else { g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2e2818';
    g.beginPath(); g.arc(px(x), py(y), 0.45 * S, 0, Math.PI * 2); g.fill();
  };
  for (const p of JET_PINS) {
    const [x, y] = pinMm(p);
    pad(x, y, physOfJet(p.id) === 1);
  }
  const [bx, by, , bh] = JET_FOOTPRINTS.btn;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) pad(bx + (c - 0.5) * 2.54, by - bh / 2 + 1.27 + r * 2.54, r === 0 && c === 0);
  for (const [hx, hy] of JET_HOLES) {
    g.fillStyle = '#d6b45a';
    g.beginPath(); g.arc(px(hx), py(hy), 2.6 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#040506';
    g.beginPath(); g.arc(px(hx), py(hy), 1.3 * S, 0, Math.PI * 2); g.fill();
  }
}

export function makeJetsonTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 1010);
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  pads(g, px, py);

  // 白色絲印外框（大接頭與模組蓋住的不畫）
  g.strokeStyle = 'rgba(244, 248, 245, 0.8)';
  g.lineWidth = 3;
  for (const id of ['btn', 'pwrLed', 'csi']) {
    const [cx, cy, w, h] = JET_FOOTPRINTS[id];
    g.strokeRect(px(cx - w / 2 - 0.6), py(cy + h / 2 + 0.6), (w + 1.2) * S, (h + 1.2) * S);
  }
  // 模組的位置（大部分被模組蓋住，邊緣露出一點）
  const [mx, my, mw, mh] = JET_FOOTPRINTS.som;
  g.setLineDash([14, 10]);
  g.strokeRect(px(mx - mw / 2 - 0.8), py(my + mh / 2 + 0.8), (mw + 1.6) * S, (mh + 1.6) * S);
  g.setLineDash([]);

  const text = makeText(g, px, py);
  // J12 標號：第 1、2、39、40 腳
  const p1 = pinMm(JET_PINS[0]);
  const p2 = pinMm(JET_PINS[1]);
  const p40 = pinMm(JET_PINS[39]);
  text('1', p1[0] - 2.3, p1[1], 1.0);
  text('2', p2[0] - 2.3, p2[1], 1.0);
  text('39', p40[0] + 2.6, p1[1], 1.0);
  text('40', p40[0] + 2.6, p2[1], 1.0);
  text('J12  40-PIN EXPANSION HEADER · 3.3V', 28.0, 8.0, 1.25, { weight: 800 });
  text('J14', 5.0, 39.6, 1.1, { weight: 800 });
  text('BUTTON', 5.0, 20.6, 0.85);
  text('PWR', 8.0, 9.0, 0.85, { align: 'left' });
  text('CAM0', JET_CAM_X - 3.4, JET_CAM_Y.cam0, 0.95, { rot: -Math.PI / 2 });
  text('CAM1', JET_CAM_X - 3.4, JET_CAM_Y.cam1, 0.95, { rot: -Math.PI / 2 });
  // I/O 面板前的絲印
  text('USB-C', 8.0, 69.6, 0.85);
  text('DATA ONLY', 8.0, 68.0, 0.7, { color: 'rgba(255,170,150,.95)' });
  text('GbE', 24.0, 59.2, 0.85);
  text('USB 3.2', 50.0, 61.6, 0.85);
  text('DP', 74.0, 66.4, 0.85);
  text('DC IN 19V', 90.0, 64.0, 0.85, { color: 'rgba(255,170,150,.95)' });
  // 板名：左側直條空白區
  text('JETSON ORIN NANO DEVELOPER KIT', 14.6, 33.0, 1.6, { rot: -Math.PI / 2, weight: 800 });
  text('ROBOT LAB EDITION · SUPER', 18.6, 33.0, 1.0, { rot: -Math.PI / 2, weight: 600, color: 'rgba(118,185,0,.95)' });

  g.strokeStyle = 'rgba(244,248,245,.2)';
  g.lineWidth = 5;
  g.strokeRect(6, 6, W - 12, H - 12);
  return finish(c);
}

export function makeJetsonBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 2020);
  // 從底下看（以長邊為軸翻面）：左右不變、遠近對調，焊墊才會對準正面的排針
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  pads(g, px, py);

  // M.2 插槽的絲印外框
  g.strokeStyle = 'rgba(244, 248, 245, 0.75)';
  g.lineWidth = 3;
  for (const id of ['m2m80', 'm2m30', 'wifi']) {
    const [cx, cy, w, h] = JET_FOOTPRINTS[id];
    g.strokeRect(px(cx - w / 2), py(cy - h / 2), w * S, h * S);
  }
  // 接頭固定腳的焊點
  g.fillStyle = '#d6b45a';
  for (const [x, y] of [[4, 77], [12, 77], [17, 79], [31, 79], [35, 79], [65, 79], [66, 79], [82, 79], [86, 79], [94, 79], [JET_CAM_X, 22], [JET_CAM_X, 58]]) {
    g.beginPath(); g.arc(px(x), py(y), 0.9 * S, 0, Math.PI * 2); g.fill();
  }

  const text = makeText(g, px, py);
  // 背面在每支腳旁邊印上實體腳號，對照 BOARD 模式的程式比較方便
  for (const p of JET_PINS) {
    const [x, y] = pinMm(p);
    const n = physOfJet(p.id);
    const col = p.kind === 'power' ? 'rgba(255,140,150,.95)' : p.kind === 'gnd' ? 'rgba(200,210,220,.8)' : 'rgba(244,248,245,.92)';
    text(String(n), x, n % 2 === 1 ? y + 1.7 : y - 1.5, 0.8, { weight: 700, color: col });
  }
  text('BOARD PIN NUMBERS', 28.0, 9.0, 1.0, { weight: 700, color: 'rgba(244,248,245,.75)' });
  text('M.2 KEY M · 2280 · PCIe x4 (NVMe)', 50.0, 30.0, 1.3, { weight: 700 });
  text('M.2 KEY M · 2230 · x2', 28.0, 58.0, 1.0, { weight: 700 });
  text('M.2 KEY E · Wi-Fi', 74.0, 51.0, 1.0, { weight: 700 });
  text('JETSON ORIN NANO · P3768 CARRIER', 50.0, 44.0, 1.7, { weight: 800 });
  text('ROBOT LAB · 3.3V GPIO · DC IN 19V ONLY', 50.0, 13.5, 1.0, { weight: 600, color: 'rgba(244,248,245,.75)' });
  return finish(c);
}
