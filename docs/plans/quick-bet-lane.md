# Implementation Plan: The Quick Bet Lane + Work Intake Capture

**Status:** PROPOSED 2026-06-28. Nothing executed. Design-lock pending user approval of the open decisions in §7.
**Audience:** An engineer or agent implementing this change. Each workstream names its files and an acceptance check; the judgment calls that remain are §7 open decisions.
**Scope owner:** A new `groundwork-quick-bet` hidden skill, the `groundwork-orchestrator` skill (description + a new Work Intake triage), the shipped `src/AGENTS.md`, and `groundwork-persona` — with light, reuse-only touches to `groundwork-bet` (`04-delivery.md` / `05-validation.md` consume the quick bet's output unchanged) and `groundwork-patch` (demotion target).

---

## 0. Read this first — the mental model

Two problems, one front door.

**Problem 1 — Capture. Most work requests never enter GroundWork at all.** Live testing shows the common case: a user in a GroundWork project says "can we add a button to delete an image" and the agent just *does it* — straight to code, bypassing the entire methodology. The audit confirms why: nothing in the shipped `AGENTS.md`, the orchestrator's `description`, or the persona tells an agent that **a build request is a routing trigger**. The four Intent-Handling cases in `AGENTS.md` match "what's next?", "help", "can we scaffold?", and explicit skill calls — a plain "add a delete button" matches none, so the agent falls through to its default: implement directly. GroundWork is **opt-in on invocation** when it needs to be **always-on for work requests**.

**Problem 2 — Granularity. The two existing lanes leave a gap.** `groundwork-patch` is the floor: one user-facing goal, **no new capability, no contract or schema change** — a typo, a copy tweak, a bug fix. `groundwork-bet` is the ceiling: five gated phases, a four-file design contract, a 2–5 rung milestone ladder, driver/slice-worker delivery. "Add a delete button" falls between them — it *is* a new capability and almost certainly touches an endpoint, so it is not a patch; but a five-phase bet with a milestone ladder is over-ceremony for one button. There is no lane for the small-but-real change.

**The thesis.** The bet splits into five gated phases because *at bet scale*, mixing modes — what/why, UX, architecture, proof — produces shallow work in all of them. At *small* scale that isolation is pure overhead: the whole change fits in one sitting, so a single AI-driven pass can hold every dimension at once without going shallow. So the new lane is **not a slimmer patch — it is a compressed bet**: it touches every dimension a bet touches, but as a *paragraph each in one plan* instead of a *phase each*, and it produces **exactly one milestone**, then hands that milestone to the bet's existing delivery machinery.

**The organizing idea:** add one lane and one capture rule. The lane (`groundwork-quick-bet`) is a compressed *authoring front-end* — it never re-implements delivery. It emits the same approved decomposition artifact `04-delivery.md` already consumes (one milestone, its slices, a front-door proof, the approval tag), so run-till-green, the review lenses, the honest-green checks, and the git contract are all inherited for free. The capture rule makes every build/change/fix request route through the orchestrator's **Work Intake** triage, which sizes the ask into **patch · quick bet · bet** and proposes a lane the user confirms or overrides.

**Three lanes, one front-door choice.** The user sees two tracks when they ask to build — quick bet vs bet — with patch as the quiet floor a quick bet demotes into when it turns out nothing needs designing. Escalation and demotion are first-class: a quick bet that grows a second milestone's worth of work promotes to a bet (carrying its plan as discovery input); one that shrinks to "no design needed" demotes to a patch.

---

## 1. Findings this plan responds to

IDs are referenced by the workstreams below.

| ID | Finding | Severity |
|---|---|---|
| C1 | No surface tells an agent that a build/change/fix request is a routing trigger. `AGENTS.md` "Start here" is read once at session start; mid-session work requests fall through to direct implementation. | Critical — capture |
| C2 | The orchestrator `description` matches only "GroundWork lifecycle task" / "update groundwork". It does not match "add X", "build X", "fix Y", "implement Z" — so a skill-aware agent never fires it on a work request. | Critical — capture |
| C3 | The persona governs tone, not routing. It is the always-loaded posture but carries no reflex to route work through the process before coding. | High — capture |
| G1 | No lane exists for a small-but-real change: a new user-facing capability with a local contract delta that fits one sitting. Patch forbids it (new capability / contract change); a full bet over-ceremonies it. | High — granularity |
| G2 | The patch/bet boundary is a binary with no triage rubric the front door can apply to size an incoming ask into the right lane. | High — granularity |
| G3 | `04-delivery.md` healthy-ladder guidance ("2–5 milestones; fewer is probably not scoped in demonstrable increments") would read a legitimate one-milestone quick bet as malformed unless delivery is made track-aware. | Medium — reuse seam |

**Strengths this plan must not regress:** the proof discipline (front-door proof, honest-green, no fake-without-real-behind-it); the delivery driver/slice-worker split and its review lenses; the git contract (bet branch + worktree + Conventional Commits, trunk receives only validated work); the patch ledger as the clustering signal; the operating contract's pacing and Living Documents protocols.

---

## 2. Workstream A — Work Intake capture (close the leak; do first)

Nothing downstream matters if the request never enters the process. These changes make a build request a routing trigger across every surface an agent actually reads.

**A1 — `src/AGENTS.md`: a prominent intake rule (C1).**
Add a top-level section directly under "Start here" that names the trigger explicitly and makes routing the rule even mid-session. Draft:

> ## Before you build anything
> Any request to **add, build, change, fix, or implement** — "add a delete button", "fix the upload bug", "let's build the dashboard" — routes through the **orchestrator** first, not straight to code. The orchestrator sizes the work into one of three lanes — **patch** (a fix or tweak), **quick bet** (one small new capability), or **bet** (a substantial feature) — and runs the right one. This holds mid-session too: a coding request is the signal to size the work, not to start typing. Implementing directly is the one thing that breaks GroundWork — the process is how the change gets designed, proven, and recorded.

*Accept:* the section ships in `src/AGENTS.md`; a returning-session work request has an explicit, unmissable rule pointing at the orchestrator.

**A2 — Orchestrator `description`: broaden the matcher (C2).**
Extend the `description:` frontmatter in `src/skills/groundwork-orchestrator/SKILL.md` so a skill-aware agent fires it on work requests, not just lifecycle phrasing. Append intent language: *"…AND whenever the user asks to build, add, implement, change, or fix anything in this project — it sizes the work into a patch, quick bet, or bet and runs the right lane. Run it before implementing any code change."* Keep the description within its current register; this is the single highest-leverage capture fix for Claude Code's skill matcher.

*Accept:* the description names build/add/fix/implement intent; manual read confirms a casual work request would plausibly match.

**A3 — Persona: a capture reflex (C3).**
Add one short subsection to `groundwork-persona/instructions.md` (it is the always-loaded posture, so the reflex belongs here, stated as posture not procedure): when a user asks for work, the expert peer's instinct is to *size and route it*, not to start coding — because in this project the process is how a change gets designed and proven. One paragraph; defer the actual triage mechanics to the orchestrator (no duplication).

*Accept:* the persona carries the reflex without re-implementing the triage table.

**A4 — Orchestrator Intent Handling: the Work Intake triage (C1, G2).**
Add a new case to the Intent Handling section of both `src/AGENTS.md` and the orchestrator `SKILL.md`: **"User requests work (build / add / change / fix X)."** It runs the triage in §3, **proposes** the recommended lane (propose-first, per persona — "This looks like a quick bet: one plan, one milestone, delivered to green. Want that, or treat it as a full bet?"), and routes on confirmation. Borderline asks propose the lighter lane and name the escalation trigger out loud.

*Accept:* the triage case exists; it produces a lane recommendation and an explicit user-confirmable offer; it is the only place the triage rubric lives (patch and bet reference it, never restate it).

---

## 3. The Work Intake triage rubric

The heart of correct sizing. The front door applies this to an incoming work request and proposes a lane. It lives once, in the orchestrator's Work Intake case; §2/§4/§5 reference it.

| Signal | → Patch | → Quick bet | → Bet |
|---|---|---|---|
| New user-facing capability? | No — corrects/refines existing behaviour | Yes — one small one | Yes — possibly several |
| Contract / schema change? | None | Local & simple (one endpoint or field) | Structural or multiple |
| Design thinking needed? | None | Light — fits one plan, reuses the design system | Substantial — needs a locked contract |
| Milestones | n/a | **Exactly one** | 2–5 |
| Consumers | n/a | One | One or more |
| Risk / reversibility | Trivial | Bounded | Significant blast radius |
| Proof | Test + ledger row | One front-door proof | A milestone ladder of proofs |
| Fits one sitting? | Yes | Yes | No |

**Routing rule.** Patch when *every* row is in the patch column. Bet when *any* row is in the bet column. Quick bet otherwise. Ties and borderlines resolve to the **lighter** lane with the escalation trigger named — a quick bet that proves bigger promotes to a bet mid-flight; over-ceremony is the costlier error. The user can always override; an override is recorded in the lane's own artifact so the retrospective sees it.

---

## 4. Workstream B — The `groundwork-quick-bet` skill

A new hidden skill at `src/hidden-skills/groundwork-quick-bet/instructions.md`. It is a compressed authoring front-end that produces the one-milestone decomposition `04-delivery.md` consumes — it never re-implements delivery.

**B1 — Skill skeleton + registration.**
Create `src/hidden-skills/groundwork-quick-bet/` with `instructions.md` (frontmatter `name: groundwork-quick-bet`, a description naming the small-new-capability lane). Load `operating-contract.md` (contract v1) in **Maintenance mode** — Protocols 1, 2, 4; Protocols 8/9 on the single review pass. Reference `groundwork-writer` at the plan-drafting step. Add the row to the orchestrator's Skill Paths table.

**B2 — The lane flow.** Five compressed steps, mirroring the bet dimensions one paragraph each:
1. **Scope test** — confirm the ask is a quick bet, not a patch (no new capability → demote) and not a bet (multi-milestone / structural contract → escalate). Reuse §3 — do not restate it.
2. **Clarify** — one tight, propose-first question cluster (not a questionnaire; per persona + the UX interview pattern). Skip when the ask is already unambiguous.
3. **Discover** — the AI reads the tech itself: repo-map / code-intelligence orient, existing patterns, the design system, the touched service's contract. This is the "mostly AI-driven" core — autonomous, no user round-trips.
4. **One plan** at `docs/bets/<slug>/quick-plan.md` (see B3) — proposed in full for **one approval gate**.
5. **Hand to delivery** — on approval, materialize the one-milestone decomposition + approval tag (B4) and route to `04-delivery.md`.

**B3 — The quick-plan artifact.** A single doc, every bet dimension as a section:
- **Goal & why** — the problem, the one user-facing outcome, appetite stated as "small / one sitting", and **no-gos** (the escalation guard — what this explicitly does not do).
- **UX** — what the user sees and does; states; *which existing design-system patterns and tokens it reuses* (a quick bet leans on the system, it does not invent one).
- **Architecture & data** — the touched service / endpoint / table; the local contract delta at design fidelity (the shapes the proof traces to); reuse over new.
- **Proof** — **one** front-door proof: consumer action → observable result, the test-file path, honest-green (real front door, no fake without a real test behind it). This is the success signal made executable, for one milestone.

**B4 — Emit the delivery contract.** From the approved plan, write the decomposition tree `04-delivery.md` already expects: `docs/bets/<slug>/decomposition/` with **one** milestone `index.md` (consumer, demonstrable goal, acceptance, Proof of work) and its slice file(s), then the `bet/<slug>/approved` tag on the approved-prose commit. Set pitch/plan `status: delivery` and `track: quick`. From here the existing driver runs unchanged.

**B5 — Validation-lite.** On milestone green, run a compressed `05-validation`: capture any contract delta into `docs/architecture/api/`, Living-Documents pass, archive the quick bet, and — the cross-lane honesty hook — append a row to the **patch ledger's sibling** (or a `quick-bet` section of it) so clustering quick bets in one area still surface as a real-bet signal. *Open decision O3.*

*Accept (WS-B):* a quick bet runs end to end — intake → clarify → discover → one plan → one approval → delivery to green → validation — reusing `04-delivery.md` with zero forks of the delivery engine.

---

## 5. Workstream C — Reuse seams (make the existing machinery track-aware)

Minimal, additive touches so the bet machinery accepts a one-milestone quick bet without complaint.

**C1 — `04-delivery.md` track-awareness (G3).** The "2–5 milestones is healthy; one is probably mis-scoped" guidance must not fire for a quick bet. Gate that check on `track: quick` — a quick bet is *defined* as one milestone. No other delivery logic changes.

**C2 — `groundwork-bet` activation note.** Add one line to `groundwork-bet/instructions.md` activation: a pitch carrying `track: quick` was authored by the quick-bet lane and enters at `04-delivery.md`; the bet skill does not re-run discovery/design/decomposition for it.

**C3 — `groundwork-patch` demotion target.** Add one line to the patch skill: a quick bet that turns out to need no design demotes here, carrying its scope note. Symmetric with patch's existing escalation-to-bet line. (Patch already routes *up*; this names the *down* arrival.)

*Accept (WS-C):* delivery and validation run a quick bet unmodified except for the `track: quick` gate; patch and bet name the new lane as a neighbour without absorbing it.

---

## 6. Sequencing & gates

**Order.** WS-A first — capture is the leak; until a build request reliably enters the process, the lane is unreachable in the wild. Then WS-B (the lane itself), then WS-C (the reuse seams, which WS-B depends on for clean delivery hand-off).

**Shipping gates (per the contributor guide).**
- This change touches the shipped surface (`src/AGENTS.md` is tier-2; the new skill is tier-1 clean-copied). The new skill needs **no migration** (clean-copy carries it). The `AGENTS.md` edit is tier-2 — it propagates via the refresh/merge path but still needs a `CHANGELOG` line. Annotate `[no-migration]`.
- `./dev ci` green (lint + generation + contracts + cli + compilation), including the changelog↔registry cross-check and the sync-anchor gate.
- The orchestrator's `workflow-index.md` is generated from its routing tables — regenerate after adding the Skill Paths row and the Work Intake case.
- A live simulation through the new lane (a real Claude Code session: utter "add a delete button" in a scaffolded sandbox, confirm the agent sizes it to a quick bet and runs the lane to green) — the only proof that capture actually fires.

---

## 7. Decisions

### Settled (with rationale)
- **D1 — Three lanes, patch stays the floor.** Quick bet is the new middle; the front door offers quick-bet-vs-bet; patch is the quiet floor a quick bet demotes into. Keeps each lane's job sharp. *(User, 2026-06-28.)*
- **D2 — Quick bet reuses the delivery engine.** It authors one milestone and hands to `04-delivery.md` — no new run-till-green machinery. *(User, 2026-06-28: "we already have the run-till-green machinery in bet delivery; fast track sets up a quick milestone and delivers it.")*
- **D3 — Name: quick bet.** Lanes are `bet`, `quick-bet`, `patch`. *(User, 2026-06-28.)*
- **D4 — Capture is first-class.** AGENTS.md intake rule + broadened orchestrator description + persona reflex + the Work Intake triage. *(User, 2026-06-28: "most requests to do work don't even trigger groundwork… make sure we pick up and route these workflows.")*

### Open (need a ruling before or during execution)
- **O1 — Artifact location & shape.** `docs/bets/<slug>/quick-plan.md` as a single doc that *then* emits a one-milestone `decomposition/` for delivery (proposed). Alternative: skip the separate plan doc and have the quick-bet skill author the slim pitch + one-milestone decomposition directly, with the "plan" being that tree reviewed in one pass. The first is more readable as a single artifact; the second removes a translation step. **Recommend the first** — the single plan doc is the thing the user approves; the decomposition is mechanical fallout.
- **O2 — One approval gate or two.** The plan-approval gate is fixed (D2's delivery then runs to green). Question: does delivery still pause to show the diff before commit, or run fully autonomous to a green milestone and report? **Recommend one gate** (approve plan → run to green → report), matching the "mostly AI-driven" goal, with hard stops (contract surprise, scope growth → escalate) still pausing. Revisit if live sim shows the autonomous commit is uncomfortable.
- **O3 — Quick-bet ledger.** Reuse `patch-ledger.md` with a `quick-bet` section, or a sibling `quick-bet-ledger.md`? Clustering signal must still reach bet discovery either way. **Lean: one ledger, two sections** — discovery reads one file.
- **O4 — Does a quick bet get its own branch/worktree?** The bet git contract is branch + worktree per bet. A quick bet is one milestone — same contract, or commit on a short-lived branch off trunk without a full worktree? **Lean: same contract** (uniformity; delivery already bootstraps it), but a lighter single-branch option is worth a look if worktree setup dominates the wall-clock of a one-button change.

---

## 8. What this plan deliberately does not do
- It does not fork or duplicate the delivery engine — every reuse is a reference or a one-line gate.
- It does not touch the patch scope test or the bet's five phases beyond naming the new neighbour.
- It does not add a generator, a CLI command, or a new doc family — capture lives in instructions the agent already reads, and the lane lives in one hidden skill.
