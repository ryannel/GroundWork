import os
from google import genai
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
try:
    resp = client.models.generate_content(model="gemini-1.5-flash-latest", contents="Hello")
    print("Success: gemini-1.5-flash-latest")
except Exception as e:
    print(f"gemini-1.5-flash-latest Failed: {e}")
