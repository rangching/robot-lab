import { missionsFor } from '../bench/missions';
import { boardProgress, type ProgressState } from './store';
import { boardData } from '../../data/boards/registry';
import type { BoardId } from '../../data/types';

export const LESSON_SECTIONS = [
  { id: 'overview', title: '一句話認識它' },
  { id: 'specs', title: '規格' },
  { id: 'parts', title: '板上零件' },
  { id: 'pros', title: '優點與陷阱' },
  { id: 'pins', title: '腳位' },
  { id: 'code', title: '第一支程式' },
  { id: 'projects', title: '適合的專題' },
  { id: 'facts', title: '小知識' },
];

export const QUIZ_TOTAL = 6;

type P = Pick<ProgressState, 'boards' | 'missionsDone' | 'missionSteps'>;

export function completion(p: P, board: BoardId) {
  const bp = boardProgress(p, board);
  const ms = missionsFor(board);
  const lesson = bp.lessonRead.length / LESSON_SECTIONS.length;
  const quiz = Math.min(1, bp.quizBest / QUIZ_TOTAL);
  const asm = bp.assemblyDone ? 1 : 0;
  const totalSteps = ms.reduce((n, m) => n + m.steps.length, 0);
  const doneSteps = ms.reduce((n, m) => n + Math.min(m.steps.length, p.missionSteps[m.id] ?? 0), 0);
  const missions = totalSteps ? doneSteps / totalSteps : 1;
  const pct = lesson * 0.2 + quiz * 0.15 + asm * 0.15 + missions * 0.5;
  return { pct, lesson, quiz, asm, missions, doneSteps, totalSteps };
}

export type NextAction = { text: string; cta: string; target: 'bench' | 'lesson' | 'quiz' | 'assembly' | 'compare'; mission?: string };

export function nextAction(p: P, board: BoardId): NextAction {
  const bp = boardProgress(p, board);
  const ms = missionsFor(board);
  const name = boardData(board).short;
  const firstOpen = ms.find((m) => !p.missionsDone.includes(m.id));
  const first = ms[0];
  if (first && !p.missionsDone.includes(first.id)) return { text: `先完成 ${name} 的工作台任務 1：${first.title}。`, cta: '開始任務 1', target: 'bench', mission: first.id };
  if (bp.lessonRead.length < 3) return { text: `讀幾段課程，認識 ${name} 上的零件和腳位。`, cta: '去讀課程', target: 'lesson' };
  if (bp.quizBest === 0) return { text: '來場一分鐘的找零件測驗，看看你認得幾個零件。', cta: '開始測驗', target: 'quiz' };
  if (firstOpen && ms.indexOf(firstOpen) <= 2) return { text: `繼續工作台任務 ${firstOpen.num}：${firstOpen.title}。`, cta: `前往任務 ${firstOpen.num}`, target: 'bench', mission: firstOpen.id };
  if (!bp.assemblyDone) return { text: `把 ${name} 拆開，再一個零件一個零件焊回去。`, cta: '開始組裝', target: 'assembly' };
  if (firstOpen) return { text: `繼續工作台任務 ${firstOpen.num}：${firstOpen.title}。`, cta: `前往任務 ${firstOpen.num}`, target: 'bench', mission: firstOpen.id };
  if (bp.lessonRead.length < LESSON_SECTIONS.length) return { text: '還有幾段課程沒讀完，讀完拿「讀完說明書」徽章。', cta: '讀完課程', target: 'lesson' };
  if (bp.quizBest < QUIZ_TOTAL) return { text: `挑戰找零件測驗 ${QUIZ_TOTAL} 題全對，拿「一眼認出」徽章。`, cta: '挑戰滿分', target: 'quiz' };
  return { text: `${name} 全部完成！到上方換一塊板子，或到自由建構玩玩看。`, cta: '自由建構', target: 'bench', mission: 'free' };
}
