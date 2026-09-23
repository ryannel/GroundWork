# Review of the system knowledge plan

Reviewed 2026-09-16 against [SYSTEM_KNOWLEDGE_PLAN.md](SYSTEM_KNOWLEDGE_PLAN.md). This document records recommendations; it does not amend the plan or implement runtime changes.

## Review approach and verdict

Three agents reviewed independently:

- **Blind reviewer:** received only the plan path, no conversation history, and instructions not to read repository code or other reviews. Assessed the proposal as a standalone document.
- **Technical reviewer:** checked the proposal against current storage, scanner, validation and query code.
- **Product and scope reviewer:** assessed human exploration, agent discovery, release boundaries and measurable usefulness.

The direction is sound. Keep the useful baseline, bounded retrieval, explicit uncertainty, targeted investigation and separation of observations from proposed changes. All three reviewers recommend proving a complete discovery-and-reuse workflow before making the physical storage migration a prerequisite.

B1 can proceed once its small query contract and evaluation fixtures are specified. Later increments need the lifecycle and evidence decisions below. These are implementation gates for the affected work, not reasons to design the entire future system before starting.

## Missing or underspecified contracts

### 1. Preserve the actual baseline used by a feature plan

**Priority: high before persisting plan baselines. Raised by technical review.**

The plan promises historical baselines, but the current catalog revision is a hash of document contents, not a retrievable snapshot. Historical reads require a Git ref. If a plan uses uncommitted catalog A and a refresh replaces it with B, storing A's hash cannot recover its facts. See plan lines 47 and 133–135; `server/repository.ts:52` and `server/repository.ts:119`.

Choose a minimal retention contract: a bounded immutable packet of the facts/evidence used by the feature plan, or content-addressed retained observations. Keep source Git revisions, catalog revision tokens and retained baseline identities distinct. This does not require saving every query response or building a general history database.

**Acceptance:** create a plan against uncommitted A, replace or remove a referenced fact in B, and still display exactly the evidence and assumptions used in A without requiring a Git commit.

### 2. Define retirement and targeted merge semantics

**Priority: high before incremental writes. Raised by blind and technical reviews.**

A targeted scan omitting an entity is not evidence of deletion. Conversely, a confirmed deletion must stop appearing as active while preserving historical references. The plan needs explicit inspected boundaries, upsert/retire behavior, rename identity rules and handling for dependent flows/relations. See plan lines 117 and 125.

This has an existing concrete failure mode: scanner API replacement can remove an endpoint while retaining its flows (`server/scanner.ts:577`), after which flow validation rejects the missing endpoint (`src/data/execution-flow.ts:13`).

**Acceptance:** omission preserves uninspected siblings; confirmed deletion retires the endpoint and active dependent projections atomically; evidenced rename preserves identity; historical plans remain readable; concurrent investigations encounter a revision conflict or an explicit reconciliation.

### 3. Give freshness a precise, scoped meaning

**Priority: high before freshness labels authorize reuse. Raised by blind and technical reviews.**

Citations identify observed source locations; they do not prove every dependency affecting a fact has been mapped. Unchanged cited files therefore cannot establish unchanged behavior. See plan lines 111–117.

Separate citation integrity, checks of known change impact, and behavioral verification. A check should state the source target, checked scope, method, uncovered dependencies and basis for reuse. Incomplete dependency knowledge must allow “impact unknown” or “review required.” Avoid a blanket “current” claim. This is a conservative result contract, not a request for exhaustive call-graph extraction.

**Acceptance:** an unchanged handler with a changed known helper widens inspection; a changed unindexed helper, configuration or package dependency cannot silently produce a verified-current result. Unavailable source history leaves an explicit unknown state.

### 4. Define query identity and snapshot semantics in B1

**Priority: medium; resolve before exposing the new tools. Raised by technical review.**

B1 promises deterministic pagination, while qualified references arrive in B2. Move the logical identity contract into B1 independently of disk layout. Specify checkout/ref selection, qualified entity IDs, catalog snapshot token, source revisions, size limits, omissions and continuation behavior. A cursor must reject or explicitly restart when its selected snapshot changes. See plan lines 89–95.

Clarify that “without loading all 348 schemas” initially means **not returning all schemas to the agent**. The current backend reads and validates the full bundle. Avoid turning bounded output into an unintended storage-performance requirement.

**Acceptance:** duplicate entity names across components are distinguishable; checkout changes invalidate cached results; pagination cannot silently mix snapshots; omitted detail can be fetched by stable reference; returned source text remains untrusted evidence.

### 5. Preserve repository identity in cross-repository evidence

