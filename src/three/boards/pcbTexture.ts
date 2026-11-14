import * as THREE from 'three';
import { UNO_PINS, UNO_W, UNO_D, UNO_FOOTPRINTS } from '../../data/boards/uno';

export const FOOTPRINTS = UNO_FOOTPRINTS;

const W = 2048;
const H = Math.round((W * UNO_D) / UNO_W);
const S = W / 68.6; // px / mm
const px = (mmx: number) => mmx * S;
const py = (mmy: number) => (53.4 - mmy) * S;

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

export function makeTopTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0d6479');
  grad.addColorStop(1, '#0a4f62');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // 銅箔走線（淡色）
  const r = rng(7);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(40, 150, 175, ${0.18 + r() * 0.15})`;
    g.lineWidth = 3 + r() * 5;
    g.beginPath();
    let x = r() * W;
    let y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 600;
      else y += (r() - 0.5) * 500;
      const d = (r() - 0.5) * 200;
      g.lineTo(x + d, y + d);
    }
    g.stroke();
  }
  // 過孔
  for (let i = 0; i < 90; i++) {
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
  for (const [hx, hy] of [[14, 2.5], [15.3, 50.7], [66.1, 7.6], [66.1, 35.5]]) {
    g.fillStyle = '#d9b456';
    g.beginPath();
    g.arc(px(hx), py(hy), 3.2 * S / 2 + 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#05080c';
    g.beginPath();
    g.arc(px(hx), py(hy), 3.2 * S / 2, 0, Math.PI * 2);
    g.fill();
  }

  // 零件外框絲印
  g.strokeStyle = 'rgba(240, 248, 250, 0.85)';
  g.lineWidth = 4;
  for (const [cx, cy, w, h] of Object.values(FOOTPRINTS)) {
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

  text('UNO', 37, 31, 8.5, { weight: 800, italic: true });
  text('R3', 47.5, 30.4, 3.2, { weight: 700 });
  text('ROBOT LAB · LEARNING BOARD', 37, 24.8, 1.7, { weight: 500, color: 'rgba(244,250,252,.7)' });
  text('DIGITAL (PWM ~)', 46, 43, 2.0);
  text('POWER', 33, 8.6, 2.0);
  text('ANALOG IN', 53.3, 8.6, 2.0);
  text('L', 21.2, 44, 1.6);
  text('TX', 20.8, 39.6, 1.5);
  text('RX', 20.8, 36.8, 1.5);
  text('ON', 62, 40.4, 1.6);
  text('RESET', 6, 45.2, 1.5);
  text('ICSP', 64.5, 32.3, 1.5);
  text('16U2', 16, 25.8, 1.4);
  text('16MHz', 14, 19.2, 1.4);
  text('7-12V', 6, 13.5, 1.5);

  // 腳位標籤
  for (const p of UNO_PINS) {
    const mmx = (p.x + UNO_W / 2) * 10;
    const mmy = (UNO_D / 2 - p.z) * 10;
    const top = mmy > 30;
    text(p.label, mmx, top ? mmy - 3.4 : mmy + 3.2, 1.25, { rot: -Math.PI / 2, align: top ? 'right' : 'left', weight: 600 });
  }
  // 邊框
  g.strokeStyle = 'rgba(240,248,250,.25)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, W - 16, H - 16);
  return finish(c);
}

export function makeBottomTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0a4c5e';
  g.fillRect(0, 0, W, H);
  const r = rng(21);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = 'rgba(40,150,175,.22)';
    g.lineWidth = 4 + r() * 4;
    g.beginPath();
    g.moveTo(r() * W, r() * H);
    g.lineTo(r() * W, r() * H);
    g.stroke();
  }
  // 底面：Box 的 -Y 面 u 仍沿 +x、v 方向相反；畫布上方 = 板子前緣（mm y = 0）。
  // 從下往上看時 +z 在畫面上方，所以文字照常畫就是正的，零件焊點也會對到正面的位置
  const bx = (mmx: number) => mmx * S;
  const by = (mmy: number) => mmy * S;
  // 排母焊點
  for (const p of UNO_PINS) {
    const mmx = (p.x + UNO_W / 2) * 10;
    const mmy = (UNO_D / 2 - p.z) * 10;
    g.fillStyle = '#d7dbe0';
    g.beginPath();
    g.arc(bx(mmx), by(mmy), 18, 0, Math.PI * 2);
    g.fill();
  }
  // DIP 焊點
  for (let i = 0; i < 14; i++) {
    for (const yy of [14 - 3.81, 14 + 3.81]) {
      g.fillStyle = '#d7dbe0';
      g.beginPath();
      g.arc(bx(48 - 16.5 + i * 2.54), by(yy), 16, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.save();
  g.fillStyle = 'rgba(244,250,252,.9)';
  g.textAlign = 'center';
  g.font = `800 ${5 * S}px "JetBrains Mono", monospace`;
  g.fillText('ROBOT LAB', W / 2, H * 0.48);
  g.font = `500 ${2 * S}px "Noto Sans TC", sans-serif`;
  g.fillText('機器人實驗室 · 學習用開發板', W / 2, H * 0.6);
  g.restore();
  return finish(c);
}
