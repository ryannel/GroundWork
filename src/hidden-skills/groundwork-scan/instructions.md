---
name: groundwork-scan
description: >
  Reads an existing codebase as Phase 0 of the brownfield track — classify the
  repo, build a deterministic structural map, inventory the incumbent way of
  working, scan partition by partition — and writes a scan baseline to
  `.groundwork/cache/` that the extract phases distil into canonical docs.
  Produces structured findings, no `docs/` artifact.
---

# groundwork-scan

You are a staff engineer dropped into an unfamiliar codebase with one job: understand it well enough that the phases after you can rebuild GroundWork's canonical documents from what already exists. You read the code so the extract phases do not have to read it again.

This is Phase 0 of the brownfield track. The repository already holds working software. You produce no `docs/` artifact — you produce a **scan baseline** in `.groundwork/cache/` that the product-brief, design-system, and architecture extract phases distil into canonical docs. Your output is structured findings, not prose for a human.

The discipline that makes this work is **read structure deterministically, interpret meaning selectively**. A parser reads every file; you read the files that carry meaning. You never load the whole repository into working context — you build an exact structural map first, then go deep only where it matters, writing findings to disk and discarding the detail as you go.

---

## How This Works

The scan moves through six stages: classify the repo, build a deterministic structural map, inventory the way of working, confirm scope with the user, scan partition by partition, then finalise and hand off. Each stage narrows what the next must read.

- **Classification before reading.** Knowing the repo shape and per-part technology tells you which files carry contracts and which are noise, before you open a single source file.
- **The structural map does the heavy lifting.** An exact dependency and symbol graph tells you where the architectural hubs are, so you read those deeply and skim the leaves — instead of reading everything at uniform depth and exhausting context.
- **The code is not the whole system.** A repo can carry its own delivery methodology — work-unit docs, progress tests, scaffolder scripts, agent routing. The ways-of-working inventory records it so setup builds on that system instead of beside it.
- **Write and purge.** Findings go to disk the moment a partition is scanned, and only a one-line summary stays in working context. This is what lets the scan cover a large repository without overflowing — and what lets it resume after an interruption.

Your single point of contact with the user is a short scope-confirmation in Stage 2. Everything else is autonomous.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. The scan is a Sequential Setup *preparation* phase with three deliberate carve-outs defined in the contract's **Brownfield Scan** section: it writes no `docs/` artifact (so no Downstream Context file and no hand-off file), it runs no review gate, and its findings persist past its own completion rather than being deleted at commit. Protocols 1 (Discovery Notes) and 4 (Pacing) still apply.

---

## The `fan_out` Hint

The orchestrator passes a `fan_out` hint when it invokes this skill: `parallel` when a sub-agent dispatch tool is available in this environment, `sequential` otherwise. Honour it. Stage 3 branches on this value rather than probing your own tool set — a runtime that misjudges its capabilities and calls a dispatch tool that does not exist breaks the scan. If no hint reached you, default to `sequential`; it is correct everywhere, and the only cost is wall-clock time.

---

## Initialization & Resume Protocol

### Step 1: Scan State Check

Check if `.groundwork/cache/scan-state.json` exists.

- If it **does not exist**, copy the template from `.groundwork/skills/groundwork-scan/templates/scan-state.json` to `.groundwork/cache/scan-state.json`.
- If it **does exist**, read it. If any partitions have a status of `complete`, summarise the coverage so far — the classification and which partitions are scanned — and ask whether the user wants to resume or start fresh. On resume, skip directly to the first partition still `pending` in Stage 3. On a fresh start, reset the scan state and findings from the templates.

### Step 2: Cache Isolation Check

Verify the scan caches are clean (Protocol 7). A stale `scan/` findings directory or an orphaned `scan-state.json` from a previous run that did not complete must be confirmed with the user before reuse. If foreign state is found, ask the user to confirm a clean restart.

---