**Priority: medium; required before supporting cross-repository findings. Raised by technical review.**

B4 mentions inspecting shared packages, but today's evidence carries a path and revision without an explicit repository identity. Links inherit the component repository. Relaxing the single-SHA restriction alone would leave external citations ambiguous. See plan lines 123–125; `src/data/content-schema.ts:58` and `src/data/execution-flow.ts:44`.

Bind each citation to a source identity and pinned revision, with legacy evidence inheriting its existing component source. An inaccessible shared dependency remains an explicit boundary. A first demonstration may stay within one repository and revision while preserving all existing sibling records.

**Acceptance:** two repositories with the same relative source path produce distinct, correctly resolved citations, source links and freshness checks.

### 6. Specify what triggers feature-plan reassessment

**Priority: medium; required before automatic reassessment. Raised by blind review.**

The plan says catalog refresh triggers reassessment at line 135, but source change triggers it at line 137. Define the supported event and dependency granularity. There is no automatic detection of an unseen source change without a check.

A minimal rule can flag a plan when an explicit freshness check reports possible impact on a referenced observation, or a catalog write supersedes/retires that observation. Preserve the original baseline. An unrelated entity update should not invalidate every plan.

**Acceptance:** relevant checked changes and retired facts flag the affected plan; unrelated changes do not; an unchecked target remains visibly unchecked.

## Product improvements

### Make human exploration an explicit deliverable

The goal includes people learning the system, but B1 mainly specifies tools and badges. Add exact entity deep links, clickable source pointers, contextual relationships and a useful next inspection for untraced entries. Validate that following a relationship and returning preserves selection and scroll position. This addresses the browsing problems that motivated the work, not just API usefulness.

Expose consumer/job starting points through existing messaging and source evidence early. Define their minimum logical identity and ownership before adding generalized flow triggers. Full consumer/job flow persistence need not precede useful handler discovery. These recommendations combine the product review and blind review.

### Establish a small evaluation set before B1

Blind and product reviews both found that one MSRP lookup could pass without proving discovery quality. Create a fixed, independently checked set across both products:

- Exact entity lookup and a paraphrased feature question without entity seeds.
- Ambiguous candidates and a question for which knowledge is missing.
- An untraced API, an already traced journey and a consumer starting point.
- A bounded cross-component query and a follow-up after reusable write-back.

For each, specify essential starting entities/pointers, mandatory uncertainty, misleading candidates, and recoverable omitted detail. A proposed initial retrieval target is the correct starting point among the first five results, within the declared packet limits and without unsupported behavioral claims. Establish measurements rather than claiming a speedup in advance.

Save findings only when useful beyond the immediate task: subject, answered question, source identity/revision, evidence, boundary and unresolved assumptions. Keep feature proposals in the plan. A repeat question should retrieve the saved finding without repeating discovery; a changed baseline must expose uncertainty.

## Remove or defer from the first useful release

- The full physical directory migration and detailed per-entity file splitting. Keep the catalog/plan distinction logical first; retain migration safeguards when relocation is implemented.
- A general relations store and every flow-trigger type as prerequisites. Use current supported relationships; make consumers discoverable before building every flow representation.
- Comprehensive per-file incremental impact selection before proving one reusable investigation. Start with explicit pinned revisions and honest checks; do not label unchecked knowledge current.
- Automatic plan reassessment until retained baselines and observation dependencies are defined.

Do not remove guarded writes, provenance, uncertainty or historical readability to achieve these cuts. Keep SQLite, embeddings, exhaustive extraction and broad backfills deferred as the plan already proposes.

## Recommended delivery order

1. **Define the B1 contract and fixtures:** qualified IDs, bounded response envelope, snapshot/cursor rules, expected discovery results.
2. **Ship focused retrieval and human navigation:** current JSON, honest coverage/depth/freshness, exact entity/source links, recoverable omitted context.
3. **Prove one complete loop:** investigate MSRP at a pinned revision, persist a useful result without losing siblings, retain the small baseline used by a feature plan, and answer a follow-up from it. Respect existing same-revision validation until its replacement is explicitly implemented.
4. **Add safe lifecycle and scoped freshness:** retirement/rename reconciliation, source identity, scoped verification, guarded targeted writes; add a consumer demonstration and generalized trigger support when needed.
5. **Migrate storage and extend planning:** retain the existing proposed dry run, recovery, compatibility and mixed-authority protections; add plan reassessment against explicit observation dependencies.

Run the evaluation set throughout. The first useful release should demonstrate exploration and one complete discovery/reuse/planning loop. The broader roadmap then improves efficiency and storage organization based on measured use.
