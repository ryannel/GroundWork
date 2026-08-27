# Slice 8 — closure

Two rounds closed this slice after the blind review. The closure re-check judged the first fix round; a second fix round answered what it found; the driver verified the final pin in memory and recorded D68. The reports, verbatim.

## The closure re-check

A fresh dispatch over the diff afceeae..53ab4dd, asked to verify the fix round answered the review and to attack D67.1's determinism argument.

---

I re-ran the evidence myself and probed the test. Here is the record.

## Verification I performed

- Re-materialized both fixtures from scratch per runs.md's recipe, built the binary fresh (reports `12.0+ra48a79a`).
- Re-ran **six** of the thirteen recorded walk lines: sift `035d288`, sift `af14585`, gauge `e19b22c`, `c79da6a`, `863e12f`, `8fc8572`. All six match the record character for character, apart from the `run:` clock. Also reproduced the graded sift board at a re-made adoption commit: identical but for the commit hash and clock.
- `go test -p 1 ./internal/battery -run TestProof_b3s8` green. `go test -p 1 ./...` green. `groundwork verify` in a clone: 16 rows, green 15, unrunnable 1 (waiver-count, shallow) — matches the commit's claim.
- Ledgers: `git diff afceeae..53ab4dd` shows zero removed lines in findings.md and decisions.md. Both hunks are pure appends at end of file. Nothing was edited or dropped.
- Confirmed `ANSWER-KEY.json` is absent from both walk trees.

## Per defect

**1 — two clauses never asked. Answered with a gap.** The supplement exists in both pages, F123 is filed, and the walks are real. The gap: `docs/ladder.md:55` ends with a fifth sentence, "No file gets edited just to move the board." That sentence appears nowhere in holdout.md or runs.md. F123's own forward rule says a grading names every clause it did not ask. The record calls the done-when "four clauses" and never says whether the fifth is a clause it skipped or the tuning rule it already covered.

**2 — the graver fault. Answered fully.** F124 is filed with the right evidence. I confirmed the mechanism independently: `863e12f` carries `Slice: s_format` on the red-proof commit. At `af14585` and `863e12f` the board really prints `behind its plan`, counts `1 behind`, and exits 1. D67.2 puts the real worst case in front of the deferred ruling.

**3 — ladder versus contract. Answered fully.** F125 files both halves, and the ruling is deferred to the bet-3 close audit. I checked the second half: `b3s8.md` front matter does say "three slices land in sequence", and sift has four slices, gauge five.

**4 — the invisible facing id. Answered fully.** F127 is filed, open, and names D61.2 as the ruling it is residue of.

**5 — the score line. Answered fully.** The correction is appended in holdout.md, the original sentence is preserved word for word, and F126 is filed.

**6 — the hollow proof. Answered with two gaps.** The four new assertions all bite. I probed each in a clone: blanking a fixture name, the battery version, or the supplement heading fails the test, as does cutting the fence count below four, as does gutting the file. None is decoration.

The first gap is real and I proved it. `gradedRuns = 4`, but the page now holds 17 captured blocks. I deleted the entire supplemental walk body — all thirteen run captures, F123's whole recovery and F124's evidence — kept only the heading, and the test stayed green. So the supplement is pinned by one heading string, not by its contents.

The second gap is the known deviation, and the refusal is honest. I reproduced it: adding `runs.md` to the records list moves `b3s8.md`'s blob and `seal verify` goes to "1 moved, 1 problem", exit 1. The block is recorded four times over — F131, F128's "What happened", D67.6, the commit message, and the builder's own report. Nothing is hidden.

**7 — the singleness over-claim. Answered fully.** The pre-check sentence is appended in holdout.md, F129 is filed, and D67.5 carries the forward rule.

**8 — catcher attribution. Answered fully.** F130 is filed, no existing entry is touched, and D67.4 sets the forward rule. Small blemish: F130 says the rule "goes in a decision" and names no id, so nothing links it forward to D67.4.

## Attacking D67.1

The load-bearing part holds. The board reads plan files, git and `go test`. No key sits in either walk tree, and I reproduced six walk lines and one graded tip exactly. The walk set was fixed before the first command — every commit, oldest first — so a key-aware grader could not pick favourable commits. That is the right defence and the record states it.

Three overstatements.

- "It decides nothing" is too strong. The supplement does decide: "Clause 2 — met, with one fault under it", "Clause 3 — cannot be met, by design". Those are grades, made after the keys opened. The honest claim is narrower: the runs decide nothing, and each reading is re-derivable from the printed output. It happens to be true here — F124's verdict rests on the board contradicting its own failing proofs, not on the key.
- Both keys list `landing_commits` per slice. That is exactly the fact F124 turns on, and the grader knew it before walking. The record never names that overlap, so it never says why the verdict survives it.
- The determinism check ran at the two tips only. The walk commits have no pre-key control run, so determinism there is inferred from construction, not measured. The inference is sound, but the record presents the tip reproduction as if it covered the walk.

## New defects the fix round introduced

