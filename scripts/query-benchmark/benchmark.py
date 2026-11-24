#!/usr/bin/env python3
"""Compare the speed of Domus's SPARQL queries on the Blazegraph query service
(query.wikidata.org) and its QLever successor (query-next.wikidata.org).

Each task is one thing a user does in Domus:

- ``map``: the building query a map viewport triggers. The old service gets
  the ``wikibase:box`` query, the new one the ``geof:sfWithin`` rewrite, since
  neither understands the other's form.
- ``open``: opening a building, which runs a single-building query and then
  the detail query. Each runs in two forms on both services: as Domus sends
  it today (``by_id``, ``detail``) and rewritten for QLever (``by_id_inline``,
  ``detail_opt``). The rewrites write the item IRI into every pattern instead
  of binding ``?item``, repeat a statement's anchor triple inside the
  OPTIONALs that hang off it, and look labels up with ``rdfs:label`` where
  the labelled variable is bound instead of through the label service.
  QLever evaluates an OPTIONAL's inside on its own before joining, so without
  these it works through every statement in Wikidata.

The queries in ``queries/`` are the ones Domus generates, with ``${id}`` and
``${west}``/``${south}``/``${east}``/``${north}`` as placeholders, for the
German locale. Regenerate them when the queries in src/services/wikidata.ts
change. ``detail_inline`` is an intermediate rewrite measured in earlier runs.

Every ``LAG_EVERY`` requests the run also records how far each service's
data trails live Wikidata, from the service's own update timestamp, into a
second CSV next to the results.

Every request is a form-encoded POST, so neither service can answer from an
HTTP cache. Within a task the two services run back to back, alternating
which goes first, so both see the same moment's load. Requests run strictly
one at a time with a pause in between to stay well inside both services' rate
limits. Map boxes shift by a few metres each round so that repeated rounds
are not served from QLever's query cache; item queries cannot be varied, so
compare round 1 with later rounds to see the cache effect there.

Usage:
    python3 scripts/query-benchmark/benchmark.py --out results.csv [--rounds 3]
    python3 scripts/query-benchmark/benchmark.py --summarize results.csv
"""

import argparse
import csv
import hashlib
import json
import math
import random
import re
import statistics
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SERVICES = {
    "old": "https://query.wikidata.org/sparql",
    "new": "https://query-next.wikidata.org/sparql",
}
USER_AGENT = "DomusQueryBenchmark/0.1 (https://domus.genealogy.net)"
QUERY_DIR = Path(__file__).parent / "queries"
LAG_QUERY = "SELECT ?t WHERE { <http://www.wikidata.org> schema:dateModified ?t }"
LAG_EVERY = 10

# Opening a building runs a single-building query, then a detail query.
OPEN_QUERIES = ("by_id", "by_id_inline", "detail", "detail_opt")
OPEN_COMBOS = {"today": ("by_id", "detail"), "rewritten": ("by_id_inline", "detail_opt")}
QUERY_ORDER = ("box_old", "box_new", "by_id", "by_id_inline", "detail", "detail_inline", "detail_opt")

# Viewport Domus queries for: the map loads buildings from zoom 14 upwards.
VIEWPORT_PX = (1600, 900)
ZOOMS = (14, 16)
LOCATIONS = {
    "München Marienplatz": (48.1374, 11.5755),
    "Berlin Mitte": (52.5163, 13.3777),
    "Köln Dom": (50.9413, 6.9583),
    "Regensburg Altstadt": (49.0195, 12.0975),
    "Rothenburg o.d.T.": (49.3772, 10.1789),
    "Wildpoldsried (rural)": (47.7672, 10.4006),
}
ITEMS = {
    # Landmarks with many statements
    "Q167193": "Frauenkirche München",
    "Q4176": "Kölner Dom",
    "Q82425": "Brandenburger Tor",
    "Q4152": "Schloss Neuschwanstein",
    "Q151897": "Reichstagsgebäude",
    "Q131617": "Deutsches Museum",
    # Buildings with the most occupants (P466) in Germany
    "Q551837": "",
    "Q1585963": "",
    "Q1902835": "",
    "Q530930": "",
    "Q28121567": "",
    # Sparse items, typical of listed buildings
    "Q1025619": "Café Jasmin",
    "Q103185917": "München (Samian Ware Discovery Site)",
    "Q106539974": "Baudenkmal D-1-62-000-8162",
    "Q118145368": "Burgstall",
}

