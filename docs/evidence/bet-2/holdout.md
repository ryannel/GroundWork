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

Written by the 5.0 grading dispatch, after the runs were recorded. The run record is `/tmp/holdout2-run/RUNS.md`. The keys were read only here.

### What was graded

- Battery: `5.0+rb7b57ef`, built from GroundWork `b8552ccd4de57de813b7ebb42feec37964606542`.
- quarrytools: key commit `58faa0e`, run at its parent `8dc6b9b`, plus the adoption commit `6521be1`. A Go library, six packages, fifteen exported functions, no unexported ones.
- stonecrop: key commit `c7f18c6`, run at its parent `104a304`, plus the adoption commit `52b81ca`. A node library, five helpers, twenty-six tests.
- GroundWork itself, at `b8552cc`, for the no-false-reds direction.

Each holdout ran twice, back to back. Both pairs came out identical apart from the run id.

Where the printed evidence was cut short, I rebuilt the missing part rather than guess. Three rebuilds, all in a scratch directory of my own:

1. All fifteen quarrytools mutants, made by hand and run one at a time.
2. The sample the run actually drew, recomputed from the row's own rule — the target hashed with the version, sorted, first ten.
3. The honesty row run against four scratch copies of quarrytools, each holding one stats test.

I also ran one counterfactual on stonecrop, described under the adapter question below.

Nothing in either holdout repo was changed. Nothing under /home/user/GroundWork was changed by me except this file.

### quarrytools: planted defect against verify's answer

| Capability | Key | What verify said | Grade |
| --- | --- | --- | --- |
| slug | honest | No row named it. Neither of its two mutants was in the sample. | Right, but untested by the mutate row. |
| wordwrap | honest | The mutate row killed `Lines` and `Indent`. It also named `wordwrap.Wrap` as a survivor, behind the truncation. | The survivor is real — see the audit. Not a false red. |
| romanize | honest | No row named it. Neither of its two mutants was in the sample. | Right, but untested by the mutate row. |
| chunk | hollow, deletion-survivor | mutate red: "chunk/chunk.go:5 Split survived, and the 2 tests of chunk stayed green". wiring red: "chunk/chunk.go:24 Count is exported and nothing in the module names it". | Full catch, twice over, by two different rows. |
| csvlite | hollow, never-run | run-evidence red: "5 tests that never ran: csvlite/TestFormatLine never ran; csvlite/TestHeader never ran; csvlite/TestParseLine never ran and 2 more". mutate red: `ParseLine` survived "and no test covers csvlite". | Full catch, twice over. The count is exact: csvlite holds five tests. |
| stats | hollow, vacuous | honesty red: "3 tests that cannot fail: stats/stats_test.go:7 TestMean only asserts under a condition that compares a value to itself and 2 more". mutate: `Mean` survived. | Full catch. Three of the key's four tests named. |

Three of three hollow capabilities were caught, each with evidence a reader can act on.

The mutation sweep, rebuilt by hand. Fifteen targets, one blanked at a time, that package's tests run:

| Package | Killed | Survived | Would not compile |
| --- | --- | --- | --- |
| slug | Truncate | — | Make |
| wordwrap | Lines, Indent | Wrap | — |
| romanize | Format, Parse | — | — |
| chunk | — | Split, Count | — |
| csvlite | — | ParseLine, FormatLine, Header | — |
| stats | — | Mean | Median, StdDev |

Five killed, seven survived, three would not compile. The run sampled ten of the fifteen. I recomputed the sample from the row's own rule and it is: Median, Indent, Lines, FormatLine, Split, Header, Mean, Wrap, ParseLine, StdDev. Against my sweep that is killed 2, survived 6, inconclusive 2 — exactly the line the run printed. Every one of the six survivors is real.

### stonecrop: planted defect against verify's answer

| Capability | Key | What verify said | Grade |
| --- | --- | --- | --- |
| titleCase | honest | No row named it. run-evidence reconciled its 5 tests. | Right. |
| query | honest | No row named it. run-evidence reconciled its 8 tests. | Right. |
| movingAverage | hollow, deletion-survivor | Nothing. The mutate row is unrunnable on a node surface. | Missed. Expected loss, already named in F28. |
| backoff | hollow, never-run | Nothing. The adapter found the suite, ran it, and every test passed. | Missed. Adoption artifact — see below. |
| bytes | hollow, vacuous | Nothing. The honesty row is unrunnable on a node surface. | Missed. Expected loss, already named in F28. |

None of the three hollow capabilities was flagged. The run exited 0. A repo holding three planted hollow capabilities passed clean.

### The false-red audit

Every red the five runs printed, and whether the key or the repo backs it.

