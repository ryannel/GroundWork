# Groundwork model rebuild: work plan (revision 2)

Target: `design.md` (revision 3). Code: `/Users/RNEL/Workspace/groundWork`. Data: `/Users/RNEL/Workspace/volvo-groundwork`
(real) and `workspaces/personal` plus `test/fixtures/acme` (small). Revision 1 is `rebuild.v1.md`.

## Outcomes

1. Every fact has one home and one explicit, immutable id.
2. Every page, route, tool, plan and the browser read one `WorkspaceModel` through `readModel` and `indexOf`.
3. Every summary connection rests on cited detail; every current-fact step with an effect cites code or evidence; plan projections retain explicit implementation-evidence gaps.
4. An entry flow view (endpoint, subscription, job, UI interaction) replaces the method-level explorer.
5. Dead caches and legacy files are gone; what remains is normalised; no information a view shows is lost.

## Guardrails

- Read `AGENTS.md` and `docs/architecture.md` first; lint enforces the architecture. Never disable a rule.
- Next.js here differs from common knowledge: read `node_modules/next/dist/docs/` before route work.
- `npm run check:begin` at the start of each PR; `npm run check:quick` while working; `npm run check` and
  `npm run build` before handing back; `npm run budget` after rendering or data-loading changes.
- **One PR per layer, one worktree session per PR.** Groundwork code and Volvo data are separate PRs. Each PR
  leaves `main` working and commits its handoff artefacts under `artifacts/rebuild/`. No PR depends on
  uncommitted output from another session. Do not push or merge without the user.
- Never edit `volvo-groundwork` except in its own PR, produced by a pinned version of the migration tool.
- Never delete data, caches, producers or files until the replacement is proven (PR 9).
- Never invent a fact. Gaps stay gaps and are reported.
- Never put an LLM call inside a deterministic tool. LLM work produces a review file; tools apply accepted rows.
- Plain British English; levels are workspace, domain, system, component.

### Shared commands (built in PR 1, used by every later PR)

| Command                                                      | Does                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run rebuild:inventory`                                  | Writes `artifacts/rebuild/consumers.md`: every importer of old model types and loaders, every route, package script, tool, fixture, quality config (`test/architecture.test.ts`, `eslint.config.mjs`, `knip.json`, `.jscpd.json`, `vitest.config.ts`, `tools/design-drift.baseline.json`, `tools/page-budget.ts`), doc and skill that mentions an old path, id form or schema. Each row is marked migrated, adapter, or deleted. |
| `npm run rebuild:baseline -- --workspace <id> --out <dir>`   | Records, per selected route: status, headings, internal links, the JSON/view-model payload, and HTML bytes. Also every derived fact: component and system edges, callers, store access, producers/consumers, owners, code homes, plan before/after.                                                                                                                                                                              |
| `npm run rebuild:compare -- --before <dir> --workspace <id>` | Diffs against a baseline. Any difference must appear in `artifacts/rebuild/allowed-diffs.yaml` with a reason, or the command fails.                                                                                                                                                                                                                                                                                              |

## The stack

### PR 1: correctness and inventories (code)

- **Plan lock.** Locks cannot resolve independently prefixed nested ids (`api:` inside an interface; steps once
  they have ids). Fix the index in `src/application/plan/plan-base.ts:229-260,296-310` (the CLI call is
  `tools/plan-base.ts:90-101`) with one recursive `id → node` index across every base collection. Update
  `src/application/plan/plan-base.test.ts:144-190`, which currently expects `api:get` to be unresolved, and
  keep the `parent#name` test.
- **Commands**: build `rebuild:inventory`, `rebuild:baseline`, `rebuild:compare`. Capture baselines for
  `personal`, `acme` and `volvo-cars`, committed under `artifacts/rebuild/baseline/`.
- **Id and URL inventory**: list every id construction/parsing site (`` `sys:${…}` ``, `startsWith('sys:')`,
  `replace(/^svc:/)`, …) and every Git-host URL builder and parser (permalinks, repo homes, issue URLs, parsers,
  e.g. `src/domain/workspace-model.ts:200-206`, `src/application/today-repos.ts:57-60`,
  `src/application/workspace-area.ts:116-138`, `src/application/plan/progress.ts:78`,
  `src/application/plan-viz-source.ts:5-15`).
- **Explorer parity inventory** (`tools/explorer-parity.ts`): every reachable explorer capability (repository
  overview, entry links, caller lists, data shapes, source text, method flows) with its future replacement or
  "retire, approved".
