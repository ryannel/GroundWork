import os
import json
import argparse
import shutil
import time
import subprocess
from datetime import datetime
from pathlib import Path
from google import genai
from google.genai import types

# The repo root is two levels up from tests/evals/
REPO_ROOT = Path(__file__).parent.parent.parent.resolve()

# Hard safety cap — no run can exceed this regardless of scenario/CLI settings.
# Prevents cost blowouts from bugs or infinite loops.
ABSOLUTE_MAX_TURNS = 50

import grader

def _parse_retry_delay(err_str: str) -> float | None:
    """Extract the suggested retryDelay (seconds) from a Gemini API error string."""
    import re
    match = re.search(r"[Rr]etry[_ ]?[Dd]elay['\"]?\s*[=:]\s*['\"]?(\d+(?:\.\d+)?)", err_str)
    if match:
        return float(match.group(1))
    return None

def retry_with_backoff(func, max_retries=8, base_delay=4):
    """Retry func on transient errors.

    Quota / rate-limit errors (429 / 503 / RESOURCE_EXHAUSTED) are retried
    indefinitely so the run always completes regardless of quota pressure.
    The API retryDelay hint is used when present; otherwise exponential
    backoff capped at 300s is applied.  All other errors are re-raised after
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
                delay = hint if hint else min(base_delay * (2 ** attempt), 300)
                print(f"  [API Rate Limit/Overload] Retrying in {delay:.0f}s...")
                time.sleep(delay)
                attempt += 1
            else:
                if attempt >= max_retries - 1:
                    raise e
                attempt += 1


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

    return [read_file, write_file, append_file, list_directory]

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
    model_id: str = "gemini-2.5-flash",
    turn_delay: float = 2.0,
    success_files: list[str] | None = None,
):
    # Enforce hard safety cap
    if turns > ABSOLUTE_MAX_TURNS:
        print(f"  ⚠ Requested {turns} turns exceeds ABSOLUTE_MAX_TURNS ({ABSOLUTE_MAX_TURNS}). Capping.")
        turns = ABSOLUTE_MAX_TURNS
    print(f"Starting simulation for {skill_name} in sandbox {sandbox_dir}...")
    
    # Setup Skill Agent with Tools
    skill_system_prompt = f"""You are an expert AI agent.
You have access to file editing tools (e.g., read_file, write_file, append_file, list_directory).
When instructions tell you to "Use your file editing tool" or ask you to write, create, or append to a file, YOU MUST CALL THE APPROPRIATE TOOL FUNCTION. Do not just output the text or say you will do it.

Follow these exact skill instructions:

{skill_instructions}"""
    skill_config = types.GenerateContentConfig(
        system_instruction=skill_system_prompt,
        temperature=0.2,
        tools=get_tools(sandbox_dir),
        automatic_function_calling={"disable": False}
    )
    
    # Setup User Agent (no tools)
    user_system_prompt = f"""You are a simulated user participating in a test of an AI assistant's skills.
Your persona: {user_persona}
Your goal: {user_goal}