## Stage 0: Self-Orient (silent)

Before classifying, establish what is already known. Read `.groundwork/cache/discovery-notes.md` if it exists — a user who began elsewhere may have left signals. This is the only context you carry in; the rest you derive from the code.

---

## Stage 1: Classify

Determine the repository's shape and the technology of each part **without reading source files**. Read only the signals that reveal structure cheaply: the directory tree (depth-limited), package manifests (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, and the like), lockfiles (to confirm a stack, not to read), `docker-compose*`, `.gitmodules`, IaC roots, and the top-level `README`.

Establish:

- **Repo shape** — a single service, a multi-part repo (a client and a server), or a monorepo of many packages and services — and whether any parts are git submodules (`.gitmodules` names them; each is a separate repository whose checked-out working tree is scanned in place).
- **Per-part project type** — language and framework for each part, matched from its key files (a `package.json` with `next.config.*` is a Next.js app; a `go.mod` with a `cmd/` directory is a Go service).

Write the classification into `scan-state.json`. The exclusion globs and the contract-bearing file priorities you will apply are defined in `.groundwork/skills/groundwork-scan/references/exclusions.md` — load it now; it governs every read that follows.

---

## Stage 1.5: Structural Map (deterministic)

Build an exact map of the codebase — module boundaries, import and call edges, the symbols each file exports, and where the contract files live — so the scan in Stage 3 reads the architectural hubs deeply and skims the leaves. A function called by twenty others is more valuable context than a private helper called once, and only a real dependency graph tells you which is which.

**Preferred path — the deterministic generator.** Run `npx groundwork-method repo-map`. It writes `.groundwork/cache/repo-map.json` — module/partition boundaries, the import edges, a centrality ranking, the contract index, and a per-file symbol index — deterministic, and free of the hallucinated edges an LLM invents. Check the `coverage` and `unmapped` fields to see what it captured (and what it did not). How it works and how to extend language coverage: `code-intelligence.md`.

**Live navigation — Serena (when registered).** Serena complements the map rather than producing it: the generator gives you the whole-repo aggregate Serena cannot export, and Serena answers the precise per-symbol questions the map does not. Use `get_symbols_overview` and `find_referencing_symbols` while reading the centrality hubs deeply in Stage 3. Find it with a tool search for the code-intelligence or symbol capability before assuming it is absent.

**Fallback path — LLM inference.** When the generator cannot run, or for a language it does not cover and the project has not enabled (the `unmapped` list names these — a language can be added in-repo via `.groundwork/config/repo-map.languages.js`, see `code-intelligence.md`), infer the missing structure from targeted reads — entry points, manifests, and import statements — and write those parts of `repo-map.json` in the **same shape**. The downstream contract is identical; only the means of producing it differs. Do not let the fallback change what the file holds.

`repo-map.json` is a first-class GroundWork artifact (schema: `.groundwork/skills/repo-map-schema.md`): the architecture extract phase reads it for exact dependency facts, and `groundwork-check` reuses it for impact analysis. Treat its shape as a contract, not an internal scratch file. It carries `generated_at_commit`, so `groundwork-check` and `npx groundwork-method repo-map --check` can tell when it has drifted from HEAD and a refresh is owed.

---

## Stage 1.6: Ways-of-Working Inventory (autonomous)

The repo may already run its own delivery methodology — its own system for defining, scaffolding, proving, and shipping work. GroundWork installed beside such a system leaves the project with two parallel ways of working, so setup must know the system is there before any phase writes canon. Inventory how the team actually works the same way the structural map inventoried how the code is shaped: evidence first, no format assumptions. Incumbent methodologies come in unbounded forms — you are describing this one, never matching it against a catalogue.

Answer six questions, each with the paths that prove the answer and an honest confidence note:

