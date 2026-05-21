from google.genai import types

try:
    c = types.Content(role="tool", parts=[types.Part.from_text(text="test")])
    params = types._GenerateContentParameters(
        model="gemini-2.5-flash",
        contents=[c]
    )
    print("Success tool role")
except Exception as e:
    print(f"Error tool role: {e}")
