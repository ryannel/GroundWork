---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-08-14"
---

# What the 2026 research means for GroundWork

Decision support for ratifying the v2 north star. For each load-bearing finding in `ai-developer-workflows-2026-07.md`, this document says what it confirms in GroundWork today, what it contradicts, and what it bounds in the v2 direction.

The survey is neutral by design and stays that way. Every conclusion here is ours.

**Sources.** Survey sections are cited as §N. The v2 spec is the set on branch `origin/claude/north-star-spec` at `25e2ba7`, cited by file (`north-star/loop.md`). Current-state citations are paths on `main`, verified at the time of writing. Evidence grades in brackets are the survey's. Confidence labels are mine, and they describe how much I would bet on the recommendation, not on the finding behind it.

---

## Executive summary

1. The survey's two strongest findings — batch size doubled, and review is a queueing problem — both land on the same v2 surface, the Queue, and neither has an instrument in the spec.
2. GroundWork's gates are fail-closed against *agents*. Nothing in the current design or in v2 is fail-closed against a human who stops showing up.
3. The slice cap is v2's single most research-supported rule and it ships as prose. It must be a battery row.
4. Spec-driven development has no outcome evidence in either direction. The bet lifecycle should be defended on the owner's own delivery record, never on the wave.
5. The ETH Zurich context-file result indicts always-on repository overviews specifically. v2's Record — citation-anchored docs injected when a diff touches them — is the architecture the study points toward.
6. The August 13 brownfield resequencing already enacted the lazy-context consensus. What it emits at scan-lite is an orientation page, which is the one genre the study measured as inert.
7. Externalised durable state is the survey's most durable architectural finding. The journal and the tower are the right response and the highest-confidence build in the whole spec.
8. Honest-green is correct and bounded: forced end-to-end verification reduces over-reporting and cannot close it. The owner's drive stays load-bearing forever.
9. Security is the one capability class that did not improve across two years and 150+ models. The v2 battery has no row for it.
10. v2's central new capability — unattended programs — has the weakest external support of anything in the spec, and the spec presents it as settled.

---

## 1. Review capacity is the constraint, and GroundWork spends it in the wrong place

**The finding.** Human review capacity, not model capability, binds AI-assisted delivery — triangulated across telemetry, vendor disclosure, academic study and practitioner account [MEASURED, multiple] (§3, §5.5). LinearB's 8.1M-PR dataset locates it precisely: AI-assisted PRs wait ~5× longer to be *picked up* (~1,050 min vs ~201) but are reviewed *faster* once started (194 min vs 252) [MEASURED, VENDOR] (§3.7). The constraint is whether a human ever begins.

**Where it lands.** GroundWork's gates are fail-closed by construction. Protocol 8 in `src/hidden-skills/operating-contract.md:348` blocks a commit when a review cannot run at all; `groundwork gate readiness` and `gate decomposition` (`bin/groundwork.js:2779-2780`) exit non-zero on an unready phase; `groundwork findings check` refuses to close a slice over an open finding (`lib/bet-state/index.js`). Every one of these fails closed against an *agent* asserting done. None of them fails closed against a *human* who never arrives. The 10–15 waiting-on-you moments per 3-milestone bet (`north-star/loop.md`) are, in the survey's terms, fifteen queue entries with no service-level target.

v2 improves this materially. The Queue is a portfolio-wide ranked list (`north-star/surfaces.md`), capsules make each entry a two-minute trust decision rather than a diff reconstruction — the direct answer to §3.3's "reconstruct a rationale that never made it into the diff" — and `north-star/loop.md` already throttles the dial when acceptance debt ages past a threshold. That last mechanism is the right shape: it reduces supply when the human is absent.

**Still exposed.** v2 measures the wrong review variable. Each lane declares a *decision budget* and the Map reports actuals (`north-star/surfaces.md`). A decision count says how expensive the work was; it says nothing about the wait before the first decision, which is the variable the survey identifies as binding. "Acceptance debt renders loudly" is a rendering, not a metric with a threshold and a trend.

