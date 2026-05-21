from google.genai import types

try:
    c = types.Content(role="model", parts=[types.Part.from_text(text="")])
    params = types._GenerateContentParameters(
        model="gemini-2.5-flash",
        contents=[c]
    )
    print("Success empty string")
except Exception as e:
    print(f"Error empty string: {e}")

try:
    c = types.Content(role="model", parts=[])
    params = types._GenerateContentParameters(
        model="gemini-2.5-flash",
        contents=[c]
    )
    print("Success empty parts")
except Exception as e:
    print(f"Error empty parts: {e}")

