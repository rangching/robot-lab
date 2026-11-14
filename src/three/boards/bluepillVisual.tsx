import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { BP_PCB_T, BP_SPACER, BP_LEG, BP_BB_SHIFT, BP_BB_OFFSET, BP_ROW_FAR, BP_MID_Y, BP_FOOTPRINTS } from '../../data/boards/bluepill';
import { Box, Cyl, MAT, Crystal, MaleHeader, SmdChip, SmdLed, useLabelTexture } from '../parts/primitives';
import { Breadboard } from './breadboard';
import { makeBluepillTop, makeBluepillBottom } from './bluepillTexture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;
const JUMPER = new THREE.MeshStandardMaterial({ color: '#f5c518', roughness: 0.45 });

/** 斜放 45° 的 LQFP-48 晶片 */
function Stm32Chip() {
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      <SmdChip size={0.7} label={['STM32', 'F103', 'C8T6']} />
      {/* 第 1 腳的小圓點 */}
      <Cyl r={0.04} h={0.005} pos={[-0.25, 0.092, -0.25]} mat={MAT.steel} />
    </group>
  );
}

/** Micro-USB B 接頭，開口朝 -x */
function MicroUsb() {
  return (
    <group>
      <Box size={[0.56, 0.27, 0.76]} pos={[0, 0.135, 0]} mat={MAT.steel} />
      <Box size={[0.58, 0.02, 0.78]} pos={[0, 0.27, 0]} mat={MAT.silver} />
      <Box size={[0.02, 0.16, 0.6]} pos={[-0.281, 0.14, 0]} mat={MAT.hole} />
      <Box size={[0.3, 0.05, 0.42]} pos={[-0.15, 0.14, 0]} mat={MAT.black} />
      {[-0.42, 0.42].map((z) => (
        <Box key={z} size={[0.3, 0.03, 0.12]} pos={[0.12, 0.015, z]} mat={MAT.tin} />
      ))}
    </group>
  );
}

/** 0805 表面黏著電阻（R10），印著 103＝10 kΩ */
function SmdResistor() {
  const tex = useLabelTexture(['103'], 128, 64, '#e5e7eb', '#111214');
  return (
    <group>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.125]} />
        <meshStandardMaterial attach="material-0" color="#111214" />
        <meshStandardMaterial attach="material-1" color="#111214" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#111214" />
        <meshStandardMaterial attach="material-4" color="#111214" />
        <meshStandardMaterial attach="material-5" color="#111214" />
      </mesh>
      {[-0.09, 0.09].map((x) => <Box key={x} size={[0.04, 0.055, 0.125]} pos={[x, 0.028, 0]} mat={MAT.tin} />)}
    </group>
  );
}

/** SOT-23-5 小穩壓器，印著 662K */
function Sot23Regulator() {
  const tex = useLabelTexture(['662K'], 192, 96, '#c9ced6', '#16181c');
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.3, 0.11, 0.17]} />
        <meshStandardMaterial attach="material-0" color="#16181c" />
        <meshStandardMaterial attach="material-1" color="#16181c" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#16181c" />
        <meshStandardMaterial attach="material-4" color="#16181c" />
        <meshStandardMaterial attach="material-5" color="#16181c" />
      </mesh>
      {[-0.095, 0, 0.095].map((x) => <Box key={x} size={[0.04, 0.03, 0.08]} pos={[x, 0.015, 0.12]} mat={MAT.tin} />)}
      {[-0.095, 0.095].map((x) => <Box key={x} size={[0.04, 0.03, 0.08]} pos={[x, 0.015, -0.12]} mat={MAT.tin} />)}
    </group>
  );
}

/** 32.768 kHz 圓柱形小石英，躺著沿 x 方向 */
function WatchCrystal() {
  return (
    <group>
      <Cyl r={0.1} h={0.5} rot={[0, 0, Math.PI / 2]} pos={[0.05, 0.1, 0]} mat={MAT.silver} />
      <Box size={[0.14, 0.03, 0.06]} pos={[-0.26, 0.015, -0.04]} mat={MAT.tin} />
      <Box size={[0.14, 0.03, 0.06]} pos={[-0.26, 0.015, 0.04]} mat={MAT.tin} />
      <Box size={[0.2, 0.02, 0.24]} pos={[0.2, 0.01, 0]} mat={MAT.tin} />
    </group>
  );
}

