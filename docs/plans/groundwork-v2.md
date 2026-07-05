# Implementation Plan: GroundWork V2 (Engine Rails, Adversarial Fleet, Runtime Verification, BMAD Mechanics)

**Status:** Waves 0 & 1 EXECUTED 2026-07-03 (v0.14.0) — all of W0.1–W0.3 + W1.1–W1.10 landed; the Wave-1 exit-gate simulation ran and was independently judged **FAITHFUL** (all six delivery mechanics re-derivable from durable artifacts; see §9.7). Waves 2–3 remain PROPOSED. Sourced from two research streams run to conclusion: (1) a forensic analysis of ~118 agent transcripts across three magpie bet deliveries plus a 27-bug escape catalog mined from the owner's manual bug-fix sessions; (2) a full dissection of BMAD-METHOD v6.9 (method layer, tooling layer, philosophy docs) as the mature prior art, with every adoption candidate spot-verified against this repo.
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; judgment calls that remain are open decisions in §10.
**Scope owner:** The whole delivery loop (`groundwork-bet`), the orchestrator, the CLI (`bin/groundwork.js` + `lib/`), and the setup-phase scaffold surface. This plan is how V2 of GroundWork gets built.

---

## 0. Read this first — the V2 thesis

GroundWork is an opinionated method for human-in-the-loop software delivery. **Humans spend their time shaping — UI/UX, API, schema, architecture, data flows, tradeoffs — and agents execute at the code level inside rails that make strong outcomes structural.** The outcome is high-quality products, with high-quality software, at speed.

The canonical statement of this differentiation is [`docs/groundwork-vs-bmad.md`](../groundwork-vs-bmad.md) §Design altitude: the human authors and locks every design altitude of every bet — **UI first, then data flows, then API, then schema** — because that walk is where their judgment is decisive, *and* because a human who walked it understands the system they now own well enough to support it in production. BMAD engineers context so agents don't need the docs; GroundWork additionally engineers the design walk so humans understand the product. Every wave below must preserve both halves — the authorship and the comprehension. Nothing in V2 moves a design-altitude decision from the human to a default.

The evidence says the methodology's conceptual spine is right and must be kept: appetite-bounded bets, vertical slices with falsifiable capabilities, front-door proofs on real infrastructure, sealed intent with recorded amendments, red→green delivery, postmortems distilled into carried action IDs. Five of its core assumptions about model weaknesses were re-confirmed by this quarter's transcripts, and its adversarial lenses caught the real bugs. What gets rebuilt is the **enforcement medium** and the **economics**: process-as-prose executed by model attention gets rationally skipped, attestation-style checks rubber-stamp, duplicate state drifts, review findings evaporate without closure — and every one of the 27 bugs the owner had to find by hand lived in a dimension no fixture suite observes.

BMAD supplies the maturity mechanics (context bookkeeping, JIT loading, customization without forking, guidance, packaging polish). The transcript evidence supplies the V2 architecture. The runtime-verification wave is the leap **past** BMAD — BMAD has nothing that observes the running product.

Five design principles organize everything below:

> **1. Three trust problems, three rails.** *Facts* (did tests run; does prose match the seal; is the diff inside the slice surface; does any production caller exist; is the generated file clean) → a **deterministic engine**: CLI verbs computing from git/build/coverage, blocking state transitions fail-closed. Agents never attest what a tool can compute. *Code judgment* (does it break on unhappy paths; does the test bite) → a **small adversarial fleet**: fresh-context skeptics framed to find breakage, never to confirm conformance. *Intent judgment* (is this what we meant; should scope change) → **human steering, placed deliberately**: the loop runs without input by default, but every genuine steering moment stops and asks — with distilled context and a guided recommendation, never a raw question. Non-steering decisions take the recommended default, get logged, and batch to the next checkpoint for ratification. The stop-worthiness test, in the owner's own words: "is it worth stopping delivery to ask this now, or could it wait?"
>
> **2. One state, generated views.** A single machine-readable bet state (intent, capabilities, slices, seal, findings + dispositions, decisions + ratification, verified facts) owned by the engine. Status boards, ledgers, JSON twins, and frontmatter become *projections*; drift becomes impossible by construction. Prose remains where humans read — pitch narrative, design rationale — **demoted from process substrate to judgment input**. This is a deliberate evolution of `gw-bet-prose-redesign`'s "prose is the contract": prose stays the human-judgment surface and the thing the owner approves and seals; the engine state becomes the process substrate. The evidence for the evolution: N sources of truth plus protocols to keep them agreeing, and 17 doc files / 761 lines for one bet — the framework fighting drift its own artifact sprawl creates.
>
> **3. Executable verification beats review multiplication.** All 27 escaped bugs lived in dimensions no fixture suite touches: rendered geometry, cross-state navigation, control wiring, real data, token conformance. No amount of extra code review closes those classes — a runnable front-door harness does. Per-project verification infrastructure becomes a *setup-phase deliverable* with the same priority the design system gets today; "the harness can't drive the app" is a blocking infrastructure defect, not a standing caveat.
>
> **4. Adversarial framing only.** Any check phrased "confirm X" rubber-stamps (acceptance auditor: 17 runs, 2 catches, ~12 "conforms and is honest" verdicts — 4 of them false-negatives on diffs other lenses proved buggy). Every agent check is phrased "find where X fails," and every finding lands in a ledger with an enforced disposition.
>
> **5. Context flows down as distilled state, never as re-reading.** The engine generates a per-milestone context pack; workers and reviewers read the pack; fixes go to the context-holder (driver inline or original-worker continuation), never to a fresh re-deriver. Measured costs of the current shape: fix-application agents re-derived context at 41% of original build cost; 3 design docs were read 16× per fleet; the same fact was re-verified 3× by independent agents.

---

## 1. Findings

### 1A. Transcript evidence (forensic analysis of three live bet deliveries)

IDs are referenced by the waves below.

**Confirmed model weaknesses — the patch earns its keep (keep and sharpen):**

