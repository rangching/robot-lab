import * as THREE from 'three';
import { SF_PINS, SF_W, SF_D, SF_BODY, SF_MOTOR_MM, SF_FOOTPRINTS } from '../../data/boards/stampfly';

const W = 2048;
const H = Math.round((W * SF_D) / SF_W);
const L = SF_W * 10; // mm
const D = SF_D * 10;
const S = W / L; // px / mm

/** 機身外形（mm）：中段長方形＋四支機臂＋馬達座圓環 */
export const ARM_W = 7;
export const RING_R = 6;
/** 馬達穿過 PCB 的孔 */
export const HOLE_R = 3.7;

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

type Map2 = (x: number) => number;

/** 畫出機身輪廓（填滿）；px、py 把 mm 換成畫布座標 */
function silhouette(g: CanvasRenderingContext2D, px: Map2, py: Map2) {
  const b = SF_BODY;
  g.beginPath();
  const r = 3;
  const x0 = px(b.x0), x1 = px(b.x1);
  const yA = py(b.y0), yB = py(b.y1);
  const top = Math.min(yA, yB), bot = Math.max(yA, yB);
  g.roundRect(x0, top, x1 - x0, bot - top, r * S);
  g.fill();
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  for (const [mx, my] of Object.values(SF_MOTOR_MM)) {
    // 機臂：從機身中心到馬達中心、寬 ARM_W 的長條
    const dx = mx - cx;
    const dy = my - cy;
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * (ARM_W / 2);
    const ny = (dx / len) * (ARM_W / 2);
    g.beginPath();
    g.moveTo(px(cx + nx), py(cy + ny));
    g.lineTo(px(mx + nx), py(my + ny));
    g.lineTo(px(mx - nx), py(my - ny));
    g.lineTo(px(cx - nx), py(cy - ny));
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(px(mx), py(my), RING_R * S, 0, Math.PI * 2);
    g.fill();
  }
}