**Recommendation.** Make time-to-first-pickup a first-class journal event and the primary review-health metric on the method-health page, published as a trend alongside token spend and battery wall-clock. Rank the Queue on it. Keep the decision budget as a secondary cost measure. **Confidence: high.** This is one journal field and one column, it is the survey's decisive result, and it is the number that will tell the owner whether the whole v2 attention model works before anything else does.

---

## 2. Batch size doubled — and the slice cap is prose

**The finding.** Four independent telemetry sets, different platforms and customer bases, agree that PR size roughly doubled in the year to mid-2026: Swarmia +109%, DX +64%, Faros +51%, LinearB 2.6× AI vs non-AI [MEASURED] (§3.8). The survey calls it its most solid claim. Kilo's operative rule is the mechanism: an output a human can review in one sitting; a diff too large to inspect carefully means the task was too large (§2.1). Larger batches are exactly what makes a PR expensive to pick up (§3.7).

**Where it lands.** GroundWork has no slice-size bound today. `src/hidden-skills/groundwork-bet/workflows/03-decomposition.md` defines a slice as "the smallest units that are independently buildable, deployable, and verifiable" — a coherence rule, not a size rule. The phrase "one sitting" appears in the codebase only as the *quick lane's appetite* (`workflows/00-quick.md`), which sizes a whole bet, not a review.

v2 fixes the policy: "a slice is capped at reviewable-in-one-sitting, so an oversized slice must split" (`north-star/loop.md`). That is the correct rule, stated once, in prose, with no check behind it — which the spec's own governance tripwire 5 ("rules become checks") says is not good enough.

**Still exposed.** The survey's finding is that batch growth is *systematic under agent authorship*, not incidental. A prose cap against a systematic drift, enforced by the agent that benefits from ignoring it, is the exact failure the spec documents elsewhere: an 11 MB session delivered seven bet-labeled commits almost entirely outside the machinery.

**Recommendation.** Make the slice cap a battery row that fails at commit: a numeric bound on diff size and files touched, waiver-able like any other check, with the bound calibrated from the project's own accepted-slice history rather than a universal constant. Journal every split and every waiver, so the cap's own threshold is tunable from data. **Confidence: high on the need, medium on the form.** That a prose cap will drift is well evidenced. The right threshold is not — no source publishes a reviewable-diff size, and Kilo's rule is qualitative.

---

## 3. Spec-driven development has no outcome evidence, in either direction

**The finding.** There is **no published controlled experiment showing spec-driven toolkits improve end-task success versus a lighter agentic loop** [INDEPENDENT] (§6.2). The nearest rigorous results are adjacent: context-grounding hooks inside Spec Kit at +1.7pp on SWE-bench, and SpecBench measuring whether agents can *review* specs (best agent 44.4%). Thoughtworks places SDD at Assess, not Trial, flagging the bitter-lesson risk (§6.1). Böckeler names five concrete failure modes, of which two bear on GroundWork directly: one-size-fits-all ceremony, and double review burden — "I'd rather review code than all these markdown files."

The waterfall argument is unresolved, and both sides converge on one distinguishing variable: what happens *after* the spec exists. A frozen spec plus handoff is waterfall. A spec that is the iterated artifact is not (§6.2).

**Where it lands.** GroundWork is a spec-driven methodology with an unusually heavy artifact set: a 5-phase bet lifecycle, `groundwork-bet` at 45,415 words across 32 files, a 13-protocol operating contract at 9,520 words. The survey's ceremony critique lands squarely. GroundWork's answer to the *waterfall* half is already good — plan-just-enough laddering, later milestones sliced on arrival from what delivery taught (`workflows/03-decomposition.md`), amendment protocol rather than frozen seals. That is the iterated-artifact side of Brooker's distinction, enacted.

