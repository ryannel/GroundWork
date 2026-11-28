# Groundwork UI — UX Navigation Map

Living record of Groundwork's surfaces, the questions each surface raises, expected 1-click transitions, return paths, and verification state. Maintained with `/dogfood-ui`.

## Workspace Landing (`/`)
- **Shows:** Registered workspaces (org and multi-project), project cards with system/component/repo counts, Plans quick-entry.
- **Questions → Destinations:**
  - "Open this workspace / project" → `/w/:ws` or `/w/:ws/p/:project`
  - "Jump straight to plans" → `/w/:ws/plans`
- **Verified:** Light & Dark, 2026-11-28.

## System Map (`/w/:ws[/p/:project]?select=:id`)
- **Shows:** Interactive ELK system/component/store/topic/external graph with pan/zoom, Expand/Collapse, Isolate 1-Hop, Hide Transitive, Full Screen, and accurate served-API / table / file counts.
- **Questions → Destinations:**
  - "Inspect a node in place" → Click node → `InspectorDrawer` (`?select=:id`)
  - "Go straight to the full page" → Double-click node → `/entity/:id`
  - "Jump to any entity, endpoint or SQL table" → `⌘K` Command Palette → direct deep-link (`?tab=api&endpoint=...` or `?table=...`)
- **Verified:** Light & Dark (WordLoop, Thrum, Acme Commerce), 2026-11-28.

## System Map — Inspector Drawer
- **Shows:** Summary, API surface group chips, table chips, Architecture Zones / `pub mod` exports, Explicit Gaps, deduplicated Depends On / Used By, plus `Contracts` / `Tables` / `Logic` tabs.
- **Questions → Destinations:**
  - "What endpoints exist across all domains?" → `Contracts` tab (`DrawerEndpointExplorer`: all resource groups, search, triaged toggle, inline schema peek)
  - "Show full spec for this exact route" → 1-click jump to `/entity/:id?tab=api&endpoint=:key`
  - "Show this table or the ER diagram" → 1-click jump to `/entity/:storeId?table=:name` or `?dbview=er`
  - "Take me back to the map" → Native Browser Back restores `/w/:ws?select=:id`
- **Verified:** Light & Dark, 2026-11-28.

## Full Service / App / Module View (`/entity/:compId?tab=overview|api|logic|data|code`)
- **Shows:** Breadcrumbs, `As-Is System` or `Plan Preview (Proposed / As-Is)` banner, Overview (stat strip, lifecycle, invariants & traps, clickable API Resource Groups, Architecture Zones, deduplicated dependencies), 3-pane API Reference (`?endpoint=`), Logic & Procedures, Data & Messages (with clickable table chips & ER Diagram CTA), and Codebase Guide.
- **Questions → Destinations:**
  - "Which endpoint triggers this handler?" → Click `on: endpoint:...` → `API & Contracts` focused on that endpoint
  - "What does this table look like?" → Click table chip → `/entity/:storeId?table=:name`
  - "Where is this in the repo?" → Click GitHub / zone path links → GitHub source at pinned commit
  - "Show this on the map" → `Show on System Map` → `/w/:ws?select=:compId`
- **Verified:** Light & Dark (WordLoop Core, Thrum Render, Orders API), 2026-11-28.

## Full Database View (`/entity/:storeId?table=:name&dbview=tables|er`)
- **Shows:** Writers/Readers, searchable table list, typed columns (`PK`, `NOT NULL`, clickable `FK → target(col)`), `Referenced By`, and 2D pan/zoom ER Diagram.
- **Questions → Destinations:**
  - "Follow a foreign key" → Click `FK → users(id)` → switches straight to `users` table (`?table=users`)
  - "See how all tables connect" → `ER Diagram` tab (`?dbview=er`)
- **Verified:** Light & Dark, 2026-11-28.

## Full Queue, System & External Views (`/entity/topic:*`, `system:*`, `external:*`)
- **Shows:** Queue (publishers, consumers, authored messages + deduplicated Scanned AsyncAPI Channels); System (Components, Databases & Stores, Message Queues & Streams, external callers); External (vendor docs, known API contracts).
- **Verified:** Light & Dark, 2026-11-28.

## Cross-System Flows (`/flows`) & Gaps Scorecard (`/gaps`)
- **Shows:** Flows (responsive step grid, keyboard `← →` stepper, `QuickPeekDrawer`, 1-click full page); Gaps (3-axis completeness scorecard, component accounting ledger, filterable gap queue with direct entity/endpoint links).
- **Verified:** Light & Dark, 2026-11-28.

## Plan Studio (`/plans/:slug?tab=overview|architecture|walkthrough|design|execution|proof`)
- **Shows:**
  - `Overview`: 4-pillar jump strip, problem/why, clickable Affected Entities, sign-offs, maturity gate, inline Review Notes form.
  - `1. Architecture`: `BEFORE | DIFF | AFTER` map toolbar + clickable Overlay Diff cards jumping straight to exact table/endpoint under `Plan Preview`.
  - `Walkthrough & Flows`: Architecture Flow + Sequence (Mermaid) + Full Screen + `QuickPeekDrawer` with 1-click deep-link and `Return to Plan` / Browser Back restoring exact step.
  - `2. Design`: Desktop/Mobile/X-Ray prototype iframe, Screen States, clickable X-Ray bindings.
  - `3. Execution` & `4. Proof`: Work Item DAG, cross-linked `Implements` ↔ `1. Architecture` and `Verified By` ↔ `4. Proof`.
- **Open Gaps:**
  - `2. Design` Screen States (`loading`, `error-409`) currently highlight the button but do not yet pass `&state=` to `/api/prototype` to render alternate prototype states.
- **Verified:** Light & Dark, 2026-11-28.
