import os
import sys
import json
import argparse
import shutil
import time
import subprocess
from datetime import datetime
from pathlib import Path
import anthropic

# Redefine print to always flush and optionally tee to a run log file.
# _log_file is set by main() once the run_id is known.
_print = print
_log_file = None

def print(*args, **kwargs):
    kwargs.setdefault('flush', True)
    _print(*args, **kwargs)
    if _log_file is not None:
        _print(*args, file=_log_file, **kwargs)

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()

_INIT_REQUIRED_PATHS = [
    ".agents/skills/groundwork-orchestrator/SKILL.md",
    ".agents/skills/groundwork-check/SKILL.md",
    ".agents/groundwork/skills/groundwork-product-brief/instructions.md",
    ".agents/groundwork/skills/groundwork-design-system/instructions.md",
    ".agents/groundwork/skills/groundwork-architecture/instructions.md",
    ".agents/groundwork/skills/groundwork-scaffold/instructions.md",
    ".agents/groundwork/skills/groundwork-mvp/instructions.md",
    ".agents/groundwork/skills/groundwork-bet/instructions.md",
    ".groundwork/config/generators.json",
]


def _assert_init_complete(sandbox_dir: Path) -> bool:
    """Fail fast if groundwork init did not install the expected skill files."""
    missing = [p for p in _INIT_REQUIRED_PATHS if not (sandbox_dir / p).exists()]
    if missing:
        print("ERROR: groundwork init is missing expected files:")
        for p in missing:
            print(f"  ✘ {p}")
        return False
    print(f"  [init-check] All {len(_INIT_REQUIRED_PATHS)} expected skill files present.")
    return True


# Hard safety cap — no run can exceed this regardless of scenario/CLI settings.
ABSOLUTE_MAX_TURNS = 65

_MAX_FUNCTION_ROUNDS = 10  # Tool call rounds per skill turn

# ---------------------------------------------------------------------------
# Retry helpers
# ---------------------------------------------------------------------------

def _rate_limit_delay(e: Exception, base_delay: float) -> float:
    """Return how long to wait for a rate-limit error.

    Anthropic sends a retry-after header (seconds) with 429s — use it when
    present. Fall back to base_delay otherwise.
    """
    response = getattr(e, "response", None)
    if response is not None:
        after = response.headers.get("retry-after")
        if after:
            try:
                return float(after)
            except ValueError:
                pass
    return base_delay


def _stream_create(client: anthropic.Anthropic, **kwargs) -> anthropic.types.Message:
    """Use streaming to satisfy the Anthropic API requirement for long-running requests."""
    with client.messages.stream(**kwargs) as stream:
        return stream.get_final_message()


def retry_with_backoff(func, max_retries=8, base_delay=4):
    """Retry func on transient errors.

    Rate-limit errors (429/RateLimitError) respect the retry-after header;
    if absent, fall back to exponential backoff. Overload errors (503/529)
    use exponential backoff. All retried indefinitely so runs always complete.
    Other errors are re-raised after max_retries attempts.
    """
    attempt = 0
    while True:
        try:
            return func()
        except anthropic.RateLimitError as e:
            delay = _rate_limit_delay(e, base_delay * (2 ** min(attempt, 6)))
            print(f"  [RateLimitError] Retrying in {delay:.1f}s (attempt {attempt + 1})...")
            time.sleep(delay)
            attempt += 1
        except anthropic.APIConnectionError as e:
            delay = base_delay * (2 ** min(attempt, 6))
            print(f"  [ConnectionError] Retrying in {delay:.1f}s (attempt {attempt + 1})...")
            time.sleep(delay)
            attempt += 1
        except anthropic.APITimeoutError as e:
            delay = base_delay * (2 ** min(attempt, 6))
            print(f"  [Timeout] Retrying in {delay:.1f}s (attempt {attempt + 1})...")
            time.sleep(delay)
            attempt += 1
        except anthropic.APIStatusError as e:
            if e.status_code == 429:
                delay = _rate_limit_delay(e, base_delay * (2 ** min(attempt, 6)))
                print(f"  [429 RateLimit] Retrying in {delay:.1f}s (attempt {attempt + 1})...")
                time.sleep(delay)
                attempt += 1
            elif e.status_code in (503, 529):
                delay = base_delay * (2 ** min(attempt, 6))
                print(f"  [API Overload {e.status_code}] Retrying in {delay:.1f}s (attempt {attempt + 1})...")
                time.sleep(delay)
                attempt += 1
            elif e.status_code == 400:
                # 400 = invalid_request_error — retrying will not help; raise immediately.
                print(f"  [400 Bad Request] {e.message}. Not retrying.")
                raise
            elif attempt >= max_retries - 1:
                raise
            else:
                delay = base_delay * (2 ** attempt)
                print(f"  [API Error {e.status_code}] Retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(delay)
                attempt += 1
        except Exception as e:
            if attempt >= max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"  [Error: {type(e).__name__}] {str(e)[:100]}. Retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})...")
            time.sleep(delay)
            attempt += 1

# ---------------------------------------------------------------------------
# Sandbox tools
# ---------------------------------------------------------------------------

