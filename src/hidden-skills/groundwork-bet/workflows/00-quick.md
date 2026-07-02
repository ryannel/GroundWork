# Quick Bet: the compressed track

**Goal:** Deliver one small new capability — a single user-visible step touching at most a local, non-structural contract delta — at small-work speed, without losing the rigor that makes a bet honest. The quick bet is the **middle depth** of the three delivery lanes (patch · quick bet · bet). It is not a slimmer patch; it is a *compressed bet* — it touches every dimension a bet touches (what and why, UX, architecture and data, the front-door proof), but as one focused pass authored into a single reviewable plan instead of five gated phases, and it proves **exactly one milestone**, then hands that milestone to the bet's own delivery machinery.

This track exists because the five-phase bet splits modes — discovery, design, decomposition — *because at bet scale, holding them all at once produces shallow work in each*. At quick-bet scale the whole change fits in one sitting, so one AI-driven pass holds every dimension without going shallow. What it must not compress is the **proof and the gate**: the quick bet still drives the real product through its real front door, still earns an independent review verdict before it is sealed, and still delivers test-first. Compress the prose, never the gate.

## When you are here

The orchestrator's Work Intake triage sized the request as a quick bet and routed here (`lane: quick-bet`), or you are resuming a quick bet whose pitch carries `status: quick`, `track: quick`. If you are not certain the ask is quick-bet-sized, run the scope test below first — sizing on the phrasing of a request is a guess until the code is read, and the cheapest correction is the early one.

## Operating Contract

This workflow operates under the protocols in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, 9 apply). Apply `groundwork-writer` to every artifact this track commits — declarative, assertive, zero-hedging. The bet's design-side personas are adopted here exactly as in a full bet, just lighter: the **product** persona when judging whether the one capability is worth it, the **designer** when the change is user-facing, the **architect** when the contract delta is in play.

## The flow

### 1. Scope test — confirm this is a quick bet

A quick bet sits between the two neighbours; confirm it is neither:

- **Not a patch.** A patch has no new capability and changes no contract (`groundwork-patch`'s scope test). If the ask is really a fix, a copy tweak, or a one-line refinement with no new user-facing capability, **demote to `groundwork-patch`** — carrying what you learned as its scope note.
- **Not a bet.** A bet spans more than one demonstrable milestone, or changes a contract structurally or across services. If the ask needs a ladder of user-visible steps, a structural API/data change, or work that will not fit one sitting, **escalate to a full bet** — route to `groundwork-bet` discovery, handing the request and any notes as discovery input.

A quick bet is the remainder: **one** new user-visible capability, deliverable in one sitting, touching at most a local, non-structural contract delta (one endpoint or field, additively). When it qualifies, create the bet slug with the user (e.g. `delete-image`) and open `docs/bets/<slug>/`; set the pitch frontmatter `status: quick`, `track: quick` so a fresh context resumes here.

### 2. Clarify — one tight pass

Ask the few questions that actually change the design, clustered into one turn and led by your proposed reading of the ask (Protocol 4; propose-first, never a questionnaire). Skip this entirely when the request is already unambiguous — a quick bet should not spend a round-trip it does not need.

### 3. Discover — read the tech yourself

This is the AI-driven core. Orient in the code rather than asking the user to describe it: build or read the repo map (`npx groundwork-method repo-map`; `find_referencing_symbols` for the call sites the change touches), read the surface the capability lives in and the existing patterns it must match, read `docs/design-system.md` for the tokens and components it will reuse, and read the touched service's current contract (`docs/architecture/api/<service>/` and the relevant `docs/architecture/` notes). A quick bet **leans on what exists** — the design system, the established patterns, the current contract — and adds the smallest coherent increment. Reuse over invention is the whole economy of this lane.

### 4. Re-size — now that you have read the code

Sizing in Step 1 was on the request's words; you now know the code. Re-judge before spending the user's approval: does the change cascade past one capability or one sitting? "Add a delete button" can hide soft-versus-hard delete, storage cleanup, reference integrity, permissions, an audit trail. If discovery shows the work is genuinely bet-sized, **escalate to a full bet now**, before authoring a plan the change has already outgrown — promoting early is cheap, discovering it at validation is not. If it shrank to no design at all, demote to a patch.

### 5. Author the plan — the delivery contract, directly

The quick bet's single approval artifact **is** the contract the delivery machinery reads — so author the real shapes at their real paths, compressed in prose but complete in the fields delivery and its gates depend on. There is no separate plan document to translate later; this *is* the plan, and the user approves it as one pass.

Under `docs/bets/<slug>/`, author:

- **`pitch.md`** — frontmatter `status: quick`, `track: quick`, and `surfaces:` listing the in-scope registry slugs when the project carries a surface registry (`docs/surfaces.md`). Body, one short paragraph each: the **problem and the one user-facing outcome**; the **appetite** stated as small (one sitting) with explicit **no-gos** — the natural extensions this quick bet deliberately does not do, the guard that keeps it from growing silently.
- **`technical-design/`** — the design at the fidelity delivery's gates read, a paragraph per file, but with the shapes concrete:
  - `01-ui-design.md` — for a user-facing change: what the user sees and does, the states (loading, empty, error, active), and the **existing design-system patterns and tokens it reuses** (name them; do not invent a new visual language). Carry the per-screen micro-polish note Tier 2 inspects.
  - `02-data-flows.md` — a stub is enough when the flow is trivial (a sentence and, if it helps, one small mermaid sequence); it must exist because the decomposition's slice `Design` sections reference it.
  - `03-api-design.md` — the touched endpoint(s) at **field-level fidelity**: the request shape, the response shape with field names and types, and the **error and status cases the proof depends on**. This is what the acceptance-auditor holds the implementation to at delivery and what the readiness gate requires every proof shape to trace to — a vague paragraph fails both. Keep the delta local and additive; a structural change is the escalation signal from Step 4.
  - `04-data-design.md` — any touched store: the table/collection, the key fields and types, and any lifecycle state the capability introduces.
- **`decomposition/`** — one milestone, sliced, using the templates under `templates/decomposition/`:
  - `meta.json` — sidebar order and title (the readiness gate requires it).
  - `01-<milestone-slug>/index.md` — the single milestone (`templates/decomposition/milestone-index.md`): the **consumer** and what they observe, the **demonstrable goal**, the **acceptance criteria** (the agreed front-door cases), and the **Proof of work** — `Proves`, `How we prove it` driving the real shipping build through the real front door (no stub, mock, or hardcoded return satisfies it; any fake leans on a real test behind it), and a named `Test file:` at `tests/bets/<slug>/test_milestone_1_<milestone-slug>.<ext>`. One milestone is the *definition* of a quick bet — the "2–5 milestones" guidance is gated off for `track: quick`; do not pad the ladder to satisfy it.
  - `01-<milestone-slug>/NN-<slice-slug>.md` — one or a few **vertical slices** (`templates/decomposition/slice.md`): owner service, complexity, prerequisite, **Surface** (`core` or a registry slug), **Scope** with falsifiable Required Capabilities each tracing to `03-api-design.md` or `04-data-design.md`, **Design**, and **Proof of work** with its own `Test file:` at `tests/bets/<slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`, `<N>` numbered sequentially across the bet's slices (the shipped `./dev new slice` assigns it). A quick bet's slices are authored now — there is no later milestone to defer to.

Discover the test language and service names from the scaffold (`docs/architecture/infrastructure.md`, `docker-compose.yml`) so every `Test file:` path names the right extension and owner — do not hardcode.

### 6. Review — earn the verdict before sealing

The quick bet compresses the prose, not the gate. Assemble the decomposition tree and run the independent review (Protocol 9), exactly as a full decomposition does:

```
find docs/bets/<slug>/decomposition -name '*.md' | sort | xargs cat > /tmp/<slug>-decomposition.md
```

Invoke the review subagent with `document_path: /tmp/<slug>-decomposition.md` and `document_type: decomposition`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`. On `REVISE`, apply every 🔴 finding to the affected file, re-assemble, and re-run (hard cap of 3, per Protocol 8). This verdict is what clears the readiness gate's *Unreviewed artifact* 🔴 at delivery, and its document-chain-integrity checks are the authoring-time depth floor that stops a compressed contract from being authored shallow — every proof shape must trace to `03-api-design.md` / `04-data-design.md`. Clean up the assembled file when the review settles.

### 7. Approve, seal, and hand to delivery

Walk the user through the plan in one pass — the outcome and its UX, the local contract delta, and the front-door proof — and get their approval. This is the quick bet's **single gate**; after it, delivery runs to a green milestone on its own (hard stops still pause).

On approval:

1. Flip the pitch frontmatter to `status: delivery`, `track: quick`.
2. **Seal the baseline.** Commit the approved contract — `docs/bets/<slug>/decomposition/` together with the finalized `technical-design/` and `pitch.md` (`bet(<slug>): approve quick bet`) — and, under git, tag that commit `bet/<slug>/approved`. The readiness gate requires both the review verdict and the tag; the tag is the sealed baseline delivery's prose-integrity reconciliation holds the prose to.
3. **Hand to the delivery machinery.** Route to `04-delivery.md` and run it unchanged. Delivery materializes the red board from this approved prose, drives the one milestone green through the slice-worker and the review lenses, and proves it at the front door. The `track: quick` markers tell delivery and validation to run at quick depth (one milestone is legal; the heaviest milestone-close and validation steps are scoped down) while keeping the UX floor and the honest-green discipline intact.

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/04-delivery.md`
