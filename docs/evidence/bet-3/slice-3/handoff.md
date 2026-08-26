# Handoff — bet 3, slice 3 (seals)

Builder session. Working tree only; no commits. Base: 237e45a.

## Status

- [x] Read CLAUDE.md and docs/plan/rebuild/bet_3/b3s3.md
- [x] Survey existing code (battery rows, journal kinds, cmd verbs)
- [x] Write red tests
- [x] Run red at 237e45a, record
- [x] Build source
- [x] Blank-the-rule table: 48 rules, 48 killed, 0 survived
- [x] gofmt clean, go vet clean, go test ./... green on ten packages
- [x] Full verify run: 10 rows, green 10, at 8.0+rb43026c

## What landed

New:

- `internal/seal/` — seal.go (names, kinds, message render and parse), git.go,
  mirror.go, grant.go, amend.go, verify.go.
- `internal/battery/sealrow.go` — the tenth row.
- `cmd/groundwork/seal.go` — the verb: grant, verify, restore, amend.
- `.groundwork/allowed-signers` — committed, shaped, and empty of keys.
- `docs/derivation-contract.md` section 2 — the seal tag, its signature, the
  mirror, the journal line, and what the tools do with it.

Changed:

- `internal/journal/journal.go` — the seal line gains `battery`, `battery_run`
  and `reason`, all `omitempty`; `checkBatteryPair` refuses half a pair.
- `internal/journal/seals.go` — `Seals` and `LatestBattery` readers.
- `internal/battery/rows.go` — the row registered, tenth.
- `cmd/groundwork/main.go` — the verb wired and on the usage.
- `internal/adapter/adapter_test.go` — one pin for the survivor the 8.0 sample
  rotation turned up, `NewGo`. Test only; no source touched there.
- `.gitignore` — its comment now names the allowed-signers file among the
  committed things under `.groundwork/`.
- `.groundwork-battery.json` — 7.0+r5a8f33c to 8.0+rb43026c. The digest came
  from the tool's own drift error, never by hand.

## What the survey found

- `internal/journal/kinds.go` already holds `seal`. No widening.
- `internal/battery/battery.go` `kinds` already holds `seal-verify`. **The row-kind
  pin in `internal/battery/planrow_test.go` does NOT move.** The brief expected it
  to; it is already there from D28's forward-naming.
