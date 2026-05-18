import os
import json
import argparse
import time
from pathlib import Path
from google import genai
from google.genai import types

def retry_with_backoff(func, max_retries=5, base_delay=4):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            if "503" in str(e) or "429" in str(e) or "exhausted" in str(e).lower():
                delay = base_delay * (2 ** attempt)
                print(f"  [API Rate Limit/Overload] Retrying in {delay}s...")
                time.sleep(delay)
            else:
                raise e

def evaluate_transcript(
    client: genai.Client,
    transcript: list,
    rubric: str,
    skill_instructions: str,
    model_id: str = "gemini-2.5-flash"
):
    
    # Format transcript
    formatted_transcript = ""
    for msg in transcript:
        role = "Simulated User" if msg["role"] == "user" else "Skill Assistant"
        formatted_transcript += f"\n[{role}]\n"
        for part in msg["parts"]:
            if "text" in part:
                formatted_transcript += f"{part['text']}\n"
            elif "function_call" in part:
                fc = part["function_call"]
                formatted_transcript += f"*[Called Tool: {fc['name']} with args {fc['args']}]*\n"
            elif "function_response" in part:
                fr = part["function_response"]
                formatted_transcript += f"*[Tool Output from {fr['name']}: {fr['response']}]*\n"
        
    system_prompt = f"""You are an expert AI evaluator grading a conversational test of an AI assistant skill.
The skill's original instructions are:
<skill_instructions>
{skill_instructions}
</skill_instructions>

Your task is to review the following conversation between the Simulated User and the Skill Assistant, and grade it against the following rubric:
<rubric>
{rubric}
</rubric>

Provide:
1. A brief analysis of how the assistant performed against the rubric.
2. A final verdict (PASS/FAIL).
3. Proposed specific improvements or changes to the SKILL.md file to fix any issues observed.
"""

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.2,
    )
    
    print("Evaluating transcript...")
    response = retry_with_backoff(lambda: client.models.generate_content(
        model=model_id,
        contents=f"Please evaluate this transcript:\n<transcript>{formatted_transcript}</transcript>",
        config=config
    ))
    
    return response.text

def main():
    parser = argparse.ArgumentParser(description="Grade a simulated conversational evaluation.")
    parser.add_argument("--transcript", required=True, help="Path to transcript JSON file")
    parser.add_argument("--skill-path", required=True, help="Path to SKILL.md file")
    parser.add_argument("--rubric", required=False, help="Evaluation rubric string", default="1. Did the assistant avoid question-bombing? 2. Did the assistant correctly follow the skill instructions? 3. Did the assistant effectively fulfill the user's hidden goal?")
    parser.add_argument("--output", required=True, help="Path to save the evaluation report")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model to use")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable is required.")
        exit(1)
        
    client = genai.Client(api_key=api_key)

    with open(args.transcript, 'r') as f:
        data = json.load(f)
        transcript = data.get("transcript", [])
        
    with open(args.skill_path, 'r') as f:
        skill_instructions = f.read()
        
    evaluation_result = evaluate_transcript(
        client=client,
        transcript=transcript,
        rubric=args.rubric,
        skill_instructions=skill_instructions,
        model_id=args.model
    )
    
    out_file = Path(args.output)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(out_file, 'w') as f:
        f.write(evaluation_result)
        
    print(f"\nEvaluation saved to {out_file}")

if __name__ == "__main__":
    main()
