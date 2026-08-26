# Findings

This file is the defects ledger. For each finding it records what it is, what caught it, and what happened. It is append-only.

## F1 — 2026-08-22 — The `legacy-final` tag exists only locally

What it is: the ratification sequence requires a `legacy-final` tag on origin. The session's git proxy rejects tag pushes with a 403. The `legacy` branch is on origin at that same commit, 275a2a7. The tag is not.

What caught it: the push failure during ratification.

What happened: open. The owner will push the tag from their own machine.

Resolved 2026-08-22: the owner pushed the tag. Verified on origin, pointing at 275a2a7.

Caught by: driver — the ratification push failure
Class: host-limit — a host proxy limitation, not a code defect

## F2 — 2026-08-22 — Stale counts in the ladder at ratification

What it is: the ladder's table of items to delete was headed "(17)" over 18 rows. Its coverage line said "118 of 118 items" after amendments had raised the total to 122.

What caught it: the driver's read during ratification.

What happened: fixed in the reset commit (75fbd5b).

Caught by: driver — the ratification read of the ladder
Class: record-not-written

## F3 — 2026-08-22 — Register and format defects in the first ledger drafts

What it is: the blind review of slice 0.1 found 16 defects. These were dense sentences, unexplained jargon, format drift, one ambiguous claim, and one overclaim.

What caught it: the slice's blind review.

What happened: 14 fixed before the slice landed. 2 overridden by the driver, because the review brief omitted facts the build brief carried: a named workflow file, and the exact branch pattern.

Caught by: blind-review — slice 0.1's register review
Class: register

## F4 — 2026-08-22 — Two defects in the legacy CI pin, caught in review

What it is: the pin's first draft left a bare `pull_request` trigger, so legacy's CI would still run on pull requests that target main. And legacy's release job strips a bare `v` from the tag name, so a `legacy-v*` tag would never match the package version and no release could publish.

What caught it: the slice's blind review. The reviewer flagged the second one as a suspicion; checking the job body confirmed it.

What happened: both fixed in the pin commit before it was pushed (f078a83).

Caught by: blind-review — slice 0.4's review of the CI pin diff
Class: green-but-wrong

## F5 — 2026-08-22 — A ledger commit landed on the wrong branch

What it is: the F4 entry was first committed to the local `legacy` branch. The driver's shell was still in the worktree that held legacy checked out.

What caught it: the commit output named the wrong branch.

What happened: the unpushed commit was reset away, and the entry was recommitted on the bet branch.

Caught by: driver — the commit output naming the wrong branch
Class: other — a git-discipline slip, no code involved

## F6 — 2026-08-22 — The port list needed two rounds of register review

What it is: the first draft of docs/carried-over.md had 21 register defects. The worst: evidence lines that were bare commit hashes no worker is allowed to look up, one circular evidence line, and about ten private terms used with no definition.

What caught it: the register review the execution plan requires, run in a separate session.

What happened: the port worker fixed the list and dropped two rules it could not evidence. The re-read cleared it after two one-line fixes. The file gained a glossary section the original brief did not name; the driver confirmed the addition.

Caught by: blind-review — the port list's register review
Class: register

## F7 — 2026-08-22 — The journal writer's first build had three real defects

What it is: the blind review of Bet 1 slice 1 found 20 items. Three were real defects in the writer: seq reset to 1 when the CLI ran from a subdirectory, an identical line could vanish while the CLI reported success, and concurrent writes dropped events with no retry. Two more were test-suite holes proven by mutation: the compare-and-swap and the session sanitizer were claimed but not tested — the suite stayed green with either removed.

What caught it: the slice's blind review, which ran mutation checks instead of reading for style.

What happened: all mandatory fixes were applied before the slice landed. Two low nits were skipped on driver ruling. The full review is archived at docs/evidence/bet-1/slice-1/blind-review.md.

Caught by: blind-review — slice 1's mutation review
Class: green-but-wrong
Class: unrun-proof

## F8 — 2026-08-22 — The dial and seal verbs had two real defects at review

What it is: a tag name carrying revision syntax could seal a commit the named tag does not hold — `v1~1` sealed the parent of v1. And the dial's from-chain broke on same-second writes from two sessions, falling back to alphabetical session order. Two mutation-proven test holes let the second defect through.

What caught it: the slice's blind review, through the built CLI in scratch repos.

What happened: both fixed before the slice landed, with pinning tests. The vocabulary and ordering rulings the review demanded are D13. The full review is archived at docs/evidence/bet-1/slice-2/blind-review.md.

Caught by: blind-review — slice 2's mutation review
Class: green-but-wrong
Class: unrun-proof

## F9 — 2026-08-22 — The spend query pinned a false statement about the record

What it is: a journal holding dial and seal lines but no dispatches printed "the journal is empty", and a test asserted that false message. Also: no spend test planted a line the package's own writer had not written, so the query's tolerance of foreign lines was argued, not shown.

What caught it: the slice's blind review — nine mutations and four scratch repos through the built binary.

What happened: the message split, the planted-line tests, and four rulings (D14) landed before the slice closed. The archive is docs/evidence/bet-1/slice-3/blind-review.md.

Caught by: blind-review — slice 3's mutation review
Class: green-but-wrong
Class: unrun-proof

## F10 — 2026-08-22 — The merge trusted a fetched ref it had no reason to trust

What it is: a hostile or corrupted journal commit could make the merge silently drop a local session's lines (a file where this side has a directory) or rewrite a line in place (a forged blob at an existing path) — while reporting success. And the merge's compare-and-swap, like the writer's before it (F7), was claimed but not proven: the force-update mutation left the suite green.

What caught it: the slice's blind review, building hostile commits with plumbing and driving them through the real API.

What happened: the merge now refuses any union in which a local entry does not survive unchanged, with the path named (D15). The concurrency race became a committed test. The unrun-proof recurrence this completes is ruled on in D16. Archive: docs/evidence/bet-1/slice-4/blind-review.md.

Caught by: blind-review — slice 4's hostile-commit review
Class: green-but-wrong
Class: unrun-proof

## F11 — 2026-08-22 — The first bounce: a verifier that could pass on nothing

What it is: the token cross-check could print ok and exit 0 in three ways that meant nothing was verified — a wrapped subtraction accepted any figure against the minimum int64, an empty or key-less sidecar passed with checked 0, and a post-merge seq collision was silently resolved by blob order.

What caught it: the slice's blind review, aimed where the builder's own D16 mutations would not reach — adversarial sidecar shapes and post-merge journal shapes.

What happened: the review returned bounce, the first of the rebuild. Two rulings (D17) resolved what a collision means and whether checked 0 may pass. The rework landed with new mutations named per claim. Archive: docs/evidence/bet-1/slice-5/blind-review.md.

Caught by: blind-review — slice 5's adversarial review, the first bounce
Class: green-but-wrong
Class: unrun-proof

## F12 — 2026-08-22 — The journal ref cannot reach origin from this session

What it is: the per-slice backup push must carry the journal ref (D11), but the host's git proxy rejects pushes to refs outside refs/heads — the same limitation that blocked the legacy-final tag (F1). The journal existed on one machine only.

