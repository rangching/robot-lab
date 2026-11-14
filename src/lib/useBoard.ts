import { boardData, type BoardData } from '../data/boards/registry';
import { useProgress } from '../features/progress/store';

/** 目前選的板子資料（React hook） */
export function useBoard(): BoardData {
  const id = useProgress((s) => s.board);
  return boardData(id);
}

/** 非 React 環境取得目前板子 */
export const currentBoard = (): BoardData => boardData(useProgress.getState().board);