/** BOOT0／BOOT1：2 × 3 排針，兩顆黃色跳線帽都跳在 0 */
function BootJumpers() {
  return (
    <group>
      <MaleHeader cols={3} rows={2} />
      {[-PITCH / 2, PITCH / 2].map((z) => (
        <group key={z}>
          <Box size={[0.5, 0.56, 0.24]} pos={[-PITCH / 2, 0.53, z]} mat={JUMPER} />
          <Box size={[0.36, 0.02, 0.1]} pos={[-PITCH / 2, 0.815, z]} mat={MAT.black} />
        </group>
      ))}
    </group>
  );
}

/** 6 × 3.5 mm 的小 SMD 按鈕 */
function SmallButton() {
  return (
    <group>
      <Box size={[0.52, 0.14, 0.32]} pos={[0, 0.07, 0]} mat={MAT.white} />
      <Box size={[0.24, 0.08, 0.16]} pos={[0, 0.18, 0]} mat={MAT.blackGloss} />
      {[-0.3, 0.3].flatMap((x) => [-0.1, 0.1].map((z) => <Box key={`${x}${z}`} size={[0.08, 0.02, 0.06]} pos={[x, 0.01, z]} mat={MAT.tin} />))}
    </group>
  );
}

/** 板子末端的 4 支 SWD 彎腳排針：從焊墊往上，再彎向 +x 伸出板外 */
function SwdHeader() {
  const padX = (49.6 - BP_FOOTPRINTS.swd[0]) / 10;
  return (
    <group>
      <Box size={[0.25, 0.25, 4 * PITCH]} pos={[padX + 0.2, 0.125, 0]} mat={MAT.black} />
      {[0, 1, 2, 3].map((i) => {
        const z = -(3.81 - i * 2.54) / 10;
        return (
          <group key={i}>
            <Box size={[0.064, 0.2, 0.064]} pos={[padX, 0.1, z]} mat={MAT.gold} />
            <Box size={[0.75, 0.064, 0.064]} pos={[padX + 0.34, 0.17, z]} mat={MAT.gold} />
            <mesh position={[padX, 0.02, z]} scale={[0.075, 0.04, 0.075]} material={MAT.tin}>
              <cylinderGeometry args={[1, 1, 1, 16]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** 一排 20 支、朝下焊的排針（含塑膠座與頂面焊點） */
function PinRow({ n = 20 }: { n?: number }) {
  const w = n * PITCH;
  const legH = BP_PCB_T + BP_SPACER + BP_LEG + 0.06;
  const xs = useMemo(() => Array.from({ length: n }, (_, i) => -w / 2 + PITCH / 2 + i * PITCH), [n, w]);
  return (
    <group>
      <Box size={[w, BP_SPACER, PITCH]} pos={[0, -BP_PCB_T - BP_SPACER / 2, 0]} mat={MAT.black} />
      {xs.map((x) => (
        <group key={x}>
          <Box size={[0.064, legH, 0.064]} pos={[x, 0.06 - legH / 2, 0]} mat={MAT.gold} />
          <mesh position={[x, 0.02, 0]} scale={[0.075, 0.04, 0.075]} material={MAT.tin}>
            <cylinderGeometry args={[1, 1, 1, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function renderBluepillPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <Stm32Chip />;
    case 'usb': return <MicroUsb />;
    case 'r10': return <SmdResistor />;
    case 'reg': return <Sot23Regulator />;
    case 'xtal': return <group scale={[0.86, 0.7, 0.9]}><Crystal /></group>;
    case 'xtal32': return <WatchCrystal />;
    case 'boot': return <BootJumpers />;
    case 'reset': return <SmallButton />;
    case 'ledPwr': return <group scale={0.8}><SmdLed color="#ff3b3b" glow={lights.ON ?? 0} /></group>;
    case 'led13': return <group scale={0.8}><SmdLed color="#34e07a" glow={lights.L ?? 0} /></group>;
    case 'swd': return <SwdHeader />;
    case 'hdrF':
    case 'hdrN': return <PinRow />;
    default: return null;
  }
}

/** 工作台：Blue Pill 插在麵包板中間（排距 0.6"，和 Nano 一樣），接線插在排針外側第二個孔 */
function BluepillBench() {
  return <Breadboard cols={25} x={BP_BB_SHIFT} highlightRow={(BP_ROW_FAR - BP_MID_Y) / 10 + BP_BB_OFFSET} />;
}

export const bluepillVisual: BoardVisual = {
  id: 'bluepill',
  pcbT: BP_PCB_T,
  edgeColor: '#0f2f6b',
  renderPart: renderBluepillPart,
  headerOf: (p) => (p.z < 0 ? 'hdrF' : 'hdrN'),
  makeTop: makeBluepillTop,
  makeBottom: makeBluepillBottom,
  BenchExtras: BluepillBench,
};