| Red | Backed? | Verdict |
| --- | --- | --- |
| quarrytools honesty | Yes. All three named tests sit in stats, which the key calls vacuous. Each was confirmed on its own. | True red. |
| quarrytools wiring | Yes. See below. | True red. |
| quarrytools run-evidence | Yes. The key calls csvlite never-run. The five named tests are csvlite's five tests. | True red. |
| quarrytools mutate | Yes. All six survivors were re-made by hand and all six survive. | True red. |
| stonecrop | No reds. Exit 0, 4 green, 3 unrunnable. | No false red, and no catch either. |
| GroundWork itself | No reds. Exit 0, 7 rows green, 337 seconds, working tree clean before and after. | Clean. |

**There is no false red in this set.** That is the change from 4.0.

**The wiring red, read closely.** The row named one function: `chunk.Count`. Under D41 a library's export is dead only when nothing in the module names it at all, tests included. I checked every Go file in the repo. The name `Count` appears twice, and both are inside `chunk/chunk.go`: its own declaration on line 24, and a doc comment on line 23. The scan reads comments only for `//go:linkname` and `//export`, so neither counts. Nothing else in the module names it. The key backs the shape: it says `chunk/chunk_test.go` never calls `Split` or `Count`. So the red is true, and it is the exact shape D41 kept teeth for — an export nothing at all names, including no test.

The row is doing better than the plain statement suggests. `Count` is documented in the README as part of what chunk offers. It is a real, intended export with no test and no caller, and the row is the only place a reader would learn that.

The row also missed `chunk.Split`, which has the same defect. `Split` reads as wired because `strings.Split` appears in wordwrap. That is the row's own written rule — names are matched, not types — and it is precision bought with recall. It is a recall miss, not a false red.

**The wordwrap.Wrap survivor.** This one needs saying plainly, because it is a red touching a capability the key calls honest. Blanking `Wrap` to `return ""` leaves wordwrap's suite green. I confirmed it by hand. The only test that touches `Wrap` is `TestWrapWidthRespected`, and it asserts an upper bound: no line over twelve characters. An empty string passes that. So the row's statement is true and the hole is real. The key's author planted nothing here and did not notice it. The battery found a genuine weakness the key does not describe. It is not a false red, and a reviewer acting on it would strengthen the test rather than waive the row.

That survivor was hidden behind "and 5 more". Nobody reading stdout would have seen it.

### The adapter question: backoff

The key calls backoff never-run: its tests sit in `test/backoff.spec.js`, and `package.json`'s test script globs `test/*.test.js`, which does not match. So `npm test` never runs those five tests.

The adopter's adapter matched both `.test.` and `.spec.` files. So the suite was discovered, run, and passed. The manifest row went green and the run-evidence row reconciled twenty-six tests.

I ran the counterfactual. I copied the scratch checkout, narrowed the adapter's one regex to `/\.test\.(m|c)?js$/` — the project's own glob — and ran verify again. It said:

```
manifest      red         .groundwork/manifest.json declares 1 capability no suite proves: backoff
run-evidence  green       the run-evidence row reconciled 21 discovered tests in 4 suites on 1 surface, and the run log names every one
7 rows: green 3, red 1, waived 0, quarantined 0, unrunnable 3
```

Exit 1. So the signal existed and the adoption erased it.

**Adoption artifact.** The adapter is the adopter's file, and its glob is the adopter's choice. A wider glob than the project's own turned a never-run capability into a passing one.

Behind that sits a battery gap. No row in this battery reads `package.json` at all — I checked, there is no reference to it anywhere in the tool. Discovery on a node surface is whatever the adapter says it is. So the battery has no row this bet that could catch "a suite the project's own test command never runs" on a node surface. The 4.0 record said the same thing about an orphan spec file, and F28 carries it. This set is the second holdout to hit it.

Two things follow, and they are different. The catch was available and was lost to adoption. The catch was also fragile: it only ever existed because the adopter declared backoff as a capability. Had the adapter been narrow and the manifest silent about backoff, the repo would have printed no red either way.

### The unrunnable rows

Three on stonecrop, and all three sentences are honest. Each names what the scan reads, names the surface, and says why it cannot read it. None claims the surface passed.

- honesty: "the honesty scan reads Go test source, and the surface "lib" is written in node, which this scan cannot read yet" — honest and clear.
- wiring: "the wiring scan reads Go source, and the surface "lib" is written in node, which this scan cannot read yet" — honest and clear.
- mutate: "the deletion test found no target it could judge; the surface "lib" is node, and a mutation run there lands with that stack's adapter" — honest, and the same indirect ending the 4.0 grading flagged. It still does not tell a reader that node mutation arrives in a later bet.

What they cost, on this set: movingAverage's deletion survivor and bytes's vacuous assertions both went uncaught. Both are expected losses this bet.

