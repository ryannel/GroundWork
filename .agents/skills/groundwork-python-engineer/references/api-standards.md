# API Standards & Inbound Defenses

Every Python service must expose a hardened, predictable API surface. Implement these Day-2 operational requirements at the FastAPI entrypoint layer.

## 1. Idempotency

Mutating endpoints (`POST`, `PATCH`) must be idempotent to allow safe client retries; `PUT` is idempotent by HTTP semantics and needs no key.

- Require an `Idempotency-Key` header on mutating requests.
- Intercept the key in middleware or a FastAPI dependency before business logic executes.
- Store the intent and the final response in a fast, persistent store (e.g., Redis).
- If a request arrives with a known key and is `IN_PROGRESS`, return `409 Conflict`.
- If a request arrives with a known key and is `COMPLETED`, return the cached response immediately.

```python
from fastapi import Header, Depends

async def verify_idempotency(
    idempotency_key: str = Header(..., min_length=16)
):
    # Check Redis/DB. If completed, raise a custom exception that 
    # an exception handler catches to return the cached response.
    pass

@router.post("/items")
async def create_item(
    body: ItemCreate,
    _: None = Depends(verify_idempotency)
) -> ItemResponse:
    # Business logic executes only once per key
    pass
```

## 2. Cursor-Based Pagination

Never use offset/limit pagination for collections. Offset pagination scales poorly (O(N) database scans) and skips/duplicates items if the underlying dataset changes during iteration.

- Always return a `cursor` (usually a base64-encoded string representing the last seen ID and sort column).
- Include `has_next` boolean.
- Use generic Pydantic wrappers for paginated responses.

```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class PaginatedList(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None
    has_next: bool

@router.get("/items")
async def list_items(cursor: str | None = None, limit: int = 50) -> PaginatedList[ItemResponse]:
    # Pass cursor down to the gateway/repository
    pass
```

## 3. Load Shedding & Concurrency Limits

Do not allow an API to queue requests indefinitely until memory is exhausted or timeouts cascade.

- Implement an inbound concurrency limit (e.g., using a FastAPI middleware that acquires an `asyncio.Semaphore`).
- When the semaphore is exhausted, immediately shed load by returning `503 Service Unavailable`.
- This ensures the service remains responsive for health checks and active requests, rather than becoming a black hole.

## 4. CORS Configuration

Configure `CORSMiddleware` explicitly. Never use `allow_origins=["*"]` in production.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,  # Loaded from env
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)
```

## Anti-Patterns

- **Offset pagination.** `?limit=50&offset=1000` requires the database to scan and discard 1,000 rows.
- **Ignoring idempotency keys.** Clients will retry on timeouts, causing duplicate side effects (e.g., double charges, duplicate records).
- **Queuing without bounds.** A service processing 10 req/sec should reject the 100th concurrent request rather than queuing it for 10 seconds.
- **Wildcard CORS.** Leaks cross-origin data. Always restrict to known frontends.
