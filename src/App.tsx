import { useEffect, useState, type ReactNode } from 'react';
import { useDerived, useSync, syncBackend } from './lib/app';
import { useRoute, navigate } from './lib/flow';
import { Home } from './ui/Home';
import { LearnIndex, ChapterPage, TopicPage } from './ui/Learn';
import { PracticeSetup, SessionPage, ReviewPage, QuestionPage } from './ui/Practice';
import { MockSetup, MockRunner, MockResults } from './ui/Mock';
import { Dashboard } from './ui/Dashboard';
import { SettingsPage } from './ui/Settings';

const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  learn: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" />,
  practice: <path d="M5 12l4 4L19 6" />,
  mock: <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />,
  stats: <path d="M5 20V10M12 20V4M19 20v-7" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Home', icon: 'home', match: '' },
  { to: '/learn', label: 'Learn', icon: 'learn', match: 'learn' },
  { to: '/practice', label: 'Practice', icon: 'practice', match: 'practice' },
  { to: '/mock', label: 'Mock exam', icon: 'mock', match: 'mock' },
  { to: '/dashboard', label: 'Progress', icon: 'stats', match: 'dashboard' },
];

export function SyncPill() {
  const s = useSync();
  const label =
    s.status === 'local'
      ? 'Local only'
      : s.status === 'signed-out'
        ? 'Sign in to sync'
        : s.status === 'offline'
          ? s.pending
            ? `Offline · ${s.pending} pending`
            : 'Offline'
          : s.status === 'pending'
            ? `Pending · ${s.pending}`
            : s.status === 'syncing'
              ? 'Syncing…'
              : s.status === 'error'
                ? 'Sync error'
                : 'Synced';
  return (
    <button
      className={`sync-pill ${s.status}`}
      onClick={() => navigate('/settings')}
      title={s.error ?? (s.lastSync ? `Last sync ${new Date(s.lastSync).toLocaleTimeString()}` : 'Sync status')}
      data-testid="sync-status"
      data-status={s.status}
    >
      <i />
      {label}
    </button>
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

export function App() {
  const route = useRoute();
  const d = useDerived();
  const online = useOnline();
  const theme = d.settings.theme;
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [r0, r1, r2] = route;
  // the mock runner is full-screen like the real exam
  const examMode = r0 === 'mock' && r1 === 'run';
  let page: ReactNode;
  switch (r0) {
    case undefined:
      page = <Home />;
      break;
    case 'learn':
      page = r2 ? <TopicPage ch={r1} topic={r2} /> : r1 ? <ChapterPage ch={r1} /> : <LearnIndex />;
      break;
    case 'practice':
      page = <PracticeSetup />;
      break;
    case 'session':
      page = <SessionPage />;
      break;
    case 'review':
      page = <ReviewPage />;
      break;
    case 'q':
      page = <QuestionPage id={r1} />;
      break;
    case 'mock':
      page = r1 === 'run' ? <MockRunner /> : r1 === 'result' ? <MockResults mid={r2} /> : <MockSetup />;
      break;
    case 'dashboard':
      page = <Dashboard />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
          <span>PyQuiz</span>
        </a>
        {!examMode && (
          <nav className="topnav" aria-label="Main">
            {NAV.map((n) => (
              <a key={n.to} href={`#${n.to}`} className={(r0 ?? '') === n.match ? 'active' : ''}>
                {n.label}
              </a>
            ))}
          </nav>
        )}
        <span className="spacer" />
        {syncBackend !== 'none' || !examMode ? <SyncPill /> : null}
        {!examMode && (
          <a href="#/settings" className="btn ghost small" aria-label="Settings">
            ⚙︎
          </a>
        )}
      </header>
      {!online && <div className="offline-banner" data-testid="offline-banner">You are offline — everything still works, progress will sync later.</div>}
      <main>{page}</main>
      {!examMode && (
        <nav className="bottomnav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={(r0 ?? '') === n.match ? 'active' : ''}>
              <Icon name={n.icon} />
              {n.label === 'Mock exam' ? 'Mock' : n.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