v2 sharpens it further: three lanes with ceremony priced by risk, the lightest lane winning ties, and a post-hoc lane audit rendering mis-triage on the Map (`north-star/loop.md`).

**Still exposed.** Nothing about the *depth* of the complex lane's design walk — journeys → pages → IA, or data flows → business logic → API → schema — is externally supported. It rests on the owner's own delivery record plus one argued position ("pulling designs up, not up-front"), which `north-star/evidence.md` states honestly. Böckeler's double-review-burden critique also lands on v2's proof plan: the complex lane now asks the owner to seal a design *and* a proof plan, adding a markdown artifact to review at exactly the moment §3 says human attention is scarcest.

**Recommendation.** Do not defend the bet lifecycle by pointing at the spec-driven wave — there is nothing there to point at. Defend it with the delivery record, and make the proof-plan seal cheap: a page, walked in the same sitting as the design, never a separate approval round. Then measure it — the decision-budget actuals per lane are the instrument that will tell you within two bets whether the complex lane's ceremony is priced right. **Confidence: high on the framing, medium on the proof-plan sequencing.** Sealing test design with the design is the spec's own upstream answer to its dominant defect class, and that argument is stronger than the ceremony objection.

---

## 4. Context files: the study indicts overviews, not on-demand skills

**The finding.** ETH Zurich (arXiv:2602.11988) found repository context files **do not generally improve task success** while raising inference cost by **over 20%** [MEASURED, INDEPENDENT] (§1.4). Four agent-model pairs; AGENTbench built from niche repos to dodge contamination. The mechanism finding matters more than the headline: with existing documentation stripped from the repos, LLM-generated context files *helped* (+2.7%) and beat developer-written docs — so context files largely act as a **documentation substitute**. And the sub-finding that cuts closest: **instructions are followed well; repository overviews are not.**

Scope limits carried: Python-only, resolve-rate only, and the study tests **always-on** files, which is precisely the property progressive disclosure replaces. The survey states this is not evidence against on-demand skills. It also states that adoption of the skills standard is not efficacy — **no study shows progressive disclosure improves task success** (§6.4).

**Where it lands.** GroundWork already runs the architecture the study points toward. `src/AGENTS.md` is 346 words and routes; `src/config/hosts.json` makes it the single canon with `CLAUDE.md` a symlink, so the AGENTS.md/CLAUDE.md split in §6.6 is a non-issue here. The 25 skills under `src/hidden-skills/` load on task match, not at startup. Measured today, the always-on set is about **4,800 words** (`src/AGENTS.md` 346 + `groundwork-orchestrator/SKILL.md` 4,360 + `groundwork-check/SKILL.md` 96) against **358,052 words across 322 markdown files** under `src/`. Ninety-nine percent of the corpus is already on-demand.

The August 13 brownfield resequencing (`docs/plans/doc-canon-and-onboarding-diet.md` §6, Workstream E) enacted the lazy-context consensus explicitly: scan-lite drops the whole-repo LLM digest pass, extracts become deferred and regenerate their own scoped inputs at invocation, and the plan states the honest bound in its own text — the read cost is deferred to invocation, not eliminated.

v2's Record is the sharper answer. Docs carry `source_of_truth` path globs and per-step code citations, and when a slice's diff intersects them **the doc is injected into that slice's context** with an update obligation attached (`north-star/record.md`). That is retrieval keyed on the diff — §1.2's winning architecture, with the freshness problem solved in the same mechanic.

**Still exposed.** Two things.

First, the one user-facing artifact scan-lite emits is an **orientation page** — a repository overview, which is the exact genre ETH Zurich measured as inert for agents. It is defensible as a human on-ramp and as the doc-poor repo's measured-benefit zone. It must not become the project's always-on file.

