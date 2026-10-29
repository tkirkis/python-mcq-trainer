import { describe, expect, it } from 'vitest';
import type { AnswerEv, ChapterId, Ev, Question } from '../src/types';
import { scoreQuestion, isCorrect } from '../src/lib/scoring';
import { applyAnswer, derive, dueQuestions, estimateScore, questionStatus, BLUEPRINTS, DEFAULT_SETTINGS, streak } from '../src/lib/derive';
import { buildMock, rng, smartSet, learnOrder } from '../src/lib/select';

const S = DEFAULT_SETTINGS.scoring;

function q(id: string, extra: Partial<Question> = {}): Question {
  return {
    id,
    chapter: 'S1',
    topic: 'strings',
    tags: [],
    type: 'single',
    difficulty: 1,
    source: 'generated',
    stem: 'stem',
    code: null,
    options: ['a', 'b', 'c', 'd'].map((o) => ({ id: o, text: o })),
    correct: ['b'],
    explanation: 'x',
    notes: {},
    slides: [1],
    verified: 'exec',
    ...extra,
  };
}

let n = 0;
function ans(qid: string, ok: boolean, ts: number, extra: Partial<AnswerEv> = {}): AnswerEv {
  return { id: `d-${ts}-${n++}`, ts, dev: 'd', t: 'ans', q: qid, ch: ok ? ['b'] : ['a'], ok, ms: 1000, mode: 'practice', ...extra };
}

describe('answer checking and scoring', () => {
  const single = q('s');
  const multi = q('m', { type: 'multi', correct: ['a', 'c'] });

  it('single choice: right / wrong / I don\'t know', () => {
    expect(isCorrect(single, ['b'])).toBe(true);
    expect(scoreQuestion(single, ['b'], false, S)).toBe(1);
    expect(scoreQuestion(single, ['a'], false, S)).toBe(0);
    expect(scoreQuestion(single, [], true, S)).toBe(0);
  });

  it('negative marking applies to wrong answers only', () => {
    const neg = { ...S, wrong: -0.25 };
    expect(scoreQuestion(single, ['a'], false, neg)).toBe(-0.25);
    expect(scoreQuestion(single, [], true, neg)).toBe(0);
  });

  it('multi all-or-nothing needs the exact set', () => {
    expect(isCorrect(multi, ['c', 'a'])).toBe(true);
    expect(scoreQuestion(multi, ['a', 'c'], false, S)).toBe(1);
    expect(scoreQuestion(multi, ['a'], false, S)).toBe(0);
    expect(scoreQuestion(multi, ['a', 'b', 'c'], false, S)).toBe(0);
  });

  it('multi partial credit: (right - wrong) / #correct, floored at 0', () => {
    const p = { ...S, multi: 'partial' as const };
    expect(scoreQuestion(multi, ['a'], false, p)).toBe(0.5);
    expect(scoreQuestion(multi, ['a', 'c'], false, p)).toBe(1);
    expect(scoreQuestion(multi, ['a', 'b'], false, p)).toBe(0);
    expect(scoreQuestion(multi, ['a', 'b'], false, { ...p, wrong: -0.25 })).toBe(-0.25);
  });
});

