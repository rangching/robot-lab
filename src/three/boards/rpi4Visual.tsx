import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { RPI_PCB_T, RPI_BENCH_LIFT, RPI_PIN_TOP, rx, rz } from '../../data/boards/rpi4';
import { Box, Cyl, MAT, SmdChip, SmdLed, useLabelTexture } from '../parts/primitives';
import { makeRpi4Top, makeRpi4Bottom } from './rpi4Texture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;
/** 大接頭的金屬殼：金屬度調低，沒有環境反射時才不會變成黑色 */
const SHELL = new THREE.MeshStandardMaterial({ color: '#cfd4da', roughness: 0.38, metalness: 0.45 });
const USB_BLUE = new THREE.MeshStandardMaterial({ color: '#1e5fd8', roughness: 0.45 });
const FFC_BODY = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.6 });
const SUBSTRATE = new THREE.MeshStandardMaterial({ color: '#2a3b2c', roughness: 0.7 });
const BRASS = new THREE.MeshStandardMaterial({ color: '#c8a24a', roughness: 0.35, metalness: 0.9 });
const SD_CARD = new THREE.MeshStandardMaterial({ color: '#1b2a4a', roughness: 0.5 });
const ETH_LED_G = new THREE.MeshStandardMaterial({ color: '#36d36b', emissive: '#36d36b', emissiveIntensity: 0.6, toneMapped: false });
const ETH_LED_Y = new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 0.6, toneMapped: false });

/** 頂面貼了標籤貼圖的方塊（金屬蓋、晶片） */
function LabelBox({ size, y, tex, color, metal = 0.2, rough = 0.5 }: { size: [number, number, number]; y: number; tex: THREE.Texture; color: string; metal?: number; rough?: number }) {
  return (
    <mesh position={[0, y, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      {[0, 1, 3, 4, 5].map((i) => <meshStandardMaterial key={i} attach={`material-${i}`} color={color} metalness={metal} roughness={rough} />)}
      <meshStandardMaterial attach="material-2" map={tex} metalness={metal * 0.6} roughness={rough} />
    </mesh>
  );
}

/** BCM2711：綠色基板＋導熱金屬蓋 */
function Soc() {
  const tex = useLabelTexture(['BROADCOM', 'BCM2711B0', 'QUAD A72'], 512, 512, '#4a4f57', '#c3c8cf');
  return (
    <group>
      <Box size={[1.5, 0.06, 1.5]} pos={[0, 0.03, 0]} mat={SUBSTRATE} />
      <LabelBox size={[1.3, 0.08, 1.3]} y={0.1} tex={tex} color="#b9bec6" metal={0.9} rough={0.3} />
    </group>
  );
}

function Ram() {
  const tex = useLabelTexture(['LPDDR4', '4GB', 'SDRAM'], 360, 512, '#8a9099', '#141518');
  return <LabelBox size={[1.0, 0.1, 1.4]} y={0.05} tex={tex} color="#141518" />;
}

/** 公排針 cols × rows，針尖高 top（cm） */
function PinHeader({ cols, rows, top = RPI_PIN_TOP }: { cols: number; rows: number; top?: number }) {
  const pins = useMemo(() => {
    const out: [number, number][] = [];
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out.push([(c - (cols - 1) / 2) * PITCH, (r - (rows - 1) / 2) * PITCH]);
    return out;
  }, [cols, rows]);
  return (
    <group>
      <Box size={[cols * PITCH, 0.25, rows * PITCH]} pos={[0, 0.125, 0]} mat={MAT.black} />
      {pins.map(([x, z], i) => <Box key={i} size={[0.064, top, 0.064]} pos={[x, top / 2, z]} mat={MAT.gold} />)}
    </group>
  );
}

/** 開口朝 +z 的小接頭（USB-C、micro-HDMI） */
function EdgePort({ w, h, d, slot }: { w: number; h: number; d: number; slot: [number, number] }) {
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={SHELL} />
      <Box size={[slot[0], slot[1], 0.02]} pos={[0, h / 2, d / 2 + 0.005]} mat={MAT.hole} />
      <Box size={[slot[0] * 0.7, 0.04, 0.02]} pos={[0, h / 2, d / 2 + 0.012]} mat={MAT.black} />
    </group>
  );
}

/** 雙層 USB-A，開口朝 +x */
function UsbStack({ tongue }: { tongue: THREE.Material }) {
  return (
    <group>
      <Box size={[1.75, 1.56, 1.35]} pos={[0, 0.78, 0]} mat={SHELL} />
      {[0.42, 1.14].map((y) => (
        <group key={y}>
          <Box size={[0.02, 0.56, 1.22]} pos={[0.876, y, 0]} mat={MAT.hole} />
          <Box size={[0.5, 0.14, 1.02]} pos={[0.64, y - 0.08, 0]} mat={tongue} />
        </group>
      ))}
    </group>
  );
}

/** RJ45 網路孔，開口朝 +x，上方兩顆指示燈 */
function Ethernet() {
  return (
    <group>
      <Box size={[2.13, 1.35, 1.6]} pos={[0, 0.675, 0]} mat={SHELL} />
      <Box size={[0.02, 0.82, 1.18]} pos={[1.066, 0.58, 0]} mat={MAT.hole} />
      <Box size={[0.02, 0.12, 0.3]} pos={[1.07, 1.15, -0.55]} mat={ETH_LED_G} />
      <Box size={[0.02, 0.12, 0.3]} pos={[1.07, 1.15, 0.55]} mat={ETH_LED_Y} />
    </group>
  );
}

/** 3.5 mm 四極音源孔，插孔朝 +z */
function AudioJack() {
  return (
    <group>
      <Box size={[0.6, 0.55, 1.05]} pos={[0, 0.275, -0.1]} mat={MAT.blackGloss} />
      <Cyl r={0.3} h={0.26} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.3, 0.55]} mat={MAT.blackGloss} />
      <Cyl r={0.18} h={0.02} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.3, 0.69]} mat={MAT.hole} />
    </group>
  );
}

