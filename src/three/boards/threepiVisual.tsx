import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TP_AXLE_DROP, TP_BENCH_SCALE, TP_FOOTPRINTS, TP_LIFT, TP_PCB_T, TP_R, TP_SLOT, TP_W, TP_D, TP_WHEEL_X } from '../../data/boards/threepi';
import { botVisual, useBot } from '../../sim/bot';
import { BOT, LAYOUTS, type Layout } from '../../sim/drive';
import { Box, Cyl, MAT, SmdChip, SmdLed, TactButton, MaleHeader, useLabelTexture } from '../parts/primitives';
import { makeThreepiBottom, makeThreepiTop } from './threepiTexture';
import type { BoardVisual, Lights } from './visualTypes';

const cm = (mm: number) => mm / 10;
const RAD = TP_W / 2;
/** 底面零件的區域座標：往「上」畫＝實際往下；輪軸在這個高度 */
const AXLE = TP_AXLE_DROP;
const GROUND = TP_LIFT - TP_PCB_T;

/** 圓形 PCB，左右各挖一個讓輪子穿過的缺口；車頭下方有一圈黑色保險桿 */
function RoundPcb({ top, bottom, edge }: { top: THREE.Texture; bottom: THREE.Texture; edge: THREE.Material }) {
  const geo = useMemo(() => {
    // 形狀座標 (u, v)：u＝x、v＝機頭方向（＝ −z）
    const hd = cm(TP_SLOT.hd);
    const inner = RAD - cm(TP_WHEEL_X[0] + TP_SLOT.hw);
    const xe = Math.sqrt(RAD * RAD - hd * hd);
    const a0 = Math.atan2(hd, xe);
    const s = new THREE.Shape();
    s.moveTo(xe, hd);
    s.absarc(0, 0, RAD, a0, Math.PI - a0, false);
    s.lineTo(-inner, hd);
    s.lineTo(-inner, -hd);
    s.lineTo(-xe, -hd);
    s.absarc(0, 0, RAD, Math.PI + a0, 2 * Math.PI - a0, false);
    s.lineTo(inner, -hd);
    s.lineTo(inner, hd);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: TP_PCB_T, bevelEnabled: false, curveSegments: 64 });
  }, []);
  const bumper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.6, side: THREE.DoubleSide }), []);
  return (
    <group>
      <mesh geometry={geo} material={edge} rotation={[-Math.PI / 2, 0, 0]} position={[0, -TP_PCB_T, 0]} castShadow receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[TP_W, TP_D]} />
        <meshStandardMaterial map={top} alphaTest={0.5} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -TP_PCB_T - 0.003, 0]}>
        <planeGeometry args={[TP_W, TP_D]} />
        <meshStandardMaterial map={bottom} alphaTest={0.5} roughness={0.6} />
      </mesh>
      {/* 保險桿：車頭（−z）下方的弧形塑膠片 */}
      <mesh position={[0, -TP_PCB_T - 0.55, 0]} material={bumper}>
        <cylinderGeometry args={[RAD + 0.08, RAD + 0.08, 0.9, 48, 1, true, Math.PI - 1.05, 2.1]} />
      </mesh>
    </group>
  );
}

