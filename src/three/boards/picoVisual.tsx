import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { PICO_PCB_T, PICO_SPACER, PICO_LEG, PICO_BB_GAP, PICO_BB_OFFSET, PICO_ROW_FAR, PICO_MID_Y, PICO_FOOTPRINTS } from '../../data/boards/pico';
import { Box, Cyl, MAT, SmdLed, useLabelTexture } from '../parts/primitives';
import { Breadboard } from './breadboard';
import { makePicoTop, makePicoBottom, PICO_SWD_Y } from './picoTexture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;
const CHIP = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.5 });
const INDUCTOR = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.75, metalness: 0.15 });
const BUTTON_CAP = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.45 });

/** 頂面貼字的扁平黑色晶片；size = [x, 高, z] */
function LabeledChip({ size, label, w = 256, h = 256 }: { size: [number, number, number]; label: string[]; w?: number; h?: number }) {
  const tex = useLabelTexture(label, w, h);
  return (
    <mesh position={[0, size[1] / 2 + 0.01, 0]} castShadow>
      <boxGeometry args={size} />
      <primitive object={CHIP} attach="material-0" />
      <primitive object={CHIP} attach="material-1" />
      <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
      <primitive object={CHIP} attach="material-3" />
      <primitive object={CHIP} attach="material-4" />
      <primitive object={CHIP} attach="material-5" />
    </mesh>
  );
}

/** RP2040：7 × 7 mm 的 QFN-56，四邊只有扁平焊墊、沒有伸出來的腳 */
function Rp2040() {
  const pads = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let i = 0; i < 14; i++) {
      const t = -0.2925 + i * 0.045;
      out.push({ pos: [t, 0.008, 0.36], size: [0.022, 0.016, 0.04] });
      out.push({ pos: [t, 0.008, -0.36], size: [0.022, 0.016, 0.04] });
      out.push({ pos: [0.36, 0.008, t], size: [0.04, 0.016, 0.022] });
      out.push({ pos: [-0.36, 0.008, t], size: [0.04, 0.016, 0.022] });
    }
    return out;
  }, []);
  return (
    <group>
      <LabeledChip size={[0.7, 0.09, 0.7]} label={['RP2-B2', '2040', 'P64M15']} />
      <Cyl r={0.03} h={0.005} pos={[-0.25, 0.103, -0.25]} mat={MAT.hole} />
      {pads.map((p, i) => <Box key={i} size={p.size} pos={p.pos} mat={MAT.tin} />)}
    </group>
  );
}

/** SOIC-8 flash，長邊沿 z（腳朝 ±x） */
function Soic8() {
  return (
    <group>
      <group rotation={[0, Math.PI / 2, 0]}>
        <LabeledChip size={[0.49, 0.14, 0.39]} label={['W25Q16JV', 'IQ 2MB']} w={512} h={320} />
      </group>
      {[-0.1905, -0.0635, 0.0635, 0.1905].flatMap((z) => [
        <Box key={`a${z}`} size={[0.11, 0.03, 0.045]} pos={[0.25, 0.03, z]} mat={MAT.tin} />,
        <Box key={`b${z}`} size={[0.11, 0.03, 0.045]} pos={[-0.25, 0.03, z]} mat={MAT.tin} />,
      ])}
    </group>
  );
}

/** Micro-USB B 接頭，開口朝 -x，前端稍微伸出板邊 */
function MicroUsb() {
  return (
    <group>
      <Box size={[0.58, 0.27, 0.76]} pos={[0, 0.135, 0]} mat={MAT.steel} />
      <Box size={[0.6, 0.02, 0.78]} pos={[0, 0.27, 0]} mat={MAT.silver} />
      <Box size={[0.02, 0.16, 0.6]} pos={[-0.291, 0.14, 0]} mat={MAT.hole} />
      <Box size={[0.3, 0.05, 0.42]} pos={[-0.15, 0.14, 0]} mat={MAT.black} />
      {[-0.42, 0.42].map((z) => (
        <Box key={z} size={[0.3, 0.03, 0.12]} pos={[0.14, 0.015, z]} mat={MAT.tin} />
      ))}
    </group>
  );
}

/** BOOTSEL：銀色外殼＋白色按鍵 */
function Bootsel() {
  return (
    <group>
      <Box size={[0.42, 0.12, 0.32]} pos={[0, 0.06, 0]} mat={MAT.steel} />
      <Cyl r={0.1} h={0.08} pos={[0, 0.16, 0]} mat={BUTTON_CAP} />
      {[-0.24, 0.24].flatMap((x) => [-0.11, 0.11].map((z) => <Box key={`${x}${z}`} size={[0.08, 0.02, 0.06]} pos={[x, 0.01, z]} mat={MAT.tin} />))}
    </group>
  );
}

