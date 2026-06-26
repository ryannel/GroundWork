# Security

This service is a trust boundary. Everything outside it — clients, webhooks, queue events, upstream APIs, model output — is hostile until validated. This file is the Python idiom of the framework security canon (`docs/principles/quality/security.md`); when this file and the canon disagree, the canon wins and this file is the one to fix.

The controls below are enforced at the FastAPI entrypoint and the adapter edge, not scattered through the Domain. The boundary is validated once and explicitly; inside it, the core trusts its own types.

## 1. Input is hostile; validate at the boundary

Every inbound payload is a Pydantic model parsed at the route, not a `dict` read field-by-field. Pydantic v2 validation *is* the boundary check — a request that fails parsing never reaches a service.

```python
from pydantic import BaseModel, Field, EmailStr

class CreateOrderRequest(BaseModel):
    model_config = {"extra": "forbid"}  # reject unknown fields, never silently drop

    customer_email: EmailStr
    quantity: int = Field(gt=0, le=1000)
    note: str = Field(default="", max_length=2000)

@router.post("/orders")
async def create_order(body: CreateOrderRequest) -> OrderResponse:
    # body is validated; the service receives a typed domain request, not raw input
    ...
```

- `extra="forbid"` turns mass-assignment and typo'd fields into a `422`, not a silent accept.
- Constrain at the type (`gt`, `le`, `max_length`, `EmailStr`, `Literal`), so the constraint travels with the field and cannot be forgotten by a caller.
- Do not re-validate between internal callers — the core trusts its own dataclasses (`references/implementation-patterns.md` → Strict Typing). One boundary, scrutinised; no defensive re-checks inside.

## 2. Parameterised queries — never string-built SQL

SQL injection is closed by construction: the query text is constant and every value is a bound parameter. SQLAlchemy and the driver do the binding; an f-string carrying user input into SQL is a defect.

```python
from sqlalchemy import select, text

# ORM — values are bound, never interpolated
stmt = select(OrderRow).where(OrderRow.customer_id == customer_id)

# Raw SQL when unavoidable — named bind parameters, never an f-string
await session.execute(
    text("SELECT * FROM orders WHERE customer_id = :cid"),
    {"cid": customer_id},
)
```

The session lifecycle and the repository port live in `references/database.md`; security adds one rule on top — no user value reaches a query except as a bound parameter, and table/column names are never taken from input.

## 3. Authorization at the dependency boundary

Authentication establishes *who*; authorization decides *what they may do*. Both are FastAPI dependencies on the route, enforced through one path, not re-implemented per handler.

```python
from fastapi import Depends, HTTPException, status

async def require_order_access(
    order_id: str,
    principal: Principal = Depends(get_principal),  # from the verified token
) -> str:
    if not await policy.can_access_order(principal, order_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN)
    return order_id

@router.get("/orders/{order_id}")
async def get_order(order_id: str = Depends(require_order_access)) -> OrderResponse:
    ...
```

- The token is verified by a proven provider (OIDC); the service does not hand-roll JWT or session logic. Auth is boring technology — see `docs/principles/system-design/identity-and-access.md`.
- In a multi-tenant service the tenant is bound to the authenticated principal and enforced at the data boundary, never trusted from a path or query parameter.
- Least privilege: the database role and any cloud identity the service runs as start minimal and widen only on evidence.

## 4. Secrets are managed, never in code

No secret lives in source, in a committed `.env`, or baked into an image layer. Configuration is validated once at boot with `pydantic-settings` (`references/implementation-patterns.md` → Configuration Validation); secret *values* are injected from the platform's secret manager at runtime.

```python
from pydantic import Field
from pydantic_settings import BaseSettings

class Secrets(BaseSettings):
    # Sourced from the secret manager / injected env at runtime — never a default here
    database_url: str = Field(..., min_length=1)
    upstream_api_key: str = Field(..., min_length=16)

# .env.example carries names with empty values; real values never enter the repo
```

The hierarchy is eliminate, then shorten, then rotate: prefer workload identity or OIDC federation (no static credential at all), then short-lived minted secrets, and reserve scheduled rotation for static credentials that genuinely cannot be made ephemeral.

## 5. Supply chain is part of the attack surface

Every third-party package is a potential exploit vector. `uv` pins the full dependency graph in `uv.lock`; CI installs from the lockfile (`uv sync --frozen`), never an unpinned resolve.

- A new dependency is a reviewed decision, not an intuition — check maintenance, ownership, and transitive weight before adding it.
- Generate an SBOM and run a vulnerability scan (`uv pip audit` / `pip-audit` or equivalent) on every build; a known-vulnerable transitive dependency fails the build.
- Emit build provenance for anything published, so the artifact's origin is verifiable, not just its contents.

## 6. SSRF on outbound calls

A service that fetches a URL derived from input is an SSRF vector — an attacker aims it at internal metadata endpoints or private hosts. Outbound targets are allowlisted, not reflected from the request.

```python
from urllib.parse import urlparse

ALLOWED_HOSTS = {"api.partner.example", "cdn.partner.example"}

def assert_allowed(url: str) -> str:
    host = urlparse(url).hostname
    if host not in ALLOWED_HOSTS:
        raise PermanentInferenceError(f"outbound host not allowed: {host}")
    return url
```

- Validate the resolved host against an allowlist before the call; reject `file:`, `gopher:`, and non-HTTPS schemes.
- Set explicit connect/read timeouts on every outbound client so a hostile or slow upstream cannot exhaust the service (`references/resilience.md`).

## 7. Error envelopes that do not leak internals

A client receives a stable, structured error; stack traces, SQL fragments, and upstream provider messages stay in the logs. The Domain raises typed exceptions (`references/implementation-patterns.md` → Error Handling); one exception handler maps them to a safe envelope.

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    logger.exception("request failed", extra={"trace_id": current_trace_id()})
    # client sees a code and a correlation id — never exc internals
    return JSONResponse(
        status_code=422,
        content={"error": exc.code, "trace_id": current_trace_id()},
    )
```

The `422` unification and CORS rules live in `references/api-standards.md`; security's addition is that the body never carries an internal detail and the correlation id is how support traces it without exposing it.

## Anti-Patterns

- **Reading the raw request body as a `dict`.** Bypasses validation; parse a Pydantic model with `extra="forbid"`.
- **f-string SQL.** `f"WHERE id = {user_id}"` is injection. Bind every value.
- **Per-handler permission checks that drift.** Authorize through one dependency; model the policy once.
- **Secrets in `.env`, an image layer, or a default value.** Inject from the secret manager at runtime.
- **Unpinned installs in CI.** `uv sync --frozen` against `uv.lock`; scan and SBOM every build.
- **Fetching an input-supplied URL unchecked.** Allowlist the host; block internal addresses and non-HTTPS schemes.
- **Returning the exception string to the client.** Log the detail, return a code and a trace id.
- **"It is an internal service, skip auth."** Internal services are an attacker's favourite foothold — zero trust between services.
