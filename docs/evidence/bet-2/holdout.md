# The held-out set

Bet 2's done condition is graded against two repos the battery was never tuned on. D26 rules the discipline; D27 rules where they live. This file is the record D26 names.

## The repos

- `holdout-go-fieldkit` — a Go repo, authored by a separate dispatch that never saw the battery code. Branch tip at sealing: 93801c2.
- `holdout-ts-tallysheet` — a TypeScript repo, same discipline. Branch tip at sealing: 8d1790f.

Both live as branches on origin, because the host proxy refuses tag pushes (F1, F12's host-limit). The answer-key commit is the tip of each branch, named "Add the sealed capability answer key", holding ANSWER-KEY.json.

## The rules

- The answer keys are sealed. No battery builder reads them, and the driver does not read them either. Only the slice 7 grading dispatch opens them, after the verify runs are recorded.
- A run burns the repo. Once verify has been run against a holdout repo and graded, any later tuning of the battery bumps the major version and needs a fresh holdout — D26.
- magpie and staycurrent are reachable and serve the no-false-reds direction only.

## The grading record

Written by the slice 7 grading dispatch, after the runs were recorded. The run record is `/tmp/holdout-run/RUNS.md`. The keys were read only here.

### What was graded

- Battery: `4.0+rb7b57ef`, built from GroundWork `b0c68d3`.
- go-fieldkit: key commit `93801c2`, run at its parent `6f28180`, plus the adoption commit `6d006ed`.
- ts-tallysheet: key commit `8d1790f`, run at its parent `1d45d20`, plus the adoption commit `5ea78b1`.
- GroundWork itself, at `b0c68d3`, for the no-false-reds direction.

Each holdout ran twice, back to back. Both pairs came out identical apart from the run id.

Where the printed evidence was cut short, I rebuilt the missing part rather than guess. For go-fieldkit's mutate row I made all 11 mutants by hand in a scratch copy and ran each package's tests. For its honesty row I ran the battery again on scratch copies holding one test at a time. Nothing in either holdout repo, and nothing in GroundWork, was changed.

### go-fieldkit: planted defect against verify's answer

| Capability | Key | What verify said | Grade |
| --- | --- | --- | --- |
| slug | honest | No test-quality row named it. The wiring row named `slug.Truncate` as unwired. | Tests judged right. Wiring red is false. |
| wrap | honest | The mutate row killed both `wrap.Lines` and `wrap.Text`. The wiring row named `wrap.Text` as unwired. | Tests judged right, with proof. Wiring red is false. |
| csvline | honest | No test-quality row named it. Its one mutant did not compile, so nothing was proven either way. The wiring row named `csvline.Split` as unwired. | Not called hollow, but not proven honest. Wiring red is false. |
| quantity | hollow, deletion-survivor | The mutate row went red. In that package the survivor it found is `Quantity.String`, not `Parse`. `Parse`'s mutant did not compile. | Partial catch. Right row, right package, wrong function, and the key's own shape was never tested. |
| titlecase | hollow, never-run | run-evidence red: "2 tests that never ran: titlecase/TestOf never ran; titlecase/TestOfCollapsesSpacing never ran". | Full catch. Right row, both tests named. |
| checksum | hollow, vacuous | honesty red naming `checksum_test.go:19 TestDigits logs but never asserts` and 2 more. mutate red: all three of `Digits`, `Valid` and `CheckDigit` survived. | Full catch, twice over, by two different rows. |

The mutate row's hidden survivors, rebuilt: `checksum.Digits`, `checksum.Valid`, `checksum.CheckDigit` and `quantity.String`. All four are real. No survivor it named is false.

The full picture across all 11 exported functions: 3 killed (`slug.Truncate`, `wrap.Lines`, `wrap.Text`), 4 survived (the ones above), 4 mutants did not compile (`slug.Make`, `csvline.Split`, `quantity.Parse`, `titlecase.Of`). The run sampled 10 of the 11, and the one it left out was one of the four that would not compile.

### ts-tallysheet: planted defect against verify's answer

| Capability | Key | What verify said | Grade |
| --- | --- | --- | --- |
| money | honest | No row named it. run-evidence reconciled its tests. | Right. |
| dateRange | honest | No row named it. run-evidence reconciled its tests. | Right. |
| categorize | hollow, deletion-survivor | Nothing. The mutate row is unrunnable on a node surface. | Missed. Expected loss. |
| summary | hollow, never-run | manifest red: "declares 1 capability no suite proves: summary". | Caught, by the manifest row. See the note below. |
| receiptId | hollow, vacuous | Nothing. The honesty row is unrunnable on a node surface. | Missed. Expected loss. |

One of three hollow capabilities was flagged here, against three of three on go-fieldkit.

### The false-red audit

Every red the five runs printed, and whether the key or the repo backs it.

| Red | Backed? | Verdict |
| --- | --- | --- |
| go-fieldkit honesty | Yes. The key calls checksum vacuous. All three named tests sit in checksum. | True red. |
| go-fieldkit run-evidence | Yes. The key calls titlecase never-run. | True red. |
| go-fieldkit mutate | Yes. All four survivors were re-made by hand and all four survive. | True red. |
| go-fieldkit wiring | No. | **False red.** |
| ts-tallysheet manifest | Yes. Nothing that runs proves summary. | True red. |
| GroundWork itself | No reds. Exit 0, 7 rows green. | Clean. |

**The wiring red is the one false red.** The row's rule is that an exported function no non-test file names is not wired. go-fieldkit is a library. Its callers live in other people's repos, so almost none of its public API has an in-repo caller. The row flagged 8 of 11 exported functions, including `slug.Truncate`, `wrap.Text` and `csvline.Split` — the public API of the three capabilities the key calls honest.

The adoption is not to blame. `profile: "library"` is the right declaration for this repo, and it is one of the six profiles the spec allows. The token row reads that profile and stands down by name. The wiring row never reads profile at all. This is a battery judgment, not an adoption artifact.

This is exactly the kind of defect a holdout exists to find. GroundWork's own history could never surface it: GroundWork is a `cli` surface whose exported functions all have in-repo callers, so the row is green there and stays green.

**On the ts manifest red and the adoption.** The runner declared `src/summary.spec.ts` as summary's proof and noted that `package.json`'s own test command does not run that file. That declaration was the honest one — the spec file is summary's only suite. The red it produced is true: nothing that runs proves summary. So this is a real catch, not an adoption artifact.

It has to be said plainly, though, that the catch leans on the adoption. Had the adopter declared only the four `test/*.test.ts` capabilities and left summary out, ts-tallysheet would have printed no red at all: three green rows, three unrunnable, and three hollow capabilities passing unseen. The battery has no row of its own, this bet, that would find an orphan spec file on a node surface.

### The unrunnable rows

All three sentences are honest. Each names what the scan reads, names the surface, and says why it cannot read it. None claims the surface passed. Unrunnable is not green, and the run still exited 1.

- honesty: "the honesty scan reads Go test source, and the surface "tallysheet" is written in node, which this scan cannot read yet" — honest and clear.
- wiring: "the wiring scan reads Go source, and the surface "tallysheet" is written in node, which this scan cannot read yet" — honest and clear.
- mutate: "the deletion test found no target it could judge; the surface "tallysheet" is node, and a mutation run there lands with that stack's adapter" — honest, but the ending is indirect. It does not tell a reader that the node adapter's mutation support arrives in a later bet.

What they cost: categorize's deletion-survivor and receiptId's vacuous assertions both went uncaught. Those are expected losses this bet, named here so the record carries them.

### The two oddities the runner flagged

**"10/11" against a 3+4+3 breakdown — honest rendering, not an accounting defect.** The row's short wording is `sampled/pool`. So 10 is the sample and 11 is the pool of targets. The classes are the sample: 3 killed + 4 survived + 3 uncompiled = 10. My own sweep confirms the pool: 11 exported functions in the repo. The line reconciles.

There is a legibility cost. The short wording drops the word "of", so "10/11" reads like a score, which is how the runner read it. The evidence cap is 200 bytes, and the row drops to the shorter wording when that buys it one more name. Keeping "of" would cost three bytes and remove the ambiguity.

**The truncated "and N more" — honest rendering, with a real cost.** The row keeps as many names as fit, then says how many it left out. Counts are never cut. Nothing is claimed that is not true.

The cost is that the left-out names exist nowhere. Not on stdout, not on stderr, not in a file. Recovering go-fieldkit's other three survivors took 11 separate mutation runs. A reader who wants the full list has no way to get it from the tool. `verify` needs a way to print full evidence.

### Two misses worth recording

Neither is a false red. Both are recall.

1. The honesty row named 3 of checksum's 4 vacuous tests. It missed `TestValidIsConsistent`, whose only assertion is `Valid(acc) != Valid(acc)`. The self-comparison check ignores a comparison where either side holds a call, on purpose and in writing, to avoid a false red. The key names that exact shape as one of the planted ones. So the rule as written cannot catch it.

2. The deletion test could not judge 4 of 11 targets, because blanking the only user of an import breaks the build. On a small single-function package that is the normal case, not the odd one: `csvline.Split`, `quantity.Parse` and `titlecase.Of` are each their package's only import user. So the deletion test is systematically blind on exactly the shape of package this repo is made of.

### The ladder's done-when, clause by clause

| Clause | Verdict | Evidence |
| --- | --- | --- |
| "verify correctly classifies two repos it was never tuned against" | Partly met | Both repos went red and exited 1. Three of three hollow capabilities flagged on go-fieldkit, one of three on ts-tallysheet, and one false red on go-fieldkit's wiring row. |
| "It calls a suite red when tests survive the implementation being deleted." | Met, on Go surfaces | go-fieldkit mutate red, 4 real survivors, all verified by hand. Unrunnable on node, by design this bet. |
| "It calls a suite red when tests compile but never run." | Met | go-fieldkit run-evidence red naming both titlecase tests. ts-tallysheet manifest red naming summary. |
| "It calls a suite red when assertions are vacuous." | Met, on Go surfaces | go-fieldkit honesty red naming 3 of checksum's 4 vacuous tests. Unrunnable on node, so receiptId went uncaught. |
| "It calls honest work green." | Partly met | No row that judges test quality named an honest capability on either repo. The wiring row named the public API of all three honest go-fieldkit packages. |
| "Run against this repo's own history, it produces no false reds." | Met, at `b0c68d3` | 7 rows green, exit 0, 433 seconds, working tree clean before and after. The run covers HEAD, not a walk of every commit. |
| "A wrong check can be waived; the waiver gets recorded and counted." | Proven in slice 6 | Not contradicted here. Every one of the five runs printed "waived 0". |
| "A flaky row quarantines instead of blocking the run." | Proven in slice 6 | Not contradicted here. Every run printed "quarantined 0", and both holdout pairs were byte-identical apart from the run id. No flake surfaced to test it. |

### In a minute

The battery went red on both repos it had never seen, and its reds were mostly right. On the Go repo it found all three planted hollow capabilities: it named the vacuous tests, it named the two tests that never run, and it found four surviving mutants that really do survive. Its evidence names files and lines a reader can act on. On the TypeScript repo it found one of three, because the honesty, wiring and mutate rows cannot read a node surface yet — those rows said so plainly and claimed nothing.

There is one false red, and it matters. The wiring row calls a library's public API dead code, because nothing inside the repo calls it. That fired on all three honest capabilities of go-fieldkit. The manifest declared `profile: "library"`, which the token row reads and stands down for; the wiring row does not read profile at all. GroundWork's own repo could never have shown this, because everything it exports has an in-repo caller. That is the holdout doing its job.

Two smaller things. The deletion test cannot judge a function that is its package's only import user, which on small packages is most of them. And the honesty row's self-comparison rule deliberately ignores comparisons of two call results, which is the exact shape the key planted. Both are recall limits, both are already written down in the code, and neither produces a false statement about a project.

The bet's done condition is not met as written: there is one false red, and honest work was called red by it. Everything else in the clause list holds.


## The second held-out set, for the 5.0 grading

D41 burned the first set: fixing the wiring row after its graded run was tuning, so any new claim against the done-when's held-out clause needs fresh repos. These are they, authored 2026-08-23 by a fresh dispatch that read nothing under this repository and pushed through git alone.

- `holdout2-go-quarrytools` — a Go library, six packages. Tip at sealing: 58faa0e.
- `holdout2-ts-stonecrop` — a zero-dependency node library, five helpers. Tip at sealing: c7f18c6.

The keys sit at each root as the final commit, touching only ANSWER-KEY.json. The same rules bind: no battery builder and no driver reads them; only the grading dispatch, after the runs are recorded; a graded run burns the repo.

## The second grading record

Written by the 5.0 grading dispatch. Empty until then.
