# Capability Ports & Providers

GroundWork scaffolds external capabilities (LLM inference, and the same pattern for any future capability) as **hexagonal ports with selectable providers**. When you read or hand-write one of these, match the generated shape exactly — the generator and your code are the same contract.

## The model

- A **capability** is a port: a domain interface in `internal/core/gateway`.
- A **provider** is the adapter that satisfies it, in `internal/provider`. Choosing a provider is choosing an adapter; the port and its callers never change.
- Each provider declares a **footprint** — exactly one of `env`, `compose-service`, `runner`, `none` — which is the only thing that varies the operational cost. Infrastructure is a consequence of the provider, not a default.

| Footprint | Means | Materializes as |
|---|---|---|
| `env` | config only (a hosted API) | env vars in `.env`, no infra |
| `compose-service` | a container (a self-hosted server) | a service in `docker-compose.yml` |
| `runner` | a host process | an entry in `.dev/dev.config.json` runners |
| `none` | the raw gateway — a bet | port + stub + conformance test, nothing else |

## Generated shape (LLM reference family)

```
internal/core/gateway/llm_gateway.go      # the port — interface only, domain-owned
internal/provider/llm_gateway.go          # the adapter — one provider's implementation
internal/provider/llm_gateway_test.go     # the contract test
```

- **Port** — a plain interface, no SDK or HTTP type in its signature. A port with `*sql.DB` or an `*http.Client` in it is an adapter wearing a costume.
  ```go
  type LLMGateway interface {
      GenerateText(ctx context.Context, prompt string, maxTokens int) (string, error)
  }
  ```
- **Adapter** — implemented with `net/http` and stdlib, no vendor SDK (so `go.mod` is untouched and the adapter compiles standalone). Reads its config from `os.Getenv`, retries transient 5xx/429/connection failures, maps non-retryable status to a permanent error. The first line asserts conformance at compile time:
  ```go
  var _ gateway.LLMGateway = (*LLMGatewayAdapter)(nil)
  ```
- **Wiring** — construct `provider.NewLLMGatewayAdapter()` in `cmd/api/main.go` and pass it, typed as the `gateway.LLMGateway` port, into your service. Never let a service depend on the concrete adapter.

## The `none` raw gateway (a bet)

`--provider none` ships the port, a stub adapter that returns a not-implemented error, and a contract test that `Skip`s while the stub errors and flips to a live assertion once `GenerateText` works. Go has no xfail, so the skip *is* the open-bet marker: a green suite with a visible skip means "the contract is fixed, the implementation is owed." Implement the adapter behind the existing port to cash it — do not touch the port or the test's conformance line.

## Rules when you touch one of these

- Add a capability to an existing service with `nx g add-capability --service <svc> --capability llm --provider <p>` — it runs the same injector the scaffold does, idempotently.
- Swapping providers swaps only the adapter file and the footprint. If a change forces the port or a caller to change, the port was leaky — fix the port, not the callers.
- Surfaces and frontends do **not** embed an adapter; they call this service's port over its API (keys stay server-side, one owner per port).
- A hand-written adapter must pass the same `var _ gateway.X = (*Adapter)(nil)` conformance assertion and the contract test the generator emits.
