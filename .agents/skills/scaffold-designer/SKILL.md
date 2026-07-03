---
name: scaffold-designer
description: Use this skill whenever the user wants to design, architect, or build a new Nx generator scaffold (like a new microservice template, test runner, or library generator). This skill enforces the strict GroundWork engineering principles and ensures all "Day 2" operational requirements are considered before writing code.
---

# Scaffold Designer

This skill governs the design of new scaffolding templates and generators in the GroundWork ecosystem. Its job is to make sure any new scaffold meets the "Day 2" operational standards the existing generators set — the features below are what makes a generated service survivable in week two, not just bootable on day one.

> **These checklists are summaries, not canon.** Source of truth is `src/docs/principles/` and the generators under `src/generators/` — verify an item against current generator behavior before treating it as binding, and update the matching item here when a principle or generator changes. A checklist that drifts from the generators it describes is worse than none.
>
> **The stack-agnostic canon is [The Day-2 Operational Baseline](../../../src/docs/principles/delivery/day-2-operational-baseline.md).** It defines what *good* means independent of language or framework, plus the two rules every scaffold upholds: **no empty capabilities** and **off-script still lands well**. The Backend and Frontend lists below are that baseline elaborated into a specific stack's idiom. When a new stack has no generator, the forge skill (`groundwork-stack-forge`) holds it to the baseline directly; design any new generator to clear the baseline first and the stack-specific list second.

## Design Workflow

When a user asks to design a new service scaffold or generator, work through these phases in order — each one exists to stop a class of rework:

1. **Information Gathering**: Understand the core purpose of the new scaffold. What languages/frameworks does it use? Is it a backend service, a frontend app, or a testing utility?
2. **Feature Mapping**: Cross-reference the requirements with the relevant **GroundWork Day-2 Feature Checklist** below. Use the **Backend** checklist for Go/Python/Node microservices, the **Frontend** checklist for Next.js apps, the **Mobile** checklist for Flutter apps, and the **Desktop** checklist for Electron apps. Apply Backend + Frontend when the scaffold is a full-stack BFF (Backend For Frontend).
3. **Draft the Implementation Plan**: Create a detailed plan specifying how the generator will produce the template files, how it will manipulate existing workspace files, and how it satisfies the required features.
4. **User Review**: Always present the plan to the user for explicit approval before writing any generator code.

## GroundWork Day-2 Feature Checklist — Backend Services

Every new backend service scaffold **MUST** support or explicitly opt-out of the following features. Use this checklist to validate the design of the scaffold:

- [ ] **Clean Architecture Layers**: Does the scaffold separate `domain` and `service` layers so business logic can't leak into entrypoints?
- [ ] **Explicit Dependency Injection (Composition Root)**: Does the entrypoint expose an explicit composition root wiring Providers → Services → Router?
- [ ] **Abstract Gateways**: Does the core domain depend only on abstract ports, with concrete implementations asserting interface compliance?
- [ ] **Declarative Schema Management**: If relational, is there a declarative target schema applied automatically instead of manual migrations?
- [ ] **Outbound Resiliency**: Does the service wrap external calls with exponential backoff and circuit breakers?
- [ ] **Inbound Defenses & Middlewares**: Are endpoints protected by load shedding, global timeouts, OTel RED traces, CORS, and rate limiting?
- [ ] **Idempotency**: Are mutating endpoints protected by an idempotency-key interceptor backed by persistent state?
- [ ] **API Standards & Docs**: Are collections returned with standardized cursor-based pagination, and is the API spec generated automatically?
- [ ] **Honeycomb-Style Integration Testing**: Does the template scaffold a Honeycomb-style integration suite that tests the fully-wired composition root without mocks?
- [ ] **Dynamic Backplanes**: Do websockets or async messaging fall back between local and cloud brokers dynamically?
- [ ] **Graceful Shutdown**: Does the service trap SIGINT/SIGTERM, letting in-flight requests finish while severing long-lived connections?
- [ ] **Config Validation**: Is configuration robustly parsed and validated from environment variables at startup?
- [ ] **Centralized Error Handling**: Does the API router map domain-level errors to standard HTTP status codes uniformly?

