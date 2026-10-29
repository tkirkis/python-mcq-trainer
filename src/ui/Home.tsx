import { useEffect, useState } from 'react';
import { getBank, getQMap, useDerived } from '../lib/app';
import { answeredToday, dueQuestions, estimateScore, masteryBy, streak, BLUEPRINTS } from '../lib/derive';
import { loadMock, navigate, startSession, useSession, type MockState } from '../lib/flow';
import { rng, smartSet } from '../lib/select';
import { topicTitle } from './Question';

export function Home() {
  const d = useDerived();
  const session = useSession();
  const [mock, setMock] = useState<MockState | null>(null);
  useEffect(() => {
    void loadMock().then(setMock);
  }, []);
  const now = Date.now();
  const bank = getBank();
  const due = dueQuestions(d, now).length;
  const today = answeredToday(d, now);
  const goal = d.settings.dailyGoal;
  const st = streak(d, now);
  const est = estimateScore(d, getQMap(), BLUEPRINTS.full, now);

  const sessionLeft = session ? session.qids.length - Object.keys(session.results).length : 0;
  let cont: { label: string; sub: string; go: () => void };
  if (mock) {
    const answered = Object.keys(mock.answers).length;
    cont = { label: 'Continue mock exam', sub: `${answered}/${mock.qids.length} answered · ${Math.ceil((mock.limitMs - mock.elapsedMs) / 60000)} min left`, go: () => navigate('/mock/run') };
  } else if (session && sessionLeft > 0) {
    cont = { label: 'Continue', sub: `${session.title} · ${sessionLeft} left`, go: () => navigate('/session') };
  } else {
    const last = d.views[d.views.length - 1];
    cont = last
      ? { label: 'Continue learning', sub: `${last.ch} ${last.topic ? topicTitle(last.ch, last.topic) : ''}`, go: () => navigate(last.topic ? `/learn/${last.ch}/${last.topic}` : `/learn/${last.ch}`) }
      : { label: 'Start learning', sub: 'S1 Basics, lesson + questions', go: () => navigate('/learn/S1') };
  }

  const smart = () => startSession('smart', smartSet(bank.questions, d, now, rng(now)), 'Smart practice', '/');
  const reviews = () => {
    const ids = dueQuestions(d, now);
    const qm = getQMap();
    void startSession('review', ids.map((id) => qm.get(id)!).filter(Boolean), 'Due reviews', '/');
  };

  const topicM = masteryBy(d, getQMap(), (q) => `${q.chapter}/${q.topic}`, now);
  const weak = bank.chapters
    .flatMap((c) => c.topics.map((t) => ({ ch: c.id, t: t.id, m: topicM.get(`${c.id}/${t.id}`) })))
    .filter((x) => x.m && x.m.answered >= 2)
    .sort((a, b) => a.m!.p - b.m!.p)
    .slice(0, 3);

  return (
    <div className="stack">
      <div>
        <h1>Python MCQ trainer</h1>
        <p className="muted small" style={{ margin: 0 }}>
          {bank.questions.length} verified questions · 40-question / 60-minute mock exams · works offline
        </p>
      </div>
      <div className="hero-actions">
        <button className="action primary" onClick={cont.go} data-testid="continue">
          <strong>{cont.label}</strong>
          <span>{cont.sub}</span>
        </button>
        <button className="action" onClick={smart} data-testid="smart">
          <strong>Smart practice</strong>
          <span>10 questions · weak spots + reviews</span>
        </button>
        <a className="action" href="#/mock" data-testid="mock-link">
          <strong>Mock exam</strong>
          <span>40 questions · 60 min</span>
        </a>
        <button className="action" onClick={reviews} disabled={!due} data-testid="due">
          <strong>Due reviews</strong>
          <span>{due ? `${due} due today` : 'Nothing due — nice'}</span>
        </button>
      </div>

      <div className="card">
        <div className="grid4">
          <div className="kpi">
            <b>
              {today}/{goal}
            </b>
            <span>today's goal</span>
          </div>
          <div className="kpi">
            <b>{st}🔥</b>
            <span>day streak</span>
          </div>
          <div className="kpi">
            <b data-testid="kpi-answers">{d.answers.length}</b>
            <span>answers total</span>
          </div>
          <div className="kpi">
            <b>{est.enough ? `${Math.round(est.mean)}/40` : '—'}</b>
            <span>{est.enough ? `est. score (${Math.round(est.low)}–${Math.round(est.high)})` : 'est. score after 30 answers'}</span>
          </div>
        </div>
        <div className="progress" style={{ marginTop: 12 }} aria-label="Daily goal progress">
          <div style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
        </div>
      </div>

      {weak.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Study next</h2>
          <div className="topic-list">
            {weak.map((w) => (
              <a key={`${w.ch}/${w.t}`} className="topic-item" href={`#/learn/${w.ch}/${w.t}`}>
                <span className="chip">{w.ch}</span>
                <span className="grow">{topicTitle(w.ch, w.t)}</span>
                <span className="small muted">{Math.round(w.m!.p * 100)}%</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="row">
        <a className="btn small" href="#/learn">
          📖 Lessons
        </a>
        <a className="btn small" href="#/practice">
          🎯 Custom practice
        </a>
        <a className="btn small" href="#/mock">
          ⏱ Reference 2021-22 exam
        </a>
      </div>
    </div>
  );
}