| ID | Finding |
|---|---|
| T1 | *Games proofs / self-deceives under pressure to prove.* Fresh catches this quarter: tests asserting a test-only mirror instead of shipping styles; a dead `Motion.resolve` shim satisfying conformance on paper; a hand-edit inside a generated file; slice guards silently deleted at bet close. |
| T2 | *Cannot judge its own work.* The blind reviewer (context-starved, ~2 tool calls, ~90s) caught the two biggest bugs of design-uplift. Independence + starvation is the active ingredient. 10+ real catches by edge-case-tracer across 3 bets, zero false positives. |
| T3 | *Writes implementation-derived tests that cement rather than verify.* Coverage lens: 8 unique real catches (phantom oracle, unasserted values, untested math). The "deletion test" was promoted into briefs and demonstrably caught again in the next bet. |
| T4 | *Proves plumbing, not product.* Real-infrastructure front-door proofs changed plans twice; whole-bet experience gates caught cross-slice gaps per-slice review structurally cannot see. |
| T5 | *Silently drifts sealed intent.* The M2 proof over-claim (a video-deep lift that couldn't run) was a genuine integrity catch. |

**Confirmed weaknesses — wrong patch (agent attention where a tool belongs):**

| ID | Finding |
|---|---|
| T6 | *Skips prescribed-but-friction steps; silently defeats policy.* Slice workers ran at frontier despite tier policy ("defeated with nothing visibly failing"); Serena/repo-map registered but logged **zero** use across live deliveries; canon "rationally skipped." Every recent framework fix moved a rule from prose to mechanism. **Prose does not bind agents; executable rails do.** This is the central lesson. |
| T7 | *Attestation-style checks.* Prose-integrity and honest-green walks ran every slice and never tripped (facts computable from git/build). Framed as confirmation, agents rubber-stamp (see T-acceptance numbers in principle 4). Facts should be computed, never attested. |

**Overpriced patches — cost more than the residual risk:**

| ID | Finding |
|---|---|
| T8 | *Re-verifying approved judgment.* Protocol 9 doc re-reviews at milestone open: 3 dispatches observed, zero critical findings ever, over ground the driver's mechanical checklist had just covered. 9 doc-review dispatches in design-uplift's OTHER bucket. |
| T9 | *Synchronous owner custody of every decision.* One session blocked 8.3h on one binary question (inflated — the owner was asleep — but the class is real). The lesson is not "avoid asking": stops should pass a stop-worthiness test, arrive with distilled context and a guided recommendation, and non-steering decisions should batch to the next checkpoint. |
| T10 | *Duplicate state as drift insurance.* JSON twins, status frontmatter, state.json, ledgers, tags — N sources of truth plus protocols to keep them agreeing (17 doc files / 761 lines for one bet). |
| T11 | *Uniform process depth regardless of stakes.* Same 4-lens fleet for a schema migration and a UI copy tweak; fixed validation tail regardless of the pitch's own Stakes field — which nothing currently reads. |

**Structural gaps the current design misses entirely:**

| ID | Finding |
|---|---|
| T12 | *No findings closure.* Design-uplift M4: 12 lens runs raised the bet's severest findings; no fix cycle ever ran; nothing noticed. Review output can evaporate. |
| T13 | *The front-door promise breaks exactly where it matters most.* "Green ≠ observed in use" recurs in every UI bet retrospective (the headless XCUITest wall) — so the framework's highest-value idea degrades to manual owner verification and standing caveats. **The escape catalog proves the cost**: 27 owner-reported bugs, every one shipped on a green suite ("378/403/408 tests pass"), in six classes: **(a) state-dependent reachability** ×3 recurring (no way back to import progress once the library populated; `showIndexing()` wired but unreachable; collapsed inspector that won't reopen — tests exercised components in isolation, nothing ever navigated back after populating); **(b) layout overflow at realistic content** ×3 recurring (full-res image's intrinsic size pushing ALL chrome off-screen — the controls existed in code, so presence-based checks passed; images escaping their row — tests asserted logic, never geometry); **(c) missing affordances vs intent** ×4 (scrubber with no position indicator, no visible close, no completion feedback, no add-more button though the model supported it); **(d) built-but-never-wired controls** ×4 (handlers empty or with no reachable caller — mechanically detectable, nothing scans for it); **(e) design-system drift** ×3 escalations ("none of the styling we aligned on has been delivered… a complete failure of the process" → "looks like an amateur app" — no per-change drift ratchet exists; degradation is caught only when the owner's patience breaks); **(f) real-data/model quality** ×10 ("0 KB" video, "1 sec" estimate reopened after a green fix, subject = home-folder name, "!!!!!!" captions — only real files and real model output expose these). |
| T14 | *Context is redistributed by re-reading, not by distillation.* The 41%/16×/3× numbers in principle 5. M1 proved inline/context-holding fix application is 1–2 orders cheaper. |

### 1B. BMAD mechanics — verdict table

Every row verified against the v6.9 clone at `~/Workspace/mbad-method`.

| BMAD mechanic | What it is | Verdict |
|---|---|---|
| Step-file architecture | Workflows split into micro step files; "read one step fully, execute, load the next only when directed"; state in artifact frontmatter | **Adopt — for `04-delivery.md` only** (W1.1). Other phases are read-once conversational files; sharding them buys ~1–2k tokens for real routing complexity |
| `sprint-status.yaml` machine state | story-key → status map; scanned, atomically updated; audit trail + resume | **Adopt** as cache-tier board (W1.2), subsumed by the Wave-2 engine state |
| Story "Dev Notes" capsules + cached `epic-N-context.md` | Per-unit micro-manual extracted at creation time; dev never re-reads upstream docs; cache invalidated when planning docs are newer | **Adopt as pointer-only milestone packs** (W1.3) — pointers + learnings, never contract text |
| Subagent output discipline | Full review/analysis → file; parent receives verdict + 2–5 findings; reads files on demand | **Adopt** (inside W1.4) |
| Append-only memlog | `.memlog.md` per workspace; every decision logged; resume = read memlog | **Adopt per-bet** (W1.2); folds into engine state as the journal projection in Wave 2 |
| `project-context.md` constitution | Distilled LLM-optimized rules file loaded by every implementation workflow | **Reject the prose copy** — docs/architecture + design-system + principles are the living constitution; an LLM-distilled duplicate is the second source of truth Protocol 10 exists to prevent. **Adopt the deterministic half**: `repo-map --conventions` digest (Wave 2) |
| `bmad-help` | State-aware "what's next" from a skill catalog + artifact completion detection | **Adopt inside the orchestrator** (W0.1) — no third registered skill; the two-entry context economy is a structural advantage to protect |
| Named personas | Six named agents with hardcoded identity + customizable layers | **Settled reject** (bmad-quality-uplift D2; single expert-peer facilitator) |
| Stakes calibration (hobby/internal/launch) | One project-level question scaling artifact + review depth | **Reject** — user steer: GroundWork is opinionated; one way to work; AI makes working that way cheap. Distinct from the pitch's per-bet Stakes field, which stays and finally gets read (W1.8) |
| Three-layer TOML customization | Shipped defaults → committed team overrides → gitignored personal; sparse files; shape-based merge; stdlib resolver | **Adopt as a central two-file additive policy layer** (W1.9) — users add rigor and context, never remove the floor |
| Module registry / external modules | bmad-modules.yaml, git-cloned modules, marketplace-plugin resolution | **Park** (§7) — `[skills]` + the policy layer cover today's need |
| `platform-codes.yaml` | Declarative 50+ IDE/tool target registry driving install | **Adopt as `src/config/hosts.json`** (W0.2) — without per-IDE body templates; single-AGENTS.md canon stays structural |
| Channels / version check / `--set` / skill validator | stable+next dist-tags; async npm check; non-interactive config; 12-rule deterministic skill lint as CI gate | **Adopt selectively** (W0.3): version check, `--set`, skill-lint uplift; defer a `next` dist-tag (document only) |
| Web bundles | Skill subsets packaged for ChatGPT/Gemini web UIs | **Reject** — serves BMAD's document-first funnel, not GroundWork's executable soul |
| Checkpoint Preview | Human review walkthrough: diff organized by concern, blast-radius spots, suggested manual observations | **Adopt** as the decision-ratification walkthrough (W1.6) |
| `bmad-dev-auto` unattended loop | One unattended iteration; spec status state machine incl. `blocked`; driven by an outer orchestrator | **Park** (§7) — user steer: whole-bet mode *is* the unattended path; no outer-orchestrator machinery now |
| Analysis phase (brainstorming, forge-idea, research, PRFAQ) | Ideation upstream of planning | **Park with full detail** (§7.1) — user steer |
| Party mode | Multi-persona roundtable; the vs-bmad doc rates it "a genuinely useful multi-perspective device" | **Park** (§7.7) as a multi-perspective debate device on *isolated subagent dispatches* only — the no-user-facing-troupe decision stands |
| Advanced elicitation catalog (100+ techniques) | CSV-driven technique menu invocable behind any artifact | **Park** (§7.7) — `groundwork-elicit` stays lean; grow `methods.md` on demand, never ship a catalog for its own sake |

