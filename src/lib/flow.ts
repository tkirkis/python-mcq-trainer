// Navigation, practice sessions and mock-exam state (persisted locally so they survive reloads).
import { useSyncExternalStore } from 'react';
import type { Mode, MockEv, MockItem, MockVariant, Question, ScoringSettings } from '../types';
import { store, getQ } from './app';
import { isCorrect, round2, scoreQuestion } from './scoring';

// ------------------------------------------------------------------ hash router
function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/';
}
export function useRoute(): string[] {
  const path = useSyncExternalStore(
    (fn) => {
      window.addEventListener('hashchange', fn);
      return () => window.removeEventListener('hashchange', fn);
    },
    currentPath,
  );
  return path.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}
export function navigate(path: string) {
  if (currentPath() !== path) location.hash = path;
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ practice sessions
export interface SessionResult {
  chosen: string[];
  ok: boolean;
  idk?: boolean;
}
export interface Session {
  sid: string;
  mode: Mode;
  title: string;
  qids: string[];
  index: number;
  results: Record<string, SessionResult>;
  startedAt: number;
  back: string;
}

let session: Session | null = null;
const sessionListeners = new Set<() => void>();
function emitSession() {
  sessionListeners.forEach((l) => l());
}

export async function loadSession(): Promise<Session | null> {
  session = (await store.kv.getKV<Session>('session:current')) ?? null;
  emitSession();
  return session;
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (fn) => {
      sessionListeners.add(fn);
      return () => sessionListeners.delete(fn);
    },
    () => session,
  );
}

export async function startSession(mode: Mode, qs: Question[], title: string, back = '/') {
  session = {
    sid: `s${Date.now().toString(36)}`,
    mode,
    title,
    qids: qs.map((q) => q.id),
    index: 0,
    results: {},
    startedAt: Date.now(),
    back,
  };
  await store.kv.setKV('session:current', session);
  emitSession();
  navigate('/session');
}

export async function updateSession(patch: Partial<Session>) {
  if (!session) return;
  session = { ...session, ...patch };
  await store.kv.setKV('session:current', session);
  emitSession();
}

export async function endSession() {
  session = null;
  await store.kv.delKV('session:current');
  emitSession();
}

/** Record an answer: appends an immutable event (synced later) and updates the session. */
export async function recordAnswer(
  q: Question,
  chosen: string[],
  opts: { idk?: boolean; ms: number; conf?: 1 | 2 | 3; inSession?: boolean },
) {
  const ok = !opts.idk && isCorrect(q, chosen);
  const sess = opts.inSession ? session : null;
  await store.append({
    t: 'ans',
    q: q.id,
    ch: chosen,
    ok,
    ...(opts.idk ? { idk: true } : {}),
    ms: Math.round(opts.ms),
    mode: sess?.mode ?? 'practice',
    ...(opts.conf ? { conf: opts.conf } : {}),
    ...(sess ? { sid: sess.sid } : {}),
  });
  if (sess) await updateSession({ results: { ...sess.results, [q.id]: { chosen, ok, idk: opts.idk } } });
  return ok;
}

// ------------------------------------------------------------------ mock exams
export interface MockAnswer {
  chosen: string[];
  status: 'answered' | 'idk';
}
export interface MockState {
  mid: string;
  variant: MockVariant;
  qids: string[];
  answers: Record<string, MockAnswer>;
  drafts: Record<string, string[]>;
  index: number;
  limitMs: number;
  elapsedMs: number;
  startedAt: number;
  scoring: ScoringSettings;
}

export async function loadMock(): Promise<MockState | null> {
  return (await store.kv.getKV<MockState>('mock:current')) ?? null;
}
export async function saveMock(m: MockState) {
  await store.kv.setKV('mock:current', m);
}
export async function discardMock() {
  await store.kv.delKV('mock:current');
}

export function newMock(variant: MockVariant, qs: Question[], minutes: number, scoring: ScoringSettings): MockState {
  return {
    mid: `m${Date.now().toString(36)}`,
    variant,
    qids: qs.map((q) => q.id),
    answers: {},
    drafts: {},
    index: 0,
    limitMs: minutes * 60_000,
    elapsedMs: 0,
    startedAt: Date.now(),
    scoring,
  };
}

/** Grade the mock, append the result + one answer event per question, return the mock id. */
export async function finishMock(m: MockState): Promise<string> {
  const items: MockItem[] = [];
  let score = 0;
  let max = 0;
  for (const id of m.qids) {
    const q = getQ(id);
    if (!q) continue;
    const a = m.answers[id];
    const idk = !a || a.status === 'idk' || a.chosen.length === 0;
    const chosen = idk ? [] : a!.chosen;
    const pts = scoreQuestion(q, chosen, idk, m.scoring);
    score += pts;
    max += m.scoring.correct;
    items.push({ q: id, ch: chosen, ok: !idk && isCorrect(q, chosen), ...(idk ? { idk: true } : {}), pts });
  }
  const per = Math.round(m.elapsedMs / Math.max(1, items.length));
  const mockEv: Omit<MockEv, 'id' | 'ts' | 'dev'> = {
    t: 'mock',
    mid: m.mid,
    variant: m.variant,
    score: round2(score),
    max,
    ms: Math.round(m.elapsedMs),
    limit: m.limitMs,
    started: m.startedAt,
    items,
    scoring: m.scoring,
  };
  await store.append([
    mockEv,
    ...items.map((it) => ({
      t: 'ans' as const,
      q: it.q,
      ch: it.ch,
      ok: it.ok,
      ...(it.idk ? { idk: true } : {}),
      ms: per,
      mode: 'mock' as const,
      sid: m.mid,
    })),
  ]);
  await discardMock();
  return m.mid;
}
