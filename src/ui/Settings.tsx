import { useRef, useState } from 'react';
import type { Ev, Settings } from '../types';
import { authApi, getBank, store, sync, syncBackend, useAuth, useDerived, useSync } from '../lib/app';

function num(raw: string, set: (v: number) => void) {
  if (raw.trim() !== '' && Number.isFinite(Number(raw))) set(Number(raw));
}

async function setSetting<K extends keyof Settings>(k: K, v: Partial<Settings[K]> | Settings[K]) {
  await store.append({ t: 'set', k, v });
}

function SyncCard() {
  const auth = useAuth();
  const s = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack" data-testid="sync-card">
      <h2 style={{ margin: 0 }}>Sync between devices</h2>
      {syncBackend === 'none' && (
        <p className="small muted" style={{ margin: 0 }}>
          Sync is not configured in this build, so progress stays on this device (use export/import below to move it). See docs/SETUP.md to enable free Supabase
          sync.
        </p>
      )}
      {syncBackend !== 'none' && !auth.user && method === 'password' && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Use the same email and password on every device. The first time, tap <b>Create account</b> and click the confirmation link Supabase emails you
            (any browser), then come back and <b>Sign in</b>.
          </p>
          <form
            className="stack"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await authApi.signInWithPassword(email.trim(), password);
                setMsg('Signed in. Syncing…');
              });
            }}
          >
            <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (8+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <div className="row">
              <button className="btn primary" disabled={busy}>
                Sign in
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !email.includes('@') || password.length < 8}
                onClick={() =>
                  void run(async () => {
                    const signedIn = await authApi.signUp(email.trim(), password);
                    setMsg(
                      signedIn
                        ? 'Account created and signed in. Syncing…'
                        : 'Account created. Open the confirmation email (check spam), click the link once, then come back here and Sign in.',
                    );
                  })
                }
              >
                Create account
              </button>
              <button type="button" className="btn ghost small" onClick={() => setMethod('code')}>
                Use an email code instead
              </button>
            </div>
          </form>
        </>
      )}
      {syncBackend !== 'none' && !auth.user && method === 'code' && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Email code / link sign-in (needs a custom email template with the code; otherwise open the emailed link on this same device).{' '}
            <button type="button" className="btn ghost small" onClick={() => setMethod('password')}>
              Back to password
            </button>
          </p>
          {step === 'email' ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await authApi.sendCode(email.trim());
                  setStep('code');
                  setMsg('Code sent — check your inbox (and spam).');
                });
              }}
            >
              <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} autoComplete="email" />
              <button className="btn primary" disabled={busy}>
                Send code
              </button>
            </form>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await authApi.verifyCode(email.trim(), code);
                  setMsg('Signed in. Syncing…');
                });
              }}
            >
              <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: 1 }} />
              <button className="btn primary" disabled={busy || code.trim().length < 6}>
                Verify
              </button>
              <button type="button" className="btn ghost" onClick={() => setStep('email')}>
                Back
              </button>
            </form>
          )}
        </>
      )}
      {auth.user && (
        <>
          <div className="small">
            Signed in as <b>{auth.user.email}</b>
          </div>
          <div className="small muted">
            Status: <b data-testid="sync-state">{s.status}</b>
            {s.pending ? ` · ${s.pending} events waiting` : ''}
            {s.lastSync ? ` · last sync ${new Date(s.lastSync).toLocaleTimeString()}` : ''}
            {s.error ? ` · ${s.error}` : ''}
          </div>
          <div className="row">
            <button className="btn small" onClick={() => void sync.syncNow()} data-testid="sync-now">
              Sync now
            </button>
            <button className="btn small" onClick={() => void sync.syncNow(true)}>
              Full resync
            </button>
            {syncBackend === 'supabase' && (
              <button className="btn small ghost" onClick={() => void authApi.signOut()}>
                Sign out
              </button>
            )}
          </div>
        </>
      )}
      {msg && <div className="small" style={{ color: 'var(--accent)' }}>{msg}</div>}
      <div className="small muted">Device id: {store.deviceId}</div>
    </div>
  );
}