Second, v2's headline context-economics claim is measured against the wrong denominator. `north-star/loop.md` argues that "every window carries the cut corpus (about 500 always-on words instead of today's skill stack)." Today's skill stack in every window is ~4,800 words, not 344k. Cutting it to 500 saves roughly 4,300 words per session — real, and small next to a single worker dispatch. §2.6's token economics place the cost in exploration and dispatch fan-out (subagents burning tens of thousands of tokens to return one or two), and on BrowseComp token usage alone explained 80% of variance. The corpus cut is justified — by upkeep cost, by register contamination, and by the sunset regime — but not by per-session context economics.

**Recommendation.** Keep the citation-overlap injection as the agent's path to the Record, and make the orientation page explicitly human-facing, excluded from any always-on set. Restate the corpus-cut rationale in the spec as maintenance and register, and let the journal's token-per-delivered-slice trend carry the economic claim instead of an asserted window saving. **Confidence: high.** Both are corrections to stated rationale, not to design, and both cost one paragraph each.

---

## 5. Externalised state is the finding with the longest shelf life

**The finding.** Compaction is insufficient — Anthropic's own harness post, against interest [VENDOR, confirmed 3-0]: a frontier model in a loop across context windows "doesn't always pass perfectly clear instructions to the next agent." The working substitute was a progress log, a machine-readable feature list, and git (§1.3). Corroborated across three 2026 papers, one beating prior SOTA by 17.3% by externalising context into files. The survey rates **externalised durable state** as one of three findings that survived a model generation or more (§0). Reset *cadence* loosens with model capability; file-based state handoff persists.

Adjacent and load-bearing: the converged multi-agent shape — one context-owning lead, ephemeral workers returning distilled summaries, writes single-threaded (§2.6); the measured worktree-contention failure — 13 parallel worktree-isolated agents, 8 failed to commit on `.git/index.lock`, and failed agents' work was permanently destroyed by auto-cleanup [MEASURED, INDEPENDENT] (§2.1); and the mixed-tier failure mode — weak models cannot recognise their own limits, so "knowing when to escalate" fails (§2.6).

**Where it lands.** This is where GroundWork is furthest ahead of the field. Decisions and findings are committed ledgers (`lib/bet-state/index.js`, `groundwork findings`, `groundwork decisions`), not chat. Seals are git tags. The driver-worker split with explicit tiers is canon (`operating-contract.md`, Model Tiers) and the worker contract already carries the escalation channel §2.6 says is necessary.

v2 extends it correctly on every axis. The journal is an append-only, CLI-written, hash-chained event stream in a dedicated git ref per repo, deliberately outside the work's commit graph (`north-star/loop.md`) — the reasoning about rebases, reverts and parallel-bet merge conflicts is sound and is the kind of thing usually learned the hard way. The tower reads state from git refs rather than any checkout (`north-star/surfaces.md`), so no branch needs to be current. And one CLI writer queue serialises every git write in a repo, which is the engineered answer to §2.1's index-lock class — the survey's own hygiene note says that finding is a warning to engineer around, not an endorsement of parallelism.

**Still exposed.** The catcher field. `lib/bet-state/index.js:96-120` requires `title` and `bucket`; `lens` defaults to null and there is no defect-class field at all. The spec's claim that this field went unfilled across 114 findings is mechanically explained by that code: it is optional at write time. v2 makes both required and adds the recurrence loop — the fix is correct, and it must be enforced in the writer, not in prose asking agents to fill it in.

The tower is also a new attack surface the survey speaks to. §2.7's write-then-trust class — "if an agent gets to write the future inputs of systems, it was never sandboxed in the first place" — describes a daemon that renders agent-written markdown from every registered repo in one process. v2's mitigations are real (loopback bind, host check against DNS rebinding, script stripping, per-project isolation, and hook configs never auto-written by the update engine, which is exactly the Cursor CVE-2026-48124 shape). The one weak call is "no token by default."

