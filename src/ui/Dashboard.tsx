import { getBank, getQ, getQMap, useDerived } from '../lib/app';
import {
  answeredToday,
  avgTimeMs,
  BLUEPRINTS,
  confidenceLabel,
  dayKey,
  estimateScore,
  masteryBy,
  mostMissed,
  questionStatus,
  streak,
} from '../lib/derive';
import { slidesLabel } from '../lib/text';
import { masteryColor } from './Learn';
import { variantTitle } from './Mock';
import { topicTitle } from './Question';

function ScoreChart({ points }: { points: { x: number; y: number; label: string }[] }) {
  const W = 320;
  const H = 140;
  const pad = 24;
  if (points.length === 0) return <p className="muted small">No mock exam yet.</p>;
  const sx = (i: number) => pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (points.length - 1));
  const sy = (v: number) => H - pad - v * (H - 2 * pad);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mock exam score history">
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W - pad} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeDasharray={v === 0.5 ? '4 3' : undefined} />
          <text x={2} y={sy(v) + 4}>
            {Math.round(v * 40)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(i)} cy={sy(p.y)} r="4" fill="var(--accent)">
          <title>{p.label}</title>
        </circle>
      ))}
    </svg>
  );
}

function ActivityChart({ days }: { days: { k: string; n: number }[] }) {
  const W = 320;
  const H = 90;
  const max = Math.max(1, ...days.map((d) => d.n));
  const bw = (W - 8) / days.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Answers per day, last 14 days">
      {days.map((d, i) => {
        const h = (d.n / max) * (H - 22);
        return (
          <g key={d.k}>
            <rect x={4 + i * bw + 2} y={H - 16 - h} width={bw - 4} height={Math.max(h, d.n ? 2 : 0)} rx="3" fill="var(--accent)">
              <title>
                {d.k}: {d.n}
              </title>
            </rect>
            {i % 2 === 0 && (
              <text x={4 + i * bw + bw / 2} y={H - 3} textAnchor="middle">
                {d.k.slice(8)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Dashboard() {
  const d = useDerived();
  const bank = getBank();
  const qm = getQMap();
  const now = Date.now();
  const total = bank.questions.length;
  const seen = bank.questions.filter((q) => d.q.has(q.id)).length;
  const mastered = bank.questions.filter((q) => questionStatus(d.q.get(q.id)) === 'mastered').length;
  const correct = d.answers.filter((a) => a.ok).length;
  const chM = masteryBy(d, qm, (q) => q.chapter, now);
  const topicM = masteryBy(d, qm, (q) => `${q.chapter}/${q.topic}`, now);
  const estFull = estimateScore(d, qm, BLUEPRINTS.full, now);
  const estLast = estimateScore(d, qm, BLUEPRINTS.last_year, now);
  const missed = mostMissed(d, 8);
  const days = Array.from({ length: 14 }, (_, i) => {
    const k = dayKey(now - (13 - i) * 86_400_000);
    return { k, n: d.answersByDay.get(k) ?? 0 };
  });
  const weak = bank.chapters
    .flatMap((c) => c.topics.map((t) => ({ ch: c.id, t: t.id, m: topicM.get(`${c.id}/${t.id}`) })))
    .sort((a, b) => (a.m?.p ?? 0.5) - (b.m?.p ?? 0.5) || (a.m?.answered ?? 0) - (b.m?.answered ?? 0))
    .slice(0, 4);
  const conf = [1, 2, 3].map((c) => {
    const xs = d.answers.filter((a) => a.conf === c);
    return { c, n: xs.length, acc: xs.length ? xs.filter((a) => a.ok).length / xs.length : 0 };
  });
  const sureWrong = d.answers.filter((a) => a.conf === 3 && !a.ok).length;
  const luckyGuesses = d.answers.filter((a) => a.conf === 1 && a.ok).length;

  return (
    <div className="stack" data-testid="dashboard">
      <h1>Progress</h1>
      <div className="card">
        <div className="grid4">
          <div className="kpi">
            <b>{d.answers.length ? Math.round((correct / d.answers.length) * 100) : 0}%</b>
            <span>accuracy ({d.answers.length} answers)</span>
          </div>
          <div className="kpi">
            <b>
              {mastered}/{total}
            </b>
            <span>mastered · {seen} seen</span>
          </div>
          <div className="kpi">
            <b>{streak(d, now)}🔥</b>
            <span>
              streak · today {answeredToday(d, now)}/{d.settings.dailyGoal}
            </span>
          </div>
          <div className="kpi">
            <b>{Math.round(avgTimeMs(d) / 1000)}s</b>
            <span>avg time / question (exam: 90 s)</span>
          </div>
        </div>
      </div>

      <div className="card stack" data-testid="estimate">
        <h2 style={{ margin: 0 }}>Estimated exam score</h2>
        {estFull.enough ? (
          <>
            <div className="grid2">
              <div className="kpi">
                <b>
                  {Math.round(estLast.mean)}/40 <span className="small muted">({Math.round(estLast.low)}–{Math.round(estLast.high)})</span>
                </b>
                <span>if it looks like last year</span>
              </div>
              <div className="kpi">
                <b>
                  {Math.round(estFull.mean)}/40 <span className="small muted">({Math.round(estFull.low)}–{Math.round(estFull.high)})</span>
                </b>
                <span>full syllabus</span>
              </div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              80 % range from your recency-weighted accuracy per chapter. It assumes the real exam resembles this bank; it narrows as you answer more. Chapters you
              never practised count as a coin flip.
            </p>
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>
            Answer at least 30 questions ({estFull.answered} so far) for an honest estimate.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Chapters</h2>
        <div className="stack" style={{ gap: 6 }}>
          {bank.chapters.map((c) => {
            const m = chM.get(c.id);
            return (
              <a key={c.id} href={`#/learn/${c.id}`} className="bar-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <b>{c.id}</b>
                <div className="progress" title={`${c.title}: ${m ? Math.round(m.p * 100) + '%' : 'no data'}`}>
                  <div style={{ width: `${m ? m.p * 100 : 0}%`, background: masteryColor(m?.p) }} />
                </div>
                <span className="small muted">{m ? `${Math.round(m.p * 100)}%` : '—'}</span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Topic heatmap</h2>
        <div className="heat">
          {bank.chapters.map((c) => (
            <div key={c.id} className="heat-row">
              <b className="small">{c.id}</b>
              <div className="heat-cells">
                {c.topics.map((t) => {
                  const m = topicM.get(`${c.id}/${t.id}`);
                  return (
                    <a
                      key={t.id}
                      className="heat-cell"
                      href={`#/learn/${c.id}/${t.id}`}
                      style={{ background: m ? masteryColor(m.p) : undefined, opacity: m ? 0.45 + 0.55 * Math.min(1, m.n / 8) : 1 }}
                      title={`${t.title}: ${m ? `${Math.round(m.p * 100)}% (${m.answered} answers, confidence ${confidenceLabel(m)})` : 'not practised'}`}
                      aria-label={`${c.id} ${t.title}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 8 }}>
          <span>
            <i style={{ background: masteryColor(0.3) }} />
            weak
          </span>
          <span>
            <i style={{ background: masteryColor(0.6) }} />
            so-so
          </span>
          <span>
            <i style={{ background: masteryColor(0.9) }} />
            strong
          </span>
          <span>
            <i style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
            no data · faded = little data
          </span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Study next</h2>
        <div className="topic-list">
          {weak.map((w) => {
            const slides = [...new Set(bank.questions.filter((q) => q.chapter === w.ch && q.topic === w.t).flatMap((q) => q.slides))].slice(0, 6);
            return (
              <a key={`${w.ch}/${w.t}`} className="topic-item" href={`#/learn/${w.ch}/${w.t}`}>
                <span className="chip">{w.ch}</span>
                <span className="grow">
                  {topicTitle(w.ch, w.t)}
                  <div className="small muted">
                    {w.m ? `${Math.round(w.m.p * 100)}% over ${w.m.answered} answers` : 'not practised yet'} · slides {slidesLabel(slides)}
                  </div>
                </span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Mock exam history</h2>
        <ScoreChart
          points={d.mocks.map((m) => ({ x: m.ts, y: m.max ? Math.max(0, m.score / m.max) : 0, label: `${variantTitle(m.variant)}: ${m.score}/${m.max}` }))}
        />
        {d.mocks.length > 0 && (
          <div className="topic-list" style={{ marginTop: 8 }}>
            {[...d.mocks].reverse().slice(0, 5).map((m) => (
              <a key={m.mid} className="topic-item" href={`#/mock/result/${m.mid}`}>
                <span className="grow small">
                  {new Date(m.ts).toLocaleDateString()} · {variantTitle(m.variant)}
                </span>
                <b>
                  {m.score}/{m.max}
                </b>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Last 14 days</h2>
        <ActivityChart days={days} />
      </div>

      {conf.some((c) => c.n > 0) && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Confidence check</h2>
          <div className="grid2">
            {conf.map((c) => (
              <div key={c.c} className="kpi">
                <b>{c.n ? `${Math.round(c.acc * 100)}%` : '—'}</b>
                <span>
                  correct when "{['Guess', 'Unsure', 'Sure'][c.c - 1]}" ({c.n})
                </span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {sureWrong} answers were wrong although you were sure (overconfidence); {luckyGuesses} lucky guesses were correct — they still go to the review
            queue.
          </p>
        </div>
      )}

      {missed.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Most missed</h2>
          <div className="topic-list">
            {missed.map((x) => {
              const q = getQ(x.id);
              if (!q) return null;
              return (
                <a key={x.id} className="topic-item" href={`#/q/${x.id}`}>
                  <span className="chip bad">
                    {x.wrong}/{x.seen}
                  </span>
                  <span className="grow small">{q.stem.replace(/[`*]/g, '').slice(0, 80)}</span>
                  <span className="chip">{q.chapter}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
