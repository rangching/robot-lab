import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { JET_BENCH_LIFT, JET_CAM_X, JET_CAM_Y, JET_MOD_T, JET_MOD_Y, JET_PCB_T, JET_PIN_TOP, jx, jz } from '../../data/boards/jetson';
import { simVisual } from '../../sim/engine';
import { BarrelJack, Box, Cyl, MAT, SmdLed, useLabelTexture } from '../parts/primitives';
import { JET_HOLES, makeJetsonBottom, makeJetsonTop } from './jetsonTexture';
import type { BoardVisual, Lights } from './visualTypes';

const PITCH = 0.254;
/** 模組 PCB 頂面高度（相對載板頂面） */
const MOD_TOP = JET_MOD_Y + JET_MOD_T;
/** 散熱器底板頂面（底板壓在晶片的金屬蓋上）、鰭片頂端的高度 */
const HS_BASE = MOD_TOP + 0.29;
const HS_TOP = HS_BASE + 1.05;

const SHELL = new THREE.MeshStandardMaterial({ color: '#cfd4da', roughness: 0.38, metalness: 0.45 });
const USB_BLUE = new THREE.MeshStandardMaterial({ color: '#1e5fd8', roughness: 0.45 });
const FFC_BODY = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.6 });
const SUBSTRATE = new THREE.MeshStandardMaterial({ color: '#2a3b2c', roughness: 0.7 });
const MODULE_PCB = new THREE.MeshStandardMaterial({ color: '#1b4a33', roughness: 0.6 });
const ALU = new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 0.45, metalness: 0.55 });
const FAN_BODY = new THREE.MeshStandardMaterial({ color: '#17191d', roughness: 0.55 });
const FAN_BLADE = new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.5 });
const NV_GREEN = new THREE.MeshStandardMaterial({ color: '#76b900', roughness: 0.5 });
const SD_CARD = new THREE.MeshStandardMaterial({ color: '#1b2a4a', roughness: 0.5 });
const RUBBER = new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.9 });
const RIBBON = new THREE.MeshStandardMaterial({ color: '#d9a650', roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide });
const CAM_PCB = new THREE.MeshStandardMaterial({ color: '#1f6b3a', roughness: 0.6 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#2a3c66', roughness: 0.08, metalness: 0.6 });
const ETH_LED_G = new THREE.MeshStandardMaterial({ color: '#36d36b', emissive: '#36d36b', emissiveIntensity: 0.6, toneMapped: false });
const ETH_LED_Y = new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 0.6, toneMapped: false });

