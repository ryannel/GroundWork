# Green Field Flow Improvements

This plan captures findings from a full review of the GroundWork greenfield setup flow and tracks the work needed to resolve them. It is written to survive a context reset — a fresh chat with zero prior context should be able to open this file and execute the next slice without further setup.

---

## 1. Resume Instructions (read this first)

If you are a new conversation arriving at this file, do the following in order:

1. **Read this entire document.** It is self-contained. Do not start work until you have read it end-to-end.
2. **Load the skill-writer skill** before editing any skill file: `.claude/skills/skill-writer/SKILL.md`. The writing conventions in that skill govern every edit you make here.
3. **Load the operating contract** at `src/hidden-skills/operating-contract.md` — it is the shared protocol referenced by every methodology skill you will touch.
4. **All directional decisions are locked.** §4 records the resolved direction for each issue. Do not re-debate; if a decision needs to change, surface the trade-off explicitly and update this file before proceeding.
5. **Find the next open slice in the [Task Tracker](#7-task-tracker).** Slices are ordered by dependency. Do not jump ahead unless a slice has no upstream blockers.
6. **Check the slice off the tracker only when its verification steps pass.** Each slice has a "Verify" block — run those checks, don't skip them.
7. **One slice = one commit.** Keep diffs scoped to the slice you are working on. Update the tracker in the same commit that completes the slice.

---

## 2. Background

The review covered the six skills that compose the GroundWork greenfield setup flow:

| Order | Skill | Output |
|---|---|---|
| 1 | `groundwork-product-brief` | `docs/product-brief.md` |
| 2 | `groundwork-design-system` | `docs/design-system.md` |
| 3 | `groundwork-architecture` | `docs/architecture.md` |
| 4 | `groundwork-scaffold` | `docs/infrastructure.md` |
| 5 | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |
| 6 | `groundwork-bet` (Planning onward) | First delivered feature |

Plus the shared support files:

- `src/hidden-skills/operating-contract.md` — protocol contract every methodology skill loads
- `src/hidden-skills/templates/discovery-notes.md` — cross-phase signal template
- `src/hidden-skills/groundwork-review/instructions.md` — independent draft-review skill

The flow's stated goals (locked):

1. **Capture all information required to produce a fully-fledged plan for the MVP.**
2. **Lowest possible cognitive load for the user.**
3. **Fastest journey from cold start to first shipped milestone, without sacrificing quality.**

Every fix in this plan is measured against those goals.

---

## 3. Findings Summary

Ranked by impact on the three goals.

| # | Finding | Goal hit | Severity |
|---|---|---|---|
| F1 | `groundwork-bet/instructions.md` opens with `## Core Directives` (imperatives) — every other phase skill opens with role + mental model | UX / cognitive load | 🔴 |
| F2 | `## UX Design` discovery-notes header drift — skill rename moved the folder/doc but not the section name; methodology doc disagrees | Info capture | 🔴 |
| F3 | Design System cluster identifier drift — Stage 4 ("Identity/Feel/Craft") vs Stage 5b ("Identity/Touch/Polish") vs cache template's 8 atomic topics | UX + info capture | 🔴 |
| F4 | Design System has no `groundwork-review` invocation — the most CSS-precise artifact never runs fidelity/handoff/upstream checks | Info capture / quality | 🔴 |
| F5 | Bet (discovery & planning) has no `groundwork-review` invocation — pitch and tech design land without independent review | Info capture / quality | 🔴 |
| F6 | Functional requirements have no canonical home; pitch template references `FR-001` but no skill produces or numbers FRs | Info capture | 🟡 |
| F7 | Architecture → Scaffold vocabulary gap — architecture speaks "Clerk auth"; scaffold needs `--auth clerk`; mapping is implicit | Info capture / journey speed | 🟡 |
| F8 | Design System app-shell decisions don't surface as architectural inputs (notification service, session state, search backend) | Info capture | 🟡 |
| F9 | Operating-Contract framing regression in `groundwork-mvp` and bet workflows — they load the contract but drop the "why this matters" framing | UX / cognitive load | 🟡 |
| F10 | NFR opening pattern divergence in `groundwork-design-system`: graphical-ui says "propose immediately"; cli + agentic-protocol say "explore through dialogue" | Journey speed | 🟡 |
| F11 | "Stages" vs "Phases" terminology drift across siblings — product-brief/design-system use Stages; architecture/scaffold/mvp use Phases | UX / consistency | 🟡 |
| F12 | Cache mechanism drift — separate template files (architecture, design-system) vs. inline templates (scaffold, mvp) vs. frontmatter status (bet) | Contributor cognitive load | 🟡 |
| F13 | `groundwork-bet` has both `SKILL.md` and `instructions.md`; every other hidden skill has only `instructions.md` | Contributor cognitive load | 🟡 |
| F14 | Success Signal (MVP) is a product metric; TDD checklist (bet planning) tests integration behaviour. Nothing wires the signal to a measurement plan | Info capture | 🟡 |

---

## 4. Locked Directional Decisions

Each finding has a resolved direction below. Do not re-open these without surfacing the trade-off and updating the plan.

### F1 — Bet skill opening rewrite

**Decision:** Rewrite `groundwork-bet/instructions.md` to mirror the lead-with-context pattern used by `groundwork-mvp/instructions.md`: open with the agent's role, then the mental model (what the 4-phase bet lifecycle is trying to achieve and why), then the lifecycle overview, then operating contract framing, then routing to the workflow files. The current `## Core Directives` content (no-jumping-ahead, micro-file execution) gets folded into the mental-model framing as *reasoning*, not as imperatives.

**Why:** The agent that understands why the four phases exist makes better judgment calls than one following hard rules. The current opening is the clearest violation of the lead-with-context principle in the flow.

### F2 — Rename `## UX Design` to `## Design System` everywhere

**Decision:** Rename the discovery-notes section header from `## UX Design` to `## Design System` across every writer, reader, template, and reference. This aligns with the upstream rename of the skill (`groundwork-ux-design` → `groundwork-design-system`) and the artifact (`docs/ux-design.md` → `docs/design-system.md`), and matches what `docs/methodology/core-concepts.md` already declares as the canonical set.

**Why:** Smaller diff than reverting methodology; preserves rename's intent; aligns the canonical doc with implementation.

**Scope:** Every file in §6.2 — the section header itself, prose references to "UX Design" as a phase name, the operating-contract canonical table, the discovery-notes template.

### F3 — Design System cluster identifier alignment

**Decision:** Use two clearly distinct cluster schemes — one for Stage 4 (design language conversation), one for Stage 5b (spec walkthrough). The Stage 4 conversation focuses on *aesthetic decisions*; Stage 5b walks through *implementation specifics*. Names must not overlap.

- **Stage 4 (language clusters):** `Identity` (aesthetic direction, colour psychology, typography character), `Feel` (surface and depth, motion and feedback, content density), `Craft` (iconography, voice/microcopy, data viz).
- **Stage 5b (spec clusters):** `Foundation` (colour tokens, type scale, spacing), `Interaction` (depth, motion, interaction states), `Surface` (everything else — scrollbars, toasts, errors, loading, empty states, borders, responsive).

The cache template (`design-system-cache.md`) replaces its 8-topic checklist with the Stage 4 cluster scheme, and its Stage 5 walkthrough checklist uses the Stage 5b spec-cluster names. Apply across all three tracks (graphical-ui, cli, agentic-protocol) — adapt cluster names to the medium where graphical-ui terms don't translate, but keep the *two-scheme separation* in every track.

**Why:** Eliminates the identifier collision and the writer/reader drift between stages. Distinct names make the agent's job obvious at every step.

### F4 — Add `groundwork-review` to Design System

**Decision:** Add a Draft → Review → Revise → Present loop *between* Stage 5a (autonomous translation) and Stage 5b (collaborative walkthrough). The review runs against `.groundwork/cache/design-system-draft.md` with document type `design-system`. Stage 5b is preserved — it is the user-facing collaborative review and is structurally different from `groundwork-review`'s fidelity/handoff/upstream checks.

**Why:** The CSS-precise design system is the most downstream-load-bearing artifact in the flow. Stage 5b catches what the user notices; `groundwork-review` catches silent invention, dropped commitments, and upstream contradictions that the user may not spot during a walkthrough.

### F5 — Add `groundwork-review` to Bet

**Decision:**

- **Bet Discovery (`01-discovery.md`):** Apply Draft → Review → Revise → Present to the pitch before writing it to `docs/bets/<slug>/pitch.md`. Document type: `bet-pitch`.
- **Bet Planning (`02-planning.md`):** Apply Draft → Review → Revise → Present to `technical-design.md` after Step 2. Document type: `technical-design`. The TDD checklist does not need review — it is a test contract, not a synthesis.

**Why:** Pitch becomes the input to every downstream planning conversation; a silently dropped capability or invented constraint poisons the entire delivery loop. Technical design is the contract delivery executes against.

### F6 — Drop `FR Coverage` from the pitch template

**Decision:** Remove the `**FR Coverage:**` field from `groundwork-bet/templates/pitch.md` and any references to FR numbers in `groundwork-mvp` and `groundwork-bet` instructions. GroundWork has no FR registry — capabilities (Product Brief) flow directly into milestones (MVP), and milestones become test contracts (Bet planning).

**Why:** Lower-cost cleanup than building an FR registry. The current field is vestigial Shape-Up terminology that creates a dangling reference to a system that doesn't exist.

### F7 — Architecture/Scaffold vocabulary alignment

**Decision:** Add a concrete generator-capability reference table to `groundwork-scaffold/instructions.md` Phase 1 ("Ingestion & Service Mapping") that explicitly maps **architectural language → generator flags**. Example rows: "Clerk-based end-user auth → `--auth clerk`", "Service-to-service tokens → `--auth service`", "GCP Pub/Sub transactional outbox → `--messaging gcp-pubsub`". Architecture is *not* modified to know generator names — the translation belongs in scaffold.

**Why:** Keeps architecture vendor-neutral while making the translation explicit and reviewable. When a new generator flag ships, the table is the one place that needs to be updated.

### F8 — Capture app-shell architectural signals

**Decision:** Add an explicit prompt to Stage 3 (App Shell) in every design-system track: when a shell decision implies a backend capability (notifications, search, session state, presence, real-time), append the implication under `## Architecture` in `.groundwork/cache/discovery-notes.md` before continuing.

**Why:** Closes the silent translation gap from UX structure to architectural inputs. Costs one sentence per track; saves the architecture phase from re-deriving the implication.

### F9 — Restore Operating Contract framing in MVP and Bet

**Decision:** Replace the bare "Before proceeding, load and apply all protocols…" directive in `groundwork-mvp/instructions.md`, `groundwork-bet/workflows/01-discovery.md`, and `groundwork-bet/workflows/02-planning.md` with the canonical framing used by product-brief / design-system / architecture / scaffold:

> Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.
>
> The shared operating contract at `.agents/groundwork/skills/operating-contract.md` defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

**Why:** The agent that knows *why* the protocols exist defends them under pushback. The agent that only loads them complies until challenged.

### F10 — Align NFR opening across design-system tracks

**Decision:** Update `cli.md` and `agentic-protocol.md` Stage 1 (NFRs) to use the graphical-ui pattern: read the product brief, then draft a complete NFR proposal immediately. Do not open with values exploration. Adapt the proposal contents to the medium, but the *opening shape* — propose first, refine collaboratively — is shared.

**Why:** Faster journey, same quality. Concrete proposals get faster reactions than open-ended values questions.

### F11 — Standardise on "Phases"

**Decision:** Rename "Stage" → "Phase" across `groundwork-product-brief/instructions.md` and `groundwork-design-system/instructions.md` (and the three track files). The operating contract already names the cross-skill protocol "Phase Lifecycle"; aligning the per-skill terminology removes the mental tax of switching between Stage and Phase mid-conversation.

**Why:** Operating contract sets the terminology. Skills follow.

**Caveat:** Design System has *two* stage-like layers — the per-conversation stages (1-6) and the lifecycle phases. After the rename, both will be "Phases." If reviewer feedback during the slice indicates this collapses an important distinction, surface it before completing the rename. Default direction is rename.

### F12 — Converge cache mechanisms

**Decision:** Move `groundwork-scaffold` and `groundwork-mvp` from inline cache templates (embedded inside the instructions file) to separate template files at `templates/scaffold-cache.md` and `templates/mvp-cache.md`. Update each skill's initialization step to copy the template into `.groundwork/cache/` like architecture and design-system already do. Bet's frontmatter `status:` field is a different concept (artifact lifecycle, not phase resumption) and stays as-is.

**Why:** Cache schema evolves independently of instructions. Contributors learn one pattern rather than three.

### F13 — Remove duplicate `groundwork-bet/SKILL.md`

**Decision:** Delete `src/hidden-skills/groundwork-bet/SKILL.md`. The orchestrator routes to `instructions.md`; the duplicate SKILL.md serves no consumer. Verify nothing in the install path (`bin/groundwork.js`) or the orchestrator routing table reads it before deleting.

**Why:** Matches the convention every other hidden skill follows; one file per skill, one source of truth.

### F14 — Defer success-signal measurement plan

**Decision:** Defer. The success signal is captured in the MVP pitch; wiring it to a measurement plan is a separate, larger piece of work that needs its own design conversation (where do metrics live, who instruments them, what triggers the readout). Flag it in `TODO.md` and revisit after the items in this plan ship.

**Why:** Out of scope for cognitive-load / journey-speed improvements. The bet TDD checklist verifies the workflow works; the success signal verifies people use it. Different time horizon.

---

## 5. Out of Scope

These came up during the review but are explicitly not part of this plan:

- **Architecture Phase 1 (Context Ingestion) restructuring.** The "silent prep is its own phase" pattern is mildly inconsistent with other skills, but folding it changes phase numbering across the whole skill and propagates into the cache template, the lifecycle docs, and contributor expectations. Keep as-is.
- **Fresh-context recommendation refinement.** The current "always recommend a fresh context" policy is uniform across all phase transitions except MVP→Bet. Making it phase-aware is a UX improvement worth doing, but it requires user research on how often the recommendation is actually followed today.
- **`groundwork-update` and `groundwork-check`.** Anytime skills, not part of the greenfield setup flow.

---

## 6. File Reference

### 6.1 Files the next session will edit

| File | Slices that touch it |
|---|---|
| `src/hidden-skills/groundwork-bet/instructions.md` | S1, S5, S6 |
| `src/hidden-skills/groundwork-bet/workflows/01-discovery.md` | S5, S6 |
| `src/hidden-skills/groundwork-bet/workflows/02-planning.md` | S5, S6 |
| `src/hidden-skills/groundwork-bet/templates/pitch.md` | S7 |
| `src/hidden-skills/groundwork-bet/SKILL.md` | S1 (delete) |
| `src/hidden-skills/groundwork-design-system/instructions.md` | S2, S3, S4, S8 |
| `src/hidden-skills/groundwork-design-system/tracks/graphical-ui.md` | S2, S3, S4, S8, S9, S10 |
| `src/hidden-skills/groundwork-design-system/tracks/cli.md` | S2, S3, S4, S8, S9, S10 |
| `src/hidden-skills/groundwork-design-system/tracks/agentic-protocol.md` | S2, S3, S4, S8, S9, S10 |
| `src/hidden-skills/groundwork-design-system/templates/design-system-cache.md` | S3 |
| `src/hidden-skills/groundwork-mvp/instructions.md` | S6, S7, S11 |
| `src/hidden-skills/groundwork-product-brief/instructions.md` | S2, S10 |
| `src/hidden-skills/groundwork-scaffold/instructions.md` | S11, S12 |
| `src/hidden-skills/groundwork-architecture/instructions.md` | (no edits — keep as reference) |
| `src/hidden-skills/operating-contract.md` | S2 |
| `src/hidden-skills/templates/discovery-notes.md` | S2 |
| `src/hidden-skills/templates/scaffold-cache.md` | S11 (create) |
| `src/hidden-skills/templates/mvp-cache.md` | S11 (create) |
| `docs/lifecycle/01-setup.md` | S2 |
| `docs/methodology/core-concepts.md` | S2 (verify) |
| `TODO.md` | F14 (note) |

### 6.2 Files containing `## UX Design` references (slice S2)

The header rename touches these files (verified via grep at plan time):

- `src/hidden-skills/operating-contract.md` (canonical table)
- `src/hidden-skills/templates/discovery-notes.md` (template literal)
- `src/hidden-skills/groundwork-product-brief/instructions.md`
- `src/hidden-skills/groundwork-design-system/instructions.md`
- `src/hidden-skills/groundwork-design-system/tracks/graphical-ui.md`
- `src/hidden-skills/groundwork-design-system/tracks/cli.md`
- `src/hidden-skills/groundwork-design-system/tracks/agentic-protocol.md`

Re-run `grep -rn '## UX Design\|UX design phase\|UX Design phase' src/hidden-skills/ docs/` before declaring the slice complete — additional occurrences may surface during editing.

### 6.3 Reference skills (do not edit, mirror these patterns)

- `src/hidden-skills/groundwork-mvp/instructions.md` — model for the bet opening rewrite (F1)
- `src/hidden-skills/groundwork-architecture/instructions.md` — model for Operating Contract framing (F9), separate template pattern (F12), Draft → Review → Present loop (F4, F5)
- `src/hidden-skills/groundwork-review/instructions.md` — the review skill being invoked

### 6.4 Skill-writer conventions

Every edit must conform to `.claude/skills/skill-writer/SKILL.md`. The most relevant principles for this plan:

- **Write intent, not scripts.** No quoted phrases for the agent to repeat verbatim.
- **Front-load the mental model.** Open with role, philosophical framing, and the shape of the process before any instruction.
- **Explain reasoning over rigid constraints.** Replace ALWAYS/NEVER with the *why* — agents internalise reasoning, work around constraints.
- **Quality bars with concrete examples.** Maintain the shallow-vs-deep example pattern when editing Quality Standard sections.
- **Structural consistency across sibling skills.** When you change a pattern in one skill, check whether siblings need the same change.

---

## 7. Task Tracker

Slices are ordered so that dependencies flow downhill. Mark each as `[x]` when verification passes and commit the tracker update with the slice's other changes.

### S1 — Bet skill opening rewrite + SKILL.md removal

**Resolves:** F1, F13
**Touches:** `src/hidden-skills/groundwork-bet/instructions.md`, `src/hidden-skills/groundwork-bet/SKILL.md`

- [x] Verify `bin/groundwork.js` and `src/skills/groundwork-orchestrator/SKILL.md` do not reference `groundwork-bet/SKILL.md` (orchestrator routes to `instructions.md`)
- [x] Delete `src/hidden-skills/groundwork-bet/SKILL.md`
- [x] Rewrite `src/hidden-skills/groundwork-bet/instructions.md` using `groundwork-mvp/instructions.md` as the structural model:
  - Open with role (orchestrator of the 4-phase bet lifecycle as a collaborative peer)
  - Mental Model section explaining what each of the four phases is trying to establish and why
  - Lifecycle overview table (Discovery / Planning / Delivery / Validation, with the artifact each phase produces)
  - Operating Contract block with the canonical framing (see S6 for the wording)
  - Activation routing (preserve the existing `status: planning` detection logic)
- [x] Verify the rewrite mentions the no-jumping-ahead rule *as reasoning* (not a directive) and explains why planning gates delivery

**Verify:** Read the rewritten file end-to-end. The first 30 lines must establish role and mental model before any imperative instruction. No `## Core Directives`, no numbered "you must" rules in the opening.

### S2 — Rename `## UX Design` → `## Design System`

**Resolves:** F2
**Touches:** Files in §6.2 plus `docs/lifecycle/01-setup.md`, `docs/methodology/core-concepts.md`

- [x] In each file in §6.2, replace `## UX Design` with `## Design System`. Update prose references to "UX Design" as a phase name to "Design System" as well.
- [x] Update `src/hidden-skills/operating-contract.md`'s canonical table row to use `## Design System`
- [x] Update `src/hidden-skills/templates/discovery-notes.md` literal section header
- [x] ~~Verify `docs/methodology/core-concepts.md` already says `## Design System`~~ — file has been deleted (see `git status`); step moot.
- [x] Sweep for stragglers: `grep -rn 'UX phase\|UX Design phase\|the UX' src/hidden-skills/ docs/`
- [x] Update `docs/lifecycle/01-setup.md` line referencing "The UX phase captures NFRs…" → "The Design System phase captures NFRs…"
- [x] Additional drift cleanup (out of §6.2 list but in the greenfield flow path): `groundwork-mvp/instructions.md`, `groundwork-writer/SKILL.md`, `groundwork-bet/templates/tdd-checklist.md`, `groundwork-bet/workflows/04-validation.md`, `operating-contract.md:11`

**Verify:** `grep -rn '## UX Design\|UX Design phase\|UX phase' src/hidden-skills/ docs/` returns zero results.

### S3 — Design System cluster identifier alignment

**Resolves:** F3
**Touches:** All three tracks + `templates/design-system-cache.md`

- [x] In `tracks/graphical-ui.md` Stage 4: keep `Identity / Feel / Craft` as the design-language clusters; ensure cluster contents match the locked decision in §4 F3
- [x] In `tracks/graphical-ui.md` Stage 5b: rename clusters to `Foundation / Interaction / Surface` and re-map cluster contents per §4 F3
- [x] Apply equivalent two-scheme separation to `tracks/cli.md` (adapt names where graphical-ui terms don't translate; keep the principle: language clusters in Stage 4, spec clusters in Stage 5b, names do not collide)
- [x] Apply equivalent two-scheme separation to `tracks/agentic-protocol.md`
- [x] Update `templates/design-system-cache.md`:
  - Stage 4 section: replace the 8-topic checkbox list with cluster checkboxes matching the Stage 4 scheme
  - Stage 5 section: rename the walkthrough checklist items to match the Stage 5b spec-cluster scheme
- [x] Update prose anywhere else in the design-system instructions that names the old clusters

**Verify:** In each track, Stage 4 and Stage 5b name their clusters differently. The cache template's checkboxes use the names that appear in the tracks. `grep -n 'Identity\|Touch\|Polish\|Foundation\|Interaction\|Surface\|Feel\|Craft' src/hidden-skills/groundwork-design-system/` reveals only the intended occurrences in their intended stages.

### S4 — Add `groundwork-review` invocation to Design System

**Resolves:** F4
**Touches:** All three tracks (Stage 5 boundary)

- [x] In each track, insert a Draft → Review → Revise → Present block between Stage 5a (translation) and Stage 5b (walkthrough). Mirror the wording and structure of `groundwork-architecture/instructions.md` Phase 6 step 3-5 (the Announce → Load → Pass path/type → Revise loop → Present pattern)
- [x] Pass `document_type: design-system` and the draft path `.groundwork/cache/design-system-draft.md`
- [x] Update `groundwork-review/instructions.md` Check 3 (Upstream Contract) chain to include `design-system` if not already in the chain (it already references the chain: product-brief → design-system → architecture → bet; verify the implementation reads `docs/design-system.md` when reviewing design-system or architecture)

**Verify:** Each track's Stage 5 sequence is: 5a translate → review → revise loop → 5b walkthrough. `grep -n 'groundwork-review' src/hidden-skills/groundwork-design-system/tracks/*.md` shows one invocation per track.

### S5 — Add `groundwork-review` invocation to Bet

**Resolves:** F5
**Touches:** `groundwork-bet/workflows/01-discovery.md`, `groundwork-bet/workflows/02-planning.md`

- [x] In `01-discovery.md`, insert Draft → Review → Revise → Present between drafting the pitch and writing it to `docs/bets/<slug>/pitch.md`. Document type: `bet-pitch`. Draft path: `.groundwork/cache/bet-pitch-draft.md` (or equivalent — match the pattern other skills use)
- [x] In `02-planning.md`, insert Draft → Review → Revise → Present after Step 2 (Draft the Technical Design Document) and before Step 3 (Build the TDD checklist). Document type: `technical-design`. Draft path: the existing technical-design.md location
- [x] The TDD checklist does not need review — it is a test contract, not a synthesis
- [x] Verify `groundwork-review/instructions.md` handles `bet-pitch` and `technical-design` document types — its upstream chain references `bet`, which is close but may need clarification

**Verify:** `grep -n 'groundwork-review' src/hidden-skills/groundwork-bet/workflows/*.md` shows one invocation in each of the two workflow files. The review block precedes the file write in discovery; it follows the TDD draft in planning.

### S6 — Restore Operating Contract framing in MVP and Bet

**Resolves:** F9
**Touches:** `groundwork-mvp/instructions.md`, `groundwork-bet/workflows/01-discovery.md`, `groundwork-bet/workflows/02-planning.md`

- [x] Replace the bare load directive in each file with the canonical two-paragraph framing (the exact wording is in §4 F9 of this plan)
- [x] Keep paths consistent with how the upstream skills reference the contract (`.agents/groundwork/skills/operating-contract.md`)

**Verify:** All four greenfield methodology skills (product-brief, design-system, architecture, scaffold) AND mvp + bet workflows now share the same Operating Contract framing. `diff <(grep -A4 'Standard assistant behaviour' src/hidden-skills/groundwork-architecture/instructions.md) <(grep -A4 'Standard assistant behaviour' src/hidden-skills/groundwork-mvp/instructions.md)` shows no substantive difference.

### S7 — Drop `FR Coverage` from pitch template and instructions

**Resolves:** F6
**Touches:** `groundwork-bet/templates/pitch.md`, `groundwork-mvp/instructions.md`, `groundwork-bet/workflows/*.md`

- [x] Remove the `**FR Coverage:**` field from `groundwork-bet/templates/pitch.md` milestone blocks
- [x] Remove the "FR Coverage" line from `groundwork-mvp/instructions.md`'s milestone examples and Quality Standard "deep output" example
- [x] Sweep: `grep -rn 'FR Coverage\|FR-[0-9]\|Functional Requirement' src/hidden-skills/`
- [x] Update any caught references — explanation: milestones inherit capability traceability from the Product Brief directly; no FR registry exists

**Verify:** `grep -rn 'FR Coverage' src/hidden-skills/` returns zero results.

### S8 — App-shell architectural signal capture

**Resolves:** F8
**Touches:** Stage 3 (App Shell) in each design-system track

- [x] Add a short paragraph to Stage 3 in each of the three tracks: when an app-shell decision implies a backend capability (notifications, search, session state, presence, real-time), append the implication as a bullet under `## Architecture` in `.groundwork/cache/discovery-notes.md` before continuing the shell conversation
- [x] Keep the prose tight — one paragraph, references the discovery-notes path

**Verify:** Each of `graphical-ui.md`, `cli.md`, `agentic-protocol.md` has a Stage 3 reference to writing into `## Architecture` in discovery notes.

### S9 — Align NFR opening across design-system tracks

**Resolves:** F10
**Touches:** `tracks/cli.md`, `tracks/agentic-protocol.md` (Stage 1)

- [x] Rewrite Stage 1 in `cli.md` to follow `graphical-ui.md` Stage 1's pattern: read the product brief, then draft a complete NFR proposal immediately; do not open with values exploration
- [x] Rewrite Stage 1 in `agentic-protocol.md` similarly
- [x] Adapt the *content* of the proposal to each medium (CLI: startup budgets, composability, exit codes; agentic-protocol: token budgets, context persistence, authority model). Keep the *shape*: propose first, refine collaboratively

**Verify:** `grep -A3 'Stage 1' src/hidden-skills/groundwork-design-system/tracks/cli.md` and the agentic equivalent open with read-then-propose, not explore-then-propose.

### S10 — Standardise on "Phases" (Stages → Phases)

**Resolves:** F11
**Touches:** `groundwork-product-brief/instructions.md`, `groundwork-design-system/instructions.md`, all three tracks, `templates/design-system-cache.md`

- [x] Rename "Stage" → "Phase" in `groundwork-product-brief/instructions.md` headings and prose
- [x] Rename "Stage" → "Phase" in `groundwork-design-system/instructions.md` and the three track files
- [x] Update `templates/design-system-cache.md` section headings to match
- [x] Sweep: `grep -rn 'Stage [0-9]\|Stages [0-9]' src/hidden-skills/groundwork-product-brief/ src/hidden-skills/groundwork-design-system/`
- [x] If during the rename you discover that Stages and Phases were carrying a useful distinction (e.g., Stages = within-skill steps, Phases = lifecycle gates), stop and surface the trade-off in this plan before completing the rename — rename judged safe: no distinction lost; per-skill phases and the operating-contract Phase Lifecycle coexist without ambiguity.

**Verify:** `grep -rn 'Stage [0-9]\b' src/hidden-skills/groundwork-product-brief/ src/hidden-skills/groundwork-design-system/` returns zero results.

### S11 — Converge cache mechanisms (scaffold + mvp)

**Resolves:** F12
**Touches:** `groundwork-scaffold/instructions.md`, `groundwork-mvp/instructions.md`, new files in `templates/`

- [x] Extract the inline cache structure from `groundwork-scaffold/instructions.md` to `src/hidden-skills/groundwork-scaffold/templates/scaffold-cache.md` (per-skill convention — both architecture and design-system locate their cache templates inside the skill directory)
- [x] Extract the inline cache structure from `groundwork-mvp/instructions.md` to `src/hidden-skills/groundwork-mvp/templates/mvp-cache.md`
- [x] Update each skill's initialization step to copy from the template, mirroring how `groundwork-architecture/instructions.md` Step 1 handles it
- [x] Verify the install path (`bin/groundwork.js`) places the new templates in the right location in installed projects — `cp -R src/hidden-skills/* .agents/groundwork/skills/` carries the new `templates/` subdirs through automatically
- [x] If templates are normally located inside the skill directory (`groundwork-architecture/templates/`), match that pattern; otherwise, place in the shared `templates/` directory consistent with how design-system handles it. Resolve the location by reading both existing patterns and picking the one with more callers — per-skill chosen (architecture + design-system both per-skill; shared `templates/` is used only for non-cache assets like `adr.md`, `discovery-notes.md`, `domain-entity.md`)

**Verify:** Both skills' initialization steps read "copy the template from `…templates/<name>-cache.md`" rather than embedding the cache structure inline. The new template files exist.

### S12 — Architecture/Scaffold vocabulary mapping table

**Resolves:** F7
**Touches:** `groundwork-scaffold/instructions.md` (Phase 1)

- [x] Add a "Generator Capability Mapping" reference table to `groundwork-scaffold/instructions.md` Phase 1, before the "Generator availability" table. Columns: architectural decision → generator + flag. Sample rows:
  - "End-user authentication via Clerk" → `nextjs-app --auth clerk`, `go-microservice --auth clerk`
  - "Service-to-service authentication" → `go-microservice --auth service`
  - "Transactional outbox via GCP Pub/Sub" → `--messaging gcp-pubsub`
  - "WebSocket real-time delivery" → `--websockets`
  - "LLM integration" → `python-microservice --llm`
- [x] Reference the table from Phase 1's "For each service in the proposal" bullet list so the agent looks here when translating architecture language into flags

**Verify:** `groundwork-scaffold/instructions.md` Phase 1 contains a Generator Capability Mapping table referenced from the service-mapping prose.

### S13 — TODO and final cleanup

- [x] Add a TODO.md entry deferring F14 (success-signal measurement plan) with a one-line description
- [x] Re-run the full review sweep: `grep -rn '## UX Design\|FR Coverage\|Stage [0-9]\b' src/hidden-skills/ docs/ 2>/dev/null` — clean in scope (only `nextjs-engineer/references/performance-and-deployment.md` Docker `# Stage 1/2/3` survive, out of scope)
- [x] Read through the green field flow end-to-end (product-brief → design-system → architecture → scaffold → mvp → bet/discovery → bet/planning) one more time to verify the journey reads cohesively. Open the lifecycle docs (`docs/lifecycle/01-setup.md`) alongside

**Verify:** No stragglers from prior slices remain. The end-to-end read produces no surprise — opening framing is consistent across skills, identifiers agree across writers and readers, and every artifact passes through review before commit.

---

## 8. How to Verify the Whole Plan Worked

When all slices are checked off, the following should be true:

1. **Lead with context.** Every greenfield skill opens with role + mental model before any imperative instruction. Read the first 30 lines of each `*/instructions.md` — none lead with directives.
2. **Identifier agreement.** No drift between writers and readers for `## Design System`, no FR references, no Stage/Phase mixing.
3. **Review coverage.** Every artifact in the green field flow goes through `groundwork-review` before commit: product brief, design system, architecture, infrastructure, MVP pitch, bet pitch, technical design.
4. **Operating contract framing.** All six methodology skills and the bet workflows share the same "standard assistant behaviour is what this prevents" framing.
5. **Cache mechanism.** Architecture, design-system, scaffold, and mvp all load their cache from a template file in a `templates/` directory. Inline templates are gone.
6. **NFR opening.** All three design-system tracks open NFRs by proposing first, not by exploring values.
7. **Translation contract.** Scaffold Phase 1 has an explicit mapping from architectural language to generator flags.
8. **App-shell signal capture.** Each design-system track's Stage 3 (App Shell) prompts the agent to write architectural implications into discovery notes.

---

## 9. Decisions Log

| Date | Decision | Author |
|---|---|---|
| 2026-05-26 | Plan created. All directional decisions in §4 locked. F14 deferred. | Review session |