- D28 names this slice's obligation outright: "the seal line's battery and
  battery_run fields (D23's second recording place) land with the seal
  machinery." So the journal seal line gains those two fields here.
- Row-count pins that move 9 -> 10:
  - `cmd/groundwork/battery_test.go:156` "9 rows" -> "10 rows"
  - `cmd/groundwork/battery_test.go:175` green summary
  - `cmd/groundwork/battery_test.go:196` hostile-repo summary
- `internal/battery/battery_test.go:957` `TestDefaultHoldsExactlyTheShippedRows`
  gains `seal-verify/seal-verify/blocking`.
- Floor test: new `TestThisRepoDeclaresTheBumpTheSealRowCost` at major >= 8.

## Design decided

New package `internal/seal`. Battery row imports it, so seal must not import
battery (no cycle). Seal imports journal.

Tag: annotated, named `seal/<kind>/<subject>`; kinds design, acceptance, birth,
adoption. Message shape (contract section 2):

    seal: <kind> <subject>
    <blank>
    covers:
      <40 hex blob> <path>
      ...
    <blank>
    Battery: <MAJOR.MINOR>+r<7hex>
    Battery-Run: run-<stamp>-<4hex>

Strict parse. Paths sorted, unique, charset `[A-Za-z0-9._][A-Za-z0-9._/-]*`, no
`..` segment — which also kills git pathspec magic when the path is handed back
to `git ls-tree`.

Verbs: `groundwork seal grant|verify|restore|amend`.

Signature: four states. R4 names verified, unsigned and missing; a signature
that is present and does not check out is `unverified`, kept apart from
`unsigned` so a forged block does not read exactly like no block at all. Only
`verified` is authority. Only `missing` is red. The CLI holds no key: every seal
it grants is unsigned.

Mirror branch `groundwork-seals`: `tags/<tag name>` raw bytes, `index.txt`,
`prior/<tag name>/<oid>` for amendments.

Row: id `seal-verify`, kind `seal-verify`, blocking. No seal tag at all = green
(plan-row precedent: nothing stated, so nothing misstated). A moved or gone
covered path = red. Unsigned = loud on the line, never red this bet.

## Red set (fails at 237e45a) — verified

Four packages fail to build, plus three pins that fail on their assertion.

New test files, all naming source that does not exist (build failure = red):

- `internal/seal/seal_test.go` — kinds, tag names, message render/parse, hostile
  shapes, the contract page.
- `internal/seal/grant_test.go` — grant writes tag + mirror + journal line.
- `internal/seal/verify_test.go` — recompute, moved, gone, signature states,
  the battery cross-check. Holds `TestProof_b3s3_unsigned_never_reads_as_human_authority`.
- `internal/seal/mirror_test.go` — holds `TestProof_b3s3_restore_rebuilds_a_tag_byte_for_byte`.
- `internal/seal/amend_test.go` — R6's shape.
- `internal/journal/seals_test.go` — the seal line's battery fields, `Seals`,
  `LatestBattery`.
- `internal/battery/sealrow_test.go` — the row. Holds
  `TestProof_b3s3_moved_a_covered_path_turns_the_row_red` and the 8.0 floor test.
- `cmd/groundwork/seal_test.go` — the verb.

Pin edits that fail on their assertion at 237e45a (run with the new files moved
aside, so the failure is the pin and not the build):

- `internal/battery/battery_test.go` `TestDefaultHoldsExactlyTheShippedRows`
  — wants `seal-verify/seal-verify/blocking`. FAILED at 237e45a.
- `cmd/groundwork/battery_test.go` `TestVerifyGreenExitsZero` — wants "10 rows".
  FAILED at 237e45a.
- `cmd/groundwork/battery_test.go` `TestVerifyPrintsTheWholeSummary` — wants
  "10 rows: green 10, ...". FAILED at 237e45a.
- `cmd/groundwork/battery_test.go` `TestVerifyRedPrintsTheWholeSummary` — wants
  "10 rows: green 3, red 2, ... unrunnable 5". FAILED at 237e45a.

## Green list — survivor pins (pass without new source)

- `internal/battery/planrow_test.go` `TestTheRowKindVocabularyIsPinned` — NOT
  edited. `seal-verify` was already in the battery's closed kind list from D28's
  forward-naming, so the row joins with no vocabulary change. The brief expected
  this pin to move; it does not.
- `internal/journal/kinds.go` `kinds` — NOT edited. `seal` was already there.
- `internal/journal/journal_test.go` `TestWriteSealWritesEveryField` — NOT
  edited. It pins the seal line's exact key set, and the two new fields carry
  `omitempty`, so a seal written without a battery pair still has exactly the
  twelve keys it pinned. This is a survivor: it passes with and without the new
  source. It is what proves the widening is additive.


## The verify run

`go build -o /tmp/gw ./cmd/groundwork`, then
`GROUNDWORK_SESSION=b3s3 /tmp/gw verify`. The whole run is in
`scratchpad/verify-b3s3.txt`:

```
run run-20260826T050336Z-a553
battery 8.0+rb43026c
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 8.0+rb43026c, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 7 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 754 tests in 9 suites, and every one can fail
wiring        green    the wiring scan read 66 exported functions in 54 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 754 discovered tests in 9 suites on 1 surface, and the run log names every one
mutate        green    the deletion test killed every one of 7 mutants it judged: sampled 10 of 96 targets at 8.0+rb43026c: killed 7 (2 by crash), 3 did not compile; 1 file was left out of this build
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
chain         green    413 lines across 184 sessions in refs/groundwork/journal: every chain holds, and 353 lines came before the chain and went unchained, in 182 sessions with nothing chained
seal-verify   green    this repo holds no seal tag, so nothing is sealed and no covered path can have moved
10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0
```

The mutate row went red on the first run at 8.0: the rotated sample found
`NewGo` in `internal/adapter/goadapter.go` surviving. `NewGo` returns a `*Go`,
and the blanked version returns nil; nothing in that package ever dereferenced
it, because `Name` has a pointer receiver that never touches its receiver. The
fix is one pin in the survivor's own package, F29's shape. No scan was
weakened.

One thing changed after that run: a wrong sentence in a test comment in
`internal/battery/sealrow_test.go`. It adds and removes no test, so no row's
evidence moves. `gofmt -l` is clean, `go vet ./...` is clean, and
`go test ./...` is green on all ten packages with the comment fixed.

The run's 33 journal lines under session `b3s3` chain: seq 1 carries no prev,
and every line after it carries the hash of the one before. The chain row read
the whole ref green.

## Driven through the built binary

The plan says the seals are granted and broken in scratch repos, through the
built binary. They were. `go build -o /tmp/gw ./cmd/groundwork`, then in a fresh
scratch repo with a green battery line planted on its journal ref:

- `seal grant` with no battery run behind it: refused, exit 1, and the message
  says to run verify first.
- `seal grant --kind design --subject demo --path docs/one.md --path docs/two.md`:
  granted at HEAD, two paths, under 8.0+rb43026c, printed unsigned, mirrored.
- `seal verify`: exit 0, both paths hold, the seal line agrees, 1 unsigned.
- One covered file edited and committed. `seal verify`: exit 1, the moved path
  named with both hashes, `1 seal, 2 paths, 1 moved, 1 unsigned, 1 problem`.
- `seal amend ... --reason "the doc was rewritten"`: printed the before and the
  after, and "recorded by an agent ... not the owner's own word".
- `seal verify`: exit 0 again.
- Tag deleted, `seal restore`: the tag came back at the same object id,
  b24b1e81722803e42bc7d03912d362399970b229.
- `seal verify seal/design/nothere`: exit 1, "is missing".

## Blank the rule

One rule blanked at a time, in the source, with the owning package's suite run
over it. The script is at `scratchpad/blank.py`; the raw run is at
`scratchpad/blanking.txt`.

48 rules. **48 killed, 0 survived, 0 did-not-build, 0 that can never fail.**

The table below is the last automated pass, 47 rows: the 48th, "the verb makes
what it prints printable", was re-run on its own after its filter was widened,
and its result is pasted into the table in place.

Four survived on the first pass and one on the second, and each one was a real
gap rather than a scoring artefact:

1. **The `seal: ` prefix check** survived: a first line reading `design b3s3`,
   with no `seal:` on it, parsed. Fixed by a case in
   `TestParseMessageRefusesHostileShapes`, not by loosening anything.
2. **A trailer's own name** survived for the same reason: a bare
   `8.0+r1234567` line parsed as the Battery trailer, because the shape check
   alone accepted it. Fixed by a case.
3. **`printable` in three places** — `seal.clip`, the row's `clipProblem`, and
   the verb's `plain` — survived. Every error in the seal package quotes its
   values with `%q`, which escapes a control character on its own, so nothing
   that goes through an error could tell the difference. That is exactly D50
   ruling 1's warning: one `%q` changed to `%s` and the line becomes a
   forger's. Each of the three now has a direct test on the function.
   These three are the honest "can never fail from the outside" cases, and they
   are named that way in their own comments rather than left looking proven.
4. **The mirror's tag-name check** survived: nothing planted a hostile name
   under `tags/`. Fixed by `TestRestoreRefusesAMirroredNameThatIsNotASeal`,
   which builds the hostile mirror through plumbing.
5. **Two duplicate guards** survived because a second guard downstream caught
   the same thing: `coveredAt` refused an empty path list and a repeated path,
   and `checkCovered` refused both again. The fix was to delete the upstream
   pair, not to add a test for them. Two guards over one rule leave one with no
   test that can reach it, which is what the deletion test is for.

```
killed       | seal line opens with seal:                              | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | seal line names nothing after the subject               | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a blank line under the seal line                        | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | the covers heading                                      | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a covered line opens with two spaces                    | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a covered line carries a blob hash                      | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | the covers list names at least one path                 | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.47s)
killed       | no path is covered twice                                | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.82s)
killed       | the covers list is sorted                               | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | the covers walk guards its own index                    | --- FAIL: TestAmendMovesTheTagAndSaysWhatChanged (0.23s)
killed       | a trailer is where the contract puts it                 | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a trailer carries the shape D23 fixes                   | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a seal message ends at its trailers                     | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | the whole message cap                                   | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | the kind vocabulary is closed                           | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.28s)
killed       | the subject charset                                     | --- FAIL: TestTagNameRefusesWhatIsNotASeal (0.00s)
killed       | the subject cap                                         | --- FAIL: TestTagNameRefusesWhatIsNotASeal (0.00s)
killed       | the covered path charset                                | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a covered path names one file under the root            | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | the covered path cap                                    | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed       | a value off a tag is made printable                     | --- FAIL: TestClipMakesAValueOffATagSafeToPrint (0.00s)
killed       | a grant never overwrites a seal                         | --- FAIL: TestGrantRefusesToOverwriteASeal (0.35s)
killed       | a seal is granted on a green run                        | --- FAIL: TestGrantRefusesWithoutAGreenBatteryRun (0.46s)
killed       | a seal needs a battery run behind it                    | --- FAIL: TestGrantRefusesWithoutAGreenBatteryRun (0.44s)
killed       | a covered path has to be at HEAD                        | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.62s)
killed       | a moved path is found                                   | --- FAIL: TestVerifyNamesEveryPathThatMoved (0.47s)
killed       | a gone path is found                                    | --- FAIL: TestVerifyNamesACoveredPathThatIsGone (0.43s)
killed       | the tag name and its message agree                      | --- FAIL: TestVerifyReadsABadTagAsAProblem (0.60s)
killed       | the battery trailers agree with the seal line           | --- FAIL: TestVerifyChecksTheTagTrailersAgainstTheSealLine (0.38s)
killed       | only a verified seal is authority                       | --- FAIL: TestProof_b3s3_unsigned_never_reads_as_human_authority (0.33s)
killed       | a signature nothing can check is not unsigned           | --- FAIL: TestProof_b3s3_unsigned_never_reads_as_human_authority (0.37s)
killed       | an annotated tag is what a seal is                      | --- FAIL: TestVerifyReadsABadTagAsAProblem (0.67s)
killed       | a restore never clobbers a different tag                | --- FAIL: TestRestoreRefusesToClobberADifferentTag (0.33s)
killed       | the mirror holds only seal tag names                    | --- FAIL: TestRestoreRefusesAMirroredNameThatIsNotASeal (0.20s)
killed       | an amendment needs a reason                             | --- FAIL: TestAmendRefusesWithoutAReason (0.52s)
killed       | an amendment needs a seal to amend                      | --- FAIL: TestAmendRefusesASealThatIsNotThere (0.21s)
killed       | the prior tag is filed in the mirror                    | --- FAIL: TestAmendRecordsThePriorTagInTheMirror (0.59s)
killed       | an unsigned amendment is agent-recorded                 | --- FAIL: TestAnUnsignedAmendmentReadsAsAgentRecorded (0.56s)
killed       | a seal line carries both battery fields or neither      | --- FAIL: TestWriteSealRefusesHalfABatteryPair (0.28s)
killed       | a seal line records the reason                          | --- FAIL: TestAmendWritesRevokedThenGranted (0.58s)
killed       | a repo with no seal is green                            | --- FAIL: TestSealRowIsGreenOnARepoWithNoSeal (0.11s)
killed       | a problem turns the row red                             | --- FAIL: TestSealRowIsRedWhenACoveredPathIsGone (0.43s)
killed       | the row says how many seals are unsigned                | --- FAIL: TestSealRowSaysHowManySealsAreUnsigned (0.30s)
killed       | the row makes a problem printable                       | --- FAIL: TestTheSealRowMakesAProblemSafeToPrint (0.00s)
killed       | the row is registered                                   | --- FAIL: TestTheSealRowIsRegistered (0.00s)
killed       | the verb makes what it prints printable                 | --- FAIL: TestThePlainRenderingMakesForgedTextSafe 
killed       | a moved seal fails the verb                             | --- FAIL: TestSealVerifyRedExitsOne (0.43s)
killed       | a missing seal fails the verb                           | --- FAIL: TestSealVerifyOneSealThatIsMissingExitsOne (0.09s)
```

## Candidate ledger entries

I did not touch `docs/findings.md` or `docs/decisions.md`. These are for the
driver to land.

### Candidate decisions

**Four signature states, not three.** R4 names verified, unsigned and missing.
A tag that carries a signature which does not check out is a fourth shape, and
it is recorded as `unverified` rather than folded into `unsigned`. Only
`verified` is authority. `missing` is red. `unsigned` and `unverified` are both
loud and neither is blocking in this bet. Why: folding them together would make
a forged signature block read exactly like no signature at all, and a reader has
to know which situation they are in. The flip R4 names still has one place to
land — the two loud states become blocking together.

**A seal is granted on a green battery run, read from the journal.**
`groundwork seal grant` has no `--battery` flag. It reads the journal's own
newest battery line, refuses when there is none, and refuses when that run had a
red row. Why: a seal is a claim that the work stands, and a version the caller
typed is a claim about a run that may never have happened. It is the same
principle as the dial's `from` and the seal line's `target` — the record is read
from the record.

**The seal line gains `reason`.** D28 deferred `battery` and `battery_run` to
this slice, and they land. `reason` is new here. R6 refuses an amendment without
a reason, and a reason that is only printed is not on the record. It follows the
dial line's precedent, and it is `omitempty`: a grant gives no reason, so a
grant's line does not carry the field.

**A covered path is written plainly.** `[A-Za-z0-9._][A-Za-z0-9._/-]*`, no
empty, `.` or `..` segment, 300 bytes. That is tighter than what git will store.
The reason is mechanical: the path is handed straight back to git as a pathspec,
and a leading colon, a glob or a leading dash would turn one path into a
different question. Contract section 2.1 writes it down.

**A repo with no seal tag is green.** The plan row's precedent, D45: no subject,
so nothing can be misstated. The line says only that and never claims a seal was
checked. Unsigned seals are green too, per R4, with the count on every line the
row prints.

**A restore never overwrites.** A name a different object already stands at is
left alone and reported as mismatched, and a mirrored file whose name is not a
seal tag's is refused. The branch is a mirror; a restore that clobbered a local
tag would quietly make the branch the record instead.

### Candidate findings

**F-x, class host-limit (D21's class).** This container has no `ssh-keygen`.
Git's SSH signature path needs it to sign and to verify, so no SSH-signed tag
can be made here and none can be checked here. Caught while building
`TestProof_b3s3_restore_rebuilds_a_tag_byte_for_byte`, which the slice plan
asked to build with a throwaway key generated in the test.

Worked around, not papered over. The proof plants a real tag object carrying a
signature block through `git hash-object -t tag -w`; a tag object's id is the
hash of its own bytes, so the round trip proves exactly what a real signature
would need. And `checkSignature` reports a machine with no verifier as
`unverified` with its own words, never as verified — the failure direction is
the safe one.

The consequence is named rather than hidden: no test in this repo can produce
the `Verified` state, so that one branch of `checkSignature` has no test behind
it here. It is the same limit R4 already records from the other end.

**F-y, class other — the slice is large for one sitting.** About 5,100 new
lines across source and tests: a package, four verbs, a battery row, a contract
section, and the journal widening D28 deferred here. CLAUDE.md says a slice is
"small enough for a reviewer to judge in a single sitting", and this one asks a
lot of one sitting.

It was built whole because the pieces do not stand apart — the row runs verify,
verify reads a tag the grant writes, and the amendment is what makes a moved
seal fixable rather than permanent. But it could have been cut: the tag and its
parse; then the verbs and the mirror; then the row. Raising it so the driver
can rule, and so the next bet cuts earlier if the answer is that this was too
much.

## Notes for the driver

- The brief expected `internal/battery/planrow_test.go`'s row-kind pin to gain
  `seal-verify`. It already held it, from D28's forward-naming. No pin moved,
  and the vocabulary did not widen. Worth knowing before the next brief is
  written from the same assumption.
- The mutate row's sample rotates at 8.0. Any survivor it turns up wants a pin
  in the survivor's own package, the F29/F34/F47 way — never a weakened scan.

---

# Fix round — after the blind review

Base for the fixes: dbf14d5 (the driver's review commit). My slice-3 work is
still uncommitted on top of it. D52's nine rulings drive every direction below.

## Fix status

- [x] 1. F59/D52.1+2 — mirror walker skips and reports; grant is atomic
- [x] 2. F60/D52.3 — unverified counted and printed apart, Report field renamed
- [x] 3. F60/D52.5 — the note names which of three; signerFrom learns SSH
- [x] 4. F61/D52.4 — the clause guaranteed by arithmetic; widest found by search
- [x] 5. F63 — lying name, the index read from the tree, two unproven rules, two
      can-never-fail shapes
- [x] 6. F64/D52.7 — charset tightens to the page; the page gains two things
- [x] 7. F65/D52.8 — signature and signer on the journal line; signers from HEAD
- [x] 8. F66/D52.9 — the seven smalls
- [x] Blanking sweep, four-way table: 75 rules, 75 killed
- [x] gofmt clean, go vet clean, go test ./... green on ten packages
- [x] One full verify: 10 rows, green 10, at 8.0+rb43026c

## What the host actually is (F62)

Confirmed before starting. The global git config carries `gpg.format=ssh`,
`gpg.ssh.program=/tmp/code-sign` (a shim into the environment manager) and
`commit.gpgsign=true`. `git tag -s` therefore produces a real SSH signature
block here. The shim's public key at `/home/claude/.ssh/commit_signing_key.pub`
is zero bytes, so no allowed-signers entry can be built for it and nothing here
can verify. F57 was wrong about the mechanism and right about the consequence,
and F62 is the correction. The fixture for the round-trip proof moves to a real
signed tag.

## Fix progress

- [x] 1. F59/D52.1+2. `mirrorTags` skips and reports; `Restoration.Ignored`
      carries what it would not read. The name check still bites: nothing bad
      reaches the map, so no ref is written for one. The grant is atomic —
      `undoTag` takes the tag down when the mirror or the journal fails — and it
      asks `checkMirrorIsClean` *before* making the tag, so a junked mirror
      leaves nothing behind at all. Reader permissive, writer strict; the
      reasoning is in the code and in the candidate decisions below.
- [x] 2. F60/D52.3. `Report.Unsigned` and `Report.Unverified` are separate
      counts and `NoAuthority()` is a method, so no field holds the blurred
      number. Row clause and CLI summary print both.
- [x] 3. F60/D52.5. `whyNotVerified` reads git's own words and names which of
      three situations, with a fourth branch that passes git's first line on.
      `signerFrom` learns git's SSH wording beside the GPG status line, with the
      host limit named (F62).
- [x] 4. F61/D52.4. The counts moved into the head and the problem takes what is
      left, so no line can drop a count. The widest-line test searches the count
      space at four problem lengths and finds 200 bytes exactly.
- [x] 5. F63. Restore compares the `tag ` header in the bytes to the file name
      before writing a ref; the index-present question is asked of the tree
      rather than of an exit code; the index-versus-bytes check has a test; the
      R4 headline proof walks all three not-verified branches and pins which one
      ran; the dead condition and the wrong `--cleanup` claim are next.
- [x] 6. F64/D52.7. Charset tightened to the page, error message rewritten, page
      gained the Battery-Run shape and the name-versus-message red.
- [x] 7. F65/D52.8 (part). `signature` and `signer` on the journal seal line,
      both omitempty, with a signer refused unless a signature state stands
      behind it. Verification reads the signers file from HEAD through
      `openSigners`. Amend's own line is next.
- [x] 8. F66/D52.9, the seven smalls. A run with every count at zero is refused
      ("checked nothing", D17's rule). `seal verify <tag>` refuses a name that is
      not a seal tag's before it reads anything, so a release tag's own text
      never comes back through seal machinery. The cross-check reads the newest
      seal line of either action, so an amendment that dies between its two
      writes leaves revoked answering rather than the older grant. `short()`
      goes through printable. Amend prints the paths that went and the paths
      that came, clipped to five and a count. The stale journal comment about
      grants and reasons is corrected. `AmendSeal`'s opener, `clip`'s doc and
      the checkPath message are all shorter.

## Candidate ledger entries — fix round

### Candidate decision: the mirror reader is permissive, the mirror writer is strict

D52.1 says one scribbled file must never stop the other tags, and D52.2 says a
grant that cannot mirror leaves no tag. Those two pull in different directions
for the same junk file, so the code splits them:

- `Restore` skips the file, reports it in `Restoration.Ignored`, and rehydrates
  every good tag. A pushed file can never turn off restoring.
- `GrantSeal` asks `checkMirrorIsClean` **before** it makes the tag, and refuses
  with the file named. New work onto a branch somebody has scribbled on stops
  until a person has looked — and it stops before the tag exists, so the probe's
  "no tag behind" holds without needing a rollback at all.

The cost, named rather than hidden: anyone who can push to `groundwork-seals`
can stop new grants until the branch is cleaned. That is a visible, one-push
fix, and it is the safer side of the trade — the alternative is granting seals
onto a mirror nobody has looked at. If the driver wants it the other way, the
one line to change is in `checkMirrorIsClean`'s caller.

### Candidate finding: F57 and F62, and what the round trip now proves

F62 is right and F57 was wrong. This host signs: `gpg.format=ssh`,
`gpg.ssh.program=/tmp/code-sign`, and `git tag -s` produces a genuine SSH
signature block. It cannot verify: the shim answers "unsupported code-sign
operation" to anything that is not `-Y sign`, and the configured public key is a
zero-byte file.

So the fixtures moved to real signed tags — the byte-for-byte restore proof and
every unverified case now use one — and the planted signature block is gone. The
`Verified` branch still has no runnable test here, and `signerFrom`'s SSH half is
proved on git's own wording rather than on a live verification. Both say so in
their comments.

### Candidate finding: one rule, one place — again

Two more duplicate guards turned up in the sweep, the same shape the first round
found. Where two checks stand over one rule, the downstream one does the work
and the upstream one has no test that can reach it. Both were deleted rather
than tested: the covers-list blank-line guard (the trailer reader already
refuses a message that ends there) joins the two from the first round.

This is now three instances across two rounds. It may be worth a class of its
own in the ledger: a guard whose only proof is a test that would pass without
it.

## Sweep survivors, and what each one gets

Recorded as they came out of the sweep, before the fix:

1. `the covers list is followed by a blank line` — SURVIVED. Blanked, a message
   that ends with its covers list is still refused, by the trailer reader one
   step later. Two guards over one rule again. The upstream guard goes.
2. `a grant that cannot journal takes its tag down` — SURVIVED. The rollback on
   the mirror step has a test; the one on the journal step has none, because
   nothing made the journal write fail. It gets a fixture that blocks the
   journal ref the same way the mirror one is blocked.


## Blank the rule — fix round

The sweep is at `scratchpad/blank2.py`; the raw run is at
`scratchpad/blanking2.txt` and the assembled table at
`scratchpad/blanking2-final.txt`.

**75 rules. 75 killed, 0 survived, 0 did-not-build, 0 can-never-fail unproven.**

The four ways a row can come out, and what happened to each here:

- **killed** — 75. Every rule in the round, old and new.
- **SURVIVED** — 2 on the first pass, both fixed rather than explained:
  - `the covers list is followed by a blank line`. Blanked, a message ending
    with its covers list is still refused, by `trailerAt` one step later. Two
    guards over one rule. The upstream guard was deleted, so the row is gone
    from the table rather than passing on a technicality.
  - `a grant that cannot journal takes its tag down`. The mirror step's
    rollback had a test; the journal step's had none. It has one now
    (`TestAGrantThatCannotJournalRemovesItsOwnTag`), which puts a lock file
    over the journal ref — what another writer holding it looks like from
    outside.
- **did-not-build / did-not-apply** — 7 on the first pass, every one of them a
  fault in my own mutation string rather than in the code: an orphaned
  variable, a wrong tab, a replacement that dropped an import. Each was
  rewritten and re-run, and each then killed. They are listed here because a
  did-not-build row proves nothing, and counting one as a pass is how a sweep
  flatters itself.
- **can-never-fail** — 4 guards, none of them left looking proven:
  - `seal.clip`, the row's `clipProblem`, and the verb's `plain` all make a
    value printable. Nothing reachable can deliver a control character to any
    of the three — every value is charset-checked upstream and git holds no
    control character in a ref name — so each has a direct test on the
    function, and each says in its own comment that this is why.
  - The `Verified` branch of `checkSignature`, and `signerFrom`'s SSH half.
    This host signs and cannot verify (F62), so no run here reaches a good
    signature. `signerFrom` is proved on git's own wording; the `Verified`
    branch has no runnable test here at all, and its comment says so.

```
killed   | seal line opens with seal:                               | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | seal line names nothing after the subject                | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | a blank line under the seal line                         | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | the covers heading                                       | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | a covered line opens with two spaces                     | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | a covered line carries a blob hash                       | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | the covers list names at least one path                  | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.50s)
killed   | no path is covered twice                                 | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.49s)
killed   | the covers list is sorted                                | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | the covers walk guards its own index                     | --- FAIL: TestAmendMovesTheTagAndSaysWhatChanged (0.26s)
killed   | a trailer is where the contract puts it                  | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | a trailer carries the shape D23 fixes                    | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | a seal message ends at its trailers                      | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | the whole message cap                                    | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | the kind vocabulary is closed                            | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.51s)
killed   | the subject charset                                      | --- FAIL: TestTagNameRefusesWhatIsNotASeal (0.00s)
killed   | the subject cap                                          | --- FAIL: TestTagNameRefusesWhatIsNotASeal (0.00s)
killed   | the covered path charset                                 | --- FAIL: TestGrantRefusesAPathThatOpensWithAnUnderscore (0.37s)
killed   | a covered path opens with a letter, a digit or a dot     | --- FAIL: TestGrantRefusesAPathThatOpensWithAnUnderscore (0.33s)
killed   | a covered path names one file under the root             | --- FAIL: TestRestoreRefusesToClobberADifferentTag (16.86s)
killed   | the covered path cap                                     | --- FAIL: TestParseMessageRefusesHostileShapes (0.00s)
killed   | a value off a tag is made printable                      | --- FAIL: TestClipMakesAValueOffATagSafeToPrint (0.00s)
killed   | a grant never overwrites a seal                          | --- FAIL: TestGrantRefusesToOverwriteASeal (0.38s)
killed   | a seal is granted on a green run                         | --- FAIL: TestGrantRefusesWithoutAGreenBatteryRun (0.49s)
killed   | a green run has to have checked something                | --- FAIL: TestGrantRefusesARunThatCheckedNothing (0.62s)
killed   | a seal needs a battery run behind it                     | --- FAIL: TestGrantRefusesWithoutAGreenBatteryRun (0.43s)
killed   | a covered path has to be at HEAD                         | --- FAIL: TestGrantRefusesWhatItCannotSeal (1.59s)
killed   | a grant refuses a junked mirror                          | --- FAIL: TestGrantRefusesToWriteOntoAJunkedMirror (0.58s)
killed   | a grant that cannot mirror takes its tag down            | --- FAIL: TestAGrantThatCannotMirrorRemovesItsOwnTag (0.32s)
killed   | a grant that cannot journal takes its tag down           | --- FAIL: TestAGrantThatCannotJournalRemovesItsOwnTag
killed   | a grant records the signature state                      | --- FAIL: TestAmendRecordsTheSignatureOnItsJournalLines (0.65s)
killed   | a moved path is found                                    | --- FAIL: TestVerifyNamesEveryPathThatMoved (0.63s)
killed   | a gone path is found                                     | --- FAIL: TestVerifyNamesACoveredPathThatIsGone (0.43s)
killed   | the tag name and its message agree                       | --- FAIL: TestVerifyReadsABadTagAsAProblem (0.70s)
killed   | the battery trailers agree with the seal line            | --- FAIL: TestVerifyChecksTheTagTrailersAgainstTheSealLine (0.41s)
killed   | the cross-check reads the newest line of either action   | --- FAIL: TestTheCrossCheckReadsTheNewestSealLineOfEitherAction (0.37s)
killed   | only a verified seal is authority                        | --- FAIL: TestProof_b3s3_unsigned_never_reads_as_human_authority (1.24s)
killed   | unverified is counted apart from unsigned                | --- FAIL: TestVerifyCountsUnverifiedApartFromUnsigned (0.64s)
killed   | a signature nothing can check is not unsigned            | --- FAIL: TestProof_b3s3_unsigned_never_reads_as_human_authority
killed   | a repo with no committed signers file says so            | --- FAIL: TestProof_b3s3_unsigned_never_reads_as_human_authority (1.74s)
killed   | an annotated tag is what a seal is                       | --- FAIL: TestVerifyReadsABadTagAsAProblem (0.65s)
killed   | the note says no verifier ran                            | --- FAIL: TestProof_b3s3_unsigned_never_reads_as_human_authority (1.19s)
killed   | the note says which key list came up empty               | --- FAIL: TestTheUnverifiedNoteSaysWhichSituation (0.00s)
killed   | the note says the signature does not check out           | --- FAIL: TestTheUnverifiedNoteSaysWhichSituation (0.00s)
killed   | signerFrom reads git's SSH wording                       | --- FAIL: TestSignerFromReadsBothOfGitsVerifyOutputs (0.00s)
killed   | signerFrom reads git's GPG status line                   | --- FAIL: TestSignerFromReadsBothOfGitsVerifyOutputs
killed   | the signers file is read from HEAD                       | --- FAIL: TestVerificationReadsTheSignersFileFromHead
killed   | a restore never clobbers a different tag                 | --- FAIL: TestRestoreRefusesToClobberADifferentTag (0.33s)
killed   | a restore refuses a tag whose bytes name another         | --- FAIL: TestRestoreRefusesATagWhoseBytesNameADifferentTag (0.37s)
killed   | a restore checks the bytes against the index             | --- FAIL: TestRestoreReportsBytesThatDoNotMatchTheIndex (0.38s)
killed   | the mirror walker reports what it skipped                | --- FAIL: TestRestoreReportsAJunkFileAndRestoresTheRest (0.37s)
killed   | no ref is written for a name that is not a seal tag's    | --- FAIL: TestRestoreReportsAJunkFileAndRestoresTheRest (0.39s)
killed   | the index is read from the tree, not an exit code        | --- FAIL: TestRestoreOnAMirrorWithNoIndex
killed   | the prior tag is filed in the mirror                     | --- FAIL: TestAmendRecordsThePriorTagInTheMirror (0.64s)
killed   | an amendment needs a reason                              | --- FAIL: TestAmendRefusesWithoutAReason (0.50s)
killed   | an amendment needs a seal to amend                       | --- FAIL: TestAmendRefusesASealThatIsNotThere (0.21s)
killed   | an unsigned amendment is agent-recorded                  | --- FAIL: TestAnUnsignedAmendmentReadsAsAgentRecorded (0.55s)
killed   | an amendment records the signature state                 | --- FAIL: TestAmendRecordsTheSignatureOnItsJournalLines (0.63s)
killed   | a seal line records the reason                           | --- FAIL: TestAmendWritesRevokedThenGranted (0.60s)
killed   | a seal line carries both battery fields or neither       | --- FAIL: TestWriteSealRefusesHalfABatteryPair (0.26s)
killed   | a signer stands on a signature state                     | --- FAIL: TestWriteSealRefusesASignerWithNoSignature (0.16s)
killed   | short makes a value printable                            | --- FAIL: TestShortMakesAValueSafeToPrint (0.00s)
killed   | a repo with no seal is green                             | --- FAIL: TestSealRowIsGreenOnARepoWithNoSeal (0.10s)
killed   | a problem turns the row red                              | --- FAIL: TestSealRowIsRedWhenACoveredPathIsGone (0.44s)
killed   | the row prints both authority counts                     | --- FAIL: TestSealRowSaysHowManySealsAreUnsignedAndHowManyUnverified (0.40s)
killed   | the problem takes only what the line has left            | --- FAIL: TestTheSealRowLineIsWidestSomewhereInTheCountSpace
killed   | the row makes a problem printable                        | --- FAIL: TestTheSealRowMakesAProblemSafeToPrint (0.00s)
killed   | the row is registered                                    | --- FAIL: TestTheSealRowIsRegistered (0.00s)
killed   | the verb makes what it prints printable                  | --- FAIL: TestThePlainRenderingMakesForgedTextSafe (0.00s)
killed   | a moved seal fails the verb                              | --- FAIL: TestSealVerifyRedExitsOne (0.55s)
killed   | a missing seal fails the verb                            | --- FAIL: TestSealVerifyOneSealThatIsMissingExitsOne (0.10s)
killed   | the verb refuses a name that is not a seal tag's         | --- FAIL: TestSealVerifyRefusesATagThatIsNotASealByName
killed   | the verb prints the paths that differ                    | --- FAIL: TestSealAmendPrintsThePathsThatDiffer (0.70s)
killed   | the verb reports what the restore would not read         | --- FAIL: TestSealRestoreReportsWhatItWouldNotRead (0.53s)
killed   | the summary counts the two states apart                  | --- FAIL: TestSealVerifyGreenExitsZero
```


## Red and green, updated for the fix round

No new test file. Every fix-round test joins an existing one:

- `internal/seal/seal_test.go` — the underscore path case, the trailer-with-no-
  name case, `TestClipMakesAValueOffATagSafeToPrint` (already there), and the
  contract page's two new pins.
- `internal/seal/grant_test.go` — the underscore grant, the refusal read once,
  the run that checked nothing, the junked-mirror refusal, and the two
  rollbacks.
- `internal/seal/verify_test.go` — signers from HEAD, the disk swap, the three
  notes, `signerFrom` on both wordings, the counts apart, the newest-line
  cross-check, and the rewritten R4 headline proof.
- `internal/seal/mirror_test.go` — the junk file reported, the lying name, the
  mirror with no index, the index-versus-bytes mismatch, and the round-trip
  proof on a real signed tag.
- `internal/seal/amend_test.go` — the signature state on the amendment's lines.
- `internal/journal/seals_test.go` — signature and signer, the half pair, and
  `short()`.
- `internal/battery/sealrow_test.go` — the searched widest line, and both
  authority counts on the row's line.
- `cmd/groundwork/seal_test.go` — the split summary, the forged-block probe, the
  non-seal name refusal, the paths that differ, and the ignored-file report.

Each was run red before its fix. The two rows that moved as pins rather than as
new tests are the CLI summary strings, which gained ` %d unverified`.


## The fix round's verify

One run, at the end, on the finished tree. `scratchpad/verify-b3s3-fix.txt`:

```
run run-20260826T065129Z-716f
battery 8.0+rb43026c
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 8.0+rb43026c, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 7 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 778 tests in 9 suites, and every one can fail
wiring        green    the wiring scan read 67 exported functions in 54 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 778 discovered tests in 9 suites on 1 surface, and the run log names every one
mutate        green    the deletion test killed every one of 7 mutants it judged: sampled 10 of 98 targets at 8.0+rb43026c: killed 7 (1 by crash), 3 did not compile; 1 file was left out of this build
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
chain         green    424 lines across 184 sessions in refs/groundwork/journal: every chain holds, and 353 lines came before the chain and went unchained, in 182 sessions with nothing chained
seal-verify   green    this repo holds no seal tag, so nothing is sealed and no covered path can have moved
10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0
```

The version line is `battery 8.0+rb43026c` — the same pair the build round
closed at. Nothing in this round touched a row's id, kind or severity, so the
digest does not move, and the version row confirms it against the lock file.

The row counts moved with the round: 778 tests where the build round had 754,
and 67 exported functions where it had 66 (`seal.CheckTagName`, which the verb
needs to refuse a name before reading it). The mutate row sampled 10 of 98
targets at the same version and killed every one it judged.

A note on the wait, because it cost time rather than correctness: the loop I
used to wait for this run was `until ! pgrep -f "/tmp/gw verify"`, and the
waiter's own command line holds that string — so `pgrep` matched the waiter
itself and the loop could never end. The run had finished; only the wake was
lost. A wait on a process name has to be written so it cannot match itself.

---

# Second fix round — after the closure re-check

Base: f4eecd9. F67, F68, F69, all three gating.

- [x] 1. F67 — the rollback undoes the mirror too, with old values passed
- [x] 2. F68 — a newest line that is not granted is a problem
- [x] 3. F69 — the page's §2.4, the pin, and three smalls
- [x] Blanking runs for each new rule: 8 rules, 8 killed
- [x] gofmt clean, go vet clean
- [ ] go test ./... — BLOCKED, and not by this round. See below.
- [ ] One full verify


## Second fix round — what changed

**1. F67, the rollback.** `GrantSeal` reads the mirror branch tip before
anything writes to it, and reads back the tip the mirror wrote. `grantUndo`
carries the tag, the tag's object id, and both branch values, and `run` puts
both writes back — the branch to the tip it held, or deleted when this grant
created it. Every update-ref is handed the old value, so a rollback can only
undo this grant's own writes and never a concurrent writer's. `undoTag` is gone;
`grantUndo.run` replaces it and the tag deletion now passes `u.tagOID`.

The window that cannot be closed is named beside the D52.2 comment: a process
killed between two of the three writes leaves whatever it had done, and git has
no transaction across two refs. The comment says what to do about it — restore,
verify, look at what stands.

**2. F68, the revoked seal.** One branch in `checkBattery`: a newest seal line
whose action is not `granted` is a problem naming the tag and the action, before
any battery pair is compared. A revoked line carries the same pair a grant does,
which is why comparing pairs alone read it as sound.

**3. F69, the record gap and the smalls.** Section 2.4's table gained `signature`
and `signer`, "three more fields" became five, and the `reason` row now says
both amendment lines carry it. The pin was tightened past what the driver asked
for: it reads the table's own rows rather than searching the page, because my
first attempt at it survived a mutation that renamed a table cell — the field
was still spelled in a sentence below. Beside them: the HEAD-not-worktree proof
stages its planted file with `git add`, so a read of the index would now fail
it; `checkMirrorIsClean` runs in `AmendSeal` too, because an amendment writes to
the mirror exactly as a grant does and the guard's own comment already said so;
`signerFrom`'s long sentence is three short ones.

Amend's own rollback is **not** in this round and is not claimed anywhere. If an
amendment's journal write fails, the tag has already moved and the mirror holds
the new bytes. It is a smaller wreck than a grant's — the prior tag is filed
under `prior/`, so the before is recoverable — but it is the same class, and it
is the driver's to schedule.

## Blank the rule — second fix round

Eight rules, **8 killed, 0 survived, 0 did-not-build, 0 can-never-fail**. Two
survived first and both were real:

- `the rollback passes the mirror's old value` survived twice. The first test I
  wrote fed the rollback object ids that do not exist, so update-ref refused
  whether or not the old value was passed — the test could not tell the rule
  from the fixture. Rewritten with real commits on both sides, it kills.
- `the contract page names every seal line field` survived: the pin searched the
  whole section, and a prose sentence naming the fields kept it green after the
  table row was gutted. The pin now reads table rows.

```
killed        | the rollback puts the mirror back                        | --- FAIL: TestAGrantThatCannotJournalLeavesNoMirrorBlobEither (1.01s)
SURVIVED      | the rollback passes the mirror's old value               | 
killed        | the rollback deletes a branch it created                 | --- FAIL: TestAGrantThatCannotJournalLeavesNoMirrorBlobEither (0.32s)
killed        | the rollback passes the tag's old value                  | --- FAIL: TestAGrantThatCannotJournalRemovesItsOwnTag (2.25s)
killed        | a revoked seal is a problem                              | --- FAIL: TestASealWhoseNewestLineIsRevokedIsAProblem (0.40s)
killed        | an amendment refuses a junked mirror                     | --- FAIL: TestAmendRefusesToWriteOntoAJunkedMirror (0.68s)
killed        | N13b: the signers file is read from HEAD, not the index  | --- FAIL: TestVerificationReadsTheSignersFileFromHead (0.73s)
SURVIVED      | the contract page names every seal line field            | 
```

Re-runs after the fixes: `the rollback passes the mirror's old value` killed by
`TestARollbackWillNotMoveAMirrorSomebodyElseMoved`; `the contract page names
every seal line field` killed by `TestTheContractWritesTheSealTagShape`.

## Blocked: the ledger is over D10's threshold, and I may not edit it

`go test ./...` is red, on a test that has nothing to do with this round:

```
--- FAIL: TestRecurPassesOnTheRealLedger
    docs/findings.md has 2 classes over the threshold with no decision:
        front-door-hollow: has 3 findings, at or over the threshold of 3, and no decision heading is named from it
        parallel-definition: has 3 findings, at or over the threshold of 3, and no decision heading is named from it
```

F67 put `front-door-hollow` at three, and F69 put `parallel-definition` at
three. D10 asks for an upstream decision heading naming a class that reaches the
threshold, and `docs/decisions.md` has none for either.

Proved to be nothing of mine: with my whole working tree stashed, at f4eecd9,
the same test fails the same way. The tree was restored immediately.

It is a ledger fix, and the standing rule for me is no ledger edits — so it
needs the driver. Until it lands, `go test ./...` is red, and the battery's
mutate row cannot take a green baseline from it.


## The second fix round's verify

`scratchpad/verify-b3s3-fix2.txt`:

```
run run-20260826T080323Z-c0f8
battery 8.0+rb43026c
ROW           OUTCOME  EVIDENCE
version       green    .groundwork-battery.json declares 8.0+rb43026c, and the rows compute the same digest
manifest      green    .groundwork/manifest.json declares 7 capabilities on 1 surface, and a discovered suite proves every one
honesty       green    the honesty scan read 783 tests in 9 suites, and every one can fail
wiring        green    the wiring scan read 67 exported functions in 54 files, and a non-test file names every one
token         green    the token scan is not applicable to profile cli, by declaration
run-evidence  green    the run-evidence row reconciled 783 discovered tests in 9 suites on 1 surface, and the run log names every one
mutate        green    the deletion test killed every one of 7 mutants it judged: sampled 10 of 98 targets at 8.0+rb43026c: killed 7 (1 by crash), 3 did not compile; 1 file was left out of this build
plan          green    docs/plan holds 1 program, 1 bet and 8 slices, and every id and reference in them resolves
chain         green    435 lines across 184 sessions in refs/groundwork/journal: every chain holds, and 353 lines came before the chain and went unchained, in 182 sessions with nothing chained
seal-verify   green    this repo holds no seal tag, so nothing is sealed and no covered path can have moved
10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0
```

`battery 8.0+rb43026c` — the digest has not moved since the build round. Nothing
in either fix round touched a row's id, kind or severity.

The battery is green with `go test ./...` red, and that is worth saying rather
than leaving for someone to notice. The red test reads this repo's own
`docs/findings.md` from the working tree. The mutate row runs its sample against
the packages it mutates and never reached `internal/findings`, and the
run-evidence row reconciles which tests ran, not whether they passed. So neither
row can see this failure. That is a real gap in the battery, and it belongs to
whoever owns the run-evidence row rather than to this slice — noting it here so
it is on the record either way.

Counts moved with the round: 783 tests where fix round one had 778, and the same
67 exported functions.
