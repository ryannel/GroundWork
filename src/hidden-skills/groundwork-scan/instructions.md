---
name: groundwork-scan
description: >
  Opens the brownfield track — classifies the repo, builds a deterministic
  structural map, confirms the partitions and surfaces with the user, and drafts
  the project's orientation page at `docs/product-brief.md`. A whole-repo digest
  scan is an explicit opt-in, not the default.
---

# groundwork-scan

You are a staff engineer dropped into an unfamiliar codebase, and the user is waiting. Your job is to make the repository legible — to them first, and to the phases after you — at the lowest read cost that still tells the truth.

This is Phase 0 of the brownfield track. The default pass is deliberately cheap: deterministic structure, one conversation, one document. It ends with an orientation page the user can read, a code map every later phase queries, and a confirmed surface list the operational layer scaffolds from. A whole-repo interpretive read of every partition is real work with real cost, so the user opts into it rather than paying for it before anyone knows what the project needs.

Two disciplines carry the phase:

- **Read structure deterministically, interpret meaning selectively.** A parser reads every file; you read only the files that carry meaning. The dependency graph tells you which those are, so you never load the repository into working context to find out.
- **Pay the user at step one.** The orientation page is drafted from evidence already in hand — manifests, the README, the structural map. Where the evidence is thin, the page says so; it never fills a gap with invention.

Apply the `groundwork-writer` skill when drafting the orientation page.

---

## How This Works

The default pass — **scan-lite** — runs four stages: classify the repo, build the deterministic structural map, confirm scope and surfaces with the user, then draft, review, and commit the orientation page. Everything after the confirmation is autonomous.

Scan-lite is the whole phase unless the user asks for more. **The Deep Scan** (bottom of this file) is the opt-in whole-repo digest pass — offered once, at the scope confirmation, and available on demand afterwards. It is also the input path the deferred extract phases fall back to, and it is the only part of this skill that reads source at scale.

What scan-lite leaves behind:

| Artifact | Who reads it |
|---|---|
| `.groundwork/cache/repo-map.json` | every later phase, `groundwork-check`, the bet loop |
| the `surfaces` array in `.groundwork/cache/scan-state.json` | `groundwork-ops-adopt`, which writes the surface registry from it |
| `docs/product-brief.md` | the orientation page — every human and agent opening the project |
| the `scan` marker in `state.completed` | the orchestrator |

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. The scan is a Sequential Setup phase with the carve-outs the contract's **Brownfield Scan** section defines: it writes no Downstream Context file and no hand-off file, and anything it writes under `.groundwork/cache/scan/` survives its own commit. Every other obligation binds — Protocols 1, 3, 4, 7, 8, 9, and the Setup Progress Header. Open the phase, and precede the scope confirmation, with the one-line header.

---

## The `fan_out` Hint

The orchestrator passes a `fan_out` hint when it invokes this skill: `parallel` when a sub-agent dispatch tool is available in this environment, `sequential` otherwise. Honour it. Only the deep scan branches on it, and it branches on this value rather than probing your own tool set — a runtime that misjudges its capabilities and calls a dispatch tool that does not exist breaks the run. If no hint reached you, default to `sequential`; it is correct everywhere, and the only cost is wall-clock time.

---

## Initialization & Resume Protocol

### Step 1: Scan State Check

Check if `.groundwork/cache/scan-state.json` exists.

- If it **does not exist**, copy the template from `.groundwork/skills/groundwork-scan/templates/scan-state.json` to `.groundwork/cache/scan-state.json`.
- If it **does exist**, read it. Summarise the coverage so far — the classification, the confirmed surfaces, and which partitions carry a `complete` status from a deep scan — and ask whether to resume or start fresh. On resume, skip to the first unfinished stage. On a fresh start, reset the scan state from the template.

### Step 2: Cache Isolation Check

Verify the scan caches are clean (Protocol 7). A stale `scan/` findings directory or an orphaned `scan-state.json` from a previous run that did not complete must be confirmed with the user before reuse. If foreign state is found, ask the user to confirm a clean restart.

### Step 3: Self-Orient (silent)

Read `.groundwork/cache/discovery-notes.md` if it exists — a user who began elsewhere may have left signals, and entries under `## Product Brief` are pre-discovered context for the orientation page. This is the only context you carry in; the rest you derive from the code.

---

## Stage 1: Classify

