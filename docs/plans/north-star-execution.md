# Execution plan: building the north star

**Status:** DRAFT. The delivery approach is settled with the owner. The ladder is written and complete on coverage; slices are cut at the start of each bet.
**Audience:** The owner, and any agent delivering the rebuild.
**Scope:** How the rebuild gets built — the repo it happens in, the harness that runs it, and how work is proved. What gets built is [the spec](north-star/index.md); this plan does not restate it.
**Settled 2026-08-08:** one repository, not two — main is blanked by a single reset commit, and the old world lives behind the `legacy-final` tag and on the `legacy` branch until cutover; the repo stays public; the toolchain is Go, shipping a single binary.
**Reads with:** [changes.md](north-star/changes.md) holds the build, keep, and delete lists, and the open items this plan must eventually settle.

---

## 1. The rebuild happens on a clean slate — in this repo

Not a refactor, and not a second repository either. One reset commit on main removes everything, and the old world stays reachable behind a tag. Three reasons the slate must be clean, in order of weight. None of them ever needed a second repo, which is why we no longer use one.

**The numbers already say rewrite.** The current repo holds about 344,000 words of shipped prose, and the spec deletes roughly nine tenths of it. Of the code, the largest pieces — the ten generators, the code-map verb, the docs-site generator — are on the delete list outright. Most of what the spec describes is new construction: the battery, the tower, the journal, the board derivation, the registry, the host adapter. Calling that a refactor would hide what it is.

**Agents mirror what they read — and they read the checkout.** This is the spec's own working hypothesis for why writing degrades, and it applies to a repo as much as to a page. What matters is the working tree, not the remote: after the reset commit, a grep finds nothing old, an open file shows nothing old, and code search on the default branch is clean. History behind the tag is reachable only on purpose, and the working agreement forbids going there.

**A clean slate flips the burden of proof.** In place, everything survives unless someone kills it. Each deletion is a decision, and decisions can be dodged or half-done. On a blank slate nothing exists unless someone puts it there. The delete list stops being arguments to win. It becomes a port list we simply do not write.

**The mechanics, in order.** The spec merges to main first, so the ratification record lives in the history of the thing it governs. Then `legacy-final` is tagged and a `legacy` branch is cut at the same commit. Then one ordinary commit on main — no history rewrite, no force push — deletes all old content and keeps the spec as `docs/spec/`, the working agreement as the always-on file, this plan, and the ladder. Its diff is the clean-slate decision made auditable, with the before-photo one tag behind it.

All of that is part of ratification, not part of any bet. Ratifying the spec *means* running this sequence — merge, tag, cut, blank — in one sitting. When it is done the repo holds exactly four things and nothing old, and bet 0 starts on ready ground. No bet ever runs in a repo that still contains the old world.

**The old world is a branch now, not a repo.** It keeps serving its three installs and publishing to npm from the `legacy` branch until cutover, with its Node CI pinned there and its release tags prefixed `legacy-` so the Releases page keeps the two worlds apart. Main's CI is the Go pipeline from the reset commit onward. Bugfixes for the live installs land on `legacy`; their lessons reach main only through the quarantined pass in §2.

## 2. What we do not carry

**Not the old package.** An earlier draft of this plan proposed installing the published GroundWork package into the blanked repo to deliver the rebuild. That was wrong. Installing GroundWork installs its skills — the package's payload *is* the prose. An agent in that repo would read the old operating contract before anything else. That is the contamination we are trying to escape.

**Not the corpus, in any form.** No copied skills, no lifted templates, no "just as a reference" directory.

**What the quarantine actually protects.** It protects against prose. Reading the old corpus changes how an agent writes, and that is the whole reason for the rule. It is not a rule about mechanical data. A list of file paths, a lint config, or a CI workflow carries no register, so extracting one costs nothing and hiding it helps nobody. The rule is therefore: prose from behind the legacy tag never crosses; mechanical facts may, under the same single-dispatch discipline.

**The port pass.** Real assets exist behind the legacy tag and must not be lost: what the CLI test suite asserts, the rules born from real incidents, the four boundary-linter configs, CI parity, and the release pipeline. Extracting those means reading the legacy branch. That happens in one dispatch with one job: produce a plain-language list of what must remain true. The list is reviewed for register, in a separate session, before it lands. Workers then read the list rather than the source.

The rule for the port is: bring across the assertions and the scars, never the code. The spec already says this about the test suite — what carries over is what those tests assert, not their implementation.

Four of the five targets are concrete and findable. The fifth is not: the legacy branch has no incident ledger, so rules born from real incidents sit scattered through skill prose and commit history, mixed in with ordinary design opinion, with nothing marking which is which. The port brief must say so and instruct the extractor to be conservative. A rule left behind can be pulled back by a later finding. A rule dragged across with its original prose brings the register with it.

**Two named exceptions, both quarantined the same way.** The legacy branch keeps serving three live projects for the whole rebuild, so it keeps generating exactly the kind of asset the port pass exists to capture. When a real incident happens there during the rebuild, a second single-dispatch pass extracts its lesson and appends it to `docs/carried-over.md`, register-reviewed like the first. And bet 15 needs a mechanical inventory of which paths the old package owns inside a consumer repo, so the migration can tell framework files from project files. That is data, not prose, and it is extracted the same way.