What caught it: the driver's failed push during the live cross-check, and slice 6's blind review naming the gap at bet close.

What happened: the journal now backs up to the branch groundwork-journal, which the proxy allows. Any clone can restore the real ref from it with one update-ref. The driver records the mechanism as D20.

Caught by: driver — the failed push during the live cross-check
Class: host-limit — a host proxy limitation, the same as F1

## F13 — 2026-08-22 — The spec requires a hash-chained journal that no bet builds

What it is: proof.md requires a hash-chained journal, signed seal tags, and verify checking chain continuity. No build item carries it, no bet owns it, and bet 1 shipped the journal without a chain.

What caught it: the bet 2 design read, checking the spec against the ladder's coverage.

What happened: open — the chain work joins bet 3 with the seal machinery, by driver ruling in D26. The coverage gap itself is the finding: a ratified requirement had no owner, and the coverage check counted commitments, not requirements.

Caught by: worker — the bet 2 design dispatch, reading proof.md against the ladder
Class: coverage-gap

## F14 — 2026-08-22 — The spec's web profile has no probe list

What it is: proof.md names six topology profiles and lists universal probes for five of them. The web profile has no probe bullet. A web project's battery would have no ruled floor to stand on.

What caught it: the slice 2 builder, reading the profile list out of the spec.

What happened: open. The gap costs nothing until a web project exists; the bet that first serves one inherits it. Recorded so the spec's silence reads as known, not missed.

Caught by: worker — the slice 2 build, reading proof.md's profile table
Class: coverage-gap

## F15 — 2026-08-22 — The second bounce: the seam's two headline promises were fail-open

What it is: a capability was proven by any test file that existed — empty, unparseable, or never-built. A mutator that damaged nothing passed conformance. And discover and run agreed on one name out of seven across hostile shapes, with nothing reconciling them. All three passed the builder's own tables, which probed JSON shapes while these were filesystem and semantics shapes.

What caught it: the slice's blind review, running probes through the real row and the real conformance reporter.

What happened: bounce, the second of the rebuild. The discover-semantics silence went to the driver and came back as D30. The rework closes the fail-open set first. Archive: docs/evidence/bet-2/slice-2/blind-review.md.

Caught by: blind-review — slice 2's adversarial review of the seam
Class: green-but-wrong
Class: coverage-gap

## F16 — 2026-08-22 — A ledger test pinned a moving value

What it is: bet 1's findings tooling shipped a test asserting the live ledger's exact class counts — green-but-wrong at six. The ledger is append-only and the counts grow, so the test breaks on every new finding of a pinned class. It asserted the record's current state, not an invariant.

What caught it: slice 2's rework, when appending F15 broke the test from a package the slice never touched.

What happened: fixed as its own change, per the working agreement's rule for wrong tests. The test now asserts the invariant — every class at or over the threshold has a decision heading answering it — and floors, not exact counts.

Caught by: worker — the slice 2 rework, tripping over the pinned counts
Class: unrun-proof — the test proved the ledger's shape at one moment, not the property it claimed

## F17 — 2026-08-22 — The battery's first catch: seven dead exports in its own repo

What it is: the wiring scan's first run over this repo found seven exported functions no non-test file references — vocabulary accessors and a conformance helper shipped as speculative API across the earlier slices. Two were referenced by nothing at all.

What caught it: the battery — the wiring row, on its first real target. The first finding of the rebuild caught by machinery instead of a review.

What happened: the code was fixed, never the scan. Four functions deleted, three unexported. The slice 3 review checked the cleanup independently and confirmed all seven safe — and named an eighth the scan missed: adapter.Check is just as test-only, surviving on a name shared with another package. The scan's count is a floor, not the truth.

Caught by: battery — the wiring row's first run on this repo
Class: coverage-gap — API shipped ahead of any consumer

## F18 — 2026-08-23 — The battery's second catch: three journal vocabularies with no proof behind them

What it is: blanking journal.Rungs to a nil return left the whole suite green. Its one caller was a concurrency test that used it only to size a writer pool. Roles, Tiers and SealActions had no assertion anywhere. The closed vocabularies D12 and D13 ruled were unproven.

What caught it: the battery — the mutate row's first run during the slice 5 build, before the slice landed.

What happened: a pinning test in internal/journal now asserts each vocabulary from the ledger's own lists, and proves every accessor hands back a copy. The test gap was fixed, never the scan.

Caught by: battery — the mutate row, during the slice 5 build
Class: unrun-proof

## F19 — 2026-08-23 — The third bounce: the deletion test misclassified its own failure modes

What it is: the mutate row called a file the build excludes a surviving mutant — a false red on ordinary layouts, including one this repo uses. It went green after its budget died mid-sample, blaming the project's suite for its own clock. Its headline isolation claim had no test that could fail — removing the isolation left the suite green, as did five other mutations of the new adapter code. And its throwaway copy dropped the project's git record, so two of this repo's own packages were excluded as "tests do not pass unmutated" when their tests pass fine.

What caught it: the slice's blind review. The builder's session had died before handoff, so no D16 or D18 tables existed; the review ran the full sweep itself — nineteen mutations, twelve fixture repos, instrumented runs through the real row.

What happened: bounce. The driver's rulings are D33: targets come from the build, the sample reconciles as printed numbers, budget death is unrunnable, the copy is faithful, isolation is proven by a test that fails without it. The rework follows.

Caught by: blind-review — slice 5's independent sweep
Class: green-but-wrong
Class: unrun-proof

## F20 — 2026-08-23 — The holdout record was never written

What it is: D26 says the held-out answer keys are sealed before slice 1 and recorded in docs/evidence/bet-2/holdout.md. The keys were sealed — both branches carry their answer-key commit — but the file did not exist. The record lived only in the ledger's ruling and the branch history.

What caught it: the driver's slice 7 preparation, checking the holdout assets against D26.

What happened: the file is written, recording the branch tips at sealing (93801c2 and 8d1790f), the sealing rules, and an empty grading section for slice 7 to fill. No answer key was read to write it.

Caught by: driver — the slice 7 preparation read
Class: record-not-written

## F21 — 2026-08-23 — The fourth bounce: the rework's own fixes opened three new doors

What it is: the slice 5 rework closed every original finding, and its newest code held three defects of its own. The faithful copy carried a linked worktree's .git file verbatim, pointing the throwaway copy at the developer's real object store — mutated code could commit onto their branch. The new go list call inherited the parent's PWD, so a repo entered through a symlink lost every package and the row printed "nothing to delete" about a project full of exported functions. And the crash-kill class read go test's timeout panic as a kill, so a mutant that wedged the suite forever counted as caught.

What caught it: the slice's blind re-review, aimed at the rework's newest code — the go list integration, the D34 boundary, and what carrying .git might open.

What happened: bounce, the second on this slice and the fourth of the rebuild. The driver's rulings are D35: a .git file is refused as unrunnable, a timeout panic is a clock death never a crash, and the numbers-never-cut rule binds the whole accounting. The fix round follows.

Caught by: blind-review — slice 5's re-review of the rework
Class: green-but-wrong
Class: unrun-proof

