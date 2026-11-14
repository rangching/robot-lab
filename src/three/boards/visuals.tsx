import type { BoardId } from '../../data/types';
import type { BoardVisual } from './visualTypes';
import { unoVisual } from './unoVisual';
import { nanoVisual } from './nanoVisual';
import { megaVisual } from './megaVisual';
import { esp32Visual } from './esp32Visual';

export type { BoardVisual, Lights } from './visualTypes';

export const BOARD_VISUALS: Partial<Record<BoardId, BoardVisual>> = {
  uno: unoVisual,
  nano: nanoVisual,
  mega: megaVisual,
  esp32: esp32Visual,
};

export const boardVisual = (id: BoardId): BoardVisual => BOARD_VISUALS[id] ?? unoVisual;
