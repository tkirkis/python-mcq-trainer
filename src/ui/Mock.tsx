import { useCallback, useEffect, useRef, useState } from 'react';
import type { MockVariant, Question } from '../types';
import { getBank, getQ, useDerived } from '../lib/app';
import { discardMock, finishMock, loadMock, navigate, newMock, saveMock, startSession, type MockState } from '../lib/flow';
import { buildMock, rng } from '../lib/select';
import { Explanation, QuestionView } from './Question';

export const VARIANTS: { id: MockVariant; title: string; desc: string }[] = [
  { id: 'last_year', title: 'Same as last year', desc: 'S1–S5 (+ lambda/map) weighted like the 2021-22 exam, 10 % multi-select.' },
  { id: 'full', title: 'Full syllabus', desc: 'All 8 chapters incl. NumPy/Pandas, testing and web, 15 % multi-select.' },
  { id: 'reference', title: 'Reference replay', desc: 'The reconstructed 2021-22 exam itself, 40 questions, verified answers.' },
  { id: 'hard', title: 'Hard mode', desc: 'Full syllabus, mostly hard questions, 20 % multi-select, shorter time.' },
];

export function variantTitle(v: MockVariant) {
  return VARIANTS.find((x) => x.id === v)?.title ?? v;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}min ${String(s % 60).padStart(2, '0')}s`;
}

// ------------------------------------------------------------------ setup
export function MockSetup() {
  const d = useDerived();
  const [current, setCurrent] = useState<MockState | null | undefined>(undefined);
  useEffect(() => {
    void loadMock().then(setCurrent);
  }, []);
  const s = d.settings;
  const start = async (variant: MockVariant) => {
    if (current && !confirm('Discard the mock exam in progress?')) return;
    const qs = buildMock(getBank().questions, d, variant, rng(Date.now()));
    const minutes = variant === 'hard' ? s.hardMinutes : s.mockMinutes;
    await saveMock(newMock(variant, qs, minutes, s.scoring));
    navigate('/mock/run');
  };
  return (
    <div className="stack">
      <h1>Mock exam</h1>
      <p className="muted" style={{ margin: 0 }}>
        Like the real quiz: 40 questions, 1 point each, {s.mockMinutes} minutes, one question per page, ANSWER / I DON'T KNOW, no feedback until the
        end. Scoring: +{s.scoring.correct} correct, {s.scoring.wrong} wrong, {s.scoring.idk} "I don't know", multi-select{' '}
        {s.scoring.multi === 'all' ? 'all-or-nothing' : 'partial credit'} (<a href="#/settings">change</a>).
      </p>
      {current && (
        <div className="card stack" data-testid="mock-resume">
          <strong>Mock in progress — {variantTitle(current.variant)}</strong>
          <span className="small muted">
            {Object.keys(current.answers).length}/{current.qids.length} answered · {fmt(current.limitMs - current.elapsedMs)} left (the timer pauses while the
            exam is closed)
          </span>
          <div className="row">
            <button className="btn primary" onClick={() => navigate('/mock/run')}>
              Resume
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Discard this mock exam?')) void discardMock().then(() => setCurrent(null));
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
      <div className="stack">
        {VARIANTS.map((v) => (
          <button key={v.id} className="action" onClick={() => void start(v.id)} data-testid={`start-mock-${v.id}`}>
            <strong>{v.title}</strong>
            <span>
              {v.desc} {v.id === 'hard' ? `${s.hardMinutes} min.` : `${s.mockMinutes} min.`}
            </span>
          </button>
        ))}
      </div>
      {d.mocks.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Past mocks</h2>
          <div className="topic-list">
            {[...d.mocks].reverse().slice(0, 8).map((m) => (
              <a key={m.mid} className="topic-item" href={`#/mock/result/${m.mid}`}>
                <span className="grow">
                  {variantTitle(m.variant)} <span className="small muted">· {new Date(m.ts).toLocaleDateString()}</span>
                </span>
                <b>
                  {m.score}/{m.max}
                </b>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ runner
