---
name: maturity-model
version: "1"
description: >
  Defines GroundWork's target state as nine named maturity dimensions — what each one is,
  the failure it prevents, and the signal that assesses it — plus the lifecycle of the living
  maturity roadmap (docs/maturity.md) that tracks a project's distance from that state.
---

# The GroundWork Maturity Model

GroundWork's end state is not "the docs exist." It is a system where documentation, contracts, operations, and verification reinforce each other tightly enough that an AI agent can deliver work inside explicit constraints — and a human can trust the result. This file names that target state as nine dimensions so it can be assessed, tracked, and steered toward, one bet at a time.

**The model informs and guides; it never forces.** Every gap names the dimension it blocks and the concrete cost of leaving it open, so the user can weigh maturity work against product work with full information. The user's decision to defer — or to permanently accept — a gap is recorded and respected, not re-litigated every session. A project that consciously accepts a gap is healthier than one nagged into resentment.

Every project carries a living `docs/maturity.md` (template: `.agents/groundwork/skills/templates/maturity.md`): the current assessment against the nine dimensions, and the roadmap of open gaps. Greenfield projects are born near the target and use the doc to track the dimensions that need ongoing discipline; brownfield projects start with an honest distance and close it incrementally.

---

## The Nine Dimensions

Each dimension states what it is, the failure it prevents, and the mechanical signal that assesses it (where one exists — judgement-based dimensions say so).

### D1. Documented truth

The canonical doc set — `docs/product-brief.md`, `docs/design-system.md`, `docs/architecture.md`, `docs/infrastructure.md` — exists, carries the GroundWork contract (`## Summary for Downstream`, frontmatter), and describes the system as it currently is.

**Failure it prevents:** every agent session re-derives context from raw code, makes a different guess, and starts from wrong foundations — the defect class GroundWork exists to eliminate.
**Signal:** the four docs exist with populated summary sections; `npx groundwork-method check` exits 0.

### D2. Machine-readable contracts

Every service boundary exposes a pinned, machine-readable contract — OpenAPI, AsyncAPI, or proto — and `docs/api/*.md` transcribes from it.

**Failure it prevents:** agents invent API shapes mid-implementation; integration defects surface at runtime instead of design time; bet decomposition cannot define slices that are testable before anything consumes them.
**Signal:** every service named in `docs/architecture.md` has a contract file referenced from its `docs/api/<service>.md`.

### D3. One-command operations

The repository boots with one command. The `./dev` CLI exists; the Docker topology starts and passes health checks; migrations and tests run through the same surface.

**Failure it prevents:** bespoke run instructions per service rot independently; agents burn their context discovering how to start the system instead of changing it; delivery validation cannot boot what it is validating.
**Signal:** `./dev` exists at the repo root; `./dev start` brings services to healthy.

### D4. System-level proof

A system-test harness runs inside the boot topology, and bets author their progress tests red, up front. Progress is something a test turns green, not something a conversation asserts.

**Failure it prevents:** cross-service regressions ship invisibly; "done" means "the agent said so."
**Signal:** the system-test runner is present and its suite passes against the booted topology.

### D5. Code intelligence

A current `repo-map.json` exists — built by the deterministic generator (`npx groundwork-method repo-map`: tree-sitter import edges + PageRank centrality) — and the Serena MCP server is registered for live per-symbol navigation. Together they give every scan, impact analysis, and drift check a structural map: the generator for the whole-repo aggregate, Serena for precise on-demand lookups.

**Failure it prevents:** structural questions fall back to LLM inference — slower, costlier, and hallucination-prone exactly where precision matters most.
**Signal:** `.groundwork/cache/repo-map.json` exists and is regenerable on demand via `npx groundwork-method repo-map` (deterministic, no network); `.mcp.json` registers Serena. The map carries `generated_at_commit`, so `npx groundwork-method repo-map --check` reports whether it is current with HEAD.

### D6. Doc currency automation

`groundwork check` runs in CI, so doc/code drift is caught at the pull request that causes it.

**Failure it prevents:** drift accumulates silently until the doc set decays back into fiction and D1 collapses.
**Signal:** a CI configuration invokes `groundwork check` (or the `groundwork-check` skill).

### D7. Delivery discipline

Work flows through bets: a problem paired with an appetite, decomposed into contract-defined slices, with canonical-doc changes passing the review gate. This dimension is behavioral — it is about how the team works, not what is installed.

