# Question authoring guide

This is the contract for every question in the bank: how to write one, how it is verified, and
how to add your own (for example a new past-exam question). If a question does not pass
`scripts/verify_questions.py`, the app build fails.

## Where questions live

| File | Content |
|---|---|
| `data/reference_exam.json` | The reconstructed 2021-22 exam (`PE-01` ... `PE-39b`, `source: "past_exam"`) |
| `data/questions/S<n>/part-XX.json` | Generated questions for chapter S<n>, a JSON **list** of question objects |
| `data/questions/extra/*.json` | Your own additions (any file name; same format) |
| `data/lessons/S<n>.md` | The chapter cheat-sheet, one `## Title {#topic}` section per topic |
| `data/topics.json` | Controlled topic vocabulary per chapter (mastery is tracked per topic) |
| `data/schema/question.schema.json` | JSON Schema of a question |

All JSON files under `data/questions/` are merged at build time (`npm run content`).

## Adding a question in 3 steps

1. Append an object to a file in `data/questions/extra/` (create `mine.json` containing `[ ... ]`).
   Use a free id in your chapter, e.g. `S2-0901` (ids 0900-0999 are reserved for your own questions).
2. Run `npm run verify` (or `.venv/bin/python scripts/verify_questions.py --files data/questions/extra/mine.json`).
   It executes the code and tells you if the marked answer is wrong or ambiguous.
3. Run `npm run build` (or just push: the deploy workflow verifies and builds).

## The question object

```json
{
  "id": "S4-0123",
  "chapter": "S4",
  "topic": "aliasing",
  "tags": ["mutability", "list"],
  "type": "single",
  "difficulty": 2,
  "source": "generated",
  "stem": "What is the output of the following code?",
  "code": "a = [1, 2]\nb = a\nb.append(3)\nprint(a)",
  "options": [
    {"id": "a", "text": "[1, 2]"},
    {"id": "b", "text": "[1, 2, 3]"},
    {"id": "c", "text": "[3, 1, 2]"},
    {"id": "d", "text": "AttributeError", "out": "!AttributeError"}
  ],
  "correct": ["b"],
  "explanation": "`b = a` does not copy: both names refer to the same list, so appending through b is visible through a.",
  "distractor_notes": {
    "a": "Assumes assignment copies the list (it only binds a second name).",
    "c": "append adds at the end, not at the front.",
    "d": "Lists do have append."
  },
  "slides": [173, 174],
  "verify": {"mode": "output"},
  "reviewed": 1
}
```

Field rules:

* `id`: `S<n>-<4 digits>` (unique), or `PE-xx` for past-exam questions.
* `topic`: must be one of the topic slugs of that chapter in `data/topics.json`.
* `type`: `single` (exactly one correct option) or `multi` ("Select all that apply", one or more correct).
* `difficulty`: 1 easy (one rule, one step), 2 medium (2-3 steps or one classic trap), 3 hard (several interacting traps or subtle semantics).
* `stem`: the question sentence. Inline code with backticks, `**bold**` allowed. Do not repeat the code block in the stem.
* `code`: the snippet shown in a code block (`null` if none). Exact whitespace matters: use `\n` and 4-space indentation.
* `options`: 2-6 options with ids `a`, `b`, `c`... in order. `"mono": true` renders the option as code (use it for any option that is code or program output). Option texts must be distinct.
* `explanation`: why the right answer is right, in 1-4 sentences, stating the rule.
* `distractor_notes`: one entry per **wrong** option: which misconception it targets / why it is wrong.
* `slides`: page numbers of `python.pdf` that teach the concept.
* `quirk` + `quirk_note`: only for deliberately reproduced exam sloppiness (e.g. Python 2 `print x`). Rare.
* `reviewed`: number of independent review passes (author self-review = 1, adversarial review = 2).

## Verification modes (`verify.mode`)

Every execution happens in a fresh `python -I` subprocess, in an empty temporary directory, without
network, twice (with `PYTHONHASHSEED=0` and `1`). NumPy, Pandas, Matplotlib (Agg backend), Seaborn,
Flask and requests are installed in `.venv`.

The **signature** of a run is its stdout (trailing spaces of each line and trailing blank lines removed),
followed by a last line `!ExceptionName` if it raised. A program that prints `1` then raises
`ZeroDivisionError` has signature `1\n!ZeroDivisionError`. Expected exceptions match subclasses
(`!SyntaxError` matches an IndentationError, `!OSError` matches FileNotFoundError, `!LookupError` matches KeyError).

### `output` - predict-the-output questions (most questions)