- **Done when**: a nested `api:` change and a nested step change both report drift; the three inventories and
  baselines are committed; `check` passes.

### PR 2: ids and code links (code)

- `src/domain/ids.ts` (parse, build, kind, child paths `#a/b`, `#!failure`, alias resolution) and
  `src/domain/code-links.ts` (`permalinkOf`, `homeUrlOf`, `issueUrlOf`, `parseGitHostUrl`).
- Move every site from the PR 1 inventory onto them.
- Architecture tests reject direct id construction, prefix stripping and Git-host URL building outside these
  modules.
- **Done when**: the inventory is empty outside the two modules and fixture literals; `rebuild:compare` shows
  no differences.

### PR 3: canonical schemas and generation (code)

- `schema/workspace.schema.json` with `$defs` for every entity in design §3–§4 (step shape, failures, tagged
  field types, `Cite`, subscriptions, operations, screens, relationships, aliases).
- `schema/plan.schema.json` rewritten as the overlay over the new model; ops may target any id, including
  children.
- `schema/evidence.schema.json`, one `$def` per evidence family, through the same generation and load path.
- One generation path: TypeScript types from JSON Schema, Ajv validation at load. Remove hand-written zod in
  `src/infrastructure/workspace-schema.ts`, `workspace-model-schema.ts`, `workspace-landscape.ts`,
  `plan-validator.ts` and `workspace-model-facts.ts` as their files move over (old and new load side by side
  until PR 8).
- Extend or replace `tools/generate-plan-types.ts` and its test.
- Hand-write `test/fixtures/model/` covering every entity and step construct in design §4.
- **Done when**: `npm run generate && git diff --exit-code` is clean; invalid fixtures fail with the same paths
  in Ajv and at load; the fixture and valid/invalid evidence fixtures are checked the same way.

### PR 4: core model and indexes (code)

- `WorkspaceModel`, `apply`, `indexOf`, `plansIndex`, `readModel`, with placement independent of ownership.
- `legacyViewOf(model)`: the only compatibility boundary to old consumers, used by named consumers only. It
  writes a loss report of every field it cannot carry; the report must be empty for the fixture. (Do not reuse
  `systemModelOf`; it converts old inputs to the old plan shape.)
- Unit tests for every derivation in design §4.6, including gaps.
- **Stop inventing store owners** here, not earlier: remove the fallback at
  `src/application/workspace-model.ts:160-168` only once placement is indexed. Add regression tests for
  `src/application/system-map.ts:83-102`, `today-journeys.ts:40-49`, `area-map/resources.ts:185-198` and
  `src/infrastructure/workspace-plan-index.ts:18-30`, which used owner as placement. Update
  `src/application/workspace-model.test.ts:60-68`.
- **Done when**: the fixture loads, indexes, applies one plan op, and renders one legacy page through
  `legacyViewOf` with an empty loss report.

### PR 5: first vertical slice: the entry flow route (code)

- Extend the personal workspace (or the model fixture) with one endpoint handler containing a guard, a
  transaction, a store write, a loop, a call, a retry block, a `causes` link, a failure and cited leaves.
- Build the entry flow route from `files/flow-mockup/index.html` (node canvas) reading `flowOf(entryId)`:
  top strip, canvas, inspector, drill, gaps, light and dark themes, stacked wide splits.
- One plan change shows a before/after flow.
- Add explicit seed URLs to `tools/page-budget.ts` (it only follows links from `/`).
- **Done when**: the route renders from authored data in both themes; the browser receives serialisable data
  only; `check`, `build` and `budget` pass. This proves the model before any Volvo migration.

### PR 6: deterministic migration tool (code)

`npm run migrate:model -- --workspace <folder> --out <copy> --report <dir> [--accept <review files>]`:

1. explicit ids everywhere; prefix changes (70 websites → `app:`, 124 externals → `ext:` or `sys:` with
   `mapped: false`, 125 topics/queues → `top:`, libraries → `lib:`); bare landscape area and system ids;
   seed `aliases.yaml`;
2. rewrite every reference: about 4,000 ids and about 920 `[[id]]` text links across domains, landscape,
   programmes, plans, progress, revisions, base locks, flows and journeys (including 313 step nodes inside 17 plan ops — 275 handler nodes and 38 flow nodes — and 8 `after: flow:x#step` anchors), flows and journeys;
3. components into `system.yaml` with `kind`/`form`; `homes` keyed; one-line `cites` lists (911 `url:` sources
   converted); kept fields per design §12;
4. handlers split by component with explicit `component:`; `do` → `steps`; empty blocks and step `origin`
   dropped; retry blocks, waits and `fails` → `failures` converted;