---

## 2. Wave 0 — Guidance & packaging polish (independent, ship anytime)

**W0.1 — Guidance surface.** Extend the orchestrator; do NOT add a registered skill. Three slices:
- *W0.1a — enrich the generated catalog.* `scripts/generate_workflow_index.js` gains (i) a Delivery-Loop lanes section (patch / quick-bet / bet with each lane's scope-test one-liner, parsed from the Work Intake triage bullets in the orchestrator SKILL.md so the no-drift rule holds) and (ii) a "General questions" pointer row (docs/ + llms.txt as the answer corpus). *Accept:* `node scripts/generate_workflow_index.js --check` green; index shows lanes + question-answering row.
- *W0.1b — one Guidance procedure* behind the "help" / "what's next" intents in `src/skills/groundwork-orchestrator/SKILL.md`: state resolution (already runs) → **position report** (setup mode: phase N of M with artifacts checked off; delivery mode: active lane state from pitch `status:` + `./dev bet status`, patch-cluster trailers, pending `.groundwork/cache/upgrade-brief.json`, open `docs/maturity.md` rows) → **exactly one recommended next action with the sentence to say to start it** → general questions answered from docs, never memory. *Accept:* `./dev lint skills` green; sandbox transcript — "what's next" mid-delivery names the active bet and the first red slice, not a setup phase.
- *W0.1c — intent-first dispatch rule.* When the opening message maps unambiguously to a lane or skill, skip the introduction and route in the same turn; when ambiguous, ask exactly one clarifying question. One paragraph in Intent Handling; validated by the simulation checklist.

**W0.2 — Host registry.** Extract `AGENT_ADAPTERS` (`bin/groundwork.js` ~lines 860–871) into `src/config/hosts.json` (JSON — the CLI stays dependency-free). Schema per host: `key, label, detect[], native, links[] ({link, target, type}), status ("verified"|"wired-untested"|"manual"), notes`. `detectAgents` / `wireAgents` / `promptAgents` / `parseInitFlags` become data-driven. **No body-template or copy semantics in the schema** — only symlinks to `AGENTS.md`/`.agents/` or `native: true`; the single-canon invariant stays structural. Follow-ons: a lint cross-check that `docs/host-support.md`'s matrix rows agree with registry keys/status; optionally add `windsurf` as a data-only row. *Accept:* all cli tests green unchanged; `npx groundwork-method init --agent cursor` in a scratch repo produces byte-identical wiring.

**W0.3 — Packaging.**
- *Async version check:* non-blocking HTTPS GET to `https://registry.npmjs.org/groundwork-method/latest` (1500ms timeout, all errors swallowed); one dim line after command output when newer; suppressed on non-TTY, `CI`, `GROUNDWORK_NO_UPDATE_CHECK`, or the `update` command. Tests set the suppress env in conftest.
- *`init --set key=value`:* writes into the seeded config.toml at seed time only (never mutates an existing config — that file is user-owned); key allowlist derived from the seed template; reject-`__proto__`/`prototype`/`constructor` guard. *Accept:* new cli test — `init --yes --set defaults.stack=go` seeds the value; re-run on an existing install refuses with a named message.
- *Channels:* defer a `next` dist-tag (single-maintainer cadence; the migrations registry + upgrade brief already give installs a safe lag path). Document how one would be cut in `references/releasing.md`. Zero code.
- *Skill-lint uplift* in `scripts/lint_skills.py`: registered-skill description budget + intent-shape check; word-budget warnings per instruction file against skill-writer canon; no time estimates and no concrete model ids outside the Model-Tier exemplars; `templates/` and `briefs/` references resolve. New rules hard-fail only where the corpus is already clean — fix violations in the same slice. *Accept:* `./dev ci` step 1 green on the whole corpus; a deliberately broken fixture fails.

**W0.4 — Docs refresh. DONE — SUPERSEDED 2026-07-03.** `docs/groundwork-vs-bmad.md` was fully rewritten as an as-is differentiation doc (`0a7f5d3`), replacing the delta-note refresh this slice originally planned: design altitude is the lead differentiator, history/correction notes removed, unverifiable community claims dropped, honest gap list added, and a Direction section points at this plan. No further work. The rewrite's "Where BMAD is ahead" list is dispositioned by this plan: customization hierarchy → W1.9; help index with phase routing → W0.1; checkpoint walkthrough → W1.6; unattended lane → §7.2; elicitation catalog, party-mode device, and a published docs site → §7.7.

---

## 3. Wave 1 — v0.14.0, evolutionary (prose edits in `src/hidden-skills/**`, ship now)

One coherent delivery rewrite: the review-policy overhaul and the BMAD context mechanics both rewrite `workflows/04-delivery.md`, so they land as a single restructuring of `groundwork-bet` plus `package.json` 0.14.0 + CHANGELOG. All in the tier-1 skill tree (copied verbatim on update); `[no-migration]` except `gw-seed-policy-toml` (W1.9).

**W1.1 — Step-file delivery spine** *(responds to the context economics; F-numbers from the design work: the 6,383-word delivery file loads whole, ~1.8k words of it trigger-only protocol text)*:

```
workflows/04-delivery.md                      → spine (~1,200 words): driver mental model, restrictions,
                                                git-workflow summary, board/memlog/pack conventions, step router
workflows/delivery/step-01-readiness.md       → Steps 0 / 0.5 / 0.7 (gates, red board, granularity, state init)
workflows/delivery/step-02-slice-loop.md      → dispatch capsule, review, triage, fix ladder, record/close
workflows/delivery/step-03-milestone-close.md → front-door proof, Tiers 1–3, honesty audit, experience-auditor
workflows/delivery/step-04-postmortem.md      → postmortem Qs, checkpoint walkthrough, opening/introducing a milestone
workflows/delivery/on-amendment.md            → Amendment Protocol           (loaded only when triggered)
workflows/delivery/on-change-navigation.md    → Change Navigation            (loaded only when triggered)
workflows/delivery/topologies.md              → submodule/polyrepo deltas    (loaded only off-monorepo)
```

Pitch frontmatter stays the *phase* state machine (unchanged). The *step* pointer is `board.yaml: step` (W1.2); the spine's router maps board state → one step file — "read fully, execute, load the next only at its transition line"; each step file ends with an explicit transition. **PRESENT gates travel with their step** — no gate is deferred across a step boundary. Honest accounting: delivery-entry instruction load drops ~8.5k → ~3.6k tokens; the compounding win is resume — spine + step + board + memlog ≈ 4–6k tokens versus re-loading the full workflow and re-deriving state from git/prose (10–20k late in a deep bet).
*Slices:* mechanical split with a content-preserving diff (every gate sentence in exactly one step file) + `instructions.md` row; `scripts/lint_skills.py` accommodation (recognize `workflows/delivery/` and `on-*.md`; filename allowlist ~line 413); re-point `00-quick.md` / `05-validation.md` cross-references. *Accept:* lint green; `grep -rn "04-delivery.md#"` resolves; the Wave-1 exit simulation exercises spine→step routing.

**W1.2 — Bet working state (cache-tier; the Wave-2 stepping stone).** One per-bet directory `.groundwork/cache/bets/<bet-slug>/` (board.yaml, memlog.md, milestone packs, reviews/, reports/): created at Delivery Step 0, deleted at bet archive, gitignored, one new Protocol 7 row in `operating-contract.md` (additive; contract stays v1).
- *board.yaml* (schema v1): `bet, track (full|quick), mode (slice|milestone|whole-bet — the Step 0.7 choice, persisted), step, approved (tag@sha), milestones[].slices[] {key, status pending|in-progress|review|patching|done|blocked, commit, tier, review-pointer}, updated`. Keys derive from the decomposition tree paths so postmortems, amendments, and memlog lines reference stable identifiers. Driver-written only, rewritten whole + atomically after every transition. **The board never gates in Wave 1:** on fresh-context resume the driver reads the board, then reconciles against `./dev bet status` and the branch's git log; tests+git win every divergence. Board absent or corrupt → today's resume path *is* the bootstrap path, so in-flight bets self-heal with **no migration**. Zero proof text, zero capabilities, zero API shapes — any slice proposing otherwise is rebuilding `decomposition.json` and gets rejected.
- *memlog.md*: append-only, one timestamped line per event — slice closed (sha + Notes gist), amendment (sha + reason; **the git commit + re-pointed tag stay canonical, the memlog line is an index entry**), postmortem gist (~2 lines), mode choice/re-confirmation, blocked/unblocked, change-proposal filed. A deep bet ≈ 60–100 lines ≈ 1–2k tokens — the resume read that replaces replaying `git log -p` + postmortem prose. New `./dev bet log <slug> -- "<line>"` subcommand (`cli-src/src/commands/bet.ts` + registry + bundle rebuild) with a documented `printf >>` fallback.
- *Cleanup:* `archive()` in `bet.ts` also removes the cache dir; `05-validation.md` Step 3 names the manual fallback.
*Accept:* `./dev test contracts` green (bundle freshness); no proof-bearing field in the documented schema; resume paragraph names tests+git as the tiebreak; archive of a fixture bet leaves no cache residue.

**W1.3 — Milestone context pack** *(T14; merged from both designs)*. NEW `groundwork-bet/templates/milestone-context.md`; the driver distills once per milestone open (m1 at readiness) to `milestone-<NN>-context.md`, refreshed at slice close. **Deliberate deviation from BMAD's Dev Notes, flagged:** BMAD copies design content so the dev never opens upstream docs; GroundWork must not — a second copy of API/data shapes is exactly the drift `gw-bet-prose-redesign` killed. The pack compresses **pointers and learnings, never contracts**:
- *Pointers:* the technical-design files + section anchors this milestone's slices touch; the milestone `index.md`; stack(s) + the engineer Context-Routing rows the driver resolves for the worker (an execution-tier worker should not guess);
- *Learnings:* digest of prior slices' Notes chain, postmortem gists, findings-ledger entries, and verified facts; proven recipes/PoCs and their durable paths; testing obligations and path rules; worktree environment facts (ports, scratch DB, fixtures, bootstrap quirks);
- *Frontmatter:* `compiled_from: <sha the bet/<slug>/approved tag points at>`, `milestone: NN`, source paths.

**Staleness is mechanical:** amendments re-point the approved tag, so pack-stale = `compiled_from` ≠ current tag sha; checked at milestone open and after any amendment; stale → recompile. **Ripple analysis stays per-slice at dispatch** (caller lists go stale per commit; the pack states this exclusion). The dispatch capsule shrinks to: pack pointer + slice file + red test path + files-to-modify + prior commit + constraints + ripple list — "pass pointers, don't paraphrase" retained. All brief Inputs updated. In Wave 2 `groundwork pack build|refresh` generates this from state instead of driver authoring.
*Accept:* the template has no section that could hold an API shape; the staleness rule states the tag comparison verbatim; dispatch list ≤ current length minus the moved items.

**W1.4 — Review policy: the adversarial fleet + findings closure + output discipline** *(T2, T3, T7, T12)*:
- **Per slice:** blind reviewer (stays context-starved — that is the active ingredient) + edge-case tracer (gains design anchors + a state-machine/lifecycle checklist seeded from the caught bug classes) on every slice; coverage lens default-on with a mechanical no-obligation skip.
- **Acceptance auditor retired per-slice** (17 runs / 2 catches / 4 false-negatives), reborn as a per-milestone **honesty audit**: test-mirrors, dead shims, generated-file edits, dropped spec marks, guards-shipped-to-durable-home — plus driver conformance triage with escalation. (Wave 2's `honesty scan` mechanizes the computable half; the audit agent then judges only what the scan can't.)
- **Findings ledger with enforced closure** (T12): every finding gets a disposition (fixed / deferred-with-owner / dismissed-with-reason); milestone close blocks on open items. Prose-tracked in Wave 1 (`docs/bets/<slug>/findings.md` or the board's review pointers); `groundwork findings` verb in Wave 2.
- **Output discipline** (BMAD): every lens writes full findings to `.groundwork/cache/bets/<slug>/reviews/<slice-key>/<lens>.md` and **returns exactly**: a `VERDICT:` line, ≤5 one-line bucket-tagged findings, `FULL: <relative path>`. **Fail-closed preserved, explicitly:** Protocol 8 gates on a parseable verdict *in the returned text*; a lens returning only a path is *not a pass* — this sentence goes in each brief. The slice-worker keeps its ~20-line inline report and mirrors it to `reports/<slice-key>.md` so postmortems and validation re-read it without the driver holding it live.
*Files:* all five briefs, `step-02-slice-loop.md`, `step-03-milestone-close.md`. *Accept:* each brief's return spec ≤10 lines and contains a parseable `VERDICT:`; grep shows no per-slice acceptance dispatch remains; milestone-close text blocks on open ledger items.

**W1.5 — Fix-in-place ladder** *(T14)*: driver inline when small (M1-proven 1–2 orders cheaper) → continuation to the original worker (context-holder) → minimal-capsule fix worker with a strict scope rule. Kills the 41% re-derivation tax. Encoded in `step-02-slice-loop.md` + `briefs/slice-worker.md`.

**W1.6 — Owner decisions: stop-worthiness + default+veto; the checkpoint walkthrough as ratification surface** *(T9; BMAD checkpoint-preview)*:
- **Hard stop only** for destructive / scope-changing / proof-weakening decisions. Otherwise: record the recommended default in `docs/bets/<slug>/decisions.md`, proceed, ratify at the next natural pause; `[provisional]` single-commit amendments; the approved tag moves only on owner ratification. Codified in the delivery spine + `instructions.md` invariant list. Converts the 8.3h stall class to minutes.
- **Design-altitude guard** (from the vs-bmad canon): default+veto applies to non-steering decisions only. Anything that would change what the owner authored at a design altitude — UI, data flows, API, schema, i.e. the locked technical design — is an amendment and therefore a hard stop, never a defaulted decision. And the walkthrough's job is to *maintain* the owner's system comprehension as delivery evolves it; it complements the design walk, it never substitutes for authorship.
- **NEW `briefs/checkpoint-walkthrough.md`** (frontier tier, read-only, *not a gate and not a lens*): (1) the accumulated change organized **by concern, not file order**; (2) 2–5 highest-blast-radius spots tagged `[auth]/[schema]/[contract]/[data]/[infra]` with why; (3) 2–5 suggested manual observations phrased as front-door actions — a script for the owner's front-door drive the milestone close already mandates; (4) **the pending decisions queue presented for ratification**; (5) open deferred/maturity rows this change touches. Findings, if any, triage through the existing buckets; the gates beside it are unchanged.
- **Fire points:** milestone postmortem pause (milestone-by-milestone and whole-bet modes), validation Step 4 prelude (whole-bet scope), quick-bet close (inline lightweight version — single screen, no subagent, mirroring quick-bet depth carve-outs).
*Accept:* sandbox transcript shows a milestone pause opening with a concern-organized walkthrough, the owner's front-door cases annotated with suggested observations, and a batched decision ratified.

**W1.7 — Attestation theater removed** *(T7, T8)*: prose-integrity becomes one git-pathspec test; honest-green's consumer-compile runs only on ripple slices; the shipping-build check only on front-door slices; **P9 doc re-reviews reserved** — milestone open runs the mechanical Decomposition Gate only (recorded item-by-item in the commit body); P9 dispatch only for new contracts/surfaces, post-amendment rungs, or a first decomposition.

**W1.8 — Stakes-scaled validation + audit dedup** *(T11)*: `05-validation.md` reads the pitch's existing **Stakes** field (`templates/pitch.md` line 15 — blast radius, reversibility, review load; authored per-bet by the owner); the bet-close experience audit re-drives only seams + milestones with post-audit commits. **This is not the rejected project-level stakes axis** — it is per-bet shaping the owner already writes and nothing currently reads; the floor (gates, lenses, proofs) is never conditioned on it. State this distinction in the canon sentence.

**W1.9 — Additive policy layer** *(user-approved: full)*. `.groundwork/config/policy.toml` (team, committed) + `policy.user.toml` (personal, gitignored). Central two-file — NOT per-skill customize.toml (the hidden-skill tree is clean-replaced on update; there is one facilitator, not 42 agents; a central file is auditable at a glance, which matters when the file's whole contract is "additive-only"). Merge kept deliberately trivial: scalars — user file wins; arrays — concatenate, team first. The declared v1 surface:

```toml
[facts]                      # persistent org facts — additive context
items = [
  "All services log in structured JSON per our org standard.",
  "file:docs/org/security-baseline.md",
]

[lenses]                     # ADDITIVE review lenses — never replace built-ins
[[lenses.slice]]
name  = "security-review"
brief = ".agents/custom/lenses/security-review.md"   # user-owned path, outside .groundwork/skills/

[checklists]                 # additive items per groundwork-review document_type
architecture = ["Every service names its data-residency region."]

[phases]                     # prepend/append instruction hooks per skill
[phases.groundwork-product-brief]
prepend = [".agents/custom/hooks/brand-guardrails.md"]
```

Injection points (all existing seams): `[facts]` → orchestrator State Resolution + every dispatched capsule/pack via the constraints slot + setup facilitators at phase init (Protocol 3.2). `[lenses]` → dispatched in the same parallel wave as the built-ins, frontier tier, findings through the same buckets — **floor rule in canon: user lenses add findings; they can never satisfy, replace, or stand in for a built-in lens or `groundwork-review`.** `[checklists]` → user items append to the matched checklist (🟡 default; 🔴 per-item flag is an open decision — more blocking, never less). `[phases]` → Protocol 3 gains one additive sentence (hooks run at phase init / commit step; instruction files, not shell). **Rejected for v1: artifact-path overrides** — `references/cross-phase-contracts.md` keys writer/reader chains on those exact paths; an override surface there is an identifier-drift generator. Record as settled.
Tooling: `npx groundwork-method policy` prints the resolved merge as JSON; `groundwork check` validates policy files (parse errors, broken `file:` refs, missing lens brief paths, unknown keys named). Seed template in `src/config/`, `gw-seed-policy-toml` cli migration + fixture under `tests/fixtures/installs/`, `.gitignore` guidance for the user file, customization how-to page (docs/ + src/docs/).
*Accept:* migration-coverage gate green; sandbox check — a seeded fact appears verbatim in a slice-worker capsule; grep-audit — no built-in lens dispatch is conditional; new lint rule — the floor sentence is present wherever lenses are enumerated.

**W1.10 — Pointer + builder hygiene**: de-brittle §Bet-Slice-Rollout-style anchor citations; required-sections contract in stack-forge for generated engineer skills; engineer default-row audit — where a skill's "any non-trivial change" routing row front-loads >~3k words of references, distill a `references/core.md` (the JIT-router diet itself already shipped; this trims the default row). **Default-row audit executed 2026-07-03 — no distillation required.** Measured each skill's default-row bundle by `wc -w` on exactly the files that row loads: go = 1,701 words (`architecture` + `implementation-patterns` + `go-services`; ~1,912 counting the check-first `version-corrections`), python = 1,062 (`architecture` + `implementation-patterns`), node = 1,178 (`architecture` + `node-services`). nextjs/flutter/electron have no aggregate row at all — their Context-Routing tables are one-file-per-concern with an explicit "most tasks touch one or two references" instruction, i.e. the diet achieved structurally. Nothing crosses ~3k, so a `core.md` per skill would only re-duplicate always-needed slices and grow the corpus — the opposite of the diet's intent. `./dev lint skills` and `./dev check sync-anchors` green (unchanged tree).

**W1.10 default-row audit — outcome (2026-07-03, follow-up discharged):** the audit ran; no skill's default row crosses the >~3k threshold, so no `core.md` was created. The JIT-router diet that shipped in 0.14.0 already holds every default load well under it, and a `core.md` would have to duplicate content the task-specific rows still route to (`architecture.md`, `*-services.md`, `implementation-patterns.md`) — a second source of truth for no context saving. Default-load word counts (`wc -w`):

| Skill | Default row (fires for "any non-trivial change") | References loaded | Words | Decision |
|---|---|---|---|---|
| go | Any non-trivial service change | `architecture.md` + `implementation-patterns.md` + `go-services.md` | 526 + 544 + 631 = **1701** | Already lean → skip |
| node | Any non-trivial service change | `architecture.md` + `node-services.md` | 530 + 648 = **1178** | Already lean → skip |
| python | Any non-trivial service change | `architecture.md` + `implementation-patterns.md` | 498 + 564 = **1062** | Already lean → skip |
| nextjs | *(no always-on default row — routing is task-scoped)* | heaviest compound: `data-fetching.md` + `mutations-and-forms.md` | 1355 + 1055 = **2410** | No default row → skip |
| electron | *(no always-on default row — routing is task-scoped)* | heaviest compound: `process-model.md` + `security.md` (new window) | 816 + 902 = **1718** | No default row → skip |
| flutter | *(no always-on default row — routing is task-scoped)* | heaviest single: `architecture.md` (new feature) | **993** | No default row → skip |

The three surface skills (nextjs, flutter, electron) route purely by task shape and carry no "any non-trivial change" row at all; even their heaviest compound task load stays under 3k. No shipped change — audit only.

**Wave-1 exit gate:** a `./dev sandbox --simulate` delivery run on a frontier model exercising: spine→step routing; a mid-bet fresh-context resume from board + memlog + pack; one triggered amendment (tag re-point + pack recompile); file-backed lens returns with inline verdicts; one default+veto decision batched and ratified at a checkpoint walkthrough; a blocked milestone close on an open ledger finding. This also discharges the simulation still owed by `docs/plans/bet-delivery-orchestration.md`.

---

## 4. Wave 2 — The engine: facts move from prose to code

**Status: EXECUTED 2026-07-04 — every row landed, each with its delivery prose shrunk to invoke it in the same PR.** `findings` + `decisions` (durable owner-judgment state under `.groundwork/bets/<slug>/`; `ratify` records the verbatim response, closing the Wave-1 exit-gate finding) → `gate readiness|decomposition` + `seal verify` (the mechanical fail-closed half of the checklists; prose-integrity as one git-pathspec diff) → `repo-map --conventions` (the deterministic project-context digest, byte-identical across runs) → `honesty scan` (deleted guards, generated-file edits, best-effort zero-caller exports — leads for the audit agent, never verdicts) → `pack build|refresh|check` (milestone packs generated from state; pointers never contract text; driver-notes preserved; staleness = compiled_from ≠ tag) → `state` (the capstone: one composed document — seal, findings, decisions, pack freshness, board pointer — with `--check` as the aggregate fail-closed gate wired into milestone close and validation). **Recorded follow-on (state v2):** the full projection flip — board.yaml and status frontmatter becoming generated views of the composed document — deferred so the release rests on the settled Wave-1 board contract; the board still reports and never gates.

Incremental and non-breaking: new CLI verbs in `bin/groundwork.js` + `lib/` (dependency-free), each replacing a prose ritual, each a small PR, **skills shrinking in the same PR as each verb lands**:

| Verb | Replaces | Notes |
|---|---|---|
| `groundwork gate decomposition\|readiness` | The agent-walked checklists | Computes mechanically: files exist, anchors resolve, test paths named, tag present. Fail-closed exit codes |
| `groundwork seal verify` | The prose-integrity walk | Prose-vs-approved-tag diff |
| `groundwork findings add\|disposition\|check` | W1.4's prose ledger | `check` non-zero on open findings; wired into milestone close; CI-safe like `groundwork-method check`. **Persist the disposition exchange durably** (exit-gate finding, below): a fresh auditor should see the finding, the owner's disposition, and its verbatim rationale on disk — not infer it from a memlog line |
| `groundwork decisions add\|pending\|ratify` | W1.6's prose queue | The default+veto machinery. **`ratify` records a durable checkpoint entry** — what was presented to the owner and their verbatim response — so the human-in-the-loop mechanics are auditable state, not narration (exit-gate finding, below) |
| `groundwork honesty scan` | The computable half of the honesty audit | Tests asserting non-shipping symbols (assert-target vs production symbol graph), zero-caller shims, generated-file drift vs generator output, deleted-guard detection. The audit agent judges only what the scan can't |
| `groundwork pack build\|refresh` | W1.3 driver authoring | Generates the milestone pack from state |
| `groundwork state` | board.yaml + memlog + JSON twins + frontmatter duplication | **The single bet-state JSON** under `.groundwork/`; boards, ledgers, surface-ledger cells, status frontmatter become projections; JSON-twin maintenance deleted. The deliberate evolution of `gw-bet-prose-redesign` named in §0 principle 2 |
| `repo-map --conventions` | (new; BMAD project-context, deterministic half) | Versions from lockfiles, module hubs, test/build commands from config, naming/layout patterns observed; deterministic (two runs identical); staleness rides repo-map's per-worktree refresh; feeds packs. The LLM-distilled prose layer stays deferred — trigger: recurring worker failures traceable to unstated conventions |

Rationale to record in the CHANGELOG when this wave ships: the framework's whole incident history is prose rules being rationally skipped or silently defeated (T6) — this wave finishes the migration from "canon the agent must remember" to "rails the agent cannot skip."

---

## 5. Wave 3 — Close the escape classes: runtime verification as a deliverable

**Status: repo-side half EXECUTED 2026-07-04; runtime half gated on the first per-surface front-door driver (magpie/macOS is the proving ground).** Landed: **W3.3** `groundwork wiring scan` (empty actions + unreachable handlers, shares the honesty machinery, fail-closed for UI slices); **W3.7** `groundwork mutate` (the deletion test mechanized — revert source to baseline keeping tests, demand red; dirty-tree refusal, unconditional restoration); **W3.4-mechanical** `groundwork tokens scan` (raw color/font/spacing/motion literals vs the discovered token set, per UI slice); **W3.6** the affordance floor in the experience-auditor brief; **W3.2-prose** the realistic-content-scale rule in bet-progress-test canon; **W3.1/W3.5-prose** the readiness checklist's Runtime verification section (an undriveable front door or a synthetic-stand-in media proof is 🔴 blocking, routed to scaffold) and scaffold verification step 4c (prove each surface's driver drives; an unsolved headless wall = `blocks-delivery` maturity row). **Remaining, driver-gated:** the W3.1 lifecycle reachability walk itself, W3.2's driver-side layout fixtures, W3.4's designer screenshot review, W3.5's real-data proof runs — plus the §9.5 escape-class replay, which needs the driver to be meaningful.

The 27-bug escape catalog (T13) defines this wave. Four gates plus supporting items, each targeting a class no green fixture suite can see. This is the leap past BMAD: verification that observes the running product.

**W3.1 — Lifecycle reachability pass** *(class a — the recurring fresh-load-only bugs)*: a scripted state-graph walk — fresh launch → import → populated library → attempt to reach *every previously-reachable screen*, screenshotting each state. Runs at milestone close and before bet close. Requires solving the headless UI-drive wall ONCE per surface (XCUITest TCC-trust + unlock provisioning is already documented) — **setup/scaffold gains a per-surface front-door driver requirement** so "green ≠ observed in use" stops being a standing caveat. The experience-auditor then reviews *screenshots from the walk*, not code.

**W3.2 — Rendered-layout assertions at realistic content scale** *(class b)*: standard fixtures — oversized image (4000px), fully-populated rows/grids, longest realistic strings — assert chrome stays in bounds and controls remain hittable. Added to the front-door driver; the slice red-board template gains a "realistic-scale rendering" case for UI slices.

**W3.3 — `groundwork wiring scan`** *(class d — mechanically detectable)*: flag any interactive element whose action is empty or whose handler has no reachable caller (symbol-graph walk; shares the honesty-scan machinery from Wave 2). Per-slice, fail-closed for UI slices.

**W3.4 — Design-integrity ratchet** *(class e — the slow flat-and-boring drift)*: two parts. A mechanical **token-conformance scan** per UI slice (raw color/spacing/font/motion literals vs the design-token set — the retros' recurring re-deferred "tokenization pass" R-items, finally enforced); and a **screenshot review against the design reference** at milestone close by the designer persona — judgment applied to pixels, not prose. Degradation gets caught per-milestone, not when the owner's patience breaks.

**W3.5 — Real-data proof runs** *(class f)*: front-door proofs for media/model features must run real files and read real model output; "couldn't drive the GUI from this job" becomes a BLOCKING readiness finding, not a deferral note.

**W3.6 — Affordance checklist** *(class c)* folded into the experience-auditor brief: every temporal control shows position; every modal has visible dismiss; every long-running job signals completion; every capability the model supports has a reachable control.

**W3.7 — Mutation spot-checks**: `groundwork mutate --slice`, run by the coverage stage, mechanizing the deletion test.

Also: program/sibling-bet inheritance is deferred until the graded-library program's later bets provide the shape.

---

## 6. Explicitly killed

Per-slice acceptance dispatches; per-milestone P9 re-reviews (reserve conditions aside); agent-performed prose-integrity / honest-green walks; fresh apply-patches re-derivation; synchronous stops for non-steering decisions; hand-maintained JSON twins (Wave 2); the 3-commit amendment ceremony. From the BMAD study: named personas; a project-level stakes axis; per-skill customize.toml files; artifact-path overrides; web bundles; per-IDE body templates in the host registry.

---

## 7. Parked — future feature ideas (full detail preserved so nothing is lost)

1. **`groundwork-forge` ideation porch** *(user steer: park with details)*: one hidden Anytime skill pressure-testing a raw idea — premise → sharpest failure modes → cheapest disproof → verdict *hardened / needs-evidence / dead*. Reuses `groundwork-elicit/methods.md` with a small ideation-technique block (one catalog, two consumers). Scan-style carve-out: no `docs/` artifact, no review gate, working file at `.groundwork/cache/forge/<slug>.md`, deleted when consumed. On *hardened*: pre-setup → seeds `groundwork-product-brief` discovery; post-setup → seeds bet discovery as a pitch input or drops a `## Bets` discovery-note bullet. On *dead*: one-paragraph epitaph appended to discovery notes. Orchestrator wiring: Anytime row + intent triggers ("I have an idea", "is X worth doing") + one triage guard sentence — an idea that hasn't hardened routes to forge, not to a lane. Explicitly NOT a creativity suite: no technique-catalog CSV (BMAD's runs 100+ techniques), no research workflows, no PRFAQ.
2. **Unattended outer loop** *(user steer: whole-bet mode is the one-iteration contract; leave the outer orchestrator)*: the parked remainder is machine-readable blocked semantics — `.groundwork/cache/blocked.json` `{lane, bet_slug, phase, reason_kind, summary, artifacts[]}` written when any hard stop fires unattended, outranking routine routing (same pattern as the upgrade-brief rule) — plus a headless "advance the active lane until the next hard stop" entry via the host's headless mode. Invariant when revisited: unattended changes *when the human is consulted*, never *whether gates run*; a review that cannot run blocks the run. Wave 2's `groundwork state` + W1.6's decisions queue supply most of the substrate.
3. **Operating-contract JIT sectioning**: the contract is ~6.6k words loaded by every phase — the biggest remaining always-on context lever; touches every skill and the contract version, so it is its own plan.
4. **Module/marketplace system** (BMAD `bmad-modules.yaml`, git-cloned external modules, marketplace-plugin resolution): revisit if third-party GroundWork extensions materialize; the `[skills]` table + policy layer cover today's need.
5. **LLM-distilled conventions prose**: deferral trigger named in §4.
6. **Generalizing file-backed subagent output** to Protocol 9 / setup-phase `groundwork-review`.
7. **Remaining "Where BMAD is ahead" items** (from the rewritten vs-bmad doc): a *multi-perspective debate device* — party-mode's useful core — as labels on isolated subagent dispatches at genuinely contested judgment points (never a user-facing troupe; the persona decision stands); *elicitation catalog growth* in `groundwork-elicit/methods.md` on demand; and a **published docs site** — the branded docs-site exists in-repo, hosting/publishing it is the maturity gap the as-is doc names honestly. Community, module marketplace, and web distribution stay out of scope by the standalone verdict.

---

## 8. Sequencing

| Wave | Contents | Gate |
|---|---|---|
| 0 | W0.1–W0.3 — independent, ship anytime (W0.4 already done: vs-bmad rewrite `0a7f5d3`) | `./dev ci` per slice |
| 1 | One coordinated 0.14.0: W1.1 split → W1.2 state → W1.3 pack → W1.4–W1.8 policy edits → W1.9 policy layer → W1.10 hygiene | The exit simulation (§3) before the release cut |
| 2 | Verb-by-verb after 0.14.0 settles; recommend `findings` + `decisions` first (they lock in W1.4/W1.6 behavior); each verb deletes its prose ritual in the same PR | `pytest tests/cli/` per verb; skills shrink in the same commit |
| 3 | After Wave 2's symbol-graph machinery exists (honesty scan → wiring scan); gated on the first front-door driver landing (magpie/macOS is the proving ground) | Escape-class replay (§9.5) |

Every wave: `./dev ci` green; changelog lines with migration ids or `[no-migration]`; workflow-index regenerated in the same commit as any routing change; sync-anchor re-stamps on contract edits.

---

## 9. Verification

1. **Consistency sweep** of the edited skill tree: no dangling "four lenses" / apply-patches / per-slice-acceptance references (9 known occurrences).
2. **Repo gates:** `./dev ci` (lint, workflow index, sync-anchors, generation, contracts, cli, compile).
3. **Install test:** `npx groundwork-method update` into a scratch worktree; `.groundwork/skills/` mirrors source.
4. **Tabletop replay** of the M2 transcript against the new text: the 8.3h decision → default+veto; M2-open P9 → mechanical gate; the slice-2.2 fix round → worker continuation; design-uplift M4 findings → blocked milestone close. Every observed real bug still has a catching lens or scan under the new policy.
5. **Escape-class replay:** map each of the 27 cataloged owner-found bugs to the Wave-3 gate that would have caught it (reachability walk, layout assertions, wiring scan, token ratchet, real-data proof, affordance checklist) — every class must have an owner.
6. **Live proof:** deliver graded-library M3 under v0.14.0; compare wall-clock, agent count, and catch rate against the M1/M2 baselines. Wave 3's proof: the next UI milestone closes with a lifecycle walk + screenshots instead of a manual owner drive, and zero new instances of the six escape classes.
7. **Wave-1 exit gate — DONE 2026-07-03.** The `--simulate` harness covered setup only, so a repeatable delivery instrument was built (`./dev sandbox --delivery`: a sealed `task-capture` bet with readiness-gate shape, red-for-absence stubs, and deliberate mechanic seams; a `/simulate-delivery` kickoff; a delivery `/judge`; a contract test in `./dev ci`). A frontier driver drove it end-to-end against a simulated owner and reached real front-door green; an **independent fresh-context judge scored all six mechanics PRESENT / verdict FAITHFUL** — spine→step routing (red board fails at its own commit tree on both milestones — the anti-theater check), file-backed lens verdicts, default+veto ratified with the tag held, a mid-bet fresh-context resume reconciled against the suite, a blocked milestone close on an open finding, and an owner-approved amendment (`list --pending` dropped) with the approved tag re-pointed and the M2 pack's `compiled_from` tracking it. **One finding, carried to Wave 2** (§4 `findings`/`decisions` rows): the human-in-the-loop exchange (default ratification, finding disposition) is persisted only as a `decisions.md` status cell + memlog lines, not as a durable checkpoint record — the one place the run leans on narration rather than re-derivable state; Wave 2's `decisions ratify` / `findings disposition` verbs are its natural home. The run stopped with the final slice implemented-but-uncommitted (driver effort ceiling), which the judge confirmed undermines no mechanic.

---

## 10. Decisions

### Settled (owner, 2026-07-03)

- **No project-level stakes axis.** GroundWork is opinionated: one way to work; AI makes working that way cheap. The pitch's per-bet Stakes field being read by validation (W1.8) is owner-authored per-bet shaping, not a rigor tier — the floor is never conditioned on it.
- **Ideation is parked**, with full design detail preserved (§7.1).
- **Full additive policy layer** (W1.9): users add rigor and context; nothing can remove the floor.
- **Unattended = whole-bet mode.** No outer-orchestrator machinery now (§7.2).

### Settled (by this design)

- Keep the methodology spine (bets, slices, front-door proofs, seal + amendment, adversarial review, postmortem action IDs); rebuild the enforcement medium and economics.
- The rewritten as-is differentiation doc (`docs/groundwork-vs-bmad.md`, `0a7f5d3`) is canon for what V2 must never trade away: the **design-altitude walk** (human-authored, ordered UI → data flows → API → schema, locked per bet) and the **owner-comprehension outcome** it produces. Concretely: W1.6's default+veto never defaults a design-altitude change (hard stop / amendment); W2's engine state carries process facts, never design prose; W3's harness verifies what the human designed, it never redesigns.
- Cache-tier bookkeeping never gates in Wave 1 (tests+git win reconciliation; absence self-heals; no migration); the Wave-2 engine state supersedes it as the process substrate — prose stays the human-judgment surface the owner approves and seals.
- Packs carry pointers + learnings, never contract text. Lens verdicts stay inline (files supplementary). Only `04-delivery.md` is sharded. Deterministic conventions digest over a prose constitution. Central two-file policy, not per-skill customize.toml. No artifact-path overrides. Guidance lives in the orchestrator — no third registered skill. No per-IDE body templates in hosts.json. Defer a `next` dist-tag.

### Open (owner)

1. Vendor a ~100-line TOML-subset parser in the dependency-free CLI vs agent-only policy parsing (recommend: vendor).
2. May `[checklists]` policy items be 🔴 (blocking)?
3. Checkpoint walkthrough as dispatched brief vs inline for large whole-bet milestone diffs (recommend: brief); stamp blast-radius tags into closing commit messages?
4. Add the windsurf hosts.json row now?
5. Communication-language / skill-level keys on the policy layer (communication style only — zero floor effect)?
6. Wave-2 verb order (recommend `findings` + `decisions` first).
7. Which surface gets the first Wave-3 front-door driver (recommend magpie/macOS — the escape catalog's source).