## F22 — 2026-08-23 — The third round on slice 5: the ladder's last rung, and two guards proven hollow

What it is: the verification review confirmed all three second-round escapes closed, and found the round's own headline claim short. The evidence ladder's last rung can exceed the journal cap on legal inputs — a long declared version with a grading-sized sample — after which a count is cut, the one thing D35 forbids. The two could-not-write guards each passed the other's only test, and removing one turns an unwritable mutant into a false-red survivor. And the borrowed-record guard refuses a .git file anywhere in the tree, so a self-contained project keeping a linked-worktree fixture under testdata goes permanently unrunnable on a false sentence.

What caught it: the slice's verification review — the third round, which computed the line's bound from the code's own wordings instead of trusting the handoff's measured 194 bytes.

What happened: bounce, narrower than the last. The rulings are D36: the last rung provably fits by collapsing classes, and the guard refuses only where a .git file can govern a run. The fix round follows. A pre-existing residue is also on record now: the crash marker is prefix-matched, so a passing suite that prints the timeout panic's words can be misread — older than this slice, noted for a later bet.

Caught by: blind-review — slice 5's verification round
Class: green-but-wrong
Class: unrun-proof

## F23 — 2026-08-23 — Two residues accepted at slice 5's close

What it is: the closure check left two small gaps standing. The could-not-read guard is still shielded by its write-side sibling — its lone consequence needs a file to vanish from a directory only the row touches, inside the throwaway copy. And the name-fitting helper under-counts names in shapes no real tally can produce: the trigger needs a trailing name of eight bytes or fewer, and the shortest real name is nineteen.

What caught it: the closure check on the slice's third review round.

What happened: both accepted as residue by driver ruling, recorded here so they are known rather than found again. Either becomes real work the day its trigger becomes reachable.

Caught by: blind-review — slice 5's closure check
Class: other — accepted residue, no live path to a wrong outcome

## F24 — 2026-08-23 — The fifth bounce: a waiver rewritten in a feature diff still stood

What it is: the own-commit check asked git for the commit that added the waiver file, but the content that governs is HEAD's. Any later feature commit could rewrite the row, the reason and the expiry, and the waiver stood — renewable forever, exactly the buried-in-a-feature-diff shape D24 forbids. Beside it: a quarantined row's evidence could overflow the journal cap and kill the whole run the quarantine outcome exists to protect; a control character in a committed reason forged rows in the printed table; and the ci.yml ruling from D37 was not applied because it was ruled after the builder's handoff.

What caught it: the slice's blind review, which attacked the waiver machinery as a privilege system — and proved with a mutation that the stricter rule passes every existing test, so no test distinguished the two.

What happened: bounce, the fifth of the rebuild. The rulings are D38: the waiver's authority is its last commit; every journaled line proves its bound by arithmetic — now a general rule; reasons and file names are charset-checked like row ids. The fix round follows.

Caught by: blind-review — slice 6's review of the waiver forensics
Class: green-but-wrong
Class: unrun-proof

## F25 — 2026-08-23 — A second builder died silently, and the handoff rule did not hold

What it is: the slice 6 fix-round builder's session died after finishing the code but before reporting. The as-you-go handoff rule existed because the slice 5 builder died the same way — but the handoff file was last touched an hour before the work stopped, so the round's record was the code alone. The driver noticed by the file's timestamp, five hours later.

What caught it: the driver, checking the handoff's timestamp against the tree's.

What happened: the driver verified the round directly — full suite, vet, format, verify on this repo all green, all four HIGH fixes present in code — and the closure check now stands as the round's independent record. The rule gains teeth going forward: a fix-round dispatch names the handoff update as part of each finding's closure, not a courtesy at the end.

Caught by: driver — the stale handoff timestamp
Class: record-not-written
Class: host-limit — sessions die without notice; the record must not depend on their last breath

## F26 — 2026-08-23 — The hijack came back through a merge

What it is: the slice 6 fix bound a waiver's authority to its last commit, and the closure check broke it again — the diff reader prints nothing for a merge commit, so a waiver rewritten inside an evil merge stood with its row swapped and its expiry renewed. The mutation that would fix the reader survived the whole suite, the same shape as the round before. Beside it: the new no-abort promise for unreadable waiver files had no test that could fail alone, and one comment still described the behaviour the round reversed.

What caught it: the slice's closure check, probing the new rule's edges rather than re-running the old probes.

What happened: the driver ruled D40 — a merge never governs a waiver, extending D37.3 from introduction to governance. The final fix round follows.

Caught by: blind-review — slice 6's closure check
Class: green-but-wrong
Class: unrun-proof

## F27 — 2026-08-23 — The holdout's catch: the wiring row calls a library's public API dead

What it is: the wiring row's rule — an exported function no non-test file names is unwired — is wrong for a library, whose callers live in other repos. On the held-out go-fieldkit it flagged 8 of 11 exported functions, including the public API of all three capabilities the key calls honest. The one false red of the grading, and the bet's done condition says there must be none. The row never reads the manifest's profile; the token row beside it does, and stands down by name on the same declaration.

What caught it: the held-out grading — a repo shape the battery had never faced. This repo is a cli surface whose exports all have in-repo callers, so the row could never fail here.

What happened: ruled in D41 — the wiring row learns profiles, and the fix is tuning after a graded run, so the battery version moves major and the 4.0 grading stands as recorded on a burned holdout. The fix lands as its own slice.

Caught by: battery — the held-out grading run, the mechanism built to catch exactly this
Class: coverage-gap — a rule shipped without ever confronting the profile it misjudges

## F28 — 2026-08-23 — Named losses on the node surface, so the record carries them

What it is: two planted defects went uncaught on ts-tallysheet: a deletion survivor and a vacuous suite, both behind rows that are unrunnable on a node surface this bet. And the one catch there leans on the adopter: had summary not been declared, three hollow capabilities would have passed unseen — no row this bet finds an orphan spec file on a node surface. The unrunnable sentences themselves graded honest.

What caught it: the held-out grading, naming what the unrunnable rows cost.

What happened: recorded as expected losses. The node-surface scans and mutation land with the adapter seam's later bets; this entry is the marker that the gap is known, not missed — F13's lesson.

Caught by: blind-review — the grading dispatch's audit of the unrunnable rows
Class: coverage-gap

## F29 — 2026-08-23 — The version bump rotated the mutation sample, and three real survivors fell out

What it is: three of this repo's own exported functions survive being deleted. `internal/adapter/exec.go` `(*Exec).Name`, `internal/findings/findings.go` `Classes`, and `internal/journal/git.go` `FilesIn` were each blanked and their package's whole suite stayed green. All three are used and all three are wrong to be unproven: Name is how a run says which stack an answer came from, Classes is the defect vocabulary every class check reads, and FilesIn is what tells a waiver commit from a commit that carried something else. `Classes` is the sharpest of the three — the one test that touched it read it in a loop, so an empty list made the loop pass on nothing.

What caught it: the battery's own deletion test, on this repo, once D41 moved the version to 5.0. The sample is drawn from the target list hashed with the version, on purpose, so that coverage walks the codebase instead of circling one corner of it. The bump drew a different 10 of the 73 targets and these three were in it. At 4.0 none of them had ever been sampled.

