# Blind review — bet 2, slice 5: the deletion test

Reviewed the uncommitted diff on top of 8ac78d4. Every probe ran in `/tmp/review-s5`. Baselines: `go test ./...` exit 0, `go vet ./...` clean, and `GROUNDWORK_SESSION=review /tmp/gw verify` on a clean copy of this repo prints 7 rows, all green, at `4.0+rb7b57ef`.

## Verdict: bounce

Three reasons, each reproduced.

1. Two ordinary Go layouts make the row print a red that cannot be true. One of them is a layout this repo already uses.
2. When the row runs out of its clock it goes green on a partial run, and it blames the project for its own timeout.
3. The row's headline safety claim — mutations never touch the working tree — has no test that can fail. I removed the isolation entirely and the whole suite stayed green.

These are the classes that bounced slice 2: false red, green-but-wrong, and a claim with no probe behind it. A patch list will not close them; how a mutant gets classified needs reworking.

## HIGH

### H1 — A file the build excludes is always a false red

Probe: `/tmp/review-s5/f2`. One covered package plus `alpha/alpha_windows.go` holding an exported `WindowsOnly`. That file is not compiled on this machine, so no test can notice its deletion. The row ran:

```
mutate  red  the deletion test found 1 surviving mutant: alpha/alpha_windows.go:4 WindowsOnly
             survived, and the 1 test of alpha stayed green; killed 1, sampled 2 of 2 targets
```

`targetsOf` (internal/battery/mutaterow.go:330) walks every `.go` file and hands it to `Mutants`, which parses with `go/parser` and never asks the build whether the file is in the package. D26 rules that a mutant which fails to compile is inconclusive. A mutant that was never compiled at all is the same fact, harder. The row calls it a survivor.

This repo ships `internal/adapter/exec_unix.go` and `internal/adapter/exec_other.go`, the same shape. Their functions are unexported today, so nothing fires. The first exported symbol in a platform file turns this repo red. Nothing in `mutaterow_test.go` covers a build-constrained file.

### H2 — A `_`-prefixed directory is always a false red

Probe: `/tmp/review-s5/f3`, `_scratch/scratch.go` with an exported `Draft`.

```
mutate  red  the deletion test found 1 surviving mutant: the first is in _scratch/scratch.go
```

The go tool leaves `_`-prefixed directories out of `./...`, and the adapter's own `Discover` skips them for exactly that reason (internal/adapter/goadapter.go:87, with a comment saying why). `targetsOf` uses the battery's `skipDir` instead (internal/battery/scan.go:133), which skips dot-directories, `testdata`, `vendor` and `node_modules` — not `_`. Named explicitly, `go test ./_scratch` does run and reports "no test files", so the baseline is `uncovered` and the row prints its loudest red. Two walkers in one repo disagree about what a package is.

### H3 — Isolation from the working tree is unproven

Probe (mutation): in `checkMutate`, hand `judge` the real surface root instead of the copy. The copy is still made and still removed, so the crash test is unaffected. Every mutant is now written into the developer's own source. `go test ./... -count=1` exits 0 — the whole suite is green.

`TestMutateRowNeverWritesInTheWorkingTree` reads the tree only after the run, and `judgeOne` restores each file with a deferred write, so the test cannot tell isolation from damage-then-repair. The property the file header calls its first rule has no failing test behind it.

Two neighbouring claims fail the same way; both survive `go test ./...`:

- Letting `copyTree` follow symlinked files (replace the `!d.Type().IsRegular()` guard with a directory check). The committed symlink test proves `targetsOf` does not mutate through a link; nothing proves the copy refuses one.
- Letting `copyTree` keep the project's `.git`.

Why it matters: a `kill -9` on a stuck verify, an OOM kill, or a crash between the write and the restore leaves the developer's source blanked. Today the code is right. Nothing keeps it right.

### H4 — Running out of the clock is a silent partial green, and the project gets the blame

Probe: eight packages, each test sleeping 1.5s, run through the real row at `Budget: 8s, PerMutant: 20s`, with the tally printed from inside `result()`:

```
TALLY pool=8 sampled=8 killed=2 survivors=0 uncompiled=0 unfinished=0 outOfTime=1
      unusable=[c (its own tests do not run)]
outcome=green
evidence=the deletion test killed every one of 2 mutants it judged: sampled 8 of 8 targets at
         unknown; the row ran out of its budget; nothing could be proven in c (its own tests do
         not run)
```

Three defects in one line.

- **Green on a run that fell over.** Two of eight judged, five abandoned. The code's own comment quotes the slice 4 precedent — "unrunnable, never a partial red" — and `checkMutate` does return unrunnable when the clock dies *before* the first target. After one kill, the same cause gives green.
- **The project is blamed for the row's timeout.** `measure` (mutaterow.go:645) maps any error to "its own tests do not run". Package `c`'s tests are fine; the row's context died mid-run. That sentence goes into the journal as a statement about the project's suite.
- **The five abandoned mutants are counted nowhere.** `outOfTime` counts loop bail-outs, one per surface, not mutants, so `sampled 8` reconciles against nothing.