/** 3.2 × 2.5 mm 的 SMD 石英振盪器：陶瓷底座＋金屬蓋 */
function SmdCrystal() {
  return (
    <group>
      <Box size={[0.32, 0.03, 0.25]} pos={[0, 0.015, 0]} mat={MAT.ceramic} />
      <Box size={[0.29, 0.05, 0.22]} pos={[0, 0.055, 0]} mat={MAT.silver} />
    </group>
  );
}

/** 功率電感：深灰色方塊，上面印數值 */
function PowerInductor() {
  const tex = useLabelTexture(['1R0'], 256, 256, '#c9ced6', '#3a3d42');
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.36, 0.2, 0.36]} />
        <primitive object={INDUCTOR} attach="material-0" />
        <primitive object={INDUCTOR} attach="material-1" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.75} />
        <primitive object={INDUCTOR} attach="material-3" />
        <primitive object={INDUCTOR} attach="material-4" />
        <primitive object={INDUCTOR} attach="material-5" />
      </mesh>
      {[-0.15, 0.15].map((x) => <Box key={x} size={[0.07, 0.02, 0.3]} pos={[x, 0.01, 0]} mat={MAT.tin} />)}
    </group>
  );
}

/** SWD 除錯接點：三個鍍金的小孔，沿 z 排列 */
function SwdPads() {
  const cx = PICO_FOOTPRINTS.swd[1];
  return (
    <group>
      {PICO_SWD_Y.map((y) => (
        <group key={y} position={[0.06, 0, (cx - y) / 10]}>
          <Cyl r={0.08} h={0.012} pos={[0, 0.006, 0]} mat={MAT.gold} />
          <Cyl r={0.042} h={0.014} pos={[0, 0.008, 0]} mat={MAT.hole} />
        </group>
      ))}
    </group>
  );
}

/** 一排 20 支、朝下焊的排針（含塑膠座與頂面焊點） */
function PinRow({ n = 20 }: { n?: number }) {
  const w = n * PITCH;
  const legH = PICO_PCB_T + PICO_SPACER + PICO_LEG + 0.06;
  return (
    <group>
      <Box size={[w, PICO_SPACER, PITCH]} pos={[0, -PICO_PCB_T - PICO_SPACER / 2, 0]} mat={MAT.black} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + PITCH / 2 + i * PITCH;
        return (
          <group key={i}>
            <Box size={[0.064, legH, 0.064]} pos={[x, 0.06 - legH / 2, 0]} mat={MAT.gold} />
            <Cyl r={0.07} h={0.04} pos={[x, 0.02, 0]} mat={MAT.tin} />
          </group>
        );
      })}
    </group>
  );
}

function renderPicoPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <Rp2040 />;
    case 'flash': return <Soic8 />;
    case 'usb': return <MicroUsb />;
    case 'bootsel': return <Bootsel />;
    case 'ledG': return <group scale={0.7}><SmdLed color="#3dff6a" glow={lights.L ?? 0} /></group>;
    case 'xtal': return <SmdCrystal />;
    case 'reg': return <LabeledChip size={[0.3, 0.08, 0.3]} label={['RT6150']} />;
    case 'ind': return <PowerInductor />;
    case 'swd': return <SwdPads />;
    case 'hdrN':
    case 'hdrF': return <PinRow />;
    default: return null;
  }
}

/**
 * 工作台：Pico 跨在麵包板溝槽上。0.7" 的排距讓排針落在 c／h 列，
 * 每側外面還剩兩列孔，接線插在最外側的 a／j 列。24 欄（偶數）讓孔剛好對齊排針。
 */
function PicoBench() {
  return <Breadboard cols={24} gap={PICO_BB_GAP} highlightRow={(PICO_ROW_FAR - PICO_MID_Y) / 10 + PICO_BB_OFFSET} />;
}

export const picoVisual: BoardVisual = {
  id: 'pico',
  pcbT: PICO_PCB_T,
  edgeColor: '#1a6a3a',
  renderPart: renderPicoPart,
  headerOf: (p) => (p.z < 0 ? 'hdrF' : 'hdrN'),
  makeTop: makePicoTop,
  makeBottom: makePicoBottom,
  BenchExtras: PicoBench,
};
