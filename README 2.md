# PyQuiz — Python MCQ exam trainer (MSc DSBA)

An offline-first web app (installable on phone and laptop) to prepare the 40-question / 1-hour
MCQ exam of the MSc DSBA Python course (F. Popineau, slides of 31/08/2025).

* **Learn** each chapter: a cheat-sheet lesson per topic, then questions easy → hard with instant
  feedback (why the answer is right, why each distractor is wrong, slide pages).
* **Practice** with filters (chapter, topic, difficulty, type, weak spots, due, never seen,
  2021-22 exam only) in 5 / 10 / 20 / endless sessions; **Smart practice** for the commute.
* **Mock exams** that copy the real platform: 40 questions, 60-minute timer, sidebar, ANSWER /
  I DON'T KNOW, no feedback until the end, resume after interruption, results per chapter, full
  review, "retry only my mistakes". Variants: *same as last year*, *full syllabus*,
  *reference replay* (the reconstructed 2021-22 exam), *hard mode*.
* **Spaced repetition**: every wrong, skipped or guessed answer enters a Leitner review queue.
* **Dashboard**: accuracy and mastery heatmap, estimated exam score with an honest range, mock
  history, streak and daily goal, confidence check (lucky guesses / overconfidence), most missed.
* **Sync** between devices (free Supabase), conflict-free (append-only events, union merge), with a
  status pill; works fully offline and without an account too.

## The question bank

| Chapter | Slides | Questions | of which past exam | Select-all | Easy / Med / Hard | Verified by execution |
|---|---|---|---|---|---|---|
| S1 Basics | 1–67 | 166 | 16 | 25 | 55 / 74 / 37 | 157 (95%) |
| S2 Functions & data structures | 68–125 | 150 | 10 | 23 | 52 / 65 / 33 | 147 (98%) |
| S3 Files, OS, modules, exceptions | 126–149 | 83 | 3 | 14 | 25 / 38 / 20 | 81 (98%) |
| S4 Under the hood: scopes, aliasing, mutability | 150–181 | 93 | 3 | 15 | 21 / 43 / 29 | 92 (99%) |
| S5 OOP & GUI | 182–213 | 106 | 6 | 17 | 31 / 49 / 26 | 100 (94%) |
| S6 NumPy, Pandas, visualization | 214–246 | 100 | 0 | 16 | 30 / 45 / 25 | 99 (99%) |
| S7 Pythonic code, testing, efficiency | 247–278 | 82 | 2 | 14 | 23 / 38 / 21 | 74 (90%) |
| S8 Web applications | 279–319 | 60 | 0 | 10 | 22 / 27 / 11 | 33 (55%) |
| **Total** | 1–319 | **840** | 40 | 134 (16%) | 259 / 379 / 202 | **783 (93%)** |

S6–S8 (not tested last year): 242 questions (29%). The other 57 are conceptual (HTTP, PEP 8, MVC, …) and were reviewed independently twice. Every question was also re-read by a second, independent reviewer (no wrong answer key found; 44 questions tightened).

Every answer key is checked by `scripts/verify_questions.py`, which **executes** the snippet of
each question in a sandboxed `python -I` subprocess (NumPy/Pandas/Matplotlib/Flask included) and
compares the real output with the marked option — and fails if a wrong option also matches. The
few purely conceptual questions were reviewed twice. The build refuses to run if anything fails.

* Past exam: `data/reference_exam.json` — the 2021-22 exam rebuilt from the screenshots. The
  answers ticked in the screenshots were **not** trusted (they were right on 19 of 39 questions);
  each page records what was ticked and whether it was right.
* Analysis of the exam (format, topics, traps, gap analysis, blueprint): [`docs/exam_analysis.md`](docs/exam_analysis.md).
* Add your own questions: [`docs/QUESTION_AUTHORING.md`](docs/QUESTION_AUTHORING.md) (JSON + `npm run verify`).

## Quick start

```bash
npm run setup
```

```bash
npm run dev
```

Deployment (GitHub Pages), sync (Supabase) and phone installation, step by step: [`docs/SETUP.md`](docs/SETUP.md).
How it works: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Plan: [`docs/PLAN.md`](docs/PLAN.md).
Progress log: [`CHANGELOG.md`](CHANGELOG.md).

| Command | |
|---|---|
| `npm run verify` | execute and check every question |
| `npm test` | unit tests (scoring, Leitner, estimates, mock blueprint, sync convergence) |
| `npm run e2e` | Playwright: feedback, multi-select, keyboard, mock timer/resume, offline, two-device sync |
| `npm run build` | strict verification + type-check + production build (`dist/`) |

Keyboard (laptop): `1`–`6` select · `Enter` check / next · `N` next · `I` I don't know ·
`G` guess / `U` unsure (confidence) · in mocks `←` `→` navigate.

## Screenshots

| | Phone | Laptop |
|---|---|---|
| Home | ![](docs/screenshots/phone/1-home.png) | ![](docs/screenshots/desktop/1-home.png) |
| Question | ![](docs/screenshots/phone/2-question.png) | ![](docs/screenshots/desktop/2-question.png) |
| Feedback | ![](docs/screenshots/phone/3-feedback.png) | ![](docs/screenshots/desktop/3-feedback.png) |
| Mock exam | ![](docs/screenshots/phone/4-mock-exam.png) | ![](docs/screenshots/desktop/4-mock-exam.png) |
| Results | ![](docs/screenshots/phone/5-mock-results.png) | ![](docs/screenshots/desktop/5-mock-results.png) |
| Dashboard | ![](docs/screenshots/phone/6-dashboard.png) | ![](docs/screenshots/desktop/6-dashboard.png) |

## Assumptions and open questions

* **Scoring of the real exam is unknown** (negative marking? partial credit for "select all"?).
  Default: +1 correct, 0 wrong, 0 "I don't know", select-all all-or-nothing. All four are settings
  (Settings → Exam scoring) and every mock records the rules it used.
* The 2025-26 exam is assumed to keep last year's format (40 × 1 point, 1 hour, online quiz).
  The *full syllabus* mock assumes the new sessions (NumPy/Pandas, Pythonic/testing, Web) may be
  tested; the *same as last year* mock does not.
* Questions are written for Python 3 (verified on 3.13; S6–S8 also on NumPy 2.1 / pandas 2.2).
  A handful reproduce last year's quirks (Python 2 `print`, typos) and say so (`quirk`).

## Known limitations

* Two past-exam items are partly reconstructed (page 23 was never captured; page 15's class
  definitions were off-screen) — flagged in the app and in the analysis.
* Conceptual questions (HTTP, PEP 8, MVC, …) cannot be executed; they were double-reviewed against
  the slides/docs instead.
* The estimated score assumes the real exam resembles this bank; treat it as a trend, not a promise.
* Sync needs a (free) Supabase project you create yourself; free projects pause after 7 days without
  traffic (a scheduled GitHub Action pings it twice a week; no data is lost if it does pause).
* On iPhone, the home-screen app and Safari have separate storage: sign in inside the installed app.
* Lessons are concise cheat-sheets written for this app, not a replacement for the slides.
