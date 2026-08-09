# Execution plan: building the north star

**Status:** DRAFT. The delivery approach below is settled with the owner. The ladder in §6 is provisional and firms up when the spec is ratified.
**Audience:** The owner, and any agent delivering the rebuild.
**Scope:** How the rebuild gets built — the repo it happens in, the harness that runs it, and how work is proved. What gets built is [the spec](north-star/index.md); this plan does not restate it.
**Reads with:** [changes.md](north-star/changes.md) holds the build, keep, and delete lists, and the open items this plan must eventually settle.

---

## 1. The rebuild happens in a new repo

Not a refactor of the existing one. Three reasons, in order of weight.

**The numbers already say rewrite.** The current repo holds about 344,000 words of shipped prose, and the spec deletes roughly nine tenths of it. Of the code, the largest pieces — the ten generators, the code-map verb, the docs-site generator — are on the delete list outright. Most of what the spec describes is new construction: the battery, the tower, the journal, the board derivation, the registry, the host adapter. Calling that a refactor would hide what it is.

**Agents mirror what they read.** This is the spec's own working hypothesis for why writing degrades, and it applies to a repo as much as to a page. An agent rebuilding inside the old repo reads the old corpus and produces old-shaped work. During an in-place rebuild that corpus sits there for the whole job — the exact material the spec exists to remove.

**A fresh repo flips the burden of proof.** In place, everything survives unless someone kills it, and each of the deletions is a decision that can be dodged or half-done. In a new repo nothing exists unless someone puts it there. The delete list stops being a set of arguments to win and becomes a port list we simply do not write.

The old repo is not deleted. It keeps serving its three installs, keeps publishing until cutover, and stays readable as an archive.

## 2. What we do not carry

**Not the old package.** An earlier draft of this plan proposed installing the published GroundWork package into the new repo to deliver the rebuild. That was wrong. Installing GroundWork installs its skills — the package's payload *is* the prose. An agent in that repo would read the old operating contract before it read anything else, which is the contamination we are trying to escape.

**Not the corpus, in any form.** No copied skills, no lifted templates, no "just as a reference" directory.

**One quarantined port pass.** Real assets exist in the old repo and must not be lost: what the CLI test suite asserts, the rules born from real incidents, the four boundary-linter configs, CI parity, and the release pipeline. Extracting those means reading the old repo, so it happens exactly once, in a single dispatch with one job: produce a plain-language list of what must remain true. That list is reviewed for register before it lands. After that pass, nobody opens the old repo again, and workers read the list rather than the source.

The rule for the port is: bring across the assertions and the scars, never the code. The spec already says this about the test suite — what carries over is what those tests assert, not their implementation.

Two things need no porting at all. The magpie and staycurrent archives stay where they are and are read in place as fixtures. And the migration path for the three existing installs is unchanged by any of this: it was always about consumer projects, and [changes.md](north-star/changes.md) covers it.

## 3. The harness

The rebuild is delivered by a small harness written by hand for this job. Everything in it is new prose written in plain style. It is deliberately minimal, and it is temporary.

- **The ladder.** This document's §6: ordered bets, each with a condition that can be shown false. It lives in git, so no session can lose it.
- **The working agreement.** One page, under a thousand words: what a slice is, what a brief carries, what review means, what gets committed. This is the piece that must be written to the new standard, because everything else mirrors it.
- **Tests, red first.** Ordinary tests in the new repo's own runner, committed failing before the slice that makes them pass.
- **Two ledgers.** `findings.md` and `decisions.md`, plain and append-only.
- **Review by dispatch.** A fresh agent per slice with a hand-written brief and no shared context with the builder.
- **CI.** Runs the tests, fails on red. One slice per commit with trailers, bets on branches, tags at seals.

That is the whole harness. If it starts to grow, that is a finding about the spec, because the spec claims a corpus this size is enough.

**It has a natural death.** The early bets build the journal and the battery, so the hand-rolled parts are replaced by the real ones as they arrive. The harness should shrink over the rebuild, not grow.

## 4. How work is proved

Most of the rebuild is deterministic — parsers, the journal writer, board derivation, CLI verbs, git operations. That is ordinary red-first testing and needs nothing special.

The distinctive parts are not deterministic. Whether prose actually steers an agent, whether a design walk is a good conversation, whether a capsule reads well: these are judgments. They get three layers, strongest first.

**Observable events.** Push as much as possible down to this layer, because it is the only one that cannot rubber-stamp. Many judgment questions collapse into something countable once you ask what would be true in the transcript. Did an escalation appear when the scenario held a genuinely ambiguous decision? Did the driver write source files, when it must never implement? Did the walk produce a diagram before prose? Did the run stop only for things on the stopping list?

**A rubric scored by a fresh judge.** The rubric is written before the work; that is the red-first artifact. The judge scores each point and must quote the transcript as evidence, so "looks good" cannot pass.

**Every rubric must be proven able to fail.** This is the deletion test applied to judgment. Score the rubric against a transcript already known to be bad; it must come out red. If it does not, the rubric is broken, and we learn that before it grades new work. The archives hold usable known-bad cases: a run that stopped after one milestone despite explicit instructions to continue, and an audit that rubber-stamped seventeen times.

**The human seal.** For what neither layer can judge. Red-first version: the scenario script exists, unsealed. Green means the owner ran it and sealed it.

**Non-determinism is handled by repetition.** One run proves nothing. Require three of five. Treat the variance as data: a proof that passes three times in five is flaky, and the spec's flake policy already says what happens — quarantine, loud on the board, repaired or retired within the milestone.

**A red-first behavioral proof is three committed files:** the scenario (seed state plus the scripted owner's lines), the rubric with its threshold, and the calibration pair. Committed before the work, reported red until it passes.

**Stated honestly:** the rubric layer is weaker than a unit test. It can drift and it can be gamed. Calibration fixtures and quoted evidence are mitigations, not cures — which is the argument for keeping this layer small and the observable layer large.

## 5. Sequencing

Three rules set the order.

1. **The floor first.** CI, the test runner, and the port list land before feature work, or there is nothing under the rebuild.
2. **The meter early.** The journal arrives near the front, so every bet after it is measured as it runs — token cost by role, wall-clock, what fired and what caught. The spec's claims about economy get tested from the start instead of asserted at the end.
3. **The rig before the behavioral work.** Anything proved by rubric needs the simulation rig to exist. So: deterministic core, then the rig, then the parts of the spec that are prose and judgment.

## 6. The ladder

Twelve bets, each with a done condition that can be attempted and watched fail, and every one of the spec's 108 commitments assigned to exactly one of them. It lives in [north-star-ladder.md](north-star-ladder.md).

## 7. What this plan must still settle

- The new repo's name, and whether the new package takes the current npm name at a major version or a new one.
- The cutover test: the exact moment the new framework delivers its own bet without the harness.
- Which existing repo is the first real consumer of the new framework, and when.
- Slices under each bet, cut at the start of that bet rather than now.
- How large this is. Nobody has sized it, and the ladder is the first artifact that makes sizing possible.