What happened: fixed in the same slice, because the bump that exposed them is that slice's own. One test per function, each proven by blanking the function and watching the new test die. No existing test was changed.

Caught by: battery — the deletion test on this repo, after the version bump rotated its sample
Class: unrun-proof — three functions whose suites passed without them

## F30 — 2026-08-23 — An adoption choice erased the one node-side catch

What it is: stonecrop's never-run plant — a suite the project's own test command never matches — was caught by the manifest row only under an adapter that discovers exactly what the project's test command runs. The runner's adapter matched a wider glob, ran the orphan suite, and the catch vanished: exit 0 over three hollow capabilities. No battery row reads the project's own test command, so nothing could notice the difference. The grader proved both directions: narrow the glob and the manifest row goes red naming backoff.

What caught it: the 5.0 grading, auditing the adapter question the runner had flagged.

What happened: recorded against the later bet that ships node-surface scans — the adapter conformance there must pin discovery to the project's own test command, so an adopter cannot widen away a never-run signal. The Go side of the same grading was clean: no false reds, all plants caught, one unplanted real hole found.

Caught by: blind-review — the 5.0 grading dispatch
Class: coverage-gap

## F31 — 2026-08-23 — The wip-snapshot branch cannot be deleted from this session

What it is: D27 says the wip-snapshot branch is deleted at bet close. The host's git proxy refuses branch deletion with a 403, the same limitation that blocked tag pushes (F1, F12). The branch sits on origin holding the last slice 8 handoff, which is now merged history.

What caught it: the driver, running the bet 2 close-out mechanics.

What happened: open. The owner can delete it from their own machine with one push. It holds nothing unmerged, so the cost is clutter, not risk.

Caught by: driver — the refused deletion at bet close
Class: host-limit

## F32 — 2026-08-23 — A ratified requirement with no owner, again: verify from the installed package

What it is: proof.md requires universal checks to run from the installed package, never the working tree, with verify confirming the package hash against the lockfile. No commitment row carries it, so no bet owns it — F13's shape, found the same way, because the coverage count counts commitments, not requirements.

What caught it: the bet 3 design's coverage read, the standing duty D31 created.

What happened: assigned by D44 to bet 15, which hands three live installs from a package to an installed binary — the first bet where the requirement has something real to bind.

Caught by: worker — the bet 3 design dispatch, reading proof.md against the ladder
Class: coverage-gap

## F33 — 2026-08-23 — Three named deferrals from the bet 3 design

What it is: three spec requirements bet 3 can only half-carry, named so the halves do not read as wholes. A probe diff turns seal-verify red in bet 3, but re-running the adversary needs the adversary — bet 8. The archive step's frozen board and capsule index need capsules and an archive verb no lands line names — assigned to bet 8 beside the capsules. And test markers on non-Go stacks land with each stack's adapter bet, R9 covering Go alone.

What caught it: the bet 3 design's coverage read.

What happened: recorded, each with its owner. F28 and F30 are the model: a known gap with a name is a boundary; a silent one is F13.

Caught by: worker — the bet 3 design dispatch
Class: coverage-gap

## F34 — 2026-08-24 — The battery's fifth catch: ParentsOf survived in its own package

What it is: the 6.0 sample drew journal.ParentsOf and it survived blanking — its package's 142 tests stayed green. The function is what tells a merge commit from an ordinary one, and the waiver machinery's merge refusal stands on its answer. The tests that prove that refusal live in the battery package, and the deletion test is package-scoped on purpose, so they did not count.

What caught it: the battery — the mutate row on this repo, on the sample the 6.0 bump rotated in.

What happened: a pinning test in internal/journal now asserts the three shapes a repo can put in front of ParentsOf — a root commit has none, an ordinary commit has one, a merge has both in order — proven by blanking the function and watching the test die alone. The gap was fixed, never the scan, the same as F18 and F29.

Caught by: battery — the mutate row's rotated sample at 6.0
Class: unrun-proof

## F35 — 2026-08-25 — The count-cut class fires a fourth time: the plan row's red line

What it is: the plan row's red evidence puts the problem count last — "<first problem> (and N more problems)" — and the row clips evidence at 200 bytes from the front. A long first problem eats the count. The reader fixes one problem and meets the next one cold. D33 ruled that words give way, never counts. A second cause sits beside it: resolver messages interpolate caller-supplied paths up to 300 bytes unclipped, while every other value in the package is clipped at 60 runes. Neither the red line nor the green line has the bound test D38.2 requires.

What caught it: the blind review of bet-3 slice 1, with a reproduced probe — a 245-byte path plus a second broken reference, and the count gone at 200 bytes.

What happened: open. The fix round moves the count to safety, clips interpolated paths, and binds both printed lines.

Caught by: blind-review — the slice 1 dispatch
Class: other — an evidence line designed so the count is what truncation eats

## F36 — 2026-08-25 — Three unclaimed corners in the plan id space

What it is: the parser enforces slice→bet agreement but not bet→program, so a bet file can name a program it does not sit under and be adopted by another program's ladder. Proof markers are checked as prefixes and never claimed as ids, so two proofs can share one test name — and one test result must map to one proof for the board to derive. Ladder entries are declarations of bet ids but sit outside the unique-id space, so a ladder can name one bet twice, two ladders can claim the same bet, and a milestone can wear a ladder entry's id.

What caught it: the blind review of bet-3 slice 1, each shape reproduced loading clean.

What happened: open. The fix round closes all three symmetrically with the checks that already exist.

Caught by: blind-review — the slice 1 dispatch
Class: coverage-gap

## F37 — 2026-08-25 — A slice's rulings never reached the ledger, and one invented a field

What it is: slice 1 made at least eight rulings the design does not carry — six parser caps, the top-level tree rule, the flat id space, the error policy, the optional-field set — and none reached docs/decisions.md. One ruling invented a machine-read field, touches_data, that R2's closed field list does not name and that can only ever disagree with the data block beside it. The builder died at the usage limit before any record could be written, and the driver's completion pass covered code, not record.

What caught it: the blind review of bet-3 slice 1, reading the diff against R2 and against CLAUDE.md's record rule.

What happened: D45 records the rulings and removes the invented field. The class already has a ruling — D39's landing checklist — and this entry is that checklist earning another line: the record check must cover rulings embedded in code, not just evidence files.

Caught by: blind-review — the slice 1 dispatch
Class: record-not-written

## F38 — 2026-08-25 — The derivation contract claims completeness and is not complete

What it is: docs/derivation-contract.md says "The rules, all of them:" and then names none of the six size and depth caps the parser enforces, nor the rule that docs/plan itself holds only directories. R17 makes this page the one place a parsed shape is written down, so a gap here is a gap in the contract itself.

What caught it: the blind review of bet-3 slice 1, grepping the page for every cap.

What happened: open. The fix round writes the caps and the top-level rule into the page.

Caught by: blind-review — the slice 1 dispatch
Class: record-not-written

## F39 — 2026-08-25 — A plan directory with no parseable unit went red where D17 says unrunnable

