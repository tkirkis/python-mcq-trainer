#!/usr/bin/env python3
"""Spread the position of the correct answer evenly over a, b, c, d (per chapter).

Question writers (human or LLM) tend to put the right answer first; a student would learn
"when in doubt, pick a". This script moves the correct option of single-choice questions
in data/questions/ by swapping it with another option, relabels ids a, b, c... and remaps
`correct` and `distractor_notes`. Per-option fields (`out`, `probe`, `mono`) travel with
their option, so verification is unaffected (re-run scripts/verify_questions.py anyway).

Left untouched:
* past-exam questions (they keep the real exam's order),
* options such as "None of the above" / "All of the above" / "Both ..." (they stay in place),
* questions whose text refers to options by letter, e.g. "(b)" or "option c".

Chapters where no letter exceeds 35 % are left alone.

Usage: python3 scripts/rebalance_options.py [--dry-run]
"""
import json
import re
import sys
import zlib
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PINNED = re.compile(r"^\s*(none of|all of|both\b|neither\b|any of)", re.I)
THRESHOLD = 0.35  # only rebalance a chapter if one letter is correct more often than this
LETTER_REF = re.compile(r"\([a-f]\)|\boptions? \(?[a-f]\b\)?|\b[a-f]\) |\banswer [a-f]\b", re.I)


def refers_to_letters(q):
    texts = [q["stem"], q["explanation"], *q.get("distractor_notes", {}).values(), *(o["text"] for o in q["options"])]
    return any(LETTER_REF.search(t) for t in texts)


def main():
    dry = "--dry-run" in sys.argv
    for chdir in sorted((ROOT / "data" / "questions").glob("S*")):
        files = sorted(chdir.glob("*.json"))
        data = {f: json.loads(f.read_text(encoding="utf-8")) for f in files}
        qs = [q for f in files for q in data[f] if q["type"] == "single" and len(q["options"]) >= 3]
        before = Counter(q["correct"][0] for q in qs)
        if not qs or max(before.values()) / len(qs) <= THRESHOLD:
            print(f"{chdir.name}: balanced enough {dict(sorted(before.items()))}, untouched")
            continue
        counts = Counter()
        moved = skipped = 0
        for q in sorted(qs, key=lambda q: q["id"]):
            opts = q["options"]
            movable = [i for i, o in enumerate(opts) if not PINNED.match(o["text"])]
            cur = next(i for i, o in enumerate(opts) if o["id"] == q["correct"][0])
            if refers_to_letters(q) or cur not in movable or len(movable) < 2:
                counts[cur] += 1
                skipped += 1
                continue
            h = zlib.crc32(q["id"].encode())
            target = min(movable, key=lambda i: (counts[i], (i * 7919 + h) % 97))
            counts[target] += 1
            if target == cur:
                continue
            old_ids = [o["id"] for o in opts]
            opts[cur], opts[target] = opts[target], opts[cur]
            mapping = {}
            for new_i, o in enumerate(opts):
                new_id = chr(ord("a") + new_i)
                mapping[o["id"]] = new_id
                o["id"] = new_id
            q["correct"] = [mapping[c] for c in q["correct"]]
            if "distractor_notes" in q:
                q["distractor_notes"] = {mapping[k]: v for k, v in sorted(q["distractor_notes"].items(), key=lambda kv: mapping.get(kv[0], kv[0])) if k in mapping}
            assert sorted(mapping) == sorted(old_ids)
            moved += 1
        after = Counter(q["correct"][0] for q in qs)
        print(f"{chdir.name}: {len(qs)} single-choice, moved {moved}, kept {skipped} | before {dict(sorted(before.items()))} -> after {dict(sorted(after.items()))}")
        if not dry:
            for f, items in data.items():
                f.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
