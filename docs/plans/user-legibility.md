# Implementation Plan: User Legibility (Owner-Language Boundary, Rendered Orientation, Live Docsite, Host-Native Review)

**Status:** WAVES 1–2 EXECUTED 2026-07-04 — Wave 2 landed on `user-legibility/wave2`: B1 (`groundwork-method status` renderer, 28 contract tests, hardened after adversarial verification with a bounded suite run, slice-derived milestone states, and a slug guard), C2 (`status --write` page + archive removal in both the `./dev` bundle and the manual fallback), and the B3 swap (contract + orchestrator render via the verb; hand-composition is the fallback). `./dev test cli` (228) and `./dev ci` green. Wave 1 — WS-A (A1–A5), B2/B3, B4, and C3 landed as slice commits on `user-legibility/wave1`: Protocol 11 + the tiered checkpoint-snapshot contract in the operating contract, report-point jargon purge, term hygiene, voice re-anchoring, naming guardrails, branch-at-promotion, `check_report_point_language` (verified fail-closed on a seeded regression), and the sim-judge legibility dimension. `./dev lint skills` and `./dev check sync-anchors` green; the Wave-1 gate's live delivery-sim run with the extended rubric is owed (driver-gated, like prior waves' runtime halves). Remaining: Wave 3 (C1/C4 docsite aggregation + D1–D3 host review). All decisions settled 2026-07-04 (§6 carries no open items). Sourced from three research streams run to conclusion: (1) a communication audit of 71 magpie session transcripts (7,574 main-chain assistant messages) cataloguing jargon, checkpoint shapes, and every documented moment of user confusion; (2) a full jargon-origin and status-report-shape audit of the shipped skill corpus (`src/hidden-skills/`, `src/skills/`, `src/engineer-skills/`), with file:line for every coinage and every prescribed user-facing line; (3) a machinery map of progress state, the docsite pipeline, and draft-presentation instructions.
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; every judgment call is settled in §6.
**Scope owner:** The user-facing boundary of the whole framework — `groundwork-persona`, `operating-contract.md`, the `groundwork-bet` delivery loop and briefs, the orchestrator, `bin/groundwork.js` (status rendering), and the `docs-site` generator.

---

## 0. Read this first — the mental model

GroundWork speaks two languages, and the bug is that it speaks the wrong one to the user.

**Engine language** — seal, red board, lens, capsule, pack, wire formats (`VERDICT:`, finding buckets), tier names, protocol numbers — coordinates the agent fleet. It is precise, load-bearing, and must not be weakened: a driver that says "the review passed" to a *subagent* instead of gating on `VERDICT: PRESENT` has broken a fail-closed gate. **Owner language** — what works now, what you can try in the app, what needs your decision, where this milestone sits in the bet and the bet in the program — is what the user is buying. The user follows the product being built, not the bookkeeping it is built with.

Today the corpus mandates engine language at nearly every user-facing report point and mandates owner language in exactly one place — `groundwork-persona`, a skill loaded once at session start and never again. The agent speaks whatever the most-recently-loaded file speaks, and during delivery the most-recently-loaded file is always a step file or a subagent report written in engine language. This is why persona-only fixes decayed: they lost a recency contest they were structurally guaranteed to lose. Three transcript symptoms confirm the cost — the worst documented user moment ("Are these even milestones? What is a M-Model anyway?") was caused by unguarded milestone naming; recurring "Ok, where are we?" messages follow every compaction; and "How do I run the app so I can test?" recurs because green is reported without run instructions.

The fix is structural, not exhortative:

1. **Put the owner-language duty inside the report points themselves.** The step files and briefs the agent holds at speaking time carry the translation rule — the last-loaded file wins the recency contest, so make the last-loaded file the one that says how to speak.
2. **Render orientation deterministically; never leave it to recall.** The engine already derives the full board (`./dev bet status --json`, `state --bet`); a CLI renderer emits the "you are here" snapshot as ready-to-paste markdown. A rendered artifact cannot decay with context the way a remembered instruction demonstrably does.
3. **Put in-flight truth where the user already looks.** The docsite aggregates every active bet — worktrees and branch-only — so the site stops being a museum of the last merge.
4. **Hand approval artifacts to the host's native review surface.** Where the host offers plan-file review with inline commenting, the pitch/design/decomposition approvals use it; the chat walkthrough remains the teaching layer and the fallback.

