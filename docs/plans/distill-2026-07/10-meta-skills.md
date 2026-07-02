# Distillation Plan — Dev-Time Meta-Skills

Status: PROPOSED (input to the master distillation plan)
Scope: `.agents/skills/skill-writer/SKILL.md` (2,408 words) · `.agents/skills/groundwork-contributor/SKILL.md` (7,367 words) · `.agents/skills/scaffold-designer/SKILL.md` (1,486 words) · `AGENTS.md` (232 words; `CLAUDE.md` is a symlink to it, so one file) — **11,493 words total**, of which ~7,600 (contributor + AGENTS.md) are loaded in every session in this repo.

Vendored skills (`skill-creator`, `golang-pro`) are out of scope per their lock-file contract.

---

## 1. Intention

This section is the repo's self-governance layer: the instructions that shape every contributor/agent session that *builds* GroundWork, and the standard those sessions write new instructions against. Its quality compounds — a defect here is copied into every shipped skill. The whole distillation review exists because the shipped surface grew by accretion through ~20 uplifts; this section owns the standard that failed to prevent that.

Per-file intention:

- **`skill-writer/SKILL.md`** — cause every instruction file written in this repo to be precise, intent-driven, and behaviourally effective on agents; it is the house standard a writer loads before touching any SKILL.md/instructions.md. Its unstated second job — resisting corpus growth — is currently not attempted at all.
- **`groundwork-contributor/SKILL.md`** — orient any session opened in this repo: what ships vs what is dev-only, where things live, the two-layer skill architecture, how changes reach installed projects (migrations/reconcile), and the test/release machinery. It is the always-on map; everything else routes off it.
- **`scaffold-designer/SKILL.md`** — force any new Nx generator design through the Day-2 operational baseline before code is written, so generated services are survivable in week two, not just bootable on day one.
- **`CLAUDE.md` → `AGENTS.md`** — a pure router: load contributor always, match other skills by task. The symlink makes Claude Code and native-AGENTS.md tools (Cursor, Codex, OpenCode, Cline — confirmed by the wiring comments in `bin/groundwork.js` ~851–939) read one source.

---

## 2. Findings