def get_tools(sandbox_dir: Path, client: anthropic.Anthropic | None = None, review_model_id: str | None = None, usage_accumulator: dict | None = None):
    """Return (function_map, tool_schemas) scoped to sandbox_dir.

    When `client` and `review_model_id` are provided, an `invoke_review` tool is
    exposed. It runs the groundwork-review skill in an **isolated** SDK call —
    the review's deliberation never reaches the calling skill's context. The
    caller receives only the verdict and findings. This mirrors the Task-tool
    subagent pattern used in Claude Code.

    The optional `usage_accumulator` dict (if provided) is mutated to record
    token usage from both the main skill loop and the review subagent. This
    makes the review subagent's token spend visible in scenario reporting even
    though it runs in a separate SDK conversation.
    """

    def _guard(path: str) -> Path:
        target = (sandbox_dir / path).resolve()
        if not str(target).startswith(str(sandbox_dir)):
            raise ValueError("Cannot access files outside the workspace.")
        return target

    def read_file(path: str) -> str:
        """Reads the contents of a file."""
        try:
            target = _guard(path)
        except ValueError as e:
            return f"Error: {e}"
        if not target.exists():
            return f"Error: File {path} does not exist."
        return target.read_text()

    def write_file(path: str, content: str = None) -> str:
        """Writes content to a file, creating directories if needed."""
        if content is None:
            return "Error: write_file(path, content) requires both arguments. The 'content' argument is missing — call write_file again and include the full file content as the second argument."
        try:
            target = _guard(path)
        except ValueError as e:
            return f"Error: {e}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        return f"Successfully wrote to {path}"

    def append_file(path: str, content: str = None) -> str:
        """Appends content to a file, creating directories if needed."""
        if content is None:
            return "Error: append_file(path, content) requires both arguments. The 'content' argument is missing — call append_file again and include the content to append as the second argument."
        try:
            target = _guard(path)
        except ValueError as e:
            return f"Error: {e}"
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "a") as f:
            f.write("\n" + content)
        return f"Successfully appended to {path}"

    def move_file(source: str, destination: str) -> str:
        """Moves a file from source to destination, creating parent directories if needed."""
        try:
            src = _guard(source)
            dst = _guard(destination)
        except ValueError as e:
            return f"Error: {e}"
        if not src.exists():
            return f"Error: File {source} does not exist."
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        return f"Successfully moved {source} to {destination}"

    def list_directory(path: str) -> str:
        """Lists files and directories in the specified path."""
        try:
            target = _guard(path)
        except ValueError as e:
            return f"Error: {e}"
        if not target.exists():
            return f"Error: Directory {path} does not exist."
        if not target.is_dir():
            return f"Error: {path} is not a directory."
        items = list(target.iterdir())
        res = [f"{'[DIR]' if i.is_dir() else '[FILE]'} {i.name}" for i in sorted(items)]
        return "\n".join(res) if res else "Empty directory"

    def run_command(command: str) -> str:
        """Runs a shell command in the workspace directory. Use for scaffold generators and infrastructure commands."""
        try:
            result = subprocess.run(
                command, shell=True, cwd=sandbox_dir,
                capture_output=True, text=True, timeout=180
            )
            output = (result.stdout + result.stderr).strip()
            if len(output) > 4096:
                output = output[:4096] + "\n... [TRUNCATED]"
            return output if output else f"(exit code {result.returncode})"
        except subprocess.TimeoutExpired:
            return "Error: Command timed out after 180 seconds."
        except Exception as e:
            return f"Error running command: {e}"

    def invoke_review(document_path: str, document_type: str) -> str:
        """Run the groundwork-review skill in an isolated SDK call.

        The review subagent reads the document and upstream context inside its
        own conversation, runs its checks, and returns verdict + findings only.
        The caller sees the returned text and nothing else — the deliberation
        does not flow back into the caller's context window. This is the
        isolated-context contract Protocol 5/6 of the operating contract assume.
        """
        if client is None or review_model_id is None:
            return "Error: invoke_review is not configured (client/model unavailable in this harness run)."

        review_skill_path = sandbox_dir / ".agents" / "groundwork" / "skills" / "groundwork-review" / "instructions.md"
        if not review_skill_path.exists():
            return f"Error: review skill not installed at {review_skill_path}. Skill install incomplete."

        # Verify the draft exists before spending an SDK call on it.
        try:
            draft_target = _guard(document_path)
        except ValueError as e:
            return f"Error: {e}"
        if not draft_target.exists():
            return f"Error: document_path {document_path} does not exist."

        review_system_text = review_skill_path.read_text()
        review_user_text = (
            f"document_path: {document_path}\n"
            f"document_type: {document_type}\n\n"
            "Run the checks defined in your instructions and return only VERDICT and FINDINGS."
        )

        # The review subagent gets read-only tools — it must not write, move, or run commands.
        review_fn_map = {"read_file": read_file, "list_directory": list_directory}
        review_tool_schemas = [
            {
                "name": "read_file",
                "description": "Reads the contents of a file.",
                "input_schema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                },
            },
            {
                "name": "list_directory",
                "description": "Lists files and directories in the specified path.",
                "input_schema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                },
            },
        ]

        review_system = [{"type": "text", "text": review_system_text, "cache_control": {"type": "ephemeral"}}]
        review_messages = [{"role": "user", "content": review_user_text}]

        # Run the review's own tool-use loop. Capped at 8 rounds — a review
        # typically needs <5: read draft, read 1-3 upstreams, return.
        _REVIEW_MAX_ROUNDS = 8
        final_texts: list[str] = []

        try:
            for _ in range(_REVIEW_MAX_ROUNDS):
                response = retry_with_backoff(lambda: _stream_create(
                    client,
                    model=review_model_id,
                    max_tokens=4096,
                    system=review_system,
                    messages=review_messages,
                    tools=review_tool_schemas,
                    temperature=0.0,
                ))
                # Review subagent usage is captured into the same accumulator so
                # scenario reporting sees the total spend even though the review
                # ran in an isolated context.
                _record_usage(response, usage_accumulator)

                texts = [b.text for b in response.content if b.type == "text"]
                tool_uses = [b for b in response.content if b.type == "tool_use"]
                final_texts = texts  # keep most recent

                asst_content = []
                for t in texts:
                    asst_content.append({"type": "text", "text": t})
                for tu in tool_uses:
                    asst_content.append({"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input})
                review_messages.append({"role": "assistant", "content": asst_content})

                if response.stop_reason == "end_turn" or not tool_uses:
                    break

                tool_results = []
                for tu in tool_uses:
                    fn = review_fn_map.get(tu.name)
                    if fn is None:
                        result = f"Error: review subagent attempted disallowed tool '{tu.name}'"
                    else:
                        try:
                            result = fn(**tu.input)
                        except Exception as e:
                            result = f"Error executing {tu.name}: {e}"
                    tool_results.append({"type": "tool_result", "tool_use_id": tu.id, "content": str(result)})
                review_messages.append({"role": "user", "content": tool_results})
        except Exception as e:
            return f"Error: review subagent failed: {type(e).__name__}: {str(e)[:200]}"

        return "\n".join(final_texts).strip() or "Error: review subagent returned no text."

    fns = {
        "read_file": read_file,
        "write_file": write_file,
        "append_file": append_file,
        "move_file": move_file,
        "list_directory": list_directory,
        "run_command": run_command,
        "invoke_review": invoke_review,
    }

    schemas = [
        {
            "name": "read_file",
            "description": "Reads the contents of a file.",
            "input_schema": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "File path relative to workspace root."}},
                "required": ["path"],
            },
        },
        {
            "name": "write_file",
            "description": "Writes content to a file, creating directories if needed.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to workspace root."},
                    "content": {"type": "string", "description": "Content to write."},
                },
                "required": ["path", "content"],
            },
        },
        {
            "name": "append_file",
            "description": "Appends content to a file, creating directories if needed.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to workspace root."},
                    "content": {"type": "string", "description": "Content to append."},
                },
                "required": ["path", "content"],
            },
        },
        {
            "name": "move_file",
            "description": "Moves a file from source to destination. Use this to promote draft files (e.g. .groundwork/cache/<name>-draft.md) to their final location in docs/ without re-emitting the file contents through the model. Creates destination parent directories if needed.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Existing file path relative to workspace root."},
                    "destination": {"type": "string", "description": "Destination file path relative to workspace root."},
                },
                "required": ["source", "destination"],
            },
        },
        {
            "name": "list_directory",
            "description": "Lists files and directories in the specified path.",
            "input_schema": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Directory path relative to workspace root."}},
                "required": ["path"],
            },
        },
        {
            "name": "run_command",
            "description": "Runs a shell command in the workspace directory. Use for scaffold generators and infrastructure commands.",
            "input_schema": {
                "type": "object",
                "properties": {"command": {"type": "string", "description": "Shell command to run."}},
                "required": ["command"],
            },
        },
        {
            "name": "invoke_review",
            "description": "Runs the groundwork-review skill in an isolated subagent context. The subagent reads the draft and upstream summary headers in its own conversation, then returns verdict (PRESENT or REVISE) and findings list. The deliberation does not return — only the verdict and findings. Use this at every commit-step review checkpoint instead of reading the review instructions inline. This is the standard environment-agnostic invocation pattern from the operating contract.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "document_path": {"type": "string", "description": "Path to the draft to review, relative to workspace root."},
                    "document_type": {"type": "string", "description": "One of: product-brief, design-system, architecture, infrastructure, bet-pitch, technical-design."},
                },
                "required": ["document_path", "document_type"],
            },
        },
    ]

    return fns, schemas

