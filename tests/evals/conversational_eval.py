import os
import sys
import json
import re
import argparse
import shutil
import time
import subprocess
from datetime import datetime
from pathlib import Path
from google import genai
from google.genai import types
import requests

# Monkeypatch requests to always use a 120-second timeout by default
_orig_request = requests.Session.request
def _patched_request(self, method, url, *args, **kwargs):
    kwargs.setdefault('timeout', 120.0)
    return _orig_request(self, method, url, *args, **kwargs)
requests.Session.request = _patched_request

# Redefine print to always flush to stdout
_print = print
def print(*args, **kwargs):
    kwargs.setdefault('flush', True)
    _print(*args, **kwargs)

# The repo root is two levels up from tests/evals/
REPO_ROOT = Path(__file__).parent.parent.parent.resolve()

# Hard safety cap — no run can exceed this regardless of scenario/CLI settings.
# Prevents cost blowouts from bugs or infinite loops.
ABSOLUTE_MAX_TURNS = 50

import grader

# ---------------------------------------------------------------------------
# Retry helpers
# ---------------------------------------------------------------------------

def _parse_retry_delay(err_str: str) -> float | None:
    """Extract the suggested retryDelay (seconds) from a Gemini API error string."""
    match = re.search(r"[Rr]etry[_ ]?[Dd]elay['\"]?\s*[=:]\s*['\"]?(\d+(?:\.\d+)?)", err_str)
    if match:
        return float(match.group(1))
    return None

def retry_with_backoff(func, max_retries=8, base_delay=4):
    """Retry func on transient errors.

    Quota / rate-limit errors (429 / 503 / RESOURCE_EXHAUSTED) are retried
    indefinitely so the run always completes regardless of quota pressure.
    The API retryDelay hint is used when present; otherwise a flat delay
    of base_delay seconds is applied.  All other errors are re-raised after
    max_retries attempts.
    """
    attempt = 0
    while True:
        try:
            return func()
        except Exception as e:
            err_str = str(e)
            is_quota = "503" in err_str or "429" in err_str or "exhausted" in err_str.lower()
            if is_quota:
                hint = _parse_retry_delay(err_str)
                delay = hint if hint else base_delay
                print(f"  [API Rate Limit/Overload] Retrying in {delay:.0f}s...")
                time.sleep(delay)
            else:
                if "ValidationError" in err_str:
                    print(f"  [ValidationError Details] {err_str}")
                    # If this is from pydantic, it might have .errors()
                    if hasattr(e, 'errors'):
                        print(f"  [Pydantic Errors] {e.errors()}")
                if attempt >= max_retries - 1:
                    raise e
                delay = base_delay * (2 ** attempt)
                short_err = err_str.split('\n')[0][:100]
                print(f"  [Transient Error] {type(e).__name__}: {short_err}. Retrying in {delay}s (Attempt {attempt + 1}/{max_retries})...")
                time.sleep(delay)
                attempt += 1

# ---------------------------------------------------------------------------
# Sandbox tool functions
# ---------------------------------------------------------------------------

def get_tools(sandbox_dir: Path):
    def read_file(path: str) -> str:
        """Reads the contents of a file."""
        target = (sandbox_dir / path).resolve()
        if not str(target).startswith(str(sandbox_dir)):
            return "Error: Cannot access files outside the workspace."
        if not target.exists():
            return f"Error: File {path} does not exist."
        return target.read_text()

    def write_file(path: str, content: str) -> str:
        """Writes content to a file, creating directories if needed."""
        target = (sandbox_dir / path).resolve()
        if not str(target).startswith(str(sandbox_dir)):
            return "Error: Cannot access files outside the workspace."
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        return f"Successfully wrote to {path}"

    def append_file(path: str, content: str) -> str:
        """Appends content to a file, creating directories if needed."""
        target = (sandbox_dir / path).resolve()
        if not str(target).startswith(str(sandbox_dir)):
            return "Error: Cannot access files outside the workspace."
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "a") as f:
            f.write("\n" + content)
        return f"Successfully appended to {path}"
        
    def list_directory(path: str) -> str:
        """Lists files and directories in the specified path."""
        target = (sandbox_dir / path).resolve()
        if not str(target).startswith(str(sandbox_dir)):
            return "Error: Cannot access files outside the workspace."
        if not target.exists():
            return f"Error: Directory {path} does not exist."
        if not target.is_dir():
            return f"Error: {path} is not a directory."
        items = list(target.iterdir())
        res = [f"{'[DIR]' if i.is_dir() else '[FILE]'} {i.name}" for i in items]
        return "\n".join(res) if res else "Empty directory"

    tool_list = [read_file, write_file, append_file, list_directory]
    return tool_list


