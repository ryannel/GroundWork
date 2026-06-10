---
title: Async Patterns
description: Structured concurrency, FastAPI async, background tasks, and the application lifecycle for Python microservices.
status: active
last_reviewed: 2026-05-26
---

# Async Patterns

## TL;DR

A Python microservice built on FastAPI is async-first. Every route handler, service method, and provider call is `async def`. The event loop must never block. CPU-bound and blocking operations run off the event loop via `asyncio.to_thread`. Concurrent work uses `asyncio.TaskGroup` — never bare `create_task`.

---

## Why Async

An async-first service design is suited to these characteristics:

1. **Streaming connections** — WebSocket connections remain open for the duration of a session. A synchronous server blocks the entire process on each open connection.
2. **Concurrent inference** — Multiple independent operations run in parallel. Async makes this composition natural and explicit.
3. **Pub/Sub consumption** — Background message processing runs alongside live HTTP traffic without requiring threads.

A synchronous model can handle all of this, but requires explicit thread management, shared state coordination, and careful GIL reasoning. Async eliminates that complexity at one cost: the event loop must never block.

---

## The One Rule: Never Block the Event Loop

Any synchronous call longer than a few milliseconds inside an `async def` function stalls every other coroutine in the process. The symptoms look like random, unrelated timeouts across the service.

Blocking calls — file I/O, model loading, `time.sleep`, synchronous SDK methods — must run in a thread:

```python
import asyncio

result = await asyncio.to_thread(load_and_run_model, audio_path)
```

`asyncio.to_thread` runs the callable in the default thread pool executor and returns a coroutine. The event loop stays responsive while the blocking work executes.

If you are unsure whether a call blocks, check for it in OpenTelemetry traces. A span that is unexpectedly long without any child spans is a sign the event loop was blocked inside it.

---

## Structured Concurrency with TaskGroup

When multiple coroutines should run concurrently, use `asyncio.TaskGroup`. It is the only primitive that guarantees all tasks complete — or are cancelled — before control returns to the caller.

```python
async def process_meeting(meeting_id: str) -> MeetingResult:
    async with asyncio.TaskGroup() as tg:
        transcription_task = tg.create_task(transcribe(meeting_id))
        speaker_task = tg.create_task(identify_speakers(meeting_id))

    return MeetingResult(
        transcript=transcription_task.result(),
        speakers=speaker_task.result(),
    )
```

If either task raises, `TaskGroup` cancels the sibling and re-raises the exception — no orphaned tasks, no leaked resources, no silent failures.

**Never use bare `asyncio.create_task` for fire-and-forget work.** The event loop holds only a weak reference to tasks created this way. If the calling coroutine exits before the task completes, it is garbage collected mid-execution. This is a source of silent data loss that is extremely difficult to reproduce.

```python
# Wrong — task may be silently dropped
asyncio.create_task(publish_event(event))

# Correct — task lifetime is bound to the TaskGroup scope
async with asyncio.TaskGroup() as tg:
    tg.create_task(publish_event(event))
```

---

## Route Handlers

All route handlers are `async def`. FastAPI runs them directly in the event loop. Synchronous `def` handlers are threaded by FastAPI's default executor — this makes the async/sync boundary invisible and is a source of subtle performance issues.

```python
from fastapi import APIRouter

router = APIRouter()

@router.post("/transcribe")
async def transcribe_endpoint(request: TranscribeRequest) -> TranscribeResponse:
    result = await transcription_service.transcribe(request.audio_url)
    return TranscribeResponse.from_domain(result)
```

---

## Background Tasks

For work that should happen after a response is returned — publishing a Pub/Sub event, triggering downstream processing — use FastAPI's `BackgroundTasks`:

```python
from fastapi import BackgroundTasks

@router.post("/transcribe")
async def transcribe_endpoint(
    request: TranscribeRequest,
    background_tasks: BackgroundTasks,
) -> TranscribeResponse:
    result = await transcription_service.transcribe(request.audio_url)
    background_tasks.add_task(publish_completed_event, result.id)
    return TranscribeResponse.from_domain(result)
```

FastAPI runs background tasks after the response is sent but before the connection closes. They are bound to the request lifecycle and will complete before the server exits during graceful shutdown.

---

## Application Lifespan

Initialise shared resources — database connection pools, model clients, Pub/Sub subscriptions — in the FastAPI `lifespan` context manager. This ensures resources are available before the first request and are released cleanly on shutdown.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_pool = await create_db_pool()
    pubsub_client = await create_pubsub_client()

    app.state.db = db_pool
    app.state.pubsub = pubsub_client

    yield

    await db_pool.close()
    await pubsub_client.close()

app = FastAPI(lifespan=lifespan)
```

Never initialise database pools or SDK clients at module level. Module-level initialisation runs at import time, before environment variables are loaded, and cannot be awaited.

---

## Toolchain

`uv` manages all Python tooling — dependencies, virtual environments, and script execution:

```bash
uv run pytest          # Run tests
uv add httpx           # Add a dependency
uv sync                # Sync from lockfile
uv run python -m your_service  # Run the service
```

The lockfile (`uv.lock`) is committed. Every developer and CI run resolves identical dependency trees. There is no `pip`, `poetry`, or `pipenv` in this service.

---

## Anti-Patterns

**Blocking the event loop.** Any synchronous call over ~1ms inside `async def` degrades the entire service. Use `asyncio.to_thread` for blocking operations.

**Bare `asyncio.create_task`.** Creates an untracked task that can be silently dropped. Use `TaskGroup`.

**Synchronous `def` route handlers.** FastAPI threads them silently. Write `async def` so the boundary is explicit.

**Module-level async initialisation.** Calling `asyncio.run()` at import time or using `asyncio.get_event_loop()` creates a new event loop that conflicts with FastAPI's loop. Initialise in `lifespan`.

**`asyncio.sleep` as a retry delay.** Sleeping inline blocks the coroutine's task slot. Use `tenacity` with async backoff (see [Resilience](resilience.md)).
