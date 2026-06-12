---
name: scaffold-designer
description: Use this skill whenever the user wants to design, architect, or build a new Nx generator scaffold (like a new microservice template, test runner, or library generator). This skill enforces the strict GroundWork engineering principles and ensures all "Day 2" operational requirements are considered before writing code.
---

# Scaffold Designer

This skill governs the design of new scaffolding templates and generators in the GroundWork ecosystem. Its job is to make sure any new scaffold (a microservice, a library, a testing framework) meets the "Day 2" operational standards the existing generators set — the features below are what makes a generated service survivable in week two, not just bootable on day one.

> **These checklists are summaries, not canon.** Each item condenses policy whose source of truth is `docs/principles/` and the existing generators under `src/generators/`. When designing, verify an item against the current generator behavior before treating it as binding — and when a principle or generator changes, update the matching checklist item here in the same change. A checklist that drifts from the generators it describes is worse than none.

## Design Workflow

When a user asks to design a new service scaffold or generator, work through these phases in order — each one exists to stop a class of rework:

1. **Information Gathering**: Understand the core purpose of the new scaffold. What languages/frameworks does it use? Is it a backend service, a frontend app, or a testing utility?
2. **Feature Mapping**: Cross-reference the requirements with the relevant **GroundWork Day-2 Feature Checklist** below. Use the **Backend** checklist for Go/Python microservices and the **Frontend** checklist for Next.js apps. Apply both when the scaffold is a full-stack BFF (Backend For Frontend).
3. **Draft the Implementation Plan**: Create a detailed plan specifying how the generator will produce the template files, how it will manipulate existing workspace files (like `docker-compose.yml` or the per-project `project.json`), and how it satisfies the required features.
4. **User Review**: Always present the plan to the user for explicit approval before writing any generator code.

## GroundWork Day-2 Feature Checklist — Backend Services

Every new backend service scaffold **MUST** support or explicitly opt-out of the following features. Use this checklist to validate the design of the scaffold:

- [ ] **Clean Architecture Layers**: Does the scaffold explicitly separate the `domain` (entities, errors) and `service` (use-cases) layers to prevent business logic from leaking into entrypoints?
- [ ] **Explicit Dependency Injection (Composition Root)**: Does the entrypoint (`main.go`) contain an explicit composition root (e.g., a `buildApp` function) that explicitly constructs Providers, injects them into Services, and passes those Services to the Router?
- [ ] **Abstract Gateways**: Does the core domain rely exclusively on abstract ports (e.g., generic `Repository[T]`, `MessageQueue`, `OutboxRepository`), with concrete implementations explicitly asserting interface compliance?
- [ ] **Declarative Schema Management**: If a relational database is used, is there a declarative target state (e.g., `db/schema.sql`) and an automated tool (like `pg-schema-diff`) to apply schema changes without manual up/down migrations?
- [ ] **Outbound Resiliency**: Does the service wrap external calls with exponential backoff and circuit breakers?
- [ ] **Inbound Defenses & Middlewares**: Are endpoints protected by bounded concurrency (load shedding), global request timeouts, OpenTelemetry (RED) traces, robust CORS configurations, and sliding window rate limiting?
- [ ] **Idempotency**: Are mutating endpoints protected by an `Idempotency-Key` interceptor backed by persistent state (Redis/Postgres)?
- [ ] **API Standards & Docs**: Are collections uniformly returned using standardized, generic cursor-based pagination? Is the API spec (OpenAPI/AsyncAPI) generated automatically from the code structure?
- [ ] **Honeycomb-Style Integration Testing**: Does the template scaffold a true Honeycomb-style integration testing suite utilizing `testcontainers`? It MUST test the fully-wired composition root (`buildApp`), avoiding mocks, and verify actual database/infrastructure behavior to prove Day-1 correctness.
- [ ] **Dynamic Backplanes**: If websockets or async messaging are utilized, does the service dynamically fall back to appropriate local/cloud brokers (e.g., Redis vs Postgres LISTEN/NOTIFY)?
- [ ] **Graceful Shutdown**: Does the service trap SIGINT/SIGTERM, allowing in-flight requests to complete while severing long-lived connections (like websockets)?
- [ ] **Config Validation**: Is configuration robustly parsed and validated from environment variables at startup?
- [ ] **Centralized Error Handling**: Does the API router map domain-level errors to standard HTTP status codes uniformly?