FIELDS = ["time_utc", "round", "task", "label", "query", "service", "status",
          "seconds", "rows", "bytes", "error", "retried_after_429", "fingerprint"]


def load_templates() -> dict[str, string.Template]:
    return {p.stem: string.Template(p.read_text()) for p in QUERY_DIR.glob("*.rq")}


def viewport_box(lat: float, lng: float, zoom: int, jitter: float) -> dict[str, float]:
    """Bounding box of a web-mercator viewport of VIEWPORT_PX centred on lat/lng."""
    width_px, height_px = VIEWPORT_PX
    deg_per_px = 360 / (256 * 2 ** zoom)
    half_w = width_px / 2 * deg_per_px
    half_h = height_px / 2 * deg_per_px * math.cos(math.radians(lat))
    lat += jitter
    lng += jitter
    return {"west": round(lng - half_w, 6), "south": round(lat - half_h, 6),
            "east": round(lng + half_w, 6), "north": round(lat + half_h, 6)}


def run_query(endpoint: str, query: str, timeout: float) -> dict:
    body = urllib.parse.urlencode({"query": query}).encode()
    request = urllib.request.Request(endpoint, data=body, method="POST", headers={
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
    })
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        return {"status": e.code, "seconds": time.perf_counter() - start, "bytes": len(raw),
                "error": raw[:200].decode(errors="replace").replace("\n", " "),
                "retry_after": e.headers.get("Retry-After")}
    except (OSError, TimeoutError) as e:  # timeouts, connection resets (URLError is an OSError)
        return {"status": 0, "seconds": time.perf_counter() - start, "bytes": 0,
                "error": f"{type(e).__name__}: {e}"}
    seconds = time.perf_counter() - start
    try:
        rows = json.loads(raw)["results"]["bindings"]
    except (ValueError, KeyError) as e:
        return {"status": status, "seconds": seconds, "bytes": len(raw), "error": f"bad JSON: {e}"}
    return {"status": status, "seconds": seconds, "bytes": len(raw), "rows": rows}


def _point(value: str) -> tuple[float, float] | None:
    m = re.search(r"point\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)", value, re.IGNORECASE)
    return (round(float(m[1]), 4), round(float(m[2]), 4)) if m else None


_QID = re.compile(r"^Q\d+$")
_HELPER_VAR = re.compile(r"L\d$")  # per-language label candidates of the rewrites


def _kept(row: dict) -> dict[str, str]:
    """The variables Domus reads. A label that is just the QID is the label
    service's stand-in for a missing label, which the app treats like none."""
    return {k: v["value"] for k, v in row.items()
            if k not in ("alias", "itemAltLabel") and not _HELPER_VAR.search(k)
            and not (k.endswith("Label") and _QID.match(v["value"]))}


def fingerprint(query: str, rows: list[dict]) -> str:
    """A digest of the parts of a result Domus uses, comparable across services
    and across a query's variants. Ignores what legitimately differs: row
    order, WKT spelling and rounding, which P31 value LIMIT 1 happens to pick,
    and how aliases are delivered."""
    if query.startswith("box"):
        return f"{len({r['item']['value'] for r in rows if 'item' in r})} items"
    if query.startswith("by_id"):
        if not rows:
            return "none"
        r = rows[0]
        return json.dumps([r.get("itemLabel", {}).get("value"), _point(r.get("coord", {}).get("value", "")),
                           r.get("inceptionTime", {}).get("value"), r.get("modified", {}).get("value")],
                          ensure_ascii=False)
    # detail variants: the distinct rows without aliases.
    other = set()
    for r in rows:
        kept = _kept(r)
        if kept:
            other.add(json.dumps(kept, sort_keys=True, ensure_ascii=False))
    digest = hashlib.sha1("\n".join(sorted(other)).encode()).hexdigest()[:8]
    return f"{len(other)} rows/{digest}"


def plan(rounds: int, seed: int) -> list[dict]:
    """Every request of the run, in execution order."""
    rng = random.Random(seed)
    templates = load_templates()
    requests = []
    for rnd in range(1, rounds + 1):
        tasks = []
        jitter = (rnd - 1) * 0.00003  # about 3 m per round
        for name, (lat, lng) in LOCATIONS.items():
            for zoom in ZOOMS:
                box = viewport_box(lat, lng, zoom, jitter)
                tasks.append([
                    {"task": "map", "label": f"{name} z{zoom}", "query": "box_old", "service": "old",
                     "text": templates["box_old"].substitute(box)},
                    {"task": "map", "label": f"{name} z{zoom}", "query": "box_new", "service": "new",
                     "text": templates["box_new"].substitute(box)},
                ])
        for qid, name in ITEMS.items():
            for query in OPEN_QUERIES:
                text = templates[query].substitute(id=qid)
                tasks.append([{"task": "open", "label": f"{qid} {name}".strip(), "query": query,
                               "service": s, "text": text} for s in SERVICES])
        rng.shuffle(tasks)
        for i, pair in enumerate(tasks):
            if (i + rnd) % 2:
                pair.reverse()
            for req in pair:
                requests.append({**req, "round": rnd})
    return requests


