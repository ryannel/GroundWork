# Builder reports

## The build


Slice 3 of bet 3 is built in the working tree, uncommitted, ready for blind review.

## What was built

**`internal/seal/`** — a seal is an annotated tag `seal/<kind>/<subject-id>` whose message names every path it covers with that path's blob hash at the sealed commit, plus `Battery:`/`Battery-Run:` trailers. Strict parse, four closed kinds. `Verify` recomputes each hash at HEAD and names every path that moved or went missing. The mirror on branch `groundwork-seals` stores each tag's raw bytes, and `Restore` hands them back to `git hash-object -t tag -w` so the object id comes back identical.

**`cmd/groundwork/seal`** — `grant`, `verify`, `restore`, `amend`. The tool holds no signing key: it only verifies against the committed `.groundwork/allowed-signers`, which ships shaped and empty of keys.

**`internal/battery/sealrow.go`** — the tenth row, kind `seal-verify`, blocking. Green on a repo with no seal (the plan row's D45 precedent). Red on a moved path, an unreadable tag, or a battery trailer that disagrees with its own journal line. Unsigned is on every line and never red this bet.

**Journal** — the seal line gains `battery`, `battery_run` (D28's named deferral) and `reason`, all `omitempty`; plus `Seals` and `LatestBattery` readers.

## Red / green split

Red at 237e45a, verified: eight new test files (four packages fail to build), plus three cmd row-count pins and the battery row-list pin, each run with the new files moved aside so the failure was the pin and not the build.

Green list — survivor pins, no edit needed: the row-kind vocabulary pin already held `seal-verify` from D28's forward-naming (the brief expected it to move; it does not), `journal/kinds.go` already held `seal`, and `TestWriteSealWritesEveryField` passes either way — which is what proves the journal widening is additive.

## Blank the rule

48 rules, **48 killed, 0 survived, 0 did-not-build, 0 that can never fail**. Five survived on the first passes and each was a real gap: the `seal: ` prefix (a bare `design b3s3` parsed), a trailer's own name (a bare version string parsed as one), the three `printable` guards (`%q` was doing the work, D50.1's exact warning — each now has a direct test), the mirror's tag-name check, and two duplicate guards which I deleted rather than tested.

## Verify

`10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0` at `8.0+rb43026c`. The digest came from the tool's own drift error. The first run at 8.0 went red: the rotated sample found `NewGo` surviving in `internal/adapter`; fixed by one pin in that package. The run's 33 journal lines under session `b3s3` chain.

## Left open

- Candidate decisions in the handoff: four signature states rather than three (`unverified` kept apart from `unsigned`), a seal granted only on a green battery run read from the journal, the `reason` field, the tight covered-path charset, the green-on-no-seal verdict, and the never-overwrite restore.
- Candidate finding, class `host-limit`: this container has no `ssh-keygen`, so no SSH signature can be made or checked here. The byte-for-byte proof plants a tag object carrying a signature block instead, and the `Verified` branch of `checkSignature` has no test in this repo. Named, not hidden.
- Candidate finding, class other: ~5,100 new lines is a lot for one sitting, and the slice could have been cut three ways.

Handoff: `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s3.md`. I did not touch `docs/findings.md` or `docs/decisions.md`.
---

## Fix round 1


Fix round closed. Working tree only, uncommitted, ready for the re-check.

## What changed, per item

1. **F59/D52.1+2.** `mirrorTags` skips a bad file and reports it in a new `Restoration.Ignored`; the name check still bites where it matters, so no ref is ever written for one. The grant is atomic — `undoTag` takes the tag down when the mirror or the journal fails — and it calls `checkMirrorIsClean` *before* making the tag, so a junked mirror leaves nothing behind at all. Reader permissive, writer strict; the reasoning and its cost are a candidate decision in the handoff.
2. **F60/D52.3.** `Report.Unsigned` and `Report.Unverified` are separate counts and `NoAuthority()` is a method, so no field holds the blurred number. Row line and CLI summary both print the two apart.
3. **F60/D52.5.** `whyNotVerified` reads git's own words and names which of three situations, with a fourth branch that passes git's first line on. `signerFrom` learns git's SSH wording beside the GPG line, host limit named.
4. **F61/D52.4.** Both counts moved into the head; the problem takes exactly what the line has left. No line can drop a count. The widest-line test searches the count space at four problem lengths and finds 200 bytes exactly.
5. **F63.** Restore compares the `tag` header in the bytes to the file name before writing a ref; the index-present question is asked of the tree instead of an exit code; the index-versus-bytes check has a test; the R4 headline proof walks all three not-verified branches and pins which ran; the dead condition and the wrong `--cleanup` claim are gone.
6. **F64/D52.7.** Charset tightened to the page, refusal rewritten to be read once, page gained the `Battery-Run:` shape and the name-versus-message red.
7. **F65/D52.8.** `signature` and `signer` on the seal line, omitempty, written by grant and both amendment lines; a signer with no signature state is refused. Verification reads the signers file from HEAD via `openSigners`.
8. **F66/D52.9.** All seven smalls, including the zero-green-run refusal, the non-seal-name refusal in the verb, the newest-line-of-either-action cross-check, `short()` through printable, and amend printing the paths that differ.

**F62** confirmed and acted on: this host signs and cannot verify, so the fixtures moved to real `git tag -s` tags and the planted signature block is gone.

## Blanking table

75 rules — **75 killed, 0 survived, 0 did-not-build, 0 can-never-fail left looking proven.** Two genuine survivors on the first pass, both fixed not explained: the covers-list blank-line guard was a duplicate of `trailerAt` and was deleted; the grant's journal-step rollback had no fixture and now has one. Seven rows came back did-not-build or did-not-apply — every one a fault in my own mutation string — each rewritten and re-run to killed. Four can-never-fail guards (three `printable` calls, plus the `Verified` branch and `signerFrom`'s SSH half) carry direct tests or an honest comment saying no run here reaches them.