export function SettingsPage() {
  const d = useDerived();
  const s = d.settings;
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const bank = getBank();
  const counts = bank.questions.reduce<Record<string, number>>((acc, q) => ((acc[q.chapter] = (acc[q.chapter] ?? 0) + 1), acc), {});
  const exec = bank.questions.filter((q) => q.verified === 'exec').length;

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'pyquiz', version: 1, exportedAt: new Date().toISOString(), events: store.all() }, null, 1)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pyquiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importData = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      const evs: Ev[] = Array.isArray(raw) ? raw : raw.events;
      const n = await store.importEvents(evs ?? []);
      setNote(`Imported ${n} new events (duplicates are ignored).`);
    } catch (e) {
      setNote(`Import failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="stack">
      <h1>Settings</h1>
      <SyncCard />

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Exam scoring</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Unknown for the real exam: whether wrong answers cost points and how "select all" is scored. Default: +1 / 0 / 0, all-or-nothing.
        </p>
        <div className="grid2">
          <label className="field">
            Correct
            <input type="number" step="0.25" defaultValue={s.scoring.correct} onBlur={(e) => num(e.target.value, (v) => void setSetting('scoring', { correct: v }))} />
          </label>
          <label className="field">
            Wrong (e.g. -0.25)
            <input type="number" step="0.25" defaultValue={s.scoring.wrong} onBlur={(e) => num(e.target.value, (v) => void setSetting('scoring', { wrong: v }))} />
          </label>
          <label className="field">
            "I don't know"
            <input type="number" step="0.25" defaultValue={s.scoring.idk} onBlur={(e) => num(e.target.value, (v) => void setSetting('scoring', { idk: v }))} />
          </label>
          <label className="field">
            Select all that apply
            <select value={s.scoring.multi} onChange={(e) => void setSetting('scoring', { multi: e.target.value as 'all' | 'partial' })} data-testid="multi-scoring">
              <option value="all">All-or-nothing</option>
              <option value="partial">Partial credit</option>
            </select>
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            Mock duration (min)
            <input type="number" min="5" max="180" defaultValue={s.mockMinutes} onBlur={(e) => num(e.target.value, (v) => void setSetting('mockMinutes', v))} />
          </label>
          <label className="field">
            Hard mode (min)
            <input type="number" min="5" max="180" defaultValue={s.hardMinutes} onBlur={(e) => num(e.target.value, (v) => void setSetting('hardMinutes', v))} />
          </label>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Study</h2>
        <div className="grid2">
          <label className="field">
            Daily goal (answers)
            <input type="number" min="5" max="500" defaultValue={s.dailyGoal} onBlur={(e) => num(e.target.value, (v) => void setSetting('dailyGoal', v))} />
          </label>
          <label className="field">
            Theme
            <select value={s.theme} onChange={(e) => void setSetting('theme', e.target.value as Settings['theme'])}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
        <label className="row small">
          <input type="checkbox" checked={s.confidence} onChange={(e) => void setSetting('confidence', e.target.checked)} />
          Ask how confident I am (Guess / Unsure / Sure) — guesses go to the review queue even when correct
        </label>
      </div>

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Backup</h2>
        <div className="row">
          <button className="btn small" onClick={exportData}>
            Export progress (JSON)
          </button>
          <button className="btn small" onClick={() => file.current?.click()}>
            Import backup
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])} />
        </div>
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm('Reset all progress on every synced device? (Settings are kept; an exported backup can restore it.)'))
              void store.append({ t: 'reset' }).then(() => setNote('Progress reset.'));
          }}
        >
          Reset progress…
        </button>
        {note && <div className="small">{note}</div>}
      </div>

      <div className="card small muted">
        Question bank {bank.version} · {bank.questions.length} questions ({Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}) · {exec} verified by
        executing the code, the rest double-reviewed · built {new Date(bank.generatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
