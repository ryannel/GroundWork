# Evidence

The numbers, sources, and history behind the spec. Survey references cite `docs/research/ai-developer-workflows-2026-07.md` by section. Internal measurements are our own and labeled as such.

## What the research says developers need

Eight needs, distilled from the survey. Each shaped a part of the spec.

1. **Work sized for review in one sitting.** The binding constraint is whether a human ever starts reviewing. That is a queueing problem, not a reviewing problem (§3.7, LinearB, 8.1M PRs: AI-assisted PRs wait ~5× longer for pickup but review faster once started). Batch size roughly doubled in a year across four independent telemetry sets (§3.8). That is the survey's most solid claim. → The slice cap, the Queue.
2. **Ceremony priced by risk.** One-size process is discredited by practice (§6.1: a small bug becoming "4 user stories with 16 acceptance criteria"). Production systems stratify by risk (§3.2: Meta and Cloudflare tiering). → Lanes, the dial.
3. **Verification by oracles that cannot lie.** Agents over-report completion (§4.1, a vendor admitting it against interest, plus three independent corroborations). Agent-written tests are measurably over-mocked (§4.1). A fresh-context reviewer sharing nothing with the author catches ~2 bugs per PR, 58% severe (§2.6, vendor-internal). Predefined suites cannot cover open specs (§4.2), so the human drive stays. → The battery, the adversary, the drive artifact.
4. **Rationale and risk attached to every change.** Review is a trust decision. Without signals the reviewer "reconstructs a rationale that never made it into the diff" (§3.3). → The capsule.
5. **Externalized state, lean context.** File-and-git state is the long-horizon technique that survives model generations (§1.3). Always-on context files showed no reliable benefit at +20% cost, acting as substitutes for real documentation (§1.4, ETH Zurich). That study's scope limit: always-on, Python-only; the survey says it is not evidence against on-demand loading. Instructions are followed; repository overviews are not (§1.4). → The Record, the kernel budget, the ledgers.
6. **Autonomy set by checkability.** How fast a problem would be detected, how cleanly the change undoes, what proof exists — not task names (§2.5, Osmani). Unattended work is for the disposable or the mechanically verifiable (§2.4). → Probe-coverage autonomy, the dial.
7. **A harness that shrinks.** Harness prescriptions decay in 4–6 months (§0 "Shelf life"). Handcrafting detailed rules for AI does not scale (§6.1, the bitter-lesson warning). → The sunset regime, the word budget.
8. **Honesty about outcomes.** No trustworthy controlled estimate of AI's effect on throughput exists in either direction. Self-report is off by tens of points (§5.1–5.2). → Rule six: publish only tool-measured numbers.

The converged multi-agent shape is also load-bearing: one context-owning lead, ephemeral workers returning distilled summaries, writes single-threaded (§2.6). Its token economics too: workers explore at tens of thousands of tokens and return one or two thousand (§2.6). Mixed-tier setups fail when the weak model must judge its own limits (§2.6). Hence the escalation channel.

On security: AI-generated code passes security checks at roughly 55% while syntax correctness exceeds 95% (§5.6, Veracode, 150+ models on fixed tasks) — flat for two years. That describes unguided generation; whether guidance moves the number is untested. Separately, an instructions file nearly doubled agent PR merge success in one well-documented repo (§3.5, dotnet/runtime). One repo, not an industry result.

Evidence-hygiene rules for anything citing this material:

