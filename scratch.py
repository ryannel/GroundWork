import os
from google import genai
from google.genai import types

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

def my_tool(x: int) -> int:
    return x + 1

config = types.GenerateContentConfig(tools=[my_tool])
chat = client.chats.create(model="gemini-2.5-flash", config=config)
chat.send_message("Please call my_tool with 5 and tell me the result.")

def serialize_history(history):
    res = []
    for msg in history:
        m = {"role": msg.role, "parts": []}
        for part in msg.parts:
            if getattr(part, 'text', None):
                m["parts"].append({"text": part.text})
            elif getattr(part, 'function_call', None):
                m["parts"].append({"function_call": {"name": part.function_call.name, "args": part.function_call.args}})
            elif getattr(part, 'function_response', None):
                m["parts"].append({"function_response": {"name": part.function_response.name, "response": part.function_response.response}})
        res.append(m)
    return res

print(serialize_history(chat._curated_history))
