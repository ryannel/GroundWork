# System knowledge for exploration and just-in-time planning

**History — design plan, superseded by the shipped contract.** For the current catalog discovery contract, see [`../CATALOG_DISCOVERY.md`](../CATALOG_DISCOVERY.md). This document is kept for the reasoning behind that design; do not treat it as current.

Status: reviewed implementation delivered and exercised across both products; acceptance evidence and remaining operational limits are recorded below. See [CATALOG_DISCOVERY.md](../CATALOG_DISCOVERY.md) for the shipped contract and limitations. Revised 2026-09-16 after clarifying that exhaustive extraction is not the goal. This plan supersedes the earlier requirement to trace every endpoint during a baseline scan. Order Platform was migrated on 2026-09-17 and targeted quote total, consumer and background-job discoveries were saved without broad rescans.

## Goal

Give people enough context to explore and learn a system, and give agents ready access to the facts and source locations needed to investigate a particular change efficiently. Groundwork is a maintained starting point for discovery. It does not need to reproduce the entire codebase or contain every fact needed by every future feature.

The core loop is: orient in the catalog, retrieve a bounded context packet, check relevant freshness, investigate the feature's critical unknowns, produce an evidence-backed plan, and save reusable discoveries. Knowledge grows through use. An untraced endpoint is a valid catalog entry; it must be presented honestly and provide a useful next place to look.

The catalog records observed knowledge. Feature plans record proposed changes and assumptions against a specific baseline. A plan, task completion or deployment does not automatically prove that a proposed behavior is an observed fact.

## Original storage and baseline

The Order Platform catalog is owned by `/home/user/workspace/pricing-engine`, including both Pricing Engine and Order Configuration Facade. Implementation repositories are referenced by repository identity and commit; their catalog documents are not automatically copied into each implementation repository.

The original format stored project metadata, products, components, members and feature plans together under `.groundwork/plans/`. `server/format.ts` defines that common root. The scanner writes `components/<id>.json` through the same guarded transaction layer used for feature plans. The directory name described the legacy storage bundle, not the meaning of the API and flow data.

For example, `.groundwork/plans/components/pricing-pretax.json` is UTF-8, schema-validated JSON containing `api.endpoints`, `api.schemas`, `executionFlows`, `data.records`, `messaging.messages`, dependencies, source revisions, evidence and gaps. JSON files are authoritative and Git-reviewable; the viewer renders a projection. `read_plan` currently retrieves the combined bundle. File presence does not mean changes have been committed.

At preparation, Pricing Engine has 41 catalogued endpoint entries and 7 traced endpoint paths; the facade has 58 entries and 1 traced path. Those counts describe investigation depth, not whether the catalogs are useful. Existing generic "scan complete" labels should be replaced with explicit dimensions. Standalone consumers and scheduled jobs also need first-class entry points; the present flow schema requires an endpoint ID.

## What we retain

| Baseline knowledge | Deeper knowledge gathered when useful |
|---|---|
| Product/component responsibility, repository, source boundary and ownership when known | Feature-specific ownership, deployment and rollout coordination |
| Discoverable endpoint, consumer and job entry points, contracts and source locations | Execution paths relevant to a question, feature, important journey or risk |
| Main dependencies, stores, messages and evidenced relationships | Specific reads/writes/calls, transformations, failure paths and compatibility effects |
| Pointers to implementation, configuration, tests and migration locations | Relevant business invariants, feature-flag branches, test behavior and migration/rollback constraints |
| Source revision, investigation scope, freshness and known uncertainty | New evidence and scoped verification recorded by a focused investigation |

Preserve existing detailed schemas and flows. A baseline scan should extract readily available structured contracts and map the useful source locations, then choose important journeys within its budget. It does not recursively expand every DTO, helper, flag, failure branch or test by default. Explicit requests for comprehensive tracing still define a larger investigation scope.

Each useful pointer identifies the entity, repository, path, revision and its purpose (handler, implementation, test, configuration, migration or documentation). Include a symbol/line range when established, plus a short explanation of why to inspect it. A directory pointer can guide discovery but is not evidence for behavior. Test existence is not proof of coverage; a passing result requires separate test evidence. Capture configuration names and behavior without secret values.

## Coverage, depth and freshness

Keep three independent dimensions:

