# Code Craft & Security

This service is a trust boundary. Everything outside it — clients, webhook payloads, queue events, upstream APIs — is hostile until validated. This file is the Go idiom of the framework security canon (`docs/principles/quality/security.md`); when this file and the canon disagree, the canon wins and this file is the one to fix.

## 1. Input is hostile; validate at the boundary

The handler framework validates request types by struct tag before the handler runs (`references/http-handlers.md`) — a request that fails validation never reaches a service. Security's addition: constrain at the type (`min`/`max`, `format:"email"`, enum-backed strings) so the constraint travels with the field, and do not re-validate between internal callers — the core trusts the domain types a service constructs from an already-validated request.

## 2. Parameterized queries — never string-built SQL

SQL injection is closed by construction: every value is a bound parameter, never interpolated into the query text.

```go
// sqlc/pgx — the value is bound, never formatted into the query
row, err := queries.GetOrderByCustomer(ctx, customerID)

// fmt.Sprintf-ing a value into a query string is the defect this rule exists to catch
```

The port/adapter shape and the persistence boundary live in `references/postgres.md`; security adds one rule on top — no user value reaches a query except as a bound parameter (`sqlc` generates bound queries by construction; a raw `pgx.Exec` string built with `fmt.Sprintf` is the anti-pattern), and table or column names are never taken from input.

## 3. Auth is boring technology, enforced at one boundary

Authentication establishes *who*; authorization decides *what they may do*. Extract the principal once, at the top of the handler (`references/http-handlers.md` → Authentication), from a token verified by a standard provider (OIDC) — never a hand-rolled JWT or session scheme. Pass the principal into service calls; never read auth state from a global.

- In a multi-tenant service, the tenant is bound to the authenticated principal and enforced at the data boundary — never trusted from a path or query parameter.
- The database role and any cloud identity the service runs as start minimal and widen only on evidence (least privilege).
- Zero trust between services: an internal call still carries an identity that is authorized per operation. "It is an internal service, skip auth" is the attacker's favourite foothold.

## 4. Secrets are managed, never in code

Configuration is validated once at startup with `envconfig` (`references/go-services.md` → Configuration Validation); secret *values* are injected from the platform's secret manager at runtime, never a struct default or a committed `.env`.

```go
type Secrets struct {
    DatabaseURL    string `envconfig:"DATABASE_URL" required:"true"`
    UpstreamAPIKey string `envconfig:"UPSTREAM_API_KEY" required:"true"`
}
// values come from the secret manager / injected env at runtime — never a literal default
```

The hierarchy is eliminate, then shorten, then rotate: prefer workload identity or OIDC federation (no static credential at all) over a minted secret, and reserve scheduled rotation for static credentials that genuinely cannot be made ephemeral.

## 5. Supply chain is part of the attack surface

`go.mod`/`go.sum` pin the full dependency graph; CI builds from the lockfile, never an unpinned `go get`.

- Run `govulncheck ./...` on every build — it call-graphs the vulnerability against actual usage, so it does not fire on a vulnerable function the binary never calls.
- A new dependency is a reviewed decision, not an intuition — check maintenance, ownership, and transitive weight before adding it.
- Generate an SBOM (`cyclonedx-gomod` or equivalent) and emit build provenance for anything published, so the artifact's origin is verifiable, not just its contents.

## 6. SSRF on outbound calls

A service that fetches a URL derived from input is an SSRF vector — an attacker aims it at internal metadata endpoints or private hosts.

```go
var allowedHosts = map[string]bool{"api.partner.example": true, "cdn.partner.example": true}

func assertAllowed(rawURL string) error {
    u, err := url.Parse(rawURL)
    if err != nil || !allowedHosts[u.Hostname()] {
        return fmt.Errorf("outbound host not allowed: %s", u.Hostname())
    }
    return nil
}
```

Validate the resolved host against an allowlist before the call; reject `file:` and non-HTTPS schemes. Set explicit connect/read timeouts and a deadline-bearing `context.Context` on every outbound `http.Client` so a hostile or slow upstream cannot exhaust the service (`references/reliability-performance.md`).

## 7. Error envelopes that do not leak internals

Handlers serialize to RFC 9457 `application/problem+json` (`references/http-handlers.md`); the wrap-vs-opaque discipline for internal error chains lives in `references/implementation-patterns.md`. Security's addition is what never crosses the client boundary: a stack trace, a SQL fragment, or an upstream provider's raw error text.

```go
if err != nil {
    logger.Error("order save failed", "trace_id", traceID, "err", err) // full detail — logs only
    return nil, huma.NewError(http.StatusUnprocessableEntity, "order could not be saved") // client sees this, nothing else
}
```

The trace id is how support traces the failure without the response exposing it.

## Code Craft Principles

Simpler over clever; no speculative abstraction until three real use cases justify one; dead code is a bug — delete it, including commented-out code and orphan functions; names are the interface, worth renaming aggressively; comments explain the *why* (invariants, ADR references), never restate the *what*; trust the boundary and do not re-validate between internal callers; error handling is a design decision — which errors a function returns, where the recoverable/fatal boundary sits — not decoration.

## Anti-Patterns

- **Reading the raw request body as a `map[string]any`.** Bypasses struct-tag validation; bind a typed request.
- **`fmt.Sprintf` into a query string.** Bind every value; `sqlc`/`pgx` named args, never interpolation.
- **Per-handler permission checks that drift.** Authorize through one principal-extraction path; model the policy once.
- **Secrets in `.env`, an image layer, or a struct default.** Inject from the secret manager at runtime.
- **Unpinned `go get` in CI.** Build from `go.sum`; run `govulncheck` and generate an SBOM on every build.
- **Fetching an input-supplied URL unchecked.** Allowlist the host; block internal addresses and non-HTTPS schemes.
- **Returning `err.Error()` to the client.** Log the full chain, return a code and a trace id.
- **"It is an internal service, skip auth."** Zero trust between services — internal is not a trust boundary.
- **Defensive programming without a threat model.** "Might need it later" scaffolding and speculative abstraction cost more than they save.
