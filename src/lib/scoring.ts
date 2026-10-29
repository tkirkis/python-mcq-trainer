import type { Question, ScoringSettings } from '../types';

export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** Fully correct = exactly the set of correct options (single or multi). */
export function isCorrect(q: Question, chosen: string[]): boolean {
  return sameSet(q.correct, chosen);
}

/**
 * Points for one question.
 * - idk / nothing chosen -> `idk` points
 * - single choice: `correct` or `wrong`
 * - multi, all-or-nothing: exact set -> `correct`, anything else -> `wrong`
 * - multi, partial: correct * max(0, (#right chosen - #wrong chosen) / #correct);
 *   if that is 0 the answer counts as wrong (`wrong` points, e.g. negative marking).
 */
export function scoreQuestion(q: Question, chosen: string[], idk: boolean, s: ScoringSettings): number {
  if (idk || chosen.length === 0) return s.idk;
  if (q.type === 'single' || s.multi === 'all') return isCorrect(q, chosen) ? s.correct : s.wrong;
  const right = new Set(q.correct);
  const tp = chosen.filter((c) => right.has(c)).length;
  const fp = chosen.length - tp;
  const frac = Math.max(0, (tp - fp) / q.correct.length);
  return frac > 0 ? round2(s.correct * frac) : s.wrong;
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
