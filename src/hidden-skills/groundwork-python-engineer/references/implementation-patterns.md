# Implementation Patterns

Concrete Python patterns for trace-first development, error handling, dependency injection, and idiomatic standards.

## 1. Trace-First Development

Every inbound request starts a trace. Every outbound call cascades it.

### Initializing a Span

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def process_item(item_id: str) -> None:
    with tracer.start_as_current_span("ProcessItem") as span:
        span.set_attribute("item.id", item_id)
        # ... processing logic
```

When publishing to Pub/Sub or calling another service, explicitly inject the current trace context into HTTP headers or message attributes.

## 2. Error Handling

Use explicit `Exception` subclasses defined in the Domain to prevent SDK errors from polluting business logic.

### Defining Domain Exceptions

```python
# src/<pkg>/core/exceptions.py

class AppError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, cause: Exception | None = None):
        super().__init__(message)
        self.cause = cause

class ModelInferenceError(AppError):
    """Raised when an AI model fails to return a valid response."""

class TransientInferenceError(AppError):
    """Raised on transient provider failures — eligible for retry."""

class PermanentInferenceError(AppError):
    """Raised on permanent failures — do not retry."""
```

### Wrapping Errors in Providers

Providers catch library-specific errors and raise Domain exceptions:

```python
class ExternalAPIProvider:
    def process(self, payload: str) -> Result:
        try:
            raw = self._client.call(payload)
            if raw.error:
                raise ModelInferenceError(f"Provider failed: {raw.error}")
            return self._to_domain(raw)
        except sdk.ServerError as e:
            raise TransientInferenceError("Provider unavailable", cause=e)
        except sdk.BadRequestError as e:
            raise PermanentInferenceError("Invalid payload", cause=e)
```

## 3. Dependency Injection

### The Port (Gateway)

The Protocol belongs in `core/gateways/` and uses only Domain language:

```python
from typing import Protocol
from myservice.core.domain.models import Result

class ProcessingGateway(Protocol):
    def process(self, input_uri: str) -> Result: ...
```

### The Wiring (Composition Root)

Constructor injection at the entrypoint startup:

```python
from fastapi import Depends

def get_processing_service(
    provider: ConcreteProvider = Depends()
) -> ProcessingService:
    return ProcessingService(gateway=provider)
```

## 4. Strict Typing over Duck Typing

Use `typing.Protocol` and strict type hints on all domain models. Dependency inversion is compile-time verifiable via `mypy`/`pyright`:

```python
from typing import Protocol
from dataclasses import dataclass

@dataclass(frozen=True)
class ProcessingRequest:
    input_url: str
    language: str

class ProcessingGateway(Protocol):
    def process(self, request: ProcessingRequest) -> str: ...
```

## 5. Context Managers for Resource Lifecycle

Always use `with` and `@contextmanager` for stateful resources. Guarantees cleanup even when domain logic crashes:

```python
from contextlib import contextmanager
import tempfile, os

@contextmanager
def temporary_file(data: bytes, suffix: str = ".tmp"):
    """Ensures ephemeral files are always deleted after processing."""
    path = tempfile.mktemp(suffix=suffix)
    try:
        with open(path, "wb") as f:
            f.write(data)
        yield path
    finally:
        if os.path.exists(path):
            os.remove(path)
```

## 6. Configuration Validation

Validate all environment variables at startup using `pydantic-settings`. Do not use `os.environ.get()` scattered throughout the codebase.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    environment: str = Field(default="production", pattern="^(development|staging|production)$")
    database_url: str = Field(..., description="Postgres connection string")
    api_key: str = Field(..., min_length=16)

# Initialised once at the composition root
settings = AppSettings()
```

This ensures missing or invalid configuration crashes the service immediately at boot, rather than during a request.

## 7. Idiomatic Standards

- **PEP 8** for fundamental syntax.
- **Google Python Style Guide** for enterprise structure and docstrings.
- **`mypy --strict`** in CI for type safety.
- **`ruff`** for fast linting and formatting.
- **`uv`** for dependency management — no `pip`, `poetry`, or `pipenv`.