/** 頂面貼了標籤貼圖的方塊 */
function LabelBox({ size, y, tex, color, metal = 0.2, rough = 0.5 }: { size: [number, number, number]; y: number; tex: THREE.Texture; color: string; metal?: number; rough?: number }) {
  return (
    <mesh position={[0, y, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      {[0, 1, 3, 4, 5].map((i) => <meshStandardMaterial key={i} attach={`material-${i}`} color={color} metalness={metal} roughness={rough} />)}
      <meshStandardMaterial attach="material-2" map={tex} metalness={metal * 0.6} roughness={rough} />
    </mesh>
  );
}

/** 運算模組：綠色小 PCB，遠側是插進 SO-DIMM 的金手指，近側有兩個固定螺絲 */
function Module() {
  const tex = useLabelTexture(['JETSON ORIN NANO', '8GB · P3767'], 512, 128, '#cfe8d6', '#1b4a33');
  return (
    <group>
      <Box size={[6.96, JET_MOD_T, 4.5]} pos={[0, JET_MOD_Y + JET_MOD_T / 2, 0]} mat={MODULE_PCB} />
      <Box size={[6.6, JET_MOD_T + 0.004, 0.32]} pos={[0, JET_MOD_Y + JET_MOD_T / 2, -2.09]} mat={MAT.gold} />
      {[-3.1, 3.1].map((x) => <Cyl key={x} r={0.2} h={0.08} pos={[x, MOD_TOP + 0.04, 1.95]} mat={MAT.steel} />)}
      {/* 模組近側露出來的小零件與標籤 */}
      <group position={[-1.6, MOD_TOP + 0.002, 1.95]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 0.6]} />
          <meshStandardMaterial map={tex} roughness={0.6} />
        </mesh>
      </group>
      {[0.6, 1.0, 1.4, 1.8, 2.2].map((x) => <Box key={x} size={[0.18, 0.06, 0.1]} pos={[x, MOD_TOP + 0.03, 1.9]} mat={MAT.smdRes} />)}
    </group>
  );
}

/** Orin 系統單晶片：基板＋裸晶上方的金屬蓋（被散熱器蓋住，拆開才看得到） */
function Soc() {
  const tex = useLabelTexture(['NVIDIA', 'ORIN', 'AMPERE · 1024 CUDA'], 512, 512, '#4a4f57', '#c3c8cf');
  return (
    <group>
      <Box size={[1.5, 0.06, 1.5]} pos={[0, MOD_TOP + 0.03, 0]} mat={SUBSTRATE} />
      <LabelBox size={[1.15, 0.07, 1.15]} y={MOD_TOP + 0.095} tex={tex} color="#b9bec6" metal={0.85} rough={0.3} />
    </group>
  );
}

function Ram() {
  const tex = useLabelTexture(['LPDDR5', '8GB'], 360, 420, '#8a9099', '#141518');
  return <LabelBox size={[1.2, 0.1, 1.4]} y={MOD_TOP + 0.05} tex={tex} color="#141518" />;
}

/** 鋁製散熱器：底板＋一排鰭片 */
function Heatsink() {
  const fins = useMemo(() => Array.from({ length: 24 }, (_, i) => -3.1 + i * (6.2 / 23)), []);
  return (
    <group>
      <Box size={[6.4, 0.16, 4.2]} pos={[0, HS_BASE - 0.08, 0]} mat={ALU} />
      {fins.map((x) => <Box key={x} size={[0.07, HS_TOP - HS_BASE, 4.2]} pos={[x, (HS_BASE + HS_TOP) / 2, 0]} mat={ALU} />)}
    </group>
  );
}

/** 風扇：外框＋會轉的扇葉（執行程式時轉快一點） */
function Fan() {
  const blades = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    blades.current.rotation.y -= dt * (simVisual.running ? 22 : 5);
  });
  const h = 0.32;
  const y = HS_TOP + h / 2;
  const b = 4.0;
  const t = 0.3;
  return (
    <group>
      {[[0, b / 2 - t / 2], [0, -b / 2 + t / 2]].map(([x, z]) => <Box key={`z${z}`} size={[b, h, t]} pos={[x, y, z]} mat={FAN_BODY} />)}
      {[[b / 2 - t / 2, 0], [-b / 2 + t / 2, 0]].map(([x, z]) => <Box key={`x${x}`} size={[t, h, b]} pos={[x, y, z]} mat={FAN_BODY} />)}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <Cyl key={`${sx}${sz}`} r={0.12} h={0.04} pos={[sx * 1.7, y + h / 2 + 0.01, sz * 1.7]} mat={MAT.steel} />)}
      <group ref={blades} position={[0, y, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} rotation={[0, (i / 7) * Math.PI * 2, 0]}>
            <mesh position={[0.95, 0, 0]} rotation={[0.45, 0, 0]} material={FAN_BLADE} castShadow>
              <boxGeometry args={[1.25, 0.03, 0.62]} />
            </mesh>
          </group>
        ))}
        <Cyl r={0.48} h={h * 0.9} mat={FAN_BODY} />
        <Cyl r={0.32} h={0.02} pos={[0, h * 0.46, 0]} mat={NV_GREEN} />
      </group>
    </group>
  );
}

