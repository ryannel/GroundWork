# Distillation Plan — Greenfield Setup

Status: PROPOSED (input to the master distillation plan)
Scope (word counts via `wc -w`, total **23,321**):

| File | Words |
|---|---|
| `src/hidden-skills/groundwork-product-brief/instructions.md` | 3,519 |
| `src/hidden-skills/groundwork-architecture/instructions.md` | 1,526 |
| `src/hidden-skills/groundwork-architecture/architecture-template.md` | 366 |
| `src/hidden-skills/groundwork-architecture/templates/architecture-cache.md` | 182 |
| `src/hidden-skills/groundwork-architecture/phases/01-context-ingestion.md` | 261 |
| `src/hidden-skills/groundwork-architecture/phases/02-technical-constraints.md` | 632 |
| `src/hidden-skills/groundwork-architecture/phases/03-service-design.md` | 506 |
| `src/hidden-skills/groundwork-architecture/phases/04-data-flow-communication.md` | 500 |
| `src/hidden-skills/groundwork-architecture/phases/05-component-boundaries-contracts.md` | 677 |
| `src/hidden-skills/groundwork-architecture/phases/06-draft-review-present.md` | 783 |
| `src/hidden-skills/groundwork-architecture/phases/07-commit.md` | 1,295 |
| `src/hidden-skills/groundwork-scaffold/instructions.md` | 2,265 |
| `src/hidden-skills/groundwork-scaffold/phases/01-ingestion-service-mapping.md` | 2,431 |
| `src/hidden-skills/groundwork-scaffold/phases/02-scaffolding-execution.md` | 286 |
| `src/hidden-skills/groundwork-scaffold/phases/03-service-documentation-api-stubs.md` | 780 |
| `src/hidden-skills/groundwork-scaffold/phases/04-infrastructure-verification.md` | 425 |
| `src/hidden-skills/groundwork-scaffold/phases/05-draft-review.md` | 588 |
| `src/hidden-skills/groundwork-scaffold/phases/06-commit.md` | 436 |
| `src/hidden-skills/groundwork-scaffold/templates/scaffold-cache.md` | 65 |
| `src/hidden-skills/groundwork-mvp/instructions.md` | 3,243 |
| `src/hidden-skills/groundwork-mvp/templates/mvp-cache.md` | 41 |
| `src/hidden-skills/groundwork-stack-forge/instructions.md` | 1,435 |
| `src/hidden-skills/groundwork-stack-forge/references/authoring-engineer-skills.md` | 1,079 |

---

## 1. Intention

This section is the greenfield spine: it turns an empty repo plus a user's head into (a) a canonical doc set a stranger can build from, (b) a booted, verified workspace, and (c) the first bet pitch — each phase handing the next a terse contract (`.groundwork/context/<phase>.md`, Protocol 5) plus a single-hop hand-off (Protocol 6) so no phase re-interviews the user. The chain: Product Brief → Design System (section 3) → Architecture → Scaffold → MVP → first bet, with stack-forge as the off-road escape hatch inside Scaffold.

Per-file intention map:

- **product-brief/instructions.md** — cause a vision-altitude discovery conversation (as the `groundwork-product` persona) that stays out of design/tech, captures out-of-phase signals to discovery notes, and lands a reviewed `docs/product-brief.md` deep enough that no downstream phase asks "who is this user, really?". Names the surface set early because every later phase branches on it.
- **architecture/instructions.md** — put the agent in architect-persona mode, establish the conversational stance and the quality bar (reasoning, not a shopping list), and route through seven phase files one at a time so working memory serves the current conversation.
- **architecture/phases/01–05** — one conversation mode each: silent context ingestion; constraint envelope first (so later decisions never get invalidated); service map with core/surface classification and deployment; data flow + technology with rationale and downstream obligations; precise ownership, per-surface access/auth, contract-compatibility stance, and capability→provider→footprint bindings.
- **architecture/phases/06–07** — draft per-section files (structurally immune to output-token exhaustion), gate through the isolated reviewer, then commit the whole constellation: index.md, domain stubs, ADRs, surface registry twins, capability-ports twin, context file, hand-off.
- **architecture-template.md / architecture-cache.md** — the canonical doc skeleton (with mandated diagrams) and the phase-status resume ledger.
- **scaffold/instructions.md** — recast the agent as a platform engineer in execution mode; carry the two quality bars (infrastructure.md worked example; the getting-started on-ramp) and the "adapt, never inert, never duplicated" tooling ethic.
- **scaffold/phases/01** — translate architecture vocabulary into exact generator invocations (the one authoritative flag catalog, pinned by the orchestrator), consume the surface and capability-port registries, and route unsupported stacks honestly (reverse / forge / manual) instead of silently substituting.
- **scaffold/phases/02–04** — mechanical generation with materialization checks; per-service docs + API stubs with anti-fabrication population rules and drift frontmatter for `groundwork-check`; boot-migrate-test-self-heal verification plus footprint reconciliation and repo-map seeding.
- **scaffold/phases/05–06** — draft and gate infrastructure.md + maturity.md, author the on-ramp, then commit context/hand-off (including the forged-stack checklist relay) and clean up.
- **mvp/instructions.md** — run the one-time "where do we start" decision: name the hypothesis, agree a falsifiable success signal, cut scope two-sidedly (in/out presented together), scope surfaces, set appetite and stakes, and commit the first pitch at `status: design` so the bet loop continues *in the same context* (the one deliberate exception to fresh-context-per-phase).
- **stack-forge/instructions.md** — when no generator exists for a deliberate stack choice, do what a generator would have done by hand: research the stack, author a project-local engineer skill, build a Day-2 seed wired into `./dev` and the test loop, and hand MVP the to-be-built checklist.
- **stack-forge/references/authoring-engineer-skills.md** — the runtime standard for authoring an engineer skill inside a user project, where the dev-time `skill-writer`/`skill-creator` skills do not exist; deliberately a distillation of both plus the engineer-family spine.

---

## 2. Findings

