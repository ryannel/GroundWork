---
title: Architecture
description: MVVM over UI/Data layers, repositories and services, the core-access seam, freezed immutability, and the Riverpod default.
status: active
last_reviewed: 2026-06-12
---
# Architecture

## TL;DR

We follow the official Flutter architecture guide: a UI layer of MVVM features over a data layer of repositories and services, with a Domain layer added only when it earns its place. The capability core is reached through a typed contract client that lives in the data layer as a service — nothing above the data layer knows the transport. State management is Riverpod 3.x; models are immutable via `freezed`.

## Why this matters

Flutter spent years without an official architecture, and the vacuum filled with cargo-culted "Clean Architecture" folder mazes and state-management package wars. The Flutter team now ships a first-party, opinionated guide (MVVM + repositories), and we adopt it wholesale because an agent writing against the documented official pattern produces code every Flutter engineer and every future agent recognises — the training-set fluency axis applied within a stack.

## The layers

### UI and Data are mandatory; Domain is earned

Two layers by default. The **UI layer** holds features; the **data layer** holds repositories and services. A **Domain layer** (use-cases) is added per-case only when logic merges multiple repositories, is genuinely complex, or is reused across view models — never preemptively, because empty pass-through use-cases are pure indirection tax.

### MVVM in the UI layer

Every feature is exactly one **View** paired with exactly one **ViewModel**:

- The **View** is widgets only — layout, animation, conditional rendering, simple routing. No business logic, no direct repository access.
- The **ViewModel** transforms repository data into UI state and exposes **commands** for user events. It is the only thing the View talks to.

Naming follows the official convention: `HomeView`/`HomeViewModel`, `UserRepository`, `AuthService`. Predictable names are how an agent finds the right file on the first try.

### Repositories and services in the data layer

**Repositories** are the source of truth: they own caching, retry, polling, and the transformation of raw payloads into domain models. **Services** are stateless wrappers over external interfaces — API clients, platform APIs, local storage — exposing `Future`/`Stream`. Repositories consume services; they are many-to-many with view models and never aware of each other. View models depend on **abstract repository classes**, so tests substitute fakes without mocking frameworks.

### The core-access seam

A GroundWork Flutter app is a surface adapter over a headless capability core (see [capability core and surfaces](../../capability-core-and-surfaces.md)). The seam is precise:

- A **typed client generated from the promoted contracts** (dio-based, via OpenAPI codegen — `openapi_generator`'s `dart-dio` path when sharing one HTTP stack) lives in the data layer **as a service**.
- **Repositories consume that client** and translate contract types into domain models.
- **Nothing above the data layer knows the transport.** A view model cannot tell whether the core is hosted or embedded, REST or gRPC — which is exactly what lets capability logic be proven once, headless, while the surface proves only wiring.

Hand-rolled JSON mapping against an existing contract spec is a defect: the contract is promoted precisely so clients are generated from it.

## Project organisation

`ui/` is organised **by feature** (one folder per feature holding its view and view model); `data/` is organised **by type** (repositories and services are shared infrastructure, not feature property). For large apps, split features into local packages using Dart pub workspaces (`resolution: workspace`), with Melos 7.x — now configured under the `melos:` key in the root pubspec — for scripts and versioning. Layer-first roots (`/screens`, `/widgets`, `/models`) are legacy for anything non-trivial.

## Immutability

Data and domain models are immutable, generated with `freezed`. Mutable models invite state changes that bypass the unidirectional flow; `freezed` gives value equality, `copyWith`, and exhaustive pattern matching for the price of a build_runner step we already pay for contract codegen.

## State management: the GroundWork default

**Riverpod 3.x** for new builds. The reasoning: it is the converging ecosystem default for new projects in 2026, it is compile-safe and testable without widget-tree gymnastics, and its provider graph doubles as the app's dependency-injection mechanism — one tool for state and DI. Riverpod 3.0 added Mutations (action lifecycle without codegen). Pin conservatively: the maintainer flags a possible near-term 4.0 and the offline-persistence API is explicitly experimental — do not build on experimental Riverpod APIs.

- **Bloc (flutter_bloc 9.x)** is the deliberate alternative for large, regulated, audit-trail-heavy teams — stable and slow-moving by design. Choosing it is a recorded decision, not a drift.
- **GetX** is an anti-recommendation, full stop.

DI stance: Riverpod providers are the composition mechanism — repositories and services are providers, view models read them. The official guide's `provider`-for-DI recommendation is what Riverpod subsumes; do not run both.

See [State management](state-management.md) for the patterns in depth.

## Anti-patterns we reject

- **Business logic in widgets.** A `build` method that branches on domain rules belongs in a view model.
- **Preemptive Domain layers.** Use-case classes that forward one repository call add a file and remove nothing.
- **Repositories aware of each other.** Cross-repository orchestration is a view model or use-case concern.
- **Hand-written API clients against a promoted contract.** Generate the client; the contract is the source of truth.
- **Surface-side business rules.** If a rule is proven at the core's contract, the surface re-implementing it is divergence waiting to happen.
- **Clean-Architecture folder cargo-culting.** entities/usecases/datasources scaffolding imported from blog folklore — the official two-layer guide replaced it.

## Further reading

- [Flutter architecture guide](https://docs.flutter.dev/app-architecture/guide) — the canonical source for this document.
- [Architecture recommendations](https://docs.flutter.dev/app-architecture/recommendations) — the cross-cutting recommendations table.
- The **Compass app** — the Flutter team's reference implementation of this architecture.
