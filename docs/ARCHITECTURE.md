# Architecture

```
 data/*.json, data/lessons/*.md ──► scripts/verify_questions.py ──► data/verification_report.json
            │                        (runs every snippet in python -I)          │
            └──────────────► scripts/build-content.mjs ◄───────────────────────┘
                                   │  public/data/bank.json, lessons.json
                                   ▼
                     Vite build (React + TS) + service worker (Workbox precache)
                                   │  static files → GitHub Pages
                                   ▼
   ┌──────────────────────────── browser / installed PWA ─────────────────────────────┐
   │ UI (src/ui)  ──►  EventStore (append-only log in IndexedDB)  ──►  derive()      │
   │                         ▲          │ unsynced events                (pure fold) │
   │                         │ merge    ▼                                            │
   │                       SyncEngine ── push / pull ──► RemoteStore                 │
   └───────────────────────────────────────────────────────┬─────────────────────────┘
                                                           ▼
                                 Supabase (Postgres table `events` + Auth, free tier)
```

## Content pipeline

* Questions are plain JSON (`data/reference_exam.json`, `data/questions/**`), validated against
  `data/schema/question.schema.json` and **executed** by `scripts/verify_questions.py` (see
  `docs/QUESTION_AUTHORING.md`). `npm run build` refuses to build if any question fails or if a
  conceptual question has fewer than two reviews (`--strict`).
* `scripts/build-content.mjs` strips verification-only fields, attaches the verification status
  (`exec` / `review`) and renders the Markdown lessons into HTML sections keyed by topic.
* The bank and lessons are static files precached by the service worker: no API call at runtime,
  no LLM, no server.

## Local data: an append-only event log

Every action becomes an immutable event stored in IndexedDB (`src/lib/store.ts`):

| `t` | Meaning | Main fields |
|---|---|---|
| `ans` | one answered question | question id, chosen options, correct?, "I don't know", time, mode, confidence |
| `mock` | a finished mock exam | variant, score, time, per-question items, scoring rules used |
| `set` | a settings change | key, value |
| `view` | a lesson opened (for "Continue") | chapter, topic |
| `reset` | "reset progress" marker | — |

Event ids are `<deviceId>-<time base36>-<counter>`, unique across devices. Nothing is ever edited
or deleted. All state shown in the app (review queue, mastery, streak, estimated score, mock
history, settings) is computed by pure functions in `src/lib/derive.ts` from the events sorted by
`(timestamp, id)`. Two devices holding the same set of events therefore always display exactly
the same state — this is what makes the sync conflict-free.

* Spaced repetition: Leitner boxes. A wrong, skipped ("I don't know") or self-declared *guessed*
  answer puts the question in box 1 (due in 10 min); every correct review promotes it
  (1 → 3 → 7 → 16 days) and the 5th correct review graduates it; a new mistake sends it back to box 1.
* Mastery per topic/chapter: Beta-posterior of the accuracy, each answer weighted by difficulty
  (0.8 / 1 / 1.3) and recency (half-life 14 days). The "confidence" of a mastery value is the
  effective number of answers behind it.
* Estimated score: Σ over chapters of (questions in the blueprint × posterior accuracy); the 80 %
  range adds the binomial luck of a 40-question exam and the uncertainty of each accuracy.
* Settings: last writer wins, per key, in canonical event order (also deterministic).
* "Reset progress" is itself an event, so it propagates to the other devices instead of being
  undone by the next sync.

In-progress state that only matters on one device (current practice session, mock exam being
taken, sync cursor) lives in a small key-value store in the same IndexedDB.

## Sync

Sync uses a free **Supabase** project (managed Postgres + Auth) with email + password sign-in, which
works inside an installed iOS PWA (no redirect); an emailed one-time code is also supported when a
custom SMTP server is configured. Free projects pause after 7 days without requests: the
`.github/workflows/keepalive.yml` workflow pings the database twice a week, and even while paused the
app keeps working offline and uploads afterwards.

**Protocol** (`src/lib/sync/engine.ts`, `src/lib/sync/remotes.ts`):

1. *Push*: unsynced local events are inserted in batches of 200 with
   `INSERT … ON CONFLICT DO NOTHING` (idempotent). A batch is marked synced only after the
   server acknowledged it, so a crash or a lost connection simply re-sends it later.
2. *Pull*: rows with `created_at` (server clock) greater than the last cursor **minus 10 minutes**
   (overlap that absorbs rows committed slightly out of order), paginated by 1000; merged into the
   local log by id (set union). Once a day — and on demand ("Full resync") — the pull starts
   from zero as a safety net.
3. Triggers: app start, 1.5 s after any new local event, coming back online, the app becoming
   visible again, and every 60 s.

The table is append-only: there are only SELECT and INSERT row-level-security policies for
`auth.uid() = user_id` and no UPDATE/DELETE policy, so even a buggy client cannot destroy data
(`supabase/schema.sql`). The anon key is public by design; it is injected at build time from
GitHub repository variables and is never committed.

**Status indicator** (top bar): `Local only` (sync not configured) · `Sign in to sync` ·
`Offline · n pending` · `Pending · n` · `Syncing…` · `Synced` · `Sync error` (tap → Settings).

**Tests of the guarantees** (`tests/sync.test.ts`, `e2e/app.spec.ts`):

* 25 randomised scenarios with two devices: random answers, setting changes and mock results,
  devices going offline/online, failing pushes, transactions committing late → after reconnecting,
  both devices hold the same events and derive identical state, nothing is pending, the server has
  each event exactly once.
* An event appended while a push is in flight is not lost.
* Backup import is idempotent.
* Playwright: two browser contexts (two "devices", one of them offline for a while) talking to the
  local mock server converge to the same event set.

## Offline

`vite-plugin-pwa` generates a Workbox service worker that precaches the app shell, icons,
`bank.json` and `lessons.json` (~1.1 MB). After the first visit everything works without network;
answers are stored locally and pushed later. Updates are fetched in the background and applied on
the next launch. Tested with Playwright (`context.setOffline(true)` + reload).

## Code map

| Path | What |
|---|---|
| `src/types.ts` | question, event and settings types |
| `src/lib/store.ts`, `persistence.ts` | event log + IndexedDB / in-memory persistence |
| `src/lib/derive.ts` | Leitner queue, mastery, estimated score, streaks, settings (pure) |
| `src/lib/scoring.ts` | answer checking, configurable scoring (negative marking, partial credit) |
| `src/lib/select.ts` | learn order, practice filters, smart practice, mock blueprints |
| `src/lib/sync/*` | sync engine, Supabase and mock remotes |
| `src/lib/flow.ts` | router, practice sessions, mock exam state (resume) and grading |
| `src/lib/app.ts` | singletons, auth, content loading, React hooks |
| `src/ui/*` | screens (Home, Learn, Practice/Session/Review, Mock, Dashboard, Settings) |
| `scripts/verify_questions.py` | executes and checks every question |
| `scripts/build-content.mjs` | compiles bank + lessons for the app |
| `scripts/rebalance_options.py` | spreads correct answers over a/b/c/d |
| `scripts/mock-sync-server.mjs` | local sync server for e2e tests |
