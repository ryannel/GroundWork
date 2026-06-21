# Database & Schema Management

## 1. Declarative Schema

Manual `UP`/`DOWN` migrations (e.g., standard Alembic versions) cause merge conflicts in distributed teams and make the "target state" of the database impossible to read without executing scripts.

We use **declarative schema management**.
- The source of truth is a single `schema.sql` file (or equivalent Prisma/SQLAlchemy models).
- We use a diffing engine (e.g., `atlas` or `alembic revision --autogenerate`) to compute the migration dynamically.
- Migrations are applied automatically during deployment, or generated purely as a verification step in CI.

## 2. Session Management & Dependency Injection

The database session lifecycle is managed at the entrypoint layer (FastAPI), not within the Domain or Service layers.

### The FastAPI Dependency

Use a FastAPI dependency to yield a session and ensure it is closed after the request completes.

```python
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from <package>.adapters.database import async_session_maker

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
```

### Injecting into Adapters

Inject the `AsyncSession` into the concrete adapter. **Never pass the session into the Service or Domain layers.**

```python
from fastapi import Depends
from <package>.core.ports import OrderRepository
from <package>.adapters.repository import PostgresOrderRepository

def get_order_repository(
    session: AsyncSession = Depends(get_db_session)
) -> OrderRepository:
    # PostgresOrderRepository implements the OrderRepository port
    return PostgresOrderRepository(session=session)

def get_order_service(
    repository: OrderRepository = Depends(get_order_repository)
) -> OrderService:
    return OrderService(repository=repository)
```

The dependency is typed as the **port** (the `OrderRepository` Protocol from `<package>.core.ports`), not the concrete `PostgresOrderRepository` — the seam stays on the port.

## 3. Transaction Boundaries

By default, the `get_db_session` dependency provides an open transaction if the SQLAlchemy engine is configured correctly. However, explicit transaction boundaries (commit/rollback) belong in the Provider or the Service, depending on the isolation requirement.

If the Service coordinates multiple repository calls that must be transactional, use a generic "Unit of Work" (UoW) pattern rather than leaking `session.commit()` into the Service.

## 4. The shape of the persistence port

By default the SQLAlchemy `AsyncSession` already is a unit of work and a collection-like store — a thin CRUD service can use it directly rather than defining its own port. Introduce a persistence port (a domain-named repository Protocol in `src/<package>/core/ports.py`) only when a rich domain aggregate must stay storage-ignorant. When you do:

- **One port per aggregate root, named in the domain's language** (`OrderRepository.get`, `.save`) — never a generic `Repository[T]` / `Generic[T]` CRUD base. Its "generic" is unproven from a single implementation, and a uniform CRUD surface leaks the store's shape into the core (the very leak it was meant to prevent).
- **Define the port as a narrow `Protocol` or ABC in the core**, exposing only the methods the service calls. A good size check: if an in-memory fake of the port is awkward to write, the port is too broad.
- When query variety grows, reach for a query object / specification — not more methods on the port or a leaked SQLAlchemy `Select`.
- Integration-test the adapter against a real Postgres (Testcontainers); never mock the port or the database.

## 5. Test Isolation

Never mock the database. Use Testcontainers for a real Postgres instance.
Between tests, isolate state by truncating tables rather than recreating the schema, as truncation is significantly faster.

```python
import pytest
from sqlalchemy import text

@pytest.fixture(autouse=True)
async def clear_database(db_session: AsyncSession):
    """Truncates all tables between tests."""
    await db_session.execute(text("TRUNCATE TABLE orders, users CASCADE;"))
    await db_session.commit()
```

## Anti-Patterns

- **Leaking sessions.** Passing `AsyncSession` directly into the Domain or Service layer breaks the Dependency Inversion Principle.
- **Manual migration scripts.** Writing manual `ALTER TABLE` statements causes drift. Use a declarative engine.
- **Mocking the database.** Use Testcontainers. Mocks hide SQL syntax errors and constraint violations.