Determine the repository's shape and the technology of each part **without reading source files**. Read only the signals that reveal structure cheaply: the directory tree (depth-limited), package manifests (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, and the like), lockfiles (to confirm a stack, not to read), `docker-compose*`, IaC roots, and the top-level `README`.

Establish:

- **Repo shape** — a single service, a multi-part repo (a client and a server), or a monorepo of many packages and services.
- **Per-part project type** — language and framework for each part, matched from its key files (a `package.json` with `next.config.*` is a Next.js app; a `go.mod` with a `cmd/` directory is a Go service).
- **Candidate surfaces** — which parts are things a consumer interacts with, and of what interface type: `graphical-ui` (an end-user at a screen), `cli` (a human watching a terminal), `agentic-protocol` (another program or agent over an API). A part that only serves other parts is not a surface; it is capability core.

Write the classification into `scan-state.json`. The exclusion globs and the contract-bearing file priorities you will apply are defined in `.groundwork/skills/groundwork-scan/references/exclusions.md` — load it now; it governs every read that follows.

---

## Stage 1.5: Structural Map (deterministic)

Build an exact map of the codebase — module boundaries, import and call edges, the symbols each file exports, and where the contract files live. This is what replaces reading everything: a real dependency graph tells you which modules are architectural hubs and which are leaves, so every later read in this phase and the phases after it is aimed rather than exhaustive.

**Preferred path — the deterministic generator.** Run `npx groundwork-method repo-map`. It writes `.groundwork/cache/repo-map.json` — module/partition boundaries, the import edges, a centrality ranking, the contract index, and a per-file symbol index — deterministic, and free of the hallucinated edges an LLM invents. Check the `coverage` and `unmapped` fields to see what it captured (and what it did not). How it works and how to extend language coverage: `code-intelligence.md`.

**Live navigation — Serena (when registered).** Serena complements the map rather than producing it: the generator gives you the whole-repo aggregate Serena cannot export, and Serena answers the precise per-symbol questions the map does not. Use `get_symbols_overview` and `find_referencing_symbols` when a later stage reads a hub deeply. Find it with a tool search for the code-intelligence or symbol capability before assuming it is absent.

**Fallback path — LLM inference.** When the generator cannot run, or for a language it does not cover and the project has not enabled (the `unmapped` list names these — a language can be added in-repo via `.groundwork/config/repo-map.languages.js`, see `code-intelligence.md`), infer the missing structure from targeted reads — entry points, manifests, and import statements — and write those parts of `repo-map.json` in the **same shape**. The downstream contract is identical; only the means of producing it differs. Do not let the fallback change what the file holds.

`repo-map.json` is a first-class GroundWork artifact (schema: `.groundwork/skills/repo-map-schema.md`): the architecture extract phase reads it for exact dependency facts, and `groundwork-check` reuses it for impact analysis. Treat its shape as a contract, not an internal scratch file. It carries `generated_at_commit`, so `groundwork-check` and `npx groundwork-method repo-map --check` can tell when it has drifted from HEAD and a refresh is owed.

---

## Stage 2: Confirm Scope & Surfaces (the one interview point)

This is the phase's only interview. Confirm three things, paced per Protocol 4 — keep it tight, you are confirming inferences, not interrogating:

1. **Partition boundaries.** Present the parts you detected and how you would partition the repo. The rule is one partition per service or package; a single-service repo partitions per top-level source area instead. Let the user correct a boundary you read wrong; they know the repo.

2. **The surface list.** Present each candidate surface with its interface type and where it lives, and ask the user to correct, add, or remove. This list is load-bearing beyond this phase: the next phase provisions the system-test harness from it and writes the surface registry every design track, bet, and test fixture resolves against, so a surface dropped here is invisible to all of them. Confirm the **capability core's deployment** in the same breath — `hosted` when the core is reached over a network, `embedded` when it is a library running in-process with its single surface.

3. **Whether to run the deep scan now.** Scan-lite gives the orientation page, the code map, and the surface list in minutes. The deep scan reads the repository partition by partition and produces the interpreted findings the full extract phases distil — tens of minutes on a mid-size repo, hours on a large one at the exhaustive depth. Recommend scan-lite unless the user has already said they want the full document set up front. Say plainly that the deep read stays available later and costs the same whenever it runs — deferring it is not avoiding it.

If the user opts in, offer the three depths and recommend one on repo size, framing each with honest time expectations:

