#!/usr/bin/env python3
"""Validate and verify every question of the bank by executing it in real Python 3.

Usage:
    python3 scripts/verify_questions.py            # verify everything (uses cache)
    python3 scripts/verify_questions.py --strict   # also fail on unreviewed conceptual questions
    python3 scripts/verify_questions.py --only S4-0012 PE-07   # verify a subset
    python3 scripts/verify_questions.py --files data/questions/S1.json   # only these files
    python3 scripts/verify_questions.py --no-cache

How a question is verified depends on `verify.mode` (see docs/QUESTION_AUTHORING.md):

* output - the snippet (`verify.code`, else `code`) is executed in a fresh `python -I`
  subprocess. Its *signature* (stdout with trailing whitespace removed, plus a final
  `!ExceptionName` line if it raised) must equal the `out` of every correct option and must
  differ from the `out` of every wrong option. `out` defaults to the option text; `out: null`
  marks a descriptive option, in which case `expected_output` must be given and is checked.
* truth  - each option gets its own probe program (`verify.setup` + option `probe`, or the
  `verify.probe_template` with __OPTION__ / __OPTION_RAW__ substituted). An option is "true"
  when its probe prints `True` as last line without raising. The set of true options must be
  exactly `correct`.
* manual - conceptual question, cannot be executed. Must cite `verify.reference` and carry
  `reviewed >= 2` (two independent review passes) to count as verified in --strict mode.

Every execution is done twice with different PYTHONHASHSEED values; a different result means the
question depends on hash ordering (e.g. printing a set of strings) and is rejected.
Exit code is 1 if any question fails.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE_FILE = ROOT / ".cache" / "verify_cache.json"
REPORT_FILE = DATA / "verification_report.json"
RUNNER_VERSION = "3"

VENV_PY = ROOT / ".venv" / "bin" / "python"
PYTHON = os.environ.get("PYQUIZ_PYTHON") or (str(VENV_PY) if VENV_PY.exists() else sys.executable)

HEAVY_IMPORT = re.compile(r"\b(numpy|pandas|matplotlib|seaborn|flask|requests)\b")

# Executed inside the sandboxed child. Network is disabled, the exception MRO is reported on a
# private marker line of stderr so that "IndentationError" also matches an expected "SyntaxError".
WRAPPER = r'''
import sys, json, socket
def _no_net(*a, **k):
    raise OSError("network access is disabled in the verifier")
socket.socket.connect = _no_net
socket.create_connection = _no_net
src = open(sys.argv[1], encoding="utf-8").read()
try:
    code = compile(src, "<question>", "exec")
    exec(code, {"__name__": "__main__", "__builtins__": __builtins__})
except BaseException as e:
    try:
        sys.stdout.flush()
    except Exception:
        pass
    names = [c.__name__ for c in type(e).__mro__]
    sys.stderr.write("\n__EXC__" + json.dumps(names) + "\n")
'''


# --------------------------------------------------------------------------- loading
def load_questions(files: list[Path] | None = None) -> list[tuple[dict, str]]:
    paths: list[Path] = []
    if files:
        paths = files
    else:
        ref = DATA / "reference_exam.json"
        if ref.exists():
            paths.append(ref)
        paths += sorted((DATA / "questions").rglob("*.json"))
    out = []
    for p in paths:
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"FATAL: {p} is not valid JSON: {e}")
            sys.exit(2)
        items = raw["questions"] if isinstance(raw, dict) else raw
        for q in items:
            out.append((q, str(p.relative_to(ROOT))))
    return out


def load_topics() -> dict:
    return json.loads((DATA / "topics.json").read_text(encoding="utf-8"))


def lesson_anchors() -> dict[str, set[str]]:
    anchors: dict[str, set[str]] = {}
    for p in (DATA / "lessons").glob("S*.md"):
        anchors[p.stem] = set(re.findall(r"\{#([a-z0-9-]+)\}", p.read_text(encoding="utf-8")))
    return anchors


# --------------------------------------------------------------------------- execution
_cache: dict = {}


def run_snippet(src: str, files: dict | None, timeout: float, seed: int, use_cache=True) -> dict:
    key = hashlib.sha256(json.dumps([RUNNER_VERSION, PYTHON, src, files or {}, timeout, seed]).encode()).hexdigest()
    if use_cache and key in _cache:
        return _cache[key]
    with tempfile.TemporaryDirectory(prefix="qverify-") as tmp:
        for name, content in (files or {}).items():
            fp = Path(tmp) / name
            fp.parent.mkdir(parents=True, exist_ok=True)
            fp.write_text(content, encoding="utf-8")
        (Path(tmp) / "__q__.py").write_text(src, encoding="utf-8")
        (Path(tmp) / "__wrapper__.py").write_text(WRAPPER, encoding="utf-8")
        env = {
            "PATH": "/usr/bin:/bin",
            "HOME": tmp,
            "PYTHONHASHSEED": str(seed),
            "MPLBACKEND": "Agg",
            "MPLCONFIGDIR": tmp,
            "PYTHONIOENCODING": "utf-8",
            "LANG": "en_US.UTF-8",
        }
        t0 = time.time()
        try:
            proc = subprocess.run(
                [PYTHON, "-I", "__wrapper__.py", "__q__.py"],
                cwd=tmp, env=env, capture_output=True, text=True, timeout=timeout,
            )
            stdout, stderr, timed_out = proc.stdout, proc.stderr, False
        except subprocess.TimeoutExpired as e:
            stdout = (e.stdout or b"").decode("utf-8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
            stderr, timed_out = "", True
        exc = None
        m = re.search(r"__EXC__(\[.*\])\s*$", stderr or "")
        if m:
            exc = json.loads(m.group(1))
        res = {"stdout": stdout, "exc": exc, "timeout": timed_out, "secs": round(time.time() - t0, 3),
               "stderr": "" if m else (stderr or "")[-500:]}
    _cache[key] = res
    return res


def norm_stdout(s: str) -> str:
    lines = [ln.rstrip() for ln in s.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def signature(res: dict) -> str:
    if res["timeout"]:
        return "!Timeout"
    out = norm_stdout(res["stdout"])
    if res["exc"]:
        out = (out + "\n" if out else "") + "!" + res["exc"][0]
    return out


def matches(expected: str, res: dict, prefix: str | None = None) -> bool:
    """Does an expected signature (option `out`) match an execution result?"""
    expected = norm_stdout(expected)
    if expected == "!Timeout":
        return res["timeout"] and (prefix is None or res["stdout"].startswith(prefix))
    if res["timeout"]:
        return False
    lines = expected.split("\n")
    exp_exc = None
    if lines and lines[-1].startswith("!") and re.fullmatch(r"![A-Za-z_][A-Za-z0-9_]*", lines[-1]):
        exp_exc = lines[-1][1:]
        lines = lines[:-1]
    if norm_stdout("\n".join(lines)) != norm_stdout(res["stdout"]):
        return False
    if exp_exc is None:
        return res["exc"] is None
    return bool(res["exc"]) and exp_exc in res["exc"]


def timeout_for(q: dict, src: str) -> float:
    if "timeout" in q.get("verify", {}):
        return float(q["verify"]["timeout"])
    return 20.0 if HEAVY_IMPORT.search(src) else 6.0


def run_twice(src, files, timeout, use_cache):
    a = run_snippet(src, files, timeout, 0, use_cache)
    if a["timeout"]:
        return a, None
    b = run_snippet(src, files, timeout, 1, use_cache)
    return a, b


# --------------------------------------------------------------------------- checks
def static_checks(q: dict, topics: dict, anchors: dict) -> tuple[list[str], list[str]]:
    errs, warns = [], []
    qid = q.get("id", "?")
    opts = q.get("options", [])
    oids = [o["id"] for o in opts]
    if len(set(oids)) != len(oids):
        errs.append("duplicate option ids")
    if oids != [chr(ord("a") + i) for i in range(len(oids))]:
        errs.append("option ids must be a, b, c, ... in order")
    texts = [o["text"].strip() for o in opts]
    if len(set(texts)) != len(texts):
        errs.append("two options have the same text")
    for c in q.get("correct", []):
        if c not in oids:
            errs.append(f"correct id '{c}' is not an option")
    if len(set(q.get("correct", []))) != len(q.get("correct", [])):
        errs.append("duplicate ids in correct")
    if q.get("type") == "single" and len(q.get("correct", [])) != 1:
        errs.append("single-choice question must have exactly one correct option")
    if q.get("type") == "multi" and len(q.get("correct", [])) < 1:
        errs.append("multi-select question needs at least one correct option")
    ch = q.get("chapter")
    if qid.startswith("S") and not qid.startswith(ch + "-"):
        errs.append(f"id prefix does not match chapter {ch}")
    if q.get("topic") not in topics["topics"].get(ch, {}):
        errs.append(f"unknown topic '{q.get('topic')}' for {ch} (see data/topics.json)")
    elif anchors and ch in anchors and q.get("topic") not in anchors[ch]:
        warns.append(f"no lesson section {{#{q.get('topic')}}} in data/lessons/{ch}.md")
    if q.get("source") == "past_exam" and not qid.startswith("PE-"):
        errs.append("past_exam questions use PE-xx ids")
    notes = q.get("distractor_notes", {})
    for o in opts:
        if o["id"] not in q.get("correct", []) and o["id"] not in notes:
            warns.append(f"no distractor note for wrong option {o['id']}")
    mode = q.get("verify", {}).get("mode")
    if mode == "manual" and not q["verify"].get("reference"):
        errs.append("manual questions must cite verify.reference (slide page or doc)")
    if mode == "output" and q.get("type") == "multi":
        errs.append("multi-select questions must use truth or manual verification")
    if mode == "output" and not (q.get("verify", {}).get("code") or q.get("code")):
        errs.append("output mode needs `code` or `verify.code`")
    if mode == "truth":
        v = q["verify"]
        for o in opts:
            if "probe" not in o and "probe_template" not in v:
                errs.append(f"truth mode: option {o['id']} has no probe and there is no probe_template")
    return errs, warns


def verify_dynamic(q: dict, use_cache: bool) -> dict:
    v = q["verify"]
    mode = v["mode"]
    files = v.get("files")
    res = {"kind": None, "errors": [], "actual": None}
    if mode == "manual":
        res["kind"] = "manual"
        return res
    if mode == "output":
        src = v.get("code") or q.get("code") or ""
        if v.get("setup"):
            src = v["setup"] + "\n" + src
        a, b = run_twice(src, files, timeout_for(q, src), use_cache)
        sig = signature(a)
        res["actual"] = sig
        if a.get("stderr"):
            res["errors"].append(f"runner stderr: {a['stderr']}")
        if b is not None and signature(b) != sig:
            res["errors"].append(f"non-deterministic output across hash seeds: {sig!r} vs {signature(b)!r}")
        prefix = v.get("prefix")
        descriptive_correct = False
        for o in q["options"]:
            out = o.get("out", o["text"]) if "out" in o else o["text"]
            is_correct = o["id"] in q["correct"]
            if out is None:
                if is_correct:
                    descriptive_correct = True
                continue
            m = matches(out, a, prefix)
            if is_correct and not m:
                res["errors"].append(f"correct option {o['id']} expects {out!r} but execution gives {sig!r}")
            if not is_correct and m:
                res["errors"].append(f"wrong option {o['id']} ({out!r}) matches the real output -> two defensible answers")
        if q.get("expected_output") is not None:
            if not matches(q["expected_output"], a, prefix):
                res["errors"].append(f"expected_output {q['expected_output']!r} != actual {sig!r}")
        elif descriptive_correct:
            res["errors"].append("correct option is descriptive (out: null) -> expected_output is required")
        res["kind"] = "exec_expected" if descriptive_correct else "exec_options"
        return res
    if mode == "truth":
        truths = {}
        details = {}
        for o in q["options"]:
            if "probe" in o:
                body = o["probe"]
            else:
                body = v["probe_template"].replace("__OPTION__", repr(o["text"])).replace("__OPTION_RAW__", o["text"])
            src = (v.get("setup") if "setup" in v else (q.get("code") or "")) + "\n" + body
            a, b = run_twice(src, files, timeout_for(q, src), use_cache)
            last = norm_stdout(a["stdout"]).split("\n")[-1] if not a["timeout"] else ""
            truths[o["id"]] = (not a["timeout"]) and a["exc"] is None and last == "True"
            details[o["id"]] = signature(a)
            if b is not None and signature(b) != signature(a):
                res["errors"].append(f"option {o['id']}: non-deterministic probe across hash seeds")
            if a.get("stderr"):
                res["errors"].append(f"option {o['id']} runner stderr: {a['stderr']}")
            if not a["timeout"] and a["exc"] is None and last not in ("True", "False"):
                res["errors"].append(f"option {o['id']}: probe must print True or False last, got {last!r}")
        true_set = sorted(k for k, t in truths.items() if t)
        res["actual"] = "true options: " + ",".join(true_set)
        res["probe_results"] = details
        if true_set != sorted(q["correct"]):
            res["errors"].append(f"probes say correct = {true_set}, question says {sorted(q['correct'])}")
        res["kind"] = "exec_truth"
        return res
    res["errors"].append(f"unknown verify mode {mode}")
    return res


def near_duplicates(questions: list[dict]) -> list[tuple[str, str, float]]:
    def toks(q):
        s = (q.get("stem", "") + " " + (q.get("code") or "") + " " + " ".join(o["text"] for o in q["options"])).lower()
        w = re.findall(r"[a-z_]+|\d+|[^\sa-z_\d]", s)
        return {" ".join(w[i:i + 3]) for i in range(max(1, len(w) - 2))}
    by_topic = defaultdict(list)
    for q in questions:
        by_topic[(q["chapter"], q["topic"])].append((q["id"], toks(q)))
    dups = []
    for items in by_topic.values():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i][1], items[j][1]
                if not a or not b:
                    continue
                jac = len(a & b) / len(a | b)
                if jac >= 0.8:
                    dups.append((items[i][0], items[j][0], round(jac, 2)))
    return dups


# --------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="unreviewed manual questions are failures")
    ap.add_argument("--only", nargs="*", help="question ids to verify")
    ap.add_argument("--files", nargs="*", type=Path, help="question files to verify")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--no-report", action="store_true", help="do not write data/verification_report.json")
    args = ap.parse_args()

    global _cache
    if not args.no_cache and CACHE_FILE.exists():
        try:
            _cache = json.loads(CACHE_FILE.read_text())
        except json.JSONDecodeError:
            _cache = {}

    try:
        import jsonschema  # type: ignore
        validator = jsonschema.Draft202012Validator(json.loads((DATA / "schema" / "question.schema.json").read_text()))
    except ImportError:
        validator = None
        print("warning: jsonschema not installed, schema validation skipped (pip install jsonschema)")

    topics = load_topics()
    anchors = lesson_anchors()
    loaded = load_questions([ROOT / f if not f.is_absolute() else f for f in args.files] if args.files else None)
    if args.only:
        loaded = [(q, f) for q, f in loaded if q.get("id") in set(args.only)]

    results: dict[str, dict] = {}
    ids = Counter(q.get("id") for q, _ in loaded)
    dup_ids = {i for i, c in ids.items() if c > 1}

    def check(item):
        q, fname = item
        r = {"file": fname, "errors": [], "warnings": []}
        if validator:
            for e in validator.iter_errors(q):
                r["errors"].append(f"schema: {'/'.join(map(str, e.path))}: {e.message}")
        if r["errors"]:
            return q.get("id", "?"), r
        if q["id"] in dup_ids:
            r["errors"].append("duplicate question id")
        e, w = static_checks(q, topics, anchors)
        r["errors"] += e
        r["warnings"] += w
        d = verify_dynamic(q, not args.no_cache)
        r["errors"] += d["errors"]
        r["kind"] = d["kind"]
        r["actual"] = d["actual"]
        if d["kind"] == "manual" and q.get("reviewed", 0) < 2:
            (r["errors"] if args.strict else r["warnings"]).append(
                f"conceptual question reviewed {q.get('reviewed', 0)}x (needs 2 review passes)")
        return q["id"], r

    t0 = time.time()
    workers = max(2, (os.cpu_count() or 4))
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for qid, r in ex.map(check, loaded):
            results[qid] = r

    CACHE_FILE.parent.mkdir(exist_ok=True)
    try:  # merge with entries written concurrently by other runs, then replace atomically
        merged = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}
    except (json.JSONDecodeError, OSError):
        merged = {}
    merged.update(_cache)
    tmp = CACHE_FILE.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(merged))
    os.replace(tmp, CACHE_FILE)

    questions = [q for q, _ in loaded]
    dups = near_duplicates([q for q in questions if "options" in q and "topic" in q and "chapter" in q])

    # ------------------------------------------------------------------ report
    failed = {k: v for k, v in results.items() if v["errors"]}
    kinds = Counter(r.get("kind") for r in results.values() if not r["errors"])
    by_ch = defaultdict(Counter)
    for q in questions:
        r = results.get(q.get("id"), {})
        ch = q.get("chapter", "?")
        by_ch[ch]["total"] += 1
        by_ch[ch][q.get("type", "?")] += 1
        by_ch[ch]["past_exam" if q.get("source") == "past_exam" else "generated"] += 1
        if not r.get("errors"):
            by_ch[ch]["ok"] += 1
            if r.get("kind", "").startswith("exec"):
                by_ch[ch]["executed"] += 1

    if not args.quiet:
        for qid, r in sorted(failed.items()):
            print(f"FAIL {qid} ({r['file']})")
            for e in r["errors"]:
                print(f"     - {e}")
        nwarn = sum(len(r["warnings"]) for r in results.values())
        if nwarn and len(results) <= 60:
            for qid, r in sorted(results.items()):
                for w in r["warnings"]:
                    print(f"warn {qid}: {w}")
        for a, b, j in dups:
            print(f"near-duplicate? {a} ~ {b} (jaccard {j})")

    total = len(results)
    ok = total - len(failed)
    executed = sum(v for k, v in kinds.items() if k and k.startswith("exec"))
    print("\n=== Verification summary ===")
    print(f"python used        : {PYTHON}")
    print(f"questions          : {total}")
    print(f"passed             : {ok}")
    print(f"failed             : {len(failed)}")
    print(f"verified by exec   : {executed} ({kinds.get('exec_options', 0)} option-matched, "
          f"{kinds.get('exec_truth', 0)} per-option probes, {kinds.get('exec_expected', 0)} expected-output)")
    print(f"conceptual/manual  : {kinds.get('manual', 0)}")
    print(f"warnings           : {sum(len(r['warnings']) for r in results.values())}")
    print(f"near-duplicates    : {len(dups)}")
    print(f"time               : {time.time() - t0:.1f}s")
    print("\nchapter  total  ok  exec  single multi  past_exam")
    for ch in sorted(by_ch):
        c = by_ch[ch]
        print(f"{ch:7} {c['total']:6} {c['ok']:4} {c['executed']:5} {c['single']:7} {c['multi']:5} {c['past_exam']:10}")

    if not args.no_report and not args.only and not args.files:
        REPORT_FILE.write_text(json.dumps({
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "python": subprocess.run([PYTHON, "-c", "import sys;print(sys.version.split()[0])"],
                                     capture_output=True, text=True).stdout.strip(),
            "summary": {"total": total, "passed": ok, "failed": len(failed), "kinds": dict(kinds),
                        "near_duplicates": dups},
            "questions": {k: {"ok": not v["errors"], "kind": v.get("kind"), "actual": v.get("actual"),
                              "errors": v["errors"], "warnings": v["warnings"]} for k, v in results.items()},
        }, indent=1))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
