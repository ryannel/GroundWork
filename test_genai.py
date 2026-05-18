import os
import json
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def test_func():
    """A test function."""
    pass

response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents='Hi, call test_func',
    config=types.GenerateContentConfig(
        tools=[test_func]
    )
)
print(dir(response))
print(f"text: {response.text}")
print(f"function_calls: {response.function_calls}")
