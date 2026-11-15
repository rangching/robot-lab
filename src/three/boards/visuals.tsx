import type { BoardId } from '../../data/types';
import type { BoardVisual } from './visualTypes';
import { unoVisual } from './unoVisual';
import { nanoVisual } from './nanoVisual';
import { megaVisual } from './megaVisual';
import { esp32Visual } from './esp32Visual';
import { bluepillVisual } from './bluepillVisual';
import { rpi4Visual } from './rpi4Visual';
import { picoVisual } from './picoVisual';
import { nodemcuVisual } from './nodemcuVisual';
import { stampflyVisual } from './stampflyVisual';
import { jetsonVisual } from './jetsonVisual';
import { threepiVisual } from './threepiVisual';
import { microbitVisual } from './microbitVisual';

export type { BoardVisual, Lights } from './visualTypes';

export const BOARD_VISUALS: Partial<Record<BoardId, BoardVisual>> = {
  uno: unoVisual,
  nano: nanoVisual,
  mega: megaVisual,
  esp32: esp32Visual,
  bluepill: bluepillVisual,
  rpi4: rpi4Visual,
  pico: picoVisual,
  nodemcu: nodemcuVisual,
  stampfly: stampflyVisual,
  jetson: jetsonVisual,
  threepi: threepiVisual,
  microbit: microbitVisual,
};

export const boardVisual = (id: BoardId): BoardVisual => BOARD_VISUALS[id] ?? unoVisual;
