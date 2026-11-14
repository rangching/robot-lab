import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { NM_PCB_T, NM_SPACER, NM_LEG, NM_BB_SHIFT, NM_ROW_FAR, NM_MID_Y, NM_BB_OFFSET, NM_FOOTPRINTS } from '../../data/boards/nodemcu';
import { Box, MAT, Regulator, SmdChip, SmdLed, useLabelTexture } from '../parts/primitives';
import { Breadboard } from './breadboard';
import { makeNodemcuTop, makeNodemcuBottom } from './nodemcuTexture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;
/** ESP-12E 模組自己的小電路板（深藍色） */
const MODULE_PCB = new THREE.MeshStandardMaterial({ color: '#16243d', roughness: 0.6 });
const MODULE_T = 0.08;
const MODULE_Y = 0.02 + MODULE_T / 2;
const CAN = new THREE.MeshStandardMaterial({ color: '#b8bec6', metalness: 0.9, roughness: 0.35 });

/** 模組金屬蓋段的長度（cm），和天線段在 x 方向接起來 */
const MOD_LEN = NM_FOOTPRINTS.mcu[2] / 10;
const ANT_LEN = NM_FOOTPRINTS.antenna[2] / 10;
const MOD_W = NM_FOOTPRINTS.mcu[3] / 10;

/** ESP-12E 模組：小電路板＋金屬屏蔽蓋＋兩側與尾端的半孔焊點（不含天線段） */
function Esp12Module() {
  const tex = useLabelTexture(['ESP8266MOD', 'ESP-12E', '802.11 b/g/n'], 1024, 460, '#5b6068', '#c9ced6');
  const castles = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    // 兩條長邊各 8 個半孔（間距 2 mm）
    for (let i = 0; i < 8; i++) {
      const x = -MOD_LEN / 2 + 0.12 + i * 0.2;
      out.push({ pos: [x, MODULE_Y, MOD_W / 2 + 0.005], size: [0.09, MODULE_T + 0.01, 0.03] });
      out.push({ pos: [x, MODULE_Y, -MOD_W / 2 - 0.005], size: [0.09, MODULE_T + 0.01, 0.03] });
    }
    // 尾端（靠 USB 那側）6 個半孔
    for (let i = 0; i < 6; i++) out.push({ pos: [-MOD_LEN / 2 - 0.005, MODULE_Y, -0.5 + i * 0.2], size: [0.03, MODULE_T + 0.01, 0.09] });
    return out;
  }, []);
  return (
    <group>
      <Box size={[MOD_LEN, MODULE_T, MOD_W]} pos={[0, MODULE_Y, 0]} mat={MODULE_PCB} />
      {castles.map((c, i) => <Box key={i} size={c.size} pos={c.pos} mat={MAT.gold} />)}
      {/* 屏蔽蓋 */}
      <mesh position={[0, 0.1 + 0.11, 0]} castShadow>
        <boxGeometry args={[MOD_LEN - 0.18, 0.22, MOD_W - 0.36]} />
        <primitive object={CAN} attach="material-0" />
        <primitive object={CAN} attach="material-1" />
        <meshStandardMaterial attach="material-2" map={tex} metalness={0.55} roughness={0.38} />
        <primitive object={CAN} attach="material-3" />
        <primitive object={CAN} attach="material-4" />
        <primitive object={CAN} attach="material-5" />
      </mesh>
    </group>
  );
}

/** 模組末端的之字形 PCB 天線（ESP-12 系列的經典「蛇形」走線） */
function MeanderAntenna() {
  const segs = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const y = MODULE_Y + MODULE_T / 2 + 0.004;
    const top = -0.62;
    const bottom = 0.25;
    const xs = [-0.28, -0.16, -0.04, 0.08, 0.2, 0.32];
    xs.forEach((x, i) => {
      out.push({ pos: [x, y, (top + bottom) / 2], size: [0.03, 0.008, bottom - top] });
      if (i < xs.length - 1) out.push({ pos: [x + 0.06, y, i % 2 ? bottom : top], size: [0.15, 0.008, 0.03] });
    });
    // 饋入線接回模組
    out.push({ pos: [-0.33, y, bottom], size: [0.1, 0.008, 0.03] });
    return out;
  }, []);
  return (
    <group>
      <Box size={[ANT_LEN, MODULE_T, MOD_W]} pos={[0, MODULE_Y, 0]} mat={MODULE_PCB} />
      {segs.map((s, i) => <Box key={i} size={s.size} pos={s.pos} mat={MAT.gold} />)}
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

/** 4 × 3 mm 的 SMD 小按鈕，長邊沿 x */
function SmallButton() {
  return (
    <group>
      <Box size={[0.42, 0.13, 0.3]} pos={[0, 0.065, 0]} mat={MAT.steel} />
      <Box size={[0.2, 0.07, 0.14]} pos={[0, 0.165, 0]} mat={MAT.white} />
      {[-0.24, 0.24].flatMap((x) => [-0.1, 0.1].map((z) => <Box key={`${x}${z}`} size={[0.07, 0.02, 0.06]} pos={[x, 0.01, z]} mat={MAT.tin} />))}
    </group>
  );
}

/** 一排 15 支、朝下焊的排針（含塑膠座與頂面焊點） */
function PinRow({ n = 15 }: { n?: number }) {
  const w = n * PITCH;
  const legH = NM_PCB_T + NM_SPACER + NM_LEG + 0.06;
  return (
    <group>
      <Box size={[w, NM_SPACER, PITCH]} pos={[0, -NM_PCB_T - NM_SPACER / 2, 0]} mat={MAT.black} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + PITCH / 2 + i * PITCH;
        return (
          <group key={i}>
            <Box size={[0.064, legH, 0.064]} pos={[x, 0.06 - legH / 2, 0]} mat={MAT.gold} />
            <mesh position={[x, 0.02, 0]} scale={[0.075, 0.04, 0.075]} material={MAT.tin}>
              <cylinderGeometry args={[1, 1, 1, 16]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function renderNodemcuPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <Esp12Module />;
    case 'antenna': return <MeanderAntenna />;
    case 'usb': return <MicroUsb />;
    case 'uart': return <SmdChip size={0.5} label={['CP2102']} />;
    case 'reg': return <Regulator />;
    case 'rst':
    case 'flash': return <SmallButton />;
    // 模組上的藍燈焊在模組的小電路板上，要墊高一個模組厚度
    case 'ledMod': return <group position={[0, MODULE_Y + MODULE_T / 2, 0]} scale={0.7}><SmdLed color="#3d8bff" glow={lights.L ?? 0} /></group>;
    case 'ledD0': return <group scale={0.8}><SmdLed color="#3d8bff" glow={0} /></group>;
    case 'hdrF':
    case 'hdrN': return <PinRow />;
    default: return null;
  }
}

/** 工作台：NodeMCU 插在麵包板中間，兩側最外面各剩一排孔可以接線 */
function NodemcuBench() {
  return <Breadboard cols={25} x={NM_BB_SHIFT} highlightRow={(NM_ROW_FAR - NM_MID_Y) / 10 + NM_BB_OFFSET} />;
}

export const nodemcuVisual: BoardVisual = {
  id: 'nodemcu',
  pcbT: NM_PCB_T,
  edgeColor: '#141824',
  renderPart: renderNodemcuPart,
  headerOf: (p) => (p.z < 0 ? 'hdrF' : 'hdrN'),
  makeTop: makeNodemcuTop,
  makeBottom: makeNodemcuBottom,
  BenchExtras: NodemcuBench,
};