Runs `verify.code` if given, else `code` (with `verify.setup` prepended if given).
Each option has an `out` = the signature it stands for. **`out` defaults to the option `text`.**

* Error options: `"text": "TypeError", "out": "!TypeError"`.
* Output + error: `"out": "15\n!IndexError"`.
* Infinite loop: `"out": "!Timeout"`, plus `verify.timeout` (e.g. 2) and optional `verify.prefix` (expected start of the output).
* Descriptive options ("The program prints the list reversed", "None of the above"): `"out": null`.
  If the **correct** option is descriptive you must give `expected_output` (the real signature), which is checked.
* Expression snippets: if `code` is an expression like `'python'[-3]` (REPL style), give
  `verify.code` that prints it, e.g. `print(repr('python'[-3]))`, and write the option `out` as the repr.

The verifier fails if a correct option does not match the real output, or if a **wrong** option matches it
(that would be two defensible answers).

### `truth` - "which of these are true / valid / raise an error" (all multi-select questions)

Each option gets its own program: `verify.setup` (defaults to `code`) + the option `probe`
(or `verify.probe_template` in which `__OPTION__` is replaced by `repr(option text)` and
`__OPTION_RAW__` by the raw option text). The option is **true** when the probe prints `True` as its last
line without raising. The set of true options must equal `correct`.

Useful templates:

```text
# "Which snippets run without error?"
"setup": "numbers = [1, 2, 3]", "probe_template": "__OPTION_RAW__\nprint(True)"

# "Which are syntactically valid?"
"probe_template": "try:\n    compile(__OPTION__, 'q', 'exec')\n    print(True)\nexcept SyntaxError:\n    print(False)"

# "Which expressions evaluate to True?"
"probe_template": "print((__OPTION_RAW__) is True)"

# statements about an object: one probe per option
{"id": "a", "text": "`a` and `b` are the same object", "probe": "print(a is b)"}
```

For "Which statement is **false**?" questions, probes print True when the option is the false statement.

### `manual` - conceptual questions that cannot be executed

Definitions, HTTP status codes, PEP 8, MVC... Must have `verify.reference` (slide page or doc section)
and need 2 independent reviews (`"reviewed": 2`) before `--strict` verification accepts them. Prefer
`truth` probes whenever a statement *can* be checked by code (e.g. "`json.dumps` returns a str").

### Determinism rules (the verifier enforces some of them)

* Never print a `set` of strings (order depends on the hash seed) - print `sorted(s)` or test membership. Sets of small ints are fine.
* No `id()` values, memory addresses, timings, `random` without a seed, `input()`, network, or absolute paths.
* For files: `verify.files` creates input files in the temp dir: `"files": {"data.txt": "line1\nline2\n"}`.
* NumPy: print arrays with `print(arr)` (gives `[1 2 3]`), shapes with `print(arr.shape)`, scalars with `print(x)` -
  never rely on the `repr` of NumPy scalars (`np.int64(5)` in NumPy 2 vs `5` in NumPy 1).
* Pandas: prefer printing scalars, `.tolist()`, `.shape`, `list(df.columns)` over whole DataFrames
  (column alignment varies); if you print a Series/DataFrame, keep it tiny.
* Flask: use `app.test_client()`; never call `app.run()`.

## Style: mimic the real exam (see docs/exam_analysis.md)

* Stems are short and generic: "What is the output of the following code?", "What will be the output of the code?",
  "Find the output of the code?", "Analyze the code", "What happens in the below code?", "Which of the following ...",
  "True or False: ...", "Select all that apply".
* 4 options by default (sometimes 2 for True/False, 3 or 5). About 15-20% multi-select.
* Snippets are 1-12 lines, often deceptively simple. The trap is usually a single subtle rule.
* Use real misconceptions as distractors: off-by-one / slice end exclusive, negative indices, `/` vs `//`,
  `==` vs `is`, mutable default arguments, aliasing vs copy, string immutability, `sorted()` vs `.sort()` returning None,
  `in` on dicts tests keys, truthiness of `[]`/`0`/`''`, short-circuit evaluation, LEGB/UnboundLocalError, class vs
  instance attributes, `super()`, generator exhaustion, broadcasting shape errors, `loc` vs `iloc`, Error vs output.
* "Error" options name the exception (`TypeError`, `NameError`...) because that is what the exam does.
* Include some "None of the above" / "All of the above" / "Which is false" questions, with genuinely correct use.
* Never two defensible answers in a single-choice question. When in doubt, make it `multi` or rewrite.
* Python 3 semantics only (except rare `quirk: true` questions).
* Never copy slide text verbatim; paraphrase and invent new snippets.
