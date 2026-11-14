import { describe, expect, it } from 'vitest';
import { judge, quizXpGain, scoreOf, starsOf, pickQuestions } from './quiz/quizLogic';
import { levelOf, LEVELS } from './progress/levels';
import { dayDiff } from './progress/store';
import { snapOk } from './assembly/useAssembly';
import { unoLesson } from '../data/boards/uno';

describe('測驗計分', () => {
  it('只有第一次答對且沒看提示才算分', () => {
    expect(judge(true, false)).toBe('ok');
    expect(judge(false, false)).toBe('miss');
    expect(judge(true, true)).toBe('miss');
  });
  it('星等與分數', () => {
    expect(scoreOf(['ok', 'miss', 'ok'])).toBe(2);
    expect(starsOf(6, 6)).toBe(3);
    expect(starsOf(4, 6)).toBe(2);
    expect(starsOf(2, 6)).toBe(1);
    expect(starsOf(0, 6)).toBe(0);
  });
  it('只有刷新紀錄才給 XP', () => {
    expect(quizXpGain(0, 4)).toBe(60);
    expect(quizXpGain(4, 3)).toBe(0);
    expect(quizXpGain(4, 6)).toBe(30);
  });
  it('出題不重複', () => {
    const qs = pickQuestions(unoLesson.quiz, 6);
    expect(qs).toHaveLength(6);
    expect(new Set(qs.map((q) => q.part)).size).toBe(6);
  });
  it('每題答案都是存在的零件', () => {
    const ids = new Set(unoLesson.parts.map((p) => p.id));
    unoLesson.quiz.forEach((q) => expect(ids.has(q.part)).toBe(true));
  });
});

describe('等級', () => {
  it('門檻正確', () => {
    expect(levelOf(0).index).toBe(0);
    expect(levelOf(149).index).toBe(0);
    expect(levelOf(150).index).toBe(1);
    expect(levelOf(99999).index).toBe(LEVELS.length - 1);
    expect(levelOf(99999).pct).toBe(1);
  });
  it('連續天數的日期差', () => {
    expect(dayDiff('2026-11-13', '2026-11-14')).toBe(1);
    expect(dayDiff('2026-10-31', '2026-11-01')).toBe(1);
  });
});

describe('組裝吸附', () => {
  it('靠近正確位置才吸附', () => {
    const mcu = unoLesson.parts.find((p) => p.id === 'mcu')!;
    expect(snapOk('mcu', mcu.at[0] + 0.3, mcu.at[2])).toBe(true);
    expect(snapOk('mcu', mcu.at[0] + 2, mcu.at[2])).toBe(false);
  });
});
