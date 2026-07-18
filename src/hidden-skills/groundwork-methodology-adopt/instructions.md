---
name: groundwork-methodology-adopt
description: >
  Converges a repo's incumbent delivery methodology with GroundWork so setup ends
  with one way of working, not two. Runs as the conditional final brownfield phase
  when the scan's ways-of-working inventory recorded `methodology: "incumbent"`:
  absorbs the inventory, builds a disposition map with the owner, takes one
  structured go/veto pass, then executes the sanctioned units at work-unit
  boundaries. The only skill with owner-approved authority to convert or retire
  incumbent methodology artifacts.
---

# groundwork-methodology-adopt

You are a staff engineer merging two working methodologies into one. The repo already runs its own system for defining, scaffolding, proving, and shipping work — the scan inventoried it — and the setup phases before you added GroundWork's canon and operational layer beside it, additively. Left here, the project has two of everything: two scaffolders, two proof conventions, two canons, two entry points. Your job is to end setup with **one** way of working that carries forward everything the incumbent system got right.

Treat the incumbent methodology as prior art, not debris. A team that hand-built a delivery system encoded real knowledge in it — its work-unit boundaries, its proof conventions, its templates, its routing. Convergence preserves that knowledge in GroundWork homes; it never bulldozes it.

**This file gives you the goal, the invariants, and the decision points — not recipes.** Incumbent methodologies come in unbounded forms, and no catalogue of them exists or should: the inventory plus your own exploration is the ground truth, and you author the convergence plan for this repo. The owner sanctions that plan in one ruling pass, and the sanctioned rows are your entire license.

---

## The end state

The phase is done when each of these holds, proven with evidence, not asserted:

- **One entry point.** The repo's agent routing reaches the orchestrator; incumbent routing content is merged or deliberately kept, never orphaned.
- **One scaffolder.** A single dev CLI owns process automation — incumbent verbs ported, retired, or deliberately kept as extensions. Nothing half-alive.
- **One proof convention.** New work is proven GroundWork's way; incumbent proof suites are converted or preserved as history — never silently dual.
- **One canonical home.** Old canon locations are retired or deliberately redirected; no duplicate canon.
- **No fractured work.** Every in-flight incumbent unit was finished natively or frozen at a boundary and converted — never split mid-unit.
- **Knowledge preserved.** The incumbent's methodology docs, decision history, and templates live on in GroundWork homes, or were retired with the owner's ruling.
- **Nothing unowned.** No incumbent machinery — sync pipelines, CI hooks, scheduled jobs — still runs without an owner's decision that it should.

"Deliberately" is load-bearing throughout: keeping incumbent machinery is a legitimate outcome — wired in as a `config.toml` `[skills]` route, a policy fact, or a dev-CLI extension — when the owner rules it so. The failure mode is machinery nobody decided about.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase — the final one when present. Protocols 1 (Discovery Notes), 3 (Phase Lifecycle), 4 (Pacing), 5 (Downstream Context), 8 and 9 (Review Gate + Invocation, for every canonical doc a unit mutates), 12 (Draft Presentation — the map is an approval-gated document), and 13 (Structured Rulings — the sanction pass) apply. Under the Protocol 7 brownfield exception it reads `scan/methodology-findings.md` (its own findings slice), `scan/overview.md` where still present, `repo-map.json`, and the committed doc set including `docs/maturity.md`. The phase cache lives at `.groundwork/cache/convergence/`.

Apply the `groundwork-writer` skill when producing any output document.

### The `fan_out` hint

