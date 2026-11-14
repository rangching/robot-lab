export type QResult = 'ok' | 'miss';

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickQuestions<T>(pool: T[], n: number, rand: () => number = Math.random): T[] {
  return shuffle(pool, rand).slice(0, Math.min(n, pool.length));
}

/** 只有「第一次就點對、沒看提示」才算分 */
export function judge(firstTry: boolean, hintUsed: boolean): QResult {
  return firstTry && !hintUsed ? 'ok' : 'miss';
}

export const scoreOf = (r: QResult[]) => r.filter((x) => x === 'ok').length;

export function starsOf(score: number, total: number): number {
  if (total <= 0) return 0;
  const f = score / total;
  if (f >= 1) return 3;
  if (f >= 0.66) return 2;
  if (f >= 0.33) return 1;
  return 0;
}

/** 新紀錄才給 XP：每多答對一題 15 XP */
export function quizXpGain(prevBest: number, score: number) {
  return Math.max(0, score - prevBest) * 15;
}