**Recommendation.** Build the journal and the tower first, in that order, and make `--lens` and a defect class required arguments of `findings add`. Ship the tower with a token from day one rather than at the moment it leaves loopback — the cost is a header, and the threat model the survey describes is about what agents write into the things trusted components later read, which is what the tower does by definition. **Confidence: high on the journal, high on the required fields, medium on the token** (the loopback-plus-host-check argument is genuinely the dev-server standard, and this is a judgment call about margin, not a defect).

---

## 6. The verification ceiling: honest-green is right, and bounded forever

**The finding.** Agents systematically over-report completion [VENDOR, against interest, confirmed 3-0] (§4.1): making changes, running unit tests and curl commands, and failing to recognise the feature does not work end to end — and on multi-session work, "a later agent instance would often look around, see that progress had been made, and declare the job done." Independently corroborated: near-perfect benchmark scores beside mechanical audits finding deliverables absent; agent-generated tests measurably **over-mocked** across 1.2M commits and 2,168 repos.

The ceiling: predefined test suites **cannot** cover open-ended specifications [INDEPENDENT] (§4.2). Forced end-to-end verification *bounds* over-reporting; it does not solve it. Böckeler reaches the same place from practice — functional correctness is where current approaches are "insufficient for reducing supervision" (§2.5). Willison's question is unanswered: how do you prove software works when both the code and the tests are agent-generated?

Two supporting results. Cognition's separate review agent works **better when it does not share the author's context**, catching ~2 bugs per PR, ~58% severe [MEASURED, VENDOR-internal] (§2.6). And in dotnet/runtime, **52.3% of merged agent PRs took direct human code commits** against a 10.3% baseline, with 16.5 human review comments each — a collaborative repair workflow, not merge-on-green [MEASURED] (§3.5).

**Where it lands.** GroundWork's whole anti-cheat layer is this finding, built. Honest-green is canon at authoring time (`workflows/03-decomposition.md` Step 3) and at review time (`briefs/acceptance-auditor.md`); the front-door proof drives the shipping build on the real pipeline; `groundwork mutate` is a deletion test that proves the suite can fail; `honesty`, `wiring` and `tokens` are mechanical scans. Nine of the CLI's eighteen verbs are anti-cheat checks. The three per-slice lenses (`briefs/blind-reviewer.md`, `edge-case-tracer.md`, `coverage-auditor.md`) dispatch at frontier tier with the model set explicitly (`workflows/delivery/step-02-slice-loop.md:40`) — Cognition's no-shared-context finding, enacted before it was cited.

v2's contribution is the upstream half: the proof plan authored before implementation, independent oracles, fixture-axis diversity, run evidence, the paired UI-and-headless case, and the test auditor whose brief is that the tests were written to hide something (`north-star/proof.md`). Against §4.1's over-mocking result, forcing fixture axes and sealing what runs real is the correct intervention, and it is upstream of the defect rather than another catcher.

**Still exposed.** The drive artifact is the only mechanism that touches §4.2's ceiling, and v2 correctly makes `verify` refuse the acceptance seal without it. But dotnet/runtime's 52.3% intervention rate says something the spec does not price in: even a well-run agent workflow needs *human code commits* on half of merged work. GroundWork routes that repair through bounce-and-fix loops rather than the owner touching code, which is a deliberate and probably correct choice for a one-human framework — and it means the intervention that the best-documented dataset says is necessary happens through a slower channel. Expected bounce rounds are in the cost model (`north-star/loop.md`), which is the right instinct; the rate is unmeasured.

The blind author is v2's largest unevidenced bet. Nothing in the survey supports blind authorship. Cognition's result supports **fresh context for review**, which is a different claim. The spec is honest about this — it names blindness a hypothesis, sets a switch-off condition, and builds a cheat sim to catch a silently-broken anti-cheat mechanism. That is the correct treatment.