1. `runs.md` says "Only documentation has changed on this branch since `fa65ea1`." False — `internal/battery/holdoutgrading_test.go` changed too. The conclusion survives, because `go build` ignores `_test.go` files and I confirmed the binary reports the same version and prints an identical board. But the sentence supporting the honesty argument is wrong as written.
2. The proof test's `gradedRuns = 4` threshold, against 17 blocks present, leaves the supplemental walk unpinned. Proven by probe above. This is the same hole F128 was filed to close, one section over.
3. F131 is filed between F128 and F129 in findings.md, out of numeric order. Nothing pre-existing was moved, but a reader counting by number will trip.

## Two things for the driver

- Under CLAUDE.md line 63, slice 8 cannot close while F131 is open, and F131 needs an owner decision. The record never states that consequence.
- A commit landed on the branch while I was checking: `8392808`, "evidence: the slice 8 archive, review and reports". HEAD is no longer `53ab4dd`. It adds `blind-review.md` and `builder-reports.md`, both outside the diff I was asked to judge. I read the review archive: its eight findings match the eight in my brief exactly, and its finding 2 confirms the reviewer did re-run `board` at the skipped commits, so F124's "what caught it" line is accurate.

I changed nothing in the repo. All probing happened in throwaway clones under the scratchpad.

---

## The second fix round

Dispatched with the re-check's defects and the driver's calls. Landed e6fad3b.

---

## What was fixed

**(a) The done-when's fifth sentence — F133.** `docs/evidence/bet-3/holdout.md` gains a section, "The done-when's fifth sentence", at the end of the supplement. It says the done-when runs to five sentences, four were graded as clauses, and the fifth — "No file gets edited just to move the board" — is a rule about conduct that the whole exercise ran under. It names the conduct: no file edited to move a row, translation fixes ended at the first graded output, the supplement changed no input. One mirrored passage went into `docs/evidence/bet-3/slice-8/runs.md` beside where that page counts "four questions". (I corrected one pointer while writing it: the translation-fix rule F129 landed lives in holdout.md's grading record, not runs.md's "Translation notes", so the sentence points at both correctly.)

**(b) The supplement pinned — F134.** `internal/battery/holdoutgrading_test.go` now reads the supplement's own section body via `sectionAfter`, not the whole page. Two new assertions, no existing one touched: at least 13 captured run blocks under `## The supplemental runs`, and both false-red commits `af14585` and `863e12f` named there. New constants `supplementRuns = 13` and `falseRedCommits`.

**(c) The false sentence — F135.** runs.md now reads: since `fa65ea1` the branch has changed only documentation and one `_test.go` file, `go build` ignores those, so no compiled byte moved and the binary reports the same version.

**(d)/(overstatements)** Record-only, filed.

## Findings filed — F133 through F137

Appended to `docs/findings.md`, matching the tail's shape. Classes: F133 record-not-written, F134 front-door-hollow, F135 record-not-written, F136 other (append that broke numeric order), F137 other (ruling claiming more than its evidence measured). All five carry `Caught by: blind-review — the slice 8 closure re-check`. **F130's one-way link** is recorded inside F133's text: D67.4 names F130, F130 names no decision, so a reader coming from the ledger cannot reach the ruling.

## Probe outputs (in-memory, never git on an uncommitted file)

Original `runs.md` sha256 `e09bcbed…9e64a2`, 57100 bytes, held in memory and restored after each probe; hash verified back each time.

- **Walk deleted, heading kept** (the re-check's own mutation) — exit 1: `holds 0 captured runs under "## The supplemental runs", and the walk is 13 commits`, plus both commit assertions fired. Restored, hash matched.
- **False-red commits scrubbed from the supplement only** — exit 1: both `never names af14585 / 863e12f …` errors. Restored, hash matched.
- **One capture of thirteen removed** (threshold bites, not just total deletion) — exit 1: `holds 12 captured runs …, and the walk is 13 commits`. Restored, hash matched.
- **Baseline on real files** — exit 0.

## Landing checks

- `go test -p 1 ./internal/battery -run TestProof_b3s8` — ok.
- `go test -p 1 ./...` — all packages ok (serial; battery 88s).
- Binary built from this tree, `verify`: battery `12.0+ra48a79a`, **16 rows: green 15, red 0, waived 0, quarantined 0, unrunnable 1** (`waiver-count` unrunnable, shallow clone — the known state). Re-run after the commit: still green 15 / unrunnable 1; the board row's unread-trailer count went 1 → 2 as expected for a post-landing commit carrying `Slice: b3s8`, which is the D67/F132 behaviour and stays green.

---

## The driver's final verification

After e6fad3b and D68 (655d7c7): the focused proof test ran green on the real files. One independent in-memory probe gutted every fenced capture under "## The supplemental runs" and the test failed at `holds 0 captured runs under "## The supplemental runs", and the walk is 13 commits`; the file restored hash-true. D68 narrows D67.1 per F137, places the fifth sentence per F133, and sets the numeric-order rule per F136.

## What stays open at closure

- F131 — the owed record behind the seal. The owner decides: amend seal/design/bet_3, or leave runs.md pinned by the proof test alone. The slice's close is held open on this one finding.
- F125 — ladder versus contract on the landing unit. Ruled at the bet-3 close audit.
- F119, F124, F127 — checks-side fixes, clustered per D66 into one future slice at the next battery major with fresh fixtures.