# ---------------------------------------------------------------------------
# Skill agent turn
# ---------------------------------------------------------------------------

def _record_usage(response, usage_accumulator: dict | None) -> dict:
    """Capture input/output token usage from a Messages API response.

    Returns the per-call usage dict; also accumulates into the optional
    scenario-level accumulator. Tracks input_tokens, output_tokens, and
    the prompt-cache fields when present (cache hits cut the cost of long,
    stable system prompts). Max input_tokens is also tracked separately
    because the *peak* per-call input is the right proxy for context size
    — cumulative input conflates conversation length with context bloat.
    """
    u = getattr(response, "usage", None)
    if u is None:
        return {}
    per_call = {
        "input_tokens": getattr(u, "input_tokens", 0) or 0,
        "output_tokens": getattr(u, "output_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", 0) or 0,
    }
    if usage_accumulator is not None:
        usage_accumulator["total_input_tokens"] = usage_accumulator.get("total_input_tokens", 0) + per_call["input_tokens"]
        usage_accumulator["total_output_tokens"] = usage_accumulator.get("total_output_tokens", 0) + per_call["output_tokens"]
        usage_accumulator["total_cache_creation_input_tokens"] = usage_accumulator.get("total_cache_creation_input_tokens", 0) + per_call["cache_creation_input_tokens"]
        usage_accumulator["total_cache_read_input_tokens"] = usage_accumulator.get("total_cache_read_input_tokens", 0) + per_call["cache_read_input_tokens"]
        prev_peak = usage_accumulator.get("peak_input_tokens", 0)
        if per_call["input_tokens"] > prev_peak:
            usage_accumulator["peak_input_tokens"] = per_call["input_tokens"]
        usage_accumulator["api_calls"] = usage_accumulator.get("api_calls", 0) + 1
    return per_call