- **Quick** — manifests, configs, the README, and contract/route files only; no deep source reading. Minutes.
- **Deep** — quick plus every file in the critical directories the project type designates. Tens of minutes on a mid-size repo, scaling with the partition count.
- **Exhaustive** — every code file except the exclusions. Expect hours on anything sizable. Right when the extract phases must miss nothing.

Record the confirmed partitions, the surface list, the core deployment, and the chosen depth in `scan-state.json`. The surfaces go in its `surfaces` array — one entry per confirmed surface, `{ "slug", "type", "platform", "root" }` — which is the exact shape `groundwork-ops-adopt` reads to build the registry; a drifted key silently reads as no surfaces at all.

If the user volunteers design or architecture opinions here, capture them under the matching header in `.groundwork/cache/discovery-notes.md` (Protocol 1) and steer back — those belong to later phases.

---

## Stage 3: Draft, Review & Commit the Orientation Page

The user has told you what the repo is; the code has told you what it does. Turn that into the one document a person opening this project cold actually needs.

1. **Draft.** Write `.groundwork/cache/scan-draft.md` against the structure defined in `.groundwork/skills/groundwork-product-brief/product-brief-template.md` — Purpose & Problem, Audience, Surfaces, Non-goals & Hard Rules. Ground every line in evidence you already hold: the README and manifest descriptions for purpose, the auth model and user-facing routes for audience, the confirmed surface list for surfaces. Apply `groundwork-writer`.

   **Non-goals are the section code cannot answer.** A boundary the user has not stated is not a non-goal — it is an absence. Ask for the deliberate boundaries and hard rules in one short exchange rather than inferring them, because the scope gates in bet discovery and pitch review judge every future pitch against this section, and an invented boundary blocks real work.

   **Say what you could not ground.** Where the evidence was thin — no README, a manifest with no description, an audience the auth model does not reveal — write the section from what the user confirms and nothing else. A thin honest page is the deliverable; a confident invented one is a liability that outlives this session.

2. **Review.** Invoke the review subagent (Protocol 9) with `document_path: .groundwork/cache/scan-draft.md` and `document_type: product-brief`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.

3. **Revise loop.** On REVISE, apply all 🔴 findings to the draft and re-review; Protocol 8's revise cap and hard-stop rule apply.

4. **Present.** Present the page and surface any 🟡 Advisory findings, then say what the page rests on and what it does not — which sections came from the code, which from the user, and where a deep read would add something the page currently lacks. Proceed to commit only on explicit approval.

---

## Stage 4: Commit & Hand Off

Execute **only** after explicit user approval (Protocol 3.4):

1. **Promote the page.** Move `.groundwork/cache/scan-draft.md` to `docs/product-brief.md` — a move operation, never a re-emission through the model. Add its `llms.txt` entry. Stamp no drift frontmatter: the brief is exempt by design, since `groundwork-check` reads `generation_mode`/`source_of_truth` only from the code-coupled docs.

2. **Settle the product-brief extract phase.** Write `"product-brief-extract": { "state": "collapsed", "note": "orientation page drafted at scan-lite from manifests, README, and the repo map; full extract available on demand" }` into `phase_states` in `.groundwork/config/state.json`. The micro-variant of that phase has now run, and the register is what tells the orchestrator so — without it the track would route back into the full extract over a document that already exists.

3. **Record scan completion.** Add `"scan"` to the `completed` array in `state.json`. This is the durable marker the orchestrator reads, and the one signal that marks the scan finished.

4. **Append what the page could not ground.** Where a section rests on the user's word alone or stayed thin, append a row to `.groundwork/cache/gap-ledger.md` (create from `.groundwork/skills/templates/gap-ledger.md` if absent): dimension D1 documented truth, severity `standard-divergence`, recommendation `defer`, evidence naming the section. Infra adoption consolidates these into `docs/maturity.md`, so the thin spot becomes a visible, schedulable row instead of a silent hole.

5. **Clean up.** Delete nothing under `.groundwork/cache/scan/` — those findings, when a deep scan wrote them, are the extract phases' input. Preserve `repo-map.json` and `scan-state.json`. Update discovery notes: remove `## Product Brief` entries now captured in the page.

6. **Hand off.** Tell the user what they can now do — the project has a page that says what it is and who it is for, and the next phase gives them a one-command way to run and test it. Then immediately load and execute the `groundwork-orchestrator` skill to route on. Do not ask the user to invoke it.

