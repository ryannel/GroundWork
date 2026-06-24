# Phase 3: Service Documentation & API Stubs

For each scaffolded service, create two files: a service document and an API stub. These give every developer a consistent entry point into each service from day one — before any product code exists.

Create `docs/architecture/services/` and `docs/architecture/api/` if they do not exist.

## Service Document

Write `docs/architecture/services/<service-name>.md` for each service:

```markdown
# <service-name>

**Generator:** <generator-name>
**Language:** Go | TypeScript | Python
**Port:** <port>
**Base path:** `services/<service-name>/`

## Overview

<One paragraph: what this service does and its role in the system. Derive from the architecture document.>

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| PostgreSQL | Database | `<service-name>` database — DB-backed services only; a stateless frontend owns no database |
| `<other-service>` | Service | Called via HTTP — URL at `<OTHER_SERVICE_URL>` env var |
| `<external-provider>` | External | e.g. Clerk, GCP Pub/Sub |

## API

[`docs/architecture/api/<service-name>.md`](../api/<service-name>.md)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Service port (default: <port>) |
| `<database connection vars>` | Yes | Database connection — language-specific names, DB-backed services only (see population rules) |

See `services/<service-name>/.env.example` for the full list.

## Running Locally

```bash
./dev start <service-name>
```

## Testing

```bash
<unit test command for this language>
```
```

**Population rules:**

- Derive the port from `docker-compose.yml` or the architecture document after generation. Do not guess.
- List every inter-service dependency by name with the env var the calling service uses to reach it. If service A calls service B, service A's doc names service B and the env var (e.g. `AUTH_SERVICE_URL`).
- List every external dependency — databases, auth providers, message brokers. Derive from the generator flags and the architecture document.
- A stateless frontend owns no database. The `nextjs-app` generator scaffolds no datastore, so its service doc omits the PostgreSQL dependency row and every database environment variable. Only a service scaffolded with a database — a Go microservice, or a Python microservice with `--postgres` — names a database. Naming a database for a frontend describes infrastructure that does not exist.
- The database connection is exposed through language-specific environment variables, so populate the variables the generated service actually reads. A Go service reads a single `DATABASE_URL` connection string. A Python service reads discrete variables — `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — and composes the connection internally. The generated `.env.example` is the ground truth; do not assume `DATABASE_URL` for a service that reads discrete variables.
- Read the generated `.env.example` for each service to populate the environment variables table. If `.env.example` does not exist, list only variables derivable from the generator flags.
- Derive the unit test command from the language: `go test ./...` for Go, `uv run pytest` for Python, `pnpm test` for Next.js.
- Do not invent variables, routes, or descriptions. If a value cannot be derived from existing files or the architecture document, leave its cell blank rather than fabricating a placeholder.

**Drift frontmatter.** Open each `docs/architecture/services/<name>.md` and `docs/architecture/api/<name>.md` with YAML frontmatter so `groundwork-check` can detect drift automatically: `generation_mode: generated`, `source_of_truth:` (the canonical code paths for this service — its `services/<name>/` root and any contract files), and `last_reviewed:` (today's date). The `generated` mode routes `groundwork-check`'s recovery to re-running the generator; the brownfield extract phases use `extracted` instead. Both stamp the same three keys, so the check glob reads greenfield and brownfield docs identically.

## API Stub

Write `docs/architecture/api/<service-name>.md` for each service that exposes HTTP endpoints — Go microservices and Python microservices with `--rest`. Skip frontend apps and the system-test-runner.

```markdown
# <service-name> API

**Base URL:** `http://localhost:<port>`
**Auth:** <Bearer JWT | Service token (`X-Service-Token` header) | None>

## Health

### GET /health

**Response:** `200 OK`
```json
{"status": "ok"}
```

## Endpoints

<!-- Routes are defined in `services/<service-name>/`. Populate this section as endpoints are implemented. -->
```

**Population rules:**

- Derive auth from the generator flags: `--auth clerk` → Bearer JWT, `--auth service` → service token header, `--auth none` → no auth.
- **If the architecture document already specifies this service's contract — an explicit endpoint, an event stream, a request/response or SSE event schema (e.g. a streaming generation endpoint with named events) — transcribe that contract into the Endpoints section.** This is not inventing routes; it is carrying forward a commitment the architecture already made, so the system's key interface has a documented home from day one. Mark each as `status: planned`.
- Only when the architecture specifies *no* contract for the service, leave the Endpoints section as a placeholder comment for the team to populate as routes are built. Never fabricate routes the architecture did not commit.

Mark the Service Documentation phase complete in `scaffold-cache.md` and proceed to Phase 4.