/** 公排針 cols × rows，針尖高 top（cm） */
function PinHeader({ cols, rows, top = JET_PIN_TOP }: { cols: number; rows: number; top?: number }) {
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

/** microSD 卡槽：吊在模組底下靠前的邊緣，卡片往觀看者這側露出一截 */
function SdSlot() {
  return (
    <group>
      <Box size={[1.2, 0.13, 1.2]} pos={[0, JET_MOD_Y - 0.065, 0]} mat={SHELL} />
      <Box size={[1.1, 0.07, 0.5]} pos={[0, JET_MOD_Y - 0.08, 0.8]} mat={SD_CARD} />
    </group>
  );
}

/** SO-DIMM 插槽：黑色長條＋兩端的金屬卡榫 */
function SoDimm() {
  return (
    <group>
      <Box size={[7.0, 0.5, 0.5]} pos={[0, 0.25, 0]} mat={MAT.black} />
      <Box size={[6.7, 0.06, 0.08]} pos={[0, 0.5, 0.12]} mat={MAT.hole} />
      {[-3.6, 3.6].map((x) => <Box key={x} size={[0.12, 0.55, 0.9]} pos={[x, 0.275, 0.3]} mat={MAT.steel} />)}
    </group>
  );
}

/** 開口朝 -z（遠側）的小接頭：USB-C */
function UsbC() {
  return (
    <group>
      <Box size={[0.9, 0.32, 0.75]} pos={[0, 0.16, 0]} mat={SHELL} />
      <Box size={[0.76, 0.2, 0.02]} pos={[0, 0.16, -0.38]} mat={MAT.hole} />
      <Box size={[0.53, 0.04, 0.02]} pos={[0, 0.16, -0.387]} mat={MAT.black} />
    </group>
  );
}

/** DisplayPort：一角削掉的金屬口，開口朝 -z */
function DisplayPort() {
  return (
    <group>
      <Box size={[1.9, 0.6, 1.2]} pos={[0, 0.3, 0]} mat={SHELL} />
      <Box size={[1.6, 0.42, 0.02]} pos={[0, 0.3, -0.605]} mat={MAT.hole} />
      <mesh position={[0.68, 0.18, -0.61]} rotation={[0, 0, Math.PI / 4]} material={SHELL}>
        <boxGeometry args={[0.3, 0.3, 0.02]} />
      </mesh>
      <Box size={[1.2, 0.1, 0.5]} pos={[0, 0.3, -0.36]} mat={MAT.black} />
    </group>
  );
}

/** 雙層 USB-A，開口朝 +x（外面再轉向） */
function UsbStack() {
  return (
    <group>
      <Box size={[1.75, 1.56, 1.35]} pos={[0, 0.78, 0]} mat={SHELL} />
      {[0.42, 1.14].map((y) => (
        <group key={y}>
          <Box size={[0.02, 0.56, 1.22]} pos={[0.876, y, 0]} mat={MAT.hole} />
          <Box size={[0.5, 0.14, 1.02]} pos={[0.64, y - 0.08, 0]} mat={USB_BLUE} />
        </group>
      ))}
    </group>
  );
}

/** RJ45 網路孔，開口朝 +x（外面再轉向），上方兩顆指示燈 */
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

/** 22 腳 CSI 排線接頭，長邊沿 z，卡榫在外側（+x） */
function Csi() {
  return (
    <group scale={[1, 1, 0.75]}>
      <Box size={[0.38, 0.22, 2.2]} pos={[0, 0.11, 0]} mat={FFC_BODY} />
      <Box size={[0.12, 0.02, 1.9]} pos={[0.04, 0.225, 0]} mat={MAT.hole} />
      <Box size={[0.14, 0.08, 2.24]} pos={[0.13, 0.26, 0]} mat={MAT.black} />
    </group>
  );
}

/** M.2 插槽（背面零件，照正面方向畫）：一端是插座，另一端是固定螺柱；Key-E 那格插著 Wi-Fi 卡 */
function M2Slot({ len, card }: { len: number; card?: boolean }) {
  return (
    <group>
      <Box size={[0.45, 0.42, 2.2]} pos={[-len / 2 + 0.25, 0.21, 0]} mat={MAT.black} />
      <Box size={[0.06, 0.05, 1.9]} pos={[-len / 2 + 0.48, 0.28, 0]} mat={MAT.gold} />
      <Cyl r={0.2} h={0.32} pos={[len / 2 - 0.2, 0.16, 0]} mat={MAT.gold} />
      {card && (
        <group>
          <Box size={[len - 0.4, 0.08, 2.2]} pos={[0, 0.34, 0]} mat={MODULE_PCB} />
          <Box size={[1.3, 0.12, 1.5]} pos={[0.1, 0.44, 0]} mat={MAT.silver} />
          {[-0.5, 0.5].map((z) => <Cyl key={z} r={0.1} h={0.08} pos={[0.95, 0.42, z]} mat={MAT.gold} />)}
        </group>
      )}
    </group>
  );
}

function renderJetsonPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'som': return <Module />;
    case 'soc': return <Soc />;
    case 'ram': return <Ram />;
    case 'heatsink': return <Heatsink />;
    case 'fan': return <Fan />;
    case 'gpio': return <PinHeader cols={20} rows={2} />;
    case 'btn': return <PinHeader cols={2} rows={6} top={0.6} />;
    case 'sd': return <SdSlot />;
    case 'sodimm': return <SoDimm />;
    case 'usbc': return <UsbC />;
    case 'dp': return <DisplayPort />;
    case 'dcjack': return <group rotation={[0, -Math.PI / 2, 0]}><BarrelJack /></group>;
    case 'usb':
      return <>{[-0.8, 0.8].map((x) => <group key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}><UsbStack /></group>)}</>;
    case 'eth': return <group rotation={[0, Math.PI / 2, 0]}><Ethernet /></group>;
    case 'csi':
      return <>{[JET_CAM_Y.cam0, JET_CAM_Y.cam1].map((y) => <group key={y} position={[0, 0, jz(y) - jz(40)]}><Csi /></group>)}</>;
    case 'm2m80': return <M2Slot len={8.0} />;
    case 'm2m30': return <M2Slot len={3.0} />;
    case 'wifi': return <M2Slot len={3.0} card />;
    case 'pwrLed': return <group scale={0.8}><SmdLed color="#3dff6b" glow={lights.ON ?? 0} /></group>;
    default: return null;
  }
}