def _skill_turn(client: anthropic.Anthropic, model_id: str, messages: list, system: list, tools: list, fns: dict, usage_accumulator: dict | None = None):
    """Execute one skill agent turn, including the tool-use loop.

    Returns (all_texts, all_fc_logs, new_messages, transcript_entries).
    - new_messages: dicts ready to extend the skill message history.
    - transcript_entries: dicts for JSON transcript output (uses "model" role, not "assistant").
    """
    all_texts: list[str] = []
    all_fc_logs: list[str] = []
    new_messages: list[dict] = []
    transcript_entries: list[dict] = []

    response = retry_with_backoff(lambda: _stream_create(
        client,
        model=model_id,
        max_tokens=32000,
        system=system,
        messages=messages,
        tools=tools,
        temperature=0.2,
    ))
    _record_usage(response, usage_accumulator)

    for _ in range(_MAX_FUNCTION_ROUNDS):
        # If the model ran out of tokens mid-generation, tool calls may be
        # incomplete (e.g. write_file called with path but no content).
        # Break instead of executing — the skill turn will end with whatever
        # text was collected, and the conversation continues normally.
        if response.stop_reason == "max_tokens":
            print("  [WARNING] max_tokens reached mid-response — skipping tool execution.")
            try:
                tail = response.text
                if tail:
                    all_texts.append(tail)
            except Exception:
                pass
            break

        texts = [b.text for b in response.content if b.type == "text"]
        tool_uses = [b for b in response.content if b.type == "tool_use"]
        all_texts.extend(texts)

        # Serialize assistant turn for the message history
        asst_content = []
        for t in texts:
            asst_content.append({"type": "text", "text": t})
        for tu in tool_uses:
            asst_content.append({"type": "tool_use", "id": tu.id, "name": tu.name, "input": tu.input})

        new_messages.append({"role": "assistant", "content": asst_content})

        # Transcript uses "model" role to match existing format
        tr_parts = []
        for t in texts:
            tr_parts.append({"text": t})
        for tu in tool_uses:
            tr_parts.append({"function_call": {"name": tu.name, "args": tu.input}})
        if tr_parts:
            transcript_entries.append({"role": "model", "parts": tr_parts})

        if response.stop_reason == "end_turn" or not tool_uses:
            break

        # Execute tool calls
        tool_results = []
        tr_fr_parts = []
        for tu in tool_uses:
            fn = fns.get(tu.name)
            if fn is None:
                result = f"Error: Unknown tool '{tu.name}'"
            else:
                try:
                    result = fn(**tu.input)
                except Exception as e:
                    result = f"Error executing {tu.name}: {e}"

            result_str = str(result)
            result_trunc = result_str if len(result_str) <= 4096 else result_str[:4096] + "... [TRUNCATED]"
            all_fc_logs.append(f"[{tu.name}({list(tu.input.keys())}) → {result_trunc[:120]}]")
            tool_results.append({"type": "tool_result", "tool_use_id": tu.id, "content": result_str})
            tr_fr_parts.append({"function_response": {"name": tu.name, "response": {"result": result_trunc}}})

        new_messages.append({"role": "user", "content": tool_results})
        transcript_entries.append({"role": "user", "parts": tr_fr_parts})

        response = retry_with_backoff(lambda: _stream_create(
            client,
            model=model_id,
            max_tokens=32000,
            system=system,
            messages=messages + new_messages,
            tools=tools,
            temperature=0.2,
        ))
        _record_usage(response, usage_accumulator)

    return all_texts, all_fc_logs, new_messages, transcript_entries

# ---------------------------------------------------------------------------
# Main simulation
# ---------------------------------------------------------------------------

_OPENER = "Hi! I need some help starting on my project."
_SATISFACTION_SIGNALS = ["end of task", "i'm satisfied", "i am satisfied", "task complete", "all done"]