def _build_function_map(tool_list: list) -> dict:
    """Build a name → callable map from the tool functions."""
    return {fn.__name__: fn for fn in tool_list}

# ---------------------------------------------------------------------------
# tool_code fallback parser
# ---------------------------------------------------------------------------

_TOOL_CODE_RE = re.compile(
    r"""default_api\.(\w+)\(([^)]*)\)""",
    re.DOTALL,
)

_KWARG_RE = re.compile(
    r"""(\w+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')""",
    re.DOTALL,
)


def _try_parse_tool_code(text: str, function_map: dict):
    """Parse tool_code-style text into real tool calls and execute them.

    Some Gemini models emit text like:
        tool_code
        print(default_api.write_file(content="...", path="docs/foo.md"))
    instead of proper function_call parts.  This function detects that
    pattern, extracts the function name and kwargs, executes the tool, and
    returns a list of (name, args_dict, result) tuples — or None if the text
    is not tool_code.
    """
    if not text.strip().startswith("tool_code"):
        return None

    calls: list[tuple[str, dict, str]] = []
    for m in _TOOL_CODE_RE.finditer(text):
        fn_name = m.group(1)
        raw_args = m.group(2)
        kwargs = {}
        for km in _KWARG_RE.finditer(raw_args):
            key = km.group(1)
            val = km.group(2) if km.group(2) is not None else km.group(3)
            # Unescape basic sequences
            val = val.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"').replace("\\'", "'")
            kwargs[key] = val

        fn = function_map.get(fn_name)
        if fn is None:
            result = f"Error: Unknown function '{fn_name}'"
        else:
            try:
                result = fn(**kwargs)
            except Exception as e:
                result = f"Error executing {fn_name}: {e}"
        calls.append((fn_name, kwargs, result))
        print(f"  [tool_code fallback] {fn_name}({', '.join(f'{k}=...' for k in kwargs)}) → {str(result)[:120]}")

    return calls if calls else None


# ---------------------------------------------------------------------------
# Explicit history helpers
# ---------------------------------------------------------------------------

_MAX_FUNCTION_ROUNDS = 10  # Cap per skill turn


def _make_content(role: str, text: str) -> types.Content:
    """Create a Content object with a single text part."""
    return types.Content(role=role, parts=[types.Part.from_text(text=text)])