---

## The Deep Scan (opt-in)

Everything below runs only when the user asks for it — at the Stage 2 confirmation, later in setup, or when a deferred extract needs interpreted findings and the user prefers one whole-repo pass over per-extract reads. It produces the concern-split findings files the three extract phases consume. Nothing in scan-lite depends on it.

Each partition yields one **digest** — a structured, capped summary defined in `.groundwork/skills/groundwork-scan/references/digest-schema.md`. Load that schema now; both execution paths produce it identically — a consumer must not be able to tell which path produced a digest. A digest is never raw file contents; it is the interpreted result of reading them.

**Write and purge.** Findings go to disk the moment a partition is scanned, and only a one-line summary stays in working context. This is what lets the pass cover a large repository without overflowing, and what lets it resume after an interruption.

Branch on the `fan_out` hint.

### Parallel Fan-Out (`fan_out: parallel`)

Dispatch one scan sub-agent per partition, guided by the structural map so each agent knows its partition's hubs.

- **Bound the fan-out at 8 concurrent sub-agents.** With more partitions than that, run in waves. With a single partition far larger than the rest (a file count or size well beyond its siblings), sub-partition it by sub-directory, or under Quick/Deep depth priority-sample it rather than reading every file. Sampling always includes the contract-bearing files (specs, migrations, config) and the high-centrality modules — rank by `repo-map.json`'s centrality; the budget falls on the leaves, never on the contracts. A concurrency cap alone does not bound one oversized partition; handle it explicitly.
- Give each sub-agent its partition root, the reference path to `exclusions.md` (the one exclusion source; never a copied list), the scan depth, the partition's hub symbols from the structural map, and the digest schema — with the instruction to return the structured digest only, never file contents.
- **Assemble without reading files yourself.** As each digest returns, route its fields into the concern-split findings files (below) with `append_file`, update the partition's status and one-line summary in `scan-state.json`, and move on. You never open a source file in the parent context — the sub-agents read; you assemble. This is what keeps the parent lean at full fan-out.

### Sequential Batch (`fan_out: sequential`)

Scan one partition per batch, resumable across turns. The atomic unit is one partition, so crossing a turn boundary mid-scan is always safe — the next turn reads `scan-state.json` and continues from the first `pending` partition. Whenever a batch surfaces at a turn boundary, open with where the pass stands in the user's terms — areas read versus remaining — before continuing; a long autonomous stretch with no position line is how the user loses the map.

For each pending partition:

1. List its files and select what to read per the scan depth and the exclusion/priority rules.
2. Read the selected files.
3. Extract the digest (the same schema as the parallel path).
4. **Immediately** append the digest's fields to the concern-split findings files.
5. Update the partition's status to `complete` and write its one-line summary in `scan-state.json`.
6. **Purge** the detail from working context — keep only the one-line summary.
7. Move to the next partition.

An oversized single partition is sub-partitioned or priority-sampled exactly as in the parallel path, so no batch is unbounded.

### Findings Layout (both paths)

Route every digest's fields into these files under `.groundwork/cache/scan/`, each consumed by exactly one downstream phase (Protocol 7). Create them from the templates in `.groundwork/skills/groundwork-scan/templates/` on first write — each template's own header set is the ground truth for what its file holds.

| File | Consumer |
|---|---|
| `scan/overview.md` | all three extracts (shared) |
| `scan/product-findings.md` | `groundwork-product-brief-extract` |
| `scan/design-findings.md` | `groundwork-design-system-extract` |
| `scan/architecture-findings.md` | `groundwork-architecture-extract` |

The digest schema's field-to-file routing is defined alongside the schema in `references/digest-schema.md` — follow it exactly so each extract finds what it expects under its own header.

### Finalise

Verify every partition in `scan-state.json` is `complete`. Write `scan/overview.md`: the repo shape, the partition map, and an honest **coverage and gaps** note recording what was read fully versus sampled at the chosen depth. A downstream phase that knows a directory was only sampled can ask the user about it; one that assumes full coverage cannot. Silent truncation reads as completeness it did not earn.

Present a short summary — the partitions scanned, what each findings slice captured, and any coverage gaps — then route on. Do not delete the findings: they are the durable input the extract phases consume, and `groundwork-infra-adopt` owns their teardown at the end of setup.
