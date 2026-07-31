# GroundWork north star

**Status:** PROPOSED. Nothing here is executed. This set is the decision artifact. A house-format execution plan follows only if this is ratified.
**Audience:** The owner, and any agent executing the rebuild later.
**Scope owner:** The whole framework.

## What this set is

A specification for what GroundWork becomes. It is grounded in the 2026 research survey (`docs/research/ai-developer-workflows-2026-07.md`) and in what this framework's own use has proven and disproven. The supporting numbers, sources, and history live in [evidence.md](evidence.md). The build, keep, and delete lists live in [changes.md](changes.md).

How to read it: this file carries the vision, the goals, and the rules. One file per part carries the mechanics:

1. [The Record](record.md) — living documentation with typed truth anchors and freshness checks.
2. [The Standards](standards.md) — the conventions we adopt, stated as imperatives, enforced by checks.
3. [The Loop](loop.md) — programs, bets, and slices, with ceremony priced by risk and two human seals.
4. [The Proof](proof.md) — a verification battery agents cannot argue with or edit.
5. [The Queue and the Map](surfaces.md) — the only two review surfaces: what needs you now, and where everything stands.
6. [Two doors](doors.md) — greenfield and brownfield entry into the same system.

## What GroundWork will be

GroundWork lets one human direct serious software. The human's judgment goes only where it is irreplaceable: intent, design of complex things, and acceptance. Everything else is either mechanical or verified.

## The track record this builds on

The method has proven itself. Real products shipped through it, across four repos and at least three stacks. Programs of bets were delivered end to end. The proof discipline caught real defects and named them in an escape catalog. The framework noticed its own bottlenecks and wrote plans against them. Its documentation discipline produced review metadata nothing else in the field has.

Two things are not proven, and this spec is honest about both. Attribution: the bundle shipped good products, but we cannot tell which parts did the work. Cost: the fatigue findings and the 344k-word upkeep are documented by the framework's own plans. So the verdict is not "the method failed." It is: keep what makes it safe, find out what carries the load, and shed the rest. Detail and numbers: [evidence.md](evidence.md).

## Goals

These are the acceptance criteria for everything in this set.

1. Real, useful documentation for humans and agents, kept current as the system evolves.
2. Human time goes to design, where leverage is high and complexity deserves it.
3. Greenfield: describe intent, get a high level of product for little input, without sacrificing the outcome.
4. Brownfield: wrap existing systems in a better way of working.
5. Uniform, high-quality code across sessions; existing code pulled toward the same style.
6. Proof of work: agents cannot cheat.
7. Easy review at both altitudes: what needs me now, and where the whole program stands — including planned and unstarted work.
8. Right-sized ceremony: light by default, heavy only where stakes demand it.
9. Durable memory: decisions, findings, and state live in git, never in a chat window.
10. Human ownership: you drove everything that shipped; you designed everything complex.
11. Autonomy scales with verification: the leash length comes from probe coverage of the touched area, not from the task label.
12. Everything reads plainly: docs, capsules, chat, and status that a tired human gets on the first pass.
13. Effective use of context: lean windows, tiered models, distilled hand-offs. The loop is economical by design.
14. Continuous delivery: a lined-up bet or program runs to completion unattended, stopping only for decisions that genuinely need a human and cannot wait.

## Core principle: effective use of context

Context is the scarcest machine resource, the way attention is the scarcest human one. Two disciplines, both enforced.

**In conversation.** Chat never carries what a page can hold. Checkpoints are a three-line delta plus a deep link. Reports are exceptions-first. Review arrives as two-minute capsules. The always-on kernel is capped at about 500 words. Everything else loads on demand. These are checks and budgets, not habits.

**In execution.** The loop is an orchestrator-worker economy:

- One frontier driver (today: the Opus/Fable class) owns the full picture. It plans, triages, dispatches, and never implements.
- Execution workers (today: the Sonnet class) do the building in fresh, disposable windows. Each receives a pointer capsule, not a transcript. Each returns a distilled report, not its context.
- Review and gates run at frontier. Judgment is where the higher model pays for itself.
- Workers escalate. They never self-assess alone. Cheap models cannot reliably judge their own limits, so the blocking-concern channel is contract, not courtesy.
- Tiers are capability classes, not model names. The tier is explicit on every dispatch. An omitted tier is an error. Degradation is upward-only.
- State lives in files and git, not in long windows. A window nearing its limit hands off through the ledgers. Compaction is treated as lossy.
- Token spend is recorded per dispatch, so the tier policy is tuned with measured numbers.

## Content rules

**The editorial rule.** Never teach what agents already know and will only get better at. State the conventions we have adopted and the shape they take in this project. Nudge modern; never lecture. Don't teach how to write good code. Teach how to write code in this project.

Three content classes follow: knowledge (cut it); adoptions and their shapes (keep them); depth-forcers, where agents still collapse without structure (keep them, with a date).

**One sunset regime.** Every shipped rule, check, template, and forcer is marked `architectural` or `dated`.
- `architectural`: survives model generations (externalized state, hostile verification, review as the constraint). Justified once, in writing.
- `dated`: works around a current model weakness. Carries a review-by date, six months maximum. At the date: re-justify with evidence or delete.
- The re-test happens in real work. After a model-generation bump, the next real project runs with one designated forcer off. The depth gate's verdict is the evidence. The small sim rig is the fallback instrument.

**Budgets.** Shipped instruction prose is capped: target 20–35k words total, from 344k today, with the always-on kernel about 500 words. The cap is CI-checked. Product documentation has no word cap. It is capped by freshness instead.

**Plain writing.** Register mirroring means models copy the style of what they read. It is our working hypothesis for why style guides keep failing. It is observed, not proven, and the fixes are cheap either way:

- The corpus cut removes the main source.
- Shipped prose is itself the exemplar, so it must be plain.
- About five style imperatives live in the kernel.
- Authored docs get a fresh-context plain edit before commit.
- The jargon lint, a maintained blocklist, runs on committed docs and on rendered capsules and status.
- Capsules are written by a fresh-context subagent.

## Governance

At one user, self-administered gates cannot be guarantees. They are tripwires that make growth deliberate and visible. Seven:

1. The instruction-word cap. CI-checked.
2. The sunset regime.
3. The always-on ceiling. Checked.
4. Quarterly host-absorption review: if the host platform ships a capability we built, ours is deleted. A checklist; honestly not CI-checkable.
5. Rules become checks. A rule that cannot become a check must earn its place in the small manual.
6. Publish only tool-measured numbers. Never productivity claims.
7. Shipped prose passes its own plain-language checks.

Three are mechanical. Four are discipline made visible.

## Risks

- Checks harden in place like prose did. The sunset regime binds checks, and waivers give wrong checks a legitimate exit.
- The person who administers the tripwires can step over them. They make that visible, which is all they can do.
- Rubber-stamping: drive artifacts harden acceptance, and the adversary hardens birth seals. Both are mitigations, not cures.
- The battery is new construction and a hard precondition. Pressure to shed the generators must not front-run it.
- Over-broad or stale citations can game the citation mechanic. Doc approval reviews the citation set, and the lint enforces per-step coverage.
- Extracted brownfield docs can be confidently wrong. Citations and freshness are the defense.
- Model-built scaffolds trade determinism for currency. Topology profiles and behavior probes keep the trade honest.
- The Queue can silt. Queue age and moment-budget overruns render loudly.

## Out of scope

No code changes, no deletions, no migrations, no release. This set is the proposal. If it is ratified, the next artifact is the execution plan: house format, workstreams, acceptance checks. [changes.md](changes.md) lists what that plan must decide.
