---
title: Code Documentation
description: How to document Python code — structure over comments, Pydantic as the primary documentation layer.
status: active
last_reviewed: 2026-05-26
---

# Code Documentation

## TL;DR

Structure documents more reliably than comments. Type annotations are verified by `mypy`. Pydantic `Field(description=...)` flows directly into OpenAPI. Test names are executable documentation. Docstrings and inline comments are a last resort — used only when the code alone cannot convey the why.

---

## Structure Over Comments

Comments are promises that no linter can verify. When code changes, `mypy` catches type errors and `pytest` catches behavioural regressions — but stale docstrings silently mislead. In a codebase where AI agents drive significant code velocity, comment drift is not hypothetical; it is the default outcome.

**The documentation hierarchy:**

1. **Type annotations** — `mypy`/`pyright` reject incorrect types. Zero drift risk.
2. **Pydantic `Field(description=...)`** — part of the code; flows into OpenAPI, Swagger UI, and validation errors.
3. **Naming** — descriptive function and variable names. Refactor first; comment last.
4. **Test names** — executable documentation verified by CI on every run.
5. **Docstrings** — one-line summaries for route handlers (Swagger) and complex public APIs.
6. **Inline "why" comments** — last resort for genuinely non-obvious decisions.

Everything at levels 1–4 is verified by tooling. Levels 5–6 are human promises with drift risk. Minimise them.

---

## Pydantic as the Primary Documentation Layer

In a FastAPI service, Pydantic models are the primary documentation layer. `Field(description=...)` generates OpenAPI specs, Swagger UI field descriptions, and validation error messages — all from a single source of truth that cannot drift because it is the code:

```python
from pydantic import BaseModel, Field
from typing import Annotated

class MeetingCreate(BaseModel):
    """Request payload for creating a new meeting."""

    title: Annotated[str, Field(
        max_length=200,
        description="Human-readable meeting title",
        examples=["Sprint Planning"],
    )]
    host_id: Annotated[str, Field(
        description="UUID of the user hosting the meeting",
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    )]
    scheduled_at: Annotated[datetime | None, Field(
        default=None,
        description="ISO 8601 datetime for scheduled start. Omit for instant meetings.",
        examples=["2026-09-17T14:00:00Z"],
    )]
```

| Approach | Drift risk | Tooling integration |
|----------|-----------|---------------------|
| Docstring listing fields | **High** — nothing verifies accuracy | None |
| `Field(description=...)` | **Zero** — it is the code | OpenAPI, Swagger UI, validation errors, IDE hover |

**Never duplicate `Field(description=...)` content in a class docstring.** The class docstring gets one line describing the model's domain role — nothing more:

```python
# Good
class MeetingCreate(BaseModel):
    """Request payload for creating a new meeting."""
    title: Annotated[str, Field(description="Human-readable meeting title")]

# Bad — docstring duplicates what Field already expresses
class MeetingCreate(BaseModel):
    """Request payload for creating a new meeting.
    Attributes:
        title: Human-readable meeting title, max 200 chars.
        host_id: UUID of the hosting user.
    """
```

---

## Route Handler Docstrings

FastAPI renders route handler docstrings in Swagger UI. That is the only reason they exist.

```python
@router.post("/meetings", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    body: Annotated[MeetingCreate, Body()],
    auth: Annotated[AuthContext, Depends(require_auth)],
) -> MeetingResponse:
    """Creates a new meeting. Requires `meetings:write` scope."""
```

One line is usually enough. Add a second sentence only when the behaviour has a non-obvious aspect that the signature cannot convey:

```python
async def create_meeting(...) -> MeetingResponse:
    """Creates a new meeting. Requires `meetings:write` scope.

    If `scheduled_at` is provided, the meeting starts in `scheduled` status.
    Otherwise it starts immediately in `active` status.
    """
```

Do not document parameters in the route handler docstring — they are documented via Pydantic `Field` and `Annotated`.

---

## What to Document

| What | How |
|------|-----|
| Pydantic model fields | `Field(description=...)` |
| Pydantic model class | One-line docstring describing its domain role |
| Route handler | One-line docstring for Swagger UI |
| Complex public function with non-obvious contract | Minimal docstring covering edge cases and error conditions types cannot express |
| Side effects invisible in the signature | Note in docstring (event publishing, cache invalidation) |
| Module when the filename is not self-explanatory | 1–3 line module docstring |

---

## What Not to Document

**`__init__` with typed parameters:**

```python
# Bad — the types say everything
class MeetingService:
    def __init__(self, repo: MeetingRepository, notifier: Notifier) -> None:
        """Initializes MeetingService with repo and notifier."""

# Good
class MeetingService:
    """Orchestrates meeting lifecycle operations."""

    def __init__(self, repo: MeetingRepository, notifier: Notifier) -> None:
        self._repo = repo
        self._notifier = notifier
```

**Simple functions where the signature is self-evident:**

```python
# Bad — restating the signature
def get_meeting(meeting_id: str) -> Meeting | None:
    """Gets a meeting by its ID, returning Meeting or None."""

# Good — no docstring needed
def get_meeting(meeting_id: str) -> Meeting | None:
    ...
```

**`Args`/`Returns` sections that duplicate type hints:**

```python
# Bad
def process(audio_url: str, diarize: bool = True) -> TranscriptResult:
    """
    Args:
        audio_url (str): URL of the audio file.
        diarize (bool): Whether to diarize. Defaults to True.
    Returns:
        TranscriptResult: The transcript result.
    """

# Good — add only what types cannot convey
def process(audio_url: str, diarize: bool = True) -> TranscriptResult:
    """Processes audio and returns a structured transcript.

    Raises:
        AudioDownloadError: If the URL is unreachable.
        DiarizationError: If diarization is requested but HF_TOKEN is missing.
    """
```

---

## Inline Comments

Inline comments within function bodies are justified only for genuinely non-obvious "why" that cannot be expressed through naming or structure:

```python
async def transcribe(self, audio: AudioSegment) -> TranscriptResult:
    audio = audio.resample(16000) if audio.sample_rate != 16000 else audio

    # Batch size 16 determined via GPU memory profiling on T4 instances.
    segments = self._model.transcribe(audio.numpy(), batch_size=16)

    # HACK(alice): WhisperX returns negative start times on clips <2s.
    # Clamp to zero until upstream fix. See whisperX#XXX.
    for seg in segments:
        seg.start = max(0.0, seg.start)

    return TranscriptResult(segments=segments)
```

The resample call needs no comment — the conditional is clear. The batch size and the clamping hack are genuinely non-obvious and justify comments.

---

## In-Code Markers

Use a consistent format that includes the author and an issue reference:

```python
# TODO(bob): Switch to streaming transcription when WhisperX v4 adds support.
#            Current batch approach buffers full audio in memory. Issue #123.

# FIXME(carol): Race condition on concurrent requests for same audio_id.
#               Needs distributed lock via Redis. Issue #456.

# HACK(dave): Pyannote v3.1 returns empty segments for audio < 500ms.
#             Remove after v3.2 upgrade.
```

A marker without an issue reference is a marker that will never be resolved.

---

## Module Docstrings

Module docstrings orient developers navigating the codebase. Keep them to 1–3 lines:

```python
"""Meeting domain entities and business rules.

Domain entities have no knowledge of persistence, transport, or external services.
"""
```

Skip when the filename is self-explanatory. Add one to `__init__.py` only when it re-exports public symbols:

```python
"""Core domain layer exports."""
from .meeting import Meeting
from .participant import Participant
```
