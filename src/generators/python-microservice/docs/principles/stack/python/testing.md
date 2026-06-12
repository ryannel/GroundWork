---
title: Testing
description: Honeycomb testing for Python microservices — service-perimeter tests as the default, unit tests reserved for complex isolated logic.
status: active
last_reviewed: 2026-05-26
---

# Testing

## TL;DR

We test from the perimeter of the service inward. A request goes in through the HTTP entrypoint, traverses real service and provider logic, and comes back out — with real infrastructure running in containers. Unit tests are reserved for logic so complex it earns isolation. Most tests never see a mock.

---

## The Model: Why Honeycomb, Not Pyramid

The classical test pyramid (many unit tests → some integration tests → few E2E tests) made sense when running a database in a test was expensive and slow. That constraint no longer exists. Testcontainers spins up a real Postgres or Pub/Sub emulator in seconds, and the confidence it provides is categorically different from any mock.

The failure mode of a mock-heavy suite is insidious: tests pass while production breaks. Mocked gateways drift from real behaviour. SQL queries are never exercised. Serialisation boundaries are never crossed. The suite is green and the system is broken.

The **honeycomb model** inverts the priority:

- **Service tests are the default.** The bulk of test coverage comes from tests that exercise the full vertical slice — HTTP in, real infrastructure out.
- **Unit tests are reserved.** Complex isolated algorithms, domain computations, and pure validation logic earn a unit test. Everything else does not.
- **System tests are minimal.** A bootstrap test verifies the DI container wires correctly. A small number of golden-path tests exercise the service end-to-end against a live stack.

This gives us a suite where a passing run is a meaningful signal. The bugs we care about — boundary mismatches, SQL correctness, serialisation errors, provider contract violations — are caught before they reach production.

---

## The Three Tiers

### Tier 1 — Service Tests (the default)

A service test drives the FastAPI app through its HTTP interface using `httpx.AsyncClient` with `ASGITransport`. Infrastructure dependencies (Pub/Sub, storage, databases) run in containers. Provider dependencies that cannot be containerised are replaced at the FastAPI dependency boundary using `dependency_overrides` — not mocked in the interior of the code.

This is the tier where most new tests belong. If you are testing a use case, an endpoint, a pipeline step, or a provider interaction with infrastructure — write a service test.

**Structure:**

```
tests/
  integration/
    entrypoints/       # HTTP-level service tests
    providers/         # Provider tests against real containers or live APIs
```

**Fixture setup — app + async client:**

```python
# tests/integration/conftest.py
import pytest
import httpx
from app.main import create_app

@pytest.fixture(scope="session")
def app():
    return create_app()

@pytest.fixture
async def client(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c
```

**Fixture setup — containerised infrastructure:**

```python
# tests/integration/conftest.py (continued)
import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.google import PubSubContainer

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16-alpine") as container:
        yield container

@pytest.fixture(scope="session")
def pubsub():
    with PubSubContainer() as container:
        yield container
```

Scope containers at `session` when startup cost is high. Reset state between tests using transactions or truncation, not by restarting the container.

**Replacing non-containerisable providers:**

When a provider calls a live third-party API, replace it at the FastAPI boundary — not by patching the internals:

```python
# tests/integration/entrypoints/test_transcribe_api.py
import pytest
from unittest.mock import AsyncMock
from app.entrypoints.api.dependencies import get_transcription_gateway
from app.core.domain.models import Transcript

@pytest.fixture
def fake_transcription_gateway():
    gw = AsyncMock()
    gw.transcribe.return_value = Transcript(...)
    return gw

async def test_transcribe_returns_structured_result(client, app, fake_transcription_gateway):
    app.dependency_overrides[get_transcription_gateway] = lambda: fake_transcription_gateway

    response = await client.post("/transcribe", json={"audio_url": "gs://bucket/file.mp3"})

    assert response.status_code == 200
    assert response.json()["segments"][0]["confidence"] >= 0.0
```

The key distinction: we are replacing the provider at the dependency injection boundary. The route handler, service, and validation logic all run for real. Only the external API call is substituted.

**Live provider tests** (requiring real API keys) live in `tests/integration/providers/` and are marked `@pytest.mark.live` so they can be excluded from normal runs with pytest's `-m` flag:

```python
@pytest.mark.live
async def test_assemblyai_transcribes_real_audio(transcription_gateway, audio_fixture):
    result = await transcription_gateway.transcribe(audio_fixture)
    assert len(result.segments) > 0
    assert result.metadata.duration > 0
```

Run with: `uv run pytest tests/integration -m live`

---

### Tier 2 — Unit Tests (reserved)

A unit test is appropriate when the logic is genuinely complex, has many branches, operates on pure data, and would be painful to exercise through the full HTTP stack. Domain model invariants, audio codec transformations, confidence score calculations, and parsing algorithms are good candidates.

