#!/usr/bin/env bash
# ./dev sim suites — every scenario suite with its persona hook and last-run
# info, so "what should I run this week" is one command instead of archaeology.
# Coverage intent per suite class lives in the contributor skill's
# references/testing.md (the coverage matrix).
set -e
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_logo "Scenario Suites"
python3 - "$REPO_ROOT" <<'EOF'
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
scenarios = root / "tests" / "evals" / "scenarios"
sandboxes = root / ".sandboxes"

# Latest recorded sim run per suite, across all sandboxes.
last_by_suite = {}
for runs_f in sandboxes.glob("*/.simrun/runs.jsonl"):
    for ln in runs_f.read_text().splitlines():
        try:
            r = json.loads(ln)
        except json.JSONDecodeError:
            continue
        if r.get("kind") != "sim":
            continue
        key = r.get("suite")
        prev = last_by_suite.get(key)
        if not prev or r.get("launched_at", "") > prev.get("launched_at", ""):
            r = {**r, "_sandbox": runs_f.parent.parent.name}
            last_by_suite[key] = r

for suite_dir in sorted(scenarios.iterdir()):
    sj = suite_dir / "suite.json"
    if not sj.is_file():
        continue
    name = suite_dir.name
    try:
        persona = json.loads(sj.read_text()).get("user_persona", "")
    except json.JSONDecodeError:
        persona = "(unparseable suite.json)"
    hook = " ".join(persona.split())
    if len(hook) > 90:
        hook = hook[:90] + "…"
    last = last_by_suite.get(name)
    if last:
        ran = (f"last run {last.get('launched_at','?')[:10]} · {last.get('outcome','?')}"
               f" · {last.get('model','?')} · sandbox {last.get('_sandbox','?')}")
    else:
        ran = "never run (no records)"
    print(f"  {name}")
    print(f"      {hook}")
    print(f"      {ran}")
EOF
print_info ""
print_info "Run one: ./dev sim run <name> --suite=<suite> [--until=<phase>]"
print_info "Coverage matrix (which class catches what): contributor skill references/testing.md"