describe('spaced repetition (Leitner)', () => {
  const DAY = 86_400_000;
  const t0 = new Date(2026, 0, 10, 9, 0).getTime();

  it('a correct first answer does not enter the queue', () => {
    const d = derive([ans('x', true, t0)]);
    expect(d.q.get('x')!.inQueue).toBe(false);
    expect(questionStatus(d.q.get('x'))).toBe('mastered');
  });

  it('wrong / idk / guessed answers enter the queue, due in 10 minutes', () => {
    for (const e of [ans('x', false, t0), ans('x', true, t0, { idk: true, ok: false }), ans('x', true, t0, { conf: 1 })]) {
      const s = applyAnswer(undefined, e);
      expect(s.inQueue).toBe(true);
      expect(s.box).toBe(1);
      expect(s.due).toBe(t0 + 10 * 60_000);
    }
  });

  it('correct reviews promote through 1, 3, 7, 16 days then graduate', () => {
    let s = applyAnswer(undefined, ans('x', false, t0));
    const expected = [1, 3, 7, 16];
    let t = t0;
    for (const days of expected) {
      t = s.due;
      s = applyAnswer(s, ans('x', true, t));
      expect(s.due - t).toBe(days * DAY);
    }
    s = applyAnswer(s, ans('x', true, s.due));
    expect(s.inQueue).toBe(false);
    expect(questionStatus(s)).toBe('mastered');
  });

  it('a lapse sends the card back to box 1', () => {
    let s = applyAnswer(undefined, ans('x', false, t0));
    s = applyAnswer(s, ans('x', true, s.due));
    s = applyAnswer(s, ans('x', false, s.due));
    expect(s.box).toBe(1);
    expect(s.lapses).toBe(2);
  });

  it('due list respects the day horizon', () => {
    const d = derive([ans('x', false, t0), ans('y', false, t0)]);
    expect(dueQuestions(d, t0 + 60_000).sort()).toEqual(['x', 'y']);
    const d2 = derive([ans('x', false, t0), ans('x', true, t0 + 20 * 60_000)]); // promoted: due tomorrow
    expect(dueQuestions(d2, t0 + 30 * 60_000)).toEqual([]);
    expect(dueQuestions(d2, t0 + 30 * 60_000 + DAY)).toEqual(['x']);
  });

  it('streak counts consecutive active days', () => {
    const evs = [0, 1, 2].map((k) => ans('x', true, t0 - k * DAY));
    expect(streak(derive(evs), t0)).toBe(3);
    expect(streak(derive(evs), t0 + DAY)).toBe(3); // today not active yet: still alive
    expect(streak(derive(evs), t0 + 2 * DAY)).toBe(0);
  });

  it('reset events hide older progress', () => {
    const evs: Ev[] = [ans('x', false, t0), { id: 'r', ts: t0 + 1, dev: 'd', t: 'reset' }, ans('y', true, t0 + 2)];
    const d = derive(evs);
    expect(d.q.has('x')).toBe(false);
    expect(d.q.has('y')).toBe(true);
  });

  it('settings are last-writer-wins in canonical order, merged per key', () => {
    const evs: Ev[] = [
      { id: 'a', ts: 1, dev: 'd1', t: 'set', k: 'scoring', v: { wrong: -0.25 } },
      { id: 'b', ts: 2, dev: 'd2', t: 'set', k: 'scoring', v: { multi: 'partial' } },
      { id: 'c', ts: 3, dev: 'd1', t: 'set', k: 'dailyGoal', v: 50 },
    ];
    const s = derive(evs).settings;
    expect(s.scoring).toEqual({ correct: 1, wrong: -0.25, idk: 0, multi: 'partial' });
    expect(s.dailyGoal).toBe(50);
  });
});

