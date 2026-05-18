from google.genai import types

part = types.Part.from_function_call(name="append_file", args={"file": "foo"})
print("dir(part):", dir(part))
print("part.function_call:", part.function_call)