What it is: the ratified design says a docs/plan that exists but holds no parseable unit is unrunnable. The built row says red for a docs/plan holding only a README, and red for a program directory with no program.md; only a byte-empty docs/plan gets unrunnable. The divergence is unrecorded and the contract page does not mention it.

What caught it: the blind review of bet-3 slice 1, end-to-end through the built binary.

What happened: D45.2 rules it — no program directory means unrunnable, naming what the directory holds; a stray file beside a real program is red. The fix round aligns the row.

Caught by: blind-review — the slice 1 dispatch
Class: other — a built verdict diverging from a ratified ruling, unrecorded

## F40 — 2026-08-25 — Assertions weaker than they read: three rules survive removal

What it is: the 64 KiB file cap can be blanked and the plan suite stays green — the hostile case asserts only "bytes", which the scalar cap's message satisfies first. The .md-suffix rule and the file-where-directories-belong rule survive removal the same way: their cases assert only that the error names the file, and nearly any downstream failure does. The contract-agreement test passes 18 of 40 field names on a bare substring match, so gutting the field tables goes uncaught for common words like id, title, and program.

What caught it: the blind review of bet-3 slice 1, by removing each rule and watching the suite.

What happened: open. The fix round pins each rule so removing it kills a test — the same cure as F18, F29 and F34.

Caught by: blind-review — the slice 1 dispatch
Class: unrun-proof

## F41 — 2026-08-25 — Every from: anchor in the dogfood is dangling

What it is: all 24 from: references in docs/plan/rebuild/bet_3/ point at anchors like #r1 and #slice-1, and none resolve against design.md's real heading slugs. The shape check passes on purpose — anchor resolution is slice 6's trace row — but by slice 6 the design will be sealed under R3, and fixing a dangling anchor then costs the amendment protocol.

What caught it: the blind review of bet-3 slice 1, computing every slug.

What happened: open. The fix round repoints every anchor at a real slug now, while the design is unsealed. D45.4 rules that design.md is not edited to fit the anchors.

Caught by: blind-review — the slice 1 dispatch
Class: coverage-gap

## F42 — 2026-08-25 — Two smalls: dead code below the scans' floor, and a two-hash anchor

What it is: atLeastOneLine in internal/plan/bind.go is called by nothing, and being unexported it sits below both the deletion test and the wiring row. And from: accepts docs/design.md#one#two, cutting at the first hash and silently keeping the rest.

What caught it: the blind review of bet-3 slice 1.

What happened: open. The fix round deletes the function and refuses the second hash.

Caught by: blind-review — the slice 1 dispatch
Class: coverage-gap

## F43 — 2026-08-25 — The unrunnable counter counts the wrong thing, and deleting one file silences the row

What it is: the F39 fix counts program.md files to decide unrunnable. A docs/plan holding a complete, parseable bet and slice — but no program.md — reports unrunnable, and unrunnable never fails a run. The closure check proved it with two repos identical but for that one file: with it, the row is red on a real misstatement; without it, the misstatement stops being reported. D45.2's own sentence is the test it fails: that directory offers files to parse, and they misstate. A missing program.md above a real bet is itself a misstatement, so the counter must count plan files met, not program.md alone.

What caught it: the closure check on the slice 1 fix round, probing the fix it had asked for.

What happened: open. The second fix round makes the counter count what D45.2 means.

Caught by: blind-review — the slice 1 closure check
Class: coverage-gap

## F44 — 2026-08-25 — Two smalls from closure: an unpinned clip, and the page silent on what may be left out

What it is: resolveSlice clips the proof's from path exactly as resolveBet clips the design path five lines away, but only the design half has a test that dies when the clip is removed — D38.2's bound is unproven on the other half. And the contract page, now complete on caps and rules, still never says which fields are optional: facing, records, premises and deferred may all be left out, and a writer cannot learn that from the page the dogfood itself relies on.

What caught it: the closure check on the slice 1 fix round.

What happened: open. Folded into the second fix round beside F43.

Caught by: blind-review — the slice 1 closure check
Class: unrun-proof

## F45 — 2026-08-25 — The counter's program-file half had no pin of its own

What it is: removing walkProgram's own increment left every suite green, because every fixture with a program.md also held a bet or slice file doing the counting. The uncounted shape is the first state of every new plan — a program.md alone, no bets cut yet. Without the increment, that real, readable plan reads as nothing to parse: F43 inverted. The behavior was correct; only the pin was missing.

What caught it: the round-2 closure check, probing the F43 fix it had asked for.

What happened: fixed at landing by the driver, as the closure specified: one test, TestAProgramFileAloneIsAPlanNotNothing, proven by blanking the increment and watching it die alone with the closure's exact line. The register nit in planrow.go's comment was fixed in the same pass.

Caught by: blind-review — the slice 1 round-2 closure
Class: unrun-proof

## F46 — 2026-08-26 — The row test seam samples against the wrong version

What it is: runRow in the battery's own tests builds a Context with no Digest. The mutate row hashes its sample against the battery version, both halves, so a row run through runRow picks a different ten mutants than a real verify run does. The builder paid one five-minute run against the wrong sample to find this.

What caught it: the slice 2 builder, instrumenting the mutate row to find a survivor.

What happened: open. It is the mutate row's own test seam, and the fix belongs in its own change, not smuggled into a journal slice.

Caught by: worker — the slice 2 build
Class: parallel-definition

## F47 — 2026-08-26 — The battery's sixth catch: two more survivors at the 7.0 rotation

What it is: the 7.0 bump rotated the deletion test's sample onto two functions whose suites passed without them — the Go adapter's Name, and the journal's ChangedFiles, sitting beside the two functions F29 caught the same way.

What caught it: the battery — the mutate row's rotated sample at 7.0, exactly as the bet 3 design's risk list predicted.

What happened: both fixed in the slice, the F29/F34 way — one test per function, each proven by blanking the function and watching its test die alone. The scan was never touched.

Caught by: battery — the mutate row's rotated sample at 7.0
Class: unrun-proof

## F48 — 2026-08-26 — In the default mode, the chain covers nothing

What it is: with GROUNDWORK_SESSION unset — the tool's default — sessionID generates a fresh id per write, so every journal line lands in its own one-line session, seq 1, empty prev. There is nothing to chain and nothing to check. The reviewer ran a full verify on a copy: ten lines, ten sessions. Then it deleted a line from the ref and the chain row stayed green — the exact deletion R7 promises to make evident. Every chain test in the slice sets the variable first, so nothing exercised the default. The green line compounds it: "every chain holds" over 191 one-line chains reads as coverage where there is none.

What caught it: the blind review of bet-3 slice 2, probe J, through the slice's own verify.

What happened: D49.1 rules the session run-scoped. The fix round carries it.

Caught by: blind-review — the slice 2 dispatch
Class: front-door-hollow

## F49 — 2026-08-26 — A forged journal line can print a row of its own

What it is: clipSession clips length only and never calls printable, the function D38 ruling 4 added for exactly this. The session name on a read line is forger-controlled through git plumbing, and a name carrying a newline and tabs draws a forged row in the verify table — the reviewer rendered a fake "seal green" row from one planted line.