def lag_path(out: Path) -> Path:
    return out.with_name(out.stem + "-lag.csv")


def sample_lag(writer: csv.DictWriter, timeout: float) -> None:
    for service, endpoint in SERVICES.items():
        result = run_query(endpoint, LAG_QUERY, timeout)
        now = datetime.now(timezone.utc)
        lag = ""
        if result.get("rows"):
            updated = datetime.fromisoformat(result["rows"][0]["t"]["value"].replace("Z", "+00:00"))
            lag = f"{(now - updated).total_seconds():.0f}"
        writer.writerow({"time_utc": now.isoformat(timespec="seconds"), "service": service,
                         "status": result["status"], "lag_seconds": lag})


def run(args: argparse.Namespace) -> None:
    requests = plan(args.rounds, args.seed)[:args.limit]
    out = Path(args.out)
    print(f"{len(requests)} requests; writing {out} and {lag_path(out).name}", file=sys.stderr)
    with out.open("w", newline="") as f, lag_path(out).open("w", newline="") as lag_f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        lag_writer = csv.DictWriter(lag_f, fieldnames=["time_utc", "service", "status", "lag_seconds"])
        lag_writer.writeheader()
        for i, req in enumerate(requests, 1):
            if i % LAG_EVERY == 1:
                sample_lag(lag_writer, args.timeout)
                lag_f.flush()
            result = run_query(SERVICES[req["service"]], req["text"], args.timeout)
            retried = result["status"] == 429
            if retried:
                wait = float(result.get("retry_after") or 60)
                print(f"  429 from {req['service']}, waiting {wait:.0f} s and retrying", file=sys.stderr)
                time.sleep(wait)
                result = run_query(SERVICES[req["service"]], req["text"], args.timeout)
            rows = result.get("rows")
            writer.writerow({
                "time_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "round": req["round"], "task": req["task"], "label": req["label"],
                "query": req["query"], "service": req["service"], "status": result["status"],
                "seconds": f"{result['seconds']:.3f}", "rows": "" if rows is None else len(rows),
                "bytes": result["bytes"], "error": result.get("error", ""), "retried_after_429": int(retried),
                "fingerprint": "" if rows is None else fingerprint(req["query"], rows),
            })
            f.flush()
            print(f"[{i}/{len(requests)}] r{req['round']} {req['service']:3} {req['query']:13} "
                  f"{result['status']} {result['seconds']:6.2f}s  {req['label']}", file=sys.stderr)
            time.sleep(args.pause)
    summarize(out)


def _pct(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, math.ceil(p * len(s)) - 1)]


