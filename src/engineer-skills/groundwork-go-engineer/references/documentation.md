# Documentation

Go ships its documentation discipline in the toolchain: `go doc` and pkg.go.dev render doc comments, `gofmt` normalises them, `go vet` flags malformed ones. The language was designed so that well-named code needs little prose around it. Lean on that.

## Hierarchy

Structure documents more reliably than comments. A comment is a promise no compiler checks; when the code changes, the comment silently lies. Documentation priority — the foundations principle (`docs/principles/foundations/documentation.md`) written the Go way:

1. **Types and signatures** — the compiler rejects incorrect types. Zero drift risk.
2. **Naming** — self-documenting identifiers and small interfaces. Refactor before you comment.
3. **Error context** — `fmt.Errorf("doing X: %w", err)` strings document the failure path and are exercised by every call site.
4. **Test names** — `TestReserve_OutOfStock_ReturnsConflict` is executable documentation verified by CI.
5. **Doc comments on exported API** — rendered by godoc; written only when the signature cannot carry the contract.
6. **Inline "why" comments** — last resort for a genuinely non-obvious decision.

Levels 1–4 are verified by tooling. Levels 5–6 are human promises that drift. Minimise them.

## Doc Comments

A doc comment is the sentence directly above a declaration, and it begins with the name of the thing it documents — `go doc` and pkg.go.dev parse that convention, and `go vet`'s doc checks rely on it.

```go
// Reserve holds stock for an order until the reservation expires.
// It returns ErrOutOfStock when the requested quantity is unavailable.
func (s *Service) Reserve(ctx context.Context, orderID string, qty int) error
```

Document the **exported** surface — the package's contract with its callers. Unexported helpers are read with their implementation in view; a doc comment there is usually redundant with the code below it.

State the contract the signature cannot: the error conditions a caller must branch on, side effects invisible in the return type, the units or invariants of a parameter. Do not restate the signature in prose.

```go
// BAD — restates the signature
// GetOrder gets an order by id and returns it.
func GetOrder(ctx context.Context, id string) (*Order, error)

// GOOD — skip it; the name + types already say this
func GetOrder(ctx context.Context, id string) (*Order, error)
```

## Package Documentation

A package earns a doc comment when its name does not convey its purpose, its boundaries, or how its pieces fit. Put it in a dedicated `doc.go` so it survives file churn:

```go
// Package inventory tracks stock levels and reservations.
//
// A reservation is a hold with a TTL; a hold that expires returns its
// quantity to available stock. Callers reserve, then either commit or
// release — an abandoned hold is reclaimed by the sweeper, not the caller.
package inventory
```

The comment orients a reader before they open a single file. A package whose name and exported identifiers already explain it (`httpclient`, `postgres`) needs no `doc.go`.

## Names and Interfaces Are the Documentation

The cheapest documentation is a name that makes the comment unnecessary. Go's conventions push this hard, and the service standards bake them in (`references/go-services.md`): small interfaces defined by their consumer, concrete types returned, no stuttering (`inventory.Service`, not `inventory.InventoryService`).

A one-to-three-method interface documents a capability by its shape:

```go
// The name and the single method are the whole contract.
type ReservationStore interface {
    Save(ctx context.Context, r Reservation) error
}
```

A wide interface needs a comment to explain what it is *for* — which is the signal it is doing too much. Narrow it, and the comment disappears.

## Error Messages Are Documentation

A Go error string is read far more often than any doc comment — it surfaces in logs, traces, and incident timelines. Treat it as documentation of the failure path. Wrap with context that names the operation, so the chain reads as a trace:

```go
if err := store.Save(ctx, r); err != nil {
    return fmt.Errorf("reserving stock for order %s: %w", orderID, err)
}
```

Lowercase, no trailing punctuation, no "failed to" prefix — the convention that lets wraps compose cleanly (`reserving stock for order 7: writing row: connection refused`). Sentinel and structured errors document the branches a caller is expected to take; define them where that caller lives (`references/go-services.md`).

## Inline Comments

Inline comments explain **why**, never **what**. The code already says what it does; the comment captures the reason the next reader cannot recover from the code alone.

```go
// Sweep every 30s: shorter churns the DB, longer lets expired holds
// starve available stock past the SLA. Tuned against load test #214.
ticker := time.NewTicker(30 * time.Second)
```

A comment that narrates the mechanics is noise — the reader can see the loop.

```go
// BAD — narrates the obvious
// loop over the items and sum the quantities
for _, item := range items {
    total += item.Qty
}
```

## A Comment Is Often a Smell

When you reach for a comment to explain *what* a block does, the code is asking to be refactored. The comment is debt; the fix is in the code:

- A comment explaining a variable → rename the variable.
- A comment heading a block → extract a function whose name is that comment.
- A comment decoding a boolean argument (`Process(data, true) // skip cache`) → introduce a named type or option.
- A comment listing what a function does in three parts → the function does three things; split it.

Delete the comment and fix the name. The refactor cannot drift; the comment can.

## In-Code Markers

```go
// TODO(bob): batch these writes once the store supports it. Issue #231.
// FIXME(carol): retry storms under partition; needs a circuit breaker. Issue #245.
// HACK(dave): upstream returns 200 with an error body; inspect payload until fixed.
```

Always include `(username)` and an issue reference. A marker without one will never be resolved.

## What NOT to Document

- Self-evident exported functions where the name and types tell the whole story.
- Unexported helpers read in context with their callers.
- `Args`/`Returns`-style prose that duplicates the signature — Go has no such convention; the types are the parameter docs.
- Struct fields whose name and type are clear (`CreatedAt time.Time`); comment only a non-obvious unit or invariant.
- Generated code (protobuf, mocks) — never hand-edit comments into it.