/** 兩點之間的扁平排線：長度沿 a→b，寬度垂直於 n（排線的法向量） */
function Strip({ a, b, n, w = 1.0 }: { a: [number, number, number]; b: [number, number, number]; n: [number, number, number]; w?: number }) {
  const m = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const zAx = B.clone().sub(A);
    const len = zAx.length();
    zAx.normalize();
    const yAx = new THREE.Vector3(...n).projectOnPlane(zAx).normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
    return { pos: A.add(B).multiplyScalar(0.5), q, len };
  }, [a, b, n]);
  return (
    <mesh position={m.pos} quaternion={m.q} material={RIBBON} castShadow>
      <boxGeometry args={[w, 0.02, m.len]} />
    </mesh>
  );
}

/** 工作台上相機的位置（相對工作台上的板子位置）：放在板子右後方，鏡頭朝觀看者 */
export const JET_CAM_STAND: [number, number] = [7.0, -4.4];

/** 工作台：4 個腳座＋插在 CAM0 的 CSI 相機模組與排線 */
function JetsonBench() {
  const h = JET_BENCH_LIFT - JET_PCB_T;
  const [cx, cz] = JET_CAM_STAND;
  const camY = 2.1;
  const conn: [number, number, number] = [jx(JET_CAM_X) + 0.2, JET_BENCH_LIFT + 0.24, jz(JET_CAM_Y.cam0)];
  const edge: [number, number, number] = [jx(100) + 0.5, conn[1], conn[2]];
  const floor: [number, number, number] = [edge[0], 0.02, conn[2]];
  const back: [number, number, number] = [cx, 0.02, cz - 0.25];
  const up: [number, number, number] = [cx, camY - 0.6, cz - 0.25];
  return (
    <group>
      {JET_HOLES.map(([x, y]) => (
        <group key={`${x}${y}`} position={[jx(x), 0, jz(y)]}>
          <mesh position={[0, h / 2, 0]} material={RUBBER} castShadow>
            <cylinderGeometry args={[0.32, 0.36, h, 16]} />
          </mesh>
        </group>
      ))}
      {/* 排線：從 CAM0 拉出板邊、垂到桌面、沿桌面走到相機背後再往上 */}
      <Strip a={conn} b={edge} n={[0, 1, 0]} w={0.95} />
      <Strip a={edge} b={floor} n={[1, 0, 0]} w={0.95} />
      <Strip a={floor} b={back} n={[0, 1, 0]} w={0.95} />
      <Strip a={back} b={up} n={[0, 0, 1]} w={0.95} />
      {/* 相機支架與相機模組（鏡頭朝 +z） */}
      <group position={[cx, 0, cz]}>
        <Box size={[1.6, 0.16, 1.2]} pos={[0, 0.08, 0]} mat={MAT.black} />
        <Box size={[0.2, camY - 0.6, 0.2]} pos={[0, (camY - 0.6) / 2 + 0.1, -0.1]} mat={MAT.black} />
        <Box size={[2.5, 2.4, 0.1]} pos={[0, camY, 0]} mat={CAM_PCB} />
        <Box size={[0.85, 0.85, 0.42]} pos={[0, camY, 0.26]} mat={MAT.black} />
        <Cyl r={0.3} h={0.3} rot={[Math.PI / 2, 0, 0]} pos={[0, camY, 0.62]} mat={MAT.black} />
        <Cyl r={0.2} h={0.02} rot={[Math.PI / 2, 0, 0]} pos={[0, camY, 0.78]} mat={GLASS} />
        {[[-1.05, -1.0], [1.05, -1.0], [-1.05, 1.0], [1.05, 1.0]].map(([x, y]) => <Cyl key={`${x}${y}`} r={0.1} h={0.12} rot={[Math.PI / 2, 0, 0]} pos={[x, camY + y, 0.05]} mat={MAT.gold} />)}
      </group>
    </group>
  );
}

export const jetsonVisual: BoardVisual = {
  id: 'jetson',
  pcbT: JET_PCB_T,
  edgeColor: '#0f2a20',
  renderPart: renderJetsonPart,
  headerOf: () => 'gpio',
  makeTop: makeJetsonTop,
  makeBottom: makeJetsonBottom,
  BenchExtras: JetsonBench,
};

