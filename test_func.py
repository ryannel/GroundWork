import os
from google import genai
from google.genai import types
import json

def append_file(path: str, content: str) -> str:
    print(f"Executing append_file({path})")
    return "Appended."

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
config = types.GenerateContentConfig(
    system_instruction="Call append_file with 'test.txt' and 'hello'. Say NOTHING else.",
    tools=[append_file],
    automatic_function_calling={"disable": False}
)
chat = client.chats.create(model="gemini-2.5-flash", config=config)
resp = chat.send_message("Do it.")
print("Text:", resp.text)
if resp.function_calls:
    print("Function Calls:", [f.name for f in resp.function_calls])
print("History length:", len(chat.get_history()))