| ID | Where | Finding | Severity |
|---|---|---|---|
| GREEN-1 | product-brief Phase 4 steps 4–8; architecture `phases/07-commit.md` steps 9–13; scaffold `phases/06-commit.md` steps 4–8; mvp Phase 4 steps 3, 5–7 | **Commit-tail protocol restated 4×.** Each commit file re-narrates operating-contract Protocol 3.4 steps 5–9 (Living Documents scan, discovery-notes sweep, confirm, fresh-context recommendation, orchestrator hand-off) *and* embeds the full Reversal Protocol summary — the sentence "reconcile the full body of the affected doc, fix dependent docs, write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc before committing" appears near-verbatim in all four. Product-brief even self-labels it: "the steps below are the inline expression of that protocol." The contract says protocols are "defined once and referenced everywhere — never duplicated inline," and the sibling `groundwork-design-system` already proves the lean form (one paragraph citing Protocol 3.4 with phase parameters only). Four copies are four drift points — wording has already diverged slightly between them. | high |
| GREEN-2 | product-brief Phase 3 steps 2–3; architecture `phases/06` steps 3–4; scaffold `phases/05` steps 2–3; mvp Phase 3 steps 3–4 | **Review-loop mechanics restated 4× against an explicit contract rule.** Protocol 9 states "the dispatch mechanics and the failure procedure live here and are never restated per skill," yet every drafting phase re-explains announce → fail-closed → REVISE loop → 3-verdict cap → advisory surfacing (~120–170 words each). The per-skill payload the contract actually asks for is two identifiers and a trigger point: `document_path`, `document_type`, when it fires. | high |
| GREEN-3 | operating-contract `## Lifecycle Modes` (Sequential Setup) vs mvp Phase 4 | **Intent contradiction: the contract claims MVP writes artifacts it deliberately doesn't.** Lifecycle Modes lists `groundwork-mvp` under Sequential Setup where "Each phase writes a hand-off file… Each phase writes a Downstream Context file." MVP writes neither: the hand-off omission is justified inline (terminal phase; successor runs Continuous Bet), the context-file omission is entirely silent. The brownfield scan gets a documented carve-out for the same kind of divergence; MVP does not. A conformance reader flags MVP as broken, or worse, a future editor "fixes" MVP to write dead artifacts torn down moments later by Protocol 10. Cross-section: the contract is section 1's file — see FLAG(1). | high |
| GREEN-4 | scaffold `phases/06-commit.md` step 1 (writer) vs mvp Phase 1 (reader) | **Contract file written for MVP that MVP never reads.** Scaffold writes `.groundwork/context/scaffold.md` with Binding Constraints described as "anything MVP Planning must respect: env var requirements, manual verification gaps" — but MVP Phase 1's read list names only the product-brief, design-system, and architecture context files. `grep context/scaffold` across `src/` finds exactly one hit: the writer. A manual-verification gap or env constraint reaches MVP only if it also happens to be in the hand-off. Classic silent identifier-chain break: the consumer reads nothing and no error fires. | high |
| GREEN-5 | mvp `## Quality Standard` (~670 w) + Phase 2 Appetite/Stakes paragraphs vs `groundwork-bet/workflows/01-discovery.md` Quality Standard + `groundwork-bet/templates/pitch.md` | **Pitch quality canon duplicated across two skills with drift already visible.** MVP and bet discovery each carry a full shallow/deep pitch example, the two-list Rabbit Holes & No-Gos rules, and near-identical Appetite/Stakes definitions ("Stakes is the bet's size, not its effort" vs "Stakes is the bet's size, and it is not effort"). Both produce the same artifact (`document_type: bet-pitch`, same template). The MVP-specific deltas are real (hypothesis framing, no-Milestones rule, `status: design`, forged-stack Day-2 handling) but they are ~30% of the section; the rest is a second copy of bet-owned canon. Cross-section: see FLAG(5). | high |
| GREEN-6 | scaffold `templates/scaffold-cache.md`; mvp `templates/mvp-cache.md` | **Resume ledgers missing terminal-phase markers.** Scaffold's cache has five status headings but its resume rule routes to "the first phase the cache does not mark complete" — an interruption during the long Phase 5 (infra doc + maturity + on-ramp + two review loops) presents as "everything complete," with no marker to route to Phase 5 or 6. Same shape in MVP: the cache tracks Synthesis and MVP Scope only; a session that dies mid-Phase-3 review resumes with both markers complete and no instruction. Secondary drift risk: cache headings ("Service Mapping") differ from phase-table names ("Ingestion & Service Mapping"), so the router matches by inference, not by identifier. Compare architecture-cache, which carries a status row for every routed phase including Draft/Review. | med |
| GREEN-7 | scaffold `instructions.md` `## The developer on-ramp` (~313 w) vs `phases/05-draft-review.md` step 4 | **On-ramp spec duplicated between the always-loaded entry file and the phase that executes it.** Both describe the three `docs/getting-started/` files and their derivation rules (`setup.md` from what Phase 4 actually did; `dev-cli-reference.md` from `./dev help`, never memory). The entry file is in context for all six phases; this content is consumed once, in Phase 5. | med |
| GREEN-8 | scaffold `phases/01-ingestion-service-mapping.md` | **Triple statement of `--llmProvider none` semantics + two overlapping flag tables.** The bare-interface meaning of `none` (interface + stub + strict-xfail test, no SDK, no infra, "the provider is the bet") is stated in the capability-registry bullets, again in two Generator Capability Mapping rows, and a third time in the ~300-word "LLM provider" paragraph. The Generator Capability Mapping table and the Generator Availability table enumerate largely the same flags twice (e.g. `--messaging`, `--auth`, `--websockets` appear in both). The file self-describes the mapping table as "the one place to update when generator flags evolve" while maintaining a second place directly below it. The orchestrator pins this file as the flag-catalog source of truth, so the catalog must stay — but once, not twice. | med |
| GREEN-9 | architecture `phases/07-commit.md` steps 3 and 5 | **Template contracts restated inline at the call site.** Step 3 re-describes the ADR anatomy (context, decision, assumptions, review trigger, trade-offs, owner, supersede semantics — ~130 w) that `templates/adr.md` carries in full, including its rationale sentences. Step 5 re-describes the surfaces-registry contract (~150 w) that `templates/surfaces.md` specifies field-by-field. The commit step needs the pointer, the phase-specific projections (which phase decision fills which field), and nothing else; two statements of one contract is where field drift starts. | med |
| GREEN-10 | product-brief Phase 2 Altitude Check; Depth Threshold "surfaces" paragraph; `#### The Experience` structure entry; Phase 4 step 1 | **The same two concerns each stated three times in one skill.** (a) Discovery-notes header routing: the Altitude Check restates Protocol 1's five-header table including its bright-line example (the "faceted…search" phrasing appears in both, already slightly diverged). (b) Surface naming: the "name every surface, mark horizons, ambiguity blocks Phase 3" rule appears in the Depth Threshold (~120 w), again in The Experience section spec (~90 w), and again in the commit's Key-Decisions instruction. Repetition here isn't calibration — it's the same rule at three altitudes, inviting three-way drift. | med |
| GREEN-11 | scaffold `phases/05-draft-review.md` step 1b | **Instruction invites citing unverified evidence.** "Cite the evidence this phase just produced (booted stack, generated harness, registered Serena, …)" — Serena is registered at *init* by `bin/groundwork.js`, not by any scaffold step, and no scaffold phase checks `.mcp.json`. As written, the agent is told to assert a maturity signal (D5) the phase neither produced nor verified — a small crack in the honest-green ethic this repo otherwise enforces hard. | low |
| GREEN-12 | stack-forge `references/authoring-engineer-skills.md` | **Deliberate runtime mirror with no drift guard.** The reference correctly copies (not references) the dev-only `skill-writer` rules, the `skill-creator` eval loop, and the contributor guide's Backend/Surface family spine — it must, since none of those ship. But nothing notices when the sources move: a family-spine change or a new skill-writer rule silently strands this mirror. Cross-section: see FLAG(10). | low |
| GREEN-13 | stack-forge `## Operating Contract` | **Over-claimed conformance.** "Load and apply all protocols… the Phase Lifecycle, Living Documents, and Hand-off protocols bind it" — stack-forge runs *inside* the scaffold phase: it owns no cache, writes no hand-off of its own (it writes into `scaffold-cache.md`), and gates no review. Claiming the full lifecycle invites the agent to run init/commit machinery that isn't its job. The real obligations are three: record the checklist under `## Forged Stack Checklist` in the scaffold cache, honour Living Documents, apply `groundwork-writer`. | low |
| GREEN-14 | architecture `phases/02/03/04` "Apply from the architect references:" blocks; product-brief Step 0 reference list | **Persona reference filenames pinned across workflow files.** Decision-point routing to named persona references (`core-and-boundaries.md`, `discovery-and-opportunity.md`, …) is good execution — but it duplicates the routing tables the persona SKILL.md files already carry, and a persona reference rename now has 5+ silent greenfield readers. Keep the pins (they beat a two-hop lookup at decision time); record the coupling. Cross-section: see FLAG(7). | low |
| GREEN-15 | product-brief / architecture / mvp `## Operating Contract` sections | **Scripted paragraph cloned verbatim.** "Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design." appears word-for-word in three skills (scaffold carries a variant). It restates Protocol 4's rationale, which every skill loads two lines later. One copy of a rationale is framing; four copies are boilerplate that trains contributors to paste rather than reference. | low |
| GREEN-16 | scaffold `phases/06-commit.md` step 1, last sentence | **Misfiled instruction.** "Add a one-line `llms.txt` entry for each newly created doc" is buried inside the Protocol 5 context-file step, where it is neither part of the context contract nor discoverable by a reader scanning for doc-registration duties. | low |

