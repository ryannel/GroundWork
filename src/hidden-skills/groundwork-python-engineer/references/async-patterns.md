# Async Patterns

## The One Rule: Never Block the Event Loop

Any synchronous call longer than ~1ms inside an `async def` stalls every other coroutine. Symptoms: random, unrelated timeouts across the service.

Blocking calls — file I/O, model loading, `time.sleep`, synchronous SDK methods — must run in a thread:

```python
import asyncio

result = await asyncio.to_thread(blocking_function, arg1, arg2)
```

## Structured Concurrency with TaskGroup

`asyncio.TaskGroup` is the only primitive that guarantees all tasks complete — or are cancelled — before control returns to the caller:

```python
async def process_item(item_id: str) -> ProcessedResult:
    async with asyncio.TaskGroup() as tg:
        primary_task = tg.create_task(primary_process(item_id))
        secondary_task = tg.create_task(secondary_process(item_id))

    return ProcessedResult(
        primary=primary_task.result(),
        secondary=secondary_task.result(),
    )
```

If either task raises, `TaskGroup` cancels the sibling and re-raises. No orphaned tasks, no leaked resources.

**Never use bare `asyncio.create_task`.** The event loop holds only a weak reference — if the caller exits, the task is garbage collected mid-execution:

```python
# Wrong — task may be silently dropped
asyncio.create_task(publish_event(event))

# Correct — task lifetime bound to TaskGroup scope
async with asyncio.TaskGroup() as tg:
    tg.create_task(publish_event(event))
```

## Route Handlers

All route handlers are `async def`. Synchronous `def` handlers are threaded by FastAPI's executor — this makes the async/sync boundary invisible and causes subtle performance issues.

## Background Tasks

Use FastAPI's `BackgroundTasks` for post-response work:

```python
from fastapi import BackgroundTasks

@router.post("/process")
async def process_endpoint(
    request: ProcessRequest,
    background_tasks: BackgroundTasks,
) -> ProcessResponse:
    result = await service.process(request.input_url)
    background_tasks.add_task(publish_completed_event, result.id)
    return ProcessResponse.from_domain(result)
```

## Application Lifespan

Initialise shared resources in the FastAPI `lifespan` context manager:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_pool = await create_db_pool()
    app.state.db = db_pool
    yield
    await db_pool.close()

app = FastAPI(lifespan=lifespan)
```

**Never initialise clients at module level.** Module-level runs at import time, before env vars load, and cannot be awaited.

## Toolchain

`uv` manages all Python tooling:

```bash
uv run pytest          # Run tests
uv add httpx           # Add a dependency
uv sync                # Sync from lockfile
```

The lockfile (`uv.lock`) is committed. Every developer and CI run resolves identical trees.

## Anti-Patterns

- **Blocking the event loop.** Use `asyncio.to_thread` for blocking operations.
- **Bare `asyncio.create_task`.** Creates untracked tasks that can be silently dropped.
- **Synchronous `def` route handlers.** Write `async def` so the boundary is explicit.
- **Module-level async initialisation.** `asyncio.run()` at import time conflicts with FastAPI's loop.
- **`asyncio.sleep` as retry delay.** Use `tenacity` with async backoff.
