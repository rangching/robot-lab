import { MISSIONS } from '../bench/missions';
import type { ProgressState } from './store';

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

type P = Pick<ProgressState, 'lessonRead' | 'quizBest' | 'assemblyDone' | 'missionsDone' | 'missionSteps'>;

export function completion(p: P) {
  const lesson = p.lessonRead.length / LESSON_SECTIONS.length;
  const quiz = Math.min(1, p.quizBest / 6);
  const asm = p.assemblyDone ? 1 : 0;
  const totalSteps = MISSIONS.reduce((n, m) => n + m.steps.length, 0);
  const doneSteps = MISSIONS.reduce((n, m) => n + Math.min(m.steps.length, p.missionSteps[m.id] ?? 0), 0);
  const missions = doneSteps / totalSteps;
  const pct = lesson * 0.2 + quiz * 0.15 + asm * 0.15 + missions * 0.5;
  return { pct, lesson, quiz, asm, missions, doneSteps, totalSteps };
}

export type NextAction = { text: string; cta: string; target: 'bench' | 'lesson' | 'quiz' | 'assembly' | 'compare'; mission?: string };

export function nextAction(p: P): NextAction {
  const firstOpen = MISSIONS.find((m) => !p.missionsDone.includes(m.id));
  if (!p.missionsDone.includes('m1')) return { text: '先完成工作台任務 1：讓 L 燈閃起來，不用接任何線。', cta: '開始任務 1', target: 'bench', mission: 'm1' };
  if (p.lessonRead.length < 3) return { text: '讀幾段課程，認識板子上的零件和腳位。', cta: '去讀課程', target: 'lesson' };
  if (p.quizBest === 0) return { text: '來場一分鐘的找零件測驗，看看你認得幾個零件。', cta: '開始測驗', target: 'quiz' };
  if (firstOpen && ['m2', 'm3'].includes(firstOpen.id)) return { text: `繼續工作台任務 ${firstOpen.num}：${firstOpen.title}。`, cta: `前往任務 ${firstOpen.num}`, target: 'bench', mission: firstOpen.id };
  if (!p.assemblyDone) return { text: '把 Uno 拆開，再一個零件一個零件焊回去。', cta: '開始組裝', target: 'assembly' };
  if (firstOpen) return { text: `繼續工作台任務 ${firstOpen.num}：${firstOpen.title}。`, cta: `前往任務 ${firstOpen.num}`, target: 'bench', mission: firstOpen.id };
  if (p.lessonRead.length < LESSON_SECTIONS.length) return { text: '還有幾段課程沒讀完，讀完拿「讀完說明書」徽章。', cta: '讀完課程', target: 'lesson' };
  if (p.quizBest < 6) return { text: '挑戰找零件測驗 6 題全對，拿「一眼認出」徽章。', cta: '挑戰滿分', target: 'quiz' };
  return { text: 'Uno 全部完成！下一塊板子即將解鎖，先到自由建構玩玩看。', cta: '自由建構', target: 'bench', mission: 'free' };
}