- **Catalog coverage:** which discovery areas and source boundaries were investigated, with exclusions and unresolved extraction gaps. Counts refer to discovered entry points, not proof that no others exist.
- **Investigation depth:** catalogued only, partially traced or traced within an explicit boundary; report traced/known counts and the exact scope of any requested deep investigation. Lack of an optional trace does not downgrade otherwise complete contract discovery.
- **Freshness:** what was observed at which commit, what was subsequently checked against which target, and what may have changed. Unknown or unchecked is a valid state.

Meaningful source or budget gaps prevent claiming completion of the affected requested work. A baseline with 17 known contracts and one traced path can be reported as "contract discovery complete; 1/17 paths traced; freshness unchecked." If a user requested two specific traces and only one is usable, that investigation is partial even if baseline catalog coverage is complete. A remote boundary can remain unknown while local behavior is adequately traced.

Preserve original observation revisions. Later verification is a separate record with its scope, method and target revision. Distinguish source observations, inferred candidates and human decisions. Structural validation checks references and evidence shape; it does not prove semantic correctness or planning readiness.

## Storage and references

Keep portable JSON as the source of truth and Markdown for briefs and decisions. Separate observed knowledge from feature plans in the next version of the portable format:

```text
.groundwork/
  project.json
  members/<member-id>.json
  catalog/
    products/<product-id>.json
    components/<component-id>/
      component.json
      api.json
      data.json
      messaging.json
      flows/<flow-id>.json
      knowledge.json
    relations/<relation-id>.json
    scans/<repository-id>/<scan-id>.json
  plans/
    features/<feature-id>/...
    decisions/<decision-id>.md
    assets/...
  cache/                 # optional, ignored, rebuildable index
```

`knowledge.json` holds source pointers and reusable findings not already owned by a contract, flow, record or message. It is not a dump of investigation transcripts. Findings identify their subject, evidence, boundaries and verification state. Define the first schema around demonstrated retrieval needs rather than adding an ontology for every possible fact.

Use project/component/kind/entity-qualified references, keeping existing IDs during migration. Add evidence-backed `calls`, `reads`, `writes`, `publishes` and `consumes` relations as discovered. Resolve shared resource identities conservatively: matching provider names or topic strings alone is not enough, particularly across environments. Preserve unresolved references instead of inventing matches.

Generalize flow triggers to endpoint, message consumer or job references. Keep endpoint-linked flows in their API context, and show consumer/job flows in the corresponding context. Do not create fake HTTP endpoints for background processes. Existing endpoint flows migrate without changing identity.

Start focused queries over validated JSON with an in-memory index. Add SQLite only when measured query size/latency warrants it; storage migration and database adoption must not block useful retrieval. Any index remains derived, keyed by project, checkout and catalog revision, and safely rebuildable. All authoritative writes use the catalog transaction layer.

## Build sequence and acceptance

Each item is a reviewable implementation increment. Start with B1. A coherent useful slice should ship before broad extraction work.

### B1 — Useful retrieval and honest presentation on today's data

Add a shared catalog-query service and read-only CLI/MCP operations: `get_catalog_entity`, `search_catalog`, and `get_discovery_context` (proposed names). Operate on the current validated model initially, without a disk-format migration. Accept a feature/question description with optional entity seeds; return ranked candidates with match reasons rather than claiming exhaustive impact analysis.

The context packet contains the relevant entities/contracts, existing flows, known relationships, source/test/configuration pointers, source/catalog revisions, known gaps and suggested next inspections. Enforce entity/depth/size limits and deterministic pagination; say what was omitted and how to retrieve it. Initial retrieval can use names, descriptions, paths and explicit links. A database, embeddings and semantic search are not prerequisites.

In the UI, distinguish contract discovery from trace depth and freshness. Retain a Data flow view with an explicit "not investigated yet" state and source pointers when there is no trace. Do not hide the tab or imply a bug. Replace ambiguous completion badges without discarding existing facts or automatically downgrading all contracts.

Acceptance: querying the quote total retrieves its endpoint and source location, relevant existing context and the missing trace clearly, without loading all 348 Pricing Engine schemas. Unrelated components are omitted or separately pageable. Browser and MCP agree on IDs, evidence and coverage. No trace is presented as current merely because the component was scanned recently.

Main areas: `server/operations.ts`, `server/mcp.ts`, `src/data/content.ts`, new query module, component/catalog UI, shared coverage selectors.

