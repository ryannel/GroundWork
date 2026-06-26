# Testing

## The Model: Honeycomb, Not Pyramid

Testcontainers spins up real Postgres/Pub/Sub in seconds. The confidence it provides is categorically different from any mock. Mock-heavy suites pass while production breaks.

**Service tests are the default.** Unit tests are reserved for genuinely complex logic. System tests are minimal.

This is the stack idiom of the framework testing canon (`docs/principles/foundations/testing.md`); when this file and the canon disagree, the canon wins and this file is the one to fix.

---

## Tier 1 — Service Tests (Default)

Drive the FastAPI app through HTTP using `httpx.AsyncClient` with `ASGITransport`. Infrastructure runs in containers. Non-containerisable providers (LLM APIs) are replaced at the FastAPI `dependency_overrides` boundary.

### Fixture Setup — App + Async Client

```python
import pytest
import httpx

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

### Fixture Setup — Containerised Infrastructure

```python
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16-alpine") as container:
        yield container
```

Scope containers at `session`. Reset state via transactions or truncation between tests.

### Replacing Non-Containerisable Providers

Replace at the FastAPI boundary, not by patching internals:

```python
from unittest.mock import AsyncMock

@pytest.fixture
def fake_processor():
    proc = AsyncMock()
    proc.process.return_value = DomainResult(...)
    return proc

async def test_endpoint_returns_result(client, app, fake_processor):
    app.dependency_overrides[get_processor] = lambda: fake_processor
    response = await client.post("/process", json={"input": "test"})
    assert response.status_code == 200
```

Route handler, service, and validation all run for real. Only the external API call is substituted.

### Live Provider Tests

Marked `@pytest.mark.live` and selected explicitly with pytest's `-m` flag (excluded from normal runs with `-m "not live"`):

```python
@pytest.mark.live
async def test_adapter_against_real_api(processor, fixture_data):
    result = await processor.process(fixture_data)
    assert result.confidence > 0
```

---

## Tier 2 — Unit Tests (Reserved)

Appropriate when logic is genuinely complex, has many branches, operates on pure data, and is painful to exercise through HTTP.

**What earns a unit test:**
- Domain model immutability, field validation, business rules
- Complex transformations (resampling, merging, normalisation)
- Pure algorithms (confidence thresholding, chunking strategies)

**What does NOT earn a unit test:**
- Service methods that orchestrate adapter calls
- Endpoint handlers that validate and delegate
- Adapters that translate SDK responses

```python
class TestDomainModel:
    def test_rejects_invalid_confidence(self):
        with pytest.raises(ValidationError):
            Segment(text="hello", confidence=1.5, start=0.0, end=1.0)

    def test_is_immutable(self):
        segment = Segment(text="hello", confidence=0.9, start=0.0, end=1.0)
        with pytest.raises(ValidationError):
            segment.text = "goodbye"
```

---

## Tier 3 — System Tests (Minimal)

**Bootstrap test** — verifies the DI container initialises:

```python
def test_application_starts():
    app = create_app()
    assert app is not None
```

**Golden path test** — one per critical journey, against the full live stack.

---

## Async Configuration

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

Write `async def` tests directly. No `@pytest.mark.asyncio` needed.

## Test Isolation

- **Transaction rollback** per test, or **truncation fixture**.
- Always reset `dependency_overrides` after each test:

```python
@pytest.fixture(autouse=True)
def reset_overrides(app):
    yield
    app.dependency_overrides.clear()
```

## Naming

```python
# Good
async def test_process_returns_422_when_input_missing(client): ...
# Bad
async def test_process_success(client): ...
```

## Running Tests

```bash
uv run pytest tests/unit                        # No infrastructure
uv run pytest tests/integration -m "not live"   # Requires Docker; skips live APIs
uv run pytest tests/integration -m live         # Live API tests — requires real keys
uv run pytest tests/system                      # Bootstrap + golden path
```

## Trace Assertions

Observability is a test surface: a critical-path request must emit an unbroken trace, and a missing span is a test failure, not an instrumentation TODO. The mechanism is an **in-memory span exporter** from the OTel SDK — no external tooling, and the durable approach now that the dedicated trace-test tools have gone dormant.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

@pytest.fixture
def spans():
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return exporter

async def test_process_emits_trace(client, spans):
    await client.post("/process", json={"input": "test"})
    names = {s.name for s in spans.get_finished_spans()}
    assert "POST /process" in names   # the entry span exists
    assert "db.insert" in names        # the work span exists
    # assert the work span is a descendant of the entry span — the trace is connected
```

Assert what the contract promises — the spans that must exist on the journey, that the trace stays connected across hops, and the attributes a dashboard or SLO query depends on. Pinning the exact span tree and every attribute couples the test to implementation and trains the team to delete it.

## Mutation Testing — the assertion-quality read-out

A fat service test drives many branches through one HTTP call and can *execute* them all while only asserting on the response body. Mutation testing is the one instrument that proves the suite checks what it runs: inject a fault, confirm a test fails, and a surviving mutant is a line you cover but do not check. Treat it as a **signal, never a gate** — run it on the high-risk modules the risk matrix flags and on changed code only.

Use `mutmut` or `cosmic-ray`. A gotcha: `mutmut` 3 no longer mutates module-level code (only function bodies), so a module whose risk lives in top-level constants or table definitions needs `cosmic-ray` or `mutmut` 2. Scope a run to the dense package under change (`mutmut run --paths-to-mutate src/<pkg>/pricing`), read it as a read-out, and turn each surviving mutant on changed high-risk code into the missing assertion — the same read-out catches AI-generated tests whose oracle was lifted from the implementation.

## Anti-Patterns

- **Mocking the interior.** Test what comes out, not which methods were called.
- **Testing delegation.** `assert adapter.called_once_with(...)` tests the mock, not the code.
- **Fixture factories that mirror domain.** Construct only what the test needs.
- **`scope="session"` on mutable state.** Containers: safe. Application state: not.
- **Skipping the async client.** `TestClient` hides async behaviour. Use `httpx.AsyncClient`.

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice-worker rolls out permanent coverage as part of the same slice, before the driver reviews it (bet workflow, Delivery). The bet-progress tests prove the capability once and are archived; these stay.

- **Service perimeter test (always).** One test per capability the slice delivered, through `httpx.AsyncClient` against the real app with a real database — the coverage that survives refactors.
- **Unit tests (when logic earned them).** Pure-function tests for branching business logic the slice introduced — validation rules, transformations, state machines. Plumbing does not earn unit tests; the perimeter test already covers it.
- **Property-based tests (when invariants exist).** A slice that introduced an invariant — round-trip serialization, idempotent consumers, order-independent merges — pins it with Hypothesis, because example-based tests sample invariants instead of stating them.
- **Critical-path trace assertions (when the slice added an observable path).** A slice that introduced an endpoint or worker whose trace a dashboard or SLO depends on pins it with an in-memory-exporter test: the entry and work spans exist and the trace stays connected. A missing span is a test failure, not an instrumentation TODO.
- **Contract conformance (when the slice changed an API).** FastAPI's served `/openapi.json` must match the promoted spec in `docs/architecture/api/<service>/openapi.yaml`; the generated system suite checks this — the slice's job is to keep the spec promotion current.
