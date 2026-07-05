#!/usr/bin/env python3
"""Run records for the simulation harness.

Every launched session (sim or judge) gets a durable record, so a sandbox can be
linked to its sessions after `claude agents`' live registry forgets them, and so
`./dev sim list` can answer "what has been proven lately" without archaeology.

Layout, inside a sandbox:
    .simrun/runs.jsonl    ← append-only, one JSON object per launch
    .simrun/latest.json   ← {"sim": <latest sim record>, "judge": <latest judge record>}

Stdlib only — no venv, mirrors the other harness scripts.

Subcommands:
    add <sandbox> --kind sim|judge --path P --suite S --model M [--until U]
                  [--session-short ID] [--session-id UUID] [--session-name N]
        → appends a record, refreshes latest.json, prints the new run_id
    set-outcome <sandbox> <run_id> <running|done|stalled|stopped|assessed>
    latest <sandbox> [--kind sim] [--field name]
        → prints the latest record as JSON, or one field's value (exit 1 if none)
    list-runs <sandbox>
        → one summary line per recorded run, newest last
    list-all <sandboxes_root>
        → one summary line per sandbox that has records (for `./dev sim list`)
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SIMRUN = ".simrun"


def rec_dir(sandbox: Path) -> Path:
    return sandbox / SIMRUN


def load_runs(sandbox: Path) -> list[dict]:
    f = rec_dir(sandbox) / "runs.jsonl"
    if not f.exists():
        return []
    runs = []
    for ln in f.read_text().splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            runs.append(json.loads(ln))
        except json.JSONDecodeError:
            continue  # a corrupt line loses one record, not the file
    return runs


def save_runs(sandbox: Path, runs: list[dict]) -> None:
    d = rec_dir(sandbox)
    d.mkdir(parents=True, exist_ok=True)
    (d / "runs.jsonl").write_text("".join(json.dumps(r) + "\n" for r in runs))
    refresh_latest(sandbox, runs)


def refresh_latest(sandbox: Path, runs: list[dict]) -> None:
    latest: dict[str, dict] = {}
    for r in runs:  # file order is launch order; last of each kind wins
        latest[r.get("kind", "sim")] = r
    (rec_dir(sandbox) / "latest.json").write_text(json.dumps(latest, indent=2) + "\n")


def summary_line(r: dict) -> str:
    until = f" · until: {r['until']}" if r.get("until") else ""
    return (f"{r.get('run_id','?')} · {r.get('kind','sim')} · {r.get('path','?')}"
            f"/{r.get('suite','?')} · {r.get('model','?')}{until}"
            f" · session {r.get('session_short') or '?'} · {r.get('outcome','?')}")


def cmd_add(sandbox: Path, opts: dict) -> None:
    kind = opts.get("--kind", "sim")
    now = datetime.now(timezone.utc).astimezone()
    record = {
        "run_id": f"{kind}-{now.strftime('%Y%m%d-%H%M%S')}",
        "kind": kind,
        "path": opts.get("--path", "?"),
        "suite": opts.get("--suite", "?"),
        "model": opts.get("--model", "?"),
        "until": opts.get("--until", ""),
        "session_short": opts.get("--session-short", ""),
        "session_id": opts.get("--session-id", ""),
        "session_name": opts.get("--session-name", ""),
        "launched_at": now.isoformat(timespec="seconds"),
        "outcome": "running",
    }
    runs = load_runs(sandbox)
    runs.append(record)
    save_runs(sandbox, runs)
    print(record["run_id"])


def cmd_set_outcome(sandbox: Path, run_id: str, outcome: str) -> None:
    runs = load_runs(sandbox)
    hit = False
    for r in runs:
        if r.get("run_id") == run_id:
            r["outcome"] = outcome
            hit = True
    if not hit:
        print(f"✖ no run '{run_id}' in {rec_dir(sandbox)/'runs.jsonl'}", file=sys.stderr)
        sys.exit(1)
    save_runs(sandbox, runs)


def cmd_latest(sandbox: Path, opts: dict) -> None:
    kind = opts.get("--kind", "sim")
    f = rec_dir(sandbox) / "latest.json"
    latest = json.loads(f.read_text()) if f.exists() else {}
    r = latest.get(kind)
    if not r:
        sys.exit(1)
    field = opts.get("--field")
    if field:
        print(r.get(field, ""))
    else:
        print(json.dumps(r, indent=2))


def cmd_list_runs(sandbox: Path) -> None:
    for r in load_runs(sandbox):
        print(summary_line(r))


def cmd_list_all(root: Path) -> None:
    rows = []
    for latest_f in sorted(root.glob(f"*/{SIMRUN}/latest.json")):
        name = latest_f.parent.parent.name
        try:
            latest = json.loads(latest_f.read_text())
        except json.JSONDecodeError:
            continue
        for kind in ("sim", "judge"):
            if kind in latest:
                rows.append((name, latest[kind]))
    if not rows:
        print("(no recorded runs under any sandbox)")
        return
    for name, r in rows:
        print(f"{name:<20} {summary_line(r)}")


def parse_opts(argv: list[str]) -> dict:
    opts = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--"):
            if "=" in argv[i]:
                k, v = argv[i].split("=", 1)
                opts[k] = v
                i += 1
            elif i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                opts[argv[i]] = argv[i + 1]
                i += 2
            else:
                opts[argv[i]] = ""
                i += 1
        else:
            opts.setdefault("_pos", []).append(argv[i])
            i += 1
    return opts


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    cmd, target = sys.argv[1], Path(sys.argv[2]).resolve()
    rest = sys.argv[3:]
    opts = parse_opts(rest)
    pos = opts.get("_pos", [])
    if cmd == "add":
        cmd_add(target, opts)
    elif cmd == "set-outcome":
        if len(pos) < 2:
            print("Usage: records.py set-outcome <sandbox> <run_id> <outcome>")
            sys.exit(2)
        cmd_set_outcome(target, pos[0], pos[1])
    elif cmd == "latest":
        cmd_latest(target, opts)
    elif cmd == "list-runs":
        cmd_list_runs(target)
    elif cmd == "list-all":
        cmd_list_all(target)
    else:
        print(f"✖ unknown subcommand: {cmd}")
        sys.exit(2)


if __name__ == "__main__":
    main()
