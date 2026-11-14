import * as THREE from 'three';
import { PICO_PINS, PICO_W, PICO_D, PICO_FOOTPRINTS, PICO_MID_Y } from '../../data/boards/pico';

const W = 2048;
const H = Math.round((W * PICO_D) / PICO_W);
const L = PICO_W * 10; // 板長 mm
const D = PICO_D * 10; // 板寬 mm
const S = W / L; // px / mm

/** 四個 2.1 mm 安裝孔：距短邊 2 mm、距長邊 4.8 mm */
const HOLES: [number, number][] = [[2, 4.8], [2, D - 4.8], [L - 2, 4.8], [L - 2, D - 4.8]];
/** SWD 除錯接點（SWCLK、GND、SWDIO），沿板子短邊排列 */
export const PICO_SWD_Y = [PICO_MID_Y + 2.54, PICO_MID_Y, PICO_MID_Y - 2.54];

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

const pinMm = (p: { x: number; z: number }) => [(p.x + PICO_W / 2) * 10, (PICO_D / 2 - p.z) * 10] as const;
const isGnd = (id: string) => id.startsWith('GND') || id === 'AGND';

/** 綠色防焊漆底色＋若隱若現的走線與過孔 */
function base(g: CanvasRenderingContext2D, seed: number) {
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#24864a');
  grad.addColorStop(1, '#19683a');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(150, 220, 160, ${0.08 + r() * 0.08})`;
    g.lineWidth = 3 + r() * 4;
    g.beginPath();
    let x = r() * W;
    let y = H * 0.18 + r() * H * 0.64;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (r() > 0.5) x += (r() - 0.5) * 380;
      else y += (r() - 0.5) * 220;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    const y = H * 0.2 + r() * H * 0.6;
    g.fillStyle = '#c8cdd4';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b2414';
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
}

function makeText(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  return (t: string, x: number, y: number, size: number, opts: { rot?: number; align?: CanvasTextAlign; weight?: number; italic?: boolean; color?: string } = {}) => {
    g.save();
    g.translate(px(x), py(y));
    if (opts.rot) g.rotate(opts.rot);
    g.fillStyle = opts.color ?? 'rgba(246, 247, 249, 0.95)';
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    g.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 700} ${size * S}px "JetBrains Mono", monospace`;
    g.fillText(t, 0, 0);
    g.restore();
  };
}