def simulate_conversation(
    client: anthropic.Anthropic,
    skill_name: str,
    skill_instructions: str,
    user_persona: str,
    user_goal: str,
    sandbox_dir: Path,
    out_file: Path,
    scenario_name: str,
    turns: int = 5,
    skill_model_id: str = "claude-haiku-4-5-20251001",
    user_model_id: str = "claude-haiku-4-5-20251001",
    turn_delay: float = 0.0,
    success_files: list[str] | None = None,
    max_input_tokens: int | None = None,
):
    if turns > ABSOLUTE_MAX_TURNS:
        print(f"  ⚠ Requested {turns} turns exceeds ABSOLUTE_MAX_TURNS ({ABSOLUTE_MAX_TURNS}). Capping.")
        turns = ABSOLUTE_MAX_TURNS
    print(f"Starting simulation for {skill_name} (skill={skill_model_id}, user={user_model_id})...")

    skill_system_text = f"""You are an expert AI agent.
You have access to file editing tools (read_file, write_file, append_file, move_file, list_directory, run_command).
When your instructions tell you to read, check, or list files — YOU MUST CALL read_file or list_directory. When your instructions tell you to write, create, or append to a file — YOU MUST CALL write_file or append_file. When promoting a draft to its final location, move or concatenate it via the filesystem (move_file for a single file, or run_command with `cat`/`mv` for directory-based drafts) — never read a large draft into the model and rewrite it through write_file, as round-tripping the contents through the model exhausts the output token budget. Never describe a file operation in text instead of executing it.
If you need scratch files for intermediate work, write them to .dev/ in the workspace.

Follow these exact skill instructions:

{skill_instructions}"""

    # Cache the system prompt — it's constant across all turns in a scenario.
    skill_system = [{"type": "text", "text": skill_system_text, "cache_control": {"type": "ephemeral"}}]

    # Scenario-level usage accumulator. _skill_turn and invoke_review both
    # write to it so reporting captures the total token spend including the
    # isolated review subagent calls.
    usage_accumulator: dict = {
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cache_creation_input_tokens": 0,
        "total_cache_read_input_tokens": 0,
        "peak_input_tokens": 0,
        "api_calls": 0,
        "budget_violations": [],
    }

    fns, tool_schemas = get_tools(sandbox_dir, client=client, review_model_id=skill_model_id, usage_accumulator=usage_accumulator)

    user_system = f"""You are a simulated user participating in a test of an AI assistant's skills.
Your persona: {user_persona}
Your goal: {user_goal}

Rules:
1. Act naturally according to your persona.
2. Only provide the information asked for. Do not give everything away upfront.
3. Be concise.
4. If the assistant fulfills your goal, acknowledge it and say you are satisfied.
5. Never repeat the opening greeting or re-introduce yourself mid-conversation. If the assistant seems to restart, redirect: "We were already discussing this — let's continue where we left off."
6. If the assistant uses handoff or wrap-up language ("fresh context", "new session", "phase is complete"), respond with ONLY: "Got it, thanks."
7. If the assistant tells you they have completed a file or document, acknowledge it, review it, or approve it. Do NOT restart the conversation."""

    skill_messages: list[dict] = []
    user_messages: list[dict] = []
    transcript_entries: list[dict] = []

    def save_transcript():
        with open(out_file, 'w') as f:
            json.dump({
                "scenario": scenario_name,
                "skill_name": skill_name,
                "usage": dict(usage_accumulator),
                "transcript": transcript_entries,
            }, f, indent=2)

    current_message = _OPENER
    print(f"\nUser:\n{current_message}")

    task_completed = False
    prev_skill_text = None
    stuck_count = 0
    _STUCK_THRESHOLD = 2
    consecutive_user_errors = 0
    _USER_ERROR_THRESHOLD = 3

    for i in range(turns):
        # 1. Add user message to skill history
        skill_messages.append({"role": "user", "content": current_message})
        transcript_entries.append({"role": "user", "parts": [{"text": current_message}]})

        # 2. Skill agent responds (with tool-use loop)
        try:
            all_texts, all_fc_logs, new_msgs, turn_tr = _skill_turn(
                client, skill_model_id, skill_messages, skill_system, tool_schemas, fns, usage_accumulator
            )
            skill_messages.extend(new_msgs)
            transcript_entries.extend(turn_tr)
            save_transcript()
        except Exception as e:
            print(f"Error calling Skill Agent: {e}")
            break

        # 2b. Budget assertion: the peak input_tokens across all API calls in
        # the scenario must stay under the scenario's max_input_tokens budget.
        # Peak (not cumulative) is the right metric — it measures the size of
        # the largest single context, which is what we are trying to keep
        # small. Long conversations may have many turns and still pass.
        if max_input_tokens is not None and usage_accumulator["peak_input_tokens"] > max_input_tokens:
            violation = {
                "turn": i + 1,
                "peak_input_tokens": usage_accumulator["peak_input_tokens"],
                "budget": max_input_tokens,
            }
            usage_accumulator["budget_violations"].append(violation)
            print(f"\n  [BUDGET VIOLATION] peak_input_tokens={usage_accumulator['peak_input_tokens']} exceeds max_input_tokens={max_input_tokens} on turn {i + 1}")
            save_transcript()
            # The scenario continues so we can see what happens, but the
            # violation is recorded and the scenario is marked failed at exit.

        skill_text = all_texts[-1].strip() if all_texts else ""
        log_text = "\n".join(all_texts + all_fc_logs) if (all_texts or all_fc_logs) else "[Empty response]"
        print(f"\nAssistant (turn {i + 1}/{turns}, {len(skill_messages)} history entries):\n{log_text}")

        # 3. Check success files
        if success_files:
            present = [(f, (sandbox_dir / f).exists()) for f in success_files]
            if all(exists for _, exists in present):
                print(f"\n  [TERMINATION] Success: All success_files present after turn {i + 1}.")
                for sf, _ in present:
                    print(f"    - {sf} ✓")
                task_completed = True
                break

        # 4. Stuck detection
        if skill_text and skill_text == prev_skill_text:
            stuck_count += 1
            if stuck_count >= _STUCK_THRESHOLD:
                print(f"\n  [TERMINATION] Stuck: Skill repeated identical response {_STUCK_THRESHOLD}x. Stopping at turn {i + 1}.")
                break
        else:
            stuck_count = 0
        prev_skill_text = skill_text

        if i == turns - 1:
            print(f"\n  [TERMINATION] Turn limit reached ({turns} turns).")
            break

        # 5. Send skill text to user agent
        if not skill_text:
            current_message = "Please continue."
            print(f"\nUser:\n{current_message}  [auto — tool-only turn]")
            continue

        if turn_delay > 0:
            time.sleep(turn_delay)

        try:
            user_messages.append({"role": "user", "content": skill_text})
            # Keep only the most recent exchanges so the user agent stays cheap and focused.
            trimmed = user_messages[-6:] if len(user_messages) > 6 else user_messages
            user_response = retry_with_backoff(lambda: client.messages.create(
                model=user_model_id,
                max_tokens=512,
                system=user_system,
                messages=trimmed,
                temperature=0.1,
            ))
            current_message = user_response.content[0].text if user_response.content else "Please continue."
            user_messages.append({"role": "assistant", "content": current_message})
            consecutive_user_errors = 0
        except Exception as e:
            err_msg = f"{type(e).__name__}: {str(e)[:300]}"
            print(f"Error calling User Agent: {err_msg}")
            current_message = "Please continue."
            # Keep user_messages balanced so the next call has a valid alternating history.
            user_messages.append({"role": "assistant", "content": current_message})
            transcript_entries.append({"role": "user", "parts": [{"text": f"[USER AGENT ERROR — {err_msg}]"}]})
            save_transcript()
            consecutive_user_errors += 1
            if consecutive_user_errors >= _USER_ERROR_THRESHOLD:
                print(f"\n  [TERMINATION] User agent failed {consecutive_user_errors} consecutive times. Stopping.")
                break

        print(f"\nUser:\n{current_message}")

        # 6. User satisfaction signal
        if any(sig in current_message.lower() for sig in _SATISFACTION_SIGNALS):
            if success_files:
                present = [(f, (sandbox_dir / f).exists()) for f in success_files]
                if all(exists for _, exists in present):
                    task_completed = True
                    print(f"\n  [TERMINATION] User satisfied + all success_files present.")
                    break
                else:
                    missing = [f for f, ok in present if not ok]
                    print(f"\n  [WARNING] User satisfied early but success_files missing: {missing}. Continuing...")
            else:
                task_completed = True
                print(f"\n  [TERMINATION] User satisfied (no success_files required).")
                break

    # Final usage summary to stdout so eval runs are self-documenting.
    print(
        f"\n  [USAGE] input={usage_accumulator['total_input_tokens']} "
        f"output={usage_accumulator['total_output_tokens']} "
        f"peak_input={usage_accumulator['peak_input_tokens']} "
        f"cache_read={usage_accumulator['total_cache_read_input_tokens']} "
        f"api_calls={usage_accumulator['api_calls']}"
    )
    if usage_accumulator["budget_violations"]:
        print(f"  [USAGE] {len(usage_accumulator['budget_violations'])} budget violation(s) recorded — scenario marked failed.")
        return False

    if success_files:
        return task_completed
    return True