| ID | Where | Finding | Severity |
|---|---|---|---|
| META-1 | skill-writer, "Lead with what you believe" example | **The lens teaches retired canon.** The ✅ exemplar says "A Milestone's capability is provable behind a flag before customers see it"; the ❌ half says milestones are "flag-gated internal proof points". Current bet canon is the opposite: milestones are user-visible front-door proofs and "no feature flag is required" (`src/hidden-skills/groundwork-bet/workflows/04-delivery.md` "Bet close = the single merge to trunk"; `instructions.md` Decomposition bullet). Nine reviewers are calibrating against a standard whose flagship example contradicts the product it governs. Root cause: exemplars quote live canon, which then moved. | high |
| META-2 | skill-writer, whole file | **No audience taxonomy — one register prescribed for three kinds of file.** Principles like "Explain reasoning over rigid constraints", "Pace for depth", "Earn conclusions through conversation", "The expert peer stance", "Artifacts are proposals" are written as universal. The repo's own briefs (`groundwork-bet/briefs/slice-worker.md`, `blind-reviewer.md`) and engineer skills (`groundwork-go-engineer/SKILL.md` Safety Gates: "Do not launch untracked goroutines", "Never use wildcard CORS", "Always validate configuration") violate them **by design and correctly** — a dispatched worker or execution router needs gate-shaped imperatives, not a peer stance. Verdict: the principles are right for *facilitation* skills and wrong as universals; what's missing is the taxonomy, not enforcement. The `briefs/` convention itself is documented in the contributor guide ("Multi-phase skill layout"), not in the writing standard that governs how briefs are written. | high |
| META-3 | skill-writer, whole file | **Silent on budget, doneness, and accretion — the exact failure this review exists to fix.** No context-cost model (an always-on registered description costs every session; a hidden instructions file costs one load; a brief costs one dispatch). No "when is this skill done" discipline. No "does this change need words at all" test. No integrate-don't-append rule. Internal evidence of the failure: "Common Failure Modes" is itself append-shaped — early entries are one-liners ("Passive docs"), the last two ("Shared-contract non-conformance", "Identifier drift") are 100+-word paragraphs bolted on by later uplifts; and shipped files show the downstream cost (the Decomposition/Delivery bullets in `groundwork-bet/instructions.md` are 200+-word single bullets of em-dash-chained overlays). | high |
| META-4 | groundwork-contributor | **~4k words of on-demand reference riding in an always-on file.** Section word counts: Test Infrastructure 1,551 · Repository Map 1,076 · Two-Layer Skill Architecture 943 · Cross-Phase Contracts 702 · Contribution Patterns 497 · Shipping 424 · File Storage Convention 385 · Releasing 366. A session needs the map, the two-layer split, the sandbox rule, and the shipping/migration *trigger* on every load; it needs simulation-harness mechanics, checkpoint commands, the release checklist, and the cross-phase contract table only when doing that task. Context-tax misplacement, and the guide's own advice ("Keep this list short — context window cost scales with every entry") is not applied to itself. | high |
| META-5 | groundwork-contributor, multiple | **Drift from code (six verified instances).** (a) Repository Map omits `src/generators/` and `src/docs/` entirely — two of the largest shipped trees, both referenced later in the same file — plus `scripts/`, and hidden skills `groundwork-designer`, `groundwork-elicit`, `groundwork-stack-forge`, `code-intelligence.md`, `maturity-model.md`, `repo-map-schema.md`. (b) Dev CLI table omits `./dev ci`, `./dev test cli`, `./dev lint skills`, `./dev check sync-anchors` — all exist (`./dev` help), and Releasing step 5 depends on `./dev ci`. (c) "self-copy guard in `bin/groundwork.js` (line ~59)" — the guard is `isSelfCopy` at ~line 1164; the file is 1,786 lines. (d) "set `CLAUDE_API_KEY`" in `.env` — no file in `bin/`, `scripts/`, `src/`, `tests/`, or `dev` reads that variable (its consumer, the removed `conversational_eval.py`, is gone; the guide even narrates the removal elsewhere). (e) "`npx groundwork init`" / "the GroundWork npm package (`npx groundwork`)" — the package is `groundwork-method`; the guide's own Releasing note says bare `groundwork` is an unrelated npm package, so the instruction as written invokes someone else's code. (f) Writer Enforcement table lists "Docs Uplift" (skill no longer exists — folded into `groundwork-update`) and omits `groundwork-patch`, `groundwork-doc-sync`, `groundwork-stack-forge`, `groundwork-designer`, `groundwork-elicit`, which all reference the writer. | high |
| META-6 | groundwork-contributor, "Writer Enforcement" | **Hand-maintained status ledger duplicating a derivable signal.** The per-skill ✅ table restates what `grep -rl groundwork-writer src/hidden-skills` shows, is already stale (META-5f), and duplicates rule 4 of "Adding a new methodology skill". The repo already learned this lesson: the hand-maintained patch ledger was replaced by a git-derived signal (`a400081`). The durable fix is a mechanical check — `scripts/lint_skills.py` checks frontmatter/contract-refs/review-gates/routing but not writer references. | med |
| META-7 | scaffold-designer | **Drift from the code it guides.** (a) "matching engineer skill in `src/hidden-skills/`" — engineer skills moved to `src/engineer-skills/` (confirmed: `src/generators/shared/scaffold-helpers.ts` line 22 reads `src/engineer-skills`); a designer following this looks in the wrong tree. (b) "Three-layer test coverage" — the harness has four layers (generation, contracts, compilation, e2e; both the contributor guide's table and `tests/scaffolds/` agree). (c) No mention of registering the generator in `generators.json` (all 11 existing generators are registered there; an unregistered generator is invisible to `nx g` and the scaffold skill's catalog answer). (d) No mention that a new generator is a shipped-surface change requiring a changelog `[no-migration]`/migration annotation — the contracts gate will fail the PR and the designer won't know why. | med |
| META-8 | skill-writer, frontmatter + body | **Description promises frontmatter guidance the body never gives.** The description says it covers "SKILL.md frontmatter", but no section addresses writing `name`/`description` — even though the description IS the routing surface (registered skills are matched on it; the orchestrator's discoverability had to be patched precisely because its description didn't claim "update groundwork"). The one part of a registered skill that costs context in *every* session gets zero guidance. | med |
| META-9 | skill-writer ↔ groundwork-writer | **Shared prose core duplicated and drifting one-way.** "Say it once", "Causal chains", "Active voice", "No hedging", "Lead with what you believe" appear near-verbatim in both files (contributor's rule: "If a change belongs in both, apply it explicitly to both"). groundwork-writer has since gained "Density — one idea per unit" (compression em-dashes, run-on bullets, numbered-prose walls); skill-writer never received it — and skill *files* exhibit exactly that failure (META-3's bet-instructions bullets). The intentional-divergence boundary otherwise holds: no scope confusion found in either text; the routing table in contributor is correct. The defect is the missing back-port, not the split. | med |
| META-10 | groundwork-contributor, "The Operating Contract" + "File Storage Convention" | **Duplication of shipped canon.** The `.groundwork/` layout, cache lifecycle rules, and context-store description restate `src/hidden-skills/operating-contract.md` Protocols 3/5/6/7 (compare "Cache Lifecycle Rules" with Protocol 3.4 and Protocol 7) at lower fidelity. A contributor can read the canon file itself — it's in this repo. Duplication at two fidelities is how the two drift. | med |
| META-11 | skill-writer, "Common Failure Modes" | **Domain leakage + internal duplication.** "Shallow translation" (OKLCH/design-system), "Ambiguous medium", and "Service-by-service interrogation" are failure modes of *specific shipped skills' subject matter*, accreted here from past postmortems; "Root-document drift" partially restates "Structural consistency across sibling skills". The section mixes durable cross-file integrity rules (shared-contract non-conformance, identifier drift — genuinely load-bearing) with product-domain residue. | med |
| META-12 | CLAUDE.md/AGENTS.md | **Routing table incomplete; one rule duplicated.** The table routes Go/Python/Next.js engineer work but not Flutter/Electron, though all five skills exist and the Rules bullet names all five. The engineer-skills Rules bullet substantially duplicates contributor's "Engineer-skill delivery" section — against the file's own "Do not duplicate skill content here." The "only routes" claim is otherwise true, and all referenced paths exist. | low |
| META-13 | skill-writer, "Say it once" + META-9 overlap | **No mechanical backstop is named.** `./dev lint skills` mechanically enforces several conventions skill-writer states in prose (frontmatter name=dir, contract version refs, review-gate blocks, canonical discovery-notes headers, routing sync). skill-writer never mentions it, so a writer treats these as style advice rather than gated contracts — and neither file tells the writer which rules the machine already owns (relevant to the "when not to write" discipline: a rule the linter enforces needs one line, not a paragraph). | low |