/** 黑色防焊漆＋若隱若現的走線（只畫在機身範圍內） */
function base(g: CanvasRenderingContext2D, px: Map2, py: Map2, seed: number) {
  g.fillStyle = '#15171c';
  silhouette(g, px, py);
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(120, 128, 140, ${0.07 + r() * 0.08})`;
    g.lineWidth = 3 + r() * 4;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 380;
      else y += (r() - 0.5) * 380;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const y = r() * H;
    g.fillStyle = '#b9bec6';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b0c0e';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
  // 機身邊緣一圈白色絲印
  g.strokeStyle = 'rgba(240, 242, 245, 0.55)';
  g.lineWidth = 0.35 * S;
  const b = SF_BODY;
  g.strokeRect(px(b.x0) + 0.8 * S, Math.min(py(b.y0), py(b.y1)) + 0.8 * S, (b.x1 - b.x0 - 1.6) * S, Math.abs(py(b.y1) - py(b.y0)) - 1.6 * S);
  // 馬達座：金色焊環＋穿孔（挖空）
  for (const [mx, my] of Object.values(SF_MOTOR_MM)) {
    g.fillStyle = '#c9a54a';
    g.beginPath(); g.arc(px(mx), py(my), (HOLE_R + 0.8) * S, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (const [mx, my] of Object.values(SF_MOTOR_MM)) {
    g.beginPath(); g.arc(px(mx), py(my), HOLE_R * S, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function makeText(g: CanvasRenderingContext2D, px: Map2, py: Map2) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; color?: string; font?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(246, 247, 249, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.weight ?? 700} ${size * S}px ${opts.font ?? '"JetBrains Mono", monospace'}`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

/** 馬達旁的轉向箭頭（教學重點：對角同向） */
function spinArrow(g: CanvasRenderingContext2D, px: Map2, py: Map2, mx: number, my: number, cw: boolean, mirrorY: boolean) {
  const R = RING_R - 0.9;
  // 畫布 y 方向和圖面相反時（正面），順時針在畫布上看起來也是順時針
  const visualCw = mirrorY ? !cw : cw;
  const a0 = -2.4;
  const a1 = -0.75;
  g.strokeStyle = cw ? 'rgba(125, 211, 252, 0.95)' : 'rgba(253, 186, 116, 0.95)';
  g.lineWidth = 0.45 * S;
  g.beginPath();
  g.arc(px(mx), py(my), R * S, a0, a1, !visualCw);
  g.stroke();
  const end = visualCw ? a1 : a0;
  const ex = px(mx) + Math.cos(end) * R * S;
  const ey = py(my) + Math.sin(end) * R * S;
  const tang = end + (visualCw ? Math.PI / 2 : -Math.PI / 2);
  g.fillStyle = g.strokeStyle;
  g.beginPath();
  g.moveTo(ex + Math.cos(tang) * 1.1 * S, ey + Math.sin(tang) * 1.1 * S);
  g.lineTo(ex + Math.cos(tang + 2.5) * 0.9 * S, ey + Math.sin(tang + 2.5) * 0.9 * S);
  g.lineTo(ex + Math.cos(tang - 2.5) * 0.9 * S, ey + Math.sin(tang - 2.5) * 0.9 * S);
  g.closePath();
  g.fill();
}

const pinMm = (p: { x: number; z: number }) => [(p.x + SF_W / 2) * 10, (SF_D / 2 - p.z) * 10] as const;

export function makeStampflyTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  base(g, px, py, 31);
  const text = makeText(g, px, py);

  // 零件焊墊（淡淡的銀色外框）
  g.fillStyle = 'rgba(205, 210, 216, 0.85)';
  for (const id of ['imu', 'mag', 'baro', 'ina', 'rgb']) {
    const [x, y, w, h] = SF_FOOTPRINTS[id];
    g.fillRect(px(x - w / 2 - 0.3), py(y + h / 2 + 0.3), (w + 0.6) * S, (h + 0.6) * S);
  }
  // Grove、電池接頭的焊點
  for (const p of SF_PINS) {
    if (p.kind === 'motor') continue;
    const [x, y] = pinMm(p);
    g.fillStyle = '#d7dbe0';
    g.fillRect(px(x) - 0.5 * S, py(y) - 2.2 * S, 1.0 * S, 1.2 * S);
  }

  text('M5Stamp Fly', 40.75, 63.8 - 1.2, 2.3, { weight: 800 });
  text('▲ FRONT', 40.75, 66.0 - 1.0, 1.4, { color: 'rgba(125,211,252,.95)' });
  text('PORT.A', 33, 27.3, 1.25, { color: 'rgba(255,150,150,.95)' });
  text('PORT.B', 48.5, 27.3, 1.25);
  text('BAT', 40.75, 27.3, 1.1);
  // Grove 腳位名稱（接頭下方，靠機尾）
  for (const p of SF_PINS) {
    if (p.kind === 'motor') continue;
    const [x, y] = pinMm(p);
    text(p.label.replace('BAT', ''), x, y - 3.3, 0.72, { weight: 700, color: p.kind === 'power' ? 'rgba(255,140,150,.95)' : 'rgba(240,242,245,.9)' });
  }
  text('BMI270', 40.75, 31.2, 0.7, { weight: 600, color: 'rgba(240,242,245,.75)' });
  text('INA3221', 31, 26.9 + 0.3, 0.62, { weight: 600, color: 'rgba(240,242,245,.6)' });

  // 四顆馬達：名稱、GPIO、轉向箭頭
  const dirs: Record<string, boolean> = { FL: true, FR: false, RL: false, RR: true };
  for (const [m, [mx, my]] of Object.entries(SF_MOTOR_MM)) {
    spinArrow(g, px, py, mx, my, dirs[m], false); // 正面畫布就是俯視圖：畫布上的順時針＝實際的順時針
    const back = my < 40;
    const tx = mx + (mx < 40 ? 7.4 : -7.4);
    text(m, tx, my + (back ? 2.6 : -2.6), 1.25, { weight: 800 });
    text(dirs[m] ? 'CW' : 'CCW', tx, my + (back ? 0.9 : -4.2), 0.95, { color: dirs[m] ? 'rgba(125,211,252,.95)' : 'rgba(253,186,116,.95)' });
  }
  return finish(c);
}

export function makeStampflyBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // 背面：u 沿 +x、y 不翻轉（見 BoardModel 的背面平面方向）
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  base(g, px, py, 77);
  const text = makeText(g, px, py);
  // 電池的位置（虛線框）
  g.save();
  g.setLineDash([1.2 * S, 0.8 * S]);
  g.strokeStyle = 'rgba(240,242,245,.55)';
  g.lineWidth = 0.3 * S;
  g.strokeRect(px(30), py(24), 21.5 * S, 30 * S);
  g.restore();
  text('1S LiPo 300mAh', 40.75, 56.5, 1.15);
  text('PMW3901', 40.75, 31.0, 0.9, { color: 'rgba(240,242,245,.75)' });
  text('VL53L3', 40.75, 51.2, 0.9, { color: 'rgba(240,242,245,.75)' });
  text('K138  StampFly', 40.75, 22.3, 1.0, { color: 'rgba(240,242,245,.6)' });
  for (const [m, [mx, my]] of Object.entries(SF_MOTOR_MM)) {
    text(m, mx + (mx < 40 ? 7.4 : -7.4), my, 1.1, { weight: 800, color: 'rgba(240,242,245,.75)' });
  }
  return finish(c);
}