def _skill_turn(client, model_id: str, skill_history: list, config, function_map: dict):
    """Execute one skill agent turn: send history, handle FC loop.

    Returns (all_texts, all_fc_logs, new_history_entries, transcript_entries)
    where new_history_entries are types.Content objects to append to skill_history
    and transcript_entries are plain dicts for the JSON transcript.
    """
    all_texts: list[str] = []
    all_fc_logs: list[str] = []
    new_entries: list[types.Content] = []
    transcript_entries: list[dict] = []

    response = retry_with_backoff(
        lambda: client.models.generate_content(
            model=model_id,
            contents=skill_history,
            config=config,
        )
    )

    for _ in range(_MAX_FUNCTION_ROUNDS):
        # Collect text
        resp_text = None
        try:
            resp_text = response.text
        except Exception:
            pass
        if resp_text:
            all_texts.append(resp_text)

        # Check for function calls
        fc_parts = []
        try:
            if response.function_calls:
                fc_parts = list(response.function_calls)
        except Exception:
            pass

        # If no function calls, check for tool_code fallback
        if not fc_parts and resp_text:
            tc_results = _try_parse_tool_code(resp_text, function_map)
            if tc_results:
                # Record the model's text (which contains tool_code) 
                model_content = response.candidates[0].content
                if not model_content.role:
                    model_content.role = "model"
                new_entries.append(model_content)
                transcript_entries.append({
                    "role": "model",
                    "parts": [{"text": resp_text}],
                })
                # Build synthetic function responses
                fr_parts = []
                tr_fr_parts = []
                for fn_name, fn_args, fn_result in tc_results:
                    all_fc_logs.append(f"[tool_code fallback: {fn_name}({fn_args}) → {str(fn_result)[:200]}]")
                    fr_parts.append(
                        types.Part.from_function_response(name=fn_name, response={"result": fn_result})
                    )
                    result_trunc = str(fn_result)
                    if len(result_trunc) > 500:
                        result_trunc = result_trunc[:500] + "... [TRUNCATED]"
                    tr_fr_parts.append({
                        "function_response": {"name": fn_name, "response": {"result": result_trunc}}
                    })

                fr_content = types.Content(role="tool", parts=fr_parts)
                new_entries.append(fr_content)
                transcript_entries.append({"role": "user", "parts": tr_fr_parts})
                # Feed back and continue the FC loop
                response = retry_with_backoff(
                    lambda: client.models.generate_content(
                        model=model_id,
                        contents=skill_history + new_entries,
                        config=config,
                    )
                )
                continue

        if not fc_parts:
            # No function calls — record the model's final text response
            model_content = response.candidates[0].content
            # Fix empty content to prevent Pydantic validation errors in next turn
            if not model_content.parts:
                model_content.parts = [types.Part.from_text(text=" ")]
            else:
                for p in model_content.parts:
                    if hasattr(p, 'text') and not p.text:
                        p.text = " "
            if not model_content.role:
                model_content.role = "model"
            
            new_entries.append(model_content)
            tr_parts = []
            if resp_text:
                tr_parts.append({"text": resp_text})
            if tr_parts:
                transcript_entries.append({"role": "model", "parts": tr_parts})
            break

        # Real function calls — record the model turn
        model_content = response.candidates[0].content
        # Sanitize empty text parts alongside function calls
        if not model_content.parts:
            model_content.parts = [types.Part.from_text(text=" ")]
        else:
            for p in model_content.parts:
                if hasattr(p, 'text') and p.text is not None and not p.text:
                    p.text = " "
        if not model_content.role:
            model_content.role = "model"

        new_entries.append(model_content)
        tr_model = {"role": "model", "parts": []}
        if resp_text:
            tr_model["parts"].append({"text": resp_text})
        for fc in fc_parts:
            tr_model["parts"].append({"function_call": {"name": fc.name, "args": fc.args}})
        transcript_entries.append(tr_model)

        # Execute each function call
        fr_parts = []
        tr_fr_entry = {"role": "user", "parts": []}
        for fc in fc_parts:
            fn = function_map.get(fc.name)
            if fn is None:
                result = f"Error: Unknown function '{fc.name}'"
            else:
                try:
                    result = fn(**fc.args)
                except Exception as e:
                    result = f"Error executing {fc.name}: {e}"
            all_fc_logs.append(f"[Tool Call: {fc.name}({fc.args}) → {str(result)[:200]}]")
            fr_parts.append(
                types.Part.from_function_response(name=fc.name, response={"result": result})
            )
            result_trunc = str(result)
            if len(result_trunc) > 500:
                result_trunc = result_trunc[:500] + "... [TRUNCATED]"
            tr_fr_entry["parts"].append({
                "function_response": {"name": fc.name, "response": {"result": result_trunc}}
            })

        fr_content = types.Content(role="tool", parts=fr_parts)
        new_entries.append(fr_content)
        transcript_entries.append(tr_fr_entry)

        # Feed function results back to the model
        response = retry_with_backoff(
            lambda: client.models.generate_content(
                model=model_id,
                contents=skill_history + new_entries,
                config=config,
            )
        )

    # Collect any trailing text from the final response
    try:
        final_text = response.text
        if final_text and final_text not in all_texts:
            all_texts.append(final_text)
    except Exception:
        pass

    return all_texts, all_fc_logs, new_entries, transcript_entries


