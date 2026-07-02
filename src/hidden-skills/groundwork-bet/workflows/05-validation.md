# Phase 5: Validation (Testing & Handoff)

**Goal:** Verify the implementation, capture each touched service's served contract into the canonical `docs/architecture/api/` record, archive the whole bet, fold what the bet learned back into the upstream documents, integrate the validated bet to trunk, and seed the next bet with any signals that surfaced during delivery.

A bet that ships without updating upstream docs leaves the next bet operating against a stale map. The Validation phase exists to close the loop — the test suite proves the implementation works, the Living Documents scan proves the rest of the system still describes reality.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). This phase is the back-feed mechanism for the entire GroundWork lifecycle — Living Documents and Discovery Notes updates here are what keep the upstream `docs/` artifacts useful for every bet that follows.

## Instructions

### Step 1: Mark validation status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: validation`.

### Step 2: Run the test suite

Execute the full bet-progress test suite: `./dev test bet <bet-slug>` (or `pytest tests/bets/<bet-slug>/` directly). Every test must pass before advancing — and run the **prose-integrity reconciliation once over the whole bet**. The approved decomposition commit is the baseline; through delivery the only changes to the decomposition prose are recorded amendments (each an Amendment commit carrying a reason) and additive authoring of later rungs. `git log --oneline -- docs/bets/<bet-slug>/decomposition/ docs/bets/<bet-slug>/technical-design/` since that baseline shows that trail and nothing else, and every built test still proves what its slice's Proof-of-work prose describes. (The per-slice reconciliation already guarded each step during delivery; this is the whole-bet confirmation.) The contract is the approved prose; the tests and implementation were built this phase and are supposed to have changed. A suite that drifted from the approved prose without a recorded amendment is not what the user approved — flag it and revert.

**Contract verification:** Confirm that no manual schema definitions or rogue HTTP calls were introduced during Delivery — cross-service calls use clients derived from the canonical `docs/architecture/api/<service>/` contract, and no endpoint, field, or table exists that the prose design and the captured contract do not define. A bet that delivered against side-channel contracts has compromised the architecture's integrity; flag it and revert.

### Step 2.5: Capture the canonical contract

The bet's API and data design were prose; the real machine-readable contract is what the running service serves. Now that the implementation satisfies the design, snapshot it. For each service this bet touched, capture the service's **served** OpenAPI — `GET /openapi.json` from the running service, or the framework's spec export (FastAPI and Huma generate it from the code) — into `docs/architecture/api/<service>/openapi.yaml` (creating it for a new service), and likewise `asyncapi.yaml` where the service serves events. It is captured from running code, never promoted from a bet spec — the prose design is the design commitment, the running service is the source of truth. The canonical per-service spec is what the generated contract-conformance tests and `groundwork-check` read — a bet that never captures leaves the canonical record describing the system before this bet existed.

### Step 2.6: Visual verification gate

**Conditional — graphical surfaces only.** Skip this step entirely, and say so in one line, when the bet touched no `graphical-ui` surface: a backend, CLI, or agentic bet pays nothing. For a bet that delivered a graphical surface, confirm the visual ladder before the bet can reach `delivered`:

