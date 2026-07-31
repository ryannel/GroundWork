# Evidence

The numbers, sources, and history behind the spec. Survey references cite `docs/research/ai-developer-workflows-2026-07.md` by section. Internal measurements are our own and labeled as such.

## What the research says developers need

Eight needs, distilled from the survey. Each shaped a part of the spec.

1. **Work sized for review in one sitting.** The binding constraint is whether a human ever starts reviewing. That is a queueing problem, not a reviewing problem (§3.7, LinearB, 8.1M PRs: AI-assisted PRs wait ~5× longer for pickup but review faster once started). Batch size roughly doubled in a year across four independent telemetry sets (§3.8). That is the survey's most solid claim. → The slice cap, the Queue.
2. **Ceremony priced by risk.** One-size process is discredited by practice (§6.1: a small bug becoming "4 user stories with 16 acceptance criteria"). Production systems stratify by risk (§3.2: Meta and Cloudflare tiering). → Lanes, the dial.
3. **Verification by oracles that cannot lie.** Agents over-report completion (§4.1, vendor-against-interest plus three independent corroborations). Agent-written tests are measurably over-mocked (§4.1). A fresh-context reviewer sharing nothing with the author catches ~2 bugs per PR, 58% severe (§2.6, vendor-internal). Predefined suites cannot cover open specs (§4.2), so the human drive stays. → The battery, the adversary, the drive artifact.
4. **Rationale and risk attached to every change.** Review is trust-calibration. Without signals the reviewer "reconstructs a rationale that never made it into the diff" (§3.3). → The capsule.
5. **Externalized state, lean context.** File-and-git state is the long-horizon technique that survives model generations (§1.3). Always-on context files showed no reliable benefit at +20% cost, acting as documentation substitutes (§1.4, ETH Zurich). That study's scope limit: always-on, Python-only. The survey says it is not evidence against on-demand loading. Instructions are followed; repository overviews are not (§1.4). → The Record, the kernel cap, the ledgers.
6. **Autonomy set by checkability.** Detection speed, undo cleanliness, and proof, not task names (§2.5, Osmani). Unattended work is for the disposable or mechanically verifiable (§2.4). → Probe-coverage autonomy, the dial.
7. **A harness that shrinks.** Harness prescriptions decay in 4–6 months (§0 "Shelf life"). Handcrafting detailed rules for AI does not scale (§6.1, the bitter-lesson warning). → The sunset regime, the word cap.
8. **Honesty about outcomes.** No trustworthy controlled estimate of AI throughput exists in either direction. Self-report is off by tens of points (§5.1–5.2). → Rule six: publish only tool-measured numbers.

The converged multi-agent shape is also load-bearing: one context-owning lead, ephemeral workers returning distilled summaries, writes single-threaded (§2.6). Its token economics are also load-bearing: workers explore at tens of thousands of tokens and return one or two thousand (§2.6). Mixed-tier setups fail when the weak model must judge its own limits (§2.6). Hence the escalation channel.

Security outcomes flat-line around 55% without guidance in the loop (§5.6). That is a scope statement about unguided generation; whether guidance moves security outcomes is untested. Instruction files nearly doubled agent PR merge success in one well-documented repo (§3.5, dotnet/runtime). That is one repo, not an industry result.

Evidence-hygiene rules for anything citing this material:

- Cite the survey by section.
- Label our own analysis as ours.
- The design-time case rests on the owner's results plus one argued position ("pull designs up, not up-front" is one side of an unresolved debate, §6.2).
- Skills-standard adoption is an interop argument, not efficacy (§6.4).
- Batch size and queueing are the top two findings. Don't invent a single winner.
- The worktree-contention evidence (§2.1: 62% loss with 13 worktree-isolated agents; shared `.git` internals make git single-writer across trees) is a warning the parallel design must engineer around, not an endorsement of it.
- Register mirroring is a working hypothesis from observed sessions, not an established model property.

## What GroundWork is today

Measured against the working tree at the time of this spec:

- 343,846 words of shipped instruction markdown across 316 files (~460–490k tokens). Hidden skills 174k; principles corpus ~73k; engineer skills ~72k (six stacks, ~12k each); always-on tier 5k (two registered skills).
- A 13-protocol operating contract (543 lines, mandatory reading). 5 greenfield + 5 brownfield setup phases. A 5-phase bet lifecycle. `groundwork-bet` alone is 45,237 words across 33 files. 4 personas, 7 review-lens briefs, 3 lanes.
- An 18-verb CLI in one 3,115-line file. 9 of the 18 verbs are mechanical anti-cheat checks, the best-tested code in the repo (24 CLI test files).
- 10 Nx generators, 152 templates. The npm package is 34 MB, of which 28 MB (82%) is tree-sitter grammars serving one verb.
- The repo is ~11 weeks old with 384 commits, all framework construction and upkeep. On top of that sit 232k words of unshipped planning prose, a migration registry, sync-anchor gates, a skill linter, and a five-layer test harness including a live-session simulation rig.
- A full 3-milestone bet costs ~35–45 subagent dispatches (most at frontier), ~20 committed artifacts, six bookkeeping writes per slice, and 10–15 human decision moments.