What caught it: the blind review of bet-3 slice 2, probe D2, rendered through the real table shape.

What happened: open. The fix is one call and one test in the waiver precedent's shape.

Caught by: blind-review — the slice 2 dispatch
Class: green-but-wrong

## F50 — 2026-08-26 — Three rules stated as fact, proven by nothing

What it is: three probes survived the whole suite. Flipping the doubled-seq tie-break (D48 ruling 8, "both clones land in the same place") changed nothing. Turning the error branch red (D48 ruling 4, the named divergence) changed nothing — no test reaches that branch. Removing the red line's cut changed nothing — the fit assertion can never fire while the cut it tests is present, F35's class again, and D38's arithmetic-bound shape already landed on the waiver line as the precedent.

What caught it: the blind review of bet-3 slice 2, mutations m05, m15, m17, each re-confirmed serially.

What happened: open. Three tests, one of which the reviewer wrote and left ready.

Caught by: blind-review — the slice 2 dispatch
Class: unrun-proof

## F51 — 2026-08-26 — Two ways past the chain the ruling never named

What it is: a line rewritten in place — left at its old path, which is the sha256 of the line, as the code's own comment says — stays green, though comparing path to content is free. And a whole session invented in the v1 shape is green: three freely authored lines, no hashing at all, indistinguishable in the aggregate unchained count from a genuine prefix. D48 ruling 1 closed the mid-session downgrade; the whole-session forgery is cheaper and was still open.

What caught it: the blind review of bet-3 slice 2, probes A, B and G.

What happened: D49 rules both — the path check goes in; the invented-session limit is named and accepted until the seal work. The tip-rewrite case is inherent to a hash chain and R4's signature is its only answer, as R7 already says of forward rewriting.

Caught by: blind-review — the slice 2 dispatch
Class: coverage-gap

## F52 — 2026-08-26 — Three smalls in the break messages

What it is: a not-JSON break borrows seq 0, a seq no line has. A planted line at seq 0 makes the gap message name a seq that is present. A line with no session field groups under the empty string and reads green.

What caught it: the blind review of bet-3 slice 2, probes E, I and F.

What happened: open. The fix round tightens each message and makes the missing-session line a break.

Caught by: blind-review — the slice 2 dispatch
Class: coverage-gap

## F53 — 2026-08-26 — The fix round turned the plainest deletion into a crash

What it is: the fix round removed the i > 0 guard from the duplicate-seq check, so a session whose first line was deleted — the walk opening at seq 2 — indexed one before the start and panicked. The battery has no recover around row checks, so the whole verify process died: no red, no unrunnable, no journal line. The pre-fix code handled the case correctly. It survived because no test deleted a first line, and none of this repo's 183 sessions starts above seq 1 — latent, not absent.

What caught it: the round-2 closure check, probe P, through the real library and the real row.

What happened: fixed at closure by the driver — the guard restored, and a test that deletes a session's first line, proven by blanking the guard and watching the reviewer's exact panic come back.

Caught by: blind-review — the slice 2 closure check
Class: green-but-wrong

## F54 — 2026-08-26 — The widest-line proof measured the narrower branch

What it is: the new arithmetic bound test handed its break a seq below one, and the renderer prints no seq for those — so the "widest" fixture skipped the seq and measured 165 bytes against a real worst case of 192. The bound held, with 8 bytes of true slack where the test believed 35. With cut gone, that test is the only thing between a growing cap and a failed journal write.

What caught it: the round-2 closure check, probe Q, by computing both widths.

What happened: fixed at closure by the driver — one word, the seq moved to its widest legal value, so the test now measures the branch that prints everything.

Caught by: blind-review — the slice 2 closure check
Class: unrun-proof

## F55 — 2026-08-26 — A blanking table that cannot tell three answers apart

What it is: a blanked rule can kill a test, survive, or fail to build — and a harness that folds the third into either of the first two reports false confidence in both directions. Three of the fix round's seventeen patches did not compile on the first pass and briefly read as survivors. The reviewer hit the same class from the other side: a mutation that lowered a floor to a value that can never fail looked like a clean run and proved nothing.

What caught it: the fix round's own table, and the closure check naming the class.

What happened: recorded as a rule for reading blanking tables — did-not-build and can-never-fail are non-answers, and a sweep counts only mutations that ran and could have failed. The fix round's harness already prints the build failure instead of folding it.

Caught by: worker — the slice 2 fix round, with the closure check naming the class
Class: other — a proof harness whose failure mode reads as proof

## F56 — 2026-08-26 — Two smalls from the final re-check, fixed at landing

What it is: D50.1 claimed the %q dependency was named in the code, and it was not — the ruling was true everywhere except the one place it pointed at. And the first-line-deletion guard's only test lived one package up from the guard, so blanking it left the journal package green on its own.

What caught it: the final re-check on slice 2, which verified the ruling's claim instead of trusting it.

What happened: fixed at landing by the driver. The unrunnable branch's comment now names the %q dependency, making D50.1 true. A journal-package test deletes a session's first line beside the guard it pins, proven by blanking the guard and watching it die in its own package.

Caught by: blind-review — the slice 2 final re-check
Class: record-not-written

## F57 — 2026-08-26 — No SSH signature can be made or checked in this container

What it is: the container has no ssh-keygen, and git's SSH signature path needs it on both ends. No SSH-signed tag can be created here and none can be verified here. The slice plan asked the byte-for-byte restore proof to sign with a throwaway key generated in the test; it cannot.

What caught it: the slice 3 builder, building the restore proof.

What happened: worked around, not papered over. The proof plants a real tag object carrying a signature block — a tag's id is the hash of its own bytes, so the round trip proves what a signature needs. A machine with no verifier reports unverified in its own words, never verified: the failure direction is the safe one. The named consequence: the Verified branch of checkSignature has no test this repo can run, the same limit R4 records from the other end. The owner's machine, which has keys, is where that branch first runs for real.

Caught by: worker — the slice 3 build
Class: host-limit

## F58 — 2026-08-26 — A slice that asks too much of one sitting

What it is: slice 3 landed about 5,100 new lines in one review sitting — a package, four verbs, a battery row, a contract section, and the journal widening. The working agreement says a slice is small enough for a reviewer to judge in one sitting, and this one strains it. It was built whole because the pieces lean on each other, but it could have been cut: the tag and its parse; the verbs and the mirror; the row.

What caught it: the builder, raising its own slice against the agreement.

What happened: the driver rules for the next designs — a verb family this size is cut at those seams, and the bet design says so at design time, not at build time. This slice proceeds whole because re-cutting it now would re-review the same lines three times.

Caught by: worker — the slice 3 build
Class: other — a scope call surfaced by the agent it burdened

## F59 — 2026-08-26 — One junk file on the mirror turns off restore, and the wreck it leaves verifies green

What it is: the mirror walker errors out for the whole tree when any single file under tags/ is not a seal tag name, and it backs both restore and the grant's mirroring. One scribbled file on groundwork-seals — the one branch R5 makes pushable on purpose — stops every tag from being restored and every future grant from mirroring. The neighbouring index reader already takes the opposite policy for the same class, with a comment saying why. Worse: the grant that fails at the mirror step leaves its tag standing, and that half-made seal verifies green with nothing anywhere showing the wreck.