---

## 3. Distillation moves

### skill-writer (the lens itself)

**M1 (META-1): Replace canon-quoting exemplars with canon-neutral ones.** Rewrite the "Lead with what you believe" ❌/✅ pair using a domain that cannot rot with GroundWork's own methodology (the groundwork-writer version of the same principle already does this correctly: a CRUD/transactions example). Add one sentence to the new Examples guidance (M6): *"An example that quotes live canon inherits canon's churn — when the methodology moves, the standard starts teaching the old world. Prefer examples from domains this repo does not govern; when an example must quote canon, it is a reader of that canon and must be updated in the same change that moves it."* This delivers the intention (calibrating writers) without the standard silently decaying.

**M2 (META-2): Add an audience taxonomy section, and scope the existing principles to it.** Insert after the intro, before "Writing Principles", in skill-writer's voice:

> ## Three kinds of instruction file
>
> Every instruction file in this repo speaks to one of three readers, and the register that makes one effective ruins another:
>
> - **Facilitation skills** run a conversation with a human (product-brief, design-system, bet discovery). They need the mental model, the pacing, the expert peer stance — an agent mid-conversation makes judgment calls no checklist anticipates.
> - **Dispatched briefs and execution routers** run in an isolated context with no user present (`briefs/*.md`, engineer skills). They need a tight contract: inputs, gates, the report shape. Imperative constraints are correct here — there is no conversation to earn a conclusion through, and a worker that "adapts" a gate has broken it. Explain a gate's reason in one clause when the reason changes behaviour; otherwise state the gate.
> - **Reference files** (`references/`, `templates/`, contract tables) are read mid-task for one fact. They are lookup surfaces: front-load the identifier, keep entries parallel, never narrate.
>
> The conversational principles below (pacing, earned conclusions, the peer stance, artifacts-as-proposals) bind facilitation skills. The precision principles (say it once, causal chains, identifier discipline) bind everything.

