import { describe, expect, it } from 'vitest';
import { judge, quizXpGain, scoreOf, starsOf, pickQuestions } from './quiz/quizLogic';
import { levelOf, LEVELS } from './progress/levels';
import { dayDiff } from './progress/store';
import { snapOk } from './assembly/useAssembly';
import { unoLesson } from '../data/boards/uno';
import { nanoLesson } from '../data/boards/nano';
import { unoData, nanoData, BOARD_DATA } from '../data/boards/registry';
import { asmParts } from './assembly/useAssembly';
import { completion, nextAction } from './progress/completion';
import { missionsFor } from './bench/missions';
import { BADGES } from './progress/badges';
import { freePrograms } from '../sim/programs';

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
    expect(snapOk(unoData, 'mcu', mcu.at[0] + 0.3, mcu.at[2])).toBe(true);
    expect(snapOk(unoData, 'mcu', mcu.at[0] + 2, mcu.at[2])).toBe(false);
  });
  it('Nano 的背面零件不進組裝，正面零件都有托盤位置', () => {
    const ids = asmParts(nanoData).map((p) => p.id);
    expect(ids).not.toContain('u2');
    expect(ids).toContain('hdrF');
    nanoLesson.parts.filter((p) => p.side !== 'bottom').forEach((p) => expect(nanoData.tray[p.id]).toBeTruthy());
  });
});

describe('每塊板子的資料一致', () => {
  for (const b of Object.values(BOARD_DATA)) {
    it(`${b!.short}：零件、題目、外框、腳位`, () => {
      const L = b!.lesson;
      const ids = new Set(L.parts.map((p) => p.id));
      expect(L.quiz.length).toBeGreaterThanOrEqual(6);
      L.quiz.forEach((q) => expect(ids.has(q.part)).toBe(true));
      L.parts.forEach((p, i) => expect(p.num).toBe(i + 1));
      L.parts.forEach((p) => expect(b!.footprints[p.id]).toBeTruthy());
      Object.keys(b!.tray).forEach((id) => expect(ids.has(id)).toBe(true));
      const pinIds = b!.pins.map((p) => p.id);
      expect(new Set(pinIds).size).toBe(pinIds.length);
      [...b!.supply, ...b!.gnd, ...b!.analogOnly, ...b!.internalNets.flat()].forEach((id) => expect(pinIds).toContain(id));
      // 範例程式用到的腳位都要存在
      for (const prog of freePrograms(b!.id)) prog.outputs.forEach((o) => expect(pinIds).toContain(o));
      // 腳位不能超出板子
      b!.pins.forEach((p) => { expect(Math.abs(p.x)).toBeLessThan(b!.w / 2); expect(Math.abs(p.z)).toBeLessThan(b!.d / 2); });
    });
  }
  it('Nano 有 30 支腳、A6／A7 是純類比', () => {
    expect(nanoData.pins).toHaveLength(30);
    expect(nanoData.analogOnly).toEqual(['A6', 'A7']);
  });
  it('任務的徽章都存在', () => {
    for (const b of Object.keys(BOARD_DATA) as (keyof typeof BOARD_DATA)[]) missionsFor(b).forEach((m) => expect(BADGES.some((x) => x.id === m.badge)).toBe(true));
  });
});

describe('每塊板子的完成度', () => {
  const empty = { boards: {}, missionsDone: [] as string[], missionSteps: {} as Record<string, number> };
  it('Nano 的完成度與 Uno 分開計算', () => {
    const p = { ...empty, boards: { uno: { lessonRead: ['overview', 'specs'], quizBest: 6, assemblyDone: true } } };
    expect(completion(p, 'uno').pct).toBeGreaterThan(0.3);
    expect(completion(p, 'nano').pct).toBe(0);
    expect(nextAction(p, 'nano').mission).toBe('n1');
  });
  it('Nano 全部完成時是 100%', () => {
    const ms = missionsFor('nano');
    const p = {
      boards: { nano: { lessonRead: ['overview', 'specs', 'parts', 'pros', 'pins', 'code', 'projects', 'facts'], quizBest: 6, assemblyDone: true } },
      missionsDone: ms.map((m) => m.id),
      missionSteps: Object.fromEntries(ms.map((m) => [m.id, m.steps.length])),
    };
    expect(completion(p, 'nano').pct).toBeCloseTo(1);
  });
});