---

## 3. Distillation moves

Moves are keyed to findings. The design-system skill's one-paragraph commit (its `instructions.md`, "The commit runs once… It must follow Protocol 3.4 of the Operating Contract — including…") is the house pattern all moves below converge on: **phase files carry parameters; the contract carries procedure.**

**M1 — Collapse the four commit tails to parameter blocks (GREEN-1).**
Targets: product-brief Phase 4; architecture `phases/07-commit.md`; scaffold `phases/06-commit.md`; mvp Phase 4.
Each commit file keeps only what is phase-specific — what goes in this phase's context file, what goes in its hand-off, its cleanup command, and any phase-specific reversal hazard (scaffold's "vendor/language/topology changes are reversals; re-review every domain stub" note is genuinely phase-specific and stays) — then closes with one line: "Then complete Protocol 3.4 steps 5–9 (Living Documents with the Reversal Protocol where it fires, discovery-notes sweep, confirm, fresh-context recommendation, orchestrator hand-off)." MVP keeps its two deviations explicit (no fresh context; discovery notes as the durable channel).
Before (architecture 07, steps 9–13, ~210 w) → after (~35 w). Why this delivers better: the agent executes the tail from the contract it has already loaded, and a protocol fix lands once instead of needing a five-file sweep; today a Protocol 2 change leaves four stale paraphrases authoritative-looking in context.

