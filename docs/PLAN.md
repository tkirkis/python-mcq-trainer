# Plan

## Stack (boring on purpose)

| Concern | Choice | Why |
|---|---|---|
| App | Vite + React 18 + TypeScript, hash router, plain CSS | static build, no server, works under any sub-path (GitHub Pages) |
| Offline | `vite-plugin-pwa` (Workbox precache of app shell + question bank + lessons) | whole app usable with no network |
| Local data | IndexedDB (`idb`), append-only event log | survives restarts, source of truth on each device |
| Sync | Supabase free tier (Postgres + Auth), email OTP code / magic link | see ARCHITECTURE.md; optional — the app works fully local-only |
| Content | JSON question bank + Markdown lessons compiled at build time | static, versioned, no runtime LLM/API |
| Verification | `scripts/verify_questions.py` executes every snippet in `python -I` subprocesses | a wrong answer key is the worst bug |
| Tests | Vitest (logic, sync convergence) + Playwright (UI, offline, two-device sync, timer) | |
| Hosting | GitHub Pages via GitHub Actions (verify → build → deploy) | free, no server to keep running |

## Sync design (summary)

Every user action is an immutable event `{id, ts, dev, t, ...}` (answer, mock result, setting).
Devices push their unsynced events and pull everyone else's; merge = set union by `id`.
All derived state (spaced repetition boxes, mastery, streaks, mock history, settings) is recomputed
deterministically from the sorted event log, so two devices with the same events show the same state.
No update or delete exists on the server (append-only + row level security per user).

## Question bank generation plan

| Chapter | Slides | Target | Notes |
|---|---|---|---|
| S1 Basics | 1–67 | 150 | 40 % of last year's exam |
| S2 Functions & data structures | 68–125 | 140 | 25 % of last year's exam |
| S3 Files, OS, modules, exceptions | 126–149 | 80 | |
| S4 Scopes, aliasing, mutability | 150–181 | 90 | hardest traps |
| S5 OOP & GUI | 182–213 | 100 | 15 % of last year's exam |
| S6 NumPy, Pandas, viz | 214–246 | 100 | not tested last year |
| S7 Pythonic, testing, efficiency | 247–278 | 80 | lambda/map tested last year |
| S8 Web | 279–319 | 60 | not tested last year, mostly conceptual |
| Past exam | — | 40 | `data/reference_exam.json` |
| **Total** | | **≈ 840** | S6–S8 ≈ 30 % |

Process: one generator agent per chapter (writes `data/questions/S<n>/`, verifies by execution, self-reviews
and writes `data/lessons/S<n>.md`) → central verification → independent adversarial review pass per chapter
(ambiguity, wrong keys, near-duplicates; sets `reviewed: 2`) → `verify_questions.py --strict` must pass
before every build.

## App modes

Home (Continue / Smart practice / Mock exam / Due reviews) · Learn (lesson + instant feedback, easy→hard) ·
Practice (filters, 5/10/20 questions) · Mock exam (40 q, 60 min, sidebar, ANSWER / I DON'T KNOW, no feedback until
the end, resume, retry mistakes; variants: same as last year, full syllabus, reference replay, hard mode) ·
Review (Leitner spaced repetition) · Dashboard (heatmap, score history, estimated score, weak spots) · Settings
(scoring rules, theme, daily goal, sync account, export/import).
