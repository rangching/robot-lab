import * as THREE from 'three';
import { MEGA_PINS, MEGA_W, MEGA_D, MEGA_FOOTPRINTS, MEGA_DBL_X, MEGA_DBL_TOP_Y } from '../../data/boards/mega';

const BW = MEGA_W * 10; // mm
const BD = MEGA_D * 10;
const W = 3072;
const H = Math.round((W * BD) / BW);
const S = W / BW; // px / mm
const px = (mmx: number) => mmx * S;
const py = (mmy: number) => (BD - mmy) * S;

/** 固定孔（mm） */
const HOLES: [number, number][] = [[14, 2.5], [15.3, 50.7], [66.1, 11], [66.1, 35.5], [99.6, 1.9]];

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

const pinMm = (x: number, z: number) => [(x + MEGA_W / 2) * 10, (MEGA_D / 2 - z) * 10] as const;

export function makeMegaTopTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0c6378');
  grad.addColorStop(1, '#094a5c');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // 銅箔走線
  const r = rng(2560);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 110; i++) {
    g.strokeStyle = `rgba(40, 150, 175, ${0.16 + r() * 0.15})`;
    g.lineWidth = 3 + r() * 5;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 800;
      else y += (r() - 0.5) * 500;
      const d = (r() - 0.5) * 200;
      g.lineTo(x + d, y + d);
    }
    g.stroke();
  }
  // 主晶片四周放射狀的細走線（QFP 扇出）
  const [mcx, mcy] = MEGA_FOOTPRINTS.mcu;
  g.save();
  g.translate(px(mcx), py(mcy));
  g.rotate(Math.PI / 4);
  g.strokeStyle = 'rgba(60, 170, 195, .28)';
  g.lineWidth = 2;
  for (let side = 0; side < 4; side++) {
    g.save();
    g.rotate((side * Math.PI) / 2);
    for (let i = 0; i < 25; i++) {
      const o = (i - 12) * 0.5 * S;
      g.beginPath();
      g.moveTo(o, -8.6 * S);
      g.lineTo(o * 1.5, -12.5 * S);
      g.stroke();
    }
    g.restore();
  }
  g.restore();

  // 過孔
  for (let i = 0; i < 140; i++) {
    const x = r() * W;
    const y = r() * H;
    g.fillStyle = '#c9a54a';
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#062a33';
    g.beginPath();
    g.arc(x, y, 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // 固定孔
  for (const [hx, hy] of HOLES) {
    g.fillStyle = '#d9b456';
    g.beginPath();
    g.arc(px(hx), py(hy), (3.2 * S) / 2 + 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#05080c';
    g.beginPath();
    g.arc(px(hx), py(hy), (3.2 * S) / 2, 0, Math.PI * 2);
    g.fill();
  }

  // 零件外框絲印（主晶片轉 45°）
  g.strokeStyle = 'rgba(240, 248, 250, 0.85)';
  g.lineWidth = 5;
  for (const [id, [cx, cy, w, h]] of Object.entries(MEGA_FOOTPRINTS)) {
    if (id === 'mcu') {
      g.save();
      g.translate(px(cx), py(cy));
      g.rotate(Math.PI / 4);
      g.strokeRect((-w / 2) * S, (-h / 2) * S, w * S, h * S);
      g.beginPath();
      g.arc((-w / 2 + 1.6) * S, (-h / 2 + 1.6) * S, 0.6 * S, 0, Math.PI * 2);
      g.fillStyle = 'rgba(240,248,250,.85)';
      g.fill();
      g.restore();
      continue;
    }
    g.strokeRect(px(cx - w / 2), py(cy + h / 2), w * S, h * S);
  }

  const text = (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; italic?: boolean; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(244, 250, 252, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };

  text('MEGA', 76, 22.5, 7.2, { weight: 800, italic: true });
  text('2560', 76, 15.6, 3.6, { weight: 700 });
  text('R3', 86.5, 15.6, 2.6, { weight: 700 });
  text('ROBOT LAB · LEARNING BOARD', 37.5, 34.5, 1.7, { weight: 500, color: 'rgba(244,250,252,.7)' });
  text('DIGITAL (PWM ~)', 46, 43, 2.0);
  text('COMMUNICATION', 81, 39.4, 2.0);
  text('POWER', 33, 8.6, 2.0);
  text('ANALOG IN', 55.9, 8.6, 2.0);
  text('ANALOG IN', 78.7, 8.6, 2.0);
  text('L', 21.2, 44, 1.6);
  text('TX', 20.8, 39.6, 1.5);
  text('RX', 20.8, 36.8, 1.5);
  text('ON', 69, 40.4, 1.6);
  text('RESET', 6, 45.2, 1.5);
  text('ICSP', 86.5, 32.3, 1.5);
  text('16U2', 16, 25.8, 1.4);
  text('16MHz', 37, 26.4, 1.4);
  text('7-12V', 6, 13.5, 1.5);

  // 腳位標籤：上排、下排沿用 Uno 的直書方式；雙排母標在兩側
  const [c0, c1] = MEGA_DBL_X;
  for (const p of MEGA_PINS) {
    const [mmx, mmy] = pinMm(p.x, p.z);
    if (mmx > 92) {
      const left = Math.abs(mmx - c0) < 0.5;
      text(p.label, left ? c0 - 2.0 : c1 + 1.9, mmy, 1.1, { align: left ? 'right' : 'left', weight: 600 });
      continue;
    }
    const top = mmy > 30;
    text(p.label, mmx, top ? mmy - 3.4 : mmy + 3.2, 1.25, { rot: -Math.PI / 2, align: top ? 'right' : 'left', weight: 600 });
  }
  text('22–53', (c0 + c1) / 2, MEGA_DBL_TOP_Y + 2.6, 1.3);

  g.strokeStyle = 'rgba(240,248,250,.25)';
  g.lineWidth = 8;
  g.strokeRect(10, 10, W - 20, H - 20);
  return finish(c);
}

export function makeMegaBottomTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0a4c5e';
  g.fillRect(0, 0, W, H);
  const r = rng(53);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = 'rgba(40,150,175,.22)';
    g.lineWidth = 4 + r() * 4;
    g.beginPath();
    g.moveTo(r() * W, r() * H);
    g.lineTo(r() * W, r() * H);
    g.stroke();
  }
  // 底面：畫布上方 = 板子前緣（mm y = 0），左右對調讓從底下看時文字是正的
  const bx = (mmx: number) => W - mmx * S;
  const by = (mmy: number) => mmy * S;
  for (const p of MEGA_PINS) {
    const [mmx, mmy] = pinMm(p.x, p.z);
    g.fillStyle = '#d7dbe0';
    g.beginPath();
    g.arc(bx(mmx), by(mmy), 0.62 * S, 0, Math.PI * 2);
    g.fill();
  }
  for (const [hx, hy] of HOLES) {
    g.fillStyle = '#05080c';
    g.beginPath();
    g.arc(bx(hx), by(hy), 1.6 * S, 0, Math.PI * 2);
    g.fill();
  }
  g.save();
  g.fillStyle = 'rgba(244,250,252,.9)';
  g.textAlign = 'center';
  g.font = `800 ${5 * S}px "JetBrains Mono", monospace`;
  g.fillText('ROBOT LAB', W / 2, H * 0.48);
  g.font = `500 ${2 * S}px "Noto Sans TC", sans-serif`;
  g.fillText('機器人實驗室 · MEGA 2560 學習板', W / 2, H * 0.6);
  g.restore();
  return finish(c);
}
