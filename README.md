# Groundwork (v3)

**Groundwork** is a local-first, agent-driven architecture modeling and 4-pillar planning framework. Map existing systems with provable completeness, explore contracts, data schemas, and module boundaries visually, and collaborate with AI agents on structured architectural plans before writing code.

## Quick Start

```bash
npm install
npm run serve
```

Then open **http://localhost:3456** (plain `http://`).

For hot-reloading UI development alongside the local API server:

```bash
npm run dev
```

## Monorepo Layout

- `packages/schema` — Canonical TypeScript types and Draft 2020-12 JSON Schemas + Ajv validators (`schema_version: 1`) for Spaces, Systems, Components, Contracts, Handlers, Stores, Topics, Evidence, Orientation, and 4-Pillar Plans.
- `packages/scanner` — Two-stage repository scanner: pins Git commits & `.gitmodules` submodules, detects Go / Python / TypeScript / Rust Cargo package roots, extracts declarative surfaces (OpenAPI 3.x with parameters/schemas/responses, AsyncAPI, SQL DDL with column types & foreign keys, Cargo crate deps), heuristic surfaces (Go Chi/Huma, FastAPI, TS/React, Rust `pub mod`), cross-checks spec vs. code, and generates per-fact citation anchors & structure evidence.
- `packages/core` — Incremental file-cached space loader, derived `SpaceIndex`, 3-axis completeness engine (Accounted Coverage, Freshness, Modeling Depth), orientation synthesis, copy-on-write plan overlay engine (`insert_step`, `wrap_step`, `.base-lock.json` 3-tier drift), 6 cross-pillar maturity gates, and atomic ID rename (`moveId`).
- `packages/cli` — `groundwork` CLI (`workspace`, `scan`, `map`, `plan`, `id`, `serve`) and local HTTP/SSE API server serving the UI, `/api/workspaces`, `/api/space`, `/api/code-tree`, sandboxed no-network `/api/prototype` with Architecture X-Ray, and `/api/reviews`.
- `packages/ui` — React 19 + Vite 6 + TypeScript web application featuring:
  - **Workspace Library** supporting both enterprise orgs and multi-project workspaces
  - **Interactive System Map** (`elkjs` orthogonal layout, shared trackpad/mouse/touch pan & pinch-zoom, Full Screen, 1-hop isolation)
  - **4-Pillar Plan Studio** (`Overview`, `1. Architecture` diff, walkable **Architecture Flow** & **Mermaid Sequence** walkthrough with keyboard navigation & in-place Quick Peek, `2. Design` sandboxed prototypes with X-Ray, `3. Execution` dependency DAG, and `4. Proof` Given/When/Then matrix)
  - **Full Service / Module / Database / Queue Views** with real URL routing (`History API`), Plan Preview (`Proposed` vs. `As-Is`) toggle, 3-pane API Reference (headers, schemas, status responses, cURL & JSON examples), and Database Schema Tables + Interactive ER Diagram
  - **Light / Dark / System** theme switcher
- `examples/` — Bundled validated workspaces (`acme-org` enterprise org with a full 4-pillar plan, plus `personal` multi-project workspace).
- `docs/architecture.md` — Complete v3 architecture specification.

## Useful Commands

```bash
# Typecheck and run all unit & performance tests
npm run typecheck
npm test

# Scan a repository into evidence artifacts
npm run groundwork -- scan /path/to/repo --out <space>/evidence/<repo-name>

# Inspect workspaces, completeness, and plans
npm run groundwork -- workspace list
npm run groundwork -- map completeness examples/acme-org
npm run groundwork -- plan check examples/acme-org/plans/stock-reservation --gate ready
```
