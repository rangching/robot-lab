import { useMemo } from 'react';
import * as THREE from 'three';

/** 共用材質（模組層級快取，避免每次重建） */
export const MAT = {
  black: new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.55, metalness: 0.1 }),
  blackGloss: new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.3, metalness: 0.2 }),
  socket: new THREE.MeshStandardMaterial({ color: '#2a2c31', roughness: 0.7 }),
  silver: new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.25, metalness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.35, metalness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9a944', roughness: 0.3, metalness: 1 }),
  tin: new THREE.MeshStandardMaterial({ color: '#d7dbe0', roughness: 0.2, metalness: 1 }),
  hole: new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: '#e9e9e4', roughness: 0.6 }),
  capBody: new THREE.MeshStandardMaterial({ color: '#1f2733', roughness: 0.45, metalness: 0.2 }),
  capStripe: new THREE.MeshStandardMaterial({ color: '#9aa7b8', roughness: 0.5 }),
  ceramic: new THREE.MeshStandardMaterial({ color: '#b98a54', roughness: 0.6 }),
  smdRes: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 }),
};

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 28);

export function Box({ size, pos = [0, 0, 0], mat, rot }: { size: [number, number, number]; pos?: [number, number, number]; mat: THREE.Material; rot?: [number, number, number] }) {
  return <mesh geometry={box} material={mat} position={pos} scale={size} rotation={rot} castShadow receiveShadow />;
}

export function Cyl({ r, h, pos = [0, 0, 0], mat, rot }: { r: number; h: number; pos?: [number, number, number]; mat: THREE.Material; rot?: [number, number, number] }) {
  return <mesh geometry={cyl} material={mat} position={pos} scale={[r, h, r]} rotation={rot} castShadow receiveShadow />;
}

/** 在 canvas 上畫文字，做成晶片表面的貼圖 */
export function useLabelTexture(lines: string[], w = 512, h = 128, color = '#9aa0a8', bg = '#121316', font = 'JetBrains Mono') {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = Math.floor(h / (lines.length + 0.6));
    g.font = `600 ${fs}px "${font}", monospace`;
    lines.forEach((l, i) => g.fillText(l, w / 2, (h / (lines.length + 1)) * (i + 1)));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [lines.join('|'), w, h, color, bg, font]);
}

/** DIP 雙排直插晶片（含 IC 座） */
export function DipChip({ pins = 28, label = ['ATMEGA328P-PU'] }: { pins?: number; label?: string[] }) {
  const per = pins / 2;
  const len = per * 0.254;
  const tex = useLabelTexture(label, 1024, 160);
  const legs = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < per; i++) {
      const x = -len / 2 + 0.127 + i * 0.254;
      arr.push([x, -0.36], [x, 0.36]);
    }
    return arr;
  }, [per, len]);
  return (
    <group>
      {/* IC 座 */}
      <Box size={[len + 0.12, 0.2, 0.9]} pos={[0, 0.1, 0]} mat={MAT.socket} />
      <Box size={[len - 0.1, 0.205, 0.32]} pos={[0, 0.1, 0]} mat={MAT.black} />
      {legs.map(([x, z], i) => (
        <Box key={i} size={[0.06, 0.12, 0.08]} pos={[x, 0.24, z]} mat={MAT.silver} />
      ))}
      {/* 晶片本體 */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[len, 0.24, 0.66]} />
        <meshStandardMaterial attach="material-0" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-1" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-4" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-5" color="#141518" roughness={0.5} />
      </mesh>
      <Cyl r={0.08} h={0.01} pos={[-len / 2 + 0.12, 0.485, 0]} mat={MAT.hole} />
    </group>
  );
}

/** 小型 QFN／QFP 表面黏著晶片 */
export function SmdChip({ size = 0.5, label = ['16U2'] }: { size?: number; label?: string[] }) {
  const tex = useLabelTexture(label, 256, 256);
  return (
    <group>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[size, 0.09, size]} />
        <meshStandardMaterial attach="material-0" color="#141518" />
        <meshStandardMaterial attach="material-1" color="#141518" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#141518" />
        <meshStandardMaterial attach="material-4" color="#141518" />
        <meshStandardMaterial attach="material-5" color="#141518" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[size * 0.9, 0.02, 0.05]} pos={[0, 0.01, (s * (size + 0.05)) / 2]} mat={MAT.tin} />
          <Box size={[0.05, 0.02, size * 0.9]} pos={[(s * (size + 0.05)) / 2, 0.01, 0]} mat={MAT.tin} />
        </group>
      ))}
    </group>
  );
}

