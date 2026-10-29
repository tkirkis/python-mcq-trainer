// Pure functions that rebuild every piece of progress state from the (sorted) event log.
// Because they only depend on the set of events, two devices holding the same events always
// show exactly the same review queue, mastery, streak and history.
import type { AnswerEv, Ev, MockEv, Question, Settings, ChapterId } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  scoring: { correct: 1, wrong: 0, idk: 0, multi: 'all' },
  theme: 'system',
  dailyGoal: 30,
  confidence: true,
  mockMinutes: 60,
  hardMinutes: 45,
};

const DAY = 86_400_000;
const MIN = 60_000;

/** Leitner boxes: after a lapse a card is in box 1 (due in 10 min); each correct answer promotes it. */
export const BOX_INTERVALS = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY];
export const GRADUATED_BOX = 6;

export interface QState {
  seen: number;
  correct: number;
  lastOk: boolean;
  lastTs: number;
  streak: number; // consecutive correct answers
  box: number; // 0 = never in review queue
  due: number;
  inQueue: boolean;
  lapses: number;
  totalMs: number;
}

export interface Derived {
  settings: Settings;
  q: Map<string, QState>;
  answers: AnswerEv[]; // after the latest reset
  mocks: MockEv[];
  views: { ch: string; topic?: string; ts: number }[];
  daysActive: Set<string>;
  answersByDay: Map<string, number>;
  usedInMocks: Map<string, number>; // qid -> last mock ts
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown>)?.[k], v);
  }
  return out as T;
}

/** "Effectively correct" = correct and not a self-declared guess. */
export function knew(a: AnswerEv): boolean {
  return a.ok && !a.idk && a.conf !== 1;
}

export function applyAnswer(s: QState | undefined, a: AnswerEv): QState {
  const st: QState = s
    ? { ...s }
    : { seen: 0, correct: 0, lastOk: false, lastTs: 0, streak: 0, box: 0, due: 0, inQueue: false, lapses: 0, totalMs: 0 };
  st.seen++;
  if (a.ok) st.correct++;
  st.lastOk = a.ok;
  st.lastTs = a.ts;
  st.totalMs += Math.min(a.ms || 0, 5 * MIN);
  if (knew(a)) {
    st.streak++;
    if (st.inQueue) {
      st.box = Math.min(st.box + 1, GRADUATED_BOX);
      if (st.box >= GRADUATED_BOX) {
        st.inQueue = false;
        st.due = 0;
      } else {
        st.due = a.ts + BOX_INTERVALS[st.box];
      }
    }
  } else {
    // wrong, "I don't know" or a lucky guess: the question enters (or re-enters) the review queue
    st.streak = 0;
    st.inQueue = true;
    st.box = 1;
    st.due = a.ts + BOX_INTERVALS[1];
    st.lapses++;
  }
  return st;
}

export function derive(events: Ev[]): Derived {
  let settings = DEFAULT_SETTINGS;
  let lastReset = -Infinity;
  for (const e of events) if (e.t === 'reset') lastReset = Math.max(lastReset, e.ts);
  const q = new Map<string, QState>();
  const answers: AnswerEv[] = [];
  const mocks: MockEv[] = [];
  const views: Derived['views'] = [];
  const daysActive = new Set<string>();
  const answersByDay = new Map<string, number>();
  const usedInMocks = new Map<string, number>();
  for (const e of events) {
    if (e.t === 'set') {
      // last writer wins, in canonical order: deterministic on every device
      settings = { ...settings, [e.k]: deepMerge((settings as unknown as Record<string, unknown>)[e.k], e.v) };
      continue;
    }
    if (e.ts <= lastReset) continue;
    if (e.t === 'ans') {
      answers.push(e);
      q.set(e.q, applyAnswer(q.get(e.q), e));
      const dk = dayKey(e.ts);
      daysActive.add(dk);
      answersByDay.set(dk, (answersByDay.get(dk) ?? 0) + 1);
    } else if (e.t === 'mock') {
      mocks.push(e);
      for (const it of e.items) usedInMocks.set(it.q, e.ts);
    } else if (e.t === 'view') {
      views.push({ ch: e.ch, topic: e.topic, ts: e.ts });
    }
  }
  return { settings, q, answers, mocks, views, daysActive, answersByDay, usedInMocks };
}