describe('estimated score', () => {
  it('is wide with no data and centred on the accuracy with lots of data', () => {
    const qs = Array.from({ length: 50 }, (_, i) => q(`q${i}`, { chapter: (['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as ChapterId[])[i % 8] }));
    const qm = new Map(qs.map((x) => [x.id, x]));
    const now = Date.now();
    const empty = estimateScore(derive([]), qm, BLUEPRINTS.full, now);
    expect(empty.enough).toBe(false);
    expect(empty.mean).toBeCloseTo(20, 5);
    const evs = qs.flatMap((x, i) => [0, 1, 2, 3].map((k) => ans(x.id, (i + k) % 4 !== 0, now - k * 1000)));
    const e = estimateScore(derive(evs), qm, BLUEPRINTS.full, now);
    expect(e.enough).toBe(true);
    expect(e.mean).toBeGreaterThan(26);
    expect(e.mean).toBeLessThan(32);
    expect(e.high - e.low).toBeLessThan(empty.high - empty.low);
  });
});

describe('question selection', () => {
  const chapters: ChapterId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
  const bank: Question[] = [];
  let k = 0;
  for (const ch of chapters)
    for (let i = 0; i < 40; i++)
      bank.push(q(`${ch}-${String(k++).padStart(4, '0')}`, { chapter: ch, difficulty: ((i % 3) + 1) as 1 | 2 | 3, type: i % 6 === 0 ? 'multi' : 'single', topic: `t${i % 4}` }));
  bank.push(...Array.from({ length: 40 }, (_, i) => q(`PE-${String(i + 1).padStart(2, '0')}`, { source: 'past_exam' })));

  it('mock "same as last year" follows the blueprint', () => {
    const m = buildMock(bank, derive([]), 'last_year', rng(1));
    expect(m).toHaveLength(40);
    expect(new Set(m.map((x) => x.id)).size).toBe(40);
    const per: Record<string, number> = {};
    for (const x of m) per[x.chapter] = (per[x.chapter] ?? 0) + 1;
    const pe = m.filter((x) => x.source === 'past_exam').length;
    expect(per.S1 - pe).toBeLessThanOrEqual(16);
    expect(per.S2).toBe(10);
    expect(per.S5).toBe(6);
    expect(per.S6 ?? 0).toBe(0);
    expect(m.filter((x) => x.type === 'multi')).toHaveLength(4);
  });

  it('mock "full syllabus" covers all chapters with 6 multi-select', () => {
    const m = buildMock(bank, derive([]), 'full', rng(2));
    expect(m).toHaveLength(40);
    expect(new Set(m.map((x) => x.chapter)).size).toBe(8);
    expect(m.filter((x) => x.type === 'multi')).toHaveLength(6);
  });

  it('hard mode is mostly difficulty 3', () => {
    const m = buildMock(bank, derive([]), 'hard', rng(3));
    expect(m.filter((x) => x.difficulty === 3).length).toBeGreaterThanOrEqual(16);
  });

  it('avoids questions used in previous mocks until the pool runs out', () => {
    const first = buildMock(bank, derive([]), 'full', rng(4));
    const mockEv: Ev = {
      id: 'm1', ts: 1, dev: 'd', t: 'mock', mid: 'm1', variant: 'full', score: 0, max: 40, ms: 0, limit: 0, started: 0,
      items: first.map((x) => ({ q: x.id, ch: [], ok: false, pts: 0 })), scoring: S,
    };
    const second = buildMock(bank, derive([mockEv]), 'full', rng(5));
    const overlap = second.filter((x) => first.some((y) => y.id === x.id));
    expect(overlap).toHaveLength(0);
  });

  it('reference replay returns the past exam in page order', () => {
    const m = buildMock(bank, derive([]), 'reference', rng(1));
    expect(m.map((x) => x.id).slice(0, 3)).toEqual(['PE-01', 'PE-02', 'PE-03']);
    expect(m).toHaveLength(40);
  });

  it('learn mode serves unseen questions easy -> hard', () => {
    const qs = bank.filter((x) => x.chapter === 'S2');
    const order = learnOrder(qs, derive([]));
    const diffs = order.map((x) => x.difficulty);
    expect([...diffs].sort()).toEqual(diffs);
  });

  it('smart practice puts due reviews first and has no duplicates', () => {
    const t = Date.now();
    const d = derive([ans('S3-0080', false, t - 3_600_000), ans('S3-0081', false, t - 3_600_000)]);
    const s = smartSet(bank, d, t, rng(9));
    expect(s).toHaveLength(10);
    expect(new Set(s.map((x) => x.id)).size).toBe(10);
    expect(s.map((x) => x.id)).toEqual(expect.arrayContaining(['S3-0080', 'S3-0081']));
  });
});