**M2 — Reduce the four review invocations to the Protocol 9 payload (GREEN-2).**
Targets: same four drafting phases.
Each becomes: announce the shift, dispatch per Protocols 8–9 with `document_path: <x>` / `document_type: <y>`, apply 🔴 findings to the named draft location and re-dispatch, surface 🟡 advisories with the presented draft. Delete the local re-explanations of fail-closed, the cap arithmetic, and the failure paths — the contract owns them and says so. Architecture keeps its one genuinely local mechanic: revise touches only the implicated section files, then re-`cat`.
Why better: removes the risk of a skill-local paraphrase overriding the contract (e.g. a skill that forgets "hang = failure"), and makes the trigger point — the only thing the caller owns — impossible to miss in a shorter file.

**M3 — Route MVP's pitch canon to the bet-owned standard (GREEN-5, with FLAG(5)).**
Target: mvp `## Quality Standard` and Phase 2 Appetite/Stakes.
Keep in MVP: the hypothesis framing, the no-`## Milestones` rule with its reason (decomposition owns milestones), the `status: design` decision, the surface-scoping and forged-stack paragraphs. Replace the duplicated deep/shallow pitch example and the Rabbit Holes/No-Gos/Appetite/Stakes definitions with a pointer to the single canonical statement (proposed home: `groundwork-bet/templates/pitch.md`, which both writers already load, with the worked example living once in `workflows/01-discovery.md`). MVP's example can shrink to the 3-line delta that is MVP-flavoured (hypothesis-shaped Problem + Success Signal) if section 5 agrees.
Why better: one quality bar for one artifact type — today the reviewer, the bet workflow, and MVP can each drift to different definitions of "stakes," and the agent that runs both flows reads two subtly different standards for the same document.

**M4 — Add the missing reader for `.groundwork/context/scaffold.md` (GREEN-4).**
Target: mvp Phase 1 read list.
Add `.groundwork/context/scaffold.md` (Key Decisions: boot/test commands; Binding Constraints: env requirements, verification gaps) as item 1d in the Synthesis batch. One line. Alternative considered and rejected: stop scaffold writing the file — rejected because Protocol 5 uniformity is what Setup Graduation walks, and the constraints are genuinely scoping inputs (an MVP scoped over an unverified scaffold should know it).

**M5 — Extend the resume ledgers to cover every routed phase (GREEN-6).**
Targets: `templates/scaffold-cache.md` (+ `Draft & Review`, `Commit` status rows, headings matched verbatim to the phase table); `templates/mvp-cache.md` (+ `Draft & Review` row); align scaffold cache headings with phase names ("Ingestion & Service Mapping").
Why better: resume routing becomes a string match against a complete ledger instead of an inference over an incomplete one; the durable-artifact fallback (pitch exists at `status: design`) stops being the only thing saving an interrupted MVP session.

**M6 — Move the on-ramp spec into Phase 5; leave a pointer (GREEN-7).**
Target: scaffold `instructions.md` → `phases/05-draft-review.md`.
The full three-file spec (index/setup/dev-cli-reference, with the "derive from `./dev help`, never memory" and "from what Phase 4 actually did" rules) moves to Phase 5 step 4, which currently paraphrases it. `instructions.md` keeps one sentence in the phase overview. The infrastructure.md worked example *stays* in `instructions.md` — it is the quality bar Phase 5 cites and the skill-writer standard mandates the side-by-side example.
Why better: ~300 words leave the always-loaded file; the executing phase carries the complete instruction instead of a "to the standard in the entry instructions.md" indirection mid-drafting.

**M7 — One flag catalog, one statement of `none` (GREEN-8).**
Target: scaffold `phases/01-ingestion-service-mapping.md`.
Merge the Generator Availability table into the Generator Capability Mapping table (add a "Generator / what it produces" grouping column or a per-generator sub-head) so flags are enumerated once; keep the "this table is the one place to update" sentence true. State the `none` bare-interface semantics once, in the capability-registry block, and let the LLM paragraph shrink to what is unique to it: the honesty boundary — what `--llm` scaffolds (generic client, retries, breaker) vs what stays bet work (caching, streaming, structured outputs, moderation, tool use), and "never describe the generated client as provider-agnostic." Break the surviving paragraph into 3 short bullets — it is currently a ~300-word single block, the exact shape agents skim past.
Why better: the orchestrator's "single source of truth" pin becomes literally true, and the honest-presentation rule — the load-bearing part — stops being buried in a wall of restated semantics.

