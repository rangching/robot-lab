import { useLab, scrollToId } from '../../lib/labStore';
import { useBench, type MissionId } from '../bench/benchStore';
import type { NextAction } from '../progress/completion';

export function go(target: NextAction['target'], mission?: string) {
  if (target === 'bench') {
    if (mission && useBench.getState().missionId !== mission) useBench.getState().loadMission(mission as MissionId);
    scrollToId('bench');
  } else if (target === 'quiz') {
    useLab.getState().setMode('quiz');
    scrollToId('uno');
  } else if (target === 'assembly') {
    useLab.getState().setMode('assembly');
    scrollToId('uno');
  } else {
    scrollToId(target);
  }
}
