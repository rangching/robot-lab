import { useLab, scrollToId } from '../../lib/labStore';
import { useBench, type MissionId } from '../bench/benchStore';
import { useProgress } from '../progress/store';
import { boardData } from '../../data/boards/registry';
import { setSimBoard } from '../../sim/board';
import { missionsFor } from '../bench/missions';
import { sfx } from '../music/sfx';
import type { BoardId } from '../../data/types';
import type { NextAction } from '../progress/completion';

/** 讓模擬器與工作台跟上目前選的板子（開站時也要呼叫一次） */
export function syncBoard() {
  const id = useProgress.getState().board;
  const data = boardData(id);
  setSimBoard(data);
  const bench = useBench.getState();
  if (bench.board !== id) bench.setBoard(id);
}

/** 換板子：3D 檢視回到檢視模式、工作台換成這塊板子的第一個任務 */
export function switchBoard(id: BoardId, scroll = true) {
  const p = useProgress.getState();
  if (p.board !== id) {
    p.setBoard(id);
    useLab.getState().setMode('explore');
    useLab.getState().select(null);
    useLab.getState().setExplode(0);
    syncBoard();
    sfx('snap');
  }
  if (scroll) scrollToId('board');
}

export function go(target: NextAction['target'], mission?: string) {
  if (target === 'bench') {
    const valid = mission === 'free' || missionsFor(useProgress.getState().board).some((m) => m.id === mission);
    if (mission && valid && useBench.getState().missionId !== mission) useBench.getState().loadMission(mission as MissionId);
    scrollToId('bench');
  } else if (target === 'quiz') {
    useLab.getState().setMode('quiz');
    scrollToId('board');
  } else if (target === 'assembly') {
    useLab.getState().setMode('assembly');
    scrollToId('board');
  } else {
    scrollToId(target);
  }
}