One boundary stands throughout: **engine language survives unchanged inside the engine.** Briefs, wire formats, gates, and internal state keep their vocabulary — translation happens at the chat boundary, in artifacts the user reads, and nowhere else.

---

## 1. Findings this plan responds to

IDs are referenced by the workstreams below. Citations are to the shipped corpus at the time of audit.

| ID | Finding | Severity |
|---|---|---|
| F1 | The persona layer loads once and is never re-anchored. `src/skills/groundwork-orchestrator/SKILL.md:14` is the **only** load instruction in the corpus; zero references in all four delivery step files, all seven briefs, and workflows 00–05. The delivery resume recipes (`workflows/04-delivery.md` §step router; `groundwork-bet/instructions.md` activation) never reload it, so a resumed session may never see it. Six sites instruct adopting a *domain* persona "for this entire workflow" (`groundwork-architecture/instructions.md:14`, `02-design.md:33,53`, `01-discovery.md:61`, `05-validation.md:86,125`, `step-03-milestone-close.md:12`, `groundwork-product-brief/instructions.md:14`) with no note that chat posture still belongs to `groundwork-persona`. | High |
| F2 | Step files prescribe engine jargon verbatim at user-facing report points: "inform the user you are entering **Developer Mode**" (`step-01-readiness.md:11` — the term's only occurrence in the corpus, never defined); the dispatch note "dispatching slice-worker · execution → \<model\>" (`step-02-slice-loop.md:11`); the 🔴→🟡 revise-cap disclosure vocabulary (`operating-contract.md:348`); retrospective action items "cited in the pitch by its ID (`<bet-slug>-R<n>`)" (`01-discovery.md:13`, minted at `05-validation.md:128` — the "R13" source); "suggested manual observations, phrased as **front-door actions**" (`briefs/checkpoint-walkthrough.md:45`); "the mechanical lane is owed: report it" (`groundwork-check/instructions.md:29`). The jargon is not leaking — much of it is mandated. | High |
| F3 | No translate-before-relay rule exists anywhere. Subagent wire formats (`VERDICT:`/bucket-tagged findings/`FULL:`; the slice-worker `SLICE:/COVERAGE:/SELF-RECONCILE:` block) are the raw text the driver holds at every user pause, and the only relay instruction is "show the user the closed slice" (`step-02-slice-loop.md:77`). | High |
| F4 | No delivery-loop report point mandates orientation. "Which bet, which milestone, position in the ladder" is required in exactly three places — the orchestrator position report (`SKILL.md:185-189`), bet-activation pitch summary, and persona §Keep the Reader in the Picture — none of them inside the delivery loop where the long sessions live. Transcript confirmation: the single best orientation artifact in 71 sessions (a plain-language milestone table with product-outcome names and statuses) was produced only *after* the user complained, never as a standard checkpoint output. | High |
| F5 | Milestone and slice naming is unguarded at authoring time. The worst documented user moment — "This has become so messy… Are these even mile stones? What is a M-Model anyway?" — was caused by a coined milestone name ("M-Models") plus `M.1/M.2` slice codes colliding with `M1/M2` milestone IDs. Nothing in `03-decomposition.md` or the templates constrains milestone names to product outcomes or slice IDs to the `N.M` scheme. | High |
| F6 | No program-level structure exists. Queued bets are prose bullets in `discovery-notes.md ## Bets`; patches exist only as `Lane: patch` git trailers; quick bets are ordinary bet dirs. Nothing renders the program — bets delivered, in flight, queued, with patches and gap-filler quick bets interleaved — which is exactly the situation the user reports getting lost in. | High |
| F7 | The docsite renders only the checkout it runs in (`defineDocs({ dir: '../../docs' })`, `src/generators/docs-site/files/source.config.ts`; no git awareness anywhere in the generator). All delivery-phase evolution happens on the bet branch/worktree, and validation archives the bet (`05-validation.md` Step 3) *before* the single merge (Step 8.5) — so a main-checkout docsite shows a stale pitch for the whole delivery, then jumps straight to `_archive/`. | High |
| F8 | Where the pitch/design/decomposition phases run is unspecified — workflows 01–03 contain zero worktree/branch instructions; only `04-delivery.md:33` says "if the bet is not already on its own branch and worktree from its earlier phases, open them now." Docsite visibility of the early-phase artifacts is therefore accidental. | Medium |
| F9 | Approval artifacts are presented as chat dumps or bare file pointers. Pitch: "Present the reviewed pitch to the user" (`01-discovery.md:121`); design and decomposition: section-by-section chat walkthroughs (`02-design.md:175`, `03-decomposition.md:242`). Zero references to host plan-review tooling (plan mode, inline file commenting, editor opening) exist in the corpus — while host-specific integration precedent exists (`src/hooks/capture-reminder.js`, per-subagent `model:` on the Task tool). | High |
| F10 | Undefined-jargon residue ships: "escape catalog" is referenced four times and defined nowhere (`groundwork-review/checklists/implementation-readiness.md:47`, `groundwork-scaffold/phases/04-infrastructure-verification.md:10`, `references/bet-progress-tests.md:100`, `briefs/experience-auditor.md:71`); "ratchet" appears twice, never coined; `03-decomposition.md:244` coins "seal" while `:246` says "there is no seal to break." | Medium |
| F11 | Engine terms sit in user-approved templates without user-facing definitions: "Acceptance criteria (agreed front-door cases)" (`templates/decomposition/milestone-index.md`), "Owner service:" and "Model tier" (`templates/decomposition/slice.md`). The user signs documents written in a language nobody taught them. | Medium |
| F12 | Green is reported without a way to see it. Milestone closes range from "M2 closed (`32a2c60`)." to dense postmortem paragraphs; none state what the user can now do in the product or the command that shows it — producing the recurring "How do I run the app so I can test?" class. | Medium |

**Strengths this plan must not regress:** the fail-closed review gates and wire formats (Protocol 8/9) — translation never substitutes for a parseable verdict; the derived board ("no tracking manifest; git and the suite are the record"); the tight capsule/brief economy — no new always-loaded context; the walkthrough-as-teaching pattern (design walk, proof-by-proof decomposition walk) which transcripts show working when it is used.

### 1.5 Transcript evidence (verbatim, magpie corpus)

Kept here so the workstreams stay accountable to real failures, per the sandbox rule: these are signals about the generic case, not specifications for magpie.

- Lost the thread: *"I've lost site of how this ladders up to our bet which is focused on importing images and showing them in the library where they can be searced."* → followed by *"Are these even mile stones? What is a M-Model anyway? Are you mixing up the mile stone naming?"* (F5)
- Reorientation after compaction: *"Ok, where are we?"* (F4)
- Green without a door: *"How do I run the app so I can test?"* / *"how do I run this?"* (F12)
- Opaque carving: *"Kinda confused why you made a whole new pitch for this."* / *"Why not one bet with multiple milestones?"* (F6)
- What good looks like (produced only under duress — the plan's job is to make this the default): a six-row milestone table naming each rung as a product outcome — *"Engine understands one image", "Point at a folder & watch it index", "Browse, search, inspect, scrub"* — with per-row status; and a bet-in-one-line summary ending *"…if you pointed today's build at your folder right now: the images import and appear, but every caption is empty… searching returns nothing."*
- What bad looks like (a standard checkpoint today): *"Readiness gate passed and the pitch is at `status: delivery`. Now the active-lane sentinel and the red board — one red stub per milestone (whole ladder) plus M1's two slice stubs."*

---

## 2. Workstream A — the owner-language boundary (root fix for jargon)

The persona already contains the right rules (§Keep the Reader in the Picture, §Speak as the Guide). This workstream stops asking a once-loaded file to win a recency contest and moves the duty to where the agent is standing when it speaks.

**A1 — The boundary-translation protocol (one source, everywhere).**
Add a protocol to `src/hidden-skills/operating-contract.md` (minor content addition, no major-version bump — no existing skill's assumptions are invalidated). Written to the skill-writer standard: lead with why — a user who has lost the thread cannot make the decisions the process exists to put to them, so every user-facing sentence is written for someone following the *product*, not the process. The protocol's substance:
- **Shared vocabulary the user owns:** bet, milestone, slice, pitch, appetite, and milestone/slice numbers — structure the user was taught and approved (consistent with `groundwork-writer` §Accessibility's "structure the reader already shares").
- **Everything else translates at the boundary:** engine mechanics, wire formats, verdict/severity labels, tier and model names, protocol numbers, coined IDs, and internal file names are never spoken to the user as-is; say the behaviour ("the independent review found two problems worth fixing before we lock this in"), not the mechanism (`VERDICT: REVISE`, 🔴).
- **Subagent reports are raw material, never relayed verbatim.** The driver reads the wire format and speaks the meaning. The wire format itself is untouched — gates still parse it.
- **Every identifier spoken must locate something the user can open** — a milestone in the decomposition, a file in the docsite, a commit. An ID that only locates a line in the agent's bookkeeping is bookkeeping, and stays there.
*Files:* `src/hidden-skills/operating-contract.md`; a pointer line from `groundwork-persona/instructions.md` (§Keep the Reader in the Picture becomes the posture statement; the protocol carries the operational rule).
*Accept:* protocol present; persona references it; no skill duplicates its body (`./dev lint skills` clean).

**A2 — Purge the mandated jargon at every report point.**
Rewrite each counter-instruction found by the audit so the prescribed user-facing line is owner-language. The known set:
- `workflows/delivery/step-01-readiness.md:11` — drop "Developer Mode"; state the meaning: design is locked and approved, from here the work is building it, and what that changes for the user (fewer questions, batched decisions, pauses only at the granularity they chose).
- `workflows/delivery/step-02-slice-loop.md:11` — replace the dispatch-note format with a plain sentence naming what is being built and who is building it; the tier accountability the note existed for ("so the user can see the tier held") moves to the rendered snapshot (WS-B), where it is a column, not a sentence.
- `operating-contract.md:348` (revise-cap disclosure) — keep the mechanics; reword the mandated user line: the independent review ran N times and still has unresolved concerns, here they are in plain terms, you decide.
- `workflows/01-discovery.md:13` + `05-validation.md:128` — R-IDs remain in the retrospective doc and pitch *frontmatter/links* so the follow-through audit stays mechanical; the conversation and pitch body use the action item's plain name. The ID follows the identifier-drift rule: writer and reader both move in this change.
- `briefs/checkpoint-walkthrough.md` — the output contract is rewritten in owner language: "things to try in the app, in your words" replaces "front-door actions"; blast-radius tags become plain phrases ("touches sign-in", "changes the database shape") with the tag kept as a suffix only if the walkthrough needs a stable key.
- `src/skills/groundwork-check/instructions.md:29` — "the mechanical lane is owed" becomes a plain statement of what to run and why.
- Sweep the remainder of the audit's counter-instruction list (orchestrator lane-name proposal wording, quick-lane prose) against the A1 protocol.
*Files:* the six named above plus `src/skills/groundwork-orchestrator/SKILL.md`, `workflows/00-quick.md`.
*Accept:* grep of prescribed-say lines (every "inform the user", "state", "report", "present" instruction) finds no engine vocabulary outside the shared set; `./dev lint skills` clean.

**A3 — Term hygiene at the source.**
- "Front door" is renamed in every *user-facing carrier* and kept unchanged in engine prose (D-S7): `templates/decomposition/milestone-index.md` renames the heading to "Acceptance criteria — proven at the app's real entry point"; checkpoint-walkthrough output says "things to try in the app"; the 28 files of engine prose keep the term as agent shorthand.
- Remove or define residues: "ratchet" (2 uses — replace with the sentence it abbreviates), "escape catalog" (define once where the catalog actually lives, or point to what replaced it; 4 call sites), reconcile the `03-decomposition.md:244/:246` seal contradiction into one statement.
- `templates/decomposition/slice.md`: "Owner service" and "Model tier" fields gain the one-line reader-facing gloss the template's italics pattern already uses.
*Files:* `templates/decomposition/*.md`, `groundwork-review/checklists/implementation-readiness.md`, `groundwork-scaffold/phases/04-infrastructure-verification.md`, `references/bet-progress-tests.md`, `briefs/experience-auditor.md`, `workflows/03-decomposition.md`.
*Accept:* zero corpus references to an undefined coined term (spot-grep the audit list); templates read-back test — a reader who has never seen the skill corpus understands every heading.

**A4 — Re-anchor the voice where the agent is standing.**
- Each delivery step file's user-pause section carries its own one-line voice rule referencing the A1 protocol — the structural answer to persona decay: the file loaded at speaking time carries the rule. One line, not a restatement (shadow-knowledge rule: the protocol holds the body).
- The two resume recipes load the persona: `groundwork-bet/instructions.md` (activation routing) and `04-delivery.md` (fresh-context resume) add `groundwork-persona` to their read lists.
- The six domain-persona adoption sites gain one clause: the domain persona governs *judgment*; chat posture and the owner-language boundary remain `groundwork-persona`'s.
*Files:* `workflows/delivery/step-01…04`, `on-amendment.md`, `on-change-navigation.md`, `workflows/04-delivery.md`, `groundwork-bet/instructions.md`, the six adoption sites (F1 list).
*Accept:* every user-pause section in the delivery tree carries the anchor line; both resume paths name the persona; `./dev lint skills` clean.

**A5 — Guardrails so it cannot silently regress.**
- `skill-writer/SKILL.md` gains a writing principle: *report-point prescriptions are written in owner language* — when a skill file prescribes a user-facing line, that line must itself pass the boundary rule, because agents repeat prescribed lines verbatim (the same mechanism behind "write intent, not scripts").
- A tripwire lint (D-S9): `scripts/lint_skills.py` gains `check_report_point_language` — a narrow denylist of engine terms (Developer Mode, red board, honest green, wire-format tokens, tier names, `R<n>`-style coinages) scanned only inside prescribed user-facing lines (instructions containing "inform the user", "state", "report", "present", and quoted say-formats), following the existing `check_no_model_ids` pattern (`lint_skills.py:598`). Narrow by design: it catches reintroduction of the audited set, not all possible jargon.
- The delivery-simulation judge rubric (the `./dev sandbox --delivery` exit gate built in V2 Wave 0/1) gains a legibility dimension — the semantic gate the lint cannot be: checkpoints must orient (bet → milestone → slice position) and must be readable by someone who has never seen the skill corpus; coined IDs and wire-format vocabulary in user-facing turns are findings.
*Files:* `.agents/skills/skill-writer/SKILL.md`; `scripts/lint_skills.py`; the sim judge rubric under `tests/evals/` (locate the Wave-1 exit-gate rubric and extend it — do not fork a second rubric).
*Accept:* `./dev lint skills` fails on a seeded regression (a step file re-adding "entering Developer Mode" in a prescribed line); a sim run's judge report scores the legibility dimension; skill-writer principle lands with the same-commit review of this plan's own prose (it must pass its own bar).

---

## 3. Workstream B — "you are here", rendered not recalled

The engine already knows where everything stands; nobody ever renders it. A deterministic snapshot removes the judgment (and the decay) from orientation, and the checkpoint contract makes pasting it non-optional.

**B1 — The snapshot renderer.**
`npx groundwork-method status [--bet <slug>] [--json]` emits a ready-to-paste markdown snapshot beside the existing composed `state` command, reusing the board derivation `./dev bet status --json` already performs:
- **Program section** — one row per bet: delivered (from `docs/bets/_archive/`), in flight (pitch `status:` per active bet dir, across branches — see C1's enumeration), queued (from `discovery-notes.md ## Bets`), plus patches since the last bet close (`git log --grep='Lane: patch'` grouped by `Area:`) and quick bets inline, so mid-program insertions stay visible. Each row: plain-language payload (the pitch's one-line goal), not just a slug. The program is fully derived — no new state file (D-S5) — and the `## Bets` section's bullet **order becomes the stated queue order**: `01-discovery.md` and `05-validation.md` (the section's writers) and this renderer (its reader) all name the contract in the same change, per the identifier-drift rule; reordering the queue is reordering bullets.
- **Bet section** — the bet's goal in one sentence (from the pitch), then the milestone ladder as a checklist using each milestone's **demonstrable-goal text** (already authored in `decomposition/milestone-<N>/index.md`), never codes: ✅ done / ▶ in progress / ○ not started, states from the derived board.
- **Milestone section** — the current milestone's slices with states and, for the in-progress slice, the model tier as a column (absorbing the A2 dispatch-note accountability).
Renders from committed truth (suite + git + pitch frontmatter + decomposition prose); `board.yaml` stays the driver's convenience and is not read (the board never gates, and the snapshot must survive its absence).
*Files:* `bin/groundwork.js` (new `status` verb beside `state`, `:2628+`); shared derivation with `src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts` logic re-implemented CLI-side (the `groundwork-method` CLI cannot depend on the scaffolded `./dev` bundle); contract tests `tests/cli/`.
*Accept:* `tests/cli` covers: multi-bet program, queued-only, patches interleaved, no-board delivery-in-progress, archived bets; output contains zero engine vocabulary outside the shared set.

**B2 — The checkpoint contract.**
Every pause and report point opens with the rendered snapshot plus one sentence of meaning in owner language, and closes with what happens next. The cadence is tiered (D-S8): the **full** program → bet → milestone snapshot at milestone boundaries, postmortems, session resumes, and **before any hard-stop question** — a user who is asked to rule on something is first shown where they are ruling; the **bet section only** (milestone ladder position + slice states) at slice-by-slice pauses, which arrive minutes apart — a full program table there becomes wallpaper the user learns to skip. Milestone close additionally states, in product terms, what the user can now do **and the exact command to see it** (the scaffold's `./dev` runbook is the source), killing the F12 class. The instruction is written with its why: the snapshot is cheap for the agent and is the difference between a user who can decide and one who has to ask "where are we?" first.
*Files:* `workflows/delivery/step-01…04.md`, `on-amendment.md`, `on-change-navigation.md`, `workflows/00-quick.md`, `05-validation.md` (Steps 4 and 9), `groundwork-patch/instructions.md` (close report), `groundwork-bet/instructions.md` (resume), orchestrator position report (`SKILL.md:185-189` upgrades from prose recipe to snapshot-first).
*Accept:* every named point instructs snapshot-first; delivery sim judge (A5) confirms checkpoints orient in a live run.

**B3 — Interim contract before B1 lands (prose-only, ships in Wave 1).**
Until the renderer exists, B2's instruction reads "compose the snapshot from `./dev bet status` and the decomposition's demonstrable-goal lines, in this exact shape" — with the shape specified once in the checkpoint contract so Wave 1 ships the behaviour and Wave 2 merely swaps composition for `status` output.
*Files:* same as B2.
*Accept:* Wave-1 sim shows the composed snapshot at checkpoints.

**B4 — Naming guardrails at authoring time.**
`03-decomposition.md` Step 2/4 gain constraints with their reasons: **milestone names are product outcomes in the user's words** ("Browse and search the library"), never coined codes or internal component names, because the name is the primary thing the user tracks across weeks; **slice IDs are `N.M` only** — no letter bands, no `M.<n>` forms — because any second scheme collides with milestone numbers in exactly the way that produced the worst documented user confusion. Templates carry the same rule where authors copy from (`templates/decomposition/milestone-index.md`, `slice.md`).
*Accept:* decomposition instructions and templates state the constraints; sim-authored decompositions conform.

---

## 4. Workstream C — the docsite becomes the live window

Settled steer: aggregate everything into one site — active worktrees *and* branch-only bets (a bet whose branch exists but has no worktree checked out right now must still appear).

**C1 — Aggregation across worktrees and branches.**
The docsite renders bets from all three sources, badged by state:
- **Delivered** — `docs/bets/_archive/` in the checkout the site runs from (main).
- **In flight, worktree** — enumerate `git worktree list --porcelain`, read each worktree's `docs/bets/<slug>/` directly (live files, file-watch picks up edits as the agent works).
- **In flight, branch-only** — enumerate `git for-each-ref 'refs/heads/bet/*'` minus branches already covered by a worktree; materialize `git show <branch>:docs/bets/<slug>/...` on ref change.
Each in-flight bet badges with its branch and freshness (worktree = live; branch-only = as of last commit). Mechanism (D-S6): a **pre-render sync script** materializes worktree and branch content into a gitignored `docs/bets/_live/<slug>/` folder *inside* the tree `defineDocs({ dir: '../../docs' })` already watches — the stock fumadocs-mdx pipeline picks it up with zero content-pipeline changes; badging and sidebar grouping ride generated frontmatter and a `_live/meta.json`. No second collection, no route-time git reads (fumadocs' compile-time content model fights dynamic sources).
*Files:* `src/generators/docs-site/` (generator + `files/source.config.ts` + a sync module); provenance/regeneration story per the shipping rules — the generator change needs a reconcile family or migration entry so existing installs' docsites gain the capability on `update`.
*Accept:* a repo with one archived bet, one worktree bet, and one branch-only bet shows all three, correctly badged; deleting the worktree demotes the bet to branch-only rendering without error; changelog line carries the migration/`[no-migration]` annotation.

**C2 — The per-bet delivery status page.**
The B1 renderer gains `--write <path>` (or the checkpoint contract instructs writing its output) to `docs/bets/<slug>/status.md` in the bet's own checkout at every checkpoint — so the docsite shows the ladder and board, not just the prose plan. The page is regenerated whole each time (never patched), carries a generated-at line, and is removed at archive (the retrospective supersedes it).
*Files:* `bin/groundwork.js` (`status --write`); `workflows/delivery/step-02…04.md` + `05-validation.md` (write at checkpoint, remove at archive); `templates/` note if the page needs a frontmatter shape for the docsite sidebar.
*Accept:* during a sim delivery, the docsite's bet page shows current slice/milestone state within one checkpoint of reality; archive removes it.

**C3 — Lifecycle consistency: the bet's docs live on the bet branch from promotion.**
Workflows 01–03 gain the explicit rule `04-delivery.md` already implies: the bet branch and worktree open at pitch **promotion** (discovery commit), and every subsequent bet artifact — pitch, technical design, decomposition — is authored there. This closes F8 (today it is accidental where those phases run), makes C1's in-flight view complete from day one, and changes nothing about the git contract (still one merge, at validation).
*Files:* `workflows/01-discovery.md` (promotion step), `02-design.md`, `03-decomposition.md` (a one-line "you are on the bet branch" precondition each), `04-delivery.md` (its "if not already" clause becomes a reconcile for legacy bets, not the default path).
*Accept:* workflows name the branch point once, at promotion; no duplicated worktree mechanics (the spine keeps them).

**C4 — Booting the aggregated site.**
Document the front door: the scaffolded docsite service (`pnpm dev` in `services/<docsite>/`) now serves the aggregated view; the milestone-close checkpoint (B2) names it when the thing to see is a doc rather than the app. If the repo ships a `./dev docs` convenience, it points at the same server — no second mechanism.
*Files:* `src/generators/docs-site/files/README` (or the generated service's docs), the B2 checkpoint wording.
*Accept:* one documented command boots the site showing live bets.

---

## 5. Workstream D — approval drafts through host review tooling

Settled steer: use the host's native plan/review surface where one exists, with the chat walkthrough as teaching layer and fallback.

**D1 — The draft-presentation protocol.**
Add to `operating-contract.md` (adjacent to Protocols 8/9, which stay untouched): for every **approval-gated artifact** — bet pitch, technical design, decomposition, architecture draft, quick-bet plan — presentation follows one shape:
1. **The artifact is at its canonical path first** (it already is, post-C3 — on the bet branch, visible on the docsite). The user is told the path and where it renders.
2. **Where the host offers a native review surface for markdown plans** (Claude Code: the plan-file review flow — write the draft as the reviewable plan document and hand it over, so desktop/CLI inline commenting works), the approval pass runs through it: the user comments inline; the agent applies, re-runs the Protocol 8/9 gates where the change warrants, and re-presents. Host capability is detected by what the session actually offers, never assumed; absence is not an error.
3. **The chat walkthrough is the teaching layer, not the delivery mechanism.** The proof-by-proof decomposition walk and the section-by-section design walk stay — they exist to build the user's comprehension, and transcripts show them working. What changes: the walkthrough no longer doubles as the only way to read the document.
4. **Fallback is today's behaviour**, exactly — section-by-section in chat, approval in conversation.
The protocol names its own boundary: setup *facilitation* flows (product brief, design system) stay conversational — there the cluster conversation is the product, and a review surface would flatten it.
*Files:* `src/hidden-skills/operating-contract.md`.
*Accept:* protocol present; Protocols 8/9 byte-identical; facilitation boundary stated.

**D2 — Apply at the five approval sites.**
`01-discovery.md:121` (pitch), `02-design.md:175` (technical design), `03-decomposition.md:242` (decomposition — the walkthrough stays, the sign-off moves to the reviewed file), `00-quick.md:63` (quick plan single gate), `groundwork-architecture/phases/06-draft-review-present.md`. Each site: one reference to the D1 protocol at its presentation step, per the shared-contract-conformance rule (naming the contract is not conformance; the step says when it fires).
*Accept:* all five sites enact D1 at their approval step; `./dev lint skills` contract-reference checks clean.

**D3 — The comment-resolution loop.**
Inline comments are user feedback on a draft, which the corpus already knows how to handle — apply, re-flow for cohesion (never isolated edits, per the artifacts-are-proposals rule), and re-gate when the change touches what the independent review approved. D2's sites state this in one line each; no new machinery.
*Accept:* covered by D2's edits; sim shows a comment→revision→re-approval round trip on at least one artifact.

---

## 6. Decisions — all settled

Owner decisions D-S1–D-S4 settled at proposal; D-S5–D-S9 closed out the same day (D-S5/S7/S8 by the owner, D-S6/S9 by verification against the code). No open items remain.

| ID | Decision |
|---|---|
| D-S1 | Docsite shows in-flight work by **aggregating** — one site covering main, active worktrees, and branch-only bets. Not per-worktree sites, not status commits to main. |
| D-S2 | The progress snapshot is **CLI-rendered** (deterministic engine output the agent pastes and glosses), not instruction-composed — with an instruction-composed interim (B3) so Wave 1 ships the behaviour. |
| D-S3 | Approval artifacts use **host review tooling where available** (Claude Code plan-file review / inline comments), degrading to the chat walkthrough. |
| D-S4 | Engine vocabulary is untouched **inside** the engine — briefs, wire formats, gates keep their language; translation happens only at the user boundary and in user-read artifacts. |
| D-S5 | The program view is **fully derived** — no persisted program file. The `discovery-notes.md ## Bets` bullet order becomes the stated queue order, named by its writers (`01-discovery.md`, `05-validation.md`) and its reader (the B1 renderer) in the same change. Revisit only if a live run shows derivation losing intent the user cares about. |
| D-S6 | C1 mechanism is a **pre-render sync script** materializing into a gitignored `docs/bets/_live/<slug>/` inside the already-watched `docs/` tree — stock fumadocs-mdx pipeline, no second collection, no route-time git. Verified against `source.config.ts` (single compile-time `defineDocs` collection, file-watching dev server). |
| D-S7 | "Front door" is **renamed in user-facing text** (templates, walkthrough output, spoken lines) and kept unchanged in engine prose, where it is load-bearing shorthand across 28 files. |
| D-S8 | Snapshot cadence is **tiered**: full program → bet → milestone view at milestone boundaries, postmortems, resumes, and before any hard-stop question; bet section only at slice-by-slice pauses. |
| D-S9 | Enforcement is **lint tripwire + sim judge**: `check_report_point_language` in `scripts/lint_skills.py` (feasible — follows the existing `check_no_model_ids` denylist pattern at `:598`) catches reintroduction of the audited jargon set in prescribed user-facing lines; the delivery-sim judge's legibility dimension remains the semantic gate. |

---

## 7. Sequencing and gates

Waves are independent PR sets; each is bet-sized and lands whole.

**Wave 1 — prose only, ships immediately: WS-A (all) + B2/B3/B4 + C3.**
Skill-file changes are Tier-1 clean-replace (no migration). Gate: `./dev lint skills` + `./dev check sync-anchors` clean; a delivery-sim run judged with the extended rubric (A5) shows jargon-free, oriented checkpoints; read-back check — no sandbox-product specifics leaked into any skill edit.

**Wave 2 — engine: B1 (+ C2's `--write`).**
CLI change → changelog line with migration annotation (`[no-migration]` if purely additive verb). Gate: `tests/cli` contract tests green; `./dev ci` green; B2's interim composition instruction (B3) swapped to `status` output in the same wave.

**Wave 3 — code + protocol: C1/C4 (docsite aggregation) + D1–D3 (host review).**
Generator change → provenance + reconcile family or migration entry so existing installs upgrade. Gate: three-source aggregation acceptance (C1) proven against a fixture repo; a live sim showing pitch→inline-comment→revision→approval; `./dev test generation` + `contracts` green.

**Done means:** a user can at any moment ask "where are we?" and receive a rendered snapshot whose every word they were taught; open the docsite and see every bet — delivered, in flight on any branch, queued — with the in-flight ones current to the last checkpoint; and approve a pitch by commenting on the document rather than scrolling a chat dump. The delivery-sim judge scores legibility as a first-class dimension, so the next regression is a red gate, not a user complaint.
