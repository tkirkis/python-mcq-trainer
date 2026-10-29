import type { Ev, EvInput } from '../types';
import type { Persistence, StoredEv } from './persistence';

/** Total order used everywhere state is derived: identical on every device. */
export function compareEv(a: Ev, b: Ev): number {
  return a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function randomId(len = 10): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Append-only event log. Events are immutable and globally unique (`<device>-<time>-<counter>`),
 * so merging logs from several devices is a plain set union - there is nothing to conflict on.
 */
export class EventStore {
  private byId = new Map<string, StoredEv>();
  private sorted: Ev[] | null = null;
  private listeners = new Set<() => void>();
  private counter = 0;
  version = 0;
  deviceId = '';

  constructor(private persistence: Persistence, private now: () => number = Date.now) {}

  async init(): Promise<void> {
    let dev = await this.persistence.getKV<string>('deviceId');
    if (!dev) {
      dev = 'd' + randomId(8);
      await this.persistence.setKV('deviceId', dev);
    }
    this.deviceId = dev;
    for (const s of await this.persistence.loadAll()) this.byId.set(s.ev.id, s);
    this.bump();
  }

  get kv() {
    return this.persistence;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private bump() {
    this.sorted = null;
    this.version++;
    for (const l of this.listeners) l();
  }

  /** All events in canonical order. */
  all(): Ev[] {
    if (!this.sorted) this.sorted = [...this.byId.values()].map((s) => s.ev).sort(compareEv);
    return this.sorted;
  }

  unsynced(): Ev[] {
    return [...this.byId.values()].filter((s) => !s.synced).map((s) => s.ev).sort(compareEv);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  async append(inputs: EvInput | EvInput[]): Promise<Ev[]> {
    const list = Array.isArray(inputs) ? inputs : [inputs];
    const ts = this.now();
    const evs = list.map(
      (inp) => ({ ...inp, id: `${this.deviceId}-${ts.toString(36)}-${(this.counter++).toString(36)}`, ts, dev: this.deviceId }) as Ev,
    );
    const stored = evs.map((ev) => ({ ev, synced: 0 as const }));
    for (const s of stored) this.byId.set(s.ev.id, s);
    await this.persistence.put(stored);
    this.bump();
    return evs;
  }

  /** Merge events received from the server (union by id). Returns how many were new. */
  async mergeRemote(evs: Ev[]): Promise<number> {
    const fresh = evs.filter((e) => e && typeof e.id === 'string' && !this.byId.has(e.id)).map((ev) => ({ ev, synced: 1 as const }));
    if (!fresh.length) return 0;
    for (const s of fresh) this.byId.set(s.ev.id, s);
    await this.persistence.put(fresh);
    this.bump();
    return fresh.length;
  }

  /** Import events from a backup file: unknown ones are added as unsynced (the server dedups by id). */
  async importEvents(evs: Ev[]): Promise<number> {
    const valid = evs.filter((e) => e && typeof e.id === 'string' && typeof e.ts === 'number' && typeof e.t === 'string');
    const fresh = valid.filter((e) => !this.byId.has(e.id)).map((ev) => ({ ev, synced: 0 as const }));
    if (!fresh.length) return 0;
    for (const s of fresh) this.byId.set(s.ev.id, s);
    await this.persistence.put(fresh);
    this.bump();
    return fresh.length;
  }

  async markSynced(ids: string[]): Promise<void> {
    for (const id of ids) {
      const s = this.byId.get(id);
      if (s) s.synced = 1;
    }
    await this.persistence.markSynced(ids);
    for (const l of this.listeners) l();
  }
}
