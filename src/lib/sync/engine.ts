import type { Ev } from '../../types';
import type { EventStore } from '../store';

/** Server side of the sync. Implementations: Supabase (production), HTTP mock (e2e), in-memory (unit tests). */
export interface RemoteStore {
  /** Upload events. Must be idempotent: re-sending an event that already exists is a no-op. */
  push(evs: Ev[]): Promise<void>;
  /**
   * Return every event the server received after `cursor` (an opaque string returned by a previous
   * pull; null = from the beginning). Returning some already-known events is fine (merge is a union).
   */
  pull(cursor: string | null): Promise<{ events: Ev[]; cursor: string | null }>;
}

export type SyncStatus = 'local' | 'signed-out' | 'offline' | 'pending' | 'syncing' | 'synced' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSync: number | null;
  error: string | null;
}

const PUSH_BATCH = 200;
const FULL_RESYNC_EVERY = 24 * 3600 * 1000;

/**
 * Push local events, pull remote ones, merge by union. Never deletes or rewrites anything, so a
 * device that was offline for weeks simply uploads its events and downloads the others.
 */
export class SyncEngine {
  state: SyncState = { status: 'local', pending: 0, lastSync: null, error: null };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private store: EventStore,
    private getRemote: () => RemoteStore | null,
    private opts: { isOnline?: () => boolean; configured?: boolean; now?: () => number } = {},
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  /** Recompute the status without network access (called on every store change). */
  refresh() {
    const pending = this.store.unsynced().length;
    let status: SyncStatus = this.state.status;
    if (this.opts.configured === false) status = 'local';
    else if (!this.getRemote()) status = 'signed-out';
    else if (this.opts.isOnline && !this.opts.isOnline()) status = 'offline';
    else if (status !== 'syncing' && status !== 'error') status = pending ? 'pending' : 'synced';
    if (status !== this.state.status || pending !== this.state.pending) this.set({ status, pending });
  }

  /** Debounced sync after local changes. */
  schedule(delayMs = 1500) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, delayMs);
  }

  async syncNow(full = false): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run(full).finally(() => {
      this.running = null;
    });
    await this.running;
    if (this.again) {
      this.again = false;
      await this.syncNow();
    }
  }

  private async run(full: boolean): Promise<void> {
    const remote = this.getRemote();
    this.refresh();
    if (!remote || this.opts.configured === false) return;
    if (this.opts.isOnline && !this.opts.isOnline()) return;
    this.set({ status: 'syncing', error: null });
    const now = this.opts.now ?? Date.now;
    try {
      // 1. push (in batches; each batch is marked synced only after the server accepted it)
      let unsynced = this.store.unsynced();
      while (unsynced.length) {
        const batch = unsynced.slice(0, PUSH_BATCH);
        await remote.push(batch);
        await this.store.markSynced(batch.map((e) => e.id));
        unsynced = this.store.unsynced();
      }
      // 2. pull (incremental with overlap; periodically from scratch as a safety net)
      const lastFull = (await this.store.kv.getKV<number>('sync:lastFull')) ?? 0;
      const doFull = full || now() - lastFull > FULL_RESYNC_EVERY;
      const cursor = doFull ? null : ((await this.store.kv.getKV<string>('sync:cursor')) ?? null);
      const res = await remote.pull(cursor);
      await this.store.mergeRemote(res.events);
      if (res.cursor) await this.store.kv.setKV('sync:cursor', res.cursor);
      if (doFull) await this.store.kv.setKV('sync:lastFull', now());
      this.set({ lastSync: now(), error: null, status: this.store.unsynced().length ? 'pending' : 'synced' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      this.set({ status: 'error', error: msg });
    }
    this.refresh();
  }
}
