# API Design

## Core Principles

### 1. Contract-First, Code-Generated

Specs live in `/specs` and are the source of truth. Server handlers, typed clients, and reference docs are generated from them. Write the spec before the handler. Hand-rolled clients drift; generated clients cannot.

### 2. Explicit Versioning, Additive Evolution

Breaking changes require a new major version and a documented deprecation window. Within a major version, evolve additively: new optional fields, new endpoints, new response codes. Existing clients must never break from schema extension.

### 3. Resources, Not RPCs

HTTP endpoints model resources (`POST /entities`, `GET /entities/{id}`), not verbs (`POST /createEntity`). The resource shape forces identity, lifecycle, and composition reasoning up front. When a verb is unavoidable, name it carefully and document why a resource shape does not fit.

### 4. Idempotency by Design

Every write endpoint accepts an `Idempotency-Key` header. The server stores the key long enough to detect replays; the client is not responsible for being careful.

### 5. Pagination and Filtering Are Uniform

Every collection endpoint paginates with the same cursor shape, filters with the same query-string grammar, and returns the same `next`/`prev` link structure. Inconsistent pagination is a design smell.

### 6. Errors Are Structured and Machine-Readable

Every error response carries a stable code, a human message, and a `details` object. Clients branch on the code, not on the prose. Error codes are catalogued and never renumbered.

### 7. AI-Agent Readability Is a First-Class Concern

OpenAPI specs include rich descriptions on every field, enumerations for every finite domain, and explicit examples on every endpoint. An agent reading the spec should be able to use the API correctly without reading the handler.

### 8. Async Events Are Contracts Too

WebSocket and Pub/Sub events receive the same rigour as HTTP — AsyncAPI spec, generated client and server models, additive evolution.

## Error Envelope (RFC 9457)

All error responses follow this shape:

```json
{
  "status": 404,
  "title": "Not Found",
  "detail": "No entity with the provided id exists.",
  "instance": "/entities/abc123"
}
```

Validation errors include a field-level `errors` array:

```json
{
  "status": 400,
  "title": "Unprocessable Entity",
  "detail": "Request body did not match the schema.",
  "errors": [
    { "message": "required", "path": "body.title", "value": "" }
  ]
}
```

## Common HTTP Status Codes

| Status | Title | Meaning | Action |
|---|---|---|---|
| 401 | Unauthorized | Missing or invalid auth token | Re-authenticate |
| 403 | Forbidden | Authenticated but not authorised | Confirm role. Do not retry |
| 404 | Not Found | Resource does not exist | Verify identifier |
| 400 | Unprocessable Entity | Request body did not match schema | Inspect `errors` array |
| 409 | Conflict | Idempotency-Key reused with different payload | Generate a fresh key |
| 429 | Too Many Requests | Rate limit exceeded | Back off per `Retry-After` |
| 504 | Gateway Timeout | Downstream dependency timed out | Retry with backoff |
| 500 | Internal Server Error | Unexpected server error | Retry with backoff; escalate if sustained |

## Anti-Patterns

- **Breaking changes without a version bump.** The assumption "no one uses that field" is always wrong.
- **Hand-written clients.** Clients drift. Generate.
- **Kitchen-sink endpoints.** Split large payloads into focused endpoints.
- **Error payloads as strings.** Structured errors, always.
- **Endpoint-scoped pagination conventions.** Pick one and apply universally.
