# Execution plan: building the north star

**Status:** Draft. The owner has agreed on the delivery approach. The ladder is written and covers everything it needs to. Slices are cut at the start of each bet.
**Audience:** The owner, and any agent delivering the rebuild.
**Scope:** How the rebuild gets built: the repo it happens in, the harness that runs it, and how the work gets proved. What gets built is described in [the spec](north-star/index.md). This plan does not repeat that.
**Settled 2026-08-08:** There is one repository, not two. Main is blanked by a single reset commit. The old world lives behind the `legacy-final` tag and on the `legacy` branch until cutover. The repo stays public. The toolchain is Go, shipping a single binary.
**Reads with:** [changes.md](north-star/changes.md). It holds the build, keep, and delete lists, and the open items this plan must eventually settle.

---

## 1. The rebuild happens on a clean slate — in this repo

This is not a refactor. It is not a second repository either. One reset commit on main removes everything. The old world stays reachable behind a tag.

There are three reasons the slate must be clean, in order of weight. None of them ever needed a second repo. That is why we no longer use one.

**The scale of the change.** The current repo holds about 344,000 words of shipped prose. The spec deletes roughly nine tenths of it. Of the code, the largest pieces are on the delete list outright: the ten generators, the code-map verb, the docs-site generator.

Most of what the spec describes is new construction: the battery, the tower, the journal, the board derivation, the registry, the host adapter. Calling that a refactor would hide what it is.

**What agents read shapes how they write.** The spec's own working hypothesis is that reading old material changes how an agent writes. That applies to a repo as much as to a page.

What matters is the working tree, not the remote. After the reset commit, a grep finds nothing old. An open file shows nothing old. Code search on the default branch is clean. History behind the tag is reachable only on purpose, and the working agreement forbids going there.

**Why starting empty matters.** In place, everything survives unless someone kills it. Each deletion is a decision, and decisions can be dodged or half-done.

On a blank slate, nothing exists unless someone puts it there. The delete list stops being arguments to win. It becomes a port list we simply do not write.

**The steps, in order.** The spec merges to main first. That way the ratification record lives in the history of the thing it governs.

Then `legacy-final` is tagged, and a `legacy` branch is cut at the same commit.

Then one ordinary commit on main deletes all old content. No history rewrite, no force push. It keeps the spec as `docs/spec/`, the working agreement as the always-on file, this plan, and the ladder.

That commit's diff makes the clean-slate decision auditable. The before-photo sits one tag behind it.

All of this is part of ratification, not part of any bet. Ratifying the spec means running this sequence in one sitting: merge, tag, cut, blank.

When it is done, the repo holds exactly four things and nothing old. Bet 0 starts on ready ground. No bet ever runs in a repo that still contains the old world.

**The old world, as a branch.** The `legacy` branch keeps serving its three installs and publishing to npm until cutover. Its Node CI is pinned there. Its release tags are prefixed `legacy-`, so the Releases page keeps the two worlds apart.

Main's CI is the Go pipeline from the reset commit onward. Bugfixes for the live installs land on `legacy`. Their lessons reach main only through the quarantined pass in §2.

## 2. What we do not carry

**Not the old package.** An earlier draft of this plan proposed installing the published GroundWork package into the blanked repo to deliver the rebuild. That was wrong.

Installing GroundWork installs its skills, and the package's payload is the prose. An agent in that repo would read the old operating contract before anything else. That is the contamination we are trying to escape.

**Not the corpus, in any form.** No copied skills, no lifted templates, no "just as a reference" directory.

**What the quarantine protects.** It protects against prose, not mechanical data. Reading the old corpus changes how an agent writes — that is the reason for the rule, as explained in §1.

A list of file paths, a lint config, or a CI workflow carries no register. Extracting one costs nothing, and hiding it helps nobody.

The rule, then: prose from behind the legacy tag never crosses. Mechanical facts may, under the same single-dispatch discipline.

**The port pass.** Real assets exist behind the legacy tag and must not be lost: what the CLI test suite asserts, the rules born from real incidents, the four boundary-linter configs, CI parity, and the release pipeline.

Extracting those means reading the legacy branch. That happens in one dispatch with one job: produce a plain-language list of what must remain true.

The list is reviewed for register, in a separate session, before it lands. Workers then read the list, not the source.

The rule for the port: bring across the assertions and the scars, never the code. The spec already says this about the test suite. What carries over is what those tests assert, not their implementation.

Four of the five targets are concrete and findable. The fifth is not. The legacy branch has no incident ledger. Rules born from real incidents sit scattered through skill prose and commit history, mixed in with ordinary design opinion, with nothing marking which is which.

The port brief must say so and tell the extractor to be conservative. A rule left behind can be pulled back later, by a new finding. A rule dragged across with its original prose brings the register with it.

**Two named exceptions, both quarantined the same way.** The legacy branch keeps serving three live projects for the whole rebuild. That means it keeps generating exactly the kind of asset the port pass exists to capture.

First exception: when a real incident happens there during the rebuild, a second single-dispatch pass extracts its lesson and appends it to `docs/carried-over.md`, register-reviewed like the first.

Second exception: bet 15 needs a mechanical inventory of which paths the old package owns inside a consumer repo, so the migration can tell framework files from project files. That is data, not prose. It is extracted the same way.