/** OLED：顯示程式寫進 display 的文字（沒有程式時顯示開機畫面） */
function Oled() {
  const oled = useBot((s) => s.oled);
  const { tex, cv } = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, cv };
  }, []);
  useEffect(() => {
    const g = cv.getContext('2d')!;
    g.fillStyle = '#04060a';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#9fe8ff';
    g.font = '600 22px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    const lines = oled.length ? oled : ['', '  3pi+ 2040', '  MicroPython'];
    lines.slice(0, 5).forEach((l, i) => g.fillText(l, 8, 6 + i * 24));
    tex.needsUpdate = true;
  }, [oled, cv, tex]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group>
      {[[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]].map(([x, z]) => <Cyl key={`${x}${z}`} r={0.08} h={0.25} pos={[x, 0.125, z]} mat={MAT.tin} />)}
      <Box size={[3.6, 0.1, 2.2]} pos={[0, 0.3, 0]} mat={MAT.blackGloss} />
      <mesh position={[0, 0.36, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.0, 1.5]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Buzzer() {
  return (
    <group>
      <Box size={[0.9, 0.35, 0.9]} pos={[0, 0.175, 0]} mat={MAT.blackGloss} />
      <Cyl r={0.08} h={0.01} pos={[0, 0.355, 0]} mat={MAT.hole} />
    </group>
  );
}

function UsbC() {
  return (
    <group>
      <Box size={[0.9, 0.32, 0.75]} pos={[0, 0.16, 0]} mat={MAT.steel} />
      <Box size={[0.7, 0.16, 0.02]} pos={[0, 0.16, 0.38]} mat={MAT.hole} />
    </group>
  );
}

function PowerSwitch() {
  return (
    <group>
      <Box size={[0.7, 0.3, 0.4]} pos={[0, 0.15, 0]} mat={MAT.black} />
      <Box size={[0.22, 0.18, 0.2]} pos={[-0.12, 0.39, 0]} mat={MAT.white} />
    </group>
  );
}

function Regulator8V() {
  const ind = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4b5058', roughness: 0.7 }), []);
  return (
    <group>
      <Box size={[0.5, 0.32, 0.5]} pos={[-0.12, 0.16, 0]} mat={ind} />
      <group position={[0.3, 0, 0]}><SmdChip size={0.2} label={['']} /></group>
    </group>
  );
}

/** 背面：5 組循線感測器（發射＋接收） */
function LineSensors() {
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[(i - 2) * cm(BOT.sensorDx * 1000), 0, 0]}>
          <Box size={[0.36, 0.12, 0.24]} pos={[0, 0.06, 0]} mat={MAT.black} />
          <Cyl r={0.05} h={0.04} pos={[-0.08, 0.14, 0]} mat={MAT.blackGloss} />
          <Cyl r={0.05} h={0.04} pos={[0.08, 0.14, 0]} mat={MAT.blackGloss} />
        </group>
      ))}
    </group>
  );
}

function BumpSensor() {
  return (
    <group>
      <Box size={[0.42, 0.14, 0.26]} pos={[0, 0.07, 0]} mat={MAT.black} />
      <Cyl r={0.05} h={0.04} pos={[0, 0.16, 0]} mat={MAT.blackGloss} />
    </group>
  );
}

/** 減速馬達＋尾端的磁性編碼器；dir＝輪子在哪一側（−1 左、1 右） */
function GearMotor({ dir }: { dir: -1 | 1 }) {
  const can = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c3c8cf', metalness: 0.9, roughness: 0.3 }), []);
  const mag = useMemo(() => new THREE.MeshStandardMaterial({ color: '#30343c', roughness: 0.5 }), []);
  const len = cm(TP_FOOTPRINTS.motorL[2]);
  return (
    <group>
      {/* 齒輪箱靠輪子那端 */}
      <Box size={[0.9, 1.0, 1.2]} pos={[dir * (len / 2 - 0.45), AXLE, 0]} mat={MAT.steel} />
      <Box size={[1.1, 1.0, 1.2]} pos={[dir * (len / 2 - 1.45), AXLE, 0]} mat={can} />
      {/* 輪軸伸向輪子 */}
      <Cyl r={0.15} h={0.8} rot={[0, 0, Math.PI / 2]} pos={[dir * (len / 2 + 0.4), AXLE, 0]} mat={MAT.steel} />
      {/* 編碼器：小磁鐵圓盤＋霍爾感測器小板 */}
      <Cyl r={0.42} h={0.12} rot={[0, 0, Math.PI / 2]} pos={[-dir * (len / 2 - 0.1), AXLE, 0]} mat={mag} />
      <Box size={[0.08, 1.1, 1.0]} pos={[-dir * (len / 2 - 0.25), AXLE, 0]} mat={new THREE.MeshStandardMaterial({ color: '#1f6b3a', roughness: 0.6 })} />
    </group>
  );
}

/** 輪子：在工作台上跟著模擬轉動 */
function Wheel({ side }: { side: 'L' | 'R' }) {
  const g = useRef<THREE.Group>(null!);
  const tire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.9 }), []);
  useFrame(() => {
    g.current.rotation.x = -(side === 'L' ? botVisual.angL : botVisual.angR);
  });
  return (
    <group position={[0, AXLE, 0]}>
      <group ref={g}>
        <Cyl r={1.6} h={0.7} rot={[0, 0, Math.PI / 2]} mat={tire} />
        <Cyl r={1.15} h={0.72} rot={[0, 0, Math.PI / 2]} mat={MAT.white} />
        {[0, 1, 2].map((k) => <Box key={k} size={[0.74, 0.18, 2.0]} rot={[(k * Math.PI) / 3, 0, 0]} mat={MAT.socket} />)}
      </group>
    </group>
  );
}

