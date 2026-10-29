import { useEffect } from 'react';
import type { ChapterId } from '../types';
import { getBank, getLessons, getQMap, store, useDerived } from '../lib/app';
import { masteryBy, questionStatus } from '../lib/derive';
import { startSession } from '../lib/flow';
import { learnOrder } from '../lib/select';
import { slidesLabel } from '../lib/text';

export function masteryColor(p: number | undefined): string {
  if (p === undefined) return 'var(--surface-2)';
  // red -> amber -> green
  const hue = Math.round(Math.max(0, Math.min(1, (p - 0.3) / 0.6)) * 120);
  return `hsl(${hue} 65% 45%)`;
}

export function Meter({ p }: { p?: number }) {
  return (
    <span className="meter" aria-label={p === undefined ? 'no data' : `${Math.round(p * 100)}% mastery`}>
      <div style={{ width: `${p === undefined ? 0 : Math.round(p * 100)}%`, background: masteryColor(p) }} />
    </span>
  );
}

export function LearnIndex() {
  const d = useDerived();
  const bank = getBank();
  const m = masteryBy(d, getQMap(), (q) => q.chapter, Date.now());
  return (
    <div className="stack">
      <h1>Learn by chapter</h1>
      <p className="muted small" style={{ margin: 0 }}>
        Each chapter has a cheat-sheet lesson per topic and questions served easy → hard with instant feedback.
      </p>
      <div className="topic-list">
        {bank.chapters.map((c) => {
          const qs = bank.questions.filter((q) => q.chapter === c.id);
          const seen = qs.filter((q) => d.q.has(q.id)).length;
          const mm = m.get(c.id);
          return (
            <a key={c.id} className="topic-item" href={`#/learn/${c.id}`} data-testid={`chapter-${c.id}`}>
              <span className="chip accent">{c.id}</span>
              <span className="grow">
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div className="small muted">
                  {qs.length} questions · {seen} seen · slides {c.slides[0]}–{c.slides[1]}
                </div>
              </span>
              <Meter p={mm?.p} />
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function ChapterPage({ ch }: { ch: string }) {
  const d = useDerived();
  const bank = getBank();
  const chapter = bank.chapters.find((c) => c.id === ch);
  const lesson = getLessons()[ch as ChapterId];
  if (!chapter) return <p>Unknown chapter.</p>;
  const qs = bank.questions.filter((q) => q.chapter === ch);
  const m = masteryBy(d, getQMap(), (q) => q.topic, Date.now());
  const traps = lesson?.sections.find((s) => s.id === 'traps');
  return (
    <div className="stack">
      <a href="#/learn" className="small">
        ← All chapters
      </a>
      <h1>
        {chapter.id} · {chapter.title}
      </h1>
      <div className="row">
        <button className="btn primary" onClick={() => startSession('learn', learnOrder(qs, d), `${ch} ${chapter.title}`, `/learn/${ch}`)}>
          Practise the whole chapter ({qs.length})
        </button>
      </div>
      <h2>Topics</h2>
      <div className="topic-list">
        {chapter.topics.map((t) => {
          const tq = qs.filter((q) => q.topic === t.id);
          const mastered = tq.filter((q) => questionStatus(d.q.get(q.id)) === 'mastered').length;
          return (
            <a key={t.id} className="topic-item" href={`#/learn/${ch}/${t.id}`}>
              <span className="grow">
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div className="small muted">
                  {tq.length} questions · {mastered} mastered
                </div>
              </span>
              <Meter p={m.get(t.id)?.p} />
            </a>
          );
        })}
      </div>
      {traps && (
        <details className="lesson-sec">
          <summary>
            <span>⚠️ Exam traps checklist</span>
            <span className="muted">▾</span>
          </summary>
          <div className="lesson" dangerouslySetInnerHTML={{ __html: traps.html }} />
        </details>
      )}
    </div>
  );
}

export function TopicPage({ ch, topic }: { ch: string; topic: string }) {
  const d = useDerived();
  const bank = getBank();
  const chapter = bank.chapters.find((c) => c.id === ch);
  const t = chapter?.topics.find((x) => x.id === topic);
  const section = getLessons()[ch as ChapterId]?.sections.find((s) => s.id === topic);
  useEffect(() => {
    // remember what was studied last ("Continue" on the home screen); at most one event per minute
    const last = d.views[d.views.length - 1];
    if (!last || last.topic !== topic || Date.now() - last.ts > 60_000) void store.append({ t: 'view', ch, topic });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, topic]);
  if (!chapter || !t) return <p>Unknown topic.</p>;
  const qs = bank.questions.filter((q) => q.chapter === ch && q.topic === topic);
  const slides = [...new Set(qs.flatMap((q) => q.slides))];
  const ordered = learnOrder(qs, d);
  const unseen = qs.filter((q) => !d.q.has(q.id)).length;
  return (
    <div className="stack">
      <a href={`#/learn/${ch}`} className="small">
        ← {ch} {chapter.title}
      </a>
      <h1>{t.title}</h1>
      <div className="row">
        <button className="btn primary" onClick={() => startSession('learn', ordered, t.title, `/learn/${ch}/${topic}`)} data-testid="start-topic">
          Practise {qs.length} questions (easy → hard)
        </button>
        <span className="small muted">{unseen} not seen yet</span>
      </div>
      <div className="card lesson" data-testid="lesson">
        {section ? <div dangerouslySetInnerHTML={{ __html: section.html }} /> : <p className="muted">{t.desc}</p>}
        {slides.length > 0 && <p className="small muted">Questions reference slides {slidesLabel(slides.slice(0, 12))}</p>}
      </div>
    </div>
  );
}