Two things need no porting at all. The magpie and staycurrent archives stay where they are and are read in place as fixtures. And the migration path for the three existing installs is unchanged by any of this: it was always about consumer projects, and [changes.md](north-star/changes.md) covers it.

## 3. The harness

**The repo is Go, shipping a single binary** (owner decision, 2026-08-08). Nothing in the spec stated a toolchain, because every toolchain reference in it is about products the framework serves rather than the framework itself.

Go rather than Node, against the grain of the legacy codebase, for three reasons. The tower is an always-on daemon, and a single binary starts at login with no runtime to manage. A consumer repo gets the framework without needing Node installed, which matters for a Swift project like magpie. And cross-compilation makes "macOS first" a scheduling choice rather than a technical one.

Two costs, both real. Distribution stops being npm, so the boundary release has to hand three live installs from a package to a binary. And where the framework must read a project's source — the blind author's interface extraction, test-marker filtering — Go cannot call each stack's own tooling in process and must shell out to it. That is probably the right shape anyway: the spec already deletes 28 MB of parser grammars for not earning their keep.

The rebuild is delivered by a small harness written by hand for this job. Everything in it is new prose written in plain style. It is deliberately minimal, and it is temporary.

- **The ladder.** This document's §6: ordered bets, each with a condition that can be shown false. It lives in git, so no session can lose it.
- **The working agreement.** One page, under a thousand words: what a slice is, what a brief carries, what review means, what gets committed. This is the piece that must be written to the new standard, because everything else mirrors it.
- **Tests, red first.** Ordinary tests in the repo's own runner, committed failing before the slice that makes them pass.
- **Two ledgers.** `findings.md` and `decisions.md`, plain and append-only.
- **Review by dispatch.** A fresh agent per slice with a hand-written brief and no shared context with the builder.
- **CI.** Runs the tests, fails on red. One slice per commit with trailers, bets on branches, tags at seals.

That is the whole harness. CI counts its words the same way it counts the corpus, and publishes the trend. Growth without a stated reason is a finding about the spec, because the spec claims a corpus this size is enough — and a claim with no counter behind it is just a sentence.

**It has a natural death.** The early bets build the journal and the battery, so the hand-rolled parts are replaced by the real ones as they arrive. The harness should shrink over the rebuild, not grow.

## 4. How work is proved

Most of the rebuild is deterministic — parsers, the journal writer, board derivation, CLI verbs, git operations. That is ordinary red-first testing and needs nothing special.

The distinctive parts are not deterministic. Whether prose actually steers an agent, whether a design walk is a good conversation, whether a capsule reads well: these are judgments. They get three layers, strongest first.

**Observable events.** Push as much as possible down to this layer, because it is the only one that cannot rubber-stamp. Ask what should show up in the transcript, and many judgment questions become countable. Did an escalation appear when the scenario held a genuinely ambiguous decision? Did the driver write source files, when it must never implement? Did the walk produce a diagram before prose? Did the run stop only for things on the stopping list?

**A rubric scored by a fresh judge.** The rubric is written before the work; that is the red-first artifact. The judge scores each point and must quote the transcript as evidence, so "looks good" cannot pass.

**Every rubric must be proven able to fail.** This is the deletion test applied to judgment. Score the rubric against a transcript already known to be bad; it must come out red. If it does not, the rubric is broken, and we learn that before it grades new work. The archives hold usable known-bad cases: a run that stopped after one milestone despite explicit instructions to continue, and an audit that rubber-stamped seventeen times.

**The human seal.** For what neither layer can judge. Red-first version: the scenario script exists, unsealed. Green means the owner ran it and sealed it.

**Non-determinism is handled by repetition.** One run proves nothing. Require three of five. Treat the variance as data. A proof that passes three of five is flaky, and the flake policy already says what to do: quarantine, flag it on the board, repair or retire within the milestone.

**A red-first behavioral proof is three committed files:** the scenario (seed state plus the scripted owner's lines), the rubric with its threshold, and the calibration pair. Committed before the work, reported red until it passes.

**Stated honestly:** the rubric layer is weaker than a unit test. It can drift and it can be gamed. Calibration fixtures and quoted evidence are mitigations, not cures — which is the argument for keeping this layer small and the observable layer large.

## 5. Sequencing

Three rules set the order.

1. **The floor first.** CI, the test runner, and the port list land before feature work, or there is nothing under the rebuild.
2. **The meter early.** The journal arrives near the front, so every bet after it is measured as it runs — token cost by role, wall-clock, what fired and what caught. The spec's claims about economy get tested from the start instead of asserted at the end.
3. **The rig before the behavioral work.** Anything proved by rubric needs the simulation rig to exist. So: deterministic core, then the rig, then the parts of the spec that are prose and judgment.

## 6. The ladder

Seventeen bets, each with a falsifiable done condition. Every one of the spec's 110 commitments is assigned to exactly one of them, checked by script. It lives in [north-star-ladder.md](north-star-ladder.md).

## 7. What this plan must still settle

- How the binary is distributed and installed: `go install`, GitHub releases, a package manager, or several. Bet 15 needs an answer before the boundary release; nothing earlier does.
- Which existing repo is the first real consumer of the new framework, and when.
- Slices under each bet, cut at the start of that bet rather than now.
- How large this is. Nobody has sized it, and the ladder is the first artifact that makes sizing possible.
