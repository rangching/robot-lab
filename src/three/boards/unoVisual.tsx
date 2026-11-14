import type { ReactNode } from 'react';
import { mx, PCB_T } from '../../data/boards/uno';
import type { PinDef } from '../../data/types';
import { makeTopTexture, makeBottomTexture } from './pcbTexture';
import { BarrelJack, Crystal, DipChip, ElectroCap, FemaleHeader, MaleHeader, Regulator, SmdChip, SmdLed, TactButton, UsbB } from '../parts/primitives';
import type { BoardVisual, Lights } from './visualTypes';

function renderUnoPart(id: string, lights: Lights): ReactNode {
  switch (id) {
    case 'mcu': return <DipChip />;
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
    case 'pwr': return <FemaleHeader n={8} />;
    case 'ana': return <FemaleHeader n={6} />;
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

export const unoVisual: BoardVisual = {
  id: 'uno',
  pcbT: PCB_T,
  edgeColor: '#0e3b47',
  renderPart: renderUnoPart,
  headerOf: (p: PinDef) => (p.z < 0 ? 'dig' : p.x < mx(45) ? 'pwr' : 'ana'),
  makeTop: makeTopTexture,
  makeBottom: makeBottomTexture,
};