def _trim_docs_to_summaries(docs_dir: Path) -> None:
    """Trim every `*.md` in docs_dir to its frontmatter and Summary for Downstream section.

    Walks the directory recursively. For each markdown file, preserves the
    YAML frontmatter block (if present) and the `## Summary for Downstream`
    section, then truncates everything that follows. Adds an explicit
    `<!-- body trimmed for summary-only test -->` marker so debugging is
    obvious. If a file has no summary section, it is left unchanged but a
    warning is printed — the test depends on the summary contract being met.
    """
    import re

    if not docs_dir.exists():
        return

    summary_heading_re = re.compile(r"^##\s+Summary for Downstream\s*$", re.MULTILINE)
    next_h2_re = re.compile(r"^##\s+", re.MULTILINE)

    trimmed = 0
    missing = []
    for md in docs_dir.rglob("*.md"):
        text = md.read_text()
        # Preserve frontmatter (--- delimited at top).
        frontmatter = ""
        body_start = 0
        if text.startswith("---\n"):
            end = text.find("\n---\n", 4)
            if end != -1:
                frontmatter = text[: end + 5]
                body_start = end + 5

        body = text[body_start:]
        summary_match = summary_heading_re.search(body)
        if not summary_match:
            missing.append(str(md.relative_to(docs_dir.parent)))
            continue

        summary_start = summary_match.start()
        # Find the next H2 after the summary heading to know where to cut.
        next_h2 = next_h2_re.search(body, summary_match.end())
        summary_end = next_h2.start() if next_h2 else len(body)

        trimmed_content = (
            frontmatter
            + body[summary_start:summary_end].rstrip()
            + "\n\n<!-- body trimmed for summary-only test — only the frontmatter and Summary for Downstream section remain -->\n"
        )
        md.write_text(trimmed_content)
        trimmed += 1

    print(f"  [summary-only seed] trimmed {trimmed} doc(s) to frontmatter + summary header.")
    if missing:
        print(f"  [summary-only seed] WARNING: {len(missing)} doc(s) missing `## Summary for Downstream` and left untrimmed:")
        for m in missing:
            print(f"    - {m}")


