---
title: MCP Servers in Python
description: How to build FastMCP servers in Python — tools, resources, prompts, HTTP transport, and integration with FastAPI.
status: active
last_reviewed: 2026-05-26
---

# MCP Servers in Python

## TL;DR

We expose service capabilities to AI agents through FastMCP servers that live in the entrypoint layer. Tools delegate to services — they contain no business logic. Docstrings and type hints are the schema. `stdio` is for local tooling only; production uses HTTP transport.

---

## Why MCP

The Model Context Protocol gives AI agents a standardised way to discover and invoke service capabilities. Rather than hardcoding API calls into agent prompts, MCP exposes named, schema-validated tools that agents can select and call dynamically.

The architectural position is the same as any other entrypoint: the FastMCP server validates inputs, delegates to services, and returns domain outputs. It owns no logic.

---

## Server Construction

```python
from fastmcp import FastMCP

mcp = FastMCP(
    name="my-service",
    instructions="One sentence describing the capabilities this server exposes.",
)
```

Initialise the MCP server at module level. Wire it into the FastAPI lifespan so its lifecycle is managed alongside the rest of the application (see [Async Patterns](async.md) — Application Lifespan).

**Use HTTP transport in production.** The `stdio` transport is for local CLI tooling and development only. A backend service fleet requires HTTP (SSE or Streamable HTTP) so multiple agents can connect concurrently:

```python
mcp = FastMCP(name="my-service", transport="streamable-http")
```

---

## Tools

A tool is a callable an agent can invoke. Expose service methods as tools — not provider methods, not internal utilities.

```python
@mcp.tool()
async def transcribe_audio(
    audio_url: str,
    language: str = "en",
) -> TranscriptionResult:
    """
    Transcribe audio from a GCS URL and return a structured transcript.

    Returns segments with speaker labels, confidence scores, and timestamps.
    Use this when you need to convert audio into text for downstream analysis.

    Args:
        audio_url: GCS URI of the audio file (e.g. gs://bucket/file.mp3).
        language: BCP-47 language code. Defaults to English.
    """
    return await transcription_service.transcribe(audio_url, language=language)
```

**The docstring is the tool schema.** FastMCP generates the JSON Schema an agent uses for tool selection and parameter construction from the function signature and docstring. A vague or missing docstring produces a schema the agent cannot reliably use.

Write the docstring as if the reader is an LLM deciding whether and how to invoke the tool:

- **First line:** what the tool does
- **Second paragraph:** when to use it — this is the selection signal
- **`Args`:** every parameter with its expected format and valid values

**Return domain types, not SDK types.** Tool return types must serialise cleanly to JSON. Domain Pydantic models serialise correctly. SDK response objects do not — and passing them across the entrypoint boundary violates hexagonal architecture.

**Type hints are enforced at runtime.** FastMCP validates inputs against the function signature before the tool is called. Missing or incorrect type hints cause silent schema degradation that only surfaces when an agent tries to invoke the tool.

---

## Resources

A resource exposes data an agent can read without invoking a workflow:

```python
@mcp.resource("items://{item_id}")
async def get_item(item_id: str) -> Item:
    """
    Retrieve a completed item by ID.

    Read this before calling processing tools to avoid redundant work.
    """
    return await item_repository.get(item_id)
```

Resources are read-only. An agent browses them for context before deciding which tool to call. Keep them cheap — no inference, no heavy computation, no side effects.

---

## Prompts

A prompt is a structured message template for guiding agent behaviour in a specific, repeatable workflow:

```python
@mcp.prompt()
def analyse_prompt(item_id: str, focus: str) -> str:
    """Structure an analysis task over a specific item."""
    return f"""
    You are analysing item {item_id}.
    Focus: {focus}

    Start by reading the resource at items://{item_id}.
    Then use the available tools to complete your analysis.
    Report findings with direct references to the source material.
    """.strip()
```

---

## Mounting on FastAPI

Mount the MCP server as an ASGI sub-application so observability middleware, lifespan, and dependency injection stay aligned:

```python
from fastapi import FastAPI
from myservice.entrypoints.mcp.server import mcp

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.mount("/mcp", mcp.get_asgi_app())
    return app
```

---

## Anti-Patterns

**Business logic in a tool body.** The tool body is one line: a service call. Logic belongs in the domain, not in an MCP decorator.

**SDK types in tool signatures.** A parameter or return type from an external SDK will fail to serialise or expose implementation details to the agent. Use domain Pydantic models.

**Missing or vague docstrings.** An agent cannot reliably select or invoke a tool with a one-word description. The docstring is the interface — treat it with the same rigour as the type signature.

**`stdio` transport in production.** Single-process, single-client only. Cannot be load-balanced and does not support concurrent agent connections.

**Resources that run inference.** Resources are reads from storage. Anything that triggers model inference or heavy computation belongs in a tool.
