import os
from google import genai
from google.genai import types

def write_file(path: str, content: str) -> str:
    """Writes content to a file."""
    print(f"CALLED write_file: {path}")
    return f"Successfully wrote to {path}"

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
config = types.GenerateContentConfig(
    system_instruction="You must use the write_file tool to write 'hello' to 'test.txt' and then say 'Done'.",
    tools=[write_file],
    automatic_function_calling={"disable": False}
)
chat = client.chats.create(model="gemini-2.5-flash", config=config)
resp = chat.send_message("Please write the file.")
print("RESPONSE TEXT:", resp.text)
for msg in chat._curated_history:
    print(msg.role)
    for part in msg.parts:
        if getattr(part, 'text', None): print("  text:", part.text)
        if getattr(part, 'function_call', None): print("  function_call:", part.function_call.name)
        if getattr(part, 'function_response', None): print("  function_response:", part.function_response.name)