1. **Tier 1 — the deterministic floor is green.** Confirm the three system gates passed in Step 2's run — `test_render_smoke.py`, `test_a11y_smoke.py`, `test_token_conformance.py`, defined at `04-delivery.md` Milestone close. A red layer or a platform with no runnable check blocks the bet — fail-closed, not skipped.
2. **Tier 2 — spec-conformance inspection happened.** Confirm each graphical milestone recorded its per-screen spec-conformance verdict during delivery (the `Visual:` line in the closing slice's delivery commit, from `04-delivery.md` Milestone close). That verdict is the designer-judged check: does the rendered surface match the written micro-polish spec, including the dimensions computation cannot assert — optical alignment, restraint, and whether the composition reads as considered. A milestone that closed with no verdict did not run the inspection — route it back.
3. **The whole-bet experience judgment.** Each milestone proved its own piece; now judge the assembled product end to end. Dispatch the experience-auditor lens (`briefs/experience-auditor.md`, the designer persona) over the finished bet's surfaces, driven the way the consumer drives them: is it **fully formed and a joy to use** — no dead-end flows across milestone seams, every async state present, the design system consistent, best-in-class patterns implemented in full? This is the same designer-eye judgment the per-milestone review applies, now at bet scope, where cross-milestone gaps (a flow that works within each milestone but breaks at the join) first become visible. A no here — a dead end, a half-built pattern, a screen that works but is not usable — **fails the bet**; route it back to delivery to fix, do not wave it through to `delivered`.

Report which tiers ran in one line, so the run/skip is auditable. There is no separate multimodal "is it as good as the references" grading pass for static frames: the craft bar is the concrete micro-polish spec enforced by Tiers 1–2, and the experience judgment above is the designer driving the running product, not grading screenshots.

### Step 2.7: Record the bet in the capability ledger

Skip this step entirely when the project has no `docs/surfaces.md` — a project without a registry has a single implicit surface and no ledger to maintain.

The capability ledger (in `docs/surfaces.md`) is where surface divergence becomes a recorded decision instead of silent drift, and validation is the one writer that appends capability rows. For each capability this bet delivered — user-meaningful, typically 1–3 per bet, coarse enough to stay readable, never per-endpoint — write its ledger row:

- **Row key:** `<bet-slug>/<capability-slug>` — stable, greppable, collision-free.
- **Every surface column filled** with exactly one state and its payload: `delivered` (this bet's slug), `planned` (a bet ref or discovery-notes pointer), `omitted` (one-line rationale), or `n/a` (no payload). The pitch's `surfaces:` scope and surface no-gos are the source: in-scope surfaces this bet delivered the capability to are `delivered`; deferred no-gos and surfaces left for a later bet are `planned`; omitted no-gos are `omitted`, carrying the pitch's rationale; structurally meaningless columns are `n/a`. A retired surface's column fills `n/a` automatically.
- **Cross-post every `planned` cell** as a bullet under `## Bets` in `.groundwork/cache/discovery-notes.md`, naming the capability key and the target surface — the next bet's Discovery reads that section, so the deferral becomes backlog instead of memory.
- **Update `.groundwork/surfaces.json` in the same change:** append the capability entries with the same keys, states, and payloads. The prose ledger and its machine twin are projections of the same decisions; they never drift.

**The gate:** a bet cannot reach `delivered` status with an empty ledger cell. An unfilled column is an undecided divergence — decide it with the user (`planned`, `omitted`, or `n/a`) before Step 8.

**Shallow ledger update (insufficient):**

```markdown
| `notifications/status` | delivered | planned | planned |
```

States without payloads, `planned` cells pointing nowhere, nothing cross-posted to discovery notes, the JSON twin untouched — a deferral recorded where no future bet will find it is silent drift wearing a ledger row.

**Deep ledger update (required standard):**

```markdown
| Capability | web-app | admin-cli | mcp-server |
|---|---|---|---|
| `notification-delivery/in-app-status` | delivered (`notification-delivery`) | planned (discovery-notes — operators asked for failure visibility during the Step 4 review) | omitted — agents query operation status directly via the contract; a push feed duplicates it |
```

Plus, in the same change: the `planned` cell cross-posted under `## Bets` in discovery notes ("`notification-delivery/in-app-status` → `admin-cli`: operators need failure visibility; deferred from `notification-delivery`"), and `.groundwork/surfaces.json` gaining the matching capability entry with identical states and payloads. Every column decided, every decision findable.

### Step 3: Archive the whole bet

Move the whole bet out of the active tree: `docs/bets/<bet-slug>/` → `docs/bets/_archive/<bet-slug>/` **and** `tests/bets/<bet-slug>/` → `tests/bets/_archive/<bet-slug>/`. Run `./dev archive bet <bet-slug>` if the CLI is available — it now moves both; otherwise `git mv docs/bets/<bet-slug> docs/bets/_archive/<bet-slug>` and `git mv tests/bets/<bet-slug> tests/bets/_archive/<bet-slug>`. The active docsite Bets section then shows only in-flight bets.

The permanent best-practice tests rolled out during Delivery (in service repos and `tests/system/`) remain in place — they are the ongoing coverage for this feature going forward. The bet's prose and its bet-progress suite served their purpose as the definition of done and the proof-of-work scaffolding; they are now archived as the bet's record.

### Step 4: Review with the user — they drive the real product

The bet's success signal is the owner using the real shipping product the way its consumer will — running the agreed front-door cases against the build that actually ships, on real data. A green suite and a clean experience judgment are the evidence; the owner driving it is the confirmation. Walk them to the shipping build (not a test target), have them carry out the milestones' headline cases, and watch what happens on the real surface. Then summarise what was delivered — the user-facing changes, the new contracts, and any constraints the implementation revealed. Capture the user's reactions — corrections, requests for follow-up bets, anything that surprised them, or anything that did not feel right in their hands — they all belong in the next step's scan, and a "this isn't usable the way I expected" here is a finding, not a closing pleasantry.

### Step 5: Apply the Living Documents protocol

The architecture of the system has changed. Every upstream document that describes the changed surface must be updated to match — surgically, in place, without asking permission. This is the single most important step of the phase, and the one most likely to be skipped under deadline pressure.

For each `docs/` artifact, scan the bet conversation and the delivered code for what now contradicts the document. Apply targeted updates. Report what changed. **One rule covers all three persona adoptions below:** when a refinement is structural (architecture), a design change (design system), or vision-level (product brief), adopt the matching persona — architect, designer, or product (`.groundwork/skills/groundwork-architect/SKILL.md`, `groundwork-designer/SKILL.md`, `groundwork-product/SKILL.md`) — so the update carries the document's own reasoning standard.

Documents to scan, in order:

1. **`docs/architecture/index.md`** — new services, new boundaries, refined data flows, new technology choices, new service-level requirements. The Service-Level Requirements table is the most common update target.
2. **`docs/design-system.md`** — new design patterns, new component variants, new interaction states, refined accessibility commitments. Update only when the bet introduced something the design system did not anticipate.
3. **`docs/product-brief.md`** — new user types, refined success criteria, capabilities that turned out to be load-bearing in ways the brief did not capture. Vision-level refinements only; the brief is not a changelog.
4. **`docs/architecture/infrastructure.md`** — new services in the local topology, new ports, new health endpoints, new commands. The infrastructure document must continue to describe a system that actually runs.
5. **`docs/surfaces.md`** — when it exists: registry entries whose reality changed (a `planned` surface this bet activated, a changed core-access path or test medium), and confirm Step 2.7's ledger rows landed with their `.groundwork/surfaces.json` twin in lockstep. Skip when the project has no registry.
6. **`docs/maturity.md`** — the maturity roadmap. Mark every row this bet closed as `closed (<bet-slug>)`, re-assess the dimensions the bet touched (a bet that captured a service's OpenAPI contract into `docs/architecture/api/` may move D2 from 🟡 to ✅ — cite the new evidence), open new rows for gaps the bet revealed or introduced (a new service shipped without a contract is a new `standard-divergence` row), and append one line to `## History`. Re-stamp `last_reviewed`. On a registry project, re-assess D8 (surface parity discipline) against the ledger state Step 2.7 just wrote — a `planned` cell aging past three closed bets with no referencing pitch is what moves it off ✅. If this bet activated a second independently-deployed surface or changed a published contract, re-assess D9 (contract compatibility): the stance must stand under architecture's Binding Constraints and the contract-conformance tests must show no breaking drift.

For each document updated, report the change in one line: "Updated `docs/architecture/index.md` — added `notification-service` to service map and SLR row for at-least-once delivery."

**Distinguish refinements from reversals (Protocol 2).** Most bet updates are refinements — new rows, new boundaries, additive detail. But if the bet *overturned* a prior Key Decision or Binding Constraint, or you are about to write a superseding ADR in Step 7, that update is a **reversal**, and the Reversal Protocol applies even in Continuous Bet mode (Protocols 1, 2, 4, 8, and 9 apply to the bet). For each reversal: reconcile the *full body* of the affected doc and every dependent doc it touches, write the superseding ADR (Step 7), and **re-invoke `groundwork-review` on each mutated doc** (Protocol 9), with the matching `document_type`. The re-gate is fail-closed and the revise cap applies (Protocol 8): proceed only on a parseable `VERDICT: PRESENT` per doc. Because the reversal supersedes an ADR, also re-review **every** `docs/architecture/domain/*.md` unconditionally (`document_type: domain-entity`) — their `Owner:`/fields go stale silently since they carry no summary to flag the drift, and they are the dependents most often missed. A bet that mutates four setup docs is exactly where contradictory canonical docs creep in — the re-gate is the guard.

If a scan finds nothing to update, say so explicitly. Silence is ambiguous — the user cannot tell whether you scanned and found nothing or skipped the scan.

### Step 6: Update discovery notes

Scan the bet conversation for signals that belong to a future bet — sequencing instincts ("we should do notifications next"), parking-lot ideas ("the search experience needs its own bet"), constraints the user surfaced about subsequent work. Append these as bullets under `## Bets` in `.groundwork/cache/discovery-notes.md` so the next bet's Discovery phase finds them.

Remove any discovery-notes entries that were incorporated into the artifacts updated in Step 5. A signal that has been promoted into a permanent document does not belong in the parking lot.

### Step 7: Write ADRs for significant decisions

Review the technical decisions made during this bet. If any decision was significant enough to warrant a permanent record — a stance future bets should not relitigate without a new ADR — write an ADR to `docs/architecture/decisions/NNNN-<slug>.md` using the template at `.groundwork/skills/templates/adr.md`.

Significance test: would a new engineer joining the project six months from now need to know this decision to avoid revisiting it? If yes, record it. If no, skip. Not every bet produces an ADR. *(Quick-bet depth: a `track: quick` bet's local, non-structural change rarely clears this bar — skip unless it genuinely set a stance future work must not relitigate.)*

Number sequentially: read the existing `docs/architecture/decisions/` directory and use the next available integer (zero-padded to four digits). Create the `docs/architecture/decisions/` directory if it does not exist.

### Step 7.5: Run the bet retrospective

A bet that ships without extracting its lessons leaves the next bet to rediscover them at delivery prices. The retrospective is one facilitated pass over four mechanics — checklist items in a single conversation, not a ceremony — and its output is `docs/bets/<bet-slug>/retrospective.md` plus action items the next bet reads.

**Quick-bet depth.** For `track: quick`, skip the formal retrospective: a single-milestone change has no cross-slice pattern to mine — the mining looks for a finding type recurring across *two or more* slice reviews, which a one-or-few-slice quick bet does not have. Fold any forward signal into discovery notes (Step 6) and any readiness caveat into the hand-off, and move on. Run the full pass below only when a multi-slice quick bet genuinely surfaced a recurring pattern worth recording.

1. **Mine the slice records.** Read the bet's delivery commits — `git log` of the `bet(<bet-slug>): slice ...` commits, their changed files and their `Notes:` lines — plus any change proposals or amendments in the bet directory. Surface *patterns*, not anecdotes: a finding type that appeared in two or more slice reviews, a struggle that recurred, a proof that needed amending. One-off issues are noise; repeats are process signal.
2. **Audit the previous bet's action items.** Read the previous bet's `retrospective.md` (if one exists). For each action item: done, in progress, or ignored — and if ignored, did it cost us this bet? An item that was ignored *and* costly escalates to a `docs/maturity.md` row so it stops depending on anyone's memory.
3. **Detect significant discoveries.** Check whether this bet invalidated anything queued bets depend on: an architectural assumption broken, a dependency the next pitch does not account for, debt that changes the appetite math, user behaviour different from what the brief assumed. On detection, recommend re-pitching the affected bets before the next one starts — never start a bet on premises this one just disproved. Whether a discovery overturns a queued bet's premise — changed user behaviour, shifted appetite math, or resequenced priorities — is a product judgement; adopt the product persona (`.groundwork/skills/groundwork-product/SKILL.md`) when weighing a re-pitch.
4. **Explore readiness.** Green is not live. Confirm with the user where the delivered work actually stands — deployed, accepted, observed in use — and carry anything unresolved forward as an explicit item rather than an assumption.

Write `docs/bets/<bet-slug>/retrospective.md`: the patterns found, the follow-through audit results, any discovery alerts, the readiness state, and the action items — each with a stable ID (`<bet-slug>-R1`, `-R2`, …) so the next retrospective can audit them mechanically. Append the action items as bullets under `## Bets` in `.groundwork/cache/discovery-notes.md`, each carrying its ID — the next bet's Discovery phase already reads that section.

### Step 8: Mark the bet delivered

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivered`. On a registry project, Step 2.7's gate applies: do not write `delivered` while any ledger cell for this bet's capabilities is empty — fill the column or the bet does not close.

Remove the active-lane sentinel now the lane is closing — `rm -f .groundwork/cache/active-lane` — so the capture reminder hook resumes guarding direct edits outside any lane.

### Step 8.5: Integrate the bet to trunk

The bet has ridden its own branch (`bet/<bet-slug>`) in an isolated worktree since Delivery (`04-delivery.md`, "Git workflow: a branch per bet"). With the suite green, the canonical contracts captured, the bet archived, and the upstream docs reconciled, the branch now holds a complete, validated bet — and trunk is ready to receive it. Integrating is a single **user-gated** step: merging to a shared branch is the user's call, never the driver's alone (the same standard that gates any push to a remote).

1. **Rebase onto current trunk.** `git fetch origin`, then rebase `bet/<bet-slug>` onto `origin/<trunk>` to absorb whatever landed during the bet. Re-run the project's full test suite (`./dev test` or `./dev ci`) once after the rebase — the permanent best-practice tests rolled out during Delivery, not the now-archived bet-progress suite — so trunk receives a green merge, not an assumed one.
2. **Fast-forward merge to trunk, then push `origin/<trunk>` — on the user's explicit go-ahead.** The push to `origin/main` is *the* gated action of the whole delivery: ask first, every time. (Backup pushes of the `bet/<bet-slug>` branch run freely during delivery — they publish nothing into trunk; the trunk push never does.) Trunk only ever receives a complete, validated bet, so nothing half-built lands and no feature flag is required to keep it releasable.
3. **Tear down the isolation.** Remove the worktree (`git worktree remove <path>`, then `git worktree prune` — never `rm -rf`, which strands `.git/worktrees/` metadata) and delete the merged branch — locally, and, if it was pushed for backup during delivery (`04-delivery.md`, "Push the bet branch as you go"), its remote too (`git push origin --delete bet/<bet-slug>`). The bet's decomposition prose and its recorded amendment trail live on in the merged history — that is the permanent record.

**By topology** (`04-delivery.md`, "Recording a cross-service slice"): a **monorepo** merges one branch. For **submodules**, fast-forward each affected submodule's branch and push it, then land the final superrepo gitlink-bump merge last. For a **polyrepo**, fast-forward each repository's branch in producer-before-consumer order (or gated on the contract check), the change-set manifest recording the set; there is no single merge.

### Step 9: Hand off

Confirm the bet is complete. Summarise what was delivered, what was updated upstream, and what was parked for the next bet. Recommend a fresh context for the next bet — the rich delivery context has been compressed into doc updates and discovery notes, so the next bet does not need it.

## Quality Standard: What "Deep Enough" Looks Like

The handoff fails when the Living Documents scan is a checkbox instead of a surgical update. A handoff that says "no changes needed" without naming what was scanned is indistinguishable from a handoff that skipped the scan entirely. The standard is concrete: state what you read, name what changed, and quote the change.

**Shallow output (insufficient):**

```
Validation complete. Tests pass. Handing off to groundwork-doc-sync to refresh
the docs.
```

**Deep output (required standard):**

```
Validation complete.

Test suite: 47/47 passing. Contract verification: all cross-service calls
use the generated `notification_client`; no rogue HTTP found.

Whole bet archived: docs/bets/_archive/notification-delivery/ and
tests/bets/_archive/notification-delivery/.

Living Documents scan:

- `docs/architecture/index.md` — added `notification-service` to the service map
  (Phase 3 — Service Design). Added two rows to the Service-Level
  Requirements table: at-least-once delivery for outbound notifications,
  idempotent webhook handler on the receiving side. Tech stack updated to
  reference NATS JetStream as the chosen async transport with the same
  reasoning attached to existing entries.
- `docs/design-system.md` — added `Toast` component variant for delivery-status
  notifications. Updated interaction states to include the dismissable
  state with focus-trap behaviour.
- `docs/product-brief.md` — no changes; the bet implemented capabilities
  already described.
- `docs/architecture/infrastructure.md` — added `notification-service` (port 4002,
  health endpoint `GET /health`) to the services table. Added NATS to
  the infrastructure components table (port 4222, container
  `<app>-nats`). Updated `./dev start` verification footnote to include
  notification flow.
- `docs/surfaces.md` — ledger row `notification-delivery/in-app-status`
  written: web-app delivered (`notification-delivery`), admin-cli planned
  (cross-posted to discovery notes), mcp-server omitted (agents query
  operation status via the contract). `.groundwork/surfaces.json` updated
  in the same change; no empty cells.

Discovery notes:

- Removed two `## Design Details` entries that were incorporated into the
  notification service's contract.
- Appended one `## Bets` entry: "Search experience parked — the user
  raised it three times during this bet, and the architecture's search
  capability is currently unmapped. Next bet candidate."

Bet status: delivered.
```

The shallow version tells the user nothing. The deep version proves the scan happened, names what changed and why, and surfaces the discovery-note delta so the next bet starts with a clear inheritance.

The same standard applies across every scan target:
- **Architecture updates** must name the section, the change, and the reasoning — not just "added a service."
- **Design System updates** must name the component or pattern that changed and whether existing patterns are affected.
- **Brief updates** must justify the vision-level change against what the user actually said during delivery.
- **Infrastructure updates** must include the concrete observable changes — ports, commands, health endpoints — not a summary.
- **Ledger updates** must carry every cell's state with its payload and name where each `planned` deferral was cross-posted — a state without its payload is a decision without its record.

## Congratulations

Once Steps 1 through 9 are complete and the user has seen the handoff summary, congratulate them on a successful bet. The cycle returns to the orchestrator for the next bet or anytime skill.