**Recommendation.** Keep honest-green and the drive artifact permanently and mark them `architectural`, not `dated` — the verification ceiling is a property of open-ended specification, not of a model generation. Publish bounce rounds per delivered slice from the journal as the local analogue of dotnet/runtime's 52.3%. And do not delete the three per-slice lenses in the same wave that introduces the blind author: run both for one bet, compare catch counts by defect class, then collapse. **Confidence: high on the first two, high on the sequencing.** The spec already gives the lens collapse a rollback trigger; making it an overlap instead of a swap costs one bet and removes the risk of losing the record's dominant bug-catcher to an untested replacement.

---

## 7. Autonomy is bought by relocating the checkpoint, and v2 buys it on credit

**The finding.** Anthropic's permission-modes table heads a column "What replaces the prompt" — the answer being the sandbox boundary itself [VENDOR, confirmed 3-0] (§2.7). Autonomy is purchased by moving approval from per-command to up-front policy. Osmani's governing criterion (§2.5): "the autonomy level should follow the verification process, not the task name," with three gating questions — how fast problems surface, how cleanly the change undoes, what proof confirms success. His named anti-patterns are precise: permission laundering through approval fatigue, and **summary substitution replacing verification**.

The boundary in practice: unattended work is disposable or mechanically verifiable; supervised work is code that must be understood and maintained (§2.4, Ronacher). Anthropic's own collaboration paradox — AI in ~60% of work, full delegation on 0–20% of tasks [MEASURED, VENDOR, against interest]. And checkpoint placement is the axis that differentiates every vendor product (§2.2): Jules gates on mandatory plan approval before any file edit; Claude Code Routines have **no gate during a run, by design**, with scope fixed beforehand. Routines also disclose that a green status "does not mean the task in your prompt succeeded."

**Where it lands.** v2 gets the principle exactly right and enacts it more precisely than any product in the survey. Probe coverage of the touched paths caps the dial mechanically, so a young brownfield install runs watchful no matter what the default says (`north-star/loop.md`). That is Osmani's criterion turned into a computed bound rather than a policy statement, and it is better than what the vendors ship.

The launch gate is the Jules pattern applied at the right altitude: a fresh-context agent forecasts every decision the delivery will force before the run starts, an open item blocks launch, and the gate reruns at each bet boundary. Run mode is recorded state rather than a chat instruction, with a recorded proving failure behind that choice. The stopping rule is a short mechanical reversibility list. Park-don't-stop keeps a program moving when one bet blocks. The security floor (`north-star/doors.md`) requires an *enforced* permission model — path allowlist, pinned push remotes, scoped credential, no new remotes, checked by `verify` before unattended eligibility — which is the up-front-policy purchase §2.7 describes, plus dependency-provenance checks against the typosquat class.

Today's baseline: none of this exists. `main` has model tiers, three lanes, and `./dev sim` (`docs/plans/autonomous-sim-harness.md`), and the pause behaviour lives in workflow prose.

**Still exposed.** Goal 14 promises that "a lined-up bet or program runs to completion unattended," and `north-star/loop.md` states the premise as settled: "This is a core capability, and the battery is what earns it." §4.2 says the battery cannot earn it — predefined suites cannot cover open-ended specifications. §2.4's boundary says unattended work is for the disposable or the mechanically verifiable, and a program of feature bets is neither. §3.5 says the best-documented agent workflow on record needed human code commits on 52.3% of merged work. This is the largest gap in the spec between what is asserted and what anything outside the repo supports.

The spec knows how to handle this — it does exactly the right thing with the blind author, naming it a hypothesis with a switch-off condition and a sim. Continuous delivery gets no equivalent treatment despite being the more consequential claim.

Two smaller exposures. Summary substitution (§2.5) is the anti-pattern the teach-back most resembles: a chat narrative delivered in place of the owner's own contact with the product. The spec's defence is that the drive artifact is required at acceptance and the teach-back carries a falsifiable check on the next design walk — both good, and the check should be treated as blocking rather than advisory. And Routines' disclosure that a green status does not mean the task succeeded is the exact failure the run heartbeat and the journal's per-row outcomes are built to prevent; that pairing should be stated in the spec, because it is a designed answer to a documented vendor failure.