// ------------------------------------------------------------------ review queue
export function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function dueQuestions(d: Derived, now: number, horizon = endOfDay(now)): string[] {
  return [...d.q.entries()]
    .filter(([, s]) => s.inQueue && s.due <= horizon)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export type QStatus = 'new' | 'learning' | 'seen' | 'mastered';
export function questionStatus(s: QState | undefined): QStatus {
  if (!s) return 'new';
  if (s.inQueue) return 'learning';
  if ((s.box >= GRADUATED_BOX && s.lastOk) || (s.streak >= 2 && s.lastOk) || (s.lapses === 0 && s.lastOk)) return 'mastered';
  return 'seen';
}

// ------------------------------------------------------------------ mastery
export interface Mastery {
  p: number; // posterior mean probability of answering correctly
  n: number; // effective number of (recency/difficulty weighted) answers
  answered: number;
  a: number; // Beta alpha
  b: number; // Beta beta
}

const HALF_LIFE_DAYS = 14;
const DIFF_WEIGHT = { 1: 0.8, 2: 1, 3: 1.3 } as const;

export function masteryBy(
  d: Derived,
  qById: Map<string, Question>,
  key: (q: Question) => string,
  now: number,
  /** true: lucky guesses count as not known (study priorities); false: raw correctness (score prediction) */
  strict = true,
): Map<string, Mastery> {
  const acc = new Map<string, { w: number; wc: number; n: number }>();
  for (const a of d.answers) {
    const q = qById.get(a.q);
    if (!q) continue;
    const k = key(q);
    const age = Math.max(0, now - a.ts) / DAY;
    const w = DIFF_WEIGHT[q.difficulty] * Math.pow(0.5, age / HALF_LIFE_DAYS);
    const cur = acc.get(k) ?? { w: 0, wc: 0, n: 0 };
    cur.w += w;
    cur.wc += (strict ? knew(a) : a.ok) ? w : 0;
    cur.n++;
    acc.set(k, cur);
  }
  const out = new Map<string, Mastery>();
  for (const [k, v] of acc) {
    const a = v.wc + 1;
    const b = v.w - v.wc + 1;
    out.set(k, { p: a / (a + b), n: v.w, answered: v.n, a, b });
  }
  return out;
}

export function confidenceLabel(m: Mastery | undefined): 'none' | 'low' | 'medium' | 'high' {
  if (!m || m.answered === 0) return 'none';
  if (m.n < 3) return 'low';
  if (m.n < 8) return 'medium';
  return 'high';
}

// ------------------------------------------------------------------ estimated exam score
export const BLUEPRINTS: Record<'last_year' | 'full', Partial<Record<ChapterId, number>>> = {
  last_year: { S1: 16, S2: 10, S3: 3, S4: 3, S5: 6, S7: 2 },
  full: { S1: 9, S2: 8, S3: 4, S4: 5, S5: 5, S6: 4, S7: 3, S8: 2 },
};

export interface ScoreEstimate {
  mean: number;
  low: number;
  high: number;
  enough: boolean;
  answered: number;
}

/**
 * Expected score on a 40-question exam with the given blueprint: sum over chapters of
 * n_ch * p_ch, where p_ch is the Beta posterior of the chapter accuracy. The 80 % range combines
 * the binomial luck of the exam and the uncertainty about p_ch (so it is wide with little data).
 */
export function estimateScore(
  d: Derived,
  qById: Map<string, Question>,
  blueprint: Partial<Record<ChapterId, number>>,
  now: number,
): ScoreEstimate {
  const m = masteryBy(d, qById, (q) => q.chapter, now, false);
  let mean = 0;
  let variance = 0;
  let total = 0;
  for (const [ch, n] of Object.entries(blueprint)) {
    const mm = m.get(ch) ?? { a: 1, b: 1, p: 0.5, n: 0, answered: 0 };
    const p = mm.a / (mm.a + mm.b);
    const varP = (mm.a * mm.b) / ((mm.a + mm.b) ** 2 * (mm.a + mm.b + 1));
    mean += n! * p;
    variance += n! * p * (1 - p) + n! * n! * varP;
    total += n!;
  }
  const sd = Math.sqrt(variance);
  return {
    mean,
    low: Math.max(0, mean - 1.28 * sd),
    high: Math.min(total, mean + 1.28 * sd),
    enough: d.answers.length >= 30,
    answered: d.answers.length,
  };
}

// ------------------------------------------------------------------ streaks & goals
export function streak(d: Derived, now: number): number {
  let n = 0;
  const cursor = new Date(now);
  // today counts if active; if not active yet today, the streak is still alive from yesterday
  if (!d.daysActive.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (d.daysActive.has(dayKey(cursor.getTime()))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export function answeredToday(d: Derived, now: number): number {
  return d.answersByDay.get(dayKey(now)) ?? 0;
}

export function avgTimeMs(d: Derived): number {
  const xs = d.answers.filter((a) => a.ms > 0 && a.ms < 5 * MIN && a.mode !== 'mock').map((a) => a.ms);
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

export function mostMissed(d: Derived, limit = 10): { id: string; wrong: number; seen: number }[] {
  return [...d.q.entries()]
    .map(([id, s]) => ({ id, wrong: s.seen - s.correct, seen: s.seen }))
    .filter((x) => x.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.seen - a.wrong / a.seen)
    .slice(0, limit);
}
