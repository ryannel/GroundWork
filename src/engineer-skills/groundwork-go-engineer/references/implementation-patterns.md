# Implementation Patterns

Concrete Go patterns for trace-first logging, a pure core with swappable edges, error handling, and dependency injection.

## 1. Trace-First Development

Every inbound request starts a trace. Every outbound request cascades it.

### Initializing a Span

```go
import "go.opentelemetry.io/otel/trace"

func (s *OrderService) Process(ctx context.Context, orderID string) error {
	ctx, span := s.tracer.Start(ctx, "OrderService.Process")
	defer span.End()

	span.SetAttributes(attribute.String("order.id", orderID))
	// ... logic
}
```

### Passing Context

Context is King. Do not store context in structs. Pass it as the first parameter to every domain, service, and edge-implementation function. Dropping the context severs the distributed trace.

## 2. Error Handling

Use Go's `errors.Is` with sentinel errors to prevent database or HTTP leakage into domain logic.

### Defining Sentinels

Define business rule errors in `internal/core/domain/errors.go`:

```go
package domain

import "errors"

var ErrNotFound    = errors.New("not found")
var ErrUnauthorized = errors.New("unauthorized access")
```

### Wrapping & Mapping Errors at the Edge

An edge implementation catching an infrastructure error wraps it into a Domain error before returning:

```go
// internal/postgres
func (r *Repository) Get(ctx context.Context, id string) (*domain.Entity, error) {
	var entity domain.Entity
	err := r.db.QueryRowContext(ctx, "SELECT ...").Scan(...)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("lookup failed: %w", domain.ErrNotFound)
		}
		// %v, not %w: unexpected driver errors stay opaque at the storage
		// boundary so callers cannot couple to infrastructure internals.
		return nil, fmt.Errorf("unexpected db error: %v", err)
	}
	return &entity, nil
}
```

## 3. Dependency Injection — Accept Interfaces, Return Structs

This idiom is how the inward-dependency rule is written in Go: the interface lives in `internal/core/service` (package `service`), declared at the point of use in Domain language; the core service accepts that interface; the edge implementation returns a concrete struct that satisfies it. The layout this sits inside — zones, edge packages, the `depguard` gate — is `references/architecture.md`.

```go
// 1. The interface lives in the core, with the code that calls it
package service

type Store interface {
	Get(ctx context.Context, id string) (*domain.Entity, error)
}

func NewService(store Store) *Service {  // 2. the Service accepts the interface
	return &Service{store: store}
}

// 3. The edge implementation returns the concrete struct
package postgres

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}
```

Composition happens once, at startup, in `cmd/` — no runtime DI framework, no globals:

```go
store := postgres.NewRepository(sqlDB)               // 1. concrete edge implementation
entityService := service.NewEntityService(store)     // 2. injected as the interface
entrypoints.RegisterEntityRoutes(router, entityService) // 3. wired into the HTTP edge
```

## 4. Goroutines and Context Loss

When spawning background tasks, use `context.WithoutCancel` (Go 1.21+) or extract/inject the trace so the background span remains a child of the request trace — even if the HTTP client disconnects early.

```go
func (s *Service) ProcessAsync(ctx context.Context) {
	bgCtx := context.WithoutCancel(ctx)

	go func() {
		_, span := s.tracer.Start(bgCtx, "ProcessAsync.Background")
		defer span.End()
		// Execute asynchronous domain work...
	}()
}
```

## 5. Immutability in the Domain

When creating methods on Domain entities that calculate or evaluate state rather than modifying it, enforce immutability by exclusively using value receivers:

```go
package domain

type Order struct {
	DurationSeconds int
	Status          string
}

// CalculateCost uses a value receiver — cannot mutate the Order.
func (o Order) CalculateCost(rate float64) float64 {
	return float64(o.DurationSeconds) * rate
}
```
