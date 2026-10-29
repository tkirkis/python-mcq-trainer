import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChapterId, Confidence, Question } from '../types';
import { getBank, getQ, useDerived } from '../lib/app';
import { dueQuestions, questionStatus } from '../lib/derive';
import { endSession, navigate, recordAnswer, startSession, updateSession, useSession } from '../lib/flow';
import { practiceSet, rng, type PracticeFilter } from '../lib/select';
import { Explanation, QuestionView, topicTitle } from './Question';

// ------------------------------------------------------------------ one question with instant feedback
export function AnswerCard({
  q,
  onAnswered,
  onNext,
  nextLabel = 'Next',
  previous,
}: {
  q: Question;
  onAnswered: (chosen: string[], idk: boolean, conf: Confidence | undefined, ms: number) => Promise<void> | void;
  onNext: () => void;
  nextLabel?: string;
  previous?: { chosen: string[]; ok: boolean; idk?: boolean };
}) {
  const d = useDerived();
  const [selected, setSelected] = useState<string[]>(previous?.chosen ?? []);
  const [revealed, setRevealed] = useState<{ ok: boolean; idk: boolean } | null>(previous ? { ok: previous.ok, idk: !!previous.idk } : null);
  const t0 = useRef(performance.now());
  const askConf = d.settings.confidence;

  useEffect(() => {
    setSelected(previous?.chosen ?? []);
    setRevealed(previous ? { ok: previous.ok, idk: !!previous.idk } : null);
    t0.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  const toggle = useCallback(
    (id: string) => {
      if (revealed) return;
      setSelected((s) => (q.type === 'single' ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    },
    [q.type, revealed],
  );

  const submit = useCallback(
    async (idk: boolean, conf?: Confidence) => {
      if (revealed || (!idk && selected.length === 0)) return;
      const chosen = idk ? [] : selected;
      const ok = !idk && q.correct.length === chosen.length && q.correct.every((c) => chosen.includes(c));
      setRevealed({ ok, idk });
      await onAnswered(chosen, idk, conf, performance.now() - t0.current);
    },
    [revealed, selected, q, onAnswered],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) {
        toggle(q.options[n - 1].id);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (revealed) onNext();
        else void submit(false, askConf ? 3 : undefined);
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'n' && revealed) onNext();
      else if (e.key === '?' || e.key.toLowerCase() === 'i') void submit(true);
      else if (askConf && !revealed && e.key.toLowerCase() === 'g') void submit(false, 1);
      else if (askConf && !revealed && e.key.toLowerCase() === 'u') void submit(false, 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, toggle, submit, revealed, onNext, askConf]);

  return (
    <div>
      <div className="card">
        <QuestionView q={q} selected={selected} onToggle={toggle} reveal={!!revealed} disabled={!!revealed} />
      </div>
      {revealed && <Explanation q={q} ok={revealed.ok} idk={revealed.idk} />}
      <div className={`actions-bar${revealed ? '' : ' answering'}`}>
        {!revealed ? (
          <>
            <button className="btn idk-btn" onClick={() => void submit(true)} data-testid="idk">
              I don't know
            </button>
            {askConf ? (
              <div className="conf-row">
                <button className="btn" disabled={!selected.length} onClick={() => void submit(false, 1)} title="Shortcut: G">
                  Guess
                </button>
                <button className="btn" disabled={!selected.length} onClick={() => void submit(false, 2)} title="Shortcut: U">
                  Unsure
                </button>
                <button className="btn primary" disabled={!selected.length} onClick={() => void submit(false, 3)} data-testid="check" title="Shortcut: Enter">
                  Sure ✓
                </button>
              </div>
            ) : (
              <button className="btn primary" disabled={!selected.length} onClick={() => void submit(false)} data-testid="check">
                Check
              </button>
            )}
          </>
        ) : (
          <button className="btn primary" onClick={onNext} data-testid="next" autoFocus>
            {nextLabel} →
          </button>
        )}
      </div>
      <p className="kbd-hint">Keys: 1–{q.options.length} select · Enter check / next · I don't know: I{askConf ? ' · G guess · U unsure' : ''}</p>
    </div>
  );
}

// ------------------------------------------------------------------ session runner
export function SessionPage() {
  const s = useSession();
  if (!s) {
    return (
      <div className="stack">
        <h1>No active session</h1>
        <a className="btn primary" href="#/practice">
          Start a practice session
        </a>
      </div>
    );
  }
  const done = Object.keys(s.results).length;
  const finished = s.index >= s.qids.length;
  if (finished) return <SessionSummary />;
  const q = getQ(s.qids[s.index]);
  if (!q) {
    void updateSession({ index: s.index + 1 });
    return null;
  }
  const isLast = s.index === s.qids.length - 1;
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="small muted">
          {s.title} · {s.index + 1}/{s.qids.length}
        </span>
        <button className="btn ghost small" onClick={() => void updateSession({ index: s.qids.length })}>
          Finish
        </button>
      </div>
      <div className="progress" style={{ marginBottom: 14 }}>
        <div style={{ width: `${(done / s.qids.length) * 100}%` }} />
      </div>
      <AnswerCard
        q={q}
        previous={s.results[q.id]}
        onAnswered={async (chosen, idk, conf, ms) => {
          await recordAnswer(q, chosen, { idk, conf, ms, inSession: true });
        }}
        onNext={() => void updateSession({ index: s.index + 1 })}
        nextLabel={isLast ? 'Finish' : 'Next'}
      />
    </div>
  );
}

function SessionSummary() {
  const s = useSession()!;
  const res = s.qids.map((id) => ({ id, r: s.results[id] })).filter((x) => x.r);
  const ok = res.filter((x) => x.r.ok).length;
  const wrong = res.filter((x) => !x.r.ok).map((x) => getQ(x.id)!).filter(Boolean);
  return (
    <div className="stack" data-testid="session-summary">
      <h1>
        {ok}/{res.length} correct
      </h1>
      <p className="muted">{s.title}</p>
      <div className="row">
        {wrong.length > 0 && (
          <button className="btn primary" onClick={() => void startSession('practice', wrong, 'Retry mistakes', s.back)}>
            Retry my {wrong.length} mistake{wrong.length > 1 ? 's' : ''}
          </button>
        )}
        <button
          className="btn"
          onClick={() => {
            const back = s.back;
            void endSession().then(() => navigate(back));
          }}
        >
          Done
        </button>
      </div>
      {wrong.length > 0 && (
        <div className="topic-list">
          {wrong.map((q) => (
            <a key={q.id} className="topic-item" href={`#/q/${q.id}`}>
              <span className="chip bad">✗</span>
              <span className="grow small">{q.stem.replace(/`/g, '').slice(0, 90)}</span>
              <span className="chip">{q.chapter}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ practice setup
const POOLS: { id: PracticeFilter['pool']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'weak', label: 'Weak spots' },
  { id: 'due', label: 'Due for review' },
  { id: 'unseen', label: 'Never seen' },
  { id: 'missed', label: 'Missed before' },
  { id: 'past', label: '2021-22 exam only' },
];

export function PracticeSetup() {
  const d = useDerived();
  const bank = getBank();
  const [f, setF] = useState<PracticeFilter>({ chapters: [], pool: 'all', size: 10 });
  const now = Date.now();
  const preview = practiceSet(bank.questions, d, { ...f, size: 0 }, now, rng(1));
  const topics = f.chapters.length === 1 ? bank.chapters.find((c) => c.id === f.chapters[0])?.topics ?? [] : [];
  const toggleCh = (c: ChapterId) =>
    setF((x) => ({ ...x, topic: undefined, chapters: x.chapters.includes(c) ? x.chapters.filter((y) => y !== c) : [...x.chapters, c] }));
  return (
    <div className="stack">
      <h1>Practice</h1>
      <div className="card stack">
        <div>
          <div className="small muted">Chapters (none = all)</div>
          <div className="row" style={{ marginTop: 6 }}>
            {bank.chapters.map((c) => (
              <button key={c.id} className="chip" aria-pressed={f.chapters.includes(c.id)} onClick={() => toggleCh(c.id)} title={c.title}>
                {c.id}
              </button>
            ))}
          </div>
        </div>
        {topics.length > 0 && (
          <label className="field">
            Topic
            <select value={f.topic ?? ''} onChange={(e) => setF({ ...f, topic: e.target.value || undefined })}>
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div>
          <div className="small muted">Questions</div>
          <div className="row" style={{ marginTop: 6 }}>
            {POOLS.map((p) => (
              <button key={p.id} className="chip" aria-pressed={f.pool === p.id} onClick={() => setF({ ...f, pool: p.id })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid2">
          <label className="field">
            Difficulty
            <select value={f.difficulty ?? ''} onChange={(e) => setF({ ...f, difficulty: (Number(e.target.value) || undefined) as PracticeFilter['difficulty'] })}>
              <option value="">Any</option>
              <option value="1">Easy</option>
              <option value="2">Medium</option>
              <option value="3">Hard</option>
            </select>
          </label>
          <label className="field">
            Type
            <select value={f.type ?? ''} onChange={(e) => setF({ ...f, type: (e.target.value || undefined) as PracticeFilter['type'] })}>
              <option value="">Any</option>
              <option value="single">Select one</option>
              <option value="multi">Select all that apply</option>
            </select>
          </label>
        </div>
        <div>
          <div className="small muted">Session length</div>
          <div className="row" style={{ marginTop: 6 }}>
            {[5, 10, 20, 0].map((n) => (
              <button key={n} className="chip" aria-pressed={f.size === n} onClick={() => setF({ ...f, size: n })}>
                {n ? `${n} questions` : 'Endless'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        className="btn primary block"
        disabled={!preview.length}
        data-testid="start-practice"
        onClick={() => void startSession('practice', practiceSet(bank.questions, d, f, now, rng(now)), 'Practice', '/practice')}
      >
        Start · {f.size ? Math.min(f.size, preview.length) : preview.length} of {preview.length} matching
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ review queue
export function ReviewPage() {
  const d = useDerived();
  const now = Date.now();
  const due = dueQuestions(d, now).map((id) => getQ(id)!).filter(Boolean);
  const queue = [...d.q.entries()].filter(([, s]) => s.inQueue).length;
  const later = queue - due.length;
  return (
    <div className="stack">
      <h1>Review queue</h1>
      <p className="muted" style={{ margin: 0 }}>
        Every question you miss, skip or guess enters a Leitner queue: due again after 10 minutes, then 1, 3, 7 and 16 days. Five correct
        reviews in a row graduate it.
      </p>
      <div className="card">
        <div className="grid2">
          <div className="kpi">
            <b>{due.length}</b>
            <span>due today</span>
          </div>
          <div className="kpi">
            <b>{later}</b>
            <span>scheduled later</span>
          </div>
        </div>
      </div>
      <button className="btn primary block" disabled={!due.length} onClick={() => void startSession('review', due, 'Due reviews', '/review')}>
        Review {due.length} question{due.length === 1 ? '' : 's'}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ single question (from links)
export function QuestionPage({ id }: { id: string }) {
  const q = getQ(id);
  const d = useDerived();
  const [key, setKey] = useState(0);
  if (!q) return <p>Unknown question.</p>;
  const st = d.q.get(id);
  return (
    <div className="stack">
      <div className="row small muted">
        <a href="#/dashboard">← Progress</a>· {q.id} · {topicTitle(q.chapter, q.topic)} · status: {questionStatus(st)}
        {st ? ` · ${st.correct}/${st.seen} correct` : ''}
      </div>
      <AnswerCard
        key={key}
        q={q}
        onAnswered={async (chosen, idk, conf, ms) => {
          await recordAnswer(q, chosen, { idk, conf, ms });
        }}
        onNext={() => setKey((k) => k + 1)}
        nextLabel="Try again"
      />
    </div>
  );
}
