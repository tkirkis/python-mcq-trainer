import { openDB, type IDBPDatabase } from 'idb';
import type { Ev } from '../types';

/** A stored event plus its local sync flag (0 = not yet pushed to the server). */
export interface StoredEv {
  ev: Ev;
  synced: 0 | 1;
}

export interface Persistence {
  loadAll(): Promise<StoredEv[]>;
  put(items: StoredEv[]): Promise<void>;
  markSynced(ids: string[]): Promise<void>;
  getKV<T>(key: string): Promise<T | undefined>;
  setKV(key: string, value: unknown): Promise<void>;
  delKV(key: string): Promise<void>;
}

const DB_NAME = 'pyquiz';

export class IDBPersistence implements Persistence {
  private db: Promise<IDBPDatabase>;

  constructor(name = DB_NAME) {
    this.db = openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('events', { keyPath: 'ev.id' });
        db.createObjectStore('kv');
      },
    });
  }

  async loadAll(): Promise<StoredEv[]> {
    return (await this.db).getAll('events');
  }

  async put(items: StoredEv[]): Promise<void> {
    const tx = (await this.db).transaction('events', 'readwrite');
    await Promise.all([...items.map((i) => tx.store.put(i)), tx.done]);
  }

  async markSynced(ids: string[]): Promise<void> {
    const tx = (await this.db).transaction('events', 'readwrite');
    for (const id of ids) {
      const cur = (await tx.store.get(id)) as StoredEv | undefined;
      if (cur && !cur.synced) await tx.store.put({ ...cur, synced: 1 });
    }
    await tx.done;
  }

  async getKV<T>(key: string): Promise<T | undefined> {
    return (await this.db).get('kv', key) as Promise<T | undefined>;
  }

  async setKV(key: string, value: unknown): Promise<void> {
    await (await this.db).put('kv', value, key);
  }

  async delKV(key: string): Promise<void> {
    await (await this.db).delete('kv', key);
  }
}

/** In-memory implementation used by unit tests and as a fallback when IndexedDB is unavailable. */
export class MemoryPersistence implements Persistence {
  events = new Map<string, StoredEv>();
  kv = new Map<string, unknown>();

  async loadAll() {
    return [...this.events.values()].map((e) => ({ ...e }));
  }
  async put(items: StoredEv[]) {
    for (const i of items) this.events.set(i.ev.id, { ...i });
  }
  async markSynced(ids: string[]) {
    for (const id of ids) {
      const cur = this.events.get(id);
      if (cur) cur.synced = 1;
    }
  }
  async getKV<T>(key: string) {
    return structuredClone(this.kv.get(key)) as T | undefined;
  }
  async setKV(key: string, value: unknown) {
    this.kv.set(key, structuredClone(value));
  }
  async delKV(key: string) {
    this.kv.delete(key);
  }
}
