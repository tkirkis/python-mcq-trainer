// Question selection: learn order, practice filters, smart practice and mock-exam blueprints.
import type { ChapterId, MockVariant, Question } from '../types';
import { BLUEPRINTS, dueQuestions, masteryBy, questionStatus, type Derived } from './derive';

/** Small deterministic PRNG (mulberry32) so selections are reproducible in tests. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Learn mode: unseen first, easy -> hard, past-exam and generated interleaved (stable order). */
export function learnOrder(qs: Question[], d: Derived): Question[] {
  const rank = (q: Question) => {
    const st = questionStatus(d.q.get(q.id));
    return st === 'new' ? 0 : st === 'learning' ? 1 : st === 'seen' ? 2 : 3;
  };
  return [...qs].sort((a, b) => rank(a) - rank(b) || a.difficulty - b.difficulty || hash(a.id) - hash(b.id));
}

export interface PracticeFilter {
  chapters: ChapterId[]; // empty = all
  topic?: string;
  difficulty?: 1 | 2 | 3;
  type?: 'single' | 'multi';
  pool: 'all' | 'weak' | 'due' | 'past' | 'unseen' | 'missed';
  size: number; // 0 = endless (all matching)
}

export function practiceSet(all: Question[], d: Derived, f: PracticeFilter, now: number, rand: () => number): Question[] {
  let qs = all.filter(
    (q) =>
      (f.chapters.length === 0 || f.chapters.includes(q.chapter)) &&
      (!f.topic || q.topic === f.topic) &&
      (!f.difficulty || q.difficulty === f.difficulty) &&
      (!f.type || q.type === f.type),
  );
  if (f.pool === 'past') qs = qs.filter((q) => q.source === 'past_exam');
  if (f.pool === 'unseen') qs = qs.filter((q) => !d.q.has(q.id));
  if (f.pool === 'missed') qs = qs.filter((q) => (d.q.get(q.id)?.lapses ?? 0) > 0);
  if (f.pool === 'due') {
    const due = new Set(dueQuestions(d, now));
    qs = qs.filter((q) => due.has(q.id));
  }
  if (f.pool === 'weak') {
    const qById = new Map(all.map((q) => [q.id, q]));
    const m = masteryBy(d, qById, (q) => q.topic, now);
    // weakest topics first (unknown topics count as 0.5), questions not mastered
    qs = qs
      .filter((q) => questionStatus(d.q.get(q.id)) !== 'mastered')
      .sort((a, b) => (m.get(a.topic)?.p ?? 0.5) - (m.get(b.topic)?.p ?? 0.5) || rand() - 0.5);
    return f.size ? qs.slice(0, f.size) : qs;
  }
  qs = shuffle(qs, rand);
  return f.size ? qs.slice(0, f.size) : qs;
}

/**
 * Smart practice (~10 min): due reviews first, then the weakest topics, then a few new questions.
 */
export function smartSet(all: Question[], d: Derived, now: number, rand: () => number, size = 10): Question[] {
  const byId = new Map(all.map((q) => [q.id, q]));
  const picked = new Map<string, Question>();
  const add = (q: Question | undefined) => {
    if (q && picked.size < size && !picked.has(q.id)) picked.set(q.id, q);
  };
  for (const id of dueQuestions(d, now).slice(0, Math.ceil(size / 2))) add(byId.get(id));

  const m = masteryBy(d, byId, (q) => q.topic, now);
  const topics = [...new Set(all.map((q) => q.topic))];
  const weakTopics = topics
    .map((t) => ({ t, p: m.get(t)?.p ?? 0.45, n: m.get(t)?.answered ?? 0 }))
    .sort((a, b) => a.p - b.p || a.n - b.n || rand() - 0.5)
    .slice(0, 4)
    .map((x) => x.t);
  for (const t of weakTopics) {
    const cand = shuffle(
      all.filter((q) => q.topic === t && questionStatus(d.q.get(q.id)) !== 'mastered'),
      rand,
    );
    add(cand[0]);
    if (picked.size >= size - 2) break;
  }
  for (const q of shuffle(all.filter((q) => !d.q.has(q.id)), rand)) add(q);
  for (const q of shuffle(all, rand)) add(q);
  return shuffle([...picked.values()], rand);
}

// ------------------------------------------------------------------ mock exams
export interface MockSpec {
  variant: MockVariant;
  minutes: number;
  label: string;
  description: string;
}

export const MOCK_MIX: Record<Exclude<MockVariant, 'reference'>, { multi: number; diff: [number, number, number] }> = {
  last_year: { multi: 4, diff: [0.5, 0.45, 0.05] },
  full: { multi: 6, diff: [0.4, 0.45, 0.15] },
  hard: { multi: 8, diff: [0.1, 0.4, 0.5] },
};

function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const base = raw.map(Math.floor);
  let rest = total - base.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    base[i]++;
    rest--;
  }
  return base;
}

/**
 * Build a 40-question mock following the exam blueprint (chapter counts, difficulty mix,
 * number of multi-select). Questions used in earlier mocks are avoided until the pool runs out.
 */
export function buildMock(all: Question[], d: Derived, variant: MockVariant, rand: () => number): Question[] {
  if (variant === 'reference') {
    const pe = all.filter((q) => q.source === 'past_exam');
    const key = (id: string) => {
      const m = id.match(/^PE-(\d+)([a-z]?)$/);
      return m ? Number(m[1]) * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0) : 0;
    };
    return pe.sort((a, b) => key(a.id) - key(b.id));
  }
  const blueprint = variant === 'last_year' ? BLUEPRINTS.last_year : BLUEPRINTS.full;
  const mix = MOCK_MIX[variant];
  const chapters = Object.keys(blueprint) as ChapterId[];
  const counts = chapters.map((c) => blueprint[c]!);
  const multiPerCh = apportion(mix.multi, counts);
  const freshness = (q: Question) => d.usedInMocks.get(q.id) ?? -1; // -1 = never used: preferred
  const result: Question[] = [];

  chapters.forEach((ch, i) => {
    const n = counts[i];
    const pool = shuffle(all.filter((q) => q.chapter === ch), rand).sort((a, b) => freshness(a) - freshness(b));
    const take = (cands: Question[], k: number) => {
      const chosen: Question[] = [];
      const diffTargets = apportion(k, mix.diff);
      for (const dlev of [1, 2, 3] as const) {
        for (const q of cands) {
          if (chosen.filter((x) => x.difficulty === dlev).length >= diffTargets[dlev - 1]) break;
          if (q.difficulty === dlev && !chosen.includes(q) && !result.includes(q)) chosen.push(q);
        }
      }
      for (const q of cands) {
        // not enough questions of the wanted difficulty: fill with anything fresh
        if (chosen.length >= k) break;
        if (!chosen.includes(q) && !result.includes(q)) chosen.push(q);
      }
      return chosen.slice(0, k);
    };
    const multis = take(pool.filter((q) => q.type === 'multi'), Math.min(multiPerCh[i], n));
    const singles = take(pool.filter((q) => q.type === 'single'), n - multis.length);
    result.push(...multis, ...singles);
    if (multis.length + singles.length < n) {
      for (const q of pool) {
        if (result.filter((x) => x.chapter === ch).length >= n) break;
        if (!result.includes(q)) result.push(q);
      }
    }
  });
  return shuffle(result, rand);
}