## GroundWork Day-2 Feature Checklist — Frontend Apps (Next.js)

Every new frontend app scaffold **MUST** support or explicitly opt-out of the following features:

- [ ] **Enforced Server/Client Boundary**: Is every component a Server Component by default, with `"use client"` only at the narrowest leaf, and no bare `fetch()` calls?
- [ ] **Strict Dependency Graph**: Does the scaffold enforce a one-directional import hierarchy, preventing upward or sideways imports?
- [ ] **Dynamic Composition Root (Provider Tree)**: Does the root layout dynamically resolve the provider stack per environment, without editing layout code?
- [ ] **Isomorphic Data Gateway**: Is there a single API client module that transparently handles server vs. browser calls?
- [ ] **Type-Safe API Boundaries**: Are external data shapes validated with Zod, and are API types generated rather than hand-written?
- [ ] **OpenTelemetry Instrumentation**: Is there an instrumentation bootstrap for OTel trace/metric export and graceful shutdown?
- [ ] **Full Error Boundary Stack**: Does the scaffold include route-level, root (avoiding design-system imports), and not-found error boundaries?
- [ ] **Server-Only Config Module**: Is configuration centralized in a server-only module, preventing secret leakage into the client bundle?
- [ ] **Component Testing Harness**: Does the scaffold include a pre-configured component testing harness so tests can be written without extra setup?
- [ ] **Standalone Docker Build**: Is the build a standalone, multi-stage, non-root Docker image that deploys identically in Compose and production?
- [ ] **Runtime Config Discovery**: Is the backend URL resolved at runtime rather than baked in at build time, so one artifact works across environments?
- [ ] **Health Check Endpoint**: Does the scaffold expose a health check endpoint for Docker and load-balancer probes?
- [ ] **Port Allocation in 40xx Range**: Is the app assigned a deterministic port in the `40xx` range, scanned from `docker-compose.yml` to avoid collisions?

## GroundWork Day-2 Feature Checklist — Mobile Apps (Flutter)

Every new mobile app scaffold **MUST** support or explicitly opt-out of the following features (source: `src/engineer-skills/groundwork-flutter-engineer/` and the `flutter-app` generator):

- [ ] **MVVM Over Two Layers**: Is every feature one View (widgets only) paired with one ViewModel, over a repository data layer — with no Domain layer scaffolded preemptively?
- [ ] **Provider Graph as Composition Root**: Does Riverpod carry shared state and DI — construction order, disposal, and test substitution falling out of the graph — with no service locator or second DI package?
- [ ] **Token-Projected Theming**: Is `ThemeData` built from a palette module generated from the design system's brand tokens, so a `Color(0xFF...)` literal in a widget file is a lint/review finding?
- [ ] **Typed Contract Client**: Does the data layer reach the capability core through a typed client with error mapping to domain types — never hand-mapping a large promoted contract?
- [ ] **Typed Navigation with Validated Deep Links**: Are routes go_router typed routes, and is every deep link / external intent treated as untrusted input with validation at entry?
- [ ] **Test Taxonomy with Skip-With-Reason**: Widget tests as the bulk tier, `integration_test` happy paths on a headless emulator, Patrol only at the Flutter/OS boundary — and every tier reports skipped-with-reason when the SDK or emulator is absent, never silently green?
- [ ] **Pigeon for Native Capability**: Do native hatches go through Pigeon's typed boundary wrapped as a data-layer service — no raw `MethodChannel` for a real API surface?
- [ ] **Surfaces Fixture Registration**: Is the app registered in the `surfaces` test fixture (via `system-test-runner --surfaces`) with its medium and reach, plus a liveness signal the fixtures can probe?
- [ ] **Accessibility Semantics by Default**: Do scaffolded widgets carry semantic labels, tap-target sizing, and dynamic-type tolerance from the start?
- [ ] **Crash Reporting & Client Traces**: Are crash/error reporting and client performance-trace hooks wired with PII discipline, reporting into the same observability story as the backend?
- [ ] **Release Pipeline Hygiene**: Signing material never enters the repo; versioning, store distribution, and forced-upgrade posture are pipeline concerns the scaffold documents?