Rules for your responses:
1. Act naturally according to your persona.
2. Only provide the information asked for by the assistant. Do not give everything away upfront unless it makes sense.
3. Be concise.
4. If the assistant fulfills your goal, you can acknowledge it and say you are satisfied.
"""
    user_config = types.GenerateContentConfig(
        system_instruction=user_system_prompt,
        temperature=0.7,
    )
    
    skill_chat = client.chats.create(model=model_id, config=skill_config)
    user_chat = client.chats.create(model=model_id, config=user_config)
    
    def save_transcript():
        res = []
        for msg in skill_chat._curated_history:
            m = {"role": msg.role, "parts": []}
            for part in msg.parts:
                if getattr(part, 'text', None):
                    m["parts"].append({"text": part.text})
                elif getattr(part, 'function_call', None):
                    m["parts"].append({"function_call": {"name": part.function_call.name, "args": part.function_call.args}})
                elif getattr(part, 'function_response', None):
                    m["parts"].append({"function_response": {"name": part.function_response.name, "response": part.function_response.response}})
            res.append(m)
        with open(out_file, 'w') as f:
            json.dump({
                "scenario": scenario_name,
                "skill_name": skill_name,
                "transcript": res
            }, f, indent=2)

    current_message = "Hi! I need some help starting on my project."
    print(f"\nUser:\n{current_message}")
    
    task_completed = False
    for i in range(turns):
        # 1. Skill Agent replies
        try:
            skill_response = retry_with_backoff(lambda: skill_chat.send_message(current_message))
            save_transcript()
            
            # Print/log the skill response (text and function calls)
            skill_text = ""
            
            try:
                if skill_response.text:
                    skill_text += skill_response.text
            except Exception:
                pass
                
            try:
                if skill_response.function_calls:
                    for fc in skill_response.function_calls:
                        func_call_str = f"[Tool Call: {fc.name}({fc.args})]"
                        print(f"  {func_call_str}")
                        skill_text += "\n" + func_call_str
            except Exception:
                pass

            if not skill_text:
                print(f"  [DEBUG: skill_response text is empty! Full response:]\n{skill_response.model_dump_json(indent=2)}")
                skill_text = "[Error: Model returned an empty response.]"
        except Exception as e:
            print(f"Error calling Skill Agent: {e}")
            break

            
        print(f"\nAssistant (turn {i + 1}/{turns}):\n{skill_text}")

        # Early-exit: stop as soon as all expected output files are present
        if success_files and not task_completed:
            present = [(f, (sandbox_dir / f).exists()) for f in success_files]
            if all(exists for _, exists in present):
                print(f"\n  [TERMINATION] Success Criteria Met: All success_files present after turn {i + 1}.")
                for sf, _ in present:
                    print(f"    - {sf} ✓")
                task_completed = True

        if task_completed:
            break
            
        if i == turns - 1:
            print(f"\n  [TERMINATION] Turn Limit Reached: Completed {turns} turns without meeting success criteria.")
            break
            
        # Pace requests to stay within API quota
        if turn_delay > 0:
            time.sleep(turn_delay)

        # 3. User Agent replies
        try:
            user_response = retry_with_backoff(lambda: user_chat.send_message(skill_text))
            current_message = user_response.text
            save_transcript()
        except Exception as e:
            print(f"Error calling User Agent: {e}")
            break
            
        print(f"\nUser:\n{current_message}")

    return None

def run_scenario(client, suite_name: str, scenario_file: Path, turns: int, model_id: str, turn_delay: float = 2.0):
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
    success_files = scenario.get("success_files")  # optional list of paths relative to sandbox root
    turns = scenario.get("turns", turns)  # scenario JSON wins; CLI --turns is the fallback
    
    # Setup Sandbox & Caching
    base_dir = Path(__file__).parent.resolve()
    sandbox_dir = REPO_ROOT / ".sandboxes" / "evals"
    cache_dir = base_dir / "cache" / suite_name / scenario_name
    
    # 1. Wipe sandbox at start of each run for a clean slate
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

    # 3. Move in the assets we need (from dependency cache)
    if depends_on:
        dep_cache = base_dir / "cache" / suite_name / depends_on
        if dep_cache.exists():
            print(f"Seeding sandbox from dependency cache: {depends_on}")
            # Ignore .agents so we keep the freshly initialized skills
            shutil.copytree(dep_cache, sandbox_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.agents'))
        else:
            print(f"WARNING: Dependency cache {dep_cache} does not exist. Sandbox will not be seeded.")
        
    # Prepare transcript out_file so it can be saved incrementally
    out_dir = base_dir / "transcripts" / suite_name
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file = out_dir / f"{scenario_name}_{timestamp}.json"
            
    simulate_conversation(
        client=client,
        skill_name=skill_name,
        skill_instructions=skill_instructions,
        user_persona=user_persona,
        user_goal=user_goal,
        sandbox_dir=sandbox_dir,
        out_file=out_file,
        scenario_name=scenario_name,
        turns=turns,
        model_id=model_id,
        turn_delay=turn_delay,
        success_files=success_files,
    )
    
    # Save cache
    if cache_dir.exists():
        shutil.rmtree(cache_dir)
    shutil.copytree(sandbox_dir, cache_dir, dirs_exist_ok=True)
    print(f"Sandbox saved to cache: {cache_dir}")
    
    print(f"\nTranscript saved to {out_file}")

def main():
    parser = argparse.ArgumentParser(description="Run simulated conversational evaluations.")
    parser.add_argument("--suite", required=True, help="Name of the scenario suite (e.g., storytelling_engine)")
    parser.add_argument("--scenario", help="Name of the specific scenario file without extension (e.g., 01_product_brief)")
    parser.add_argument("--all", action="store_true", help="Run all scenarios in the suite sequentially")
    parser.add_argument("--turns", type=int, default=5, help="Number of conversation turns")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model to use")
    parser.add_argument("--turn-delay", type=float, default=2.0, help="Seconds to wait between turns (default: 2.0)")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable is required.")
        exit(1)
        
    client = genai.Client(api_key=api_key)
    turn_delay = args.turn_delay

    suite_dir = Path(__file__).parent / "scenarios" / args.suite
    if not suite_dir.exists():
        print(f"ERROR: Suite directory {suite_dir} does not exist.")
        exit(1)
        
    if args.all:
        scenarios = sorted(suite_dir.glob("*.json"))
        for s_file in scenarios:
            if s_file.name == "suite.json":
                continue
            run_scenario(client, args.suite, s_file, args.turns, args.model, turn_delay)
    elif args.scenario:
        s_file = suite_dir / f"{args.scenario}.json"
        if not s_file.exists():
            print(f"ERROR: Scenario file {s_file} does not exist.")
            exit(1)
        run_scenario(client, args.suite, s_file, args.turns, args.model, turn_delay)
    else:
        print("ERROR: Must specify either --scenario or --all")

if __name__ == "__main__":
    main()
