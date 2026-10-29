// Application singletons: event store, content, auth and sync. UI code talks to these through hooks.
import { useMemo, useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bank, Lessons, Question } from '../types';
import { IDBPersistence, MemoryPersistence } from './persistence';
import { EventStore } from './store';
import { derive, type Derived } from './derive';
import { SyncEngine, type RemoteStore } from './sync/engine';
import { HttpMockRemote, SupabaseRemote } from './sync/remotes';

const env = import.meta.env;
const SUPA_URL = env.VITE_SUPABASE_URL as string | undefined;
const SUPA_KEY = env.VITE_SUPABASE_ANON_KEY as string | undefined;
const MOCK_SYNC = env.VITE_MOCK_SYNC_URL as string | undefined;

export const syncBackend: 'supabase' | 'mock' | 'none' = MOCK_SYNC ? 'mock' : SUPA_URL && SUPA_KEY ? 'supabase' : 'none';

// ------------------------------------------------------------------ auth
export interface AuthState {
  user: { id: string; email: string } | null;
  ready: boolean;
}
let auth: AuthState = { user: null, ready: syncBackend !== 'supabase' };
const authListeners = new Set<() => void>();
function setAuth(a: AuthState) {
  auth = a;
  authListeners.forEach((l) => l());
  sync?.refresh();
  if (a.user) sync?.schedule(200);
}
let supabase: SupabaseClient | null = null;

async function initAuth() {
  if (syncBackend === 'mock') {
    const user = new URLSearchParams(location.search).get('syncUser') || localStorage.getItem('pyquiz:mockUser') || 'tester';
    localStorage.setItem('pyquiz:mockUser', user);
    setAuth({ user: { id: user, email: `${user}@mock` }, ready: true });
    return;
  }
  if (syncBackend !== 'supabase') return;
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(SUPA_URL!, SUPA_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  setAuth({ user: u ? { id: u.id, email: u.email ?? '' } : null, ready: true });
  supabase.auth.onAuthStateChange((_evt, session) => {
    const su = session?.user;
    setAuth({ user: su ? { id: su.id, email: su.email ?? '' } : null, ready: true });
  });
  // strip ?code=... left by a magic link, keep the hash route
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
}

export const authApi = {
  async sendCode(email: string) {
    if (!supabase) throw new Error('Sync is not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(error.message);
  },
  async verifyCode(email: string, token: string) {
    if (!supabase) throw new Error('Sync is not configured');
    const { error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
    if (error) throw new Error(error.message);
  },
  async signOut() {
    await supabase?.auth.signOut();
    setAuth({ user: null, ready: true });
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (fn) => {
      authListeners.add(fn);
      return () => authListeners.delete(fn);
    },
    () => auth,
  );
}

// ------------------------------------------------------------------ store & sync
function makePersistence() {
  try {
    if (typeof indexedDB !== 'undefined') return new IDBPersistence();
  } catch {
    /* private mode without IndexedDB */
  }
  return new MemoryPersistence();
}

export const store = new EventStore(makePersistence());

function remote(): RemoteStore | null {
  if (!auth.user) return null;
  if (syncBackend === 'mock') return new HttpMockRemote(MOCK_SYNC!, auth.user.id);
  if (syncBackend === 'supabase' && supabase) return new SupabaseRemote(supabase, auth.user.id);
  return null;
}

export const sync: SyncEngine = new SyncEngine(store, remote, {
  isOnline: () => navigator.onLine,
  configured: syncBackend !== 'none',
});

// ------------------------------------------------------------------ content
let bank: Bank | null = null;
let lessons: Lessons = {};
let qById = new Map<string, Question>();

async function loadJson<T>(name: string): Promise<T> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!r.ok) throw new Error(`Cannot load ${name} (${r.status})`);
  return r.json();
}

export async function initApp(): Promise<void> {
  await store.init();
  const [b, l] = await Promise.all([loadJson<Bank>('bank.json'), loadJson<{ lessons: Lessons }>('lessons.json')]);
  bank = b;
  lessons = l.lessons;
  qById = new Map(b.questions.map((q) => [q.id, q]));
  store.subscribe(() => {
    sync.refresh();
    if (store.unsynced().length) sync.schedule();
  });
  await initAuth();
  sync.refresh();
  window.addEventListener('online', () => {
    sync.refresh();
    void sync.syncNow();
  });
  window.addEventListener('offline', () => sync.refresh());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync.syncNow();
  });
  setInterval(() => void sync.syncNow(), 60_000);
  void sync.syncNow();
}

// test hook (only in the e2e build, which talks to the local mock sync server)
if (syncBackend === 'mock') (window as unknown as Record<string, unknown>).__pyquiz = { store, sync };

export function getBank(): Bank {
  if (!bank) throw new Error('content not loaded');
  return bank;
}
export function getLessons(): Lessons {
  return lessons;
}
export function getQ(id: string): Question | undefined {
  return qById.get(id);
}
export function getQMap(): Map<string, Question> {
  return qById;
}

// ------------------------------------------------------------------ hooks
let derivedCache: { v: number; d: Derived } | null = null;
export function useDerived(): Derived {
  const v = useSyncExternalStore(store.subscribe, () => store.version);
  return useMemo(() => {
    if (!derivedCache || derivedCache.v !== v) derivedCache = { v, d: derive(store.all()) };
    return derivedCache.d;
  }, [v]);
}

export function useSync() {
  return useSyncExternalStore(sync.subscribe, () => sync.state);
}