The test for "does this service method call the gateway and return the result" is not a unit test. That behaviour is validated by a service test.

**What earns a unit test:**

- Domain models: immutability, field validation, business rules
- Complex transformations: audio resampling, segment merging, transcript normalisation
- Pure algorithms: confidence thresholding, speaker attribution logic, chunking strategies
- Edge cases too costly to set up through a real HTTP path

**What does not earn a unit test:**

- Service methods that orchestrate calls between a gateway and a domain object
- Endpoint handlers that validate input and delegate
- Providers that translate SDK responses into domain types

**Pattern — domain model:**

```python
# tests/unit/core/domain/test_transcript.py
class TestTranscriptSegment:
    def test_rejects_confidence_above_one(self):
        with pytest.raises(ValidationError):
            TranscriptSegment(text="hello", confidence=1.5, start=0.0, end=1.0)

    def test_is_immutable(self):
        segment = TranscriptSegment(text="hello", confidence=0.9, start=0.0, end=1.0)
        with pytest.raises(ValidationError):
            segment.text = "goodbye"
```

**Pattern — complex algorithm:**

```python
# tests/unit/providers/test_audio_codec.py
class TestResample:
    def test_output_matches_target_sample_rate(self, codec, wav_16khz):
        result = codec.resample(wav_16khz, target_hz=8000)
        assert result.sample_rate == 8000

    def test_duration_is_preserved_within_tolerance(self, codec, wav_16khz):
        result = codec.resample(wav_16khz, target_hz=8000)
        assert abs(result.duration - wav_16khz.duration) < 0.01
```

---

### Tier 3 — System Tests (minimal)

System tests answer one question: does the fully-wired application start and serve requests correctly? There are two of them.

**Bootstrap test** — verifies the DI container initialises without error. Catches missing environment variables, wiring mistakes, and import-time failures before they hit production:

```python
# tests/system/test_bootstrap.py
def test_application_starts_without_error():
    app = create_app()
    assert app is not None
```

**Golden path test** — one end-to-end test per critical user journey, run against the full live stack in CI. Not a substitute for service tests; a smoke check that the seams hold.

---

## Async Configuration

All test functions are async by default. `asyncio_mode = "auto"` in `pyproject.toml` means no decorator is needed:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

Write async tests as plain `async def` functions:

```python
async def test_streaming_session_emits_events(client):
    response = await client.post("/streaming/start", json={"meeting_id": "m-1"})
    assert response.status_code == 200
```

Do not use `@pytest.mark.asyncio` — it is redundant under auto mode and adds noise.

---

## Test Isolation

**Container-backed tests** should not share state. Use one of:

- **Transaction rollback** — wrap each test in a transaction and roll back on teardown. Zero teardown cost, guaranteed clean state.
- **Truncation fixture** — truncate relevant tables in a `function`-scoped fixture. Slower but simpler when transactions interfere with the code under test.

Never rely on test ordering to manage state. A test that requires a previous test to have run is a broken test.

**`dependency_overrides` cleanup** — always reset overrides after a test to prevent state leaking between tests:

```python
@pytest.fixture(autouse=True)
def reset_dependency_overrides(app):
    yield
    app.dependency_overrides.clear()
```

---

## Naming

Every test name describes observable behaviour, not implementation:

```python
# Good
async def test_transcribe_returns_422_when_audio_url_is_missing(client): ...
async def test_streaming_session_assigns_unique_id_per_meeting(client): ...

# Bad
async def test_transcribe_success(client): ...
async def test_streaming(client): ...
```

A failing test name should give an on-call engineer enough information to form a hypothesis without opening the test file.

---

## Running Tests

```bash
uv run pytest tests/unit                        # Unit tests — no infrastructure required
uv run pytest tests/integration -m "not live"   # Service tests — requires Docker; skips live APIs
uv run pytest tests/integration -m live         # Live API provider tests — requires real keys
uv run pytest tests/system                      # Bootstrap + golden path
uv run pytest                                   # Everything
```

---

## Anti-Patterns

**Mocking the interior of a service.** Replacing a gateway with `MagicMock` inside a service test asserts nothing about real behaviour. If you are mocking something that could run in a container, use a container.

**Testing that delegation happens.** `assert gateway.transcribe.called_once_with(segment)` is an assertion about the implementation, not the behaviour. Test what comes back out of the system, not which internal methods were invoked.

**Fixture factories that mirror the domain.** A fixture that constructs a complex domain object with many defaults trains engineers to not think about what data matters for the test. Construct only what the test needs; leave everything else visible.

**`scope="session"` on mutable state.** Session-scoped fixtures that hold mutable objects leak state between tests. Containers are safe at session scope. Application state is not.

**Skipping the async client.** `TestClient` is a synchronous wrapper that hides async behaviour. Use `httpx.AsyncClient` with `ASGITransport` for all entrypoint tests so the lifespan and async middleware execute correctly.