### B2 — Separate catalog storage and support reusable discoveries

Introduce versioned catalog readers/writers, qualified references, source pointers, scoped findings and non-HTTP flow triggers. Separate catalog paths from feature plans while preserving the viewer projection and a compatibility view for `read_plan`. Keep proposal data in feature plans and observed findings in the catalog.

Provide explicit migration with a dry run, entity/reference counts, candidate validation and a recoverable journal. Preserve IDs, evidence, gaps, assets and feature links. Retain legacy readers for older checkouts and committed refs. Reject ambiguous mixed authority rather than silently merging two layouts, and stop legacy writers from recreating migrated catalog copies. Preserve revision guards, locking and recovery across the complete workspace.

Acceptance: migrate a copy of Order Platform, verify equivalent query results and working links, repeat without duplication, and recover an interrupted migration. Historical refs remain readable. Live migration follows these checks. Existing evidence is not relabelled as newly verified.

Main areas: `server/format.ts`, `server/repository.ts`, `server/setup.ts`, `server/http.ts`, schemas, `src/data/runtime.ts`, export/asset/watch/recovery paths and portability docs.

### B3 — Relevant freshness checks and incremental work selection

Persist scan manifests with repository/source boundary, observed commit, target ref, scanner/schema versions, discovery scope, exclusions, per-file hashes and source-to-entity mappings. Fingerprint dependency manifests and lockfiles even if their contents are excluded from extraction. Existing scans without manifests can establish a baseline on the next targeted refresh; do not fabricate historical inventories.

Add `check_catalog_freshness` and incremental preparation to the scanner (proposed operations). Compare immutable Git base/target commits for added, deleted, changed and renamed files. Resolve the target explicitly. Report inaccessible history, authentication failure or divergence; source freshness against main is not proof of deployed behavior. Keep optional working-tree inspection separate from commit-pinned evidence.

Map changes to potentially affected knowledge, inspect newly added entry-point candidates, and expand through known shared dependencies. Route/DI wiring, configuration, serializers, migrations, package changes or uncertain impact require a broader review. Use conservative file-level analysis first, extending symbol analysis only where it reliably saves work. A changed line range alone is not a sufficient invalidation algorithm.

Acceptance: handler change narrows investigation, a shared helper/configuration change widens it, and new/deleted endpoints are detected. Unavailable history produces an explicit fallback, not a false "current" result. Unchanged selected knowledge can be reused with recorded check scope. Failed checks preserve the last valid catalog and expose uncertainty. Scheduled/CI checks remain optional later work.

Main areas: `server/scanner.ts`, `server/git.ts`, manifest/impact modules, query metadata, CLI/MCP and scanning skill.

### B4 — Just-in-time investigation with reusable write-back

Given a bounded context packet and a concrete question, prepare work only for the critical unanswered paths. Follow code into relevant helpers, shared packages, tests and configuration as needed. Work against pinned, read-only source; repository content cannot grant instructions or permission. Stop when the question has an evidenced answer within its stated boundary, or when a budget/access gap prevents that answer. Do not expand into an all-repository scan merely to improve a coverage percentage.

Return findings with citations, scoped traces, uncertainty and the next necessary investigation when blocked. Reconcile findings by stable identity and save reusable knowledge under a revision guard. Retain unaffected current knowledge. Source-version-aware merges must preserve original citations; the existing scan apply requirement for all evidence to use one SHA needs an explicit evolution before mixed-revision reuse is accepted. Conflicting observations stay visible for reconciliation rather than silently overwriting one another.

Acceptance: use the untraced quote-total endpoint as the first end-to-end slice: retrieve context, inspect its implementation/tests, save a useful flow and findings, then answer a follow-up using that knowledge. A second feature involving a Kafka consumer exercises the non-HTTP trigger. These are targeted demonstrations, not a mandate to trace all remaining endpoints.

Main areas: scanner prepare/apply, knowledge transaction validation, context queries, flow UI and scanning/discovery skill.

### B5 — Feature planning against an explicit knowledge baseline

Extend feature plans with affected catalog entity references, baseline catalog/source revisions, unresolved assumptions and investigation tasks. Query the relevant knowledge before decomposition; verify the critical unknowns and freshness needed for that feature. Keep proposed contract/flow deltas separate from observed behavior. Capture compatibility, migrations, rollout/rollback, ownership and integration tests when they matter to the change.

