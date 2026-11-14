import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { NANO_PCB_T, NANO_SPACER, NANO_LEG } from '../../data/boards/nano';
import { Box, Crystal, Cyl, MAT, MaleHeader, Regulator, SmdLed, useLabelTexture } from '../parts/primitives';
import { makeNanoTop, makeNanoBottom } from './nanoTexture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;

/** Mini-USB B 接頭，開口朝 -x */
function MiniUsb() {
  return (
    <group>
      <Box size={[0.92, 0.39, 0.77]} pos={[0, 0.195, 0]} mat={MAT.steel} />
      <Box size={[0.94, 0.03, 0.79]} pos={[0, 0.39, 0]} mat={MAT.silver} />
      <Box size={[0.02, 0.24, 0.6]} pos={[-0.461, 0.2, 0]} mat={MAT.hole} />
      <Box size={[0.36, 0.07, 0.44]} pos={[-0.3, 0.2, 0]} mat={MAT.black} />
      {[-0.32, 0.32].map((z) => (
        <Box key={z} size={[0.24, 0.03, 0.14]} pos={[0.2, 0.015, z * 1.3]} mat={MAT.tin} />
      ))}
    </group>
  );
}

/** TQFP-32 晶片，斜 45 度擺放 */
function Tqfp({ label }: { label: string[] }) {
  const tex = useLabelTexture(label, 256, 256);
  const legs = useMemo(() => {
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let i = 0; i < 8; i++) {
      const t = -0.28 + i * 0.08;
      arr.push({ pos: [t, 0.012, 0.395], size: [0.035, 0.024, 0.1] });
      arr.push({ pos: [t, 0.012, -0.395], size: [0.035, 0.024, 0.1] });
      arr.push({ pos: [0.395, 0.012, t], size: [0.1, 0.024, 0.035] });
      arr.push({ pos: [-0.395, 0.012, t], size: [0.1, 0.024, 0.035] });
    }
    return arr;
  }, []);
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.7, 0.1, 0.7]} />
        <meshStandardMaterial attach="material-0" color="#141518" />
        <meshStandardMaterial attach="material-1" color="#141518" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#141518" />
        <meshStandardMaterial attach="material-4" color="#141518" />
        <meshStandardMaterial attach="material-5" color="#141518" />
      </mesh>
      <Cyl r={0.04} h={0.005} pos={[-0.25, 0.112, -0.25]} mat={MAT.hole} />
      {legs.map((l, i) => <Box key={i} size={l.size} pos={l.pos} mat={MAT.tin} />)}
    </group>
  );
}

/** SOP-16 晶片（CH340G），長邊沿 x */
function Sop16({ label }: { label: string[] }) {
  const tex = useLabelTexture(label, 512, 200);
  return (
    <group>
      <mesh position={[0, 0.085, 0]} castShadow>
        <boxGeometry args={[1.0, 0.15, 0.39]} />
        <meshStandardMaterial attach="material-0" color="#141518" />
        <meshStandardMaterial attach="material-1" color="#141518" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#141518" />
        <meshStandardMaterial attach="material-4" color="#141518" />
        <meshStandardMaterial attach="material-5" color="#141518" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => -0.445 + i * 0.127).flatMap((x) => [
        <Box key={`a${x}`} size={[0.05, 0.03, 0.12]} pos={[x, 0.02, 0.24]} mat={MAT.tin} />,
        <Box key={`b${x}`} size={[0.05, 0.03, 0.12]} pos={[x, 0.02, -0.24]} mat={MAT.tin} />,
      ])}
    </group>
  );
}

/** SOD-123 二極體 */
function SmdDiode() {
  return (
    <group>
      <Box size={[0.36, 0.02, 0.14]} pos={[0, 0.01, 0]} mat={MAT.tin} />
      <Box size={[0.27, 0.1, 0.16]} pos={[0, 0.06, 0]} mat={MAT.black} />
      <Box size={[0.04, 0.101, 0.161]} pos={[-0.09, 0.06, 0]} mat={MAT.capStripe} />
    </group>
  );
}

/** 3 × 6 mm 小按鈕 */
function SmdButton() {
  return (
    <group>
      <Box size={[0.36, 0.14, 0.6]} pos={[0, 0.07, 0]} mat={MAT.steel} />
      <Box size={[0.18, 0.08, 0.32]} pos={[0, 0.18, 0]} mat={MAT.blackGloss} />
      {[-0.2, 0.2].flatMap((z) => [-0.22, 0.22].map((x) => <Box key={`${x}${z}`} size={[0.08, 0.02, 0.06]} pos={[x, 0.01, z]} mat={MAT.tin} />))}
    </group>
  );
}

/** 一排 15 支、朝下焊的排針（含塑膠座與頂面焊點） */
function PinRow({ n = 15 }: { n?: number }) {
  const w = n * PITCH;
  const legH = NANO_PCB_T + NANO_SPACER + NANO_LEG + 0.06;
  return (
    <group>
      <Box size={[w, NANO_SPACER, PITCH]} pos={[0, -NANO_PCB_T - NANO_SPACER / 2, 0]} mat={MAT.black} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + PITCH / 2 + i * PITCH;
        return (
          <group key={i}>
            <Box size={[0.064, legH, 0.064]} pos={[x, 0.06 - legH / 2, 0]} mat={MAT.gold} />
            <Cyl r={0.075} h={0.04} pos={[x, 0.02, 0]} mat={MAT.tin} />
          </group>
        );
      })}
    </group>
  );
}

function renderNanoPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <Tqfp label={['ATMEGA', '328P']} />;
    case 'usb': return <MiniUsb />;
    case 'hdrF':
    case 'hdrN': return <PinRow />;
    case 'reset': return <SmdButton />;
    case 'xtal': return <group scale={[0.46, 0.75, 0.5]}><Crystal /></group>;
    case 'txrx':
      return (
        <>
          <group position={[-0.08, 0, 0]} scale={0.8}><SmdLed color="#ffd23a" glow={lights.TX ?? 0} /></group>
          <group position={[0.08, 0, 0]} scale={0.8}><SmdLed color="#ffd23a" glow={lights.RX ?? 0} /></group>
        </>
      );
    case 'ledL': return <group scale={0.8}><SmdLed color="#ffae1a" glow={lights.L ?? 0} /></group>;
    case 'pow': return <group scale={0.8}><SmdLed color="#3d9bff" glow={lights.ON ?? 0} /></group>;
    case 'icsp': return <MaleHeader cols={2} rows={3} />;
    case 'u2': return <Sop16 label={['CH340G']} />;
    case 'reg': return <Regulator />;
    case 'diode': return <SmdDiode />;
    default: return null;
  }
}

// ---------- 工作台用的麵包板 ----------
const BB_COLS = 21;
const BB_LEN = BB_COLS * PITCH + 0.5;
const BB_W = 3.7;
const BB_H = 0.85;
const BB_ROWS = [0, 1, 2, 3, 4].flatMap((k) => [0.508 + k * PITCH, -(0.508 + k * PITCH)]);

function makeBreadboardTop() {
  const W = 1024;
  const H = Math.round((W * BB_W) / BB_LEN);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3f2ec';
  g.fillRect(0, 0, W, H);
  const sx = W / BB_LEN;
  const toX = (x: number) => (x + BB_LEN / 2) * sx;
  const toY = (z: number) => (z + BB_W / 2) * sx;
  // 中間溝槽
  g.fillStyle = '#d9d7cd';
  g.fillRect(toX(-BB_LEN / 2 + 0.12), toY(-0.3), (BB_LEN - 0.24) * sx, 0.6 * sx);
  // 列字母與欄號
  g.fillStyle = '#8a8f99';
  g.font = `600 ${0.17 * sx}px "JetBrains Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  'abcde'.split('').forEach((ch, k) => {
    g.fillText(ch, toX(-BB_LEN / 2 + 0.14), toY(-(0.508 + (4 - k) * PITCH)));
    g.fillText('fghij'[k], toX(-BB_LEN / 2 + 0.14), toY(0.508 + k * PITCH));
  });
  for (let col = 0; col < BB_COLS; col += 5) {
    g.fillText(String(col + 1), toX((col - 10) * PITCH), toY(-BB_W / 2 + 0.2));
    g.fillText(String(col + 1), toX((col - 10) * PITCH), toY(BB_W / 2 - 0.2));
  }
  // 同一直排相通的提示線
  g.strokeStyle = 'rgba(14,165,233,.18)';
  g.lineWidth = 0.12 * sx;
  g.lineCap = 'round';
  for (let col = 0; col < BB_COLS; col++) {
    const x = toX((col - 10) * PITCH);
    g.beginPath(); g.moveTo(x, toY(-0.508)); g.lineTo(x, toY(-(0.508 + 4 * PITCH))); g.stroke();
    g.beginPath(); g.moveTo(x, toY(0.508)); g.lineTo(x, toY(0.508 + 4 * PITCH)); g.stroke();
  }
  // 孔
  g.fillStyle = '#3b3f46';
  for (let col = 0; col < BB_COLS; col++) {
    for (const z of BB_ROWS) {
      const s = 0.09 * sx;
      g.fillRect(toX((col - 10) * PITCH) - s / 2, toY(z) - s / 2, s, s);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Breadboard() {
  const tex = useMemo(() => makeBreadboardTop(), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e4e2d8', roughness: 0.8 }), []);
  const ref = useRef<THREE.Mesh>(null!);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh ref={ref} position={[0, BB_H / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[BB_LEN, BB_H, BB_W]} />
      <primitive object={side} attach="material-0" />
      <primitive object={side} attach="material-1" />
      <meshStandardMaterial attach="material-2" map={tex} roughness={0.75} />
      <primitive object={side} attach="material-3" />
      <primitive object={side} attach="material-4" />
      <primitive object={side} attach="material-5" />
    </mesh>
  );
}

export const nanoVisual: BoardVisual = {
  id: 'nano',
  pcbT: NANO_PCB_T,
  edgeColor: '#0f3560',
  renderPart: renderNanoPart,
  headerOf: (p) => (p.z < 0 ? 'hdrF' : 'hdrN'),
  makeTop: makeNanoTop,
  makeBottom: makeNanoBottom,
  BenchExtras: Breadboard,
};
