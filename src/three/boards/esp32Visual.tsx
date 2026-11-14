import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { ESP_PCB_T, ESP_SPACER, ESP_LEG, ESP_BB_SHIFT, ESP_ROW_FAR, ESP_MID_Y } from '../../data/boards/esp32';
import { Box, MAT, Regulator, SmdChip, SmdLed } from '../parts/primitives';
import { Breadboard } from './breadboard';
import { makeEsp32Top, makeEsp32Bottom } from './esp32Texture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;
/** 模組本身的小電路板（深藍黑色） */
const MODULE_PCB = new THREE.MeshStandardMaterial({ color: '#1b2230', roughness: 0.6 });
const MODULE_T = 0.08;
const MODULE_Y = 0.02 + MODULE_T / 2;

/** 屏蔽蓋頂面：髮絲紋金屬＋小小的刻字（長邊沿 x，天線那端在 +x） */
function useShieldTexture() {
  return useMemo(() => {
    const W = 1024;
    const H = Math.round((W * 1.6) / 1.72);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#d3d8de');
    grad.addColorStop(1, '#b4bac2');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) {
      g.fillStyle = `rgba(255,255,255,${0.04 + ((y * 7919) % 13) / 260})`;
      g.fillRect(0, y, W, 1);
    }
    g.fillStyle = 'rgba(70,76,86,.85)';
    g.textBaseline = 'middle';
    g.font = '700 74px "JetBrains Mono", monospace';
    g.fillText('ESP-WROOM-32', 90, H * 0.36);
    g.font = '500 44px "JetBrains Mono", monospace';
    g.fillText('Wi-Fi + BT · 2.4 GHz', 90, H * 0.5);
    g.fillText('ESP32-D0WD  4MB', 90, H * 0.6);
    // 第 1 腳標記
    g.beginPath();
    g.arc(60, H - 60, 16, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

/** ESP-WROOM-32 模組：小電路板＋金屬屏蔽蓋＋側邊半孔焊點（不含天線段） */
function WroomModule() {
  const tex = useShieldTexture();
  const len = 1.95;
  const castles = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let i = 0; i < 14; i++) {
      const x = -len / 2 + 0.13 + i * 0.127;
      out.push({ pos: [x, MODULE_Y, 0.905], size: [0.07, MODULE_T + 0.01, 0.03] });
      out.push({ pos: [x, MODULE_Y, -0.905], size: [0.07, MODULE_T + 0.01, 0.03] });
    }
    for (let i = 0; i < 10; i++) out.push({ pos: [-len / 2 - 0.005, MODULE_Y, -0.57 + i * 0.127], size: [0.03, MODULE_T + 0.01, 0.07] });
    return out;
  }, []);
  return (
    <group>
      <Box size={[len, MODULE_T, 1.8]} pos={[0, MODULE_Y, 0]} mat={MODULE_PCB} />
      {castles.map((c, i) => <Box key={i} size={c.size} pos={c.pos} mat={MAT.gold} />)}
      {/* 屏蔽蓋 */}
      <mesh position={[-0.02, 0.1 + 0.12, 0]} castShadow>
        <boxGeometry args={[1.72, 0.24, 1.6]} />
        <meshStandardMaterial attach="material-0" color="#b8bec6" metalness={0.9} roughness={0.35} />
        <meshStandardMaterial attach="material-1" color="#b8bec6" metalness={0.9} roughness={0.35} />
        <meshStandardMaterial attach="material-2" map={tex} metalness={0.55} roughness={0.38} />
        <meshStandardMaterial attach="material-3" color="#b8bec6" metalness={0.9} roughness={0.35} />
        <meshStandardMaterial attach="material-4" color="#b8bec6" metalness={0.9} roughness={0.35} />
        <meshStandardMaterial attach="material-5" color="#b8bec6" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** 模組末端的 PCB 天線：彎來彎去的金色走線 */
function PcbAntenna() {
  const segs = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const y = MODULE_Y + MODULE_T / 2 + 0.004;
    const xs = [-0.2, -0.08, 0.04, 0.16];
    xs.forEach((x, i) => {
      out.push({ pos: [x, y, 0.1], size: [0.035, 0.008, 1.3] });
      if (i < xs.length - 1) out.push({ pos: [x + 0.06, y, i % 2 ? -0.53 : 0.73], size: [0.155, 0.008, 0.035] });
    });
    out.push({ pos: [-0.26, y, -0.55], size: [0.12, 0.008, 0.035] });
    return out;
  }, []);
  return (
    <group>
      <Box size={[0.6, MODULE_T, 1.8]} pos={[0, MODULE_Y, 0]} mat={MODULE_PCB} />
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

/** 5.2 × 3.2 mm 的 SMD 按鈕，長邊沿 x */
function SideButton() {
  return (
    <group>
      <Box size={[0.52, 0.14, 0.32]} pos={[0, 0.07, 0]} mat={MAT.steel} />
      <Box size={[0.22, 0.08, 0.16]} pos={[0, 0.18, 0]} mat={MAT.blackGloss} />
      {[-0.3, 0.3].flatMap((x) => [-0.1, 0.1].map((z) => <Box key={`${x}${z}`} size={[0.08, 0.02, 0.06]} pos={[x, 0.01, z]} mat={MAT.tin} />))}
    </group>
  );
}

/** 一排 15 支、朝下焊的排針（含塑膠座與頂面焊點） */
function PinRow({ n = 15 }: { n?: number }) {
  const w = n * PITCH;
  const legH = ESP_PCB_T + ESP_SPACER + ESP_LEG + 0.06;
  return (
    <group>
      <Box size={[w, ESP_SPACER, PITCH]} pos={[0, -ESP_PCB_T - ESP_SPACER / 2, 0]} mat={MAT.black} />
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

function renderEsp32Part(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <WroomModule />;
    case 'antenna': return <PcbAntenna />;
    case 'usb': return <MicroUsb />;
    case 'uart': return <SmdChip size={0.5} label={['CP2102']} />;
    case 'reg': return <Regulator />;
    case 'boot':
    case 'en': return <SideButton />;
    case 'ledBlue': return <group scale={0.8}><SmdLed color="#3d8bff" glow={lights.L ?? 0} /></group>;
    case 'pwrLed': return <group scale={0.8}><SmdLed color="#ff3b3b" glow={lights.ON ?? 0} /></group>;
    case 'hdrF':
    case 'hdrN': return <PinRow />;
    default: return null;
  }
}

/** 工作台：ESP32 插在麵包板中間，排針佔掉 b／i 列，只剩最外側的 a／j 列能接線 */
function Esp32Bench() {
  return <Breadboard cols={25} x={ESP_BB_SHIFT} highlightRow={(ESP_ROW_FAR - ESP_MID_Y) / 10 + 0.254} />;
}

export const esp32Visual: BoardVisual = {
  id: 'esp32',
  pcbT: ESP_PCB_T,
  edgeColor: '#16181c',
  renderPart: renderEsp32Part,
  headerOf: (p) => (p.z < 0 ? 'hdrF' : 'hdrN'),
  makeTop: makeEsp32Top,
  makeBottom: makeEsp32Bottom,
  BenchExtras: Esp32Bench,
};