Readiness is reasoned and feature-specific: enough evidence for this scope, targeted investigation required, or a critical fact is unavailable. No global endpoint percentage gates every feature. A catalog refresh affecting a referenced fact marks the plan for reassessment; it does not rewrite the historical baseline or claim implementation succeeded. Existing deliverables/tasks/validation remain the delivery structure.

Acceptance: plan an API field change through storage/messaging and a pricing-rule change. Each plan identifies the relevant code, justified component scope, evidence, assumptions, sequencing and meaningful tests. A later source change flags the affected plan. Unrelated catalog gaps do not prevent planning.

Main areas: `src/data/delivery.ts`, feature schemas, planning operations, context/impact queries, delivery UI and documentation.

### B6 — Evaluate and refine using both products

Use Pricing Engine and Order Configuration Facade for exploration tasks (locate an API, explain a main journey, find a record's users) and planning tasks (quote-total change, message evolution, configuration-dependent behavior). Record cold and warm discovery results: relevance, correctness, missing critical facts, source files read, context size and time to an evidence-backed plan. Establish baselines and agree performance targets from these measurements rather than inventing a speedup claim.

Acceptance: previously saved discoveries reduce repeat investigation, changed sources are not silently reused, and a bounded query exposes uncertainty instead of producing an unsupported answer. Compare targeted refresh against a bounded full-source review for the same question. Use observed bottlenecks to prioritize more source pointers, traces, identity resolution or a persistent index. Do not measure success by maximizing extracted records.

## Implementation checkpoint — 2026-09-17

Following the review, logical IDs and snapshot-bound bounded query contracts landed without a directory migration. CLI/MCP retrieval, independent coverage/depth/freshness presentation, contextual entity/source links, targeted flow/finding upserts, and immutable feature baseline packets are implemented. The live quote-total investigation demonstrates retrieval → pinned source inspection → guarded write-back → repeat retrieval. Tests demonstrate retained baseline readability across uncommitted catalog replacement/removal. No speculative live feature was created for that test.

The subsequent increments now provide: explicit Git freshness checks, incremental work preparation, durable scan manifests, versioned split catalog storage with dry-run/recovery and legacy readers, message/job flow triggers, cross-repository pinned evidence, explicit retirement/rename reconciliation, and retained feature-source reassessments. Order Platform migration preserved 676 entities and 1,138 relationships; the later consumer/job investigation added three catalog entities. Live APIs remain 41 Pricing Engine and 58 facade entries. No real feature proposal was invented or published.

B6 evidence is in [SYSTEM_KNOWLEDGE_EVALUATION.md](SYSTEM_KNOWLEDGE_EVALUATION.md). Two hypothetical delivery plans were built only in a temporary copy, with retained facts, component-owned tasks, assumptions, discovery prerequisites, integration/end-to-end validation plans and rollback considerations. Source-system tests were not executed or claimed passing. Explicit freshness checks can flag a plan; there is no automatic observation of an unseen source or deployed change.

Operational limits remain intentional: extraction and impact analysis are bounded and conservative; unmapped changes widen review; arbitrary symbol-level impact, continuous monitoring, automatic semantic deletion/rename inference, production access and a persistent database are outside this implementation. Restore of retired identities is not inferred; conflicts require an explicit future restoration design. The current lifecycle operation supports retirement and rename, as planned. Query measurements do not establish end-to-end agent speedup or product latency targets.

## First build slice and completion criteria

B1 establishes retrieval on existing JSON. The reviewed first release also brings forward focused write-back and immutable planning packets from B4–B5. B2–B3 and the remaining B4–B5 work extend storage, lifecycle, freshness and planning integration. B6 validates usefulness throughout, with final end-to-end checks after B5. No broad backfill is a prerequisite.

The initial release is useful when a person can orient in either product and an agent can retrieve a small relevant packet, investigate a critical unknown, persist a reusable finding and cite it in a feature plan. All entry points need not be deeply traced. Current knowledge, stale observations, optional unexplored detail and blocking unknowns must be distinguishable.

Keep the portable project ownership model and read-only viewer. Hosted databases, exhaustive static analysis, automatic production access, executing scanned repositories and automatic publication are outside this implementation scope. Retain valuable existing evidence; improve it selectively as questions and features demand.