**Failure it prevents:** ad-hoc changes bypass the gates and the architecture erodes one hotfix at a time — each individually reasonable, collectively unaccountable.
**Signal:** judgement-based. Evidence: `docs/bets/` shows pitches progressing through statuses; recent doc commits trace to bets or `groundwork-update` runs.

### D8. Surface parity discipline

The surface registry and capability ledger (`docs/surfaces.md` with its machine twin `.groundwork/surfaces.json`) describe the product as it is: the two projections agree, every capability row fills every surface column, and `planned` cells move — drawn into bets or consciously re-triaged to `omitted` or `n/a` — rather than aging in place.

**Failure it prevents:** capabilities ship on one surface and silently never reach the others; divergence between surfaces stops being a decision on record and becomes drift nobody chose.
**Signal:** `./dev surface status` renders with zero twin drift and zero empty cells; no `planned` cell is older than three closed bets without a referencing pitch (the `groundwork-check` staleness threshold). A project with no surface registry assesses this dimension `n/a`.

### D9. Contract compatibility

Once two or more surfaces deploy independently — a web app ships continuously while a mobile fleet lags releases by months — published contracts outlive any single deploy. The architecture carries a versioning/compatibility stance as a Binding Constraint ("we never break a published contract field" is the common shape), and the contract drift gates honor it: the generated contract-conformance tests treat breaking drift from the promoted specs as failure and additive drift as a stale-spec warning.

**Failure it prevents:** a contract change that is a refactor for the fastest-shipping surface becomes an incident for every fleet that has not shipped yet.
**Signal:** the stance appears under Binding Constraints in `docs/architecture.md`; the contract-conformance system tests report no breaking drift against the promoted specs in `docs/api/`. Below two independently deployed surfaces this dimension assesses `n/a` — it activates the moment the second one registers.

---

## Assessment levels

Each dimension is assessed as one of three states — or recorded `n/a` when its precondition does not hold — always with evidence:

| State | Meaning |
|---|---|
| ✅ met | The signal holds now. |
| 🟡 partial | Some of the dimension holds — name exactly which part does not. |
| 🔴 absent | The dimension's signal fails outright. |
| `n/a` | The dimension's precondition does not hold — D8 on a project with no surface registry, D9 below two independently deployed surfaces. Name the precondition in the evidence; the dimension re-enters assessment the moment it arrives. |

`n/a` is reserved for the conditional dimensions (D8, D9). It records a precondition that does not hold, never a gap left unassessed.

An assessment row without evidence is an opinion. Cite the file, command output, or absence that justifies the state.

## The roadmap

Gaps discovered anywhere — the brownfield gap ledger, a bet's validation, a `groundwork-check` run, an update run — become rows in the roadmap table of `docs/maturity.md`. Severity and recommendation reuse the gap-ledger tiers exactly (identifier drift between the ledger and the roadmap would orphan entries):

- **Severity:** `blocks-delivery` | `standard-divergence` | `cosmetic`
- **Recommendation:** `fix-now` | `defer` | `blocks-delivery`
- **Status:** `open` | `in-bet (<slug>)` | `closed (<slug>)` | `accepted`

`accepted` is a first-class outcome: the user has decided, with the cost in front of them, that this gap stays. Record who accepted it and why in the row's notes. Skills do not re-propose `accepted` gaps unless the user reopens them or the gap's severity escalates.

## Who writes what, when

| Actor | Responsibility |
|---|---|
| `groundwork-infra-adopt` (brownfield) | Writes the initial `docs/maturity.md`: first assessment plus the consolidated gap ledger as roadmap rows. |
| `groundwork-scaffold` (greenfield) | Writes the initial `docs/maturity.md` at commit — mostly ✅, with the discipline dimensions (D6, D7) opened as rows where not yet wired. |
| `groundwork-bet` discovery | Reads the roadmap; proposes pulling open `fix-now`/`blocks-delivery` rows into the bet, framing the trade-off. Never forces. |
| `groundwork-bet` validation | Marks rows the bet closed (`closed (<slug>)`), re-assesses affected dimensions, re-stamps the doc. |
| `groundwork-check` | Re-evaluates the mechanical signals (D1–D6, plus D8's registry and ledger signals) and flags roadmap rows whose status disagrees with observed state. |
| `groundwork-update` | Adds rows when shipped changes open new gaps (e.g. a new service without a contract). |

`docs/maturity.md` is a canonical doc: it opens with a `## Summary for Downstream`, is review-gated with `document_type: maturity`, and is indexed in `llms.txt`.