export function MockRunner() {
  const [m, setM] = useState<MockState | null | undefined>(undefined);
  const [sideOpen, setSideOpen] = useState(false);
  const ref = useRef<MockState | null>(null);
  ref.current = m ?? null;
  const finishing = useRef(false);

  useEffect(() => {
    void loadMock().then(setM);
  }, []);

  const finish = useCallback(async () => {
    const cur = ref.current;
    if (!cur || finishing.current) return;
    finishing.current = true;
    const mid = await finishMock(cur);
    navigate(`/mock/result/${mid}`);
  }, []);

  // timer: counts only while the exam is on screen; persisted every few seconds
  useEffect(() => {
    if (!m) return;
    let last = performance.now();
    let sinceSave = 0;
    const tick = () => {
      const now = performance.now();
      const dt = document.visibilityState === 'visible' ? now - last : 0;
      last = now;
      const cur = ref.current;
      if (!cur) return;
      const next = { ...cur, elapsedMs: cur.elapsedMs + dt };
      ref.current = next;
      setM(next);
      sinceSave += dt;
      if (next.elapsedMs >= next.limitMs) void finish();
      else if (sinceSave > 5000) {
        sinceSave = 0;
        void saveMock(next);
      }
    };
    const id = setInterval(tick, 1000);
    const onVis = () => {
      if (document.visibilityState === 'hidden' && ref.current) void saveMock(ref.current);
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onVis);
      if (ref.current && !finishing.current) void saveMock(ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m === undefined || m === null]);

  const update = useCallback((patch: Partial<MockState>) => {
    const cur = ref.current;
    if (!cur) return;
    const next = { ...cur, ...patch };
    ref.current = next;
    setM(next);
    void saveMock(next);
  }, []);

  const q: Question | undefined = m ? getQ(m.qids[m.index]) : undefined;
  const draft = m && q ? (m.drafts[q.id] ?? m.answers[q.id]?.chosen ?? []) : [];

  const toggle = useCallback(
    (id: string) => {
      const cur = ref.current;
      if (!cur) return;
      const qq = getQ(cur.qids[cur.index])!;
      const prev = cur.drafts[qq.id] ?? cur.answers[qq.id]?.chosen ?? [];
      const next = qq.type === 'single' ? [id] : prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      update({ drafts: { ...cur.drafts, [qq.id]: next } });
    },
    [update],
  );
  const go = useCallback(
    (i: number) => {
      const cur = ref.current;
      if (!cur) return;
      update({ index: Math.max(0, Math.min(cur.qids.length - 1, i)) });
      setSideOpen(false);
      window.scrollTo(0, 0);
    },
    [update],
  );
  const answer = useCallback(
    (idk: boolean) => {
      const cur = ref.current;
      if (!cur) return;
      const id = cur.qids[cur.index];
      const chosen = idk ? [] : (cur.drafts[id] ?? cur.answers[id]?.chosen ?? []);
      if (!idk && !chosen.length) return;
      const drafts = { ...cur.drafts };
      delete drafts[id];
      const answers = { ...cur.answers, [id]: { chosen, status: idk ? ('idk' as const) : ('answered' as const) } };
      const index = cur.index < cur.qids.length - 1 ? cur.index + 1 : cur.index;
      update({ answers, drafts, index });
      window.scrollTo(0, 0);
    },
    [update],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cur = ref.current;
      if (!cur || e.metaKey || e.ctrlKey || e.altKey) return;
      const qq = getQ(cur.qids[cur.index]);
      if (!qq) return;
      const n = Number(e.key);
      if (n >= 1 && n <= qq.options.length) toggle(qq.options[n - 1].id);
      else if (e.key === 'Enter') answer(false);
      else if (e.key.toLowerCase() === 'i') answer(true);
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') go(cur.index + 1);
      else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p') go(cur.index - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, answer, go]);

  if (m === undefined) return <p>Loading…</p>;
  if (m === null || !q)
    return (
      <div className="stack">
        <h1>No mock exam in progress</h1>
        <a className="btn primary" href="#/mock">
          Start one
        </a>
      </div>
    );

  const left = m.limitMs - m.elapsedMs;
  const answered = Object.keys(m.answers).length;
  const allDone = answered === m.qids.length;
  const status = m.answers[q.id]?.status;
  const dirty = !!m.drafts[q.id];

  const sidebar = (
    <aside className={`mock-side${sideOpen ? ' open' : ''}`} aria-label="Questions">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{m.qids.length} Questions</div>
          <div className="small muted">{m.qids.length - answered} not answered</div>
        </div>
        {sideOpen && (
          <button className="btn small" onClick={() => setSideOpen(false)}>
            Close
          </button>
        )}
      </div>
      <div className="qgrid">
        {m.qids.map((id, i) => {
          const st = m.answers[id]?.status;
          return (
            <button
              key={id}
              className={`qcell${st === 'answered' ? ' answered' : st === 'idk' ? ' idk' : ''}${i === m.index ? ' current' : ''}`}
              onClick={() => go(i)}
              aria-label={`Question ${i + 1}${st ? ` (${st === 'idk' ? "I don't know" : 'answered'})` : ''}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        <span>
          <i style={{ background: 'var(--good-weak)', border: '1px solid var(--good)' }} />
          answered
        </span>
        <span>
          <i style={{ background: 'var(--surface-2)', border: '1px dashed var(--muted)' }} />I don't know
        </span>
      </div>
    </aside>
  );

  return (
    <div data-testid="mock-runner">
      <div className="mock-head">
        <div className="row">
          <button className="btn small" onClick={() => setSideOpen(true)} data-testid="open-sidebar">
            ☰ {answered}/{m.qids.length}
          </button>
          <span className={`timer${left < 5 * 60_000 ? ' low' : ''}`} data-testid="timer">
            ⏱ {fmt(left)}
          </span>
        </div>
        <button
          className="btn small primary"
          onClick={() => {
            if (confirm(allDone ? 'Send your answers and see the results?' : `${m.qids.length - answered} questions are not answered. End the exam anyway?`))
              void finish();
          }}
          data-testid="end-exam"
        >
          END EXAM
        </button>
      </div>
      {allDone && (
        <div className="card row" style={{ background: 'var(--accent-weak)', borderColor: 'transparent', marginBottom: 12 }}>
          <span className="small" style={{ flex: 1, color: 'var(--accent)' }}>
            You have answered all the questions. You can reread and change your answers, then send them.
          </span>
          <button className="btn small primary" onClick={() => void finish()} data-testid="send-and-leave">
            SEND AND LEAVE
          </button>
        </div>
      )}
      <div className="mock-shell">
        {sidebar}
        <div className="mock-main">
          <div className="card">
            <div className="q-meta">
              <span>
                Question {m.index + 1} · {q.type === 'multi' ? 'Select all that apply' : 'Select one'}
              </span>
              <span className="point">1 Point</span>
            </div>
            <QuestionView q={q} selected={draft} onToggle={toggle} showMeta={false} />
            <div className="small" style={{ minHeight: 22, marginTop: 10, textAlign: 'right', color: status && !dirty ? 'var(--good)' : 'var(--muted)' }}>
              {status === 'answered' && !dirty ? '✓ Answer validated' : status === 'idk' && !dirty ? '✓ "I don\'t know" recorded' : dirty ? 'Not validated yet' : ''}
            </div>
          </div>
          <div className="actions-bar mock-actions" style={{ bottom: 0 }}>
            <button className="btn nav-btn" onClick={() => go(m.index - 1)} disabled={m.index === 0} aria-label="Previous">
              ‹
            </button>
            <button className="btn" onClick={() => answer(true)} data-testid="mock-idk">
              I DON'T KNOW
            </button>
            <button className="btn primary" onClick={() => answer(false)} disabled={!draft.length} data-testid="mock-answer">
              ANSWER
            </button>
            <button className="btn nav-btn" onClick={() => go(m.index + 1)} disabled={m.index === m.qids.length - 1} aria-label="Next" data-testid="mock-next">
              ›
            </button>
          </div>
          <p className="kbd-hint">Keys: 1–{q.options.length} select · Enter ANSWER · I don't know: I · ← → navigate</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ results
export function MockResults({ mid }: { mid: string }) {
  const d = useDerived();
  const [open, setOpen] = useState<string | null>(null);
  const m = d.mocks.find((x) => x.mid === mid);
  if (!m) return <p>Result not found (it may still be syncing).</p>;
  const byCh = new Map<string, { n: number; pts: number; ok: number }>();
  for (const it of m.items) {
    const q = getQ(it.q);
    const ch = q?.chapter ?? '?';
    const cur = byCh.get(ch) ?? { n: 0, pts: 0, ok: 0 };
    cur.n++;
    cur.pts += it.pts;
    cur.ok += it.ok ? 1 : 0;
    byCh.set(ch, cur);
  }
  const mistakes = m.items.filter((it) => !it.ok).map((it) => getQ(it.q)!).filter(Boolean);
  const pct = m.max ? m.score / m.max : 0;
  return (
    <div className="stack" data-testid="mock-results">
      <a href="#/mock" className="small">
        ← Mock exams
      </a>
      <h1>
        {m.score} / {m.max}
      </h1>
      <p className="muted" style={{ margin: 0 }}>
        {variantTitle(m.variant)} · {new Date(m.ts).toLocaleString()} · time used {fmt(m.ms)} of {fmt(m.limit)} ·{' '}
        {m.items.filter((i) => i.ok).length} correct, {m.items.filter((i) => !i.ok && !i.idk).length} wrong, {m.items.filter((i) => i.idk).length} not
        answered
      </p>
      <div className="progress">
        <div style={{ width: `${Math.max(0, pct) * 100}%`, background: pct >= 0.5 ? 'var(--good)' : 'var(--bad)' }} />
      </div>
      <div className="row">
        {mistakes.length > 0 && (
          <button className="btn primary" onClick={() => void startSession('practice', mistakes, 'Mock mistakes', `/mock/result/${mid}`)} data-testid="retry-mistakes">
            Retry only my {mistakes.length} mistakes
          </button>
        )}
        <a className="btn" href="#/dashboard">
          Progress
        </a>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>By chapter</h2>
        <div className="stack" style={{ gap: 6 }}>
          {[...byCh.entries()].sort().map(([ch, v]) => (
            <div key={ch} className="bar-row">
              <b>{ch}</b>
              <div className="progress">
                <div style={{ width: `${(v.ok / v.n) * 100}%`, background: v.ok / v.n >= 0.5 ? 'var(--good)' : 'var(--bad)' }} />
              </div>
              <span className="small">
                {v.ok}/{v.n}
              </span>
            </div>
          ))}
        </div>
      </div>
      <h2>Review every question</h2>
      <div className="stack">
        {m.items.map((it, i) => {
          const q = getQ(it.q);
          if (!q) return null;
          const isOpen = open === it.q;
          return (
            <div key={it.q} className="card" style={{ padding: 12 }}>
              <button
                className="row"
                style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                onClick={() => setOpen(isOpen ? null : it.q)}
                aria-expanded={isOpen}
              >
                <span className={`chip ${it.ok ? 'good' : it.idk ? '' : 'bad'}`}>{it.ok ? '✓' : it.idk ? '?' : '✗'}</span>
                <span className="small" style={{ flex: 1 }}>
                  {i + 1}. {q.stem.replace(/[`*]/g, '').slice(0, 80)}
                </span>
                <span className="small muted">{it.pts > 0 ? `+${it.pts}` : it.pts}</span>
              </button>
              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  <QuestionView q={q} selected={it.ch} reveal disabled />
                  <Explanation q={q} ok={it.ok} idk={it.idk} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
