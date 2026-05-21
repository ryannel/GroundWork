# Testing

## The Model: Honeycomb, Not Pyramid

Testcontainers spins up real Postgres/Pub/Sub in seconds. The confidence it provides is categorically different from any mock. Mock-heavy suites pass while production breaks.

**Service tests are the default.** Unit tests are reserved for genuinely complex logic. System tests are minimal.

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
def fake_gateway():
    gw = AsyncMock()
    gw.process.return_value = DomainResult(...)
    return gw

async def test_endpoint_returns_result(client, app, fake_gateway):
    app.dependency_overrides[get_gateway] = lambda: fake_gateway
    response = await client.post("/process", json={"input": "test"})
    assert response.status_code == 200
```

Route handler, service, and validation all run for real. Only the external API call is substituted.

### Live Provider Tests

Gated behind `--run-integration`:

```python
@pytest.mark.integration
async def test_provider_against_real_api(gateway, fixture_data):
    result = await gateway.process(fixture_data)
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
- Service methods that orchestrate gateway calls
- Endpoint handlers that validate and delegate
- Providers that translate SDK responses

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
uv run pytest tests/integration                 # Requires Docker
uv run pytest tests/integration --run-integration  # Includes live APIs
uv run pytest tests/system                      # Bootstrap + golden path
```

## Anti-Patterns

- **Mocking the interior.** Test what comes out, not which methods were called.
- **Testing delegation.** `assert gateway.called_once_with(...)` tests the mock, not the code.
- **Fixture factories that mirror domain.** Construct only what the test needs.
- **`scope="session"` on mutable state.** Containers: safe. Application state: not.
- **Skipping the async client.** `TestClient` hides async behaviour. Use `httpx.AsyncClient`.
