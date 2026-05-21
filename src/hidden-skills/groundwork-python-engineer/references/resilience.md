# Resilience

## Timeouts

Set explicit timeouts on every outbound HTTP call:

```python
import httpx

client = httpx.AsyncClient(
    timeout=httpx.Timeout(
        connect=5.0,   # TCP connection
        read=30.0,     # Full response body
        write=10.0,    # Request body
        pool=5.0,      # Connection from pool
    )
)
```

Own the timeout at the provider level. The `read` timeout is critical for ML/API providers — a streaming response that hangs mid-way waits indefinitely without it.

## Retries

Use `tenacity` for retry logic:

```python
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

@retry(
    retry=retry_if_exception_type(TransientError),
    wait=wait_exponential_jitter(initial=1, max=30),
    stop=stop_after_attempt(3),
)
async def _call_with_retry(self, payload: dict) -> dict:
    return await self._client.post(payload)
```

**Jitter is not optional.** Backoff without jitter causes thundering herd.

**Only retry transient errors.** A `400` is permanent — retrying wastes budget. Map errors to domain types before retrying.

## Circuit Breakers

Prevent cascading failure from a down dependency:

```python
from circuitbreaker import circuit

@circuit(
    failure_threshold=5,
    recovery_timeout=30,
    expected_exception=TransientError,
)
async def complete(self, prompt: str) -> str:
    return await self._client.complete(prompt)
```

**Set `expected_exception` explicitly.** A breaker that trips on all exceptions produces false opens.

## Graceful Shutdown

FastAPI + Uvicorn handle `SIGTERM` correctly when `lifespan` is used:

1. `SIGTERM` received
2. Stop accepting new connections
3. In-flight requests and `BackgroundTasks` complete
4. `lifespan` cleanup runs
5. Process exits

Keep the shutdown path fast:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    resources = await initialise_resources()
    yield
    await asyncio.wait_for(resources.close(), timeout=4.0)
```

## Health Probes

**`/healthz` (liveness):** Returns `200` unconditionally. No external dependency checks.

**`/readyz` (readiness):** Returns `200` only after startup completes. Returns `503` during startup and shutdown.

```python
@router.get("/healthz")
async def liveness() -> dict:
    return {"status": "ok"}

@router.get("/readyz")
async def readiness(state: AppState = Depends(get_app_state)) -> dict:
    if not state.ready:
        raise HTTPException(status_code=503, detail="not ready")
    return {"status": "ready"}
```

## Graceful Degradation

Return partial results rather than hard errors when non-critical steps fail:

```python
async def process_with_enrichment(self, input_uri: str) -> Result:
    base = await self.primary_gateway.process(input_uri)
    try:
        enrichment = await self.secondary_gateway.enrich(base)
        return base.with_enrichment(enrichment)
    except EnrichmentUnavailableError:
        logger.warning("enrichment.unavailable", item_id=base.id)
        return base
```

Log every degraded response with structured context. Silent degradation is invisible in production.

## Anti-Patterns

- **No timeout on provider calls.** Hung connections hold indefinitely.
- **Retrying non-transient errors.** A `400` never succeeds on retry.
- **Circuit breaker on all exceptions.** False opens from caller errors.
- **Long-running lifespan shutdown.** Force-killed by orchestrator.
- **Silent degradation.** Partial results without structured logs.