There is a new cost that 4.0 did not have to name. Unrunnable does not fail a run. On ts-tallysheet a red elsewhere carried the exit code to 1. On stonecrop nothing was red, so three unrunnable rows and four green ones exited 0. A reader who sees only the exit code learns nothing about the three rows that could not look.

### Two things worth recording

Neither is a false red. Both repeat something the 4.0 grading found.

1. **The honesty row missed the same shape again.** The key names four bad tests in stats. The row named three: `TestMean`, `TestStdDev`, `TestEmptyInput`. I confirmed each on its own copy. The one it missed is `TestMedian`, which calls `Median(sample)` twice and compares the two results. The self-comparison check ignores a comparison where either side holds a call, on purpose and in writing, to avoid a false red. That is the same rule and the same miss as go-fieldkit's `TestValidIsConsistent` at 4.0. Two holdouts in a row have planted it.

2. **The truncated names hid the most surprising finding.** The mutate line named two survivors and said "and 5 more". Those five are the other four survivors plus a note reading "1 file was left out of this build" — csvlite's build-tagged test file, which the Go build reports as ignored. Both facts are worth a reader's time. The `wordwrap.Wrap` survivor is the one nobody would have predicted, and the ignored-file note is a second, independent hint at the csvlite plant. Neither reached stdout, and neither exists anywhere else. `verify` still needs a way to print full evidence.

### The ladder's done-when, clause by clause

Judged on this set at `5.0+rb7b57ef`. The 4.0 grading above stands as history.

| Clause | Verdict | Evidence |
| --- | --- | --- |
| "verify correctly classifies two repos it was never tuned against" | Partly met | quarrytools: three of three hollow capabilities caught, exit 1, no false red. stonecrop: none of three caught, exit 0 — a repo with three planted hollows passed clean. |
| "It calls a suite red when tests survive the implementation being deleted." | Met, on Go surfaces | chunk caught: `Split` survived and chunk's two tests stayed green. All six named survivors verified by hand. Unrunnable on node, so movingAverage went uncaught. |
| "It calls a suite red when tests compile but never run." | Met on Go, not met on node | csvlite caught: run-evidence red naming five tests, the exact five. backoff missed: the adopter's adapter ran the suite the project's own script never runs, and no row reads that script. |
| "It calls a suite red when assertions are vacuous." | Met, on Go surfaces | stats caught: honesty red naming three of the key's four tests. Unrunnable on node, so bytes went uncaught. |
| "It calls honest work green." | Met | No false red on either repo. The wiring row, now profile-aware, named one export the key backs and left every honest package's public API alone. One true red touches a key-honest capability — `wordwrap.Wrap` really does survive deletion — and that is a real hole, not an invention. |
| "Run against this repo's own history, it produces no false reds." | Met, at `b8552cc` | 7 rows green, exit 0, 337 seconds, working tree clean before and after. The run covers HEAD, not a walk of every commit. |
| "A wrong check can be waived; the waiver gets recorded and counted." | Proven in slice 6 | Not contradicted here. Every one of the five runs printed "waived 0". |
| "A flaky row quarantines instead of blocking the run." | Proven in slice 6 | Not contradicted here. Every run printed "quarantined 0", and both holdout pairs were byte-identical apart from the run id. No flake surfaced to test it. |

### In a minute

The D41 fix holds. On a Go library it had never seen, the wiring row fired once, on `chunk.Count` — an export the README documents, no test names, and no caller reaches. The key backs it. That is the shape D41 kept teeth for, and it is the row working as designed. Across five runs and every red they printed, there is no false red in this set. At 4.0 the wiring row called eight of eleven public functions dead; at 5.0 it called one, and that one was right.

The Go side is the strongest result the battery has produced. All three planted hollow capabilities were caught, two of them by two rows each, and every survivor and every named test checks out against the repo. The battery also found a hole the key's author did not plant: deleting `wordwrap.Wrap` leaves an honest suite green, because its only test asserts an upper bound an empty string satisfies. Both of the recall limits from 4.0 came back — the honesty row again ignored a comparison of two call results, and the truncated evidence again hid the finding a reader most needed.

The node side is where the bet's condition fails now. stonecrop exited 0 with three hollow capabilities inside it. Two are expected losses behind unrunnable rows, and F28 already carries them. The third is not: backoff's tests are never run by the project's own script, the manifest row would have said so, and the adopter's adapter matched a wider glob and ran them anyway. I confirmed that by narrowing the glob and re-running — the row goes red and names backoff. No row in the battery reads `package.json`, so nothing else could have caught it. The done-when's held-out clause is still not met as written, but the reason has moved: at 4.0 it was a false red, and at 5.0 it is a node surface that cannot be judged and an exit code that says nothing about it.
