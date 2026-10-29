import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ev } from '../../types';
import type { RemoteStore } from './engine';

const PAGE = 1000;
/** Re-read this much history on each incremental pull, to catch rows committed slightly out of order. */
const OVERLAP_MS = 10 * 60 * 1000;

/**
 * Supabase table `events` (see supabase/schema.sql): append-only, primary key (user_id, id),
 * row-level security restricts every user to their own rows, no UPDATE/DELETE policy exists.
 */
export class SupabaseRemote implements RemoteStore {
  constructor(private sb: SupabaseClient, private userId: string) {}

  async push(evs: Ev[]): Promise<void> {
    const rows = evs.map((e) => ({ id: e.id, user_id: this.userId, device_id: e.dev, ts: e.ts, body: e }));
    const { error } = await this.sb.from('events').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async pull(cursor: string | null): Promise<{ events: Ev[]; cursor: string | null }> {
    const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
    const events: Ev[] = [];
    let max = cursor;
    for (let offset = 0; ; offset += PAGE) {
      let q = this.sb
        .from('events')
        .select('id, body, created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (since) q = q.gt('created_at', since);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        events.push(row.body as Ev);
        if (!max || Date.parse(row.created_at) > Date.parse(max)) max = row.created_at;
      }
      if (!data || data.length < PAGE) break;
    }
    return { events, cursor: max };
  }
}

/** Tiny HTTP protocol served by scripts/mock-sync-server.mjs, used by the end-to-end tests. */
export class HttpMockRemote implements RemoteStore {
  constructor(private base: string, private user: string) {}

  async push(evs: Ev[]): Promise<void> {
    const r = await fetch(`${this.base}/push?user=${encodeURIComponent(this.user)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: evs }),
    });
    if (!r.ok) throw new Error(`push failed: ${r.status}`);
  }

  async pull(cursor: string | null): Promise<{ events: Ev[]; cursor: string | null }> {
    const r = await fetch(`${this.base}/pull?user=${encodeURIComponent(this.user)}&since=${cursor ?? 0}`);
    if (!r.ok) throw new Error(`pull failed: ${r.status}`);
    return r.json();
  }
}