5. step ids by the design §9 rule; collisions written to `step-ids.yaml` for review, never resolved by
   traversal order;
6. `say`: write `headlines.yaml` (step path, `does`, proposed `say`, status). The tool applies only accepted
   rows from `--accept`;
7. `job:` entries declared from the 111 handlers that start on one; `sub:` entries from message handlers;
   externals deduplicated (one LaunchDarkly); the two misfiled details moved: `svc:assortment-dgs` and
   `svc:product-enrichment-dgs` from `federated-graph/contracts.yaml:45,543` to `assortment` and
   `product-enrichment`; external interfaces moved to the consuming system's `contracts.yaml` with
   `external: ext:…` and removed from other system files;
8. `talks_to` → `connections` with `backs:`; contract-backed edges and uncovered producers/consumers/access →
   cited `relationships`; the rest → `review-edges.yaml`.

- **Done when**: two runs with the same accepted files are byte-identical; reordering input does not change ids;
  output validates; all review files are written.

### PR 7: Volvo data migration (data PR in `volvo-groundwork`)

- LLM batches propose headlines and edge dispositions into the review files; a human accepts them.
- Run the pinned tool; run `rebuild:compare` against the PR 1 baseline (old loader on old data, new loader on
  new data). Every difference is fixed or listed in `allowed-diffs.yaml` (for example, invented owners removed).
- **Done when**: the compare passes, `npm run workspace -- check` passes, and `npm run map -- show <id>` resolves
  every migrated id once.

### PR 8: plans, tools, routes and pages (code)

- Pages and JSON routes (`model.json`, `plan.json`, revision `plan.json`, `areas/[area]/map.json`) call
  `readModel` once. Map views take an index; a plan's map is the same view given `after`.
- Plans become `{ plan, before, after }`; `src/features/plan/plan-model.ts` stops re-deriving in the browser.
- Tools: `map`, `workspace`, `system-narrative`, `plan-base`, `progress`, proof scripts.
- Remove `legacyViewOf` consumers one at a time until none remain.
- **Done when**: the consumer inventory has no "adapter" rows; `rebuild:compare` passes against the baseline
  plus allowed diffs; `check`, `build`, `budget` pass.

### PR 9: scan writes the new model (code and skills)

- The scan writes `evidence/` directly with `ev:` ids, refreshes handlers and contracts, reconciles step ids by
  cited span and control-flow path, and reports ambiguous matches.
- Fills request/response schemas from route bindings and type contracts, `causes`, schedules and lane names
  where evidence allows.
- Promotes every analysis record the model cites into `evidence/`.
- Update every skill that mentions old paths, ids or schemas (scan, schema, explore, plan, ask, graph,
  landscape, diagram, mockup, review, revise, update, issues, workspace).
- **Done when**: record the Volvo repository with the largest handler count at PR start in
  `artifacts/rebuild/rescan-target.json`; scan it twice at the same commit; the second run leaves `evidence/`,
  `contracts.yaml` and `handlers/` byte-identical (`git diff --exit-code`), keeps the full first-run id set,
  reports no ambiguous step matches; and the inventory shows no skill invokes an old producer.

### PR 10: retire and shrink (code, then data)

In design §8 order, each only after its proof:

- old types, loaders, `legacyViewOf`, `knowledge*`/`scan-discovery`/`scan-interpretation` schemas, scan marks;
- the explorer (routes `src/app/[workspace]/explorer/…`, `explorer-data/…`, `src/features/service-explorer/*`,
  `src/infrastructure/explorer-*`, `service-explorer-*`) once `explorer-parity` has no unexplained item;
- `.groundwork/syntax/`, old corpus generations, then the live corpus;
- analysis cache handled per design §10.2; `evidence.sqlite` re-indexed.
- Record sizes before and after in `artifacts/rebuild/sizes.md`.

## Risks

| Risk                                   | Mitigation                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Step ids churn on rescan               | Assigned once; reconciled by span and path; ambiguous matches reported.           |
| LLM headlines or edges drift from code | Review files only; tools apply accepted rows; `does` and code stay authoritative. |
| Plans break on renamed ids             | `aliases.yaml`; one-run rewrite; plan-lock fix in PR 1.                           |
| Deleting the only copy                 | Scan replacement (PR 9) before retirement (PR 10).                                |
| Pages silently lose facts              | `legacyViewOf` loss report; `rebuild:compare` with allowed diffs.                 |
| Stack too large for one context        | One session per PR; handoff artefacts committed.                                  |
