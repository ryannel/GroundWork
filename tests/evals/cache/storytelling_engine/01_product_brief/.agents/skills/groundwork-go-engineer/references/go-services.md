# Go Service Standards

Go code is boring on purpose. It leans into the standard library, uses interfaces only where they earn their keep, treats errors as values with context, and structures services with the gateway pattern — Go-idiomatic hexagonal architecture.

## Principles

### 1. Standard Library First

`net/http`, `context`, `database/sql` — the standard library is the default. Reach for third-party packages only when the standard library demonstrably cannot do the job. Frameworks that "wrap" the standard library to make it "easier" usually make it harder to reason about.

### 2. Gateway Pattern

Every service is structured as a gateway: a thin HTTP handler at the edge that extracts and validates inputs, an application service that orchestrates, domain types that hold rules, and repository interfaces (ports) with Postgres-backed implementations. Flat package layout, exported interfaces, unexported concrete types.

### 3. Errors Are Values with Context

Wrap errors with `fmt.Errorf("doing X: %w", err)` when adding context. Inspect with `errors.Is` and `errors.As` at the boundary. Never `panic` in service code; `panic` is reserved for truly unrecoverable conditions and is recovered only at the HTTP boundary.

Sentinel errors are defined where the caller must branch on them. Structured error types are defined where the caller needs detail.

### 4. Context Is Threaded Everywhere

Every function that does I/O takes a `context.Context` as its first parameter. Cancellation and deadlines are respected. A goroutine that outlives its parent context without explicit opt-in is a bug. `context.Background()` appears only at program entry points and in tests.

### 5. Concurrency Is Simple or Explicit

`go` statements that fire-and-forget are banned. Every goroutine is tracked by a `sync.WaitGroup`, an `errgroup.Group`, or a channel that signals completion. Shared state is accessed through channels by default, through mutexes when a channel would be awkward, and never through silence.

### 6. Interfaces Are Defined by Consumers

Define interfaces in the package that consumes them — "accept interfaces, return structs." A package that defines an interface for its own use is leaking internals. Small interfaces (one to three methods) compose well; wide interfaces are a smell.

### 7. Dependency Injection Is Manual and Explicit

No runtime DI frameworks. Dependencies are passed into constructors. Composition happens in a `cmd/` entry point — the "composition root" pattern. Every dependency is visible at build time; cycles are impossible by construction.

### 8. Configuration Validation at Startup

Validate all environment variables immediately at startup using declarative struct tags (e.g., using `kelseyhightower/envconfig`). Do not scatter `os.Getenv` throughout the codebase. If configuration is missing or invalid, the service must crash immediately before accepting traffic.

```go
type Config struct {
    DatabaseURL string `envconfig:"DATABASE_URL" required:"true"`
    Port        int    `envconfig:"PORT" default:"8080"`
    Environment string `envconfig:"ENVIRONMENT" default:"production"`
}

func main() {
    var cfg Config
    if err := envconfig.Process("myapp", &cfg); err != nil {
        log.Fatalf("failed to load configuration: %v", err)
    }
    // ...
}
```

### 9. Tests Use the Real Thing Where Possible

Service tests spin up a real Postgres container via Testcontainers and exercise the handler through HTTP. Mock only the expensive external edges (model clients, third-party APIs).

## Anti-Patterns

- **Framework-flavoured Go.** Heavy router libraries, ORMs that rewrite queries.
- **`interface{}` or `any` as a type.** Except at reflection boundaries. Name the type.
- **Package-level mutable state.** Config, loggers, metrics registries in package variables. Inject them.
- **Goroutines without supervision.** If you launch it, you own its lifetime.
- **`init()` functions that do work.** `init` is for registering, not for running.
- **Pointer-to-struct when a value would do.** Pointers imply "this may be nil or may be mutated." If neither is true, pass the value.

## Canonical References

- *The Go Programming Language*, Donovan & Kernighan
- *100 Go Mistakes and How to Avoid Them*, Teiva Harsanyi
- *Dave Cheney's blog* (dave.cheney.net)
- *Effective Go* (go.dev/doc/effective_go)
- *Uber Go Style Guide* (github.com/uber-go/guide)
- *The Go Memory Model* (golang.org/ref/mem)
