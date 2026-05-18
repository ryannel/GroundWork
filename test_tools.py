import os, time
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
                time.sleep(delay)
            else:
                raise e

def write_file(path: str, content: str) -> str:
    """Writes content to a file."""
    print(f"CALLED write_file: {path}")
    return f"Successfully wrote to {path}"

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
chat = client.chats.create(
    model="gemini-2.5-flash",
    config=types.GenerateContentConfig(
        system_instruction="You must use the write_file tool to write 'hello' to 'test.txt' and then say 'Done'.",
        tools=[write_file]
    )
)
resp = retry_with_backoff(lambda: chat.send_message("Please write the file."))
print("RESPONSE TEXT:", resp.text)
for msg in chat._curated_history:
    print(msg.role)
    for part in msg.parts:
        if getattr(part, 'text', None): print("  text:", part.text)
        if getattr(part, 'function_call', None): print("  function_call:", part.function_call.name)
        if getattr(part, 'function_response', None): print("  function_response:", part.function_response.name)