**M8 — Commit steps point at template contracts instead of restating them (GREEN-9).**
Target: architecture `phases/07-commit.md` steps 3 and 5.
Step 3 becomes: write one ADR per significant decision (significance test kept — it is judgment calibration, not template content) to `docs/architecture/decisions/NNNN-<slug>.md` from `templates/adr.md`, sequential numbering rule kept; delete the field-by-field anatomy. Step 5 becomes: write both registry twins from `templates/surfaces.md`, plus the three phase-specific projections (status from the brief's horizon; access/auth from Phase 5; `scaffold` from the stack decision, `manual` when no generator) — delete the restated field semantics.
Why better: the template is loaded at write time anyway; removing the paraphrase removes the possibility of the paraphrase winning an argument with the template.

**M9 — Product-brief: one home per rule (GREEN-10).**
Target: product-brief Phase 2 + structure + Phase 4.
(a) Altitude Check keeps the self-test and the ✅/❌ altitude table (excellent calibration) but routes header placement to Protocol 1's table with one orienting clause ("most vision-conversation signals are user-facing → `## Design System`") instead of re-listing all five headers with re-worded definitions. (b) Surface naming: full rule stated once, in `#### The Experience` (where the drafting agent needs it); Depth Threshold keeps one sentence ("every experience names its surface; ambiguity blocks Phase 3"); the commit step keeps only the projection instruction (Key Decisions carries the surface set + horizons).
Why better: the rule the agent must enact at drafting time sits where drafting happens; three near-copies stop competing for which phrasing is canonical.

**M10 — Honest maturity evidence (GREEN-11).**
Target: scaffold `phases/05-draft-review.md` step 1b.
Reword: "cite evidence you can point at: the booted stack and test results (Phase 4), the generated harness, the seeded repo-map; check `.mcp.json` for Serena registration before citing D5 — mark it a roadmap row if absent." Five words of check replace an assumed assertion.

**M11 — Right-size stack-forge's contract claim (GREEN-13).**
Target: stack-forge `## Operating Contract`.
Replace "load and apply all protocols… bind it" with its actual obligations: it runs inside the scaffold phase (no cache, no hand-off, no review gate of its own); it records the Day-2 checklist under `## Forged Stack Checklist` in `.groundwork/cache/scaffold-cache.md` (the identifier both scaffold 06-commit and MVP read); Living Documents and `groundwork-writer` apply. Keep the Day-2 baseline pointer — it is the governing rule and correctly cited.

**M12 — Deduplicate the Operating Contract framing paragraph (GREEN-15).**
Targets: product-brief, architecture, mvp (and scaffold's variant).
Each skill's section becomes two sentences: the pointer with `(contract v1)` and "read it before any other action," plus at most one phase-flavoured failure-mode clause (scaffold's "rushing to execution before the mapping is confirmed" is genuinely local and stays). The shared rationale lives in Protocol 4, where it already is.

**M13 — Move the llms.txt duty to its own step (GREEN-16).**
Target: scaffold `phases/06-commit.md`. One-line step between hand-off and cleanup: "Register each newly created doc in `llms.txt` (getting-started set, maturity)." No word change, just findability.

---

## 4. Cuts

Everything cut below is carried elsewhere or never carried weight:

- **Four copies of the Protocol 3.4 commit tail** (~600 w across the section) — carried verbatim by the operating contract every skill loads first; the design-system sibling proves the flow executes correctly from the pointer form.
- **Four copies of review fail-closed/cap mechanics** (~450 w) — Protocols 8–9 define them and explicitly forbid per-skill restatement; nothing is lost because the contract is mandatory reading before any action.
- **MVP's duplicated pitch example + Rabbit Holes/Appetite/Stakes definitions** (~500 w net after keeping the MVP deltas) — carried by the bet pitch template and 01-discovery's quality standard, which review both flows against the same `document_type`. The reviewer, not the second copy, is what actually enforces the bar.
- **Generator Availability table's overlap with the Capability Mapping table** (~250 w) — the merged catalog carries every flag; the orchestrator's pointer (its step 2 names this file as the single source for flag detail) survives unchanged.
- **Two of three `--llmProvider none` semantics statements** (~150 w) — one authoritative statement in the capability-registry block; the mapping-table row keeps only the flag value.
- **ADR/surfaces field anatomies in architecture 07-commit** (~280 w) — carried in full, with rationale, by `templates/adr.md` and `templates/surfaces.md`, which the step instructs the agent to use.
- **Two of three surface-naming statements and the re-worded discovery-header table in product-brief** (~250 w) — carried by the remaining statement and Protocol 1's canonical table.
- **The cloned "Standard assistant behaviour…" paragraph ×3** (~180 w) — carried by Protocol 4's opening rationale.
- **Scaffold instructions.md on-ramp spec** (not a cut — a move to Phase 5, net ~–60 w after removing the phase-5 paraphrase it replaces).

Not cut, deliberately: every shallow/deep worked example except MVP's duplicate (skill-writer mandates example-calibrated quality bars — product-brief's user-depth example, architecture's tech-stack example, scaffold's infrastructure.md example, and bet's pitch example each calibrate a *different* artifact); scaffold Phase 3's anti-fabrication population rules (each rule blocks a specific observed failure — invented env vars, databases for stateless frontends); the unsupported-stack three-option fork (the honest-routing core of Phase 1); stack-forge's pipeline and reference (self-containment is its design constraint — see FLAG(10) instead of a cut).

---

## 5. Risks & cross-section flags

Execution risks:

- **Identifier chains this plan must not break** (writers → readers, verify string-exact after every move): `.groundwork/context/{product-brief,design-system,architecture,scaffold}.md` (each phase commit → later inits + Protocol 10); `.groundwork/cache/handoff/<phase>.md` single-hop chain (product-brief→design-system→architecture→scaffold→mvp deletes); `## Forged Stack Checklist` heading (stack-forge Stage 6 → scaffold 06-commit step 2 → mvp Step 3); `scaffold:` values `forged`/`manual` (architecture 07 step 5 + stack-forge Stage 5 → scaffold Phase 1 + templates/surfaces.md); footprint enum `env|compose-service|runner|none` (architecture template §3 + phase 05 → scaffold phases 01/02/04 + templates/capability-ports.md); drift frontmatter keys `generation_mode`/`source_of_truth`/`last_reviewed` (scaffold Phase 3 writes; `groundwork-check` and the extract skills read — coordinate with section 6 before any rename); discovery-notes headers (Protocol 1 owns; M9 removes product-brief's copy, so Protocol 1's table becomes the only definition — correct, but its five strings are then load-bearing for this section).
- **Operating-contract conformance:** M1/M2 make skills *more* conformant (Protocol 9's "never restated per skill" is currently violated), but the collapse must keep each skill naming its trigger points and its upstream chain explicitly — Protocol 3.2 requires skills to name the chain, so the init compressions (GREEN-5 adjacent) keep the per-phase file/header/hand-off parameters.
- **Cache-template changes (M5) touch shipped tier-1 files** — skills are clean-replaced on update, so no migration is needed (`[no-migration]` changelog line), but an in-flight setup session interrupted across an update would resume against a cache whose headings the new phase table expects verbatim; the resume instruction should tolerate a missing heading by treating it as `pending`.
- **Orchestrator coupling:** the orchestrator SKILL.md (section 1) pins `groundwork-scaffold/phases/01-ingestion-service-mapping.md` as the flag-catalog source and describes stack-forge's role; M7's table merge keeps the path and the tables' meaning, but section 1 should re-verify its step-2 pointer text after the merge.
- **Sync-anchor cascade:** none of the proposed edits touch `src/docs/principles/` or persona references, so no sync-anchor re-stamp is expected; if M3's pitch-canon consolidation lands in bet-side files, section 5 owns that change and its gates.

Cross-section flags:

FLAG(1): operating-contract `## Lifecycle Modes` (Sequential Setup) states every listed phase writes a Downstream Context file and a hand-off file, but `groundwork-mvp` — listed there — correctly writes neither (terminal phase; successor runs Continuous Bet and reads the pitch + discovery notes). Add an MVP carve-out mirroring the existing `groundwork-scan` carve-out, so conformance readers stop seeing a violation and future editors don't "fix" MVP into writing dead artifacts torn down by Protocol 10.

FLAG(5): the bet pitch quality canon (deep/shallow pitch example, Rabbit Holes & No-Gos rules, Appetite and Stakes definitions) is duplicated between `groundwork-mvp/instructions.md` and `groundwork-bet/workflows/01-discovery.md` + `templates/pitch.md`, with wording already drifting ("Stakes is the bet's size, not its effort" vs "…and it is not effort"). Proposal: one canonical statement in the bet-owned template/workflow that MVP points to (section 2 will thin the MVP side per M3); section 5 owns choosing the canonical home and keeping `document_type: bet-pitch` review aligned with it.

FLAG(7): greenfield workflow files pin persona reference *filenames* at decision points — architecture `phases/02/03/04` ("Apply from the architect references: `security-and-trust.md`, `core-and-boundaries.md`, `integration-patterns.md`, `realtime-and-async.md`, `data-architecture.md`, `ai-native-architecture.md`, `reliability.md`, `performance-and-scale.md`") and product-brief Step 0 (`discovery-and-opportunity.md`, `success-metrics-and-signals.md`, `requirements-and-specs.md`, `product-risks.md`). Renaming or splitting any persona reference must update these readers in the same change; consider recording these files as readers wherever section 7 tracks the personas' consumers.

FLAG(10): `groundwork-stack-forge/references/authoring-engineer-skills.md` is a deliberate runtime mirror of the dev-only `skill-writer` rules, the `skill-creator` eval discipline, and the contributor guide's Backend/Surface engineer-family spine — necessary because none of those ship into user projects, but it has no drift guard: a change to the skill-writer standard or the family spine will not surface this mirror for review. Section 10 owns the standard; recommend a one-line "runtime mirror: keep `src/hidden-skills/groundwork-stack-forge/references/authoring-engineer-skills.md` aligned" note in skill-writer (or a sync-anchor-style pin, though the mirror is a distillation, not a copy, so a hash pin may be too blunt).

---

## 6. Expected outcome

| File | Current | Target | What improves |
|---|---|---|---|
| product-brief/instructions.md | 3,519 | ~2,750 | Drafting-time rules live where drafting happens; one surface rule, one header table; commit and review run from the contract — less boilerplate competing with the altitude discipline that is this skill's real job |
| architecture/instructions.md | 1,526 | ~1,400 | Contract section deduped; stance + quality bar unchanged |
| architecture/phases/01–05 | 2,576 | ~2,500 | Essentially untouched — these are the best-calibrated files in the section (intent-framed, per-decision reference routing, batch-proposal patterns) |
| architecture/phases/06 | 783 | ~600 | Review mechanics from Protocol 9; keeps the per-section-file drafting mechanic (genuinely local) |
| architecture/phases/07 | 1,295 | ~800 | Commit reads as: the seven artifacts this phase uniquely produces + one protocol pointer; template anatomies no longer shadow the templates |
| architecture template + cache | 548 | 548 | Unchanged |
| scaffold/instructions.md | 2,265 | ~1,850 | On-ramp spec moved to its executing phase; entry file = role, phase map, tooling ethic, quality bar |
| scaffold/phases/01 | 2,431 | ~1,850 | One flag catalog (orchestrator's pin becomes literally true); `none` semantics once; LLM honesty rule surfaced as bullets instead of buried |
| scaffold/phases/02–04 | 1,491 | ~1,480 | Unchanged (dense, mechanical, every rule blocks a named failure) |
| scaffold/phases/05 | 588 | ~780 | Gains the on-ramp spec; loses review boilerplate; maturity evidence made verify-then-cite |
| scaffold/phases/06 | 436 | ~330 | Parameter-block commit; llms.txt duty findable |
| scaffold cache template | 65 | ~85 | Complete resume ledger, headings matching the phase table |
| mvp/instructions.md | 3,243 | ~2,350 | The skill becomes what it uniquely is — hypothesis-first scoping with setup-context synthesis and the same-context handoff — instead of half a second copy of bet discovery; reads scaffold's context file so verification gaps reach scoping |
| mvp cache template | 41 | ~55 | Draft & Review marker |
| stack-forge/instructions.md | 1,435 | ~1,380 | Honest contract claim; obligations stated as its own three duties |
| stack-forge reference | 1,079 | 1,079 | Unchanged (self-containment is the design; drift handled via FLAG(10)) |
| **Total** | **23,321** | **~19,800** | |

Net: **~3,500 words cut (~15%)** — deliberately less aggressive than a pure size target, because this section's phase files are already close to the skill-writer ideal; the fat is concentrated in protocol restatement and cross-skill duplication, and cutting exactly that is what improves behavior. Expected agent-behavior gains: commit/review flows execute from one canonical procedure (a protocol fix propagates instantly instead of fighting four stale paraphrases); MVP scoping sees scaffold's verification gaps; interrupted scaffold/MVP sessions resume deterministically; one pitch standard governs both writers of `bet-pitch` documents; the flag catalog has one row per flag so mapping errors stop entering through the stale twin; and the maturity doc is born citing only verified evidence.
