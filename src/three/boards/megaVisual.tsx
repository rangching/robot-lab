import type { ReactNode } from 'react';
import type { PinDef } from '../../data/types';
import { MEGA_PCB_T, MEGA_DBL_X, MEGA_COMM_X, megaX } from '../../data/boards/mega';
import type { BoardVisual, Lights } from './visualTypes';
import { makeMegaTopTexture, makeMegaBottomTexture } from './megaPcbTexture';
import { Box, BarrelJack, Crystal, ElectroCap, FemaleHeader, MAT, MaleHeader, Regulator, SmdChip, SmdLed, TactButton, UsbB, useLabelTexture } from '../parts/primitives';

/** 100 腳 TQFP 表面黏著晶片：四邊各 25 支 0.5 mm 間距的細腳 */
export function QfpChip({ size = 1.4, perSide = 25, label = ['', '', '', 'ATMEGA2560', '16AU', '', '', ''] }: { size?: number; perSide?: number; label?: string[] }) {
  const tex = useLabelTexture(label, 512, 512, '#a3a9b1');
  const pitch = 0.05;
  const span = (perSide - 1) * pitch;
  const legs: ReactNode[] = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < perSide; i++) {
      const o = -span / 2 + i * pitch;
      const d = size / 2 + 0.07;
      const horiz = side % 2 === 0;
      const s = side < 2 ? 1 : -1;
      legs.push(
        <Box
          key={`${side}-${i}`}
          size={horiz ? [0.026, 0.02, 0.14] : [0.14, 0.02, 0.026]}
          pos={horiz ? [o, 0.012, s * d] : [s * d, 0.012, o]}
          mat={MAT.tin}
        />,
      );
    }
  }
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[size, 0.12, size]} />
        <meshStandardMaterial attach="material-0" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-1" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.5} />
        <meshStandardMaterial attach="material-3" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-4" color="#141518" roughness={0.5} />
        <meshStandardMaterial attach="material-5" color="#141518" roughness={0.5} />
      </mesh>
      {/* 第 1 腳圓點 */}
      <mesh position={[-size / 2 + 0.16, 0.131, -size / 2 + 0.16]} material={MAT.hole}>
        <cylinderGeometry args={[0.05, 0.05, 0.004, 20]} />
      </mesh>
      {legs}
    </group>
  );
}

/** 2 × n 的雙排母，沿 z 方向排列 */
function DoubleFemaleHeader({ n }: { n: number }) {
  const dx = (MEGA_DBL_X[1] - MEGA_DBL_X[0]) / 20;
  return (
    <>
      {[-dx, dx].map((x) => (
        <group key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <FemaleHeader n={n} />
        </group>
      ))}
    </>
  );
}

function renderPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu':
      return (
        <group rotation={[0, Math.PI / 4, 0]}>
          <QfpChip />
        </group>
      );
    case 'usb': return <UsbB />;
    case 'u2': return <SmdChip size={0.5} label={['ATMEGA', '16U2']} />;
    case 'jack': return <BarrelJack />;
    case 'reg': return <Regulator />;
    case 'caps':
      return (
        <>
          <group position={[0.45, 0, -0.1]}><ElectroCap /></group>
          <group position={[-0.1, 0, -0.45]}><ElectroCap /></group>
        </>
      );
    case 'dig':
      return (
        <>
          <group position={[(21.4 + 4.5 * 2.54 - 44) / 10, 0, 0]}><FemaleHeader n={10} /></group>
          <group position={[(48.3 + 3.5 * 2.54 - 44) / 10, 0, 0]}><FemaleHeader n={8} /></group>
        </>
      );
    case 'comm':
      return <group position={[(MEGA_COMM_X + 3.5 * 2.54 - 79.5) / 10, 0, 0]}><FemaleHeader n={8} /></group>;
    case 'pwr': return <FemaleHeader n={8} />;
    case 'ana': return <FemaleHeader n={8} />;
    case 'ana2': return <FemaleHeader n={8} />;
    case 'dbl': return <DoubleFemaleHeader n={18} />;
    case 'ledL': return <SmdLed color="#ffae1a" glow={lights.L ?? 0} />;
    case 'txrx':
      return (
        <>
          <group position={[0, 0, -0.14]}><SmdLed color="#ffd23a" glow={lights.TX ?? 0} /></group>
          <group position={[0, 0, 0.14]}><SmdLed color="#ffd23a" glow={lights.RX ?? 0} /></group>
        </>
      );
    case 'on': return <SmdLed color="#3dff6b" glow={lights.ON ?? 0} />;
    case 'reset': return <TactButton />;
    case 'xtal': return <Crystal />;
    case 'icsp': return <MaleHeader cols={2} rows={3} />;
    default: return null;
  }
}

/** 這支腳的熱點掛在哪個排母零件上 */
function headerOf(p: PinDef): string {
  if (p.x > megaX(92)) return 'dbl';
  if (p.z < 0) return p.x > megaX(69) ? 'comm' : 'dig';
  if (p.x < megaX(45)) return 'pwr';
  return p.x < megaX(68) ? 'ana' : 'ana2';
}

/** 多板註冊用的 3D 外觀 */
export const megaVisual: BoardVisual = {
  id: 'mega',
  pcbT: MEGA_PCB_T,
  edgeColor: '#0d3a46',
  renderPart,
  headerOf,
  makeTop: makeMegaTopTexture,
  makeBottom: makeMegaBottomTexture,
};