## GroundWork Day-2 Feature Checklist — Frontend Apps (Next.js)

Every new frontend app scaffold **MUST** support or explicitly opt-out of the following features:

- [ ] **Enforced Server/Client Boundary**: Is every component a React Server Component by default, with `"use client"` applied only at the narrowest possible interactivity leaf? Are there no bare `fetch()` calls inside Client Components?
- [ ] **Strict Dependency Graph**: Does the scaffold enforce the inward-facing layer hierarchy — `app/` → `components/<domain>/` → `components/ui/` → `hooks/` → `lib/api/` → `lib/schemas/` — preventing upward or sideways imports?
- [ ] **Dynamic Composition Root (Provider Tree)**: Does the root layout (`app/layout.tsx`) dynamically `import()` the correct provider stack based on the runtime environment, so auth, analytics, and feature-flag providers can be swapped without touching layout code?
- [ ] **Isomorphic Data Gateway**: Is there a single `customFetch` / API client module that transparently calls the backend directly on the server and through the `/api/proxy` reverse proxy in the browser — so data hooks never need to know where they're running?
- [ ] **Type-Safe API Boundaries**: Are all external data shapes validated with Zod schemas? Are API types generated (via Orval or equivalent) rather than hand-written, so they stay in sync with the OpenAPI spec automatically?
- [ ] **OpenTelemetry Instrumentation**: Is there an `instrumentation.ts` bootstrapping the Node SDK with OTLP HTTP trace and metric exporters, auto-instrumentation, and SIGTERM graceful shutdown — so every server-side render and Route Handler is visible in Aspire/Cloud Trace?
- [ ] **Full Error Boundary Stack**: Does the scaffold include `error.tsx` (route-level), `global-error.tsx` (root layout, with inline `<html>` fallback), and `not-found.tsx`? Does `global-error.tsx` avoid importing from the design system (which may be broken when it fires)?
- [ ] **Server-Only Config Module**: Is runtime configuration (`API_URL`, service name, auth flags) centralised in a `lib/config.ts` marked `import "server-only"`, preventing secrets from leaking into the client bundle?
- [ ] **Component Testing Harness**: Does the scaffold include Vitest + React Testing Library configured with `jsdom`, auto-cleanup, and the `@testing-library/jest-dom` matchers — so component tests can be written immediately without extra setup?
- [ ] **Standalone Docker Build**: Does `next.config.mjs` set `output: 'standalone'` and does the `Dockerfile` use a multi-stage pnpm build with a non-root runner image — so the app can be deployed identically in Docker Compose and production?
- [ ] **Runtime Config Discovery**: For apps with WebSocket or dynamic backend URLs, is the backend URL resolved at runtime via an `/api/config` Route Handler rather than a `NEXT_PUBLIC_` build-time variable — so the same build artefact works across environments?
- [ ] **Health Check Endpoint**: Does the scaffold expose `GET /api/healthz` returning `{ status, timestamp }` for Docker health checks and load-balancer probes?
- [ ] **Port Allocation in 40xx Range**: Is the app assigned a deterministic port from the `40xx` range by scanning `docker-compose.yml`, ensuring no collisions and stable port identity across regeneration?

## Execution Guidelines

- Do not simply write scripts. Think about the resulting developer experience for the engineers who will run the Nx generator.
- Pay close attention to dynamic configuration. The scaffolds should generate code that discovers its environment (e.g., via environment variables) rather than hardcoding connections.
- Ensure the scaffolding generator modifies relevant central orchestration files (like `docker-compose.yml`) so the new service instantly integrates into local system test loops.
- **Generic defaults only**: never hardcode sandbox project names (e.g. a product name) as default values in generated `docker-compose.yml` environment blocks or template config files. Use the service's own name (`serviceNames.fileName` in TypeScript, `<%= fileName %>` in EJS templates) as the default where a project-specific value is needed (e.g., `DB_NAME`).
- **Engineer skill promotion**: if the scaffold has a matching engineer skill in `src/hidden-skills/`, call `promoteEngineerSkill(tree, '<skill-name>')` at the end of the generator. This copies the skill from the hidden folder into the user project's `.agents/skills/` so engineers have it immediately available after scaffolding.
- **Three-layer test coverage**: after adding or modifying a generator, update `tests/scaffolds/test_generation.py` with structural assertions for every new option combination. Run `./dev test generation` first to confirm they pass before writing compilation or e2e tests.
