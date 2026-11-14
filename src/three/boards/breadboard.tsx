import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';

const PITCH = 0.254;
export const BB_W = 3.7;
export const BB_H = 0.85;
/** 每側 5 列孔（a–e、f–j），中間是溝槽 */
const GAP = 0.508;
const rowsOf = (gap: number) => [0, 1, 2, 3, 4].flatMap((k) => [gap + k * PITCH, -(gap + k * PITCH)]);

function makeTop(cols: number, len: number, highlightRow?: number, gap = GAP) {
  const W = 1024;
  const H = Math.round((W * BB_W) / len);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3f2ec';
  g.fillRect(0, 0, W, H);
  const sx = W / len;
  const mid = (cols - 1) / 2;
  const toX = (x: number) => (x + len / 2) * sx;
  const toY = (z: number) => (z + BB_W / 2) * sx;
  // 中間溝槽
  g.fillStyle = '#d9d7cd';
  g.fillRect(toX(-len / 2 + 0.12), toY(-(gap - 0.208)), (len - 0.24) * sx, 2 * (gap - 0.208) * sx);
  // 列字母與欄號
  g.fillStyle = '#8a8f99';
  g.font = `600 ${0.17 * sx}px "JetBrains Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  'abcde'.split('').forEach((ch, k) => {
    g.fillText(ch, toX(-len / 2 + 0.14), toY(-(gap + (4 - k) * PITCH)));
    g.fillText('fghij'[k], toX(-len / 2 + 0.14), toY(gap + k * PITCH));
  });
  for (let col = 0; col < cols; col += 5) {
    g.fillText(String(col + 1), toX((col - mid) * PITCH), toY(-BB_W / 2 + 0.2));
    g.fillText(String(col + 1), toX((col - mid) * PITCH), toY(BB_W / 2 - 0.2));
  }
  // 同一直排相通的提示線
  g.strokeStyle = 'rgba(14,165,233,.18)';
  g.lineWidth = 0.12 * sx;
  g.lineCap = 'round';
  for (let col = 0; col < cols; col++) {
    const x = toX((col - mid) * PITCH);
    g.beginPath(); g.moveTo(x, toY(-gap)); g.lineTo(x, toY(-(gap + 4 * PITCH))); g.stroke();
    g.beginPath(); g.moveTo(x, toY(gap)); g.lineTo(x, toY(gap + 4 * PITCH)); g.stroke();
  }
  // 板子插上去後唯一還能接線的那列，淡淡標出來
  if (highlightRow !== undefined) {
    g.fillStyle = 'rgba(34,227,255,.14)';
    for (const s of [-1, 1]) g.fillRect(toX(-len / 2 + 0.3), toY(s * highlightRow) - 0.1 * sx, (len - 0.6) * sx, 0.2 * sx);
  }
  // 孔
  g.fillStyle = '#3b3f46';
  for (let col = 0; col < cols; col++) {
    for (const z of rowsOf(gap)) {
      const s = 0.09 * sx;
      g.fillRect(toX((col - mid) * PITCH) - s / 2, toY(z) - s / 2, s, s);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 半尺寸麵包板，頂面在 y = BB_H；cols 為奇數時中間那欄在 x = 0 */
/** gap：溝槽中心到 e／f 列的距離；排距不在預設格點上的板子（Pico 的 0.7"）可以調整 */
export function Breadboard({ cols = 25, x = 0, highlightRow, gap = GAP }: { cols?: number; x?: number; highlightRow?: number; gap?: number }) {
  const len = cols * PITCH + 0.5;
  const tex = useMemo(() => makeTop(cols, len, highlightRow, gap), [cols, len, highlightRow, gap]);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e4e2d8', roughness: 0.8 }), []);
  useLayoutEffect(() => () => { tex.dispose(); side.dispose(); }, [tex, side]);
  return (
    <mesh position={[x, BB_H / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, BB_H, BB_W]} />
      <primitive object={side} attach="material-0" />
      <primitive object={side} attach="material-1" />
      <meshStandardMaterial attach="material-2" map={tex} roughness={0.75} />
      <primitive object={side} attach="material-3" />
      <primitive object={side} attach="material-4" />
      <primitive object={side} attach="material-5" />
    </mesh>
  );
}