Two things need no porting at all. The magpie and staycurrent archives stay where they are, and are read in place as fixtures. The migration path for the three existing installs is unchanged by any of this — it was always about consumer projects, and [changes.md](north-star/changes.md) covers it.

## 3. The harness

**The repo is Go, shipping a single binary** (owner decision, 2026-08-08). The spec itself does not state a toolchain — every toolchain reference in it is about products the framework serves, not the framework itself.

The choice is Go rather than Node, against the grain of the legacy codebase, for three reasons.

The tower is an always-on daemon. A single binary starts at login with no runtime to manage.

A consumer repo gets the framework without needing Node installed. That matters for a Swift project like magpie.

Cross-compilation makes "macOS first" a scheduling choice, not a technical one.

**Two costs, both real.** Distribution stops being npm. The boundary release has to hand three live installs from a package to a binary.

And where the framework must read a project's source — the blind author's interface extraction, test-marker filtering — Go cannot call each stack's own tooling in process. It must shell out to it instead. That is probably the right shape anyway: the spec already deletes 28 MB of parser grammars for not earning their keep.

The rebuild is delivered by a small harness, written by hand for this job. Everything in it is new prose, written in plain style. It is deliberately minimal, and it is temporary.

- **The ladder.** This document's §6: ordered bets, each with a condition that can be shown false. It lives in git, so no session can lose it.
- **The working agreement.** One page, under a thousand words: what a slice is, what a brief carries, what review means, what gets committed. This is the piece that must be written to the new standard, because everything else mirrors it.
- **Tests, red first.** Ordinary tests in the repo's own runner, committed failing before the slice that makes them pass.
- **Two ledgers.** `findings.md` and `decisions.md`, plain and append-only.
- **Review by dispatch.** A fresh agent per slice with a hand-written brief and no shared context with the builder.
- **CI.** Runs the tests, fails on red. One slice per commit with trailers, bets on branches, tags at seals.

That is the whole harness.

CI counts its words the same way it counts the corpus, and publishes the trend. Growth without a stated reason is a finding about the spec. The spec claims a corpus this size is enough, and a claim with no counter behind it is just a sentence.

**The harness shrinks as it's replaced.** The early bets build the journal and the battery. As they arrive, the hand-rolled parts are replaced by the real ones. The harness should shrink over the rebuild, not grow.

## 4. How work is proved

Most of the rebuild is deterministic: parsers, the journal writer, board derivation, CLI verbs, git operations. That is ordinary red-first testing, and needs nothing special.

The distinctive parts are not deterministic. Whether prose actually steers an agent, whether a design walk is a good conversation, whether a capsule reads well — these are judgments, not facts. They get three layers, strongest first.

**Observable events.** Push as much as possible down to this layer. It is the only one that cannot rubber-stamp.

Ask what should show up in the transcript. Many judgment questions become countable this way. Did an escalation appear when the scenario held a genuinely ambiguous decision? Did the driver write source files, when it must never implement? Did the walk produce a diagram before prose? Did the run stop only for things on the stopping list?

**A rubric scored by a fresh judge.** The rubric is written before the work. That is the red-first artifact. The judge scores each point and must quote the transcript as evidence, so "looks good" cannot pass.

**Every rubric must be proven able to fail.** This is the deletion test applied to judgment. Score the rubric against a transcript already known to be bad. It must come out red.

If it does not, the rubric is broken, and we learn that before it grades new work. The archives hold usable known-bad cases: a run that stopped after one milestone despite explicit instructions to continue, and an audit that rubber-stamped seventeen times.

**The human seal.** For what neither layer can judge. Red-first version: the scenario script exists, unsealed. Green means the owner ran it and sealed it.

**Non-determinism is handled by repetition.** One run proves nothing. Require three of five. Treat the variance as data.

A proof that passes three of five is flaky. The flake policy already says what to do: quarantine it, flag it on the board, repair or retire it within the milestone.

**A red-first behavioral proof is three committed files:** the scenario (seed state plus the scripted owner's lines), the rubric with its threshold, and the calibration pair. These are committed before the work, and reported red until it passes.

**Stated honestly:** the rubric layer is weaker than a unit test. It can drift, and it can be gamed. Calibration fixtures and quoted evidence are mitigations, not cures. That is the argument for keeping this layer small, and the observable layer large.

## 5. Sequencing

Three rules set the order.

1. **The floor first.** CI, the test runner, and the port list land before feature work, or there is nothing under the rebuild.
2. **The meter early.** The journal arrives near the front. Every bet after it is measured as it runs: token cost by role, wall-clock, what fired and what caught. The spec's claims about economy get tested from the start, instead of asserted at the end.
3. **The rig before the behavioral work.** Anything proved by rubric needs the simulation rig to exist. So: deterministic core, then the rig, then the parts of the spec that are prose and judgment.

## 6. The ladder

Seventeen bets, each with a done condition that can be shown false. Every one of the spec's 113 commitments is assigned to exactly one bet, checked by script. The ladder lives in [north-star-ladder.md](north-star-ladder.md).

## 7. What this plan must still settle

- How the binary is distributed and installed: `go install`, GitHub releases, a package manager, or several of these. Bet 15 needs an answer before the boundary release. Nothing earlier does.
- Which existing repo is the first real consumer of the new framework, and when.
- Slices under each bet, cut at the start of that bet rather than now.
- How large this is. Nobody has sized it, and the ladder is the first artifact that makes sizing possible.