## Verify

`scratchpad/verify-b3s3-fix.txt`, one run at the end: `battery 8.0+rb43026c`, ending `10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0`. Digest unchanged — no row identity moved. 778 tests, 67 exported functions, mutate killed every mutant it judged.

## Red/green split

No new test file; every fix-round test joins an existing one, each run red before its fix. The full list is in the handoff. Only the two CLI summary strings moved as pins rather than new tests.

One process note for the record: my wait loop was `until ! pgrep -f "/tmp/gw verify"`, and the waiter's own command line contains that string, so it matched itself and never woke. The run had finished; only the wake was lost.

`gofmt -l` clean, `go vet ./...` clean, `go test ./...` green on ten packages. Handoff: `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s3.md`. No ledger files touched.
---

## Fix round 2


Second fix round done. Working tree only, uncommitted.

## What changed

**1. F67 — the rollback undoes both writes.** `GrantSeal` reads the mirror branch tip before anything writes to it, and reads back the tip the mirror wrote. `grantUndo` carries the tag, its object id, and both branch values; `run` puts the branch back to what it held — or deletes it when this grant created it — and then deletes the tag. Every `update-ref` is handed the old value, so a rollback can only undo this grant's own writes. `undoTag` is gone. The unclosable crash window is named beside the D52.2 comment, with what to do after one.

The reviewer's probe passes: grant with a session id the journal refuses → tag gone, branch gone, and `Restore` produces nothing.

**2. F68 — a revoked seal is a problem.** One branch in `checkBattery`, before any battery pair is compared: a newest seal line whose action is not `granted` is a problem naming the tag and the action.

**3. F69 — the page, the pin, the smalls.** §2.4's table gained `signature` and `signer`, "three more fields" became five, the `reason` row now says both amendment lines carry it. The HEAD-not-worktree proof stages its planted file with `git add`. `checkMirrorIsClean` runs in `AmendSeal` too — an amendment writes to the mirror exactly as a grant does, and the guard's own comment already claimed it. `signerFrom`'s long sentence is three short ones.

I went past the ask on the pin: it now reads §2.4's table rows rather than searching the section, because my first version survived a mutation that gutted a table cell — a prose sentence below still spelled the field.

**Not in scope, not claimed:** amend has no rollback of its own. Its wreck is smaller (the prior tag is filed under `prior/`) but it is the same class, and it is yours to schedule.

## Blanking

8 new rules, **8 killed, 0 survived, 0 did-not-build, 0 can-never-fail**. Two survived first and both were real: the mirror old-value rule (my first test fed it object ids that do not exist, so update-ref refused either way — rewritten with real commits, it kills), and the contract pin above. N13b (`HEAD:` → `:`) is killed.

## Verify

`scratchpad/verify-b3s3-fix2.txt`: `battery 8.0+rb43026c`, ending `10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0`. Digest unmoved. 783 tests, 67 exported functions.

## One thing gates the landing, and it is not mine to fix

`go test ./...` is **red**, on one test in one package:

```
--- FAIL: TestRecurPassesOnTheRealLedger
    front-door-hollow: has 3 findings, at or over the threshold of 3, and no decision heading is named from it
    parallel-definition: has 3 findings, at or over the threshold of 3, and no decision heading is named from it
```

F67 put `front-door-hollow` at three and F69 put `parallel-definition` at three. D10 wants an upstream decision heading naming a class that reaches the threshold, and `docs/decisions.md` has none for either. With my whole tree stashed at f4eecd9 the same test fails identically, so it is the review commit and not this round. It needs a ledger edit, which I do not make.

Worth knowing: the battery went green anyway. The mutate row never sampled `internal/findings`, and the run-evidence row reconciles which tests ran rather than whether they passed — so no row can see this failure. That gap is the run-evidence row's, not this slice's, but it is on the record now.

`gofmt -l` clean, `go vet ./...` clean. Handoff: `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s3.md`.