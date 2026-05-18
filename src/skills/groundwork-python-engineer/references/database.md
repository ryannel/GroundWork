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
from myservice.providers.database import async_session_maker

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
```

### Injecting into Providers

Inject the `AsyncSession` into concrete Providers. **Never pass the session into the Service or Domain layers.**

```python
from fastapi import Depends
from myservice.core.gateways import StoryGateway
from myservice.providers.postgres.story_repo import PostgresStoryRepository

def get_story_gateway(
    session: AsyncSession = Depends(get_db_session)
) -> StoryGateway:
    # PostgresStoryRepository implements StoryGateway
    return PostgresStoryRepository(session=session)

def get_story_service(
    gateway: StoryGateway = Depends(get_story_gateway)
) -> StoryService:
    return StoryService(gateway=gateway)
```

## 3. Transaction Boundaries

By default, the `get_db_session` dependency provides an open transaction if the SQLAlchemy engine is configured correctly. However, explicit transaction boundaries (commit/rollback) belong in the Provider or the Service, depending on the isolation requirement.

If the Service coordinates multiple Gateway calls that must be transactional, use a generic "Unit of Work" (UoW) pattern rather than leaking `session.commit()` into the Service.

## 4. Test Isolation

Never mock the database. Use Testcontainers for a real Postgres instance.
Between tests, isolate state by truncating tables rather than recreating the schema, as truncation is significantly faster.

```python
import pytest
from sqlalchemy import text

@pytest.fixture(autouse=True)
async def clear_database(db_session: AsyncSession):
    """Truncates all tables between tests."""
    await db_session.execute(text("TRUNCATE TABLE stories, users CASCADE;"))
    await db_session.commit()
```

## Anti-Patterns

- **Leaking sessions.** Passing `AsyncSession` directly into the Domain or Service layer breaks the Dependency Inversion Principle.
- **Manual migration scripts.** Writing manual `ALTER TABLE` statements causes drift. Use a declarative engine.
- **Mocking the database.** Use Testcontainers. Mocks hide SQL syntax errors and constraint violations.