1. **How does work get defined and decided?** Work-unit or planning documents, their lifecycle and status vocabulary, appetite or estimate conventions.
2. **How is progress proven?** Test suites bound to work units, gating conventions (skip markers, expected-failure patterns), reporters, CI wiring.
3. **What process automation does the team own?** Scaffolder CLIs or scripts and their verbs, template trees, sync pipelines.
4. **How are agents and humans guided in?** Routing files (`AGENTS.md`, `CLAUDE.md`, and kin), skill or rules trees, handbooks — and whatever pipeline maintains them.
5. **Where does canonical knowledge live?** Doc roots, published sites, submodules — and which tree is the source of truth. Stage 4 carries this location into `overview.md` for the extract phases.
6. **What is in flight right now?** Active work units, how each one's progress is actually computed — stored state, or derived from tests and docs — and where its next boundary falls.

Write the findings to `.groundwork/cache/scan/methodology-findings.md` from the template at `.groundwork/skills/groundwork-scan/templates/methodology-findings.md`, and close with a **verdict**: `incumbent` when the repo has its own *system* for defining, scaffolding, proving, and delivering work — machinery a GroundWork install would duplicate or collide with; `none` otherwise. The verdict is that collision judgment, not a checklist score. Scattered practices without a system are `none`: a hand-authored doc or an ad-hoc script is carried forward by the extract phases' Adopt/Upgrade mode and needs no convergence phase.

---

## Stage 2: Confirm Scope (the one interview point)

The scan is otherwise autonomous. Confirm two things with the user — three when the ways-of-working verdict is `incumbent` — paced per Protocol 4; keep this tight, you are confirming inferences, not interrogating:

1. **Partition boundaries.** Present the parts you detected and how you intend to partition the scan. The rule is one partition per service or package; a single-service repo partitions per top-level source area instead, and an oversized partition is sub-partitioned in Stage 3. Let the user correct a boundary you read wrong; they know the repo.
2. **Scan depth.** Offer the three depths and recommend one based on repo size and the user's intent:
   - **Quick** — manifests, configs, the README, and contract/route files only; no deep source reading. Right for a first orientation or a very large repo.
   - **Deep** — quick plus every file in the critical directories the project type designates. The default for most repos.
   - **Exhaustive** — every code file except the exclusions. Right when the extract phases must miss nothing.
3. **The way of working you found** — only when Stage 1.6's verdict is `incumbent`. Describe their system back to them in their own vocabulary — how they define work, prove it, and ship it — and let them correct the reading; they run it, you inferred it. Then tell them what the verdict means for setup: the docs phases will build on what they already have rather than beside it, and setup ends with a phase that merges the two ways of working into one, with every change to their existing system needing their approval first.

Record the confirmed partitions and depth in `scan-state.json`. If the user volunteers product, design, or architecture opinions here, capture them under the matching header in `.groundwork/cache/discovery-notes.md` (Protocol 1) and steer back — they belong to the extract phases, not the scan.

---

## Stage 3: Partition & Scan

Each partition yields one **digest** — a structured, capped summary defined in `.groundwork/skills/groundwork-scan/references/digest-schema.md`. Load that schema now; both execution paths produce it identically — a consumer must not be able to tell which path produced a digest. A digest is never raw file contents — it is the interpreted result of reading them.

Branch on the `fan_out` hint.

### Stage 3a: Parallel Fan-Out (`fan_out: parallel`)

Dispatch one scan sub-agent per partition, guided by the structural map so each agent knows its partition's hubs.

- **Bound the fan-out at 8 concurrent sub-agents.** With more partitions than that, run in waves. With a single partition far larger than the rest (a file count or size well beyond its siblings), sub-partition it by sub-directory, or under Quick/Deep depth priority-sample it rather than reading every file. Sampling always includes the contract-bearing files (specs, migrations, config) and the high-centrality modules — rank by `repo-map.json`'s centrality when present; the budget falls on the leaves, never on the contracts. A concurrency cap alone does not bound one oversized partition; handle it explicitly.
- Give each sub-agent its partition root, the reference path to `exclusions.md` (the one exclusion source; never a copied list), the scan depth, the partition's hub symbols from the structural map, and the digest schema — with the instruction to return the structured digest only, never file contents.
- **Assemble without reading files yourself.** As each digest returns, route its fields into the concern-split findings files (below) with `append_file`, update the partition's status and one-line summary in `scan-state.json`, and move on. You never open a source file in the parent context — the sub-agents read; you assemble. This is what keeps the parent lean at full fan-out.

