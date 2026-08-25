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