def run_scenario(
    client: anthropic.Anthropic,
    suite_name: str,
    scenario_file: Path,
    turns: int,
    skill_model_id: str,
    user_model_id: str,
    turn_delay: float = 0.0,
    run_id: str = "run_default",
    workspace_from: str | None = None,
):
    with open(scenario_file, 'r') as f:
        scenario = json.load(f)

    skill_path_raw = scenario.get("skill_path")
    if not skill_path_raw:
        print(f"ERROR: No skill_path defined in {scenario_file}")
        return

    skill_path = (REPO_ROOT / skill_path_raw).resolve()
    if not skill_path.exists():
        print(f"ERROR: Skill path {skill_path} does not exist.")
        return

    with open(skill_path, 'r') as f:
        skill_instructions = f.read()

    scenario_name = scenario_file.stem
    skill_name = scenario.get("skill_name", skill_path.parent.name)

    suite_config_path = scenario_file.parent / "suite.json"
    suite_config = {}
    if suite_config_path.exists():
        with open(suite_config_path, 'r') as f:
            suite_config = json.load(f)

    user_persona = scenario.get("user_persona", suite_config.get("user_persona", "A standard developer"))
    user_goal = scenario.get("user_goal", suite_config.get("user_goal", "I want you to help me with a task."))
    depends_on = scenario.get("depends_on")
    success_files = scenario.get("success_files")
    turns = scenario.get("turns", turns)
    max_input_tokens = scenario.get("max_input_tokens")
    seed_summaries_only = scenario.get("seed_summaries_only", False)

    base_dir = Path(__file__).parent.resolve()
    sandbox_dir = REPO_ROOT / ".sandboxes" / "evals"
    run_dir = base_dir / "runs" / suite_name / run_id
    workspace_dir = run_dir / "workspace"

    # 1. Wipe sandbox
    if sandbox_dir.exists():
        shutil.rmtree(sandbox_dir)
    sandbox_dir.mkdir(parents=True, exist_ok=True)

    # 2. Initialize GroundWork in the sandbox
    print("Running 'groundwork init' in sandbox to populate latest skills...")
    try:
        subprocess.run(
            ["node", str(REPO_ROOT / "bin" / "groundwork.js"), "init"],
            cwd=sandbox_dir, check=True, capture_output=True, text=True
        )
    except subprocess.CalledProcessError as e:
        print(f"ERROR: groundwork init failed:\n{e.stderr}")
        return

    if not _assert_init_complete(sandbox_dir):
        print("ERROR: Init incomplete — aborting scenario. Check bin/groundwork.js install logic.")
        return

    # 2b. Build generators so scaffold skills have access to dist/
    print("Building GroundWork generators (dist/)...")
    try:
        subprocess.run(
            ["npm", "run", "build"],
            cwd=REPO_ROOT, check=True, capture_output=True, text=True
        )
    except subprocess.CalledProcessError as e:
        print(f"WARNING: npm run build failed:\n{e.stderr}")

    (sandbox_dir / "package.json").write_text('{"name": "sandbox"}')
    (sandbox_dir / "nx.json").write_text('{}')

    # 2c. Copy generator schemas into sandbox so the skill agent can read them
    generators_json_path = sandbox_dir / ".groundwork" / "config" / "generators.json"
    if generators_json_path.exists():
        with open(generators_json_path) as f:
            generators_data = json.load(f)
        schemas_dir = sandbox_dir / ".groundwork" / "config" / "schemas"
        schemas_dir.mkdir(parents=True, exist_ok=True)
        for gen_name, gen_cfg in generators_data.get("generators", {}).items():
            src_schema = Path(gen_cfg.get("schema", ""))
            if src_schema.is_absolute() and src_schema.exists():
                dest = schemas_dir / f"{gen_name}.json"
                shutil.copy2(src_schema, dest)
                gen_cfg["schema"] = f".groundwork/config/schemas/{gen_name}.json"
        with open(generators_json_path, "w") as f:
            json.dump(generators_data, f, indent=2)
        print(f"Generator schemas copied ({len(generators_data.get('generators', {}))} generators)")

    # 3. Seed from dependency
    if depends_on:
        dep_fixture = base_dir / "fixtures" / suite_name / depends_on
        prior_run_workspace = base_dir / "runs" / suite_name / workspace_from / "workspace" if workspace_from else None
        if workspace_dir.exists():
            print(f"Seeding sandbox from current run workspace...")
            shutil.copytree(workspace_dir, sandbox_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.agents'))
        elif prior_run_workspace and prior_run_workspace.exists():
            print(f"Seeding sandbox from prior run workspace: {workspace_from}")
            shutil.copytree(prior_run_workspace, sandbox_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.agents'))
        elif dep_fixture.exists():
            print(f"Seeding sandbox from fixtures: {depends_on}")
            shutil.copytree(dep_fixture, sandbox_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.agents'))
        else:
            print(f"WARNING: No workspace or fixture for {depends_on}. Sandbox not seeded.")

        # Summary-only variant: trim each docs/*.md to its frontmatter and
        # `## Summary for Downstream` section. This tests whether the next
        # phase can work from summaries alone — the entire point of Protocol 5.
        # If the phase fails on summary-only seeding, the summary is missing
        # binding information the body carries, and the contract is broken.
        if seed_summaries_only:
            _trim_docs_to_summaries(sandbox_dir / "docs")

    run_dir.mkdir(parents=True, exist_ok=True)
    out_file = run_dir / f"{scenario_name}_transcript.json"

    success = simulate_conversation(
        client=client,
        skill_name=skill_name,
        skill_instructions=skill_instructions,
        user_persona=user_persona,
        user_goal=user_goal,
        sandbox_dir=sandbox_dir,
        out_file=out_file,
        scenario_name=scenario_name,
        turns=turns,
        skill_model_id=skill_model_id,
        user_model_id=user_model_id,
        turn_delay=turn_delay,
        success_files=success_files,
        max_input_tokens=max_input_tokens,
    )

    if success:
        if workspace_dir.exists():
            shutil.rmtree(workspace_dir)
        shutil.copytree(sandbox_dir, workspace_dir, dirs_exist_ok=True)
        print(f"Sandbox saved to workspace: {workspace_dir}")

        if skill_name == "groundwork-scaffold":
            print("\nRunning scaffold structure validation (--skip-boot)...")
            val_script = REPO_ROOT / "tests" / "evals" / "validate_scaffold.py"
            val_result = subprocess.run(
                [sys.executable, str(val_script), "--workspace", str(workspace_dir), "--skip-boot"],
            )
            if val_result.returncode != 0:
                print("WARNING: Scaffold structure validation failed — inspect workspace above.")
            else:
                print("Scaffold structure validation passed.")
    else:
        print(f"WARNING: Scenario failed. Workspace NOT updated.")

    print(f"\nTranscript saved to {out_file}")


def main():
    parser = argparse.ArgumentParser(description="Run simulated conversational evaluations.")
    parser.add_argument("--suite", required=True, help="Name of the scenario suite")
    parser.add_argument("--scenario", help="Specific scenario name (without .json)")
    parser.add_argument("--all", action="store_true", help="Run all scenarios in the suite")
    parser.add_argument("--from-scenario", default=None, help="With --all, skip scenarios before this one (e.g. 04_scaffold). Use with --workspace-from to resume a partial run.")
    parser.add_argument("--turns", type=int, default=5, help="Default conversation turns")
    parser.add_argument("--skill-model", default="claude-sonnet-4-6", help="Model for the skill agent")
    parser.add_argument("--user-model", default="claude-haiku-4-5-20251001", help="Model for the user agent")
    parser.add_argument("--turn-delay", type=float, default=0.0, help="Seconds between turns (default: 0.0, set >0 only if hitting rate limits)")
    parser.add_argument("--workspace-from", default=None, help="Seed sandbox from a prior run's workspace (e.g. run_20260527_220638). Useful for re-running a single step without replaying earlier steps.")
    args = parser.parse_args()

    api_key = os.environ.get("CLAUDE_API_KEY")
    if not api_key:
        print("ERROR: CLAUDE_API_KEY environment variable is required.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    suite_dir = Path(__file__).parent / "scenarios" / args.suite
    if not suite_dir.exists():
        print(f"ERROR: Suite directory {suite_dir} does not exist.")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_id = f"run_{timestamp}"

    # Open a run-level log file so all stdout is preserved for post-mortem.
    global _log_file
    run_log_dir = Path(__file__).parent / "runs" / args.suite / run_id
    run_log_dir.mkdir(parents=True, exist_ok=True)
    _log_file = open(run_log_dir / "run.log", "w", buffering=1)
    print(f"Run log: {run_log_dir / 'run.log'}")

    if args.all:
        scenarios = sorted(suite_dir.glob("*.json"))
        from_scenario = getattr(args, 'from_scenario', None)
        reached_start = from_scenario is None
        for s_file in scenarios:
            if s_file.name == "suite.json":
                continue
            if not reached_start:
                if s_file.stem == from_scenario:
                    reached_start = True
                else:
                    continue
            run_scenario(client, args.suite, s_file, args.turns,
                         args.skill_model, args.user_model, args.turn_delay, run_id,
                         workspace_from=args.workspace_from)
    elif args.scenario:
        s_file = suite_dir / f"{args.scenario}.json"
        if not s_file.exists():
            print(f"ERROR: Scenario file {s_file} does not exist.")
            sys.exit(1)
        run_scenario(client, args.suite, s_file, args.turns,
                     args.skill_model, args.user_model, args.turn_delay, run_id,
                     workspace_from=args.workspace_from)
    else:
        print("ERROR: Must specify either --scenario or --all")
        sys.exit(1)

    if _log_file is not None:
        _log_file.close()


if __name__ == "__main__":
    main()
