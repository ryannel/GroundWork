# Implementation Patterns

Concrete Go patterns for trace-first logging, clean architecture, error handling, and dependency injection.

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

Context is King. Do not store context in structs. Pass it as the first parameter to every Domain, Service, and Provider function. Dropping the context severs the distributed trace.

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

### Wrapping & Mapping Errors in Providers

A Provider catching an infrastructure error wraps it into a Domain error before returning:

```go
func (r *PostgresStore) Get(ctx context.Context, id string) (*domain.Entity, error) {
	var entity domain.Entity
	err := r.db.QueryRowContext(ctx, "SELECT ...").Scan(...)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("provider execution failed: %w", domain.ErrNotFound)
		}
		// %v, not %w: unexpected driver errors stay opaque at the provider
		// boundary so callers cannot couple to infrastructure internals.
		return nil, fmt.Errorf("unexpected db error: %v", err)
	}
	return &entity, nil
}
```

## 3. Dependency Injection

### The Port (Defined by the Core)

The interface belongs in `internal/core/gateway/` and speaks Domain language:

```go
package gateway

import "myservice/internal/core/domain"

type EntityStore interface {
	Get(ctx context.Context, id string) (*domain.Entity, error)
}
```

### The Wiring (Composition Root)

Constructor injection assembles pieces at startup without globals:

```go
// 1. Initialize the concrete Provider
dbProvider := provider.NewPostgresStore(sqlDB)

// 2. Inject into the Service (which only knows the Gateway Interface)
entityService := service.NewEntityService(dbProvider)

// 3. Inject the Service into the inbound HTTP route
entrypoints.RegisterEntityRoutes(router, entityService)
```

## 4. Accept Interfaces, Return Structs

This idiom is the bedrock of Clean Architecture. Gateways (Ports) define the interfaces. Services accept those interfaces. Providers return concrete struct representations.

```go
// 1. The Gateway (Port) is an interface
type Store interface {
	Get(ctx context.Context, id string) (*domain.Entity, error)
}

// 2. The Service accepts the interface
func NewService(store Store) *Service {
	return &Service{store: store}
}

// 3. The Provider (Adapter) returns the concrete struct
type PostgresStore struct { /* ... */ }

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}
```

## 5. Goroutines and Context Loss

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

## 6. Immutability in the Domain

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