## GroundWork Day-2 Feature Checklist — Desktop Apps (Electron)

Every new desktop app scaffold **MUST** support or explicitly opt-out of the following features (source: `src/engineer-skills/groundwork-electron-engineer/` and the `electron-app` generator):

- [ ] **Hardened Process Model**: Every window carries the quartet — `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` — with denied-by-default permissions, restricted navigation, and an allowlisted `openExternal`?
- [ ] **Typed IPC Contract**: One shared channel-map type consumed by both sides, `invoke`/`handle` for two-way, sender validation in every handler, and zod validation for non-trivial payloads?
- [ ] **Narrow Preload Bridge**: Does the preload expose only purpose-named methods — no `ipcRenderer`, no Electron modules, no generic invoke passthrough on `window`?
- [ ] **Enforced Process Boundaries**: Per-process tsconfigs plus a lint boundary keeping Node built-ins and Electron imports out of `src/renderer/` and `src/shared/` (types only in shared)?
- [ ] **utilityProcess for Heavy Work**: CPU-heavy or crash-prone work runs in a `utilityProcess` with MessagePorts — never in main, which must never block?
- [ ] **Fuses Flipped in Packaging**: Does the Forge pipeline flip the fuses (ASAR integrity on, `RunAsNode` off, `NODE_OPTIONS` off) so an unfused binary cannot reach a release channel — with `nodeCliInspect` deliberately on to keep the smoke loop alive?
- [ ] **Strict CSP over Custom Protocol**: App content served over the custom protocol with a strict CSP — no `file://` serving, no CSP wildcards, renderer network access routed through main over IPC?
- [ ] **Playwright `_electron` Boot Smoke**: Does the scaffold ship the boot smoke driving the real built app (headless under xvfb in CI), with skip-with-reason guards where the display or binary is absent?
- [ ] **Token-Projected Theming with nativeTheme Sync**: Brand tokens projected into the generated CSS, with dark mode synced through `nativeTheme`?
- [ ] **Auto-Update Route Decided**: One of the two sanctioned update routes chosen and recorded (`update-electron-app` for open-source GitHub releases; `electron-updater` otherwise) — never a hand-rolled endpoint?
- [ ] **Two-Process Crash Reporting**: Crash/error reporting wired in both main and renderer, structured logs crossing IPC with trace context, PII discipline applied?
- [ ] **Signing & Notarization from CI**: Signing material never enters the repo; unsigned builds are explicitly dev artifacts?

## Execution Guidelines

- Do not simply write scripts. Think about the resulting developer experience for the engineers who will run the Nx generator.
- Generate code that discovers its environment (e.g., via environment variables) rather than hardcoding connections.
- Ensure the scaffolding generator modifies relevant central orchestration files (like `docker-compose.yml`) so the new service instantly integrates into local system test loops.
- **Generic defaults only**: never hardcode sandbox project names as default values in generated `docker-compose.yml` environment blocks or template config files. Use the service's own name as the default where a project-specific value is needed (e.g., `DB_NAME`).
- **Engineer skill promotion**: if the scaffold has a matching engineer skill in `src/engineer-skills/`, call `promoteEngineerSkill(tree, '<skill-name>')` (defined in `src/generators/shared/scaffold-helpers.ts`) at the end of the generator.
- **Test coverage**: after adding or modifying a generator, update `tests/scaffolds/test_generation.py` with structural assertions for every new option combination, then work up through the harness's other layers in cheapest-first order — see the contributor guide's testing reference for the full layer table and commands.
- **Register the generator**: add its entry to `generators.json` — an unregistered generator is invisible to `nx g` and to this skill's own catalog answer.
- **Annotate the changelog**: a new generator is a shipped-surface change; add a CHANGELOG entry tagged `[no-migration]` or with a migration id, or the contracts gate will fail the PR.
