import { useCallback, useRef, useState } from 'react';
import { unoLesson } from '../../data/boards/uno';
import type { QuizQ } from '../../data/types';
import { judge, pickQuestions, quizXpGain, scoreOf, type QResult } from './quizLogic';
import { sfx } from '../music/sfx';
import { useProgress } from '../progress/store';

export const QUIZ_N = 6;
const NAME = Object.fromEntries(unoLesson.parts.map((p) => [p.id, p.name]));

export interface Feedback { kind: 'ok' | 'bad' | 'info'; text: string }

export function useQuiz(flyTo: (id: string) => void) {
  const [qs, setQs] = useState<QuizQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<QResult[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const st = useRef({ firstTry: true, hintUsed: false, locked: false });
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const start = useCallback(() => {
    clearTimers();
    setQs(pickQuestions(unoLesson.quiz, QUIZ_N));
    setIdx(0);
    setResults([]);
    setFeedback(null);
    setFlash({});
    setDone(false);
    st.current = { firstTry: true, hintUsed: false, locked: false };
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    setQs([]);
    setDone(false);
    setFlash({});
    setFeedback(null);
  }, []);

  const finish = (res: QResult[]) => {
    setDone(true);
    const score = scoreOf(res);
    const p = useProgress.getState();
    const gain = quizXpGain(p.quizBest, score);
    p.award('quiz-first-run', 20, '完成第一次找零件測驗');
    if (gain > 0) p.award(`quiz-best-${score}`, gain, `測驗新紀錄 ${score}/${QUIZ_N}`);
    p.setQuizBest(score);
    if (score === QUIZ_N) p.grantBadge('quiz-perfect');
  };

  const next = (res: QResult[]) => {
    setFlash({});
    setFeedback(null);
    st.current = { firstTry: true, hintUsed: false, locked: false };
    if (res.length >= qs.length) finish(res);
    else setIdx(res.length);
  };

  const onPartClick = (id: string) => {
    const q = qs[idx];
    if (!q || done || st.current.locked) return;
    if (id === q.part) {
      const r = judge(st.current.firstTry, st.current.hintUsed);
      const res = [...results, r];
      setResults(res);
      st.current.locked = true;
      sfx('correct');
      setFlash({ [id]: '#22c55e' });
      setFeedback({ kind: 'ok', text: (r === 'ok' ? '答對了！' : '找到了（這題不計分）。') + q.explain });
      later(() => next(res), 1900);
    } else {
      st.current.firstTry = false;
      sfx('wrong');
      setFlash((f) => ({ ...f, [id]: '#f43f5e' }));
      setFeedback({ kind: 'bad', text: `那是「${NAME[id]}」，再找找看！` });
      later(() => setFlash((f) => { const n = { ...f }; delete n[id]; return n; }), 800);
    }
  };

  const hint = () => {
    const q = qs[idx];
    if (!q || st.current.locked) return;
    st.current.hintUsed = true;
    setFlash({ [q.part]: '#f59e0b' });
    setFeedback({ kind: 'info', text: `提示：${q.hint}` });
  };

  const skip = () => {
    const q = qs[idx];
    if (!q || st.current.locked) return;
    st.current.locked = true;
    const res: QResult[] = [...results, 'miss'];
    setResults(res);
    setFlash({ [q.part]: '#0ea5e9' });
    flyTo(q.part);
    setFeedback({ kind: 'info', text: `答案是「${NAME[q.part]}」。${q.explain}` });
    later(() => next(res), 2600);
  };

  return {
    active: qs.length > 0,
    q: qs[idx] as QuizQ | undefined,
    idx,
    total: qs.length,
    results,
    feedback,
    flash,
    done,
    score: scoreOf(results),
    start,
    stop,
    onPartClick,
    hint,
    skip,
  };
}
