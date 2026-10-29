# The 2021-22 exam: format, patterns and blueprint

This guide describes the 2021-22 Python MCQ exam (reconstructed in
[`data/reference_exam.json`](../data/reference_exam.json) and available in the app as the
*Reference replay* mock exam) and how its questions map to the course slides. Every answer below is
verified by executing the code (`scripts/verify_questions.py`); the conceptual ones were reviewed twice.

## 1. Format

* 40 questions, 1 point each, about 1 hour, on an online quiz platform.
* One question per page with a sidebar listing every page; a countdown timer.
* `Select one` and `Select all that apply` questions.
* `ANSWER` validates the current choice; `I DON'T KNOW` skips it; `PREVIOUS` / `NEXT` to navigate;
  `END EXAM` then `SEND AND LEAVE`.
* Page 39 contains two questions on the same class definitions (39a, 39b).

Notes on the transcription: PE-15 (class definitions) and PE-23 (only its first words are known) are
partly reconstructed. Obvious artefacts of the original are fixed and flagged as *quirks* in the app:
Python 2 `print` (PE-01), double quotes rendered as `''` (PE-11, PE-25), a variable-name typo (PE-34),
and two sloppy options that still have one best answer (PE-29, PE-30).

## 2. The 40 questions

| # | Question | Type | Chapter · topic | Slides | Diff. | Answer |
|---|---|---|---|---|---|---|
| 01 | What is the output of `print tuple[2:]` if `tuple = ( 'abcd'… | single | S2 · slicing | 90, 93 | Easy | (c) (2.23, 'john', 70.2) |
| 02 | `total(initial=5, *num, **key)` called with `(100,2,3, clouds=50, stars=100)` | single | S5 · args-kwargs-advanced | 120, 207, 208 | Medium | (b) 255 |
| 03 | Which statement is used when a statement is required syntactically… | single | S1 · syntax-basics | 40 | Easy | (d) pass |
| 04 | `while r in q: print('r', end=' ')` | single | S1 · loops | 36, 39 | Medium | (b) r r r r r r r r... (infinite loop) |
| 05 | How can we concatenate two strings into a third string? | single | S1 · strings | 30, 192 | Medium | (b) Str3 = Str1.\_\_add\_\_(Str2) |
| 06 | Will this if/elif/else raise a KeyError? | single | S1 · conditionals | 34, 97 | Medium | (b) False |
| 07 | `'python'[-3]` | single | S1 · strings | 30, 87, 90 | Easy | (d) 'h' |
| 08 | Open `data.txt` for reading as a text file (select all) | multi | S3 · files-io | 133 | Easy | (b) open('data.txt', 'r'), (c) open('data.txt') |
| 09 | `func = lambda x: return x` | single | S7 · functional | 253, 205 | Medium | (a) SyntaxError |
| 10 | Which `if (1, 2):` will not execute successfully | single | S1 · syntax-basics | 35, 34 | Easy | (d) unindented `print` |
| 11 | class Demo with method `print(self): print(d)` | single | S5 · classes-objects | 189, 191, 169 | Medium | (b) prints "Hello" if `print(d)` → `print(self.d)` |
| 12 | Which `map(...)` programs won't have an error (select all) | multi | S7 · functional | 253 | Medium | (a), (c), (d) |
| 13 | `f(a, b=1, c=2)`; `f(2, c=2)`; `f(c=100, a=110)` | single | S2 · function-arguments | 82 | Easy | (c) a=2 b=1 c=2 / a=110 b=1 c=100 |
| 14 | `a = (1, 2); a[0] += 1` | single | S2 · tuples | 93, 62 | Easy | (c) TypeError |
| 15 | `isinstance` with Dog subclasses (select all) | multi | S5 · inheritance | 194, 195 | Medium | (c), (d), (e) |
| 16 | In a Python program, a control structure: | single | S1 · conditionals | 32 | Easy | (c) Directs the order of execution |
| 17 | `try: open("testfile","r"); f.write(...)` `except IOError` / `else` | single | S3 · exceptions | 139, 140, 133 | Medium | (c) Error: could not find a file or read data |
| 18 | `class B(A)` whose `__init__` doesn't call `super()`; `print(b.i)` | single | S5 · inheritance | 194, 195 | Medium | (d) AttributeError (i never created) |
| 19 | `'Red' not in colors` | single | S2 · lists | 88, 28 | Easy | (a) True |
| 20 | `a = {10,9,8,7}; a.remove(14)` | single | S2 · sets | 100 | Easy | (b) KeyError |
| 21 | `func(values): values[0] = 'a'` on `['b','c','d']` | single | S4 · aliasing | 173, 174 | Medium | (c) ['a', 'c', 'd'] |
| 22 | `'bar' in {...}` / `'a' in {23: 'a', ...}` | single | S2 · dicts | 97 | Medium | (b) 1 2 4 |
| 23 | `x = 123; for i in x: print(i)` | single | S1 · loops | 37 | Medium | (c) TypeError: 'int' object is not iterable |
| 24 | `print(type(1/2))` | single | S1 · operators | 24, 28, 27 | Easy | (a) <class 'float'> |
| 25 | `min("hello world")` | single | S1 · strings | 31, 28 | Medium | (b) a blank space character |
| 26 | Which is a **false** statement (`int('144')==144`...) | single | S2 · conversions | 107, 28 | Easy | (a) None of the above |
| 27 | Valid one-line if/else statements (select all) | multi | S1 · conditionals | 34, 35 | Medium | (b), (d) |
| 28 | `' '.join(['he', 'she', 'we'])` | single | S1 · strings | 31, 106 | Easy | (c) 'he she we' |
| 29 | `rev_func(x, length)` recursion without base case | single | S4 · recursion | 178, 87 | Hard | (a) displays 15 14 13 12 11 then IndexError |
| 30 | `factorial` without base case | single | S4 · recursion | 178, 84 | Medium | (a) runs infinitely → stack overflow (RecursionError) |
| 31 | `try / except IndexError / else / finally` with valid index | single | S3 · exceptions | 140 | Medium | (b) Done! → Nothing is wrong! → Finally block! |
| 32 | `'hello'` is the same as `"hello"` | single | S1 · strings | 22, 30 | Easy | (a) True |
| 33 | Difference between `for` and `while` | single | S1 · loops | 37, 39 | Easy | (c) defined vs undefined number of iterations |
| 34 | Loop over the keys of a dict and print them | single | S2 · dicts | 97 | Easy | (b) `for i in d: print(i)` |
| 35 | Which of the following is correct about Python? | single | S1 · python-intro | 10, 62 | Easy | (b) All of the above. |
| 36 | `f(x=100, y=100): return (x+y, x-y)`; `f(y=200, x=100)` | single | S2 · function-arguments | 82, 94 | Easy | (c) 300 -100 |
| 37 | Which function removes an object from a list? | single | S2 · lists | 88 | Easy | (c) list.remove(obj) |
| 38 | Concatenate "Hello" and integer 6 | single | S1 · operators | 27, 30 | Medium | (b) "Hello" + str(6) |
| 39a | `bobo.walk()` (inherited method) | single | S5 · inheritance | 194 | Easy | (b) \*walking\* |
| 39b | `bobo.speak()` (overridden method) | single | S5 · inheritance | 194, 195 | Easy | (a) Arff! |

## 3. How the exam is built

### Chapters

| Chapter | Questions | Share | Topics |
|---|---|---|---|
| S1 Basics (p. 1–67) | 16 | 40 % | strings ×5, loops ×3, conditionals ×3, operators ×2, syntax ×2, python-intro |
| S2 Functions & data structures (p. 68–125) | 10 | 25 % | dicts ×2, lists ×2, function arguments ×2, tuples, slicing, sets, conversions |
| S3 Files, OS, modules, exceptions (p. 126–149) | 3 | 7.5 % | exceptions ×2, file modes |
| S4 Scopes, aliasing, mutability (p. 150–181) | 3 | 7.5 % | recursion ×2, aliasing |
| S5 OOP & GUI (p. 182–213) | 6 | 15 % | inheritance ×4, classes, *args/**kwargs |
| S6 NumPy, Pandas, visualization (p. 214–246) | 0 | 0 % | — |
| S7 Pythonic code, testing, efficiency (p. 247–278) | 2 | 5 % | lambda, map |
| S8 Web applications (p. 279–319) | 0 | 0 % | — |

The course has since added sessions on NumPy/Pandas/visualization, Pythonic code/efficiency and web
applications (S6–S8); they are covered by the *Full syllabus* mock exam.

### Question formats

| Format | Count | Share | Examples |
|---|---|---|---|
| Predict the output of a snippet | 19 | 47.5 % | 01, 02, 07, 13, 21, 22, 24, 28, 36, 39a/b |
| "Analyze the code / what happens" (behaviour or error, described in words) | 6 | 15 % | 06, 11, 18, 20, 29, 30 |
| Which snippet is valid / does the job | 8 | 20 % | 05, 08, 10, 12, 27, 34, 37, 38 |
| Conceptual / definition / true-false fact | 7 | 17.5 % | 03, 15, 16, 26, 32, 33, 35 |

* **Select all that apply: 4 / 40 (10 %)** — 08, 12, 15, 27.
* **True/False: 2** — 06, 32.
* **The correct answer is an error in 8 questions (20 %)**: SyntaxError (09), TypeError (14, 23),
  AttributeError (18), KeyError (20), IndexError (29), RecursionError (30), infinite loop (04).
* **"None / All of the above"** appears in 6 questions and is correct in 2 (26, 35).
* **Options**: 4 in 34 questions, 2 in 2, 5 in 3, 6 in 1.
* **Snippets**: 25 questions show a code block; median 4 lines, at most 12. No `import`: everything is core Python.
* **Wording** is generic ("What is the output of…", "Find the output of the code?", "Analyze the code",
  "What happens in the below code?", "Which of the following…"), in the style of classic public Python MCQ
  collections: the exam tests general Python fluency rather than slide trivia.
* **Difficulty**: Easy 21, Medium 18, Hard 1 — most questions are deceptively simple: one rule hidden in
  a 3–6 line snippet, with about 90 seconds per question.

### Distractor design

| Trap | Questions |
|---|---|
| Error vs. output ("it crashes" vs "it prints") | 04, 06, 07, 09, 14, 18, 20, 23, 24, 29, 30 |
| Off-by-one, negative indices | 01, 07, 29 |
| Wrong return type (list vs str, int vs float) | 24, 28 |
| Mutable vs immutable, aliasing | 14, 21 |
| Default vs passed arguments, positional vs keyword | 02, 13, 36 |
| Literal vs variable (`'r'` vs `r`), case sensitivity (`Numbers`) | 04, 12 |
| Dict semantics (keys vs values) | 22, 34 |
| Control-flow order (elif chain, try/else/finally) | 06, 17, 31 |
| Inheritance lookup, overriding, missing `super().__init__` | 11, 15, 18, 39a, 39b |
| Plausible-sounding API that does not exist (`concat`, `pop(obj=…)`) | 05, 19, 37 |
| Vocabulary | 16, 33 |

## 4. From slide to question

| Slide concept (pages) | Exam question | Pattern: for topic X the exam asks Y by testing Z |
|---|---|---|
| Strings: indexing, methods (29–31) | `'python'[-3]`, `min("hello world")`, `' '.join(a)` | evaluate one expression on a literal: negative index arithmetic, character ordering, return type |
| Operators & types (24, 27–28) | `type(1/2)`, `"Hello" + 6` | result *type* of an operation, implicit-conversion errors |
| if/elif/else (34) | KeyError never reached; one-line if syntax | which branch runs, whether a later condition is evaluated, legal syntax |
| while / for (36–39) | infinite loop printing `'r'`; iterating an int | number of iterations, termination, what is iterable |
| pass / code blocks (35, 40) | `pass`; indentation | the keyword for X, which indentation fails |
| Tuples (93) & slicing (90) | `tuple[2:]`, `a[0] += 1` | slice bounds, immutability → TypeError |
| Dicts (97) & sets (100) | `in` on dicts, looping over keys, `set.remove` | membership semantics, missing key/element errors |
| Default / keyword arguments (82), multiple returns (94) | `f(a, b=1, c=2)`, `x, y = f(y=200, x=100)` | binding of positional/keyword/default arguments, tuple unpacking |
| *args / **kwargs (120, 207) | `total(initial=5, *num, **key)` | what goes into the tuple vs the dict |
| Files (133) & exceptions (139–140) | open modes; `try/except/else/finally` | which clauses run and in which order, default modes |
| Aliasing (173–174) | list mutated inside a function | mutation through another name is visible |
| Call stack / recursion (84, 178) | recursion without base case | missing base case → error; order of prints |
| Classes (189–191) | `print(d)` vs `self.d` | attribute access needs `self` |
| Inheritance (194–195) | override, inherit, missing `super().__init__`, `isinstance` | which method runs, which attributes exist |
| lambda / map (253) | `lambda x: return x`; `map` with a typo | a lambda is a single expression; map is lazy |
| Language overview (10) | "Which is correct about Python? → All of the above" | paradigms, typing, interpreted/byte-code |

## 5. Topics not covered in 2021-22

Ranked by how likely they are to appear (slide emphasis, exercises, and how naturally they fit the
"short snippet + 4 options" format). All of them are covered by the question bank.

| Rank | Topic | Slides |
|---|---|---|
| 1 | Comprehensions (list/dict/set/generator) | 103–106 |
| 2 | Scopes: local/global/nonlocal, UnboundLocalError | 169–172 |
| 3 | Copies: `copy` vs `deepcopy`, `[a]*3` sharing | 173–176 |
| 4 | List methods, slicing with steps, slice assignment | 88–91 |
| 5 | Class vs instance attributes, special methods, `super()` | 192–197 |
| 6 | Generators, `yield`, iterators, map/filter/sorted/any/all | 250–254 |
| 7 | Set operations, dict methods, enumerate/zip | 92, 97–102 |
| 8 | NumPy shapes, axes, indexing, broadcasting, masking | 217–228 |
| 9 | Pandas DataFrame, `loc`/`iloc`, filtering, missing values | 230–237 |
| 10 | Exception hierarchy, raise, finally with return | 139–140 |
| 11 | JSON / pickle, `with` and file reading methods | 133–136, 256 |
| 12 | Modules, `__name__ == '__main__'`, imports | 41, 66–67, 137–138 |
| 13 | Closures / first-class functions | 81, 177 |
| 14 | Assertions, unittest, logging levels, argparse | 255–261 |
| 15 | HTTP, URLs, DNS, ports, Flask routes | 283–319 |
| 16 | Efficiency, vectorization, multiprocessing, Numba | 263–269 |
| 17 | PEP 8, Zen of Python, docstrings, type hints, project layout | 271–278 |
| 18 | Matplotlib / Seaborn API | 240–245 |
| 19 | Shell, environment variables, paths, time/datetime | 129–131, 134, 142 |
| 20 | Interpreter walkthrough, MVC/Tk | 153–167, 199–205 |

## 6. Mock exam blueprint

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
  "reference_replay": "the 40 questions of 2021-22 in their original order"
}
```

## 7. Tips for the exam

1. Before computing an output, check whether the code runs at all (syntax, indentation, immutability,
   undefined names, wrong types): one question in five has an error as its answer.
2. In "select all that apply", judge every option on its own; ticking only some of the true options
   scores nothing under all-or-nothing scoring.
3. Read literals character by character: `'r'` vs `r`, `' '` vs `''`, `Numbers` vs `numbers`.
4. `in` / `for` on a dict → keys. `/` → float. `join` → str. `sort()` → None.
5. When an option is worded loosely, pick the one that matches the intended behaviour.