function BatteryHolder() {
  const tex = useLabelTexture(['4 × AAA'], 512, 256, '#9aa0a8', '#16181c');
  return (
    <group>
      <mesh position={[0, 0.675, 0]} castShadow>
        <boxGeometry args={[4.4, 1.15, 2.4]} />
        <primitive object={MAT.black} attach="material-0" />
        <primitive object={MAT.black} attach="material-1" />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.6} />
        <primitive object={MAT.black} attach="material-3" />
        <primitive object={MAT.black} attach="material-4" />
        <primitive object={MAT.black} attach="material-5" />
      </mesh>
    </group>
  );
}

function Caster() {
  return (
    <group>
      <Cyl r={0.45} h={GROUND - 0.5} pos={[0, (GROUND - 0.5) / 2, 0]} mat={MAT.black} />
      <mesh position={[0, GROUND - 0.35, 0]} castShadow>
        <sphereGeometry args={[0.35, 20, 14]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.95} roughness={0.2} />
      </mesh>
    </group>
  );
}

const RGB_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
const DRV_DX = cm(TP_R - TP_FOOTPRINTS.motorL[0]);

function renderThreepiPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <SmdChip size={0.7} label={['RP2040']} />;
    case 'flash': return <SmdChip size={0.45} label={['16MB']} />;
    case 'oled': return <Oled />;
    case 'btnA':
    case 'btnB':
    case 'btnC': return <TactButton />;
    case 'yled': return <group scale={1.3}><SmdLed color="#facc15" glow={lights.L ?? 0} /></group>;
    case 'rgb': return <group>{RGB_COLORS.map((c, i) => <group key={c} position={[(i - 2.5) * 0.8, 0, 0]}><SmdLed color={c} glow={0} /></group>)}</group>;
    case 'buzzer': return <Buzzer />;
    case 'imu': return <SmdChip size={0.3} label={['LSM6']} />;
    case 'mag': return <SmdChip size={0.2} label={['LIS3']} />;
    case 'drv': return <group>{[-1, 1].map((d) => <group key={d} position={[d * DRV_DX, 0, 0]}><SmdChip size={0.25} label={['']} /></group>)}</group>;
    case 'reg': return <Regulator8V />;
    case 'usb': return <UsbC />;
    case 'power': return <PowerSwitch />;
    case 'header': return <MaleHeader cols={6} rows={1} />;
    case 'line': return <LineSensors />;
    case 'bumpL':
    case 'bumpR': return <BumpSensor />;
    case 'motorL': return <GearMotor dir={-1} />;
    case 'motorR': return <GearMotor dir={1} />;
    case 'wheelL': return <Wheel side="L" />;
    case 'wheelR': return <Wheel side="R" />;
    case 'battery': return <BatteryHolder />;
    case 'caster': return <Caster />;
    default: return null;
  }
}

// ---------- 工作台：賽道墊＋會跑的車子 ----------
const S = TP_BENCH_SCALE;
/** 賽道座標（m）→ 工作台座標（相對板子位置，cm） */
const sx = (x: number) => x * 100 * S;
const sz = (y: number) => -y * 100 * S;