/** 焊墊：GND 是方形；每支腳在板邊還有一個半孔（郵票孔） */
function pads(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number) {
  for (const p of PICO_PINS) {
    const [x, y] = pinMm(p);
    const edgeY = y > PICO_MID_Y ? D : 0;
    // 半孔與連到內側焊墊的銅片
    g.fillStyle = '#d9b75a';
    g.fillRect(px(x) - 0.75 * S, Math.min(py(y), py(edgeY)), 1.5 * S, Math.abs(py(y) - py(edgeY)));
    g.fillStyle = '#0b0c0e';
    g.beginPath(); g.arc(px(x), py(edgeY), 0.5 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e2c066';
    if (isGnd(p.id)) g.fillRect(px(x) - 0.85 * S, py(y) - 0.85 * S, 1.7 * S, 1.7 * S);
    else { g.beginPath(); g.arc(px(x), py(y), 0.85 * S, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#4a3b17';
    g.beginPath(); g.arc(px(x), py(y), 0.5 * S, 0, Math.PI * 2); g.fill();
  }
  for (const [hx, hy] of HOLES) {
    g.fillStyle = '#e2c066';
    g.beginPath(); g.arc(px(hx), py(hy), 1.5 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#040506';
    g.beginPath(); g.arc(px(hx), py(hy), 1.05 * S, 0, Math.PI * 2); g.fill();
  }
  for (const y of PICO_SWD_Y) {
    g.fillStyle = '#e2c066';
    g.beginPath(); g.arc(px(49.2), py(y), 0.8 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3b17';
    g.beginPath(); g.arc(px(49.2), py(y), 0.42 * S, 0, Math.PI * 2); g.fill();
  }
}

/** 散佈的小顆被動元件（電阻、電容）的焊墊 */
function passives(g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number, seed: number) {
  const r = rng(seed);
  const spots: [number, number][] = [[8.5, 13.5], [9.2, 7.6], [17.2, 8.4], [17.4, 12.2], [20.6, 4.6], [28.8, 5.2], [29.4, 15.6], [21.0, 16.8], [31.2, 10.4], [39.6, 10.6], [40.2, 14.8], [39.8, 6.4], [43.4, 12.4], [27.2, 3.8]];
  for (const [x, y] of spots) {
    const vert = r() > 0.5;
    const [w, h] = vert ? [0.8, 1.6] : [1.6, 0.8];
    g.fillStyle = '#d7dbe0';
    g.fillRect(px(x - w / 2), py(y + h / 2), w * S, h * S);
    g.fillStyle = r() > 0.5 ? '#c79a5e' : '#1c1d20';
    const [iw, ih] = vert ? [0.7, 0.8] : [0.8, 0.7];
    g.fillRect(px(x - iw / 2), py(y + ih / 2), iw * S, ih * S);
  }
}

export function makePicoTop(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 23);
  const px = (x: number) => x * S;
  const py = (y: number) => (D - y) * S;
  pads(g, px, py);
  passives(g, px, py, 77);

  g.strokeStyle = 'rgba(246, 247, 249, 0.85)';
  g.lineWidth = 3;
  for (const id of ['bootsel', 'flash', 'reg', 'ind']) {
    const [cx, cy, w, h] = PICO_FOOTPRINTS[id];
    g.strokeRect(px(cx - w / 2 - 0.3), py(cy + h / 2 + 0.3), (w + 0.6) * S, (h + 0.6) * S);
  }

  const text = makeText(g, px, py);
  // 正面只印實體腳號，GP 名稱印在背面（和實物一樣）
  for (const p of PICO_PINS) {
    const [x, y] = pinMm(p);
    const n = Number(/第 (\d+) 腳/.exec(p.desc)?.[1]);
    if (![1, 2, 19, 20, 21, 22, 39, 40].includes(n)) continue;
    const far = y > PICO_MID_Y;
    text(String(n), x, far ? y - 2.0 : y + 2.0, 1.0, { weight: 700 });
  }
  text('BOOTSEL', 11.6, 17.6, 0.8, { weight: 700 });
  text('LED', 6.4, 6.1, 0.8, { weight: 700 });
  text('USB', 5.4, 15.6, 0.8, { weight: 700 });
  text('DEBUG', 48.6, PICO_MID_Y + 5, 0.8, { weight: 700 });
  text('SWCLK', 47.6, PICO_SWD_Y[0], 0.55, { weight: 600, align: 'right', color: 'rgba(246,247,249,.75)' });
  text('GND', 47.6, PICO_SWD_Y[1], 0.55, { weight: 600, align: 'right', color: 'rgba(246,247,249,.75)' });
  text('SWDIO', 47.6, PICO_SWD_Y[2], 0.55, { weight: 600, align: 'right', color: 'rgba(246,247,249,.75)' });
  text('Pico', 41.6, PICO_MID_Y + 1.2, 2.2, { weight: 800, rot: -Math.PI / 2 });
  text('RP2040 · 3V3', 43.6, PICO_MID_Y + 1.2, 0.7, { weight: 600, color: 'rgba(246,247,249,.75)', rot: -Math.PI / 2 });

  g.strokeStyle = 'rgba(246,247,249,.18)';
  g.lineWidth = 5;
  g.strokeRect(6, 6, W - 12, H - 12);
  return finish(c);
}

export function makePicoBottom(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  base(g, 61);
  // 底面：Box 的 -Y 面 u 仍沿 +x、v 方向相反（同 pcbTexture.ts），x 不用對調，焊墊才會對到正面的腳
  const px = (x: number) => x * S;
  const py = (y: number) => y * S;
  pads(g, px, py);

  // 測試點 TP1–TP6（USB 訊號、BOOTSEL 等）
  const tps: [number, number][] = [[8, 9.2], [8, 11.8], [10.6, 9.2], [10.6, 11.8], [13.2, 10.5], [15.8, 10.5]];
  for (const [x, y] of tps) {
    g.fillStyle = '#e2c066';
    g.beginPath(); g.arc(px(x), py(y), 0.75 * S, 0, Math.PI * 2); g.fill();
  }
  // USB 固定腳焊點
  g.fillStyle = '#d7dbe0';
  for (const dy of [-3.4, 3.4]) g.fillRect(px(3.6) - 1.0 * S, py(PICO_MID_Y + dy) - 0.6 * S, 1.6 * S, 1.2 * S);

  const text = makeText(g, px, py);
  // 背面印著每支腳的名字：接線時翻過來看這一面
  for (const p of PICO_PINS) {
    const [x, y] = pinMm(p);
    const far = y > PICO_MID_Y;
    const label = p.label.replace('(OUT)', '');
    // 背面的 y 沒有翻轉：對齊方式和正面相反，文字才會朝板子內側延伸、不被排針塑膠座蓋住
    text(label, x, far ? y - 1.4 : y + 1.4, 0.82, { rot: -Math.PI / 2, align: far ? 'left' : 'right', weight: 700, color: isGnd(p.id) ? 'rgba(200,210,220,.85)' : undefined });
  }
  text('Raspberry Pi Pico', 31, PICO_MID_Y + 1.6, 1.7, { weight: 800 });
  text('ROBOT LAB · 3.3V LOGIC · ADC: GP26-28', 31, PICO_MID_Y - 1.6, 0.75, { weight: 600, color: 'rgba(246,247,249,.8)' });
  text('TP1-TP6', 12, PICO_MID_Y - 3.2, 0.6, { weight: 600, color: 'rgba(246,247,249,.6)' });
  return finish(c);
}
