# Capability Ports & Providers

GroundWork scaffolds external capabilities (LLM inference, and the same pattern for any future capability) as **hexagonal ports with selectable providers**. When you read or hand-write one of these, match the generated shape exactly — the generator and your code are the same contract.

## The model

- A **capability** is a port: a `Protocol` in `src/core/domain`.
- A **provider** is the adapter that satisfies it, in `src/provider`. Choosing a provider is choosing an adapter; the port and its callers never change.
- Each provider declares a **footprint** — exactly one of `env`, `compose-service`, `runner`, `none` — which is the only thing that varies the operational cost. Infrastructure is a consequence of the provider, not a default.

| Footprint | Means | Materializes as |
|---|---|---|
| `env` | config only (a hosted API) | env vars in `.env.example`, no infra |
| `compose-service` | a container (a self-hosted server) | a service in `docker-compose.yml` |
| `runner` | a host process | an entry in `.dev/dev.config.json` runners |
| `none` | the raw gateway — a bet | port + stub + conformance test, nothing else |

## Generated shape (LLM reference family)

```
src/core/domain/llm_port.py        # the port — a runtime_checkable Protocol, domain-owned
src/provider/llm_gateway.py        # the adapter — one provider's implementation
tests/contracts/test_llm_port.py   # the contract test
```

- **Port** — a `@runtime_checkable` `Protocol`, no SDK type in its signature. It lives in its own module (`llm_port.py`), not bundled into `protocols.py`, so `add-capability` can generate it independently.
  ```python
  @runtime_checkable
  class LLMGateway(Protocol):
      async def generate_text(self, prompt: str, max_tokens: int = 100) -> str: ...
  ```
- **Adapter** — implements the protocol structurally (no `class Adapter(LLMGateway)` inheritance needed). Reads config from `settings`, wraps calls in `tenacity` retry + a circuit breaker, raises the domain's `TransientInferenceError` / `PermanentInferenceError`. A hosted provider adds its SDK to `pyproject.toml`; a self-hosted one uses the OpenAI-compatible client.
- **Wiring** — provide `LLMGatewayAdapter()` from your composition root (e.g. `dependencies.py get_llm_gateway`) typed as the `LLMGateway` port. Never let a service depend on the concrete adapter.

## The `none` raw gateway (a bet)

`--provider none` ships the port, a stub adapter that raises `NotImplementedError`, and a **strict-xfail** contract test. The test is kept `@pytest.mark.xfail(strict=True)` so a fresh scaffold stays green *and* flips red the moment the adapter starts working — that is the open-bet marker: the contract is fixed, the implementation is owed. Implement the adapter behind the existing port to cash it, then drop the xfail. The conformance check is `issubclass(LLMGatewayAdapter, LLMGateway)` — no construction, no network.

## Rules when you touch one of these

- Add a capability to an existing service with `nx g add-capability --service <svc> --capability llm --provider <p>` — it runs the same injector the scaffold does, idempotently.
- Swapping providers swaps only the adapter file, its dependency, and the footprint. If a change forces the port or a caller to change, the port was leaky — fix the port, not the callers.
- Surfaces and frontends do **not** embed an adapter; they call this service's port over its API (keys stay server-side, one owner per port).
- A hand-written adapter must pass the same `issubclass(...)` conformance test the generator emits.