The budget check itself is unproven: replacing the `ctx.Err()` guard in `judge` with `_ = ctx` leaves `go test ./...` green.

### H5 — The throwaway copy is not faithful, so packages are excluded and falsely blamed

`copyTree` drops the project's `.git` and runs `git init` on an empty repository. Any test that asks git about the project's own files then fails. Probe — rebuild the copy by hand, run under the guard:

```
$ GROUNDWORK_BATTERY=1 go test -count=1 ./internal/manifest
--- FAIL: TestTheManifestIsCommitted
    git does not track .groundwork/manifest.json
```

So on this repo `internal/manifest` is permanently reported as "its own tests do not pass unmutated" and excluded from mutation. The claim is false: the package's tests pass in the project.

A full instrumented row run against this repo reported two such packages:

```
TALLY pool=61 sampled=10 killed=5 uncompiled=3
      unusable=[internal/battery (its own tests do not pass unmutated)
                internal/manifest (its own tests do not pass unmutated)]
```

`internal/battery` is the package this row lives in. On this repo the deletion test cannot judge itself, and the record says the reason is the project's own tests.

## MED

### M1 — The record keeps a line cut before the accounting

Evidence is capped at 200 bytes by `cut`. Three probes, three losses:

- `/tmp/review-s5/f3` (one survivor, one unusable package): the red reduces to `the deletion test found 1 surviving mutant: the first is in _scratch/scratch.go`. Symbol, kill count, sample sentence and inconclusive counts all gone — `hitEvidence`'s fallback drops the tail entirely.
- `/tmp/review-s5/f10`, a plain Go + node manifest with **one** target: cut mid-word. The out-of-process sentence alone is 118 bytes.
- This repo's own green run: `... nothing could be proven in inter...`. The reader cannot see which package — the one number needed to reconcile the sample.

Three comments claim the opposite. `result()`: "The line stays short enough that one whole survivor fits inside the journal's cap beside it." `sampledAt()`: "the sentence every outcome carries." Neither holds.

### M2 — The arithmetic: reconcilable in principle, not from the line the record keeps

From the instrumented run: sampled 10 = killed 5 + uncompiled 3 + 2 targets sitting inside unusable packages. The classes do add up. But a reader cannot check it.

- `unusable` is appended once per target and printed as package names, so the count is recoverable only by counting repeats. `/tmp/review-s5/f4`, one already-red package with four targets: `nothing could be proven in sick (...); sick (...); sick (...) and 1 more`.
- The line is cut before the last class (M1).
- Two classes are not counted at all: mutants abandoned on budget exhaustion (H4), and a whole package excluded on a false premise (H5).

The fix is one number: how many of the sample were not judged, printed beside the classes.

### M3 — There is no floor on how much of a sample must be judged

Green needs one kill and no survivors, whatever happened to the rest.

- `/tmp/review-s5/f4`: green on 1 of 5 judged.
- `/tmp/review-s5/f11`: a package written so that blanking its one exported function leaves an unused import. Every mutant is inconclusive, the row is unrunnable, and `verify` exits **0**. Only red fails a run.

The header says the row will "excuse anything… there is no exclusion list and no waiver here". The inconclusive classes are an exclusion list nobody has to declare, and D24's waiver machinery — one committed file, an expiry, a journal line — is what it routes around. D17's letter is kept (judged zero gives unrunnable); its purpose is not.

### M4 — This slice's own new code is a survivor, waiting for the sample to rotate

Probe: blank `(*Go).RunPackage` in internal/adapter/goadapter.go, then `go test ./internal/adapter` → `ok`. `internal/adapter/adapter_test.go` and `internal/adapter/conformance.go` name neither `RunPackage` nor `ErrBuildFailed` (grep count 0 in both).

The row is package-scoped, so `RunPackage`'s only coverage — the battery package's tests — does not count. At `4.0+rb7b57ef` the sample happens not to pick it. The next version bump rotates the sample and this repo goes red on the function this slice added. The brief's rule is that a real survivor on this repo means fixing the test gap. One gap was fixed (the journal vocabularies); the one this slice created was not.

### M5 — Six of nineteen mutations survive the whole suite

Beyond H3 and H4, each of these leaves `go test ./...` green:

| Mutation | What is unproven |
|---|---|
| Delete `inOwnGroup`, `cmd.Cancel`, `cmd.WaitDelay` from `(*Go).run` | the process-group kill this slice added to the path **every** row's run goes through |
| Replace the per-mutant `WithTimeout` with `WithCancel` | `PerMutant`; the hang test is bounded by the row budget instead (61s instead of 6s) |
| Drop `insideProject` from `RunPackage` | the refusal of a suite path that climbs out of the project |
| Drop the `ctx.Err()` check in `judge` | the budget check between mutants |
| Let `copyTree` follow symlinks | the copy's symlink rule |
| Let `copyTree` keep `.git` | the copy's git rule |