Then tag "Pace for depth", "Earn conclusions", "Expert peer stance", "Artifacts are proposals", "Explain reasoning over rigid constraints" with a one-line scope note ("Facilitation skills."). This turns a principle-violated-everywhere (in briefs/engineer skills) into a correctly scoped principle — and gives the other nine sections a basis for *not* flagging terse briefs as violations.

**M3 (META-3): Add the accretion-resistance cluster — three short principles.** Draft text, in order, as a new section "The budget" placed immediately after "Writing Principles" heading block (this is the review's core addition):

> ### Every file has a budget set by when it loads
>
> Words cost context, and the cost multiplies by load frequency: a registered skill's description is paid in **every** session; an always-loaded guide is paid in every session in its repo; a hidden skill's body is paid once per invocation; a brief once per dispatch; a reference file once per lookup. Spend accordingly — the always-on layer holds only what changes behaviour in most sessions, and everything else moves down a tier and gets a pointer. When a file grows, the first question is not "is this content good?" but "is this content at the right tier?"
>
> ### Integrate, don't append
>
> An uplift that appends a section, a bullet, or a parenthetical to an existing file has not been written yet — it has been queued. Find the section that already owns the concern and rewrite it so the new understanding replaces the old, in the old one's words where they still hold. A new heading is a claim that a new concern exists; most uplifts refine an existing one. After editing, reread the whole file once: if two passages now say adjacent things, merge them — the second reader cannot tell which one is current. Growth by appended overlays is how a corpus reaches ten times its useful size while every individual addition looked reasonable.
>
> ### A skill is done when cutting changes behaviour
>
> The finish line is not coverage; it is that removing any sentence would change what an agent does. Test additions against that bar before landing them, and test the file against it whenever you touch it: a sentence that restates the model's default, narrates what an adjacent sentence already causes, or documents a rule a gate enforces mechanically (`./dev lint skills`, the sync-anchor check, the contracts suite) earns its cut. Some changes need no words at all — if the failure can be caught by a lint rule, a test, or a derived signal from git or state, build that instead and write one line pointing at it.

**M4 (META-9): Import the density rule.** Add a condensed "One idea per unit" principle under Writing Principles (compression em-dashes / run-on bullets / numbered-prose walls, ~90 words, one ❌/✅ pair), explicitly noting it is shared with `groundwork-writer` per the apply-to-both rule. This gives reviewers the named standard for the run-on mental-model bullets shipped skills currently exhibit.

**M5 (META-8): Add frontmatter/description guidance.** New short section "The description is the router" (~80 words): the `description` of a registered skill is the only part paid for in every session and the only part the matcher sees — write it as trigger phrases a user would actually say plus the boundary ("this, not that"), never as a summary of the body. Cite nothing; the principle stands alone.

**M6 (META-11): Rework "Common Failure Modes" into "Cross-file integrity".** Keep and tighten: shadow knowledge, prompt-shaped docs, root-document drift (merged with structural-consistency cross-reference), shared-contract non-conformance, identifier drift. Move out: "Shallow translation", "Ambiguous medium", "Service-by-service interrogation" — these are content rules for specific shipped skills; relocate the durable kernel of each into the shipped skill that owns the concern (design-system, product-brief) or cut where the shipped skill already states it (verify at execution; design-system's tracks already carry translation-depth guidance). "Passive docs" folds into a clause of the budget section (ownership is what notices staleness).

### groundwork-contributor

**M7 (META-4): Split into an always-on core + routed references.** Restructure as:

- **Core (`SKILL.md`, target ~2,800 words):** intro; a *corrected, pruned* Repository Map (one line per top-level tree including `src/generators/` and `src/docs/`, detail only for the skill trees); Two-Layer Skill Architecture compressed to its load-bearing halves (registered vs hidden + the engineer-skill delivery rule; the two SKILL.md-template families and discipline-persona anatomy compress to a short table + pointer to the newest sibling as the template); the Generic Framework / Sandbox rule (keep whole — it is the repo's most-invoked judgment rule); lifecycle in one paragraph + pointer to the operating contract; Shipping triggers (the four-tier table + *when you need a migration/family/annotation* — keep, this fires on most changes); Design Plans rules (keep, trimmed); Contribution Patterns (keep, corrected); the two-writer-skills table (keep); Writing Standards pointer.
- **`references/testing.md` (~1,400 words):** Flow Testing/simulation harness, personas, assessment, checkpoints, suites/fixtures, scaffold harness detail. Core keeps a 4-line orientation ("everything in tests/ probes GroundWork itself") + the layer/command table.
- **`references/releasing.md` (~450 words):** the release checklist + OIDC note + version-points rule. Core keeps one line: "Releasing has a checklist — read references/releasing.md before cutting a version."
- **`references/cross-phase-contracts.md` (~700 words):** the Cross-Phase Contracts table, unchanged in content (it is the restructure map and must stay complete), loaded when doing cross-cutting work. Core keeps the two-sentence framing ("chains are where single-phase assumptions hide") + pointer.

Each reference keeps contributor as its named owner. This is the biggest single win: ~4,300 words leave every session's context while remaining one `Read` away, and the routing pattern is the same one the product itself uses (hidden skills behind the orchestrator) — the guide starts practicing its own architecture.

**M8 (META-5): Fix the six drift instances in the same pass.** (a) Repo map: add `src/generators/`, `src/docs/`, `scripts/`; add missing hidden-skill entries or (better, per M7) collapse the per-skill annotations to the categories the Two-Layer section already explains, so the map stops being a second copy of `ls src/hidden-skills`. (b) Dev CLI table: add `ci`, `test cli`, `lint skills`, `check sync-anchors` (or derive: state "run `./dev` for the current command list" and keep only the commands the guide's own instructions reference). (c) Self-copy guard: name the function (`isSelfCopy`), drop the line number — line numbers in prose are pre-drifted. (d) Delete the `.env`/`CLAUDE_API_KEY` block outright (dead instruction; no consumer). (e) Normalize every invocation to `npx groundwork-method …` including the intro line. (f) Handled by M9.

**M9 (META-6): Delete the Writer Enforcement status table; mechanize the rule.** Keep two sentences: every document-producing skill references `groundwork-writer` at its output point (already step 4 of "Adding a new methodology skill" — say it once there), and the check is mechanical. Add a `writer-ref` check to `scripts/lint_skills.py` (the skill list and canonical-file logic it needs already exist there). Derived signal over hand-maintained ledger — the `a400081` precedent applied to this file.

**M10 (META-10): Collapse operating-contract duplication to pointers.** "The Operating Contract" subsection shrinks to: what it is, that every methodology skill loads it, and *read `src/hidden-skills/operating-contract.md` for the protocols*. "File Storage Convention" shrinks to the two-tier statement (`.groundwork/` home vs `docs/` living outputs, one table) and drops "Cache Lifecycle Rules" (Protocol 3/7 verbatim territory). The contributor-specific insight — *never write final deliverables to `.groundwork/`* and the config/context/cache lifecycle table — survives inside the shortened section.

### scaffold-designer

**M11 (META-7): Re-ground in the current code.** Fix `src/hidden-skills/` → `src/engineer-skills/` in the promotion bullet (and point at `promoteEngineerSkill` in `scaffold-helpers.ts` rather than restating its mechanics). Replace "Three-layer test coverage" with the four-layer table by *pointer* to contributor's harness table (one source). Add two missing steps to Execution Guidelines: register the generator in `generators.json`, and annotate the changelog (`[no-migration]` or a migration id) because a new generator is a shipped-surface change the contracts gate checks. Both are one line each — the gate does the enforcing; the guide just stops the designer being surprised by it.

**M12 (META-7, simplification): Thin the checklists toward their canon.** The file already declares "These checklists are summaries, not canon" with source of truth in `src/docs/principles/` + the generators. Honor that: compress each checklist item to its one-line *question* form and cut the parenthetical implementation detail that duplicates what reading the referenced generator shows (e.g. the Isomorphic Data Gateway and Provider Tree items each carry a spec's worth of detail that `src/generators/nextjs-app/` is the truth for). Target ~30% reduction while keeping every check present — the checklist's job is to make the designer *look*, not to be the spec.

### CLAUDE.md / AGENTS.md

**M13 (META-12): Complete the routing table, drop the duplicated rule.** Add Flutter and Electron engineer rows. Replace the engineer-skills Rules bullet with one clause ("engineer-skill canon lives in `src/engineer-skills/` — see the contributor guide"), deleting the duplicated delivery explanation. Keep the other three rules verbatim — they are genuine router-level rules.

---

## 4. Cuts

| Cut | Why safe |
|---|---|
| contributor: `.env` / `CLAUDE_API_KEY` setup block (~40 words) | Dead: no consumer exists anywhere in the repo; the harness that used it was removed (the guide itself narrates the removal). Never carried weight since. |
| contributor: Writer Enforcement status table (~120 words) | Signal is derivable (`grep`/lint); table is already wrong in both directions (lists a dead skill, omits five live ones). Rule survives as one sentence in Contribution Patterns + a lint check (M9). |
| contributor: Cache Lifecycle Rules + protocol restatements (~250 words) | Verbatim-fidelity canon exists in `src/hidden-skills/operating-contract.md`, present in this same repo; the pointer costs 15 words and cannot drift. |
| contributor: per-skill one-line annotations for all 20+ hidden skills in the Repository Map (~350 words) | Each skill's own frontmatter `description` is the maintained source of that sentence; the map keeps the trees and categories. Duplicating 20 descriptions guarantees N-way drift (already happened: designer/elicit/stack-forge missing). |
| contributor: engineer-skill *family spine* listings (the two full section-order sequences, ~90 words) | "Copy the newest sibling from the same family" is the load-bearing rule and survives; the spine listing duplicates what opening any sibling shows, and drifts when a sibling gains a section. |
| skill-writer: "Shallow translation", "Ambiguous medium", "Service-by-service interrogation" failure modes (~200 words) | Product-domain content rules, not writing-standard rules; each moves to (or already exists in) the shipped skill that owns the concern — verify at execution and relocate rather than delete where absent. |
| skill-writer: flag-gated milestone exemplar (~80 words) | Actively wrong against current canon; replaced by a canon-neutral pair (M1). |
| scaffold-designer: implementation detail inside checklist items (~350 words) | The file's own header declares the generators and principles canon; the question-form items keep every check while the referenced code carries the detail. |
| CLAUDE.md: engineer-skills delivery explanation in Rules (~45 words) | Duplicates contributor's "Engineer-skill delivery"; the router keeps a pointer clause. |

---

## 5. Risks & cross-section flags

Execution risks:

- **M7 (contributor split) changes what is in-context by default.** A session that previously had the release checklist or harness detail in context must now read a reference file; if the core's pointers are weak, contributors will improvise. Mitigation: pointers name the trigger task, not just the file ("before cutting a version, read…"), matching the CLAUDE.md routing style that already works.
- **M9 adds a lint check** — code change, small blast radius, but it must exempt non-document-producing skills (scan, review, persona, check) or it fails green builds; derive the must-reference list the way `MUST_REFERENCE_CONTRACT` is derived today.
- **M2/M3 change the lens mid-review.** The other nine section plans were written against old skill-writer; the master plan should apply new-lens judgments *before* executing their moves (see flags).
- **M12 (checklist thinning) risks losing a check** if compression drops an item instead of shortening it. Acceptance: item count identical before/after; only per-item length changes.
- Contributor is dev-only (`.npmignore` excludes `.agents/`), so none of M7–M10 needs a migration or changelog machinery — but M9's lint change and any relocation of skill-writer failure modes into shipped skills (M6) touch the shipped surface and need the standard changelog annotation.

Cross-section flags:

FLAG(5): skill-writer gains an audience taxonomy (M2) under which the bet `briefs/*.md` gate-shaped imperative register is *conformant, not a violation* — re-weigh any bet-delivery findings that flagged brief terseness against old skill-writer's "explain reasoning over rigid constraints". Separately, the Decomposition/Delivery mental-model bullets in `groundwork-bet/instructions.md` are the named exhibit for the new density rule (M4): 200+-word em-dash run-ons that should be broken up, and section 5's plan should claim that fix.

FLAG(9): same taxonomy point for engineer skills — Safety Gates ("Do not…", "Never…", "Always validate…") are correct register for execution routers under the new lens; findings recommending they be reframed as explained reasoning should be dropped. The engineer-family "spine" listing is being cut from contributor (see Cuts); if section 9 relies on that listing as the family contract, the newest-sibling-as-template rule is its replacement.

FLAG(8): two canon tensions surfaced here belong to the principles corpus: (a) skill-writer's retired flag-gated-milestone exemplar traces to old delivery canon — check nothing else in `src/docs/principles/` still teaches it as GroundWork's model; (b) `src/docs/principles/delivery/progressive-delivery.md` teaches "ships dark behind a flag" while bet canon says trunk "requires no feature flag" and delivery names flags a team-optional choice — reconcilable (principles describe the general technique, the bet contract a stronger guarantee) but the boundary should be stated on the principles side.

FLAG(1): the orchestrator's `description` is the proven case study for the new "description is the router" principle (M5) — if section 1 proposes shortening that description, weigh it against the discoverability incident that lengthened it (`0deb8e4`).

FLAG(6): contributor's four-tier ownership table and migration/reconcile decision rules stay in the always-on core (they trigger on most changes), but Releasing moves to `references/releasing.md` — if section 6's plan cites contributor section names for the update/release contract, repoint. The Family Index remains canonical in `groundwork-update` itself; contributor keeps only the decision rules.

FLAG(3): M6 relocates the durable kernel of "Shallow translation" and "Ambiguous medium" into design-system-owned text if not already present — section 3 should confirm current coverage there before this section deletes them from skill-writer.

FLAG(7): "Service-by-service interrogation" (cut from skill-writer) is a facilitation anti-pattern owned by the persona/facilitation layer — section 7 should confirm the product/architecture facilitation flow states the propose-the-pattern alternative.

---

## 6. Expected outcome

| File | Current | Target | Delta |
|---|---|---|---|
| skill-writer/SKILL.md | 2,408 | ~2,650 | **+~240** (cuts ~430: stale exemplar, domain-leaked failure modes, merged duplicates; additions ~670: taxonomy, budget cluster, density, description-as-router — counted honestly, this file grows because it was silent on the failure modes that matter most) |
| groundwork-contributor/SKILL.md (always-on) | 7,367 | ~2,800 | **−~4,570 always-on** |
| contributor `references/` (new, on-demand) | 0 | ~2,550 | +2,550 on-demand (testing 1,400 · contracts 700 · releasing 450) |
| scaffold-designer/SKILL.md | 1,486 | ~1,100 | −~390 |
| AGENTS.md (=CLAUDE.md) | 232 | ~215 | −~17 (two rows added, one duplicated rule removed) |
| **Section total** | **11,493** | **~9,315** | **−~2,180 net; −~4,740 from the every-session tax** |

Behavioural improvements in contributor sessions:

- Every session in this repo starts ~4,700 words lighter, with the same information one pointed read away — and the map, tiers, and shipping triggers it does load are *true* (six verified drift instances fixed), so agents stop acting on a dead API-key instruction, a wrong package name, a wrong engineer-skill path, and a repo map missing the two biggest shipped trees.
- Writers get an answer to the four questions the old lens didn't ask: which tier pays for these words, where does this change integrate, when is the file done, and does this need words at all. That is the standing defense against the accretion this review is cleaning up — the next 20 uplifts land against a standard that resists appending.
- Brief and engineer-skill authors stop being whipsawed between "explain, don't constrain" and the gate-shaped register their file class actually needs; reviewers (including the other nine sections of this review) get a lens that distinguishes facilitation skills from dispatched briefs instead of scoring both against conversation rules.
- New-generator designers follow a guide that matches the code: right skill tree, right harness shape, and the two registration steps (generators.json, changelog gate) that currently surface only as CI failures.
