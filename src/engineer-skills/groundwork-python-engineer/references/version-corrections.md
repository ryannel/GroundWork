# Version Corrections

Where the model's training data is stale. This file is a checklist, not a tutorial — each item names what changed, why it bites, and the minimal fix. Verify against `pyproject.toml` before applying; a project pinned to older majors may not carry all of these yet.

## Pydantic v2 API, not v1

`model_validate` / `model_dump` / `model_dump_json`, `@field_validator` / `@model_validator`, and `ConfigDict` replace v1's `parse_obj` / `.dict()` / `.json()`, `@validator` / `@root_validator`, and class-based `Config`. Training data mixes the two freely; the v1 forms raise deprecation warnings or fail outright on v2. Settings classes come from `pydantic-settings`, a separate package — `from pydantic import BaseSettings` is a v1 import that no longer exists.

## SQLAlchemy 2.0 style

`select()` executed via `session.execute(...)` / `session.scalars(...)` replaces `session.query()`; models declare `Mapped[...]` columns with `mapped_column()` under `DeclarativeBase`. Query-style training data still runs on the legacy shim but is not the idiom this codebase uses.

## FastAPI lifespan, not `on_event`

`@app.on_event("startup")` / `("shutdown")` are deprecated — startup/shutdown logic lives in a `lifespan` async context manager passed to the app constructor. This is also where async resources are initialised (`references/async-patterns.md`).

## `uv` is the toolchain

Dependencies, environments, and script running go through `uv` — `uv sync`, `uv add`, `uv run pytest`. Training data reaches for `pip install`, `poetry add`, or `requirements.txt`; none of those files or commands belong in this workspace.