The pattern: everything new in `internal/adapter` shipped with no test in `internal/adapter`. Tests-first would have caught that.

### M6 — The copy-failure path leaks an absolute machine path and fills the line

Probe: point `TMPDIR` at a regular file.

```
outcome=unrunnable len=200
evidence=the deletion test could not finish on the surface "cli": a throwaway copy could not be
         made to mutate: mkdir /tmp/TestProbeCopyFailureEvidence1740240788/002/not-a-directory/
         groundwork-mutate-278690...
```

Every other error path in this row goes through `scanned.reason`, which strips the repo root and caps at 70 bytes. `inWorktree` formats the raw error with `%v`. `TestMutateEvidenceNeverCarriesAMachinePath` only exercises the survivor path. Real triggers: a file that vanishes mid-copy, a file the user cannot read, a full disk. Any of them also aborts the whole row, where the scans count an unreadable file and carry on.

### M7 — The ledger was not written

docs/findings.md had not changed since 87edf11, two slices back. The row's first catch on this repo — `Roles`, `Tiers` and `SealActions` with no assertion anywhere behind them — is exactly F17's shape, which was recorded. This one was fixed inside the slice commit and recorded nowhere. There was also no docs/evidence/bet-2/slice-5/. [Driver note: F18 and F19 now record both; this archive lands with the rework.]

## LOW

- **L1 Register.** internal/battery/mutaterow.go is 841 lines with a 62-line header — the most prose in the package (comment lines: mutate 210, honesty 158, run-evidence 120, scan 104). Sentences run to 229 characters across three clauses. The working agreement asks for one idea per sentence.
- **L2 Claims the code does not hold.** "A mutation run that fell over is unrunnable, never a partial red" (H4 shows a partial green). "The copy carries no git history, so a mutation run cannot reach the project's own record" — a copied `.git` is a copy, so the stated reason is not the real one, and see H5 for what dropping it costs. "Five outcomes per mutant" — the tally carries six inconclusive counters, one of them (`unread`) named in neither the header nor D26. "This repo alone would spend a quarter of an hour on it" — unmeasured.
- **L3 Wrong word.** `t.unread` counts both a failed read and a failed write, and prints as "mutant could not be written".
- **L4 Duplicate listing.** `unusable` should carry a count per package, not one entry per target (`/tmp/review-s5/f4`).
- **L5 Wrong class.** A package excluded by a build tag (`//go:build tools`) reads as "its own tests do not run" rather than as a package this platform does not build (`/tmp/review-s5/f3`).

## What held up

Things the review tried that failed to break the slice.

- **Nested modules.** A directory with its own `go.mod` is skipped, so no target and no false red (`/tmp/review-s5/f8`).
- **A surface rooted in a subdirectory** with its own `go.mod`: green (`/tmp/review-s5/f12`).
- **Dirty-tree semantics are right.** The copy is of the working tree, not of HEAD. An uncommitted break gives an honest unrunnable; an untracked new package is judged (`/tmp/review-s5/f6`). That is the right answer for a pre-commit gate.
- **Symlinks in `targetsOf`.** The row does not mutate through a linked source file, and the file behind the link is untouched. Removing that gate turns the committed test red.
- **Thirteen of nineteen mutations were caught**, several by exactly the test named for them: survivor detection, the D26 build-failure class, the sampling hash's dependence on the version, the D17 judged-zero guard, the identical-mutant refusal, the Unicode `exported` rule, the already-red baseline, the recursion guard, the uncovered survivor, the package-scoped run, the `openFile` gate, `ErrBuildFailed`'s wrapping, and the worktree cleanup.
- **The version and digest are right.** 3.0 → 4.0 for an added row is D23. `.groundwork-battery.json` matches `Default().Digest()`, and both committed tests that pin it pass.
- **The journal fix is a real fix, not a weakened test.** `Roles`, `Tiers` and `SealActions` had no assertion anywhere before it. The new test also proves each accessor hands back a copy.
- **The out-of-process refusal** and **the recursion guard** both hold, and the seam still sets the guard on every child run.

## Probes

All under `/tmp/review-s5`. `mk.sh <name>` builds a fixture repo (git, manifest, lock file, go.mod). `matrix.py` and `m17.py` drive the mutation matrix against a scratch copy.

| Path | What it is |
|---|---|
| `f2` | build-constrained file (H1) |
| `f3` | `_`-prefixed directory and a build-tagged package (H2, M1, L5) |
| `f4` | already-red package, duplicate listing, partial green (M2, M3) |
| `f6` | dirty tree, untracked package |
| `f8` | nested module |
| `f10` | Go + node manifest (M1) |
| `f11` | every mutant inconclusive, exit 0 (M3) |
| `f12` | surface rooted in a subdirectory |
| `gwprobe`, `gwm20`, `gwclean`, `mimic` | scratch copies for mutation and instrumented runs |
| `realrun.log`, `clean.log`, `m20.log`, `fulltest.log` | run logs |
