import type { Question } from '../types';
import { codeSpans, highlightPython, inlineMd, slidesLabel } from '../lib/text';
import { getBank } from '../lib/app';

export function Code({ code }: { code: string }) {
  return <pre className="code" dangerouslySetInnerHTML={{ __html: highlightPython(code) }} />;
}

export function Md({ text, className }: { text: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: inlineMd(text) }} />;
}

export function chapterTitle(id: string): string {
  return getBank().chapters.find((c) => c.id === id)?.title ?? id;
}
export function topicTitle(ch: string, topic: string): string {
  return getBank().chapters.find((c) => c.id === ch)?.topics.find((t) => t.id === topic)?.title ?? topic;
}

interface Props {
  q: Question;
  selected: string[];
  onToggle?: (id: string) => void;
  /** show correct / wrong marking + per-option notes */
  reveal?: boolean;
  disabled?: boolean;
  showMeta?: boolean;
}

export function QuestionView({ q, selected, onToggle, reveal, disabled, showMeta = true }: Props) {
  const multi = q.type === 'multi';
  return (
    <div>
      {showMeta && (
        <div className="q-meta">
          <span>
            {multi ? 'Select all that apply' : 'Select one'} · {q.chapter} {topicTitle(q.chapter, q.topic)}
          </span>
          <span className="row" style={{ gap: 6 }}>
            {q.source === 'past_exam' && <span className="chip accent">2021-22 exam</span>}
            <span className="chip">{'●'.repeat(q.difficulty)}{'○'.repeat(3 - q.difficulty)}</span>
          </span>
        </div>
      )}
      <Md className="q-stem" text={q.stem} />
      {q.code && <Code code={q.code} />}
      <ul className="options" role={multi ? 'group' : 'radiogroup'} aria-label="Options">
        {q.options.map((o, i) => {
          const sel = selected.includes(o.id);
          const isRight = q.correct.includes(o.id);
          let cls = 'opt';
          if (sel) cls += ' selected';
          if (reveal) {
            if (isRight && sel) cls += ' correct';
            else if (isRight) cls += ' missed correct';
            else if (sel) cls += ' wrong';
          }
          const note = reveal ? q.notes[o.id] : undefined;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={cls}
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={sel}
                disabled={disabled}
                onClick={() => onToggle?.(o.id)}
                data-opt={o.id}
              >
                <span className={`mark ${multi ? 'box' : 'radio'}`} aria-hidden="true" />
                <span className={`otext${o.mono ? ' mono' : ''}`}>
                  {o.mono ? o.text : <span dangerouslySetInnerHTML={{ __html: codeSpans(o.text) }} />}
                  {reveal && isRight && <span className="note" dangerouslySetInnerHTML={{ __html: `✓ correct${note ? ` — ${codeSpans(note)}` : ''}` }} />}
                  {note && !isRight && <span className="note" dangerouslySetInnerHTML={{ __html: codeSpans(note) }} />}
                </span>
                <span className="key" aria-hidden="true">
                  {i + 1}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Explanation({ q, ok, idk }: { q: Question; ok?: boolean; idk?: boolean }) {
  return (
    <div className="card stack" style={{ marginTop: 14 }} data-testid="feedback">
      {ok !== undefined && (
        <div className={`verdict ${ok ? 'good' : 'bad'}`}>
          {ok ? '✓ Correct' : idk ? '? Not answered' : '✗ Wrong'}
          {!ok && <span className="small muted" style={{ fontWeight: 400 }}>→ added to your review queue</span>}
        </div>
      )}
      <Md className="expl" text={q.explanation} />
      {q.quirkNote && (
        <div className="small" style={{ background: 'var(--warn-weak)', color: 'var(--warn)', padding: '8px 10px', borderRadius: 8 }}>
          {q.quirk ? 'Exam quirk: ' : 'Note: '}
          {q.quirkNote}
        </div>
      )}
      <div className="row small muted">
        <span>Slides {slidesLabel(q.slides)}</span>·
        <a href={`#/learn/${q.chapter}/${q.topic}`}>Lesson: {topicTitle(q.chapter, q.topic)}</a>
        <span className="chip" title="How this answer key was checked">
          {q.verified === 'exec' ? '✔ verified by running the code' : q.verified === 'review' ? '✔ double-reviewed' : 'unverified'}
        </span>
      </div>
      {q.pastExam && (
        <div className="small muted">
          2021-22 exam, page {q.pastExam.page}. Ticked in the screenshot:{' '}
          {q.pastExam.ticked.length ? q.pastExam.ticked.join(', ') : '—'}{' '}
          {q.pastExam.tickedCorrect === null ? '' : q.pastExam.tickedCorrect ? '(right)' : '(wrong)'}
        </div>
      )}
    </div>
  );
}