# ---------------------------------------------------------------------------
# Main simulation
# ---------------------------------------------------------------------------

# The opening message that starts every simulation.
_OPENER = "Hi! I need some help starting on my project."

# Signals that the user considers the task done.
_SATISFACTION_SIGNALS = ["end of task", "i'm satisfied", "i am satisfied", "task complete", "all done"]


def simulate_conversation(
    client: genai.Client,
    skill_name: str,
    skill_instructions: str,
    user_persona: str,
    user_goal: str,
    sandbox_dir: Path,
    out_file: Path,
    scenario_name: str,
    turns: int = 5,
    skill_model_id: str = "gemini-2.5-flash",
    user_model_id: str = "gemini-2.5-flash-lite",
    turn_delay: float = 2.0,
    success_files: list[str] | None = None,
):
    # Enforce hard safety cap
    if turns > ABSOLUTE_MAX_TURNS:
        print(f"  ⚠ Requested {turns} turns exceeds ABSOLUTE_MAX_TURNS ({ABSOLUTE_MAX_TURNS}). Capping.")
        turns = ABSOLUTE_MAX_TURNS
    print(f"Starting simulation for {skill_name} (skill={skill_model_id}, user={user_model_id})...")
    
    # Skill Agent config (with tools)
    skill_system_prompt = f"""You are an expert AI agent.
You have access to file editing tools (e.g., read_file, write_file, append_file, list_directory).
When instructions tell you to "Use your file editing tool" or ask you to write, create, or append to a file, YOU MUST CALL THE APPROPRIATE TOOL FUNCTION. Do not just output the text or say you will do it.
Do not spontaneously write or append to temporary scratchpad files (e.g., in ~/.groundwork/ or elsewhere) unless explicitly requested. Keep all internal state or progress tracking in your thoughts or response text.

Follow these exact skill instructions:

{skill_instructions}"""
    tool_list = get_tools(sandbox_dir)
    function_map = _build_function_map(tool_list)
    skill_config = types.GenerateContentConfig(
        system_instruction=skill_system_prompt,
        temperature=0.2,
        tools=tool_list,
    )
    
    # User Agent config (no tools)
    user_system_prompt = f"""You are a simulated user participating in a test of an AI assistant's skills.
Your persona: {user_persona}
Your goal: {user_goal}

Rules for your responses:
1. Act naturally according to your persona.
2. Only provide the information asked for by the assistant. Do not give everything away upfront unless it makes sense.
3. Be concise.
4. If the assistant fulfills your goal, you can acknowledge it and say you are satisfied.
5. IMPORTANT: Never repeat the opening greeting or re-introduce yourself mid-conversation. You are always continuing the same conversation. If the assistant seems to restart, gently redirect: "We were already discussing this — let's continue where we left off."
6. If the assistant tells you they have completed a file or document, respond naturally to that — acknowledge it, review it, or approve it. Do NOT restart the conversation.
"""
    user_config = types.GenerateContentConfig(
        system_instruction=user_system_prompt,
        temperature=0.1,
    )

    # ── Explicit history management ──────────────────────────────────────
    # We own the history lists. No Chat SDK — we pass these to
    # generate_content() directly on every call. This guarantees clean
    # alternation and full visibility.
    skill_history: list[types.Content] = []
    user_history: list[types.Content] = []

    # Our own transcript list for JSON output.
    transcript_entries: list[dict] = []

    def save_transcript():
        with open(out_file, 'w') as f:
            json.dump({
                "scenario": scenario_name,
                "skill_name": skill_name,
                "transcript": transcript_entries
            }, f, indent=2)

    current_message = _OPENER
    print(f"\nUser:\n{current_message}")
    
    task_completed = False
    prev_skill_text = None  # For stuck detection
    stuck_count = 0
    _STUCK_THRESHOLD = 2

    for i in range(turns):
        # ── 1. Add user message to skill history ─────────────────────────
        user_content = _make_content("user", current_message)
        skill_history.append(user_content)
        transcript_entries.append({"role": "user", "parts": [{"text": current_message}]})

        # ── 2. Skill agent responds (with FC loop) ──────────────────────
        try:
            all_texts, all_fc_logs, new_entries, turn_tr = _skill_turn(
                client, skill_model_id, skill_history, skill_config, function_map
            )
            # Append all new Content objects to skill_history
            skill_history.extend(new_entries)
            transcript_entries.extend(turn_tr)
            save_transcript()
        except Exception as e:
            print(f"Error calling Skill Agent: {e}")
            break

        # Extract user-facing text (last text fragment)
        skill_text_for_user = all_texts[-1].strip() if all_texts else ""
        log_text = "\n".join(all_texts + all_fc_logs) if (all_texts or all_fc_logs) else "[Empty response]"

        print(f"\nAssistant (turn {i + 1}/{turns}, {len(skill_history)} history entries):\n{log_text}")

        # ── 3. Check success files ──────────────────────────────────────
        if success_files:
            present = [(f, (sandbox_dir / f).exists()) for f in success_files]
            if all(exists for _, exists in present):
                print(f"\n  [TERMINATION] Success: All success_files present after turn {i + 1}.")
                for sf, _ in present:
                    print(f"    - {sf} ✓")
                task_completed = True
                break

        # ── 4. Stuck detection ──────────────────────────────────────────
        if skill_text_for_user and skill_text_for_user == prev_skill_text:
            stuck_count += 1
            if stuck_count >= _STUCK_THRESHOLD:
                print(f"\n  [TERMINATION] Stuck: Skill repeated identical response {_STUCK_THRESHOLD}x. Stopping at turn {i + 1}.")
                break
        else:
            stuck_count = 0
        prev_skill_text = skill_text_for_user

        if i == turns - 1:
            print(f"\n  [TERMINATION] Turn limit reached ({turns} turns).")
            break

        # ── 5. Send skill text to user agent ────────────────────────────
        if not skill_text_for_user:
            # Skill produced only tool calls with no text. Describe what happened.
            skill_text_for_user = "The assistant is working on your request (performing file operations)."

        if turn_delay > 0:
            time.sleep(turn_delay)

        try:
            user_history.append(_make_content("user", skill_text_for_user))
            user_response = retry_with_backoff(
                lambda: client.models.generate_content(
                    model=user_model_id,
                    contents=user_history,
                    config=user_config,
                )
            )
            current_message = user_response.text or "Please continue."
            user_history.append(_make_content("model", current_message))
        except Exception as e:
            print(f"Error calling User Agent: {e}")
            break
            
        print(f"\nUser:\n{current_message}")

        # ── 6. User satisfaction signal ─────────────────────────────────
        if any(sig in current_message.lower() for sig in _SATISFACTION_SIGNALS):
            if success_files:
                present = [(f, (sandbox_dir / f).exists()) for f in success_files]
                if all(exists for _, exists in present):
                    task_completed = True
                    print(f"\n  [TERMINATION] User satisfied + all success_files present.")
                else:
                    missing = [f for f, ok in present if not ok]
                    print(f"\n  [TERMINATION] User satisfied but success_files missing: {missing}")
                    task_completed = False
            else:
                task_completed = True
                print(f"\n  [TERMINATION] User satisfied (no success_files required).")
            break

    if success_files:
        return task_completed
    return True