**Recommendation.** Give continuous delivery the same hypothesis treatment as the blind author: name it a hypothesis in `north-star/loop.md`, state its falsifier (escapes per accepted drive at each dial rung, already defined in the spec), and gate the `program` rung behind the two-bet program sim passing on planted cross-bet invalidation — which the scenario shelf already specifies. Ship the dial with `bet` as the highest default and let the measured record raise it, which is the spec's own discipline applied to its own headline capability. **Confidence: high.** This changes no mechanism. It changes how the spec talks about its riskiest promise, and it moves the burden of proof onto the instrument that was built to carry it.

---

## 8. Security flat-lined while capability rose, and the battery has no row for it

**The finding.** Veracode's within-vendor longitudinal series — same 80 curated tasks across model generations, so commercial bias largely cancels [MEASURED, VENDOR, longitudinal] (§5.6): 2025, 45% of tests introduced OWASP-relevant flaws; Spring 2026, 150+ models, **syntax correctness above 95% while the security pass rate sat at ~55%**, essentially unchanged over two years. By class the variance is extreme — SQL injection 82% pass and insecure crypto 86%, against **XSS 15% and log injection 13%**. By language, Java 29% against Python 62%.

The survey rates this one of its five claims that hold up. Its own caveat, routinely dropped: this measures code generated with **no security guidance in the prompt**. Whether guidance moves the number is untested.

**Where it lands.** v2's Quality adoption sheet puts security, privacy, accessibility and performance baselines into the capability manifest as probed rows, naming four: dependency audit, secrets scan, a11y smoke, and a performance budget (`north-star/standards.md`). The unattended floor adds dependency-provenance checks and secrets scanning (`north-star/doors.md`). Today's scaffolded projects ship the same two: `dev audit` runs a dependency-vulnerability scan plus gitleaks, pinned in `src/generators/workspace-dev-cli/cli-src/src/commands/quality.ts`.

None of those touch the class Veracode measures. A dependency audit finds vulnerable *dependencies*. A secrets scan finds committed *credentials*. Neither looks at whether the code the agent just wrote is injectable. The battery's scans — honesty, wiring, tokens, divergence, reachability, flags — are all correctness and consistency scans.

**Still exposed.** The taxonomy point is the sharp one, and it comes from the spec's own rules. `north-star/index.md` marks every rule `architectural` (survives model generations) or `dated` (works around a current model weakness, six months maximum). Veracode measured two years and 150+ model generations of capability improvement that did **not** transfer to security outcomes. By the spec's own definition that makes a code-security check `architectural` — it is not waiting to be obsoleted by a better model, because the better models already arrived and did not fix it. There is no such row.

**Recommendation.** Add a code-security row to the battery on every lane, running a real SAST pass over the diff rather than the dependency tree, marked `architectural`, with per-language weighting that follows Veracode's spread — heavier on Java and JavaScript, and specifically on the injection and XSS classes where models pass at 13–15%. Pair it with the untested half: put a security clause in the worker brief and the standards sheet, and let the journal's catch counts answer whether guidance moves the number, since nobody else has. **Confidence: high on the need, medium on the form.** SAST tooling is noisy and its false-positive rate will feed the waiver mechanism hard; the ratchet pattern from `north-star/standards.md` is the right way in — baseline existing violations, allow only decrease.

---

## 9. Publish only what the tool measured

**The finding.** The measurement instrument is broken. METR's RCT is the only controlled measurement of AI effect on experienced developers, found a **19% slowdown** against a forecast 24% speedup and a post-hoc belief of 20% speedup — ~39 points of miscalibration [MEASURED, INDEPENDENT] (§5.1). METR then **abandoned the replication** because a no-AI control arm can no longer be recruited. **For mid-2026 there is no trustworthy controlled estimate of AI effect on throughput, in either direction** (§5.2). Self-report is a broken instrument, which discounts DORA's productivity items and several vendor reports wholesale (§8.1).