What caught it: the blind review of bet-3 slice 3, through the built binary.

What happened: open. The fix skips and reports the bad file the way the index reader does, and the half-made seal question goes to the fix round with D52.

Caught by: blind-review — the slice 3 dispatch
Class: front-door-hollow

## F60 — 2026-08-26 — The signature states blur exactly where D51.1 said they must not

What it is: three defects in one cluster. Verify counts every not-verified seal as unsigned, so a forged signature block prints as "1 unsigned" — the exact blur D51.1 forbids, in the summary line and the row's clause both. The unverified note has one vague sentence for three situations, and the branch every run of this repo takes is the one reading "did not verify against .groundwork/allowed-signers" — which sounds like a checked-and-bad answer when nothing here could check at all. And the signer is parsed from GPG status output that git's SSH path never produces, so on the owner's machine a verified amendment would record an empty signer and fall through to the wrong note.

What caught it: the blind review, with a forged-block probe and a shimmed verifier.

What happened: open. D52 rules the fix directions.

Caught by: blind-review — the slice 3 dispatch
Class: green-but-wrong

## F61 — 2026-08-26 — The widest-line proof measured the wrong branch again

What it is: F54's defect, one slice later. The seal row's widest-line test feeds huge counts into every field, and huge counts are exactly what make the unsigned clause drop off — so it measures 174 bytes where the true widest red line is 200, with zero slack. And the row's comment claims the unsigned clause is on every line, which is false above a thousand seals: the loud clause R4 asks for goes silently conditional at scale.

What caught it: the blind review, by searching the count space for the true maximum.

What happened: open. D52 rules the clause guaranteed by arithmetic, not best-effort. Two entries now stand in this class; the next widest-line test starts from the search, not the guess.

Caught by: blind-review — the slice 3 dispatch
Class: unrun-proof

## F62 — 2026-08-26 — F57 is wrong about signing: this host can sign, and cannot verify

What it is: F57 said no SSH signature can be made here. False: the host's git config carries gpg.format=ssh and a signing shim, and git tag -s succeeds, producing a real SSH signature block. What remains true: verification fails — the shim only signs — and the shim's public key is unreadable (a zero-byte file), so no allowed-signers entry can be built for it. The Verified branch still has no runnable test here and the failure direction is still safe. The record was wrong about the mechanism, right about the consequence.

What caught it: the blind review, by making a signed tag.

What happened: recorded — this entry corrects F57, which stands as the record of what the builder believed. The ledger is append-only; corrections are new entries.

Caught by: blind-review — the slice 3 dispatch
Class: record-not-written

## F63 — 2026-08-26 — Restore and proof gaps: a lying name, a dead guard, two unproven rules

What it is: four related gaps. Restore rebuilds a tag under a file name its own bytes do not declare, reporting "restored" for a lie verify then has to catch. The missing-index guard can never fire — cat-file exits 128 where the check wants 1 — so a mirror with tags but no index fails the whole restore with a raw git error. Blanking the index-versus-bytes check kills nothing: D51.6's index half has no test. And the R4 headline proof walks the no-signers branch — this repo commits a signers file, so the proof exercises the branch this repo never takes, and blanking the no-signers branch kills nothing. Beside them, two can-never-fail shapes: a comment claiming git reflows what git does not, and a dead condition after a loop that already guarantees it.

What caught it: the blind review's own 37-mutation sweep — 31 killed, 2 survived, 2 can-never-fail — against the builder's 48-of-48 table.

What happened: open. The fix round closes each with its test or its honest comment.

Caught by: blind-review — the slice 3 dispatch
Class: unrun-proof

## F64 — 2026-08-26 — One path rule stated three ways

What it is: the covered-path charset allows a leading underscore; the contract page says a path starts with a letter, digit or dot; the error message says a third thing, and says it in a sentence that needs a second reading. The page also never gives the Battery-Run shape the parser enforces, and its list of red causes omits the name-versus-message check. The slice-1 rule — page and parser agree in both directions — broken three ways in the section this slice added.

What caught it: the blind review, through the built binary with a leading-underscore path.

What happened: open. D52 rules the direction: the code tightens to the page.

Caught by: blind-review — the slice 3 dispatch
Class: parallel-definition

## F65 — 2026-08-26 — Who signed is printed, never recorded, and the signers file is read from the wrong place

What it is: D51.3 put the amendment reason on the journal line because a reason only printed is not on the record. The amended tag's signature state and signer get exactly the treatment that ruling forbids: one terminal line, then gone. R6 says the record states who signed. And verification reads the signers file from the working tree where R4 says committed — an agent can swap the file on disk without a commit, and nothing warns.

What caught it: the blind review, reading R6 and R4 against the code.

What happened: open. D52 rules both.

Caught by: blind-review — the slice 3 dispatch
Class: record-not-written

## F66 — 2026-08-26 — Seven smalls from the seal review

What it is: a battery run with every count at zero grants a seal, and a run that checked nothing is not a green run. The seal verb reads any annotated tag, quoting a release tag's text back through seal machinery. A revoked seal still answers the cross-check from its older granted line if an amend dies between its two writes. short() is the one clip in the slice that skips printable. Amend prints counts where R6 asks for the before and the after. A journal comment says grants carry no reason while the amend's granted line carries one. Two comments and one error message run long enough to need a second reading.

What caught it: the blind review.

What happened: open. Folded into the fix round.

Caught by: blind-review — the slice 3 dispatch
Class: coverage-gap

## F67 — 2026-08-26 — The wreck moved from the tag to the mirror

What it is: the atomic grant rolls back one of its three writes. A journal failure after the mirror succeeded takes the tag down and leaves the mirror blob, and the grant then says "no seal was granted" — false: the next restore, in any clone, produces the seal and verify calls it sound. F59's wreck travels on the branch instead of standing locally, and D52.2's "tag, mirror, journal, or none" is not met. Beside it, two smaller holes: undoTag deletes with no old value, so a concurrent writer's tag can be clobbered by the rollback; and a process killed between the tag and the mirror leaves the same wreck with nothing to roll back — unfixable without cross-ref transactions, and unnamed in the code.

What caught it: the closure re-check, answering the driver's own question about the atomic design.

What happened: open. The second fix round captures the mirror tip before writing and resets it on failure with the old value passed, gives undoTag its old value, and names the crash window beside D52.2.

Caught by: blind-review — the slice 3 closure re-check
Class: front-door-hollow

## F68 — 2026-08-26 — A revoked seal verifies green

What it is: the cross-check reads the newest seal line of either action but only compares battery pairs, and a revoked line carries the same pair. A seal whose record says revoked — the dying-amend shape, reproduced with a planted ref lock — verifies with zero problems. The state D52.9 set out to make visible is still invisible.

What caught it: the closure re-check, reopening its own small.

What happened: open. One line: a newest seal line whose action is not granted is a problem.

Caught by: blind-review — the slice 3 closure re-check
Class: green-but-wrong

## F69 — 2026-08-26 — The fix for the record gap opened a record gap, and three smalls

