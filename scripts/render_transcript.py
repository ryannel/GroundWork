#!/usr/bin/env python3
"""Render a Claude Code session transcript into readable Markdown for review.

An interactive `/simulate-greenfield` run is stored by Claude Code as JSONL under
~/.claude/projects/<encoded-cwd>/. This script turns the latest (or a named)
session into a readable bundle so the conversation can be assessed alongside the
sandbox's file outputs:

    <out>/conversation.md      ← summary dashboard + the full interview, linearised
    <out>/subagents/NN-*.md    ← each simulated-user (sandbox-user) side-thread

Stdlib only — no venv, no dependencies.

Usage: python3 scripts/render_transcript.py <sandbox_path> <out_dir> [session_id]
"""

import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

PROJECTS_ROOT = Path.home() / ".claude" / "projects"
# Tool results that are bulky and low-signal get truncated; the simulated-user
# replies (Agent → sandbox-user) are always shown in full.
TRUNCATE = 600


def encode_cwd(path: Path) -> str:
    """Claude Code keys project dirs by cwd with '/' and '.' replaced by '-'."""
    return str(path).replace("/", "-").replace(".", "-")


def find_project_dir(sandbox: Path) -> Path:
    encoded = encode_cwd(sandbox)
    direct = PROJECTS_ROOT / encoded
    if direct.is_dir():
        return direct
    # Fallback: match by sandbox basename in case the encoding scheme shifts.
    base = sandbox.name
    cands = [d for d in PROJECTS_ROOT.glob(f"*{base}*") if d.is_dir()]
    if len(cands) == 1:
        return cands[0]
    print(f"✖ No transcript project dir for {sandbox}")
    print(f"  Looked for: {direct}")
    if cands:
        print("  Did you mean one of:")
        for c in cands:
            print(f"    {c.name}")
    else:
        print("  Open a chat from the sandbox and run /simulate-greenfield first —")
        print("  the transcript is created on the first interaction.")
    sys.exit(1)


def latest_session(proj_dir: Path, session_id: str | None) -> Path:
    if session_id:
        f = proj_dir / f"{session_id}.jsonl"
        if not f.exists():
            # A session that entered a worktree re-homes its transcript to the
            # worktree's project slug — search all project dirs by session id.
            hits = list(PROJECTS_ROOT.glob(f"*/{session_id}.jsonl"))
            if hits:
                return hits[0]
            print(f"✖ Session {session_id} not found in {proj_dir} (or any project dir)")
            sys.exit(1)
        return f
    sessions = sorted(proj_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)
    if not sessions:
        print(f"✖ No session transcripts in {proj_dir}")
        sys.exit(1)
    return sessions[-1]