function drawMat(L: Layout): THREE.CanvasTexture {
  const Wc = 2000;
  const Hc = Math.round((Wc * L.hd) / L.hw);
  const c = document.createElement('canvas');
  c.width = Wc;
  c.height = Hc;
  const g = c.getContext('2d')!;
  const k = Wc / (2 * L.hw); // px / m
  const px = (x: number) => (x + L.hw) * k;
  const py = (y: number) => (L.hd - y) * k;
  g.fillStyle = '#f3f0e8';
  g.fillRect(0, 0, Wc, Hc);
  // 10 cm 格線
  g.strokeStyle = 'rgba(30, 41, 59, 0.08)';
  g.lineWidth = 2;
  for (let x = -L.hw; x <= L.hw + 1e-6; x += 0.1) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), Hc); g.stroke(); }
  for (let y = -L.hd; y <= L.hd + 1e-6; y += 0.1) { g.beginPath(); g.moveTo(0, py(y)); g.lineTo(Wc, py(y)); g.stroke(); }
  if (L.path) {
    g.strokeStyle = '#111214';
    g.lineWidth = BOT.lineHalf * 2 * k;
    g.lineJoin = 'round';
    g.beginPath();
    L.path.forEach(([x, y], i) => (i ? g.lineTo(px(x), py(y)) : g.moveTo(px(x), py(y))));
    g.closePath();
    g.stroke();
  }
  // 起點：綠色箭頭
  const st = L.start;
  g.save();
  g.translate(px(st.x), py(st.y));
  g.rotate(-st.th);
  g.fillStyle = 'rgba(22, 163, 74, 0.85)';
  g.beginPath();
  g.moveTo(0.075 * k, 0);
  g.lineTo(0.055 * k, -0.018 * k);
  g.lineTo(0.055 * k, 0.018 * k);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(22, 163, 74, 0.55)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, BOT.radius * k, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // 空曠墊子：從起點量起的尺，每 10 cm 一格
  if (!L.path && !L.boxes.length) {
    g.fillStyle = '#334155';
    g.strokeStyle = '#334155';
    g.font = `600 ${0.028 * k}px "JetBrains Mono", monospace`;
    g.textAlign = 'center';
    const y = st.y - 0.075;
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(px(st.x), py(y)); g.lineTo(px(st.x + 0.75), py(y)); g.stroke();
    for (let d = 0; d <= 75; d += 5) {
      const x = st.x + d / 100;
      const big = d % 10 === 0;
      g.beginPath(); g.moveTo(px(x), py(y)); g.lineTo(px(x), py(y) - (big ? 0.022 : 0.012) * k); g.stroke();
      if (big) g.fillText(`${d}`, px(x), py(y) + 0.032 * k);
    }
    g.textAlign = 'left';
    g.fillText('cm（從車子中心量起）', px(st.x + 0.62), py(y) - 0.035 * k);
  }
  g.fillStyle = 'rgba(51, 65, 85, 0.55)';
  g.font = `700 ${0.03 * k}px "Noto Sans TC", sans-serif`;
  g.textAlign = 'left';
  g.fillText(L.name, px(-L.hw + 0.02), py(L.hd - 0.045));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 工作台上的賽道墊：場地由目前的程式決定（BotPanel 會把它寫進 useBot） */
function TrackMat() {
  const L = LAYOUTS[useBot((s) => s.layout)];
  const tex = useMemo(() => drawMat(L), [L]);
  useEffect(() => () => tex.dispose(), [tex]);
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.8 }), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4a373', roughness: 0.75 }), []);
  const mw = sx(2 * L.hw);
  const md = 2 * L.hd * 100 * S;
  const wh = 0.75; // 矮牆高 3 cm
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[mw, md]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <Box size={[mw + 0.3, wh, 0.15]} pos={[0, wh / 2, -md / 2 - 0.075]} mat={wall} />
      <Box size={[mw + 0.3, wh, 0.15]} pos={[0, wh / 2, md / 2 + 0.075]} mat={wall} />
      <Box size={[0.15, wh, md]} pos={[-mw / 2 - 0.075, wh / 2, 0]} mat={wall} />
      <Box size={[0.15, wh, md]} pos={[mw / 2 + 0.075, wh / 2, 0]} mat={wall} />
      {L.boxes.map((b, i) => <Box key={i} size={[sx(b.w), 1.5, b.h * 100 * S]} pos={[sx(b.x), 0.75, sz(b.y)]} mat={wood} />)}
    </group>
  );
}

/** 車子在賽道上的位置與方向（機頭在模型的 −z，所以偏航要減 90°） */
function pose() {
  return { x: sx(botVisual.x), z: sz(botVisual.y), yaw: botVisual.th - Math.PI / 2 };
}

function ThreepiDrive({ lift, children }: { lift: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    const p = pose();
    g.current.position.set(p.x, lift * S, p.z);
    g.current.rotation.set(0, p.yaw, 0);
  });
  return <group ref={g} scale={S} position={[sx(botVisual.x), lift * S, sz(botVisual.y)]}>{children}</group>;
}

const UP = new THREE.Vector3(0, 1, 0);
function benchXform(v: THREE.Vector3) {
  const p = pose();
  return v.clone().setY(v.y - TP_LIFT).applyAxisAngle(UP, p.yaw).multiplyScalar(S).add(new THREE.Vector3(p.x, TP_LIFT * S, p.z));
}

export const threepiVisual: BoardVisual = {
  id: 'threepi',
  pcbT: TP_PCB_T,
  edgeColor: '#0c2a1f',
  renderPart: renderThreepiPart,
  headerOf: () => 'header',
  makeTop: makeThreepiTop,
  makeBottom: makeThreepiBottom,
  Pcb: RoundPcb,
  BenchExtras: TrackMat,
  BenchFly: ThreepiDrive,
  benchXform,
};
