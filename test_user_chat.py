import os
import json
from google import genai
from google.genai import types

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

with open('tests/evals/scenarios/storytelling_engine/suite.json') as f:
    suite_config = json.load(f)

user_persona = suite_config.get("user_persona", "A standard developer")
user_goal = suite_config.get("user_goal", "I want you to help me with a task.")

user_system_prompt = f"""You are a simulated user participating in a test of an AI assistant's skills.
Your persona: {user_persona}
Your goal: {user_goal}

Rules for your responses:
1. Act naturally according to your persona.
2. Only provide the information asked for by the assistant. Do not give everything away upfront unless it makes sense.
3. Be concise.
4. If the assistant fulfills your goal, you can acknowledge it and say you are satisfied.
"""
user_config = types.GenerateContentConfig(
    system_instruction=user_system_prompt,
    temperature=0.7,
)

user_chat = client.chats.create(model="gemini-2.5-flash", config=user_config)

print(user_chat.send_message("Product Brief complete.").text)
