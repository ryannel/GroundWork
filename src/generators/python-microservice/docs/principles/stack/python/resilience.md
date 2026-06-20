---
title: Resilience
description: Timeouts, retries, circuit breakers, graceful shutdown, and health checks for Python microservices.
status: active
last_reviewed: 2026-05-26
---

# Resilience

## TL;DR

Every outbound call has a timeout. Transient failures retry with jitter. Sustained provider failures open a circuit breaker. The service shuts down gracefully — in-flight requests complete before the process exits.

---

## Why This Matters

ML inference is slow, expensive, and fails in ways that general web services don't encounter. A single hung provider request without a timeout holds a connection open until the client gives up — which may be never. An API rate limit without retries converts a transient error into a user-visible failure. A redeployment without graceful shutdown drops in-flight requests mid-stream.

These are not edge cases to harden after launch. They are the predictable failure modes of a service that calls external APIs, and the patterns to handle them are straightforward.

---

## Timeouts

Set explicit timeouts on every outbound HTTP call. `httpx.AsyncClient` accepts granular timeout configuration:

```python
import httpx

client = httpx.AsyncClient(
    timeout=httpx.Timeout(
        connect=5.0,   # Time to establish the TCP connection
        read=30.0,     # Time to receive the full response body
        write=10.0,    # Time to send the request body
        pool=5.0,      # Time waiting for a connection from the pool
    )
)
```

Own the timeout at the provider level. The provider controls the connection; the timeout is part of its contract, not a concern of the service that calls it.

`read` timeout is the critical one for ML providers. The default httpx timeout covers connection establishment only — a streaming response that hangs mid-transfer will wait indefinitely without an explicit `read` value.

---

## Retries

Use `tenacity` for retry logic. It handles exponential backoff, jitter, and async correctly, and keeps retry policy visible at the call site:

```python
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)
from app.core.exceptions import TransientInferenceError

@retry(
    retry=retry_if_exception_type(TransientInferenceError),
    wait=wait_exponential_jitter(initial=1, max=30),
    stop=stop_after_attempt(3),
)
async def _call_with_retry(self, payload: dict) -> dict:
    return await self._client.post(payload)
```

**Jitter is not optional.** Exponential backoff without jitter causes a thundering herd: all failed requests retry at the same moment, amplifying the load on a provider that is already struggling. `wait_exponential_jitter` adds random variance to break the synchronisation.

**Only retry transient errors.** Map provider errors to domain exceptions before retrying. A `400 Bad Request` is a permanent failure — retrying wastes time and burns API budget. A `503 Service Unavailable` or a network timeout is transient:

```python
class AssemblyAIProvider:
    async def transcribe(self, audio_uri: str) -> TranscriptionResult:
        try:
            return await self._call_with_retry(audio_uri)
        except aai.errors.BadRequestError as e:
            raise PermanentInferenceError("Invalid audio format", cause=e)
        except (aai.errors.ServerError, httpx.TimeoutException) as e:
            raise TransientInferenceError("AssemblyAI unavailable", cause=e)
```

The `retry_if_exception_type` check ensures only `TransientInferenceError` triggers a retry. Permanent errors surface immediately.

---

## Circuit Breakers

A circuit breaker prevents a failing dependency from cascading into the rest of the service. When a provider fails repeatedly, the circuit opens and subsequent calls fail fast — protecting system resources and giving the provider time to recover.

Use the `circuitbreaker` library:

```python
from circuitbreaker import circuit
from app.core.exceptions import TransientInferenceError

class OpenAIProvider:
    @circuit(
        failure_threshold=5,
        recovery_timeout=30,
        expected_exception=TransientInferenceError,
    )
    async def complete(self, prompt: str) -> str:
        return await self._client.complete(prompt)
```

After 5 consecutive `TransientInferenceError` exceptions, the circuit opens. For the next 30 seconds, calls fail immediately without reaching the provider. After the recovery timeout, one probe request goes through — if it succeeds, the circuit closes; if not, it opens again.

**Set `expected_exception` explicitly.** A circuit breaker that trips on all exceptions — including domain logic errors — produces false opens and makes the service appear unavailable when the problem is the caller, not the provider.

---

## Graceful Shutdown

The service handles `SIGTERM` by draining in-flight requests before exiting. FastAPI and Uvicorn implement this correctly when `lifespan` is used:

1. Kubernetes sends `SIGTERM`
2. Uvicorn stops accepting new connections
3. In-flight requests and `BackgroundTasks` complete
4. `lifespan` cleanup runs: pools close, clients disconnect
5. Process exits with code 0

The only requirement on the application side: keep the `lifespan` shutdown path fast and non-blocking. Avoid long-running cleanup that delays exit beyond the Kubernetes `terminationGracePeriodSeconds`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    resources = await initialise_resources()
    yield
    # Shutdown must complete before Kubernetes force-kills the pod
    await asyncio.wait_for(resources.close(), timeout=4.0)
```

---

## Health and Readiness Probes

Expose two endpoints. Kubernetes uses them to route traffic correctly:

**`/healthz` — liveness.** The process is running and not deadlocked. Returns `200` unconditionally if the event loop is responding. No external dependency checks — a slow database must not cause a liveness failure, which would trigger a pod restart.

**`/readyz` — readiness.** The service can handle traffic. Returns `200` only after startup completes (database pool initialised, Pub/Sub subscription established). Returns `503` during startup and during graceful shutdown so Kubernetes stops routing new requests to the pod before it terminates.

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

Set `state.ready = False` at the start of the graceful shutdown sequence — before the process begins draining. This prevents Kubernetes from sending new requests to a pod that is about to exit.

---

## Graceful Degradation

When a non-critical step fails, return a partial result rather than a hard error. A transcription without speaker labels is useful. An empty response is not.

Define degradation explicitly at the service layer:

```python
async def transcribe_with_diarization(self, audio_uri: str) -> TranscriptionResult:
    transcript = await self.transcriber.transcribe(audio_uri)

    try:
        speakers = await self.diarizer.diarise(transcript)
        return transcript.with_speakers(speakers)
    except DiarizationUnavailableError:
        logger.warning("diarization.unavailable", meeting_id=transcript.meeting_id)
        return transcript
```

Log every degraded response with structured context. Silent degradation — returning a reduced result without a log or metric — makes the failure mode invisible in production.

---

## Anti-Patterns

**No timeout on provider calls.** Without an explicit `read` timeout, a hung provider holds the connection open indefinitely. Every `httpx.AsyncClient` needs timeout configuration.

**Retrying non-transient errors.** A `400` or domain `ValidationError` will never succeed on retry. Map errors to domain types first; only `TransientInferenceError` retries.

**Circuit breaker on all exceptions.** Trips on caller errors, producing false opens that make the service appear down when the provider is healthy.

**Long-running lifespan shutdown.** Cleanup that blocks for more than a few seconds will be force-killed by Kubernetes, leaving resources in an inconsistent state.

**Silent degradation.** A partial result returned without a structured log is invisible to the on-call engineer debugging why a non-critical feature is missing.
