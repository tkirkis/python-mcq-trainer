# Exam analysis — "Quiz Python - MSc DSBA - 2021-2022"

Sources: 40 screenshots taken during the 2021-22 exam (2021-12-15, 14:55–14:59, i.e. the last 5 minutes
of the hour, while reviewing answers) and the 2025 course slides (`python.pdf`, 319 pages, dated 31/08/2025).

**The ticked answers in the screenshots were not trusted.** Every answer below was derived
independently and confirmed by executing the code in Python 3.13 with
`scripts/verify_questions.py` (35/40 checked by execution, 5 purely conceptual ones double-reviewed).
The machine-readable version is [`data/reference_exam.json`](../data/reference_exam.json); it is also
the "Reference replay" mock exam in the app.

## 1. What the screenshots contain

* Platform: one question per page, a sidebar of 39 pages (page 39 holds a 2-question "Exercice 39 —
  Classes"), so 40 questions × 1 point; countdown timer; `Select one` / `Select all that apply`;
  `I DON'T KNOW` next to `ANSWER`; `PREVIOUS` / `NEXT`; `END EXAM` then `SEND AND LEAVE`.
* 40 files → 39 distinct questions: `14.58.28` and `14.58.33` are the same question (page 29).
* Page 23 was never captured; only its sidebar title survives ("What will be the output of the code? x = 1…").
  It is reconstructed (PE-23, flagged `reconstructed`) as the classic `x = 123; for i in x: print(i)`.
* Page 15's class definitions were scrolled out of view; the six REPL options are exact, the
  definitions are reconstructed from the well-known source of that question (flagged `reconstructed`).
* Transcription artefacts fixed and flagged `quirk`: Python 2 `print tuple[2:]` (PE-01), double
  quotes rendered as `''Hello''` (PE-11, PE-25), `My_dictionary` vs `My_Dictionary` typo that would make
  every option a NameError (PE-34). Two options are sloppy but still have one best answer (PE-29 prints
  the sequence twice before the IndexError; PE-30 says "StackOverflowError" for Python's RecursionError).

## 2. All 40 questions, verified answer vs. ticked answer

| # | Question | Type | Chapter · topic | Slides | Diff. | Verified correct answer | Ticked in screenshot | Ticked OK? | Flags |
|---|---|---|---|---|---|---|---|---|---|
| 01 | What is the output of `print tuple[2:]` if `tuple = ( 'abcd'… | single | S2 · slicing | 90, 93 | Easy | (c) (2.23, 'john', 70.2) | (c) (2.23, 'john', 70.2) | ✅ | quirk |
| 02 | `total(initial=5, *num, **key)` called with `(100,2,3, clouds=50, stars=100)` | single | S5 · args-kwargs-advanced | 120, 207, 208 | Medium | (b) 255 | (c) 160 | ❌ |  |
| 03 | Which statement is used when a statement is required syntactically… | single | S1 · syntax-basics | 40 | Easy | (d) pass | (d) pass | ✅ |  |
| 04 | `while r in q: print('r', end=' ')` | single | S1 · loops | 36, 39 | Medium | (b) r r r r r r r r... (infinite loop) | (d) P P P P | ❌ |  |
| 05 | How can we concatenate two strings into a third string? | single | S1 · strings | 30, 192 | Medium | (b) Str3 = Str1.\_\_add\_\_(Str2) | (a) Str3 = Str1.concat(Str2) | ❌ |  |
| 06 | Will this if/elif/else raise a KeyError? | single | S1 · conditionals | 34, 97 | Medium | (b) False | (a) True | ❌ |  |
| 07 | `'python'[-3]` | single | S1 · strings | 30, 87, 90 | Easy | (d) 'h' | (c) Negative index error. | ❌ |  |
| 08 | Open `data.txt` for reading as a text file (select all) | multi | S3 · files-io | 133 | Easy | (b) open('data.txt', 'r'), (c) open('data.txt') | (b) only | ❌ |  |
| 09 | `func = lambda x: return x` | single | S7 · functional | 253, 205 | Medium | (a) SyntaxError | (a) SyntaxError | ✅ |  |
| 10 | Which `if (1, 2):` will not execute successfully | single | S1 · syntax-basics | 35, 34 | Easy | (d) unindented `print` | (d) | ✅ |  |
| 11 | class Demo with method `print(self): print(d)` | single | S5 · classes-objects | 189, 191, 169 | Medium | (b) prints "Hello" if `print(d)` → `print(self.d)` | (d) You cannot use print(self) as a function name | ❌ | quirk |
| 12 | Which `map(...)` programs won't have an error (select all) | multi | S7 · functional | 253 | Medium | (a), (c), (d) | (c), (d) | ❌ |  |
| 13 | `f(a, b=1, c=2)`; `f(2, c=2)`; `f(c=100, a=110)` | single | S2 · function-arguments | 82 | Easy | (c) a=2 b=1 c=2 / a=110 b=1 c=100 | (c) | ✅ |  |
| 14 | `a = (1, 2); a[0] += 1` | single | S2 · tuples | 93, 62 | Easy | (c) TypeError | (d) 2 | ❌ |  |
| 15 | `isinstance` with Dog subclasses (select all) | multi | S5 · inheritance | 194, 195 | Medium | (c), (d), (e) | (a), (b), (f) | ❌ | reconstructed |
| 16 | In a Python program, a control structure: | single | S1 · conditionals | 32 | Easy | (c) Directs the order of execution | (d) Defines program-specific data structures | ❌ |  |
| 17 | `try: open("testfile","r"); f.write(...)` `except IOError` / `else` | single | S3 · exceptions | 139, 140, 133 | Medium | (c) Error: could not find a file or read data | (c) | ✅ |  |
| 18 | `class B(A)` whose `__init__` doesn't call `super()`; `print(b.i)` | single | S5 · inheritance | 194, 195 | Medium | (d) AttributeError (i never created) | (d) | ✅ |  |
| 19 | `'Red' not in colors` | single | S2 · lists | 88, 28 | Easy | (a) True | (a) True | ✅ |  |
| 20 | `a = {10,9,8,7}; a.remove(14)` | single | S2 · sets | 100 | Easy | (b) KeyError | (b) | ✅ |  |
| 21 | `func(values): values[0] = 'a'` on `['b','c','d']` | single | S4 · aliasing | 173, 174 | Medium | (c) ['a', 'c', 'd'] | (b) ['b', 'c', 'd'] | ❌ |  |
| 22 | `'bar' in {...}` / `'a' in {23: 'a', ...}` | single | S2 · dicts | 97 | Medium | (b) 1 2 4 | (d) It does not generate any output. | ❌ |  |
| 23 | `x = 123; for i in x: print(i)` | single | S1 · loops | 37 | Medium | (c) TypeError: 'int' object is not iterable | — (not captured) | ? | reconstructed |
| 24 | `print(type(1/2))` | single | S1 · operators | 24, 28, 27 | Easy | (a) <class 'float'> | (d) NameError | ❌ |  |
| 25 | `min("hello world")` | single | S1 · strings | 31, 28 | Medium | (b) a blank space character | (c) None of the above. | ❌ | quirk |
| 26 | Which is a **false** statement (`int('144')==144`...) | single | S2 · conversions | 107, 28 | Easy | (a) None of the above | (a) | ✅ |  |
| 27 | Valid one-line if/else statements (select all) | multi | S1 · conditionals | 34, 35 | Medium | (b), (d) | (b), (d) | ✅ |  |
| 28 | `' '.join(['he', 'she', 'we'])` | single | S1 · strings | 31, 106 | Easy | (c) 'he she we' | (b) ['he she we'] | ❌ |  |
| 29 | `rev_func(x, length)` recursion without base case | single | S4 · recursion | 178, 87 | Hard | (a) displays 15 14 13 12 11 then IndexError | (a) | ✅ | quirk |
| 30 | `factorial` without base case | single | S4 · recursion | 178, 84 | Medium | (a) runs infinitely → stack overflow (RecursionError) | (d) Recursive Function. | ❌ | quirk |
| 31 | `try / except IndexError / else / finally` with valid index | single | S3 · exceptions | 140 | Medium | (b) Done! → Nothing is wrong! → Finally block! | (a) | ❌ |  |
| 32 | `'hello'` is the same as `"hello"` | single | S1 · strings | 22, 30 | Easy | (a) True | (a) | ✅ |  |
| 33 | Difference between `for` and `while` | single | S1 · loops | 37, 39 | Easy | (c) defined vs undefined number of iterations | (c) | ✅ |  |
| 34 | Loop over the keys of a dict and print them | single | S2 · dicts | 97 | Easy | (b) `for i in d: print(i)` | (c) `print(My_Dictionary)` | ❌ | quirk |
| 35 | Which of the following is correct about Python? | single | S1 · python-intro | 10, 62 | Easy | (b) All of the above. | (b) | ✅ |  |
| 36 | `f(x=100, y=100): return (x+y, x-y)`; `f(y=200, x=100)` | single | S2 · function-arguments | 82, 94 | Easy | (c) 300 -100 | (c) | ✅ |  |
| 37 | Which function removes an object from a list? | single | S2 · lists | 88 | Easy | (c) list.remove(obj) | (c) | ✅ |  |
| 38 | Concatenate "Hello" and integer 6 | single | S1 · operators | 27, 30 | Medium | (b) "Hello" + str(6) | (c) Both 2 and 3 | ❌ |  |
| 39a | `bobo.walk()` (inherited method) | single | S5 · inheritance | 194 | Easy | (b) \*walking\* | (b) | ✅ |  |
| 39b | `bobo.speak()` (overridden method) | single | S5 · inheritance | 194, 195 | Easy | (a) Arff! | (a) | ✅ |  |

**Score of the ticked answers: 19 / 39 visible questions correct (≈ 49 %).** 20 wrong, 1 unknown.

### Where the ticked answers went wrong (your gap list)

| Gap | Questions | The rule that was missed |
|---|---|---|
| Negative indices & string results | 07, 25, 28 | `s[-k]` is valid; `min` on a str compares characters (space < letters); `join` returns a str |
| "Select all that apply" completeness | 08, 12, 15 | every true option must be ticked (all-or-nothing): `open(f)` defaults to `'r'`; a bare `map(...)` is not an error |
| Evaluation order & short-circuit | 06, 31 | elif stops at the first true branch; `try` body runs fully before `else`, `finally` always runs |
| Mutability & aliasing | 14, 21 | tuples can't be modified (TypeError); a list passed to a function is the same object |
| Types & operators | 24, 38, 05 | `/` always gives float; str + int is a TypeError; `+` on strings is `__add__` |
| Containers' semantics | 22, 34 | `in` / iteration on a dict use the **keys** |
| Name resolution in classes | 11 | instance attributes need `self.`; naming a method `print` is legal |
| Function arguments | 02 | positional args fill named params first, extra → `*args` tuple, keywords → `**kwargs` dict |
| Loops / recursion | 04, 30 | literal `'r'` vs variable `r`; a condition that never changes = infinite loop; no base case = RecursionError |
| Vocabulary | 16 | control structure = controls the order of execution |

## 3. How the exam is built (reverse-engineered)

### Topic / chapter distribution (mapped to the 2025 slides)

| Chapter | Questions | Share | Topics seen |
|---|---|---|---|
| S1 Basics (p. 1–67) | 16 | 40 % | strings ×5, loops ×3, conditionals ×3, operators ×2, syntax ×2, python-intro |
| S2 Data structures (p. 68–125) | 10 | 25 % | dicts ×2, lists ×2, function-arguments ×2, tuples, slicing, sets, conversions |
| S3 Files/exceptions (p. 126–149) | 3 | 7.5 % | exceptions ×2, file modes |
| S4 Under the hood (p. 150–181) | 3 | 7.5 % | recursion ×2, aliasing |
| S5 OOP (p. 182–213) | 6 | 15 % | inheritance ×4, classes, *args/**kwargs |
| S6 NumPy/Pandas/viz (p. 214–246) | 0 | 0 % | — |
| S7 Pythonic/testing (p. 247–278) | 2 | 5 % | lambda, map |
| S8 Web (p. 279–319) | 0 | 0 % | — |

Note: lambda/map (S7 in the 2025 slides) *did* appear, so last year's exam was not strictly limited to S1–S5.
The 2021-22 course plan (still visible on slides 5 and 7) had "Modules. Testing. Debugging" and "Graph
analysis" sessions; the 2025 course replaced them with NumPy/Pandas/Visualization, Pythonic/Efficiency and Web
Applications (slides 151, 215, 248, 281). Those sessions are new material this year.

### Question formats

| Format | Count | Share | Examples |
|---|---|---|---|
| Predict the output of a snippet | 19 | 47.5 % | 01, 02, 07, 13, 21, 22, 24, 28, 36, 39a/b |
| "Analyze the code / what happens" (behaviour or error, described in words) | 6 | 15 % | 06, 11, 18, 20, 29, 30 |
| Which snippet is valid / does the job | 8 | 20 % | 05, 08, 10, 12, 27, 34, 37, 38 |
| Conceptual / definition / true-false fact | 7 | 17.5 % | 03, 15, 16, 26, 32, 33, 35 |

* **Select all that apply: 4 / 40 (10 %)** — 08, 12, 15, 27. Scored as one point; the screenshots do not
  show whether partial credit exists (see the app's scoring settings).
* **True/False (2 options): 2** — 06, 32.
* **The correct answer is an error/exception in 8 questions (20 %)**: SyntaxError (09), TypeError (14, 23),
  AttributeError (18), KeyError (20), IndexError (29), RecursionError (30), infinite loop (04). Error options
  appear as distractors in 8 more (05, 06, 07, 11, 24, 39a, ...). Always ask "does this even run?" first.
* **"None / All of the above"**: present in 6 questions, correct in 2 (26 "None of the above", 35 "All of the above").
* **Options**: 4 in 34 questions, 2 in 2, 5 in 3, 6 in 1.
* **Snippets**: 25 questions show a code block (others put code inline or in the options); median 4 lines,
  max 12 visible lines. No `import` anywhere: everything is core Python.
* **Wording** is generic and often sloppy, copied from public Python MCQ banks: "What is the output of…",
  "What will be the output of the (following) code?", "Find the output of the code?", "Analyze the code",
  "What happens in the below code?", "Which of the following…", "How can we / How will you…", typos
  ("What is the out of the code?", "Index out of Bond!"), Python 2 syntax, rendering artefacts. Most items are
  recognisable classics from public MCQ collections (Sanfoundry/Tutorialspoint style, Real Python's OOP quiz).
  **Consequence: the examiner tests general Python fluency, not slide trivia.**

### Difficulty (my rating)

Easy 21 (52 %), Medium 18 (45 %), Hard 1 (3 %). Most questions are *deceptively* simple: a one-line rule
hidden in a 3-6 line snippet. The time pressure is low (90 s per question).

### Distractor design (what the wrong options exploit)

| Trap | Where |
|---|---|
| Error vs. output ("it crashes" vs "it prints") | 04, 06, 07, 09, 14, 18, 20, 23, 24, 29, 30 |
| Off-by-one / wrong index origin, negative indices | 01, 07, 29 |
| Wrong return type (list vs str, int vs float) | 24, 28 |
| Mutable vs immutable, aliasing | 14, 21 |
| Default vs passed arguments, positional vs keyword | 02, 13, 36 |
| Literal vs variable (`'r'` vs `r`), case sensitivity (`Numbers`) | 04, 12 |
| Dict semantics (keys vs values) | 22, 34 |
| Control-flow order (elif chain, try/else/finally) | 06, 17, 31 |
| Inheritance lookup / overriding / missing `super().__init__` | 11, 15, 18, 39a, 39b |
| Plausible-sounding API that doesn't exist (`concat`, `pop(obj=…)`, "not in not defined") | 05, 19, 37 |
| Vocabulary confusion | 16, 33 |

## 4. From slide to question — the generalisation model

| Slide concept (pages) | How it became an exam question | Generalisation: "for topic X the examiner asks Y by testing Z" |
|---|---|---|
| Strings: indexing, methods (29–31) | `'python'[-3]`, `min("hello world")`, `' '.join(a)` | **Strings**: evaluate one expression on a literal; tests negative index arithmetic, character ordering, return type of methods |
| Operators & types (24, 27–28) | `type(1/2)`, `"Hello" + 6` | **Operators**: result *type* of an operation, implicit-conversion errors |
| if/elif/else (34) | KeyError never reached; one-line if syntax | **Conditionals**: which branch runs, does a later condition get evaluated, is the syntax legal |
| while / for (36–39) | infinite loop printing `'r'`; iterate an int | **Loops**: number of iterations, termination, what is iterable |
| pass / code blocks (35, 40) | `pass`; indentation | **Syntax**: the keyword for X, which indentation fails |
| Tuples (93) & slicing (90) | `tuple[2:]`, `a[0] += 1` | **Sequences**: slice bounds, immutability → TypeError |
| Dicts (97) & sets (100) | `in` on dicts, loop over keys, `set.remove` missing | **Containers**: membership semantics, missing key/element errors |
| Default / keyword args (82), multiple returns (94) | `f(a, b=1, c=2)`, `x, y = f(y=200, x=100)` | **Arguments**: binding of positional/keyword/default, tuple unpacking |
| *args / **kwargs (120, 207) | `total(initial=5, *num, **key)` | **Varargs**: what goes into the tuple vs dict, sum the pieces |
| Files (133) & exceptions (139–140) | open modes; `except IOError/else`; `try/except/else/finally` | **Files/exceptions**: which clauses run and in what order, default modes |
| Aliasing (173–174) | list mutated inside a function | **References**: mutation through another name is visible |
| Call stack / recursion (84, 178) | recursion without base case | **Recursion**: base case missing → error; order of prints |
| Classes (189–191) | `print(d)` vs `self.d` | **Objects**: attribute access needs `self`, AttributeError/NameError |
| Inheritance (194–195) | override, inherit, `super().__init__` missing, `isinstance` | **Inheritance**: which method runs, which attributes exist, isinstance across siblings |
| lambda / map (253) | `lambda x: return x`; `map` with a typo | **Functional**: lambda = single expression, map is lazy |
| Language overview (10) | "Which is correct about Python? → All of the above" | **Concepts**: paradigms, typing, interpreted/byte-code |

## 5. Gap analysis — slide topics not covered by last year's sample

Ranked by likelihood of appearing this year (slide emphasis × hands-on exercises × how naturally the topic
fits the exam's "short snippet + 4 options" format):

| Rank | Topic | Slides | Why likely |
|---|---|---|---|
| 1 | Comprehensions (list/dict/set/generator) | 103–106 | 4 slides + hands-on; classic MCQ material |
| 2 | Scopes: local/global/nonlocal, UnboundLocalError | 169–172 | dedicated slides with "try commenting out" puzzles |
| 3 | Copies: `copy` vs `deepcopy`, `[a]*3` sharing | 173–176 | slides show exact output puzzles + hands-on |
| 4 | List methods & slicing with steps, slice assignment | 88–91 | slide 88 literally asks "What is printed?" |
| 5 | Class vs instance attributes, special methods (`__str__`, `__getitem__`, `__call__`), `super()` | 192–197 | many printed-output examples |
| 6 | Generators, `yield`, iterators, map/filter/sorted/any/all | 250–254 | lambda/map already appeared |
| 7 | Sets operations, dict methods, enumerate/zip | 92, 97–102 | short, testable |
| 8 | NumPy shapes, axes, indexing, broadcasting, masking | 217–228 | 12 slides + 3 hands-on; new session this year |
| 9 | Pandas DataFrame, `loc`/`iloc`, filtering, NaN handling | 230–237 | 8 slides + hands-on; new session |
| 10 | Exceptions hierarchy, raise, finally with return | 139–140 | already 3 questions last year → stays in |
| 11 | JSON / pickle, `with` and file reading methods | 133–136, 256 | simple factual questions |
| 12 | Modules, `__name__ == '__main__'`, imports | 41, 66–67, 137–138 | conceptual |
| 13 | Closures / first-class functions | 81, 177 | slide 177 is an output puzzle |
| 14 | Assertions, unittest, logging levels, argparse | 255–261 | new session; conceptual + short outputs |
| 15 | HTTP, URLs, DNS, ports, Flask routes | 283–319 | 40 slides but mostly conceptual; definitions are easy MCQs |
| 16 | Efficiency, vectorization, multiprocessing, Numba | 263–269 | conceptual |
| 17 | PEP 8, Zen, docstrings, type hints, project layout | 271–278 | conceptual |
| 18 | Matplotlib/Seaborn API | 240–245 | API trivia, lower odds |
| 19 | Shell, env vars, paths, time/datetime | 129–131, 134, 142 | low emphasis |
| 20 | Hardware/interpreter walkthrough, MVC/Tk | 153–167, 199–205 | descriptive slides |

All of these get questions in the bank in the same style (≈ 30 % of the bank is S6–S8).

## 6. Exam DNA — blueprint used by the mock-exam generator

```json
{
  "questions": 40, "points_each": 1, "minutes": 60,
  "same_as_last_year": {
    "chapters": {"S1": 16, "S2": 10, "S3": 3, "S4": 3, "S5": 6, "S7": 2},
    "multi_select": 4, "difficulty_mix": {"1": 0.50, "2": 0.45, "3": 0.05}
  },
  "full_syllabus": {
    "chapters": {"S1": 9, "S2": 8, "S3": 4, "S4": 5, "S5": 5, "S6": 4, "S7": 3, "S8": 2},
    "multi_select": 6, "difficulty_mix": {"1": 0.40, "2": 0.45, "3": 0.15}
  },
  "hard_mode": {
    "chapters": "as full_syllabus", "multi_select": 8, "minutes": 45,
    "difficulty_mix": {"1": 0.10, "2": 0.40, "3": 0.50}
  },
  "reference_replay": "the 40 PE questions in their original order"
}
```

Format mix to aim for in generated questions: ~50 % predict-the-output, ~15 % "analyze / what happens",
~20 % "which snippet is valid", ~15 % conceptual; ~20 % of correct answers are an exception;
"None/All of the above" in ~10–15 % of questions; 4 options by default.

## 7. Practical advice for the exam (derived from the above)

1. Before computing an output, check whether the code runs at all (syntax, indentation, immutability,
   undefined names, wrong types). One question in five has an error as the answer.
2. In "select all that apply", evaluate every option independently — last year 3 of 4 were lost by
   ticking a subset.
3. Read literals character by character: `'r'` vs `r`, `' '` vs `''`, `Numbers` vs `numbers`.
4. `in`/`for` on a dict → keys. `/` → float. `join` → str. `sort()` → None.
5. Don't overthink sloppy wording: pick the option that matches the *intended* behaviour.