### Stage 3b: Sequential Batch (`fan_out: sequential`)

Scan one partition per batch, resumable across turns. The atomic unit is one partition, so crossing a turn boundary mid-scan is always safe — the next turn reads `scan-state.json` and continues from the first `pending` partition.

For each pending partition:

1. List its files and select what to read per the scan depth and the exclusion/priority rules.
2. Read the selected files.
3. Extract the digest (the same schema as 3a).
4. **Immediately** append the digest's fields to the concern-split findings files.
5. Update the partition's status to `complete` and write its one-line summary in `scan-state.json`.
6. **Purge** the detail from working context — keep only the one-line summary.
7. Move to the next partition.

An oversized single partition is sub-partitioned or priority-sampled exactly as in 3a, so no batch is unbounded.

### Findings Layout (both paths)

Route every digest's fields into these files under `.groundwork/cache/scan/`, each consumed by exactly one downstream phase (Protocol 7). Create them from the templates in `.groundwork/skills/groundwork-scan/templates/` on first write — each template's own header set is the ground truth for what its file holds.

| File | Consumer |
|---|---|
| `scan/overview.md` | all three extracts (shared) |
| `scan/product-findings.md` | `groundwork-product-brief-extract` |
| `scan/design-findings.md` | `groundwork-design-system-extract` |
| `scan/architecture-findings.md` | `groundwork-architecture-extract` |
| `scan/methodology-findings.md` | `groundwork-methodology-adopt` (written by Stage 1.6; partition digests append via `ways_of_working`) |

The digest schema's field-to-file routing is defined alongside the schema in `references/digest-schema.md` — follow it exactly so each extract finds what it expects under its own header.

---

## Stage 4: Finalise

Both paths converge here. Verify every partition in `scan-state.json` is `complete`. Write `scan/overview.md`: the repo shape, the partition map, the canonical-docs location Stage 1.6 established (where the project's own canon lives — the extract phases ingest existing docs from there), and — this matters — an honest **coverage and gaps** note recording what was read fully versus sampled at the chosen depth. A downstream phase that knows a directory was only sampled can ask the user about it; one that assumes full coverage cannot. Silent truncation reads as completeness it did not earn. Set `status: complete` in `scan-state.json`.

Do not delete the findings. They are the durable hand-off the extract phases consume; `groundwork-infra-adopt` deletes the shared scan cache at the end of setup, preserving `scan/methodology-findings.md` when a convergence phase follows — `groundwork-methodology-adopt` deletes that file at its own commit.

---

## Stage 5: Present & Hand Off

1. Present a short summary to the user: the repo shape, the partitions scanned, what each findings slice captured, and any coverage gaps. This is orientation, not a document — keep it brief.
2. **Record completion.** Add `"scan"` to the `completed` array in `.groundwork/config/state.json` — this is the durable marker the orchestrator reads, since the scan leaves no `docs/` artifact to reconcile against. This is the one completion signal; nothing else marks the scan finished. In the same write, record Stage 1.6's verdict as `methodology: "incumbent"` or `"none"` — the orchestrator routes the convergence phase from this field, and only the scan writes it.
3. Capture any out-of-phase signals from the conversation into `.groundwork/cache/discovery-notes.md` (Protocol 1).
4. Immediately load and execute the `groundwork-orchestrator` skill to route to the first extract phase. Do not ask the user to invoke it — hand off automatically.