def summarize(path: Path) -> None:
    rows = list(csv.DictReader(path.open()))
    print(f"\n## {path.name}: {len(rows)} requests, "
          f"{rows[0]['time_utc']} – {rows[-1]['time_utc']}\n")
    print("| query | service | n | ok | median s | p90 s | max s | round-1 median s | errors |")
    print("|---|---|---|---|---|---|---|---|---|")
    groups: dict[tuple[str, str], list[dict]] = {}
    for r in rows:
        groups.setdefault((r["query"], r["service"]), []).append(r)
    for (query, service), rs in sorted(groups.items(), key=lambda g: (QUERY_ORDER.index(g[0][0]), g[0][1] != "old")):
        ok = [float(r["seconds"]) for r in rs if r["status"] == "200"]
        first = [float(r["seconds"]) for r in rs if r["status"] == "200" and r["round"] == "1"]
        errors: dict[str, int] = {}
        for r in rs:
            if r["status"] != "200":
                kind = "timeout/conn" if r["status"] == "0" else r["status"]
                errors[kind] = errors.get(kind, 0) + 1
        fmt = lambda v: f"{v:.2f}" if v is not None else "–"
        print(f"| {query} | {service} | {len(rs)} | {len(ok)} | {fmt(statistics.median(ok) if ok else None)} "
              f"| {fmt(_pct(ok, 0.9) if ok else None)} | {fmt(max(ok) if ok else None)} "
              f"| {fmt(statistics.median(first) if first else None)} "
              f"| {', '.join(f'{k}×{v}' for k, v in errors.items()) or '–'} |")

    # What a user waits for when opening a building: the single-building
    # query, then the detail query (or both at once, if run in parallel).
    print("\nOpening a building (per item and round, both queries successful):\n")
    print("| service | queries | n | sequential median s | sequential p90 s | parallel median s | parallel p90 s |")
    print("|---|---|---|---|---|---|---|")
    by_key = {(r["round"], r["label"], r["query"], r["service"]): r for r in rows if r["task"] == "open"}
    for combo, (first_q, second_q) in OPEN_COMBOS.items():
        for service in SERVICES:
            seq, par = [], []
            for (rnd, label, query, svc), a in by_key.items():
                if query != first_q or svc != service:
                    continue
                b = by_key.get((rnd, label, second_q, service))
                if a["status"] == "200" and b and b["status"] == "200":
                    ta, tb = float(a["seconds"]), float(b["seconds"])
                    seq.append(ta + tb)
                    par.append(max(ta, tb))
            if seq:
                print(f"| {service} | {combo} ({first_q} + {second_q}) | {len(seq)} "
                      f"| {statistics.median(seq):.2f} | {_pct(seq, 0.9):.2f} "
                      f"| {statistics.median(par):.2f} | {_pct(par, 0.9):.2f} |")

    # Do the rewrites return what the queries of today return?
    print("\nRewrites vs today's queries (same service, item and round, both successful):\n")
    for today_q, new_q in zip(OPEN_COMBOS["today"], OPEN_COMBOS["rewritten"]):
        same = differ = 0
        examples = []
        for (rnd, label, query, svc), a in by_key.items():
            if query != today_q:
                continue
            b = by_key.get((rnd, label, new_q, svc))
            if a["status"] == "200" and b and b["status"] == "200":
                if a["fingerprint"] == b["fingerprint"]:
                    same += 1
                else:
                    differ += 1
                    examples.append(f"{svc} r{rnd} {label}: {a['fingerprint']} / {b['fingerprint']}")
        print(f"- {new_q} vs {today_q}: {same}/{same + differ} identical")
        for e in examples[:5]:
            print(f"  - {e}")

    # Do both services return the same data?
    print("\nResult agreement old vs new (same task and round, both successful):\n")
    pairs: dict[tuple[str, str, str], dict[str, str]] = {}
    for r in rows:
        if r["status"] == "200":
            family = "box" if r["query"].startswith("box") else r["query"]
            pairs.setdefault((r["round"], r["label"], family), {})[r["service"]] = r["fingerprint"]
    agree: dict[str, list[bool]] = {}
    mismatches = []
    for (rnd, label, family), fp in pairs.items():
        if len(fp) == 2:
            same = fp["old"] == fp["new"]
            agree.setdefault(family, []).append(same)
            if not same and rnd == "1":
                mismatches.append(f"- {family} {label}: old {fp['old']} / new {fp['new']}")
    for family, results in agree.items():
        print(f"- {family}: {sum(results)}/{len(results)} identical")
    if mismatches:
        print("\nDifferences in round 1:\n" + "\n".join(mismatches))

    lag_file = lag_path(path)
    if lag_file.exists():
        lags: dict[str, list[float]] = {}
        for r in csv.DictReader(lag_file.open()):
            if r["lag_seconds"]:
                lags.setdefault(r["service"], []).append(float(r["lag_seconds"]))
        print("\nData lag behind live Wikidata (service update timestamp):\n")
        print("| service | samples | median s | p90 s | max s |")
        print("|---|---|---|---|---|")
        for service, values in lags.items():
            print(f"| {service} | {len(values)} | {statistics.median(values):.0f} "
                  f"| {_pct(values, 0.9):.0f} | {max(values):.0f} |")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", help="CSV file to write the measurements to")
    parser.add_argument("--summarize", metavar="CSV", help="only print the summary of an earlier run")
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--pause", type=float, default=1.5, help="seconds between requests")
    parser.add_argument("--timeout", type=float, default=90, help="client-side timeout in seconds")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--limit", type=int, help="run only the first N requests (smoke test)")
    args = parser.parse_args()
    if args.summarize:
        summarize(Path(args.summarize))
    elif args.out:
        run(args)
    else:
        parser.error("give --out or --summarize")


if __name__ == "__main__":
    main()
