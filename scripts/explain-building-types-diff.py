#!/usr/bin/env python3
"""
Renders a reviewable summary of a building-types.ts regeneration.

A raw diff of the generated list is thousands of bare Q-IDs, which cannot be
judged by eye. This resolves every changed Q-ID to its Wikidata label and
classifies each removal, so a reviewer can tell ontology cleanup (types that
were never buildings losing a spurious P279 edge) from a truncated crawl.

Usage: explain-building-types-diff.py BEFORE.ts AFTER.ts [-o pr-body.md]
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://www.wikidata.org/w/api.php"
HEADERS = {"User-Agent": "Domus/1.0 (https://domus.genealogy.net; building-types-diff)"}
BATCH = 50
# GitHub rejects PR bodies over 65536 chars, so the body lists at most this many
# entries per section and points at the full artifact for the rest.
MAX_LISTED = 40

QID = re.compile(r"'(Q[0-9]+)'")


def api(params: dict, retries: int = 6) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except Exception as e:
            if attempt == retries - 1:
                raise
            wait = min(2**attempt * 3, 120)
            print(f"  retrying after {wait}s ({e})", file=sys.stderr)
            time.sleep(wait)
    return {}


def read_ids(path: Path) -> set[str]:
    """Read the quoted array entries only, so Q-IDs named in the header comment
    are not mistaken for list members."""
    return set(QID.findall(path.read_text()))


def best_rank_parents(claims: list[dict]) -> list[str]:
    """P279 values as SPARQL's wdt: prefix sees them.

    wdt: exposes only best-rank statements: preferred ones where any exist,
    otherwise the normal ones, and deprecated ones never. Reading every claim
    instead reports items as still-a-subclass when the edge that would make
    that true has been deprecated or superseded, which is exactly the signal
    this script exists to measure.
    """
    ranks = {c.get("rank") for c in claims}
    best = "preferred" if "preferred" in ranks else "normal"
    return [
        c["mainsnak"]["datavalue"]["value"]["id"]
        for c in claims
        if c.get("rank") == best and c["mainsnak"].get("datavalue")
    ]


def classify(ids: list[str]) -> dict[str, dict]:
    """Resolve labels, and for each id note whether it is deleted, a redirect, or live.

    Redirects must be detected before reading claims: wbgetentities silently
    follows them and returns the merge target's statements, which would make a
    merged item look like it is still a subclass of a listed type.
    """
    out: dict[str, dict] = {}
    for i in range(0, len(ids), BATCH):
        batch = ids[i : i + BATCH]
        titles = "|".join(batch)

        info = api({"action": "query", "titles": titles, "redirects": "1"}).get("query", {})
        redirected = {r["from"]: r["to"] for r in info.get("redirects", [])}
        missing = {p["title"] for p in info.get("pages", {}).values() if "missing" in p}

        live = [q for q in batch if q not in redirected and q not in missing]
        ents = {}
        if live:
            ents = api(
                {
                    "action": "wbgetentities",
                    "ids": "|".join(live),
                    "props": "labels|claims",
                    "languages": "de|en",
                }
            ).get("entities", {})

        for q in batch:
            if q in missing:
                out[q] = {"state": "deleted", "label": None, "parents": []}
            elif q in redirected:
                out[q] = {"state": "merged", "label": None, "target": redirected[q], "parents": []}
            else:
                e = ents.get(q, {})
                labels = e.get("labels", {})
                label = (labels.get("de") or labels.get("en") or {}).get("value")
                parents = best_rank_parents(e.get("claims", {}).get("P279", []))
                out[q] = {"state": "live", "label": label, "parents": parents}
        time.sleep(1)
    return out


def link(qid: str, info: dict) -> str:
    label = info.get("label") or "(no label)"
    return f"[{label}](https://www.wikidata.org/wiki/{qid}) `{qid}`"


def section(title: str, entries: list[str], total: int) -> list[str]:
    if not total:
        return []
    lines = [f"### {title} ({total})", ""]
    lines += entries[:MAX_LISTED]
    if total > len(entries[:MAX_LISTED]):
        lines.append(f"- …and {total - MAX_LISTED} more (see the `building-types-diff` artifact)")
    lines.append("")
    return lines


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("before", type=Path)
    ap.add_argument("after", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("pr-body.md"))
    ap.add_argument("--full", type=Path, help="write the uncapped report here too")
    args = ap.parse_args()

    before, after = read_ids(args.before), read_ids(args.after)
    added, removed = sorted(after - before), sorted(before - after)

    if not added and not removed:
        args.output.write_text("No change to the building type list.\n")
        print("no change")
        return

    print(f"resolving {len(added) + len(removed)} changed ids...", file=sys.stderr)
    info = classify(added + removed)

    # A removal whose parent is still a listed type is the signature of a
    # truncated crawl rather than an upstream ontology change.
    suspect = [q for q in removed if info[q]["state"] == "live" and any(p in after for p in info[q]["parents"])]
    deleted = [q for q in removed if info[q]["state"] == "deleted"]
    merged = [q for q in removed if info[q]["state"] == "merged"]
    clean = [q for q in removed if q not in suspect and q not in deleted and q not in merged]

    pct = len(removed) / len(before) * 100 if before else 0
    out = [
        "Regenerated by `scripts/update-building-types.py`.",
        "",
        f"**{len(before)} → {len(after)} types** — {len(added)} added, {len(removed)} removed ({pct:.1f}% of the previous list).",
        "",
        "| Removal reason | Count |",
        "| --- | ---: |",
        f"| No longer a subclass of any listed type | {len(clean)} |",
        f"| Merged into another item | {len(merged)} |",
        f"| Deleted on Wikidata | {len(deleted)} |",
        f"| **Still a child of a listed type** | **{len(suspect)}** |",
        "",
    ]

    if suspect:
        out += [
            "> [!WARNING]",
            f"> {len(suspect)} removed type(s) are still subclasses of a listed type. That is the",
            "> signature of a partial SPARQL result rather than an upstream change. Do not merge",
            "> without re-running the script.",
            "",
        ]
    else:
        out += [
            "No removed type is still a child of a listed type, so there is no sign of a truncated crawl.",
            "",
        ]

    out += section("Removed", [f"- {link(q, info[q])}" for q in clean], len(clean))
    out += section("Removed — merged into another item", [f"- {link(q, info[q])} → `{info[q]['target']}`" for q in merged], len(merged))
    out += section("Removed — deleted on Wikidata", [f"- `{q}`" for q in deleted], len(deleted))
    out += section("Removed — still a child of a listed type", [f"- {link(q, info[q])} — parents: {', '.join(info[q]['parents'])}" for q in suspect], len(suspect))
    out += section("Added", [f"- {link(q, info[q])}" for q in added], len(added))

    body = "\n".join(out)
    args.output.write_text(body)
    print(f"wrote {args.output} ({len(body)} chars)")

    if args.full:
        full = [f"- {link(q, info[q])} [{info[q]['state']}]" for q in removed + added]
        args.full.write_text("\n".join(full) + "\n")
        print(f"wrote {args.full}")

    if suspect:
        sys.exit(1)


if __name__ == "__main__":
    main()