- Cite the survey by section.
- Label our own analysis as ours.
- The design-time case rests on the owner's results plus one argued position — "pull designs up" (move design effort earlier and to a higher level) is one side of an unresolved debate (§6.2).
- Adopting the SKILL.md skill-file standard is an interoperability argument, not evidence that skills improve outcomes (§6.4).
- Batch size and queueing are the survey's two strongest findings. Cite them together; don't merge them into one claim.
- The worktree-contention finding (§2.1: 13 parallel worktree-isolated agents; 8 of the 13 failed to commit on git's index lock — a 62% failure rate) is a warning the parallel design must engineer around, not an endorsement of it.
- Register mirroring (models copying the style of what they read) is a working hypothesis from observed sessions, not an established model property.

## What GroundWork is today

Measured against the working tree at the time of this spec:

- 343,846 words of shipped instruction markdown across 316 files (~460–490k tokens). The method's internal skills — installed into projects but never listed to the user — are 174k of it; the principles corpus ~73k; the engineer skills ~72k (six stacks, ~12k each). The two skills every session auto-loads total 5k.
- A 13-protocol operating contract (543 lines, mandatory reading). 5 greenfield + 5 brownfield setup phases. A 5-phase bet lifecycle. `groundwork-bet` alone is 45,237 words across 33 files. 4 personas, 7 review-lens briefs, 3 lanes.
- An 18-verb CLI in one 3,115-line file. 9 of the 18 verbs are mechanical anti-cheat checks — the best-tested code in the repo (24 CLI test files).
- 10 Nx generators, 152 templates. The npm package is 34 MB, of which 28 MB (82%) is tree-sitter grammars serving one verb.
- The repo is ~11 weeks old with 384 commits, all framework construction and upkeep. On top of that sit 232k words of unshipped planning prose, a migration registry, gates that keep duplicated doc sections aligned, a skill linter, and a five-layer test harness including a live-session simulation rig.
- A full 3-milestone bet costs ~35–45 subagent dispatches (most at frontier), ~20 committed artifacts, six bookkeeping writes per slice, and 10–15 human decision moments.

## What the delivery record shows

Ours. On 2026-08-05 we mined the delivery records and session transcripts of the projects built with GroundWork: magpie's 23 archived bets (all 12 existing retrospectives read in full, all 8 findings ledgers, the patch ledger, the surviving review files), staycurrent's bet record and transcripts, and the transcripts of magpie's bet-delivery worktrees. Transcript mining was sampled, not exhaustive. Every claim below traces to a file; the strongest are quoted.

### Shipped outcomes

- Magpie: 23 bets from pitch to archive. One closed early at milestone 1 with milestone 2 formally withdrawn because a sibling bet had already shipped its premise (`worker-lock-split`). The graded-library program ran three bets deep; its fourth was invisible to all reporting when the program-visibility gap was documented, and has since been picked up — its delivery transcript shows the full findings loop running.
- Staycurrent: `first-living-topic` delivered — 19/19 board, four milestones, fifteen slices, closed by a live run through the real gate. A second bet is mid-flight, 2 of 6 milestones in.
- The framework repo runs its own process on itself.

### What the record attributes, mechanism by mechanism

**The per-slice review lenses are the record's dominant bug-catcher.** The catches are named, quoted, and of one recurring species: the suite is green and the behavior is wrong.

- `graded-library-foundation`, slice 3.2: review caught a video re-survey path that collapsed an item's facets to one keyframe *"while re-stamping the ledger to current — a silent, self-concealing regression."*
- `people-path-extraction`: the same class three times in three seams — a re-run path that lost attribution and bumped the ledger *"so the loss looked reconciled. All tests happened to seed the one shape where the fold recovered the true root."*
- Staycurrent, `first-living-topic`: the retrospective's own words — *"The review gate earned its keep every slice"* — listing a false "Copied" state, a dead diagram box, duplicate DOM ids, and a mobile layout occlusion. Its edge-case lens also caught, twice, a defect class the mechanical gate passed: a blank stance line that satisfied all gate checks and then killed the site build. The fix became a new gate check and ADR 0006 — the review lens caught what the gate missed, and the gate then absorbed the class. That is "rules become checks" actually happening.
- `narrative-video-understanding`: review caught a shared prompt clause that silently changed image captions while the worker's own suite stayed green.
- The coverage lens repeatedly flagged permanent test targets asserting less than the bet-progress suite proved (`background-purge` twice, `narrative-video-understanding` across four slices).

**The milestone- and bet-level checks catch a class per-slice review cannot see.** `subject-dedup`: the whole-bet experience gate failed on an entirely absent post-confirm Undo — *"no per-slice review flagged [it] because each slice was correct in isolation."* `people-path-extraction`: a hollow routing capability surfaced only at the milestone front-door proof. `import-triage`: a missing multi-select surfaced at the milestone postmortem, and the owner ruled to build it. `narrative-video-understanding`: running the real model at the front door exposed a recall gap no unit test could show.

**The mechanical checks and ledgers fired less often, but for real.** `seal verify` caught approval tags never re-pointed after amendments (`import-idle-and-filter-fixes`). The findings ledger mechanically blocked slice closes over open findings — the Bet-4 transcript shows `✖ 2 open finding(s) — cannot close` and a close-loop running finding by finding to clear. Red-then-green was actually practiced, not just prescribed: committed red boards ("11 tests, 11 red"), stubs recorded going green one by one, zero red stubs at close.

**The human's drive found what nothing else did.** During `import-idle-and-filter-fixes` validation the owner drove the real app and found two live bugs no agent had raised. The `people-path-extraction` UI suites were shipped compiling-but-never-run; when finally run on an unlocked machine, 5 of 7 failed. This is why the drive artifact is a required proof, not a courtesy.

**The escalation channel works and rarely fires.** One concrete blocking-concern raise in the sampled transcripts: a worker flagged that a sealed proof said *intersection* where the design required *union*. It produced a recorded amendment, a re-pointed tag, and an independent audit confirming the fix. Against that, a dozen-plus sampled worker reports end "BLOCKING CONCERN: none."

**The design walk changed real outcomes, sometimes.** A design-phase review forced a full ADR reversal the same day (`perception-retention`, ADR 0009→0010). Three formal change proposals reversed locked designs mid-delivery on evidence — including inserting a whole missing milestone, and reversing a locked "no sidecar" decision when the Swift path could not load the models. Most bets' designs also sailed through untouched; the walk earns its keep on the complex ones, which is what the lanes encode.

**The founding failure predates the machinery.** Magpie's first bet (`understanding-engine`) has no retrospective; its crisis notes open: *"Do NOT trust the green checkmarks below — running the real app for the first time exposed that the bet was proven against test seams/fixtures, not real end-to-end behaviour."* Six green milestones; no thumbnails; a captioner 5–10× slower than its proof-of-concept promised; a full remediation arc before validation. Nearly every anti-cheat mechanism above was built after, and because of, this bet.

### What never fired

The same record shows mechanisms that ran as ceremony, in the framework's own words where possible:

- **The deletion-test verb was never exercised.** Every surviving generated proof board ends "no deletion-test runs logged." Meanwhile *manual* deletion probes fired twice and caught real gaps — a sanitizer's `.toLowerCase()` deleted with all 33 tests staying green (staycurrent; now a permanent test), and probe-strings proving three persistence tests actually bite (magpie Bet 4). The discipline is proven; the shipped verb wasn't wired into the loop. The battery makes it a default row.
- **The findings ledger's attribution field was never used**: 0 of 114 findings across 8 bets carry a `lens` value. And the archive step deletes the raw per-slice review files at bet close — they survive for only 2 of 23 bets, one by accident. The framework destroyed most of its own fine-grained attribution evidence, which is why this section took forensics. The rebuild records what caught each finding and keeps review outputs at archive.
- **Decision ratification never landed in the ledger**: all 3 recorded decisions sit `pending`, `ratification: null`, while the prose treats them as resolved.
- **Two review mechanisms were demoted by the framework itself**: the per-slice honesty audit (*"the acceptance auditor rubber-stamped it slice by slice"* — moved to milestone close; our earlier count: 17 runs, 2 catches, 4 false negatives) and the milestone-open re-review (*"found zero critical findings over ground the mechanical gate had just covered"* — turned off by default).
- **A doc-freshness check that never caught anything**: staycurrent's transcripts show `check` invoked 106 times, reporting "3 current, 0 stale, 3 unassessed" every time. Three docs permanently unassessable, zero catches. Magpie shows the complementary failure: the check that would have caught 61 commits of drift simply never ran.
- **A code-intelligence verb invoked 73 times with no artifact on disk** (staycurrent's `repo-map`).
- **Readiness-gate noise**: magpie's own notes record ~6 mechanical false-reds per bet from Swift-convention mismatches, always overridden (since fixed, 2026-07-09 — but it shipped that way for weeks).
- **The machinery can be bypassed wholesale**: one 11 MB working session carries seven bet-labeled commits, real test failures, and a real root-caused bug — and two CLI invocations total. Ad-hoc owner-reported fixes ran outside the loop entirely. A third of magpie's bets have neither a retrospective nor a findings ledger (mostly quick bets, by policy).

### The escapes

Defects that got past the process and were found later, from the ledgers that exist:

- Magpie's patch ledger: 7 dated entries, roughly 7–9 real post-ship bugs, all found in real use, all minor, each fixed with a named test. One entry records a pre-existing test that had been silently red across at least one intervening bet because nobody ran it.
- Staycurrent: a real regression shipped under green CI because CI ran only one of three test suites; found weeks later by manual bisection. An editorial review flagged live prose with concrete rewrites; the flagged phrase is still shipping three versions later.
- An earlier plan claimed a "27-bug escape catalog." We searched for it: it does not exist as an artifact in any repo, and the framework's own legibility audit had already flagged the term as *"referenced four times and defined nowhere."* The verifiable escape record is the patch ledger plus the `understanding-engine` crisis notes. This spec previously repeated the catalog as if it were real; corrected here.

### What this does and does not prove

The record now attributes: specific mechanisms have named, quoted catches, and specific mechanisms have none. What it still cannot prove is the counterfactual — no control run exists without the framework, so nobody can say the same products would not have shipped with less process. Cost is documented by the framework's own plans (the review-fatigue finding; the 344k-word upkeep). By the survey's causal standard nobody in the industry has proof either: METR's randomized trial — the field's only controlled measurement — found a 19% slowdown while developers believed they were 20% faster, then abandoned its own replication because developers now refuse to work without AI (§5.1). Held to the practitioner standard, this method has more internal evidence than most of what the survey covers — and after this mining, better-attributed evidence than before.

### Tracing the catches to their generators

Ours. A catch count is not only a win for the catcher — it is a defect count for whatever keeps producing the defect. This table takes each defect class the mining surfaced and names the process that generated it and the upstream fix now in the spec. The class tags on findings ([loop.md](loop.md)) turn this from a one-time analysis into a standing loop.

| What was caught, downstream | What generated it | The upstream fix |
|---|---|---|
| 12+ suites green while behavior was wrong (the lenses' catches) | One context wrote both the code and the tests judging it, and seeded fixtures with the one shape its own logic handled | The proof plan: cases and fixture axes authored before implementation, sealed by the human on the complex lane; the adversary reviews tests against the plan ([proof.md](proof.md)) |
| A gate passed content the site's own loader then rejected, twice | The gate reimplemented the loader's rules in parallel, and parallel definitions of "valid" drift | Checkers import the consumer's real code path |
| UI suites shipped compiling-but-never-run; a build reported success after a hand-edit dropped the tests from the target; 5 of 7 failed when finally run | Green was inferred from building, and execution was never evidenced | Run-evidence rows: new tests appear by name in the run log; a zero-test run is red |
| A regression shipped under green CI | CI enumerated test suites by hand and ran one of three | Suites discovered by pattern; discovered reconciled against ran |
| A spec'd Undo pattern absent from the whole bet, caught only at the final gate | The design named it but no slice owned it, and traceability ran only slice→design | Decomposition traceability runs both directions: design-named user-facing elements must land in a slice or a recorded deferral |
| Attribution field empty 114 times; ratifications never recorded | The fields were optional, and the record was a separate step after the action | Required at write time; the action is the record — the tag only moves through the ratify step |
| The deletion-test verb: zero logged runs, while manual deletion probes caught real gaps twice | The check was an optional verb someone had to remember to invoke | The battery runs every row; a row that did not run is red |
| A doc-freshness check: 106 runs, zero catches, three docs permanently unassessable | Docs could be born without parseable anchors, and "unassessed" was only a warning | The doc lint runs at birth; an unassessable doc is red |
| A code-map verb invoked 73 times with no artifact on disk | A producer with no consumer, reporting success without its output | Producers name their consumers; a claimed artifact that is absent fails |
| Six false-red gate checks overridden every bet for weeks | Overriding was frictionless and nothing counted the overrides | Waivers are sealed and counted; a repeat-waived check is flagged for repair or deletion |
| 11 MB of real delivery in one session, two CLI invocations | The ceremony cost more than the bypass, and the bypass left no trace | The patch lane is checks-only cheap, and unlaned commits render on the Map |
| Editorial findings still shipping unfixed three versions later | Content review produced findings with no disposition loop | All findings — code or content — enter the ledger and carry a disposition |
| ~95 opaque sentences in this spec, passed by a plain-language edit | The author knew the referents; a style editor cannot see a missing referent | The cold-reader eval is flag-then-expand: the reader flags what it cannot ground, the author expands ([record.md](record.md)) |
| The planning record invisible across projects and branches (owner-reported, 2026-08-05) | Rendering was coupled to the current checkout and a hand-started per-project server, and surfacing was left to agent discipline | The Map reads git, not the checkout; one always-on tower serves every project; the checkpoint and session-start hooks push the position ([surfaces.md](surfaces.md)) |
| Regression guards deleted with the bet's progress suite; the permanent copy chronically under-asserting; stale red stubs outliving bets | The progress board was a second copy of the tests — the disposable copy got the effort, and only a manual mirror step protected the permanent one | Tests are born once in their permanent home carrying a bet marker; the board is a derived view; expected state comes from plan position; nothing is deleted at close ([proof.md](proof.md)) |
| Auditing the method took forensics: four subagents over 400 MB of transcripts to learn which checks fired and which never ran | Operational events — check outcomes, dispatches, overrides — existed only as terminal output inside session transcripts | The journal: one machine-written line per event at the moment the CLI acts, riding the work's own commits, queryable across projects; the tower's method-health page renders it ([loop.md](loop.md)) |

Two generators were already treated this way in the first draft, which is what suggested the pattern generalizes: chat instructions decaying (→ run mode as recorded state) and proofs authored hollow (→ the front-door proof rules). The rest of the table applies the same move everywhere the mining showed a repeat offender.

## The documentation gap, measured

Wordloop's docs are largely hand-written. Magpie's were produced by GroundWork. The comparison defines the Record's standard:

| | Wordloop (hand) | Magpie (GroundWork) |
|---|---|---|
| Explains why | Yes — problem and options weighed | No |
| Diagrams | Yes — sequence diagrams as the spine | None anywhere |
| Flow docs | Yes — mutation flow step by step with payloads | Missing entirely |
| Reference detail | Good | Good, honest about stubs |
| Machine-checkable freshness | Weak — `source_of_truth` is prose | Strong — real path lists and dates |
| Actually fresh | Mostly, by hand discipline | No — core doc 61 commits behind; index 75 behind |
| Writing | Clear, teaches | Dense spec-dump |

Wordloop's docs teach but can't be checked. Magpie's can be checked but don't teach. And nothing runs the check. The Record's calibration test: the checks are correct when wordloop's data-flow doc passes content and fails anchors, and magpie's docs pass anchors and fail content.

## The continuous-delivery failure

2026-07, magpie. The owner instructed: "We've got multiple bets lined up, please go as far as you can delivering as many bets as possible. Only stop if you need a genuine human steer that can't wait… THIS IS THE MOST IMPORTANT INSTRUCTION GOING FORWARD TILL THIS IS DELIVERED." The run still stopped after one milestone for a status report. Cause: the delivery workflow's default milestone-by-milestone mode and its mandatory checkpoint pause outranked the chat instruction. Lesson encoded in the spec: chat instructions decay — they lose to skill prose and erode across compaction. Run mode must be recorded state consulted mechanically.

## Internal measurements the design leans on

Ours, not the survey's:

- Fix-in-place ladder: a fresh agent re-deriving a slice's context measured about 41% of the original build cost — meaning a from-scratch redo is nearly half a rebuild, so fixing in the existing context is the default. (Kept as designed.)
- Per-slice honesty auditing: 17 runs, 2 catches, 4 false negatives. Rubber-stamping; moved to milestone sum. (The adversary's two-altitude split.)
- Milestone test stubs shipped with their user-observable assertions commented out — red-looking, proving nothing. The decomposition gate at the time checked only that a test file was *named*. (The red-for-the-right-reason check.)
- The docsite was, in the review-throughput plan's own words, "the right channel, usually dead." Acceptance checkboxes went unticked. Mechanical evidence died in agent terminals. The row-by-row sign-off collapsed into a single "all good?". (Non-blocking checkpoints, the Queue, the host hook.)
- Answering "is this program complete?" took five forensic steps. `status` reported "23 delivered · 0 in flight · 97 queued" — true and useless. An unstarted bet left no trace anywhere. Archiving a bet deleted its rendered status page. (Programs first-class, the Map.)
- The framework's own review-throughput plan opens: "The bottleneck is human fatigue during review."
- The findings-attribution and evidence-destruction measurements from the mining above (0 of 114 lens fields; review files deleted at archive for 21 of 23 bets) are the basis for the finding-attribution rule and durable archival.

## What the adversarial reviews changed

Five reviews ran against an earlier draft of this spec: one blind, one evidence fact-check, one operator (workability), one defender of the deleted, one goals auditor. There were about 50 findings. The survivors reshaped the spec:

- **Blind**: the Map's sources split into authored-and-sealed plans vs derived state, because unstarted work cannot be derived from git. Three overlapping expiry schemes were unified into the one sunset regime. Promises about deep links and ADR numbering were scoped to what the tooling can actually keep.
- **Evidence**: thirteen citation corrections, now folded into the hygiene rules above. Two of our own analyses had been wearing an "Industry:" label.
- **Operator**: probes went per-topology — the server-shaped probe set could not verify a desktop app like magpie. "The battery is repurposed" was corrected to new construction with a retirement gate. The per-release word rule (delete as many words as you add) fought the bounce-feedback rule (which adds lines when reviews keep bouncing for the same reason), so a single total budget replaced it. Governance was reframed as tripwires. Ratchet baselines were keyed per rule per module so refactoring does not false-fail them.
- **Defender**: the read-and-write principle — the Map and Queue only parse what the loop's write rules produce, so every kept parser names its write contract, and the derivation contract and amendment protocol are kept explicitly. The migration registry carries the boundary release instead of dying. The sim rig survives small. The module graph survives (the ripple caller list needs it for symbol-poor languages). The incident-born rules survive in the ways-of-working register. The worker contract and tier rule kept.
- **Goals auditor**: waivers — there was no legitimate exit from a wrong check. The update path kept permanently. Brownfield designed instead of sketched. Bulk-accept protecting "very little input." The security floor. Per-lane decision budgets — the spec counted review surfaces but never budgeted how many human decisions a lane may demand.

## Naming decisions

- The atomic unit is a **slice**: the established term, natural verbs, already parsed by the derivation contract. "Claim" was considered and rejected: the word already carries meaning in the patch flow's vocabulary, and "opening a claim" read awkwardly in use. The assertion-to-verify stance is a property of how the system treats a slice, not its name.
