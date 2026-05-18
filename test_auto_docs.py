from google.genai import types
config = types.GenerateContentConfig(
    automatic_function_calling={"disable": False}
)
print("Config:", config)