def load(jsonl: Path) -> list:
    rows = []
    with open(jsonl) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def text_of(content) -> str:
    """Flatten message content (str or block list) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text":
                out.append(b.get("text", ""))
        return " ".join(out)
    return ""


def trunc(s: str, n: int = TRUNCATE) -> str:
    s = s.rstrip()
    return s if len(s) <= n else s[:n] + f"\n  … [{len(s) - n} more chars]"


def render_main(rows: list) -> tuple[str, dict]:
    """Return (markdown_body, stats). Builds a tool_use_id → name/input index
    first so tool_results can be attributed to the call that produced them."""
    tool_by_id = {}
    for r in rows:
        if r.get("type") != "assistant":
            continue
        for b in r.get("message", {}).get("content", []) or []:
            if isinstance(b, dict) and b.get("type") == "tool_use":
                tool_by_id[b.get("id")] = (b.get("name"), b.get("input") or {})

    stats = {
        "tool_counts": {},
        "docs": [],
        "skills": set(),
        "hidden_skills": set(),
        "user_turns": 0,
    }
    lines = []

    for r in rows:
        rtype = r.get("type")
        if r.get("isSidechain"):
            continue  # subagent context lives in its own file
        content = r.get("message", {}).get("content", "")

        if rtype == "assistant":
            blocks = content if isinstance(content, list) else [{"type": "text", "text": content}]
            for b in blocks:
                if not isinstance(b, dict):
                    continue
                bt = b.get("type")
                if bt == "text" and b.get("text", "").strip():
                    lines.append(f"**Facilitator:** {b['text'].strip()}\n")
                elif bt == "tool_use":
                    name = b.get("name", "?")
                    inp = b.get("input") or {}
                    stats["tool_counts"][name] = stats["tool_counts"].get(name, 0) + 1
                    if name in ("Write", "Edit", "NotebookEdit"):
                        fp = inp.get("file_path", "?")
                        if fp not in stats["docs"]:
                            stats["docs"].append(fp)
                        lines.append(f"  ⤷ `{name}` → `{fp}`\n")
                    elif name == "Skill":
                        sk = inp.get("skill", "?")
                        stats["skills"].add(sk)
                        lines.append(f"  ⤷ `Skill` → **{sk}**\n")
                    elif name in ("Agent", "Task"):
                        sub = inp.get("subagent_type", "?")
                        prompt = inp.get("prompt", "")
                        if sub == "sandbox-user":
                            stats["user_turns"] += 1
                            lines.append(f"**Facilitator → sandbox-user:** {prompt.strip()}\n")
                        else:
                            lines.append(f"  ⤷ `Agent`({sub}): {trunc(prompt, 200)}\n")
                    elif name in ("Read",):
                        fp = inp.get("file_path", inp.get("path", "?"))
                        if "/groundwork/skills/" in str(fp) and "instructions.md" in str(fp):
                            stats["hidden_skills"].add(Path(str(fp)).parent.name)
                        lines.append(f"  ⤷ `Read` `{fp}`\n")
                    elif name == "Bash":
                        cmd = inp.get("command", "")
                        lines.append(f"  ⤷ `Bash`: `{trunc(cmd, 160)}`\n")
                    else:
                        keys = ", ".join(list(inp.keys())[:3])
                        lines.append(f"  ⤷ `{name}`({keys})\n")

        elif rtype == "user":
            if not isinstance(content, list):
                txt = text_of(content).strip()
                if txt:
                    lines.append(f"**You (human):** {trunc(txt, 400)}\n")
                continue
            for b in content:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "tool_result":
                    name, inp = tool_by_id.get(b.get("tool_use_id"), ("?", {}))
                    res = text_of(b.get("content"))
                    if name in ("Agent", "Task"):
                        if inp.get("subagent_type") == "sandbox-user":
                            # The simulated user's answer — show in full.
                            lines.append(f"**sandbox-user:** {res.strip()}\n")
                        else:
                            sub = inp.get("subagent_type", "?")
                            lines.append(f"  ⤷ `Agent`({sub}) returned: {trunc(res, 200)}\n")
                    # else: file-read / bash / write results are noise for review
                elif b.get("type") == "text" and b.get("text", "").strip():
                    lines.append(f"**You (human):** {trunc(b['text'].strip(), 400)}\n")

    return "\n".join(lines), stats


def render_subagent(jsonl: Path, meta: dict) -> str:
    rows = load(jsonl)
    out = [
        f"# Subagent: {meta.get('agentType', '?')}",
        "",
        f"- Task: {meta.get('description', '(none)')}",
        f"- Invoked from main transcript tool call: `{meta.get('toolUseId', '?')}`",
        f"- Source: `{jsonl}`",
        "",
        "---",
        "",
    ]
    for r in rows:
        rtype = r.get("type")
        content = r.get("message", {}).get("content", "")
        if rtype == "user":
            txt = text_of(content).strip()
            if txt:
                out.append(f"**Facilitator (prompt):** {trunc(txt, 1200)}\n")
        elif rtype == "assistant":
            txt = text_of(content).strip()
            if txt:
                out.append(f"**{meta.get('agentType', 'user')}:** {txt}\n")
    return "\n".join(out)


def render_tail(rows: list, n: int) -> None:
    """Print the last n conversational turns legibly — the `sim follow` digest
    view. Text turns only (facilitator narration, persona exchanges, real-human
    overrides); tool plumbing is skipped."""
    turns = []
    for r in rows:
        if r.get("isSidechain"):
            continue
        rtype = r.get("type")
        content = r.get("message", {}).get("content", "")
        if rtype == "assistant":
            blocks = content if isinstance(content, list) else [{"type": "text", "text": content}]
            for b in blocks:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text" and b.get("text", "").strip():
                    turns.append(("assistant", b["text"].strip()))
                elif b.get("type") == "tool_use" and b.get("name") in ("Agent", "Task") \
                        and (b.get("input") or {}).get("subagent_type") == "sandbox-user":
                    turns.append(("→ sandbox-user", (b["input"].get("prompt") or "").strip()))
        elif rtype == "user":
            txt = text_of(content).strip()
            if txt:
                turns.append(("user", txt))
    for role, txt in turns[-n:]:
        print(f"  [{role}] {trunc(txt, 400)}")
        print()


def main():
    argv = sys.argv[1:]
    tail_n = 0
    if "--tail" in argv:
        i = argv.index("--tail")
        argv.pop(i)
        tail_n = 6
        if i < len(argv) and argv[i].isdigit():
            tail_n = int(argv.pop(i))
    if tail_n:
        if len(argv) < 1:
            print("Usage: render_transcript.py <sandbox_path> --tail [N] [session_id]")
            sys.exit(1)
        sandbox = Path(argv[0]).resolve()
        session_id = argv[1] if len(argv) > 1 else None
        proj_dir = find_project_dir(sandbox)
        session = latest_session(proj_dir, session_id)
        render_tail(load(session), tail_n)
        return

    if len(sys.argv) < 3:
        print("Usage: render_transcript.py <sandbox_path> <out_dir> [session_id]")
        print("       render_transcript.py <sandbox_path> --tail [N] [session_id]")
        sys.exit(1)
    sandbox = Path(sys.argv[1]).resolve()
    out_dir = Path(sys.argv[2]).resolve()
    session_id = sys.argv[3] if len(sys.argv) > 3 else None

    proj_dir = find_project_dir(sandbox)
    session = latest_session(proj_dir, session_id)
    sid = session.stem
    rows = load(session)
    body, stats = render_main(rows)

    # Timestamps from line metadata when present.
    stamps = [r.get("timestamp") for r in rows if r.get("timestamp")]
    when = f"{stamps[0]} → {stamps[-1]}" if stamps else "(unknown)"

    if out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "subagents").mkdir(parents=True, exist_ok=True)

    # Subagent side-threads.
    sub_dir = proj_dir / sid / "subagents"
    sub_links = []
    if sub_dir.is_dir():
        agent_files = sorted(sub_dir.glob("agent-*.jsonl"), key=lambda p: p.stat().st_mtime)
        for i, af in enumerate(agent_files, 1):
            meta_path = af.with_suffix(".meta.json")
            meta = {}
            if meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text())
                except json.JSONDecodeError:
                    pass
            label = meta.get("agentType", "subagent")
            fname = f"{i:02d}-{label}.md"
            (out_dir / "subagents" / fname).write_text(render_subagent(af, meta))
            sub_links.append(f"  - [`subagents/{fname}`](subagents/{fname}) — {meta.get('description', label)}")

    # Detect which flow this was (greenfield vs brownfield) from the sim marker,
    # so the review is not mislabelled. Default to greenfield if the marker is absent.
    flow, suite = "greenfield", "?"
    marker = sandbox / ".groundwork-sim.json"
    if marker.exists():
        try:
            m = json.loads(marker.read_text())
            flow, suite = m.get("path", "greenfield"), m.get("suite", "?")
        except json.JSONDecodeError:
            pass

    # Capture the model that actually ran — review signal is uninterpretable without it
    # (e.g. a Sonnet run grinds the review loop harder than Opus). Ignore synthetic rows.
    model_counts: dict[str, int] = {}
    for r in rows:
        msg = r.get("message")
        if isinstance(msg, dict):
            mdl = msg.get("model")
            if mdl and mdl != "<synthetic>":
                model_counts[mdl] = model_counts.get(mdl, 0) + 1
    model = max(model_counts, key=model_counts.get) if model_counts else "(unknown)"

    tool_summary = ", ".join(f"{k} ×{v}" for k, v in sorted(stats["tool_counts"].items()))
    header = [
        f"# {flow.capitalize()} simulation — conversation review",
        "",
        f"- **Session:** `{sid}`",
        f"- **Suite:** `{suite}`",
        f"- **Model:** `{model}`",
        f"- **Source:** `{session}`",
        f"- **Span:** {when}",
        f"- **Rendered:** {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## How the skill performed",
        "",
        f"- **Simulated-user (sandbox-user) turns:** {stats['user_turns']}",
        f"- **Registered skills invoked:** {', '.join(sorted(stats['skills'])) or '(none via Skill tool)'}",
        f"- **Hidden methodology skills loaded:** {', '.join(sorted(stats['hidden_skills'])) or '(none detected)'}",
        f"- **Documents written/edited:** {', '.join(stats['docs']) or '(none)'}",
        f"- **Tool calls:** {tool_summary or '(none)'}",
    ]
    if sub_links:
        header += ["", "### Subagent side-threads", *sub_links]
    header += ["", "---", "", "## Conversation", ""]

    (out_dir / "conversation.md").write_text("\n".join(header) + "\n" + body + "\n")

    print(f"  ✔ {out_dir / 'conversation.md'}")
    print(f"  ✔ {len(sub_links)} subagent side-thread(s) in {out_dir / 'subagents'}")
    print(f"  Session: {sid}  ({stats['user_turns']} simulated-user turns)")


if __name__ == "__main__":
    main()