/** FFC 排線接頭（CSI／DSI），長邊沿 z */
function FfcConnector() {
  return (
    <group>
      <Box size={[0.38, 0.26, 2.2]} pos={[0, 0.13, 0]} mat={FFC_BODY} />
      <Box size={[0.12, 0.02, 1.9]} pos={[0.04, 0.265, 0]} mat={MAT.hole} />
      <Box size={[0.14, 0.08, 2.24]} pos={[-0.13, 0.3, 0]} mat={MAT.black} />
    </group>
  );
}

/** 無線模組的金屬屏蔽罩 */
function WifiCan() {
  return (
    <group>
      <Box size={[1.0, 0.16, 1.1]} pos={[0, 0.08, 0]} mat={MAT.silver} />
      <Box size={[0.3, 0.005, 0.3]} pos={[0.2, 0.163, 0.25]} mat={MAT.steel} />
    </group>
  );
}

/** 板角的天線走線（薄薄一層金色） */
function Antenna() {
  const segs = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (let i = 0; i < 4; i++) {
      out.push({ pos: [0, 0.004, -0.33 + i * 0.2], size: [0.36, 0.006, 0.045] });
      out.push({ pos: [i % 2 ? -0.18 : 0.18, 0.004, -0.23 + i * 0.2], size: [0.045, 0.006, 0.2] });
    }
    return out;
  }, []);
  return <group>{segs.map((s, i) => <Box key={i} size={s.size} pos={s.pos} mat={MAT.gold} />)}</group>;
}

/** microSD 卡槽＋插著的卡（照正面方向畫，BoardModel 會翻到背面） */
function SdSlot() {
  return (
    <group>
      <Box size={[1.15, 0.13, 1.2]} pos={[0.05, 0.065, 0]} mat={SHELL} />
      <Box size={[0.5, 0.07, 1.1]} pos={[-0.62, 0.05, 0]} mat={SD_CARD} />
    </group>
  );
}

function renderRpi4Part(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'soc': return <Soc />;
    case 'ram': return <Ram />;
    case 'gpio': return <PinHeader cols={20} rows={2} />;
    case 'poe': return <PinHeader cols={2} rows={2} top={0.75} />;
    case 'sd': return <SdSlot />;
    case 'usbc': return <EdgePort w={0.9} h={0.32} d={0.74} slot={[0.76, 0.2]} />;
    case 'hdmi':
      return (
        <>
          {[-0.675, 0.675].map((x) => <group key={x} position={[x, 0, 0]}><EdgePort w={0.65} h={0.3} d={0.75} slot={[0.52, 0.16]} /></group>)}
        </>
      );
    case 'audio': return <AudioJack />;
    case 'csi':
    case 'dsi': return <FfcConnector />;
    case 'eth': return <Ethernet />;
    case 'usb3': return <UsbStack tongue={USB_BLUE} />;
    case 'usb2': return <UsbStack tongue={MAT.black} />;
    case 'wifi': return <WifiCan />;
    case 'antenna': return <Antenna />;
    case 'usbCtl': return <SmdChip size={0.6} label={['VL805']} />;
    case 'pmic': return <SmdChip size={0.5} label={['PMIC']} />;
    case 'pwrLed': return <group scale={0.8}><SmdLed color="#ff3b3b" glow={lights.ON ?? 0} /></group>;
    case 'actLed': return <group scale={0.8}><SmdLed color="#3dff6b" glow={lights.L ?? 0} /></group>;
    default: return null;
  }
}

/** 工作台：Pi 墊在四根銅柱上 */
function Rpi4Bench() {
  const h = RPI_BENCH_LIFT - RPI_PCB_T;
  const holes: [number, number][] = [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]];
  return (
    <group>
      {holes.map(([x, y]) => (
        <group key={`${x}${y}`} position={[rx(x), 0, rz(y)]}>
          <mesh position={[0, h / 2, 0]} material={BRASS} castShadow>
            <cylinderGeometry args={[0.2, 0.2, h, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export const rpi4Visual: BoardVisual = {
  id: 'rpi4',
  pcbT: RPI_PCB_T,
  edgeColor: '#12502b',
  renderPart: renderRpi4Part,
  headerOf: () => 'gpio',
  makeTop: makeRpi4Top,
  makeBottom: makeRpi4Bottom,
  BenchExtras: Rpi4Bench,
};