The orchestrator passes a `fan_out` hint (`parallel` when a sub-agent dispatch tool is available in this environment, `sequential` otherwise; default `sequential` if none reached you) — honour it rather than probing your own tool set, since a runtime that misjudges its capabilities and calls a dispatch tool that does not exist breaks the run. `parallel` → dispatch each execution unit to a `convergence-worker` subagent at the `execution` tier, model set explicitly (Model Tiers, operating contract; an omitted model silently inherits the driver's and defeats the tiering), gated at `frontier` by your review before commit. `sequential` → advance each unit inline, one at a time, purging the unit's detail from context before the next.

---

## Initialization & Resume

Create `.groundwork/cache/convergence/` and copy `.groundwork/skills/groundwork-methodology-adopt/templates/convergence-map.md` to `.groundwork/cache/convergence/map.md` if absent. On resume, read the map: an approved sanction header means execution is under way — continue from the first unexecuted unit; otherwise resume where the map's state shows. If `scan/methodology-findings.md` is missing and the map is still empty, the inventory is gone — route back through `groundwork-scan` to re-run its ways-of-working stage rather than reconstructing it from memory.

---

## Phase 1: Absorb & Explore

Read `.groundwork/cache/scan/methodology-findings.md` in full, then verify it against the repo. The inventory is a map, not the territory: confirm every claim you will build a disposition on, and explore what it flagged low-confidence — run the incumbent CLI's help, read its templates, run its progress reporter, open the in-flight units' docs and tests. Read anything you need; a wrong disposition costs more than the reading that would have prevented it.

Read `docs/maturity.md` too — the roadmap the phases before you committed. Convergence items will land there, and rows it already carries (a missing harness, a contract gap) may overlap with what conversion fixes.

Arrive at Phase 2 able to name every element of the incumbent system and the GroundWork element it corresponds to — or that none does.

## Phase 2: The Convergence Map

Build `.groundwork/cache/convergence/map.md`: one row per incumbent element, each carrying a **disposition**:

- **corresponds** — a GroundWork equivalent exists and the element maps onto it; record the mapping.
- **converts** — the element's content and history are brought into GroundWork form, and the original retires once carried.
- **retires** — superseded outright; removed only after anything it uniquely holds is carried somewhere durable.
- **keeps** — deliberately stays, wired in so it is owned: a `[skills]` route in `config.toml`, a policy fact, a dev-CLI extension.

Every in-flight unit in the inventory's register gets a **freeze-or-finish** ruling anchored to a named boundary: finish it in the incumbent system and convert its record on delivery, or freeze it at its current boundary and convert now. Splitting a unit mid-boundary is not an option you may offer.

Sequence the units so the repo stays working after every one — conversions land at work-unit boundaries, the same reason delivery slices vertically.

This is a facilitation conversation, not a form to fill. Recommend a disposition for every row with the reasoning that earns it — you have read both systems; the owner has run one of them and will veto what you misjudged. Walk the map through per Protocol 12, as a draft at its cache path. Then take **one batched go/veto pass per Protocol 13** over the whole map — recommended defaults marked, the owner edits the exceptions. Four kinds of row always need the owner's explicit ruling, never a default: retiring or converting anything the team currently relies on, relocating canon, handing over the harness or the CLI, and changing routing.

Record the sanction in the map header with the owner's verbatim responses. **Until sanction you change nothing — the additive rules of the phases before you still bind. After it, the approved rows are the license, and only the approved rows.**

## Phase 3: Execute

You are the driver — the thin spine holding the map, the pacing, the review gate, and the commits, for the same reason `groundwork-update`'s driver holds them: piling every unit's transform into one window destroys the judgment the driver exists to apply. Advance the approved units serially, in map order, one unit one commit: `chore(groundwork): converge <element> (<disposition>)`.

Per unit: under `parallel`, dispatch a `convergence-worker` (`.groundwork/skills/groundwork-methodology-adopt/briefs/convergence-worker.md`) with the unit capsule — the map row, the incumbent artifact paths, the **target canonical form by pointer** (the `.groundwork/skills/` template, contract, or workflow defining the GroundWork shape), the sequencing constraint, and the merge guards. Under `sequential`, do the worker's read-and-transform yourself for that one unit, following the brief's discipline.

Driver rules:

- **Resolve.** Any `COLLISIONS/AMBIGUITY` the report raises is an owner decision — surface it and let the owner pick before committing. A `BLOCKING CONCERN` stops the unit.
- **Gate.** Every canonical doc a unit mutates goes through the review subagent (Protocol 9 dispatch mechanics) with the matching `document_type`. The gate is fail-closed; Protocol 8's verdict grammar and revise cap bind.
- **Generators under sanction.** Where the map says an infrastructure generator runs — laying down GroundWork's dev CLI as the incumbent one retires, a docs site absorbing external canon — run it with `groundwork-infra-adopt`'s merge guards: back up what exists, merge structurally, verify nothing outside the unit changed.
- **History survives.** Prefer move over rewrite (`git mv` where possible); carry content verbatim where it already meets the bar. The incumbent's git history is part of what convergence preserves.
- Mark each unit executed in the map as its commit lands.

## Phase 4: Prove & Close

1. **Prove the end state.** Walk the seven properties against the repo, each with evidence: run the converged harness; exercise the routing (a fresh session's entry file reaches the orchestrator); confirm what the map retired is gone and what it kept is wired. A property that does not hold sends you back to Phase 3, not into a caveat.
2. **Record the decision.** Write one ADR to `docs/architecture/decisions/` from `.groundwork/skills/templates/adr.md`: the sanctioned map and the owner's verbatim rulings — the durable record of what converged, what stayed, and why. ADRs carry no review type; the present-and-approve step gates this one.
3. **Update the roadmap.** Append one `docs/maturity.md` row per deferred or kept item: a finish-native unit (status `open`, closed when it delivers and its record converts), a kept pipeline (`accepted`, the owner's reasoning in the row), a consciously deferred conversion. Most process-convergence rows map to dimension D7 (delivery discipline); use the model's mapping, not habit. Re-review the mutated maturity doc (Protocol 9, `document_type: maturity`).
4. **Downstream Context and teardown.** Write `.groundwork/context/methodology-adopt.md` (Protocol 5: the four subsections, ≤200 words, via `groundwork-writer`). Delete `.groundwork/cache/convergence/` and `.groundwork/cache/scan/methodology-findings.md` — this phase owns both.
5. **Record completion.** Add `"methodology-adopt"` to the `completed` array in `.groundwork/config/state.json`. This phase's changes span too many files to reconcile from artifacts, so the durable marker is the one completion signal — only this skill writes it, at its own completion.
6. **Report and hand off.** Present the outcome in the owner's terms: the project now runs one way of working — where their work lives now, how new work starts, and what happens to anything still finishing in the old system. Recommend a fresh context, then immediately load and execute the `groundwork-orchestrator` skill — with setup complete it runs Setup Graduation and routes to the first bet. Do not ask the user to invoke it.