What it is: F65's fix put signature and signer on the seal line, and the contract page never gained them — its table still says three fields, its reason row is stale, and the pin's want list was not extended, so nothing catches the drift. F64's class, reintroduced by the fix for F65. The smalls beside it: the HEAD-not-worktree proof cannot tell HEAD from the index (a staged signers file survives the suite — one git add closes it); the writer-strict mirror guard runs in grant and not in amend, against its own comment; one sentence in signerFrom's doc needs a second reading.

What caught it: the closure re-check's sweep of the fix diff, with its own 30-mutation pass — 28 killed, one genuine survivor, one honest can-never-fail.

What happened: open. Folded into the second fix round.

Caught by: blind-review — the slice 3 closure re-check
Class: parallel-definition

## F70 — 2026-08-26 — The battery went green over a failing test suite

What it is: with a test red in internal/findings, groundwork verify still reported ten rows green. The mutate row never sampled that package's functions, and the run-evidence row reconciles which tests ran against which were discovered — not whether they passed. No row asks the one question a contributor would: does the suite pass?

What caught it: the slice 3 second fix round, when the ledger-threshold test went red under its feet and verify stayed green.

What happened: recorded and assigned. The row that owns this belongs beside run-evidence, and the bet 3 close-out decides whether it lands in this bet's remaining slices or is named as a deferral with an owner, F13's rule. The findings ledger's own check caught the actual red here, which is why the gap surfaced at all.

Caught by: worker — the slice 3 second fix round
Class: coverage-gap

## F71 — 2026-08-26 — The final re-check's two smalls, fixed at landing

What it is: the rollback's old-value guarantee was tested on the mirror half and not the tag half — dropping the old value from the tag delete killed nothing. And one sentence in signerFrom's doc still needed a second reading after the fix round's split.

What caught it: the final re-check's own ten-mutation sweep — eight killed, this survivor, and one honest can-never-fail (the defensive read ordering no test can distinguish).

What happened: fixed at landing by the driver. The tag half has its twin test, proven by dropping the old value and watching it die alone; the sentence is three short ones.

Caught by: blind-review — the slice 3 final re-check
Class: unrun-proof


## F72 — 2026-08-26 — Three copies of printable

What it is: journal, seal and battery each carry their own printable. The board slice exported the journal's and used it, but the other two stand — D54's class with three entries of one function.

What caught it: the slice 4 builder, moving seams under D54.1.

What happened: recorded for a later slice to collapse into one, rather than a fourth appearing. Out of a board slice's scope to chase.

Caught by: worker — the slice 4 build
Class: parallel-definition

## F73 — 2026-08-26 — The board row narrows F70 and does not close it

What it is: the board row now asks whether the proof tests pass — a proof expected green that fails is red. It asks nothing about the rest of the suite, and nothing about a proof whose milestone has not landed. F70's gap — no row asks whether the whole suite passes — stands narrowed.

What caught it: the slice 4 builder, checking its row against F70's claim.

What happened: recorded. D55's manual pairing stands, and the bet 3 close-out decides F70's owner knowing the board covers the proof tests alone.

Caught by: worker — the slice 4 build
Class: coverage-gap

## F74 — 2026-08-26 — Holds() is half proved, and the table said forty for forty

What it is: blanking the Wrong half of the board's Holds() leaves the whole suite green, unfiltered. The consequence is the verb's exit code: a misstated trailer prints red in the render and exits 0, so the verb and the row disagree about one board — the thing the function's own comment says it exists to prevent. The builder's blanking table claimed forty killed of forty; this survivor falsifies the claim. The verb's tests drive green boards, behind proofs, and missing plans, never a misstated trailer.

What caught it: the blind review of bet-3 slice 4, with its own full-suite blanking run.

What happened: open. One cmd-level case driving the verb on a bad trailer and asserting the exit.

Caught by: blind-review — the slice 4 dispatch
Class: unrun-proof

## F75 — 2026-08-26 — Two states under one count, in the one part of the line that survives

What it is: the row's head counts misstated trailers and harmless merge trailers as one number, "N trailers not read". The render prints them under two different words, but the head is the only part guaranteed to survive, and it cannot tell a red cause from a benign one. D52.3 ruled this exact shape for unverified and unsigned: counted and printed apart, everywhere.

What caught it: the blind review, with three boards whose heads read identically.

What happened: open. Two counts in the head.

Caught by: blind-review — the slice 4 dispatch
Class: other — one count for two states, where D52.3 rules them apart

## F76 — 2026-08-26 — The multi-suite clause hides exactly when it matters most

What it is: the row's no-hits branch drops its clauses, so "N tests reported by more than one suite" is shown when something else is already wrong and hidden when the board looks clean — which is when a folded double answer misleads most. The run-evidence row's green branch keeps its clauses for exactly this reason, and this is the only row that drops them. Run.Twice also never reaches the render, against its own doc.

What caught it: the blind review, diffing the two branches' output.

What happened: open. The clauses ride the no-hits branch too, and the render gains the line.

Caught by: blind-review — the slice 4 dispatch
Class: coverage-gap

## F77 — 2026-08-26 — The contract pin fails a gutted table and passes a lying one

What it is: the section-3 pin matches only each row's first cell, so flipping the verdict columns — merge trailers land, doubled trailers land, red and green swapped — leaves the suite green. The verdict cell is the whole content of the ruling table. D54.1's model pin survives a prose mention and fails a gutted cell; this one has half of that, missing the half that carries the ruling.

What caught it: the blind review, flipping four verdicts on the page.

What happened: open. The pin reads the verdict cell and drives it.

Caught by: blind-review — the slice 4 dispatch
Class: unrun-proof

## F78 — 2026-08-26 — The stray claim lands and the real landing is called the stray

What it is: claims arrive newest-first, so when two commits claim one slice, the newest claim is credited with the landing and the older, genuine landing commit is named as the duplicate. A reader chasing the stray is sent to the real commit. The contract page says the second commit is named, and in commit order the second is the newer one — page and code disagree, and no test pins which commit is named.

What caught it: the blind review, with a three-commit fixture.

What happened: open. D57 rules the direction: the oldest claim lands, newer claims are the strays named, and the pin asserts the commit id.

Caught by: blind-review — the slice 4 dispatch
Class: other — a true verdict pointing its reader at the wrong commit

## F79 — 2026-08-26 — Eight lows from the board review

What it is: the page says the board runs the plan's markers and no others, silent on the fallback branch that runs every proof-named test. The adapter seam's doc claims a fail-closed red one of its two callers does not make, unnamed who owns that red. The render's widest-line test feeds maxima instead of searching, and the pattern cap has no boundary case. The verb's writes-nothing test reads git status where the row's proof hashes the tree. A single wrong trailer at the page's own maximum width drops its reason and keeps its value. Two branches are unpinned — an unreachable default whose comment claims it matters, and the empty-plan-directory path. Section 3 is hard-wrapped where sections 1 and 2 are not.

What caught it: the blind review of bet-3 slice 4.

What happened: open. Folded into the fix round, with D57 ruling the reason outranks the value and the seam doc naming its red's owner.

Caught by: blind-review — the slice 4 dispatch
Class: coverage-gap
