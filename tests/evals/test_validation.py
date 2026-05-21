import os
import json
from google import genai
from google.genai import types

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

contents = [
    types.Content(role="user", parts=[types.Part.from_text(text="Hello")]),
    types.Content(role="model", parts=[types.Part.from_text(text="")]),
    types.Content(role="user", parts=[types.Part.from_text(text="Next")]),
]

try:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
    )
    print("Success")
except Exception as e:
    print(f"Error: {e}")
