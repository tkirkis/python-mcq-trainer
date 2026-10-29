# Changelog / progress log

## 1.0.0 — 2026-10-29

### Phase 1 — analysis
- Read the 319 slides (text extraction + rendering of image-only slides) and the 40 screenshots
  (macOS Vision OCR + visual check of every ticked answer).
- `data/reference_exam.json`: the 2021-22 exam reconstructed (39 transcribed + 1 reconstructed
  question), every answer re-derived and verified by execution; the ticked answers were right on
  19/39.
- `docs/exam_analysis.md`: question-by-question table, format/topic/difficulty statistics,
  distractor patterns, slide mapping, generalisation model, gap analysis, exam blueprint.

### Phase 2 — question bank
- Question schema, controlled topic vocabulary, `scripts/verify_questions.py` (sandboxed execution in
  `python -I`, two hash seeds, network disabled, output/truth/manual modes, near-duplicate check).
- One generator per chapter wrote questions + a cheat-sheet lesson, verifying every batch by
  execution and self-reviewing. A central pass re-verified everything, cross-checked S6–S8 on
  NumPy 2.1 / pandas 2.2, spread the correct answers evenly over a/b/c/d
  (`scripts/rebalance_options.py`), and an independent adversarial review read every question
  again (ambiguity, wrong keys, duplicates, version dependence): 840 questions re-solved blind, no
  wrong answer key found, 44 questions tightened (ambiguous stems, notes, off-chapter slide refs,
  4 near-duplicates rewritten), lessons corrected (pandas 3 copy-on-write, `__int__`, JSON keys).
- Final state: 840 questions, 783 (93 %) verified by execution, 57 conceptual reviewed twice,
  `verify_questions.py --strict --no-cache`: 0 failures, 0 warnings, 0 near-duplicates.

### Phase 3 — app
- Vite + React + TypeScript PWA, offline-first (Workbox precache), IndexedDB append-only event log.
- Learn (lessons + instant feedback), Practice (filters, 5/10/20/endless), Smart practice, Leitner
  review queue, Mock exam simulator (4 variants, timer, sidebar, ANSWER / I DON'T KNOW, resume,
  results, retry mistakes), Dashboard (heatmap, estimated score, history, confidence check, most
  missed), Settings (scoring rules, timer, theme, goal, confidence prompts, sync, export/import, reset).
- Sync: Supabase (email code / magic link), append-only table with RLS, union merge, status pill,
  keep-alive workflow; local mock server for tests.
- Tests: Vitest (scoring, Leitner, estimates, blueprints, randomised two-device convergence) and
  Playwright (feedback, multi-select, keyboard, practice, mock resume + timer expiry, offline,
  two-device sync), screenshots in `docs/screenshots/`.