/** 排母（母座）；n 支腳、高度 h */
export function FemaleHeader({ n, h = 0.85 }: { n: number; h?: number }) {
  const w = n * 0.254;
  return (
    <group>
      <Box size={[w, h, 0.254]} pos={[0, h / 2, 0]} mat={MAT.black} />
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} size={[0.1, 0.01, 0.1]} pos={[-w / 2 + 0.127 + i * 0.254, h + 0.001, 0]} mat={MAT.hole} />
      ))}
    </group>
  );
}

/** 公排針 cols × rows */
export function MaleHeader({ cols, rows }: { cols: number; rows: number }) {
  const pins: [number, number][] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) pins.push([(c - (cols - 1) / 2) * 0.254, (r - (rows - 1) / 2) * 0.254]);
  return (
    <group>
      <Box size={[cols * 0.254, 0.25, rows * 0.254]} pos={[0, 0.125, 0]} mat={MAT.black} />
      {pins.map(([x, z], i) => (
        <Box key={i} size={[0.064, 0.6, 0.064]} pos={[x, 0.42, z]} mat={MAT.gold} />
      ))}
    </group>
  );
}

export function UsbB() {
  return (
    <group>
      <Box size={[1.6, 1.08, 1.2]} pos={[0, 0.54, 0]} mat={MAT.steel} />
      <Box size={[0.02, 0.78, 0.86]} pos={[-0.8, 0.56, 0]} mat={MAT.hole} />
      <Box size={[0.9, 0.3, 0.5]} pos={[-0.36, 0.56, 0]} mat={MAT.white} />
      <Box size={[1.64, 0.05, 1.24]} pos={[0, 1.07, 0]} mat={MAT.silver} />
    </group>
  );
}

export function BarrelJack() {
  return (
    <group>
      <Box size={[1.4, 1.1, 0.9]} pos={[0, 0.55, 0]} mat={MAT.blackGloss} />
      <Cyl r={0.3} h={0.04} rot={[0, 0, Math.PI / 2]} pos={[-0.71, 0.62, 0]} mat={MAT.hole} />
      <Cyl r={0.06} h={0.3} rot={[0, 0, Math.PI / 2]} pos={[-0.6, 0.62, 0]} mat={MAT.silver} />
    </group>
  );
}

export function Regulator() {
  return (
    <group>
      <Box size={[0.66, 0.16, 0.36]} pos={[0, 0.08, 0.05]} mat={MAT.black} />
      <Box size={[0.66, 0.03, 0.18]} pos={[0, 0.015, -0.24]} mat={MAT.tin} />
      {[-0.23, 0, 0.23].map((x) => (
        <Box key={x} size={[0.07, 0.03, 0.14]} pos={[x, 0.015, 0.29]} mat={MAT.tin} />
      ))}
    </group>
  );
}

export function ElectroCap({ r = 0.3, h = 0.55 }: { r?: number; h?: number }) {
  return (
    <group>
      <Cyl r={r} h={h} pos={[0, h / 2, 0]} mat={MAT.capBody} />
      <Cyl r={r * 0.98} h={0.01} pos={[0, h + 0.005, 0]} mat={MAT.silver} />
      <Box size={[r * 0.5, h * 0.9, 0.02]} pos={[r * 0.85, h / 2, 0]} rot={[0, 0, 0]} mat={MAT.capStripe} />
      <Box size={[0.6, 0.06, 0.6]} pos={[0, 0.03, 0]} mat={MAT.black} />
    </group>
  );
}

export function Crystal() {
  return (
    <group>
      <Box size={[0.66, 0.34, 0.44]} pos={[0, 0.17, 0]} mat={MAT.silver} />
      <Cyl r={0.22} h={0.34} pos={[-0.33, 0.17, 0]} mat={MAT.silver} />
      <Cyl r={0.22} h={0.34} pos={[0.33, 0.17, 0]} mat={MAT.silver} />
    </group>
  );
}

export function TactButton() {
  return (
    <group>
      <Box size={[0.6, 0.18, 0.6]} pos={[0, 0.09, 0]} mat={MAT.steel} />
      <Cyl r={0.17} h={0.14} pos={[0, 0.24, 0]} mat={MAT.blackGloss} />
    </group>
  );
}

/** 0805 表面黏著 LED；glow 為 0–1 亮度 */
export function SmdLed({ color, glow }: { color: string; glow: number }) {
  return (
    <group>
      <Box size={[0.22, 0.03, 0.13]} pos={[0, 0.015, 0]} mat={MAT.tin} />
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.15, 0.07, 0.12]} />
        <meshStandardMaterial color={glow > 0.05 ? color : '#d8d4c4'} emissive={color} emissiveIntensity={glow * 6} roughness={0.3} toneMapped={false} />
      </mesh>
      {glow > 0.05 && <pointLight color={color} intensity={glow * 0.8} distance={1.2} position={[0, 0.25, 0]} />}
    </group>
  );
}