## What the projects prove, and what they don't

Proven by use:

- Real products shipped through the method across four repos and at least three stacks.
- Programs of bets were delivered end to end (magpie's graded-library program: three of four bets delivered).
- The proof discipline caught and named real defects (the 27-bug escape catalog; the 3.7-second POC that shipped slower; the dead-end navigation; the hollow video file).
- The framework self-instrumented and wrote plans against its own bottlenecks (review-throughput; program-progress-visibility).
- The owner kept choosing it with every alternative available.

Not proven: attribution and cost-effectiveness. Attribution: the bundle contains mechanism and ceremony, so the wins cannot be credited to specific parts. Cost-effectiveness: the fatigue findings and the 344k-word upkeep are documented by the framework's own plans. By the survey's causal standard nobody in the industry has proof either; the field's best instrument broke (§5.1). Held to the practitioner standard, this method has more internal evidence than most of what the survey covers.

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

2026-07, magpie. The owner instructed: "We've got multiple bets lined up, please go as far as you can delivering as many bets as possible. Only stop if you need a genuine human steer that can't wait… THIS IS THE MOST IMPORTANT INSTRUCTION GOING FORWARD TILL THIS IS DELIVERED." The run still stopped after one milestone for a status report. Cause: the delivery workflow's default milestone-by-milestone mode and its mandatory checkpoint pause outranked the chat instruction. Lesson encoded in the spec: chat instructions decay. They lose to skill prose and erode across compaction. Run mode must be recorded state consulted mechanically.

## Internal measurements the design leans on

Ours, not the survey's:

- Fix-in-place ladder: a fresh agent re-deriving context measured ~41% of the original build cost. (Kept as designed.)
- Per-slice honesty auditing: 17 runs, 2 catches, 4 false negatives. That is rubber-stamping, so it moved to milestone-sum. (The adversary's two-altitude split.)
- Milestone red stubs shipped with their user-observable assertion commented out. The readiness gate only checked that a test file was named. (The red-for-the-right-reason check.)
- The docsite was "the right channel, usually dead". Acceptance checkboxes went unticked. Mechanical evidence died in agent terminals. The sign-off walk flattened. (Non-blocking checkpoints, the Queue, the host hook.)
- Answering "is this program complete?" took five forensic steps. `status` reported "23 delivered · 0 in flight · 97 queued", which was true and useless. An unstarted bet left no trace. Archiving deleted the rendered view. (Programs first-class, the Map.)
- The framework's own review-throughput plan opens: "The bottleneck is human fatigue during review."

## What the adversarial reviews changed

Five reviews ran against an earlier draft of this spec: one blind, one evidence fact-check, one operator (workability), one defender of the deleted, one goals auditor. There were about 50 findings. The survivors reshaped the spec:

- **Blind**: the Map's sources split into authored-and-sealed plans vs derived state (unstarted work cannot be "derived from git"). Three overlapping expiry schemes unified into the one sunset regime. Link and numbering promises scoped honestly.
- **Evidence**: thirteen citation corrections, now folded into the hygiene rules above. Two of our own analyses had been wearing an "Industry:" label.
- **Operator**: sockets went per-topology (the server-shaped set excluded desktop: magpie). "the battery is repurposed" corrected to new construction with a retirement gate. The per-release word gate became a total cap (flow accounting was at war with bounce-fed growth). Governance reframed as tripwires (three mechanical, four discipline). Ratchets keyed per rule per module so refactoring doesn't false-fail.
- **Defender**: the read/write principle. The Map and Queue parse artifacts only the lifecycle's write rules produce, so the derivation contract and the amendment protocol are kept explicitly. The migration registry carries the boundary release instead of dying. The sim instrument survives small. The module graph survives (the ripple check needs it for symbol-poor languages). The nine incident-born scar rules survive in the known-escapes register. The worker contract and tier rule kept.
- **Goals auditor**: waivers (no legitimate exit from a wrong check existed). The update lane kept permanently. Brownfield designed instead of sketched. Bulk-accept protecting "very little input". The security floor. Moment budgets (surfaces were counted, moments were not).

## Naming decisions

- The atomic unit is a **slice**: the established term, natural verbs, already parsed by the derivation contract. "Claim" was considered and rejected: it collided with the patch lane's meaning and read awkwardly in use. The assertion-to-verify stance is a property of how the system treats a slice, not its name.