def run_scenario(client, suite_name: str, scenario_file: Path, turns: int,
                 skill_model_id: str, user_model_id: str,
                 turn_delay: float = 2.0, run_id: str = "run_default"):
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
    turns = scenario.get("turns", turns)  # scenario JSON wins
    
    # Setup Sandbox & Paths
    base_dir = Path(__file__).parent.resolve()
    sandbox_dir = REPO_ROOT / ".sandboxes" / "evals"
    run_dir = base_dir / "runs" / suite_name / run_id
    workspace_dir = run_dir / "workspace"
    
    # 1. Wipe sandbox for a clean slate
    if sandbox_dir.exists():
        shutil.rmtree(sandbox_dir)
    sandbox_dir.mkdir(parents=True, exist_ok=True)
            
    # 2. Initialize GroundWork in the sandbox
    print("Running 'groundwork init' in sandbox to populate latest skills...")
    try:
        subprocess.run(
            ["node", str(REPO_ROOT / "bin" / "groundwork.js"), "init"],
            cwd=sandbox_dir,
            check=True,
            capture_output=True,
            text=True
        )
    except subprocess.CalledProcessError as e:
        print(f"ERROR: groundwork init failed:\n{e.stderr}")
        return

    # 3. Seed from dependency
    if depends_on:
        dep_fixture = base_dir / "fixtures" / suite_name / depends_on
        if workspace_dir.exists():
            print(f"Seeding sandbox from current run workspace...")
            shutil.copytree(workspace_dir, sandbox_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.agents'))
        elif dep_fixture.exists():
            print(f"Seeding sandbox from dependency fixtures: {depends_on}")
            shutil.copytree(dep_fixture, sandbox_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.agents'))
        else:
            print(f"WARNING: No workspace or fixture for {depends_on}. Sandbox not seeded.")
        
    # Prepare transcript
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
    )
    
    # Save workspace only on success
    if success:
        if workspace_dir.exists():
            shutil.rmtree(workspace_dir)
        shutil.copytree(sandbox_dir, workspace_dir, dirs_exist_ok=True)
        print(f"Sandbox saved to workspace: {workspace_dir}")
    else:
        print(f"WARNING: Failed. Workspace NOT updated.")
    
    print(f"\nTranscript saved to {out_file}")

def main():
    parser = argparse.ArgumentParser(description="Run simulated conversational evaluations.")
    parser.add_argument("--suite", required=True, help="Name of the scenario suite")
    parser.add_argument("--scenario", help="Specific scenario name (without .json)")
    parser.add_argument("--all", action="store_true", help="Run all scenarios in the suite")
    parser.add_argument("--turns", type=int, default=5, help="Default conversation turns")
    parser.add_argument("--skill-model", default="gemini-2.5-flash", help="Model for skill agent (default: gemini-2.5-flash)")
    parser.add_argument("--user-model", default="gemini-2.5-flash-lite", help="Model for user agent (default: gemini-2.5-flash-lite)")
    parser.add_argument("--turn-delay", type=float, default=2.0, help="Seconds between turns (default: 2.0)")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable is required.")
        exit(1)
        
    client = genai.Client(api_key=api_key)

    suite_dir = Path(__file__).parent / "scenarios" / args.suite
    if not suite_dir.exists():
        print(f"ERROR: Suite directory {suite_dir} does not exist.")
        exit(1)
        
    if args.all:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_id = f"run_{timestamp}"
        scenarios = sorted(suite_dir.glob("*.json"))
        for s_file in scenarios:
            if s_file.name == "suite.json":
                continue
            run_scenario(client, args.suite, s_file, args.turns,
                        args.skill_model, args.user_model, args.turn_delay, run_id)
    elif args.scenario:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_id = f"run_{timestamp}"
        s_file = suite_dir / f"{args.scenario}.json"
        if not s_file.exists():
            print(f"ERROR: Scenario file {s_file} does not exist.")
            exit(1)
        run_scenario(client, args.suite, s_file, args.turns,
                    args.skill_model, args.user_model, args.turn_delay, run_id)
    else:
        print("ERROR: Must specify either --scenario or --all")

if __name__ == "__main__":
    main()