**Where it lands.** v2 governance rule 6 says it in one line: publish only numbers the tool itself measured, never productivity claims (`north-star/index.md`). The journal is the instrument that makes the rule affordable — token cost per delivered slice by role and tier, catch and fire counts per mechanism, waiver repeats, escalation rates, decision-budget actuals, battery wall-clock, all published as trends. This is the correct response to §5.2 and it is unusual: most frameworks respond to a measurement crisis by asserting harder.

**Still exposed.** Nothing structural. One discipline point: the sunset regime renews `dated` items on journal counts, and the survey's own warning about preventive rules applies — a forcer that always works never fires, the same trap as a linter that never fires. The spec already handles this with the switch-off experiment, and the constraint is that the experiment is scarce.

**Recommendation.** Hold rule 6 exactly as written, and add the survey's denominator discipline to it: every published number carries its denominator in the name, because §3.6's Faros analysis shows the same phenomenon reading as +54% or +28% depending on whether it is normalised per developer or per PR. Read escapes per accepted drive, never per month — which `north-star/loop.md` already specifies for the dial. **Confidence: high.** It is a naming convention on a page that does not exist yet.

---

## 10. What the research cannot tell us

Seven questions the survey leaves open that v2's own held-out fixtures must answer. Each is stated as something the method rig or the delivery record can decide.

1. **Does progressive disclosure beat an always-on file, or is it just cheaper?** ETH Zurich tested always-on files only. No study tests on-demand loading (§6.4). GroundWork is one of the few places that could answer it: run the same held-out fixture bet with the skill corpus loaded on demand and with the same content pinned always-on, and compare catch counts, token cost, and rule adherence. Until then, the hidden-skill architecture rests on the ETH cost result and on interoperability, not on measured benefit.

2. **What is a reviewable diff, in numbers?** The survey establishes that batch size doubled and that reviewability is the sizing rule, and publishes no threshold. Only the owner's own accepted-slice history can set the slice cap's bound. That makes calibration a first-bet task, not a design decision.

3. **Does blindness earn anything over independence?** The record proves self-authored tests produced the dominant defect class. It says nothing about whether an independent author must also be blind. The blind-author cheat sim answers whether the mechanism *works*; only the switch-off run answers whether it is *worth it*, and the spec correctly names both.

4. **Can a battery earn an unattended program?** §4.2 says predefined suites cannot cover open specs; v2 bets that probe-coverage-capped autonomy plus the launch gate plus a mechanical stopping rule closes enough of the gap. Nothing external can adjudicate. The two-bet program sim with a planted cross-bet invalidation, plus escapes-per-accepted-drive from real runs, is the only available evidence.

5. **Does security guidance in the prompt move Veracode's flat 55%?** The survey's most-dropped caveat is that the number describes unguided generation. Nobody has published the guided arm. A framework that ships a security clause in every worker brief and journals the resulting catch counts is running that experiment by accident; run it on purpose.

6. **Is greenfield where agents actually help?** METR's boundary conditions are correlational within n=16 senior maintainers, and the survey is explicit that the greenfield complement is *asserted nowhere and measured nowhere* (§5.9). v2's greenfield door — describe intent, get a working product — sits on that untested complement. The birth-seal sim and the first real greenfield project are the only evidence that will exist.

7. **Does the Record actually get read?** The citation-overlap injection is the spec's answer to the documentation-substitute finding, and its premise is that a doc injected because the diff touched it changes what the worker does. The journal can test this cheaply: compare bounce rates and defect classes on slices that carried a doc injection against those that did not.

One further gap, named because it will not resolve itself: the survey finds **no measured study of juniors' ability to debug AI-generated code**, and no verified evidence on seniority effects at all (§5.7, §7). GroundWork is a one-human framework by design. Every claim it makes about succession — a successor reads the Record and drives the front doors before they seal (`north-star/index.md`) — is untested by anyone, anywhere.
