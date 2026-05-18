# Code Documentation

## Hierarchy

Structure documents more reliably than comments. Documentation priority:

1. **Type annotations** — `mypy`/`pyright` reject incorrect types. Zero drift risk.
2. **Pydantic `Field(description=...)`** — part of the code; flows into OpenAPI, Swagger UI, validation errors.
3. **Naming** — descriptive function and variable names. Refactor first; comment last.
4. **Test names** — executable documentation verified by CI.
5. **Docstrings** — one-line summaries for route handlers (Swagger) and complex public APIs.
6. **Inline "why" comments** — last resort for genuinely non-obvious decisions.

Levels 1–4 are verified by tooling. Levels 5–6 are human promises with drift risk. Minimise them.

## Pydantic as Documentation

```python
from pydantic import BaseModel, Field
from typing import Annotated

class ItemCreate(BaseModel):
    """Request payload for creating a new item."""

    title: Annotated[str, Field(
        max_length=200,
        description="Human-readable item title",
        examples=["Sprint Planning"],
    )]
    owner_id: Annotated[str, Field(
        description="UUID of the owning user",
        pattern=r"^[0-9a-f]{8}-...$",
    )]
```

**Never duplicate `Field(description=...)` content in a class docstring.** One line for the model's domain role — nothing more.

## Route Handler Docstrings

One line for Swagger UI. Add a second only for non-obvious behaviour:

```python
@router.post("/items", status_code=201)
async def create_item(body: ItemCreate) -> ItemResponse:
    """Creates a new item. Requires `items:write` scope."""
```

## What to Document

| What | How |
|------|-----|
| Pydantic fields | `Field(description=...)` |
| Pydantic class | One-line docstring |
| Route handler | One-line for Swagger |
| Complex public function | Minimal docstring for edge cases |
| Side effects | Note in docstring |
| Module (non-obvious name) | 1–3 line module docstring |

## What NOT to Document

- `__init__` with typed parameters — types say everything
- Simple functions where signature is self-evident
- `Args`/`Returns` sections that duplicate type hints

Document only what types cannot convey:

```python
def process(audio_url: str, diarize: bool = True) -> Result:
    """Processes audio and returns a structured result.

    Raises:
        DownloadError: If the URL is unreachable.
        ConfigError: If diarization is requested but API key is missing.
    """
```

## Inline Comments

Justified only for genuinely non-obvious "why":

```python
# Batch size 16 determined via GPU memory profiling on T4 instances.
segments = self._model.process(data, batch_size=16)

# HACK(alice): Library returns negative start times on clips <2s.
# Clamp to zero until upstream fix. See lib#XXX.
for seg in segments:
    seg.start = max(0.0, seg.start)
```

## In-Code Markers

```python
# TODO(bob): Switch to streaming when SDK v4 adds support. Issue #123.
# FIXME(carol): Race condition on concurrent requests. Issue #456.
# HACK(dave): Workaround for library bug. Remove after v3.2 upgrade.
```

A marker without an issue reference will never be resolved.

---

# MCP Servers in Python

## Architecture

MCP servers live in the entrypoint layer. Tools delegate to services — they contain no business logic. Docstrings and type hints are the schema.

```python
from fastmcp import FastMCP

mcp = FastMCP(
    name="my-service",
    instructions="Capabilities this server exposes.",
)
```

## Tools

```python
@mcp.tool()
async def process_item(
    input_url: str,
    language: str = "en",
) -> ProcessedResult:
    """
    Process an item and return structured output.

    Returns segments with labels, confidence scores, and timestamps.
    Use when you need to convert raw input into structured data.

    Args:
        input_url: URI of the input file.
        language: BCP-47 language code.
    """
    return await service.process(input_url, language=language)
```

**The docstring is the tool schema.** Write it for an LLM deciding whether to invoke the tool.

**Return domain types, not SDK types.** Tool return types must serialise to JSON cleanly.

## Resources

Read-only data an agent can browse for context. No inference, no side effects:

```python
@mcp.resource("items://{item_id}")
async def get_item(item_id: str) -> Item:
    """Retrieve a completed item by ID."""
    return await repository.get(item_id)
```

## Mounting on FastAPI

```python
app = FastAPI(lifespan=lifespan)
app.mount("/mcp", mcp.get_asgi_app())
```

## Anti-Patterns

- **Business logic in tool body.** One line: a service call.
- **SDK types in signatures.** Use domain Pydantic models.
- **Missing docstrings.** Agents cannot select tools with vague descriptions.
- **`stdio` in production.** Use HTTP transport for concurrent agents.
- **Resources that run inference.** Resources are reads from storage.
