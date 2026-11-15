import { unoData, type BoardData } from '../data/boards/registry';
import { ep, type Endpoint } from './types';

/** 工作台上開發板端點的擁有者前綴，例如 'mcu:D9' */
export const MCU = 'mcu';

/** 模擬器目前使用的板子（整個網站同一時間只有一塊板子在工作台上） */
let cur: BoardData = unoData;

export const simBoard = () => cur;
export function setSimBoard(b: BoardData) {
  cur = b;
}

export const mcuEp = (pin: string): Endpoint => ep(MCU, pin);
export const supplyEps = () => cur.supply.map(mcuEp);
export const gndEps = () => cur.gnd.map(mcuEp);
/** 數位／類比腳（可以被程式讀寫的腳） */
export const IO_PIN = /^(D\d+|A\d+|GP\d+|P[A-C]?\d+|GPIO\d+|PIN\d+)$/;
