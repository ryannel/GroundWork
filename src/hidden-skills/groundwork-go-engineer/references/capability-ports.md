# Capability Ports & Providers

GroundWork scaffolds external capabilities (LLM inference, and the same pattern for any future capability) as **an interface in the core plus a selectable provider that satisfies it**. When you read or hand-write one of these, match the generated shape exactly — the generator and your code are the same contract.

## The model

- A **capability** is an interface declared by the core that consumes it, in `internal/core/service` (package `service`) — domain-named (e.g. `TextGenerator`), no SDK type in its signature.
- A **provider** is the vendor that satisfies the capability; its implementation is the adapter, in a technology-named edge package (e.g. `internal/llm`). Choosing a provider selects the implementation wired in at the edge; the interface and its callers never change.
- Each provider declares a **footprint** — exactly one of `env`, `compose-service`, `runner`, `none` — which is the only thing that varies the operational cost. Infrastructure is a consequence of the provider, not a default.

| Footprint | Means | Materializes as |
|---|---|---|
| `env` | config only (a hosted API) | env vars in `.env`, no infra |
| `compose-service` | a container (a self-hosted server) | a service in `docker-compose.yml` |
| `runner` | a host process | an entry in `.dev/dev.config.json` runners |
| `none` | the bare interface — a bet | interface + stub + conformance test, nothing else |

## Generated shape (LLM reference family)

```
internal/core/service/llm.go      # the interface — declared where it is consumed, domain-owned
internal/llm/llm.go               # the adapter — one provider's implementation
internal/llm/llm_test.go          # the contract test
```

- **Interface** — a plain interface in `package service`, no SDK or HTTP type in its signature. An interface with `*sql.DB` or an `*http.Client` in it is an implementation wearing a costume.
  ```go
  // internal/core/service/llm.go
  package service

  type TextGenerator interface {
      GenerateText(ctx context.Context, prompt string, maxTokens int) (string, error)
  }
  ```
- **Adapter** — `package llm`, implemented with `net/http` and stdlib, no vendor SDK (so `go.mod` is untouched and the adapter compiles standalone). Reads its config from `os.Getenv`, retries transient 5xx/429/connection failures, maps non-retryable status to a permanent error. It imports `internal/core/service` and asserts conformance at compile time (edge → core, the inward direction):
  ```go
  var _ service.TextGenerator = (*Client)(nil)
  ```
- **Wiring** — construct `llm.NewClient()` in `cmd/api/main.go` and pass it, typed as the `service.TextGenerator` interface, into your service. Run `go mod tidy` if a provider added a dependency. Never let a service depend on the concrete `*llm.Client`.

## The `none` bare interface (a bet)

`--provider none` ships the interface, a stub adapter that returns a not-implemented error, and a contract test that `Skip`s while the stub errors and flips to a live assertion once `GenerateText` works. Go has no xfail, so the skip *is* the open-bet marker: a green suite with a visible skip means "the contract is fixed, the implementation is owed." Implement the adapter behind the existing interface to cash it — do not touch the interface or the test's conformance line.

## Rules when you touch one of these

- Add a capability to an existing service with `nx g add-capability --service <svc> --capability llm --provider <p>` — it runs the same injector the scaffold does, idempotently.
- Swapping providers swaps only the adapter file and the footprint. If a change forces the interface or a caller to change, the interface was leaky — fix the interface, not the callers.
- Surfaces and frontends do **not** embed an adapter; they call this service's interface over its API (keys stay server-side, one owner per capability).
- A hand-written adapter must pass the same `var _ service.X = (*T)(nil)` conformance assertion and the contract test the generator emits.
