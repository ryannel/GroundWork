---
title: Go Services
description: Idiomatic Go, gateway patterns, error handling, concurrency, and the shape of a Go microservice.
status: active
last_reviewed: 2026-05-26
---
# Go Services

## TL;DR

Our Go code is boring on purpose. It leans into the standard library, uses interfaces only where they earn their keep, treats errors as values with context, and structures services with the gateway pattern — our Go-idiomatic expression of hexagonal architecture.

## Why this matters

Go rewards the engineer who resists cleverness. A Go codebase that reads like the standard library is one that new engineers — and AI agents — can contribute to the day they arrive. A Go codebase that imports a dozen frameworks and wraps every primitive in a "clean" abstraction is one where understanding costs precede any productive work. Keeping the core service legible is the highest-leverage investment we make.

## Our principles

### 1. Standard library first

`net/http`, `context`, `database/sql` — the standard library is the default, and we reach for a third-party package only when the standard library demonstrably cannot do the job. Frameworks that "wrap" the standard library to make it "easier" usually make it harder to reason about and harder for a new reader to follow.

### 2. Gateway pattern for services

Every service is structured as a gateway: a thin HTTP handler at the edge that extracts and validates inputs, an application service that orchestrates, domain types that hold rules, and repository interfaces (our "ports") with Postgres-backed implementations. This is hexagonal in Go idioms — flat package layout, exported interfaces, unexported concrete types.

### 3. Errors are values, and they carry context

We wrap errors with `fmt.Errorf("doing X: %w", err)` when adding context, and we inspect them with `errors.Is` and `errors.As` at the boundary. We *never* `panic` in service code; `panic` is reserved for truly unrecoverable conditions (a nil interface where the type system should have prevented it) and is recovered only at the HTTP boundary. Sentinel errors are defined where the caller must branch on them; structured error types are defined where the caller needs detail.

### 4. Context is threaded everywhere

Every function that does I/O takes a `context.Context` as its first parameter. Cancellation and deadlines are respected. A goroutine that outlives its parent context without explicit opt-in is a bug. `context.Background()` appears only at program entry points and in tests.

### 5. Concurrency is simple or explicit

`go` statements that fire-and-forget are banned; every goroutine is tracked by a `sync.WaitGroup`, an `errgroup.Group`, or a channel that signals completion. Leaked goroutines are how a service slowly eats its memory. Shared state is accessed through channels by default, through mutexes when a channel would be awkward, and never through silence.

### 6. Interfaces are defined by consumers

We define interfaces in the package that consumes them — the "accept interfaces, return structs" rule. A package that defines an interface for its own use is leaking its internals as a public contract. Small interfaces (one to three methods) compose well; wide interfaces are a smell.

### 7. Dependency injection is manual and explicit

We do not use runtime dependency-injection frameworks. Dependencies are passed into constructors, and the composition happens in a `cmd/` entry point. This is the "composition root" pattern, and in Go it is both trivial and powerful — every dependency is visible at build time, and cycles are impossible by construction.

### 8. Tests use the real thing where possible

Service tests spin up a real Postgres container via Testcontainers and exercise the handler through HTTP. We mock only the expensive external edges (model clients, third-party APIs). See [Testing](testing.md) for Go-specific patterns.

## Related docs

- [Concurrency](concurrency.md) — goroutine lifecycle, errgroup, and supervised concurrency.
- [Testing](testing.md) — Go honeycomb testing with Testcontainers and httptest.

## Anti-patterns we reject

- **Framework-flavoured Go.** Heavy router libraries, "web framework" abstractions, ORMs that rewrite your queries. The standard library is enough.
- **`interface{}` or `any` as a type.** Except at the boundary of reflection-based code, `any` is a signal you lost the type war. Name the type.
- **Package-level mutable state.** Config, loggers, metrics registries stored in package variables. Inject them, always.
- **Goroutines without supervision.** If you launch it, you own its lifetime. Track it.
- **`init()` functions that do work.** `init` is for registering, not for running. Work belongs in `main`.
- **Pointer-to-struct when a value would do.** Pointers imply "this may be nil or may be mutated." If neither is true, pass the value.

## Further reading

- *The Go Programming Language*, Donovan & Kernighan — the canonical text.
- *100 Go Mistakes and How to Avoid Them*, Teiva Harsanyi — a cadastre of the gotchas that bite real codebases.
- *Dave Cheney's blog* ([dave.cheney.net](https://dave.cheney.net)) — the single best source on Go idioms, errors, and testing.
- *The Go Memory Model* (golang.org/ref/mem) — read it at least once if you are writing concurrent code.
