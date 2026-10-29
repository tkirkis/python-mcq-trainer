import { describe, expect, it } from 'vitest';
import type { Ev, EvInput } from '../src/types';
import { EventStore } from '../src/lib/store';
import { MemoryPersistence } from '../src/lib/persistence';
import { SyncEngine, type RemoteStore } from '../src/lib/sync/engine';
import { derive, dueQuestions } from '../src/lib/derive';
import { rng } from '../src/lib/select';

/**
 * In-memory server with the same contract as Supabase: idempotent inserts, rows ordered by a
 * server sequence. `lagging` simulates a transaction that commits late: its rows get a sequence
 * number lower than rows another device has already pulled.
 */
class FakeServer {
  rows: { seq: number; ev: Ev; visible: boolean }[] = [];
  seq = 0;
  lagging = false;
  pushes = 0;
  failNext = 0;

  remote(): RemoteStore {
    return {
      push: async (evs) => {
        if (this.failNext > 0) {
          this.failNext--;
          throw new Error('network glitch');
        }
        this.pushes++;
        for (const ev of evs) {
          if (this.rows.some((r) => r.ev.id === ev.id)) continue;
          this.rows.push({ seq: ++this.seq, ev: structuredClone(ev), visible: !this.lagging });
        }
      },
      pull: async (cursor) => {
        const since = cursor ? Number(cursor) : 0;
        const vis = this.rows.filter((r) => r.visible && r.seq > since);
        const max = Math.max(since, ...this.rows.filter((r) => r.visible).map((r) => r.seq));
        return { events: vis.map((r) => structuredClone(r.ev)), cursor: String(max) };
      },
    };
  }

  commitLagging() {
    for (const r of this.rows) r.visible = true;
    this.lagging = false;
  }
}

async function device(server: FakeServer, clock: { t: number }, online: { v: boolean }) {
  const store = new EventStore(new MemoryPersistence(), () => clock.t);
  await store.init();
  const sync = new SyncEngine(store, () => server.remote(), { isOnline: () => online.v, configured: true, now: () => clock.t });
  return { store, sync, online };
}

function randomEvent(r: () => number): EvInput {
  const x = r();
  const qid = `S${1 + Math.floor(r() * 8)}-${String(Math.floor(r() * 30)).padStart(4, '0')}`;
  if (x < 0.8) return { t: 'ans', q: qid, ch: ['a'], ok: r() < 0.6, ms: 1000, mode: 'practice' };
  if (x < 0.9) return { t: 'set', k: 'dailyGoal', v: 10 + Math.floor(r() * 50) };
  return {
    t: 'mock', mid: `m${Math.floor(r() * 1e6)}`, variant: 'full', score: 20, max: 40, ms: 1, limit: 2, started: 0,
    items: [{ q: qid, ch: [], ok: false, pts: 0 }], scoring: { correct: 1, wrong: 0, idk: 0, multi: 'all' },
  };
}

function snapshot(store: EventStore) {
  const d = derive(store.all());
  return {
    ids: store.all().map((e) => e.id),
    settings: d.settings,
    q: [...d.q.entries()].sort(),
    due: dueQuestions(d, 2e12),
    mocks: d.mocks.map((m) => m.mid),
  };
}

describe('two-device sync', () => {
  it('converges to the same state after random offline edits, retries and late commits', async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = rng(seed);
      const server = new FakeServer();
      const clock = { t: 1_700_000_000_000 };
      const A = await device(server, clock, { v: true });
      const B = await device(server, clock, { v: true });
      for (let step = 0; step < 60; step++) {
        clock.t += Math.floor(r() * 120_000);
        const dev = r() < 0.5 ? A : B;
        const op = r();
        if (op < 0.55) await dev.store.append(randomEvent(r));
        else if (op < 0.7) dev.online.v = !dev.online.v; // go offline / online
        else if (op < 0.75) server.failNext = 1; // next push fails
        else if (op < 0.8) server.lagging = !server.lagging;
        else if (op < 0.83) server.commitLagging();
        else await dev.sync.syncNow();
      }
      // everybody back online, delayed transactions committed, a couple of sync rounds incl. the daily full resync
      A.online.v = B.online.v = true;
      server.commitLagging();
      server.failNext = 0;
      clock.t += 25 * 3600 * 1000;
      for (let i = 0; i < 2; i++) {
        await A.sync.syncNow();
        await B.sync.syncNow();
      }
      const sa = snapshot(A.store);
      const sb = snapshot(B.store);
      expect(sa).toEqual(sb);
      expect(A.store.unsynced()).toHaveLength(0);
      expect(B.store.unsynced()).toHaveLength(0);
      expect(server.rows.length).toBe(sa.ids.length);
      expect(A.sync.state.status).toBe('synced');
    }
  });

  it('never loses an event that was appended while a push was in flight', async () => {
    const server = new FakeServer();
    const clock = { t: 1 };
    const A = await device(server, clock, { v: true });
    const slow = server.remote();
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const engine = new SyncEngine(
      A.store,
      () => ({ push: async (evs) => { await gate; await slow.push(evs); }, pull: slow.pull }),
      { configured: true, now: () => clock.t },
    );
    await A.store.append({ t: 'ans', q: 'S1-0001', ch: ['a'], ok: true, ms: 1, mode: 'practice' });
    const p = engine.syncNow();
    await A.store.append({ t: 'ans', q: 'S1-0002', ch: ['a'], ok: true, ms: 1, mode: 'practice' });
    release();
    await p;
    await engine.syncNow();
    expect(server.rows.map((x) => (x.ev.t === 'ans' ? x.ev.q : ''))).toEqual(['S1-0001', 'S1-0002']);
    expect(A.store.unsynced()).toHaveLength(0);
  });

  it('reports offline / pending / synced status', async () => {
    const server = new FakeServer();
    const clock = { t: 1 };
    const online = { v: false };
    const A = await device(server, clock, online);
    await A.store.append({ t: 'view', ch: 'S1' });
    A.sync.refresh();
    expect(A.sync.state.status).toBe('offline');
    expect(A.sync.state.pending).toBe(1);
    online.v = true;
    A.sync.refresh();
    expect(A.sync.state.status).toBe('pending');
    await A.sync.syncNow();
    expect(A.sync.state.status).toBe('synced');
  });

  it('import of a backup is idempotent', async () => {
    const server = new FakeServer();
    const clock = { t: 5 };
    const A = await device(server, clock, { v: true });
    await A.store.append({ t: 'ans', q: 'S1-0001', ch: ['a'], ok: true, ms: 1, mode: 'practice' });
    const backup = structuredClone(A.store.all());
    const B = await device(server, clock, { v: true });
    expect(await B.store.importEvents(backup)).toBe(1);
    expect(await B.store.importEvents(backup)).toBe(0);
    await B.sync.syncNow();
    await A.sync.syncNow();
    expect(server.rows).toHaveLength(1);
  });
});
