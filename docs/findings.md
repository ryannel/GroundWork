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

What happened: fixed in the fix round — the cmd case drives the reviewer's own probe and pins the exit, and both halves of Holds() now die under blanking against the unfiltered suite. Closure-checked.

Caught by: blind-review — the slice 4 dispatch
Class: unrun-proof

## F75 — 2026-08-26 — Two states under one count, in the one part of the line that survives

What it is: the row's head counts misstated trailers and harmless merge trailers as one number, "N trailers not read". The render prints them under two different words, but the head is the only part guaranteed to survive, and it cannot tell a red cause from a benign one. D52.3 ruled this exact shape for unverified and unsigned: counted and printed apart, everywhere.

What caught it: the blind review, with three boards whose heads read identically.

What happened: fixed in the fix round — two counts in the head, the arithmetic re-proven at the cap, the searched test varying both. Closure-checked.

Caught by: blind-review — the slice 4 dispatch
Class: other — one count for two states, where D52.3 rules them apart

## F76 — 2026-08-26 — The multi-suite clause hides exactly when it matters most

What it is: the row's no-hits branch drops its clauses, so "N tests reported by more than one suite" is shown when something else is already wrong and hidden when the board looks clean — which is when a folded double answer misleads most. The run-evidence row's green branch keeps its clauses for exactly this reason, and this is the only row that drops them. Run.Twice also never reaches the render, against its own doc.

What caught it: the blind review, diffing the two branches' output.

What happened: fixed in the fix round — the clauses ride every branch and the render says what Twice knows, proven on a real two-package fixture. Closure-checked.

Caught by: blind-review — the slice 4 dispatch
Class: coverage-gap

## F77 — 2026-08-26 — The contract pin fails a gutted table and passes a lying one

What it is: the section-3 pin matches only each row's first cell, so flipping the verdict columns — merge trailers land, doubled trailers land, red and green swapped — leaves the suite green. The verdict cell is the whole content of the ruling table. D54.1's model pin survives a prose mention and fails a gutted cell; this one has half of that, missing the half that carries the ruling.

What caught it: the blind review, flipping four verdicts on the page.

What happened: fixed in the fix round — the pin cuts rows into cells and drives the verdict cells; all four flips die. Closure-checked.

Caught by: blind-review — the slice 4 dispatch
Class: unrun-proof

## F78 — 2026-08-26 — The stray claim lands and the real landing is called the stray

What it is: claims arrive newest-first, so when two commits claim one slice, the newest claim is credited with the landing and the older, genuine landing commit is named as the duplicate. A reader chasing the stray is sent to the real commit. The contract page says the second commit is named, and in commit order the second is the newer one — page and code disagree, and no test pins which commit is named.

What caught it: the blind review, with a three-commit fixture.

What happened: fixed in the fix round per D57.4 — the oldest claim lands, the later commit is named, pinned three ways through real git. Closure-checked.

Caught by: blind-review — the slice 4 dispatch
Class: other — a true verdict pointing its reader at the wrong commit

## F79 — 2026-08-26 — Eight lows from the board review

What it is: the page says the board runs the plan's markers and no others, silent on the fallback branch that runs every proof-named test. The adapter seam's doc claims a fail-closed red one of its two callers does not make, unnamed who owns that red. The render's widest-line test feeds maxima instead of searching, and the pattern cap has no boundary case. The verb's writes-nothing test reads git status where the row's proof hashes the tree. A single wrong trailer at the page's own maximum width drops its reason and keeps its value. Two branches are unpinned — an unreachable default whose comment claims it matters, and the empty-plan-directory path. Section 3 is hard-wrapped where sections 1 and 2 are not.

What caught it: the blind review of bet-3 slice 4.

What happened: all eight fixed in the fix round per D57.5 and 6, each with its pin or its honest comment. Closure-checked.

Caught by: blind-review — the slice 4 dispatch
Class: coverage-gap

## F80 — 2026-08-26 — The battery package is drifting out of the deletion test's reach

What it is: the mutate row's line on this repo now reads "1 blocked; internal/battery holds 1 target and its own tests do not finish in time". That package's suite is 200 seconds, the per-mutant clock runs out before judging, and most of this bet's code lives exactly there. The row is honest — blocked is named, never counted as killed — but honest blindness is still blindness, and each remaining slice adds rows to the package the deletion test can no longer judge.

What caught it: the slice 4 fix round, reading its own verify tail.

What happened: closed in the slice 4 micro-round, at its cause. The widest-line search was the whole 75-second cost; sampling the monotone count space at its boundary — 134 tuples where the cross product was 1.7 million — put the package suite back under the clock, and the mutate row's line reads killed and counted again, with no blocked clause.

Caught by: worker — the slice 4 fix round
Class: coverage-gap

## F81 — 2026-08-26 — The class's fourth entry: a bound the fix itself added, proved by nothing

What it is: the fix round's new multi-suite line rode a three-name cap that nothing drove — blanking it survived the whole unfiltered suite, and the widest-line search's twice axis stopped at four, below the widths that matter. The fourth entry in the class F54, F61 and F79 already hold, and the second in this one slice: a widest-line test measuring a shape instead of searching for one, this time on the very line a fix introduced. The comment bounding the constant carried the same habit one layer down — its note arithmetic measured an ordinary rune where the widest reason carries a twelve-byte escape.

What caught it: the closure re-check's own blanking sweep, and the final re-check's audit of the corrected arithmetic.

What happened: fixed in the micro-round — the axis reaches two hundred, the blanked cap dies at the reviewer's exact probe — and the comment's numbers corrected at landing. The final re-check then proved the boundary sampling exact by running the full thirty-two-million-tuple space: same widest, no count lost anywhere.

Caught by: blind-review — the slice 4 closure re-check
Class: unrun-proof

## F82 — 2026-08-26 — Two smalls from the closure re-check

What it is: a verdict-cell guard whose only exit was a test failure could not be driven through its caller, so blanking it survived — a prose-rewritten cell on a not-red row would read as no by luck. And the two-count head lost its singular, printing "1 trailers misstated" with the searched test pinning the bad spelling in place.

What caught it: the closure re-check's sweep of the fix diff.

What happened: fixed in the micro-round — the guard split into a drivable reader plus its wrapper, ten rejects driven including the by-luck shapes; the count went back through counted, and the bound was re-measured at the plural where it is widest.

Caught by: blind-review — the slice 4 closure re-check
Class: unrun-proof

## F83 — 2026-08-26 — The stub check sees only the stubs the honesty scan sees

What it is: D58.1's reconciliation judges a passing expected-red proof by the honesty scan's vacuous-shape list, so a stub the scan cannot see passes. A constant condition is as vacuous as a self-comparison, and the scan's selfComparison could learn it. The three ladder styles are covered; the boundary is the scan's, and it is named rather than papered over.

What caught it: the slice 5 builder, pricing its own ruling.

What happened: recorded. Widening the scan's shapes is its own slice — a second definition of vacuous inside the stub row is the class this ledger already names, so the growth happens in the one place or not at all.

Caught by: worker — the slice 5 build
Class: coverage-gap

## F84 — 2026-08-26 — The record lags the work by three slices, permanently

What it is: twelve of the sixteen ahead-of-plan proofs on this repo's board belong to b3s1 through b3s3, whose commits predate the Slice trailer and cannot be amended. The board and the stub row read them as unlanded forever. The count is honest and visible — that is what the ahead flag is for — but the number never goes to zero on this repo, and a reader must know why.

What caught it: the slice 5 builder, reading this repo's own line.

What happened: recorded as permanent and named. The bet close-out says it once in the close-out record so no future reader chases a wreck that is only history.

Caught by: worker — the slice 5 build
Class: host-limit

## F85 — 2026-08-26 — The battery's seventh catch: authority proved only on its false side

What it is: the 10.0 rotation drew the seal package's Authority and it survived blanking — every test proved unsigned and unverified are not authority, and none proved verified is. The reason is F57/F62's limit: no test here can make a verified tag, so the true side never ran.

What caught it: the battery — the mutate row's rotated sample at 10.0.

What happened: pinned in the owning package with a test that builds the verified state directly, checked against a blanked copy — the F29 pattern, seventh entry.

Caught by: battery — the mutate row's rotated sample at 10.0
Class: unrun-proof

## F86 — 2026-08-26 — The record overstated twice: F83's size, and D58.1's support

What it is: F83 framed the stub check's blind spot as one missing comparison shape. The real boundary is the honesty scan's documented escape set — a cross-file helper, an assertion library, a fake recorder — one line of indirection into a no-op helper defeats the whole check, and D58.1 promoted those known false negatives into the stub row's entire red/not-red boundary. And D58.1 itself states two things that are not so: the scan names five shapes, not three; and the sealed-fixture claim is checkable only for one of the two holdouts — the other's open record says its wrinkle is noted only in the key, which nobody building could read. F62's lesson again: ledger entries written from the report, not the diff.

What caught it: the blind review of bet-3 slice 5, planting seven scan-escaping stubs and reading the holdout descriptions.

What happened: this entry corrects both. F83's class stands; its size is the escape set, and widening the scan remains the one-place-or-not-at-all rule. D58.1's direction stands — the reviewer judged the reconciliation itself sound, all three ladder styles verified failing through the binary — with its support corrected to: the ladder's three styles are among the five shapes the scan names, and the fixtures grade the same as far as the open descriptions show.

Caught by: blind-review — the slice 5 dispatch
Class: record-not-written

## F87 — 2026-08-26 — The evidence line claims what the row never checked

What it is: the green sentence reads "none of them is a stub, a skip or a red that proves nothing" — an unqualified claim decided by a precision-over-recall scan that seven planted stubs walked past. The contract page hedges correctly; the line a reader actually sees does not. Beside it, the headline proof's three-styles case is a tautology for two of the three styles: an always-true "more" escape means only the count is asserted, and the distinct reasons the row genuinely prints go unchecked.

What caught it: the blind review, with the seven plants and a reading of the proof's own loop.

What happened: fixed in the fix round — the line says who looked and what they found, seven scan-escaping plants pinned under the honest sentence, and each style's reason asserted by name. Closure-checked.

Caught by: blind-review — the slice 5 dispatch
Class: green-but-wrong

## F88 — 2026-08-26 — Five rules in the new row proved by nothing, one of them load-bearing

What it is: five blanking survivors inside the slice's own code, each surviving the whole battery suite. The load-bearing one: the duplicate-name guard in cannotFail — blank it and an honest test in one suite masks a same-named stub in another, turning a caught red into a clean green. Beside it: the no-hits clause drop that F76 already named, re-committed under a comment citing F76; the blocked clause that is the only signal the row could not judge some proofs; the broke-some-other-way clause; and a first-wins comment describing folding the code does not do. A sixth survivor is pre-existing adapter code from an earlier bet, now on the record here rather than only in a report.

What caught it: the blind review's 27-rule sweep against the builder's 21.

What happened: fixed in the fix round — each survivor now dies to a named test, the can-never-fail shape carries its honest comment, and the closure's independent 33-rule sweep reached the same two declared survivors. Closure-checked.

Caught by: blind-review — the slice 5 dispatch
Class: unrun-proof

## F89 — 2026-08-26 — A broken surface swallows every stub on every other surface

What it is: the row answers broken surfaces before reading any test source, and that branch returns without judging a proof — a planted stub on the healthy surface gets no count and no name, and D33's counts-lead rule is silently suspended. The gate still closes red, so nothing false passes, but the defect the row exists to name is invisible behind the noise. The honesty row already does this right: it keeps the hit and rides the unreadable surface as a clause.

What caught it: the blind review, on a two-surface fixture.

What happened: fixed in the fix round — the broken surface rides as a hit and a clause, every surface that ran is judged, and counts lead again. The deliberate cost of the every-surface-ran guard is stated on the page per D59. Closure-checked.

Caught by: blind-review — the slice 5 dispatch
Class: green-but-wrong

## F90 — 2026-08-26 — Nine smalls from the stub review

What it is: the slice appends the contract page while its plan file declares no record, so slice 7's record row would never check the obligation. Section 3.5 sits after its chapter's closer, says three where its own list holds four, and its pin leaves the middle column unguarded. judgeRed's default answers green for any state the vocabulary might gain, unwalked. The no-test sentence is false for a test outside every declared surface. One red arm is unreachable and searched anyway. A hard-coded name ignores the field that carries it. The timeout red is unreachable under default clocks and undocumented. Two sentences carry a track-record claim nothing establishes.

What caught it: the blind review of bet-3 slice 5.

What happened: all nine fixed in the fix round, the plan-file record line first and the vocabulary walk beside it. Closure-checked.

Caught by: blind-review — the slice 5 dispatch
Class: coverage-gap

## F91 — 2026-08-26 — A mark never clears

What it is: once the record holds an amendment, every bet whose premises name that artifact is marked, forever. Nothing lets a bet answer the mark — re-examine the premise, re-affirm, and clear. R13 gives the signal and no verb takes the answer. Loud, honest, and permanent is still a ratchet.

What caught it: the slice 6 builder, pricing its own ruling.

What happened: recorded. The answering verb belongs to the bet-close machinery the ladder already places later; the bet 3 close-out names its owner.

Caught by: worker — the slice 6 build
Class: coverage-gap

## F92 — 2026-08-26 — The sealed half of R12 is a state, not yet a check, on this repo

What it is: R12 says anchors resolve inside a sealed design file, and this repo's design carries no seal — so the row's sealed half reads (unsealed) on every line, a state it names but cannot enforce. The builder rightly refused to grant the seal itself (D60.6).

What caught it: the slice 6 builder, reading its own verify line.

What happened: the driver grants the unsigned design seal after the slice lands, from the landed tree — the sign-off made by the one who reviewed, not the one who built. Unsigned stays non-blocking per R4 until the owner's key exists.

Caught by: worker — the slice 6 build
Class: coverage-gap

## F93 — 2026-08-26 — Three smalls from the trace build

What it is: a proof's from: path is not held to its bet's design: list, so a proof can cite a file its bet never declared as design. A journal line nobody can parse leaves the row unrunnable even when no bet declares premises — the safe direction, but wider than it needs to be. And a setext heading makes no anchor here, so a design file styled that way has no resolvable anchors — named in the contract page rather than silently.

What caught it: the slice 6 builder, walking its own edges.

What happened: recorded. The from-versus-design check is one rule the next slice in this package can add; the others stand as named boundaries.

Caught by: worker — the slice 6 build
Class: coverage-gap

## F94 — 2026-08-27 — An uncapped read lets one file kill the whole battery

What it is: the trace row reads design files with no size cap, where every other reader in this repo caps. A 400-megabyte committed design file — or a committed symlink to /dev/zero — takes down the entire verify process: no summary, no journal line, nothing. The comment claiming the plan reader's path check protects the read is false: a committed symlink points wherever it likes, and the row's verdict can be driven by a file nobody reviewed. Nothing leaks — file contents never reach the evidence — but a battery one file can kill is F53's class at the process level.

What caught it: the blind review of bet-3 slice 6, with a reproduced out-of-memory kill.

What happened: fixed across the fix rounds — the read is capped at the manifest's 256 KiB, symlinks are refused at every element by resolving both sides and checking containment, and each refusal is a named verdict with the battery alive. Closure-checked twice.

Caught by: blind-review — the slice 6 dispatch
Class: green-but-wrong

## F95 — 2026-08-27 — The record says clauses and sealed docs; the code and the ruling say neither

What it is: the contract page's section 4.4 says the clauses name which unsealed things and how many — and the row passes nil clauses, by design, per D60.7 ratified in the same commit. And the slice's own plan file still claims "the sealed plan and the sealed design docs, read as committed" where D60.5 rules working-tree reads and F92 records the design unsealed. Two records contradicting the code and the rulings they shipped beside.

What caught it: the blind review, reading the page against the code.

What happened: fixed in the fix round — the page says named-not-counted with the arithmetic reason, and the plan file says what is true. Closure-checked.

Caught by: blind-review — the slice 6 dispatch
Class: record-not-written

## F96 — 2026-08-27 — Two ratified words silently re-read

What it is: R13 says an amendment marks every later bet, and the code marks every bet in the repo, across programs, with no time input. R12 says a facing id is claimed by exactly one slice's proof, and the code reads the slice's facing list. Both readings are likely right — a citing bet is later than the seal it cites by construction, and no per-proof facing field exists — but nobody ruled them, and the page restates R13 without its word.

What caught it: the blind review, holding the code to the ruling's words.

What happened: D61 rules both readings, the page carries them, and two new table rows drive the cross-program and first-bet marks. Closure-checked.

Caught by: blind-review — the slice 6 dispatch
Class: record-not-written

## F97 — 2026-08-27 — A useless duplicate line, and six lows

What it is: a slice listing one facing id twice is a trace red naming one slice twice — a line that tells the reader nothing — and the state is missing from the verdict table that reads as complete. Beside it: the red rule is written twice and the page's proof goes through the copy the row does not use; the table's middle column is a gut cell; the slug rule diverges from a real renderer on a heading holding a link; the premise-id charset rests on two rules that agree by luck, unpinned; one red subtest skips the plan-row check its siblings make; and two sentences drift past the register.

What caught it: the blind review of bet-3 slice 6.

What happened: fixed — the plan reader refuses the doubled claim at load beside its siblings, the verdict is one spelling driven through all 64 report shapes, the link-in-heading slug matches the renderer, and the rest landed with their pins. Closure-checked.

Caught by: blind-review — the slice 6 dispatch
Class: coverage-gap

## F98 — 2026-08-27 — The symlink refusal guards the last element, and the record claims the path

What it is: the fix's Lstat refuses a symlink only at the final path element. A committed symlink at an intermediate directory is followed, and the row resolved an anchor in a file outside the repo, green. The other gates hold through it — size and regular-file still bite — so it is an escape, not a crash, and nothing leaks. What gates is the record: the new comment and the page both say a symlink is refused rather than followed, a narrower version of the exact false claim F94 recorded. Beside it, the same round re-entered F95's class: the page states the 256 KiB cap and nothing holds the number to the code — while the plan parser's caps have had exactly that pin since slice 1 — and the cap's boundary and the code-span divergence in link stripping are undriven or unnamed.

What caught it: the closure re-check, walking the fix with an intermediate symlink and mutating the page's new prose.

What happened: fixed in the micro-round — both sides resolved, containment checked, the cap pinned to the page, the boundary driven, code spans named. The final re-check closed all four, and its one low is F99, fixed at landing.

Caught by: blind-review — the slice 6 closure re-check
Class: green-but-wrong

## F99 — 2026-08-27 — The containment rule's distinction was undriven, fixed at landing

What it is: replacing the Rel-based containment with a naive prefix check passed the whole suite, and under that mutant the sibling-directory escape — a directory whose name extends the root's — came back for real. The shipped code was right; nothing defended it against a future simplification.

What caught it: the final re-check on slice 6, planting the mutant and building the escape.

What happened: fixed at landing by the driver — one case, a design file behind a symlink into a sibling named root-evil, proven by swapping in the reviewer's exact mutant and watching the case die alone.

Caught by: blind-review — the slice 6 final re-check
Class: unrun-proof

## F100 — 2026-08-27 — A board red that did not reproduce, and the flake machinery could not see

What it is: the first verify on a fresh copy printed the board red — ten behind, naming a proof as failed in the run — and the second run on the same copy with the same binary printed it green, as did every direct run of the proofs. A false red in the board's proof run, from before this slice's rows existed. The flake machinery rerecords a red that disagrees on rerun, but both attempts inside that one run agreed, so it never fired.

What caught it: the slice 7 builder, running its final verify twice.

What happened: recorded against the board row, open. The next board round owns the hunt: something in the row's filtered proof run can fail proofs that pass everywhere else, and one non-reproducing sighting is exactly the shape that needs a trap, not a shrug.

Caught by: worker — the slice 7 build
Class: green-but-wrong

## F101 — 2026-08-27 — A pin asserted yesterday's world, and the world moved

What it is: the seal row's this-repo test asserted the repo holds no seal tag, and the driver's design-seal grant made that false the same day. The pin broke for every build after the grant. F87's lesson in a test: a pin on a world-state nobody controls breaks the moment the world legitimately moves.

What caught it: the slice 7 builder, finding the test red before touching anything.

What happened: fixed in the slice — the test asks git for the fact and holds the row to whichever green is honest. The fix rides with the slice.

Caught by: worker — the slice 7 build
Class: green-but-wrong

## F102 — 2026-08-27 — Git dates every file in a shallow clone, wrong at the edge

What it is: at a shallow clone's edge the whole tree hangs off one grafted commit, so a record dated there reads as current when it is stale. The builder's rewritten blanking harness — after its own first version filled only two cells of F55's table and reported false kills — exposed this along with two other real gaps.

What caught it: the slice 7 builder's own four-way sweep, once the harness checked its clean-tree baseline per rule.

What happened: fixed in the slice with the waiver authority's own test: a parentless commit inside a shallow clone reads as unjudged, and the row comment and page claim only what the code keeps.

Caught by: worker — the slice 7 build
Class: unrun-proof

## F103 — 2026-08-27 — The register is drifting, fastest where nobody checks

What it is: measured across eras, code comments have crept from a mean of 14.7 words per sentence in bet 0 to 21.3 in bet 3's latest slice. The ledgers are worse: this file's second half runs a mean of 24.7 against 22.5 in its first, and the decisions file moved from 14.5 to 20.6. The cause is structural. Each review checks register against the latest landed baseline, so every slice's drift becomes the next slice's normal. And the driver's ledger prose has no reviewer at all — the blind reviews read the builders' diffs, never these entries — so the record itself densifies, and every agent reads the record. That is the exact mechanism that grew the old corpus.

What caught it: the owner, asking whether the writing is still corrupted, and the measurement that answered.

What happened: D63 rules the cure. Short entries from here on: this one included.

Caught by: owner-in-review — the owner's direct question
Class: register

## F104 — 2026-08-27 — F100 solved: the host's signing shim was failing fixtures under load

What it is: every fixture commit inherits the host's global commit.gpgsign=true and its signing shim, and under load the shim dies with too many open files. A fixture that cannot commit becomes a proof that failed in the run, the board reads that as work regressing, and the flake machinery cannot fire because both attempts meet the same broken host. The reviewer reproduced the board red on four of four verify runs and traced the exact error. Disabling signing in the fixtures removes the channel and cuts the battery suite from 138 to 80 seconds — the shim was almost half the clock.

What caught it: the slice 7 blind review, running the board's filter by hand until the failure text surfaced.

What happened: closes F100's hunt. The fix round sets commit.gpgsign=false in every fixture repo maker, both packages.

Caught by: blind-review — the slice 7 dispatch
Class: green-but-wrong

## F105 — 2026-08-27 — A close that reports done when what a close checks never ran

What it is: verify --close asks whether the scope rows are registered, never whether they ran. Three of the four rows a close exists for came back unrunnable and the tool printed the scope heading and exited zero. The refusal that does exist can never fire on the shipped tool and is not wired through the flag — deleting the call passes the whole suite. D53.1's front-door-hollow class, on the ceremony verb itself.

What caught it: the slice 7 blind review, with an unrunnable-scope fixture and the unwired mutation.

What happened: open. D64 rules the fix: a close fails unless every scope row is green or waived, driven through the flag.

Caught by: blind-review — the slice 7 dispatch
Class: front-door-hollow

## F106 — 2026-08-27 — The record row's shallow miss is a silent pass, and its guard can be widened unseen

What it is: a slice whose landing commit is past the shallow edge reads as unlanded, so its records are never judged and the row is green — with a missing record, on this repo, now. The page says the opposite in the sentence carrying D62.5's reasoning. And the shallow-edge exemption can be widened to every commit and nothing dies: the guard that keeps unjudged narrow has no fixture one commit deeper.

What caught it: the slice 7 blind review, with a depth-one clone and the widening mutation.

What happened: open. D64 rules the unseen-landing state counted apart in the head, the page corrected, and the depth-three fixture that pins the guard.

Caught by: blind-review — the slice 7 dispatch
Class: green-but-wrong

## F107 — 2026-08-27 — The record row reversed a ruling, and the ledger cited the wrong precedent

What it is: the record row credits the newest claim as a slice's landing. D57.4 ruled the oldest claim lands and the board says so in its own comment — crediting the newest names the real landing as the stray. D62.1 ratified the newest reading citing D56.4, which is about merges, not claim order: the driver wrote the entry from the report and the review caught it, F62's class on the driver's own side. The record row also skips the four trailer validity checks the board applies to the same input.

What caught it: the slice 7 blind review, holding the two rows' readings of one fact against each other.

What happened: D64 corrects D62.1 in place of the append-only ledger: the oldest claim lands, and the record row reads claims through the board's own machinery so one rule exists once.

Caught by: blind-review — the slice 7 dispatch
Class: record-not-written

## F108 — 2026-08-27 — The finding-clears gate is open for every row named by an ordinary word

What it is: a waiver threshold clears when a finding title holds the row id as a whole word — and nine of sixteen row ids are ordinary English words already present in this repo's ledger titles for unrelated reasons. Three grants of record in one bet read green against the real ledger, cleared by an entry about the spend query. The threshold cannot bite for those rows, ever.

What caught it: the slice 7 blind review, running the real matcher over the real titles.

What happened: open. D64 rules the naming structured: the phrase "<id> row" clears, a bare word never does.

Caught by: blind-review — the slice 7 dispatch
Class: green-but-wrong

## F109 — 2026-08-27 — The counter's attribution rests on unvalidated trailers, and a rename resets the count

What it is: the bet a grant is attributed to is checked against nothing — invented bet names and doubled Bet trailers both dodge the per-bet threshold. And git mv on a waiver file resets its grant count to one while the waiver stays in force, a shape D62.9 did not name because a rename is not a deletion.

What caught it: the slice 7 blind review, with invented-bet and rename probes.

What happened: open. D64 rules the direction: a misstated attribution never weakens a threshold, and the history read follows renames.

Caught by: blind-review — the slice 7 dispatch
Class: coverage-gap

## F110 — 2026-08-27 — Two read-source moves left unfinished, one of them promised

What it is: the mutate row still seeds its sample from the working-tree lock, so one run prints two battery versions and the deletion sample rotates on a bump nobody committed. And D60.5 promised design files would move to committed reads with R15's slice — this slice — and only the lock moved, with nothing recording the narrowing.

What caught it: the slice 7 blind review, with a two-version run and a read of D60.5 against the diff.

What happened: open. D64 moves the mutate seed to HEAD and corrects D60.5's promise: R15 covers the lock; committed design reads are assigned to a later bet.

Caught by: blind-review — the slice 7 dispatch
Class: coverage-gap

## F111 — 2026-08-27 — The history row's three: a false red on quoted prose, a missed squash flavour, a buried lead

What it is: a commit quoting a Slice line in ordinary prose — the shape this repo's own ledger commits write — reads as a squash, permanently, naming the quoted slice rather than the commit's own. A squash whose message discarded the quoted trailers entirely is invisible, while the page claims the check is complete. And the counter's red line leads with a cleared row while the row a reader must act on hides inside "and 1 more".

What caught it: the slice 7 blind review, probing the gap-read's edges.

What happened: open. D64 rules the cluster read, the page's honest limit, and reds-first ordering.

Caught by: blind-review — the slice 7 dispatch
Class: green-but-wrong

## F112 — 2026-08-27 — The new prose drifted past the baseline pinned the same day, and eight lows

What it is: the slice's new files run 19.2 mean words per sentence against D63's bet-0 baseline near 15, with the shallow-postures paragraph written out five times. The lows: a false comment on BlobAt, doubled record paths accepted, an edited-after-landing record reading green with a count that means something else, a close leaving no journal trace, an unpinned Lstat, a copied rule claiming to be shared, an uncapped Messages read, and a proud sentence printed exactly where D62.9's blind spot lives.

What caught it: the slice 7 blind review, measuring against D63 within hours of its landing.

What happened: open. Folded into the fix round, the dedup and the trim first.

Caught by: blind-review — the slice 7 dispatch
Class: register

## F113 — 2026-08-27 — A waiver file's identity is its path, and paths get reused

What it is: a new waiver at a path a deleted waiver once occupied inherits the dead file's grants — four grants attributed to a row and bet that never had them, red on the wrong row. And a pure git mv counts as a grant: two honest grants plus one tidy-up rename trips the threshold, though nobody decided anything. The page's cell for that case does not drive what its words claim.

What caught it: the slice 7 closure re-check, probing the fix round's rename-following.

What happened: fixed in the micro-round — the walk stops at the file's birth, a copy is a birth, a pure rename decides nothing, all proven through real repos and blanking. Final re-check closed it.

Caught by: blind-review — the slice 7 closure re-check
Class: green-but-wrong

## F114 — 2026-08-27 — One repo, two diagnoses, and a lead buried again

What it is: the counter's evidence line is nondeterministic — twelve runs of one repo printed two different worst rows, ten one way, two the other, on a tie the code claims it orders. And the record row buries its lead exactly the way D64.8 just fixed in the counter: a red line naming an unjudged record while the stale one that made it red hides in "and 2 more".

What caught it: the slice 7 closure re-check, running one binary twelve times.

What happened: fixed in the micro-round — twelve runs print one line twice over, and the record row leads with its reds. Final re-check closed it.

Caught by: blind-review — the slice 7 closure re-check
Class: green-but-wrong

## F115 — 2026-08-27 — The cluster read still reds honest prose, and six smalls

What it is: two adjacent trailer-shaped lines in prose still read as a squash — and any word-colon line counts as trailer-shaped, so a bare label above a sentence starting Slice: forms a cluster and prints the sentence as a trailer value, permanently red on immutable history. The cheap tightening: keys this repo actually writes. The smalls: the close usage text still describes the hollow check; the gpgsign shape pin is evadable by an init spelling or a second maker in a blessed file; a page sentence says counted where the code judges; the head-byte constants certify themselves against nothing; the close's journal line does not say whether the close was met; an all-empty path list means read-everything in the direction that inflates.

What caught it: the slice 7 closure re-check.

What happened: fixed in the micro-round — the cluster reads only declared trailer keys, structure-pinned to the working agreement and the page, and the six smalls landed with their pins. Final re-check closed it, upholding the quoted-block red as a statement about readability, never intent.

Caught by: blind-review — the slice 7 closure re-check
Class: coverage-gap

## F116 — 2026-08-27 — Four costs stated out loud

What it is: the ruled and accepted costs the closure named, recorded so no reader meets them cold. A shallow clone reads green over records it cannot judge — on this repo, three of seven record-declaring slices at every run, for as long as every clone here is shallow. A git rm plus a rewritten file at a new name restarts a grant count — narrower than the rename it replaced, a real rewrite instead of a bare mv. A repo whose plan declares no bets pools every grant into one bucket sharing the per-bet limit — stricter than the page's headline suggests for adopters without plans. And a close has no override: an unrunnable scope row cannot be waived, which D65 rules is the ceremony holding, not a gap — a close that cannot run is a close that does not happen.

What caught it: the slice 7 closure re-check, pricing what it closed.

What happened: recorded. The first cost shrinks when clones deepen or the trailer corpus grows past the edge; the rest stand as designed.

Caught by: blind-review — the slice 7 closure re-check
Class: other — ruled costs, recorded where a reader will look

## F117 — 2026-08-27 — Three page sentences describe the previous version, and the help text hardcodes the scope

What it is: the contract page's section 5 says a cut message is counted rather than judged, never names the trailer key set D65.4 turned load-bearing, and lists the counter's counts as the head no longer prints them — three unpinned sentences, drifted in one round, in the one place a parsed shape is written down. The page also owes the writer a warning: reproducing a whole trailer block in a commit message reads as a squash, permanently. And the close verb's help text writes the scope by hand, pinned to nothing, while R14 says later bets extend that scope.

What caught it: the slice 7 final re-check, holding each sentence to the line the code prints.

What happened: fixed in the last round — each sentence pinned to the line it describes, the writer's warning on the page, the help text built from the scope function. Verified at landing through all twenty-four pins.

Caught by: blind-review — the slice 7 final re-check
Class: parallel-definition

## F118 — 2026-08-27 — The driver reverted an uncommitted page with git restore

What it is: verifying a sentence pin, the driver blanked one word in the contract page and then ran git restore to put it back — which restored HEAD's version, destroying every uncommitted section-5 edit from four rounds of slice 7. The damage was one file, caught within a minute by the very pin being verified, and recovered without retyping: the builder diffed a committed scratch copy against the wreck, proved sections 1 through 4 identical, copied the round-3 page in, and re-applied round 4's three sentences. All twenty-four pin tests then passed.

What caught it: the driver, reading a FAIL where a pass belonged — the pin caught its own page going missing.

What happened: recovered and re-verified. The standing rule: a probe on an uncommitted file swaps in memory and swaps back; git never touches a file the index does not hold.

Caught by: driver — the pin that failed on the page it guards
Class: other — a driver process slip, caught by the machinery it was testing

## F119 — 2026-08-27 — The holdout's catch: the always-true stub walked past the stub row as work ahead of plan

What it is: gauge planted three stub styles beside honest twins. The stub row caught two. `p_parse_negative` sets `want := got` one line above `if got != want`, and the honesty scan's self-comparison rule compares the two sides as they were written. `got != got` fires; `got != want` does not. So the stub reads as a test that can fail, passes anyway, and the board calls it `ahead of plan`. The key names it a planted stub at parse_more_test.go:31. The ladder names all three styles, so a documented limit does not stand in for a catch here. D58.1 made the scan's escape set the stub row's whole red boundary, which is why one line of aliasing is enough.

What caught it: the held-out grading — the sealed key held against the stub row's own line, `3 red at an assertion, 2 not, 1 ahead of plan`.

What happened: open. The fault is in the checks, not in the translation: no plan file could have made this stub visible. A fix is tuning after a graded run, so D41's price applies — the battery major moves and both fixtures are burned.

Caught by: battery — the held-out grading run, the mechanism built to catch exactly this
Class: coverage-gap

## F120 — 2026-08-27 — The board points at the commit before the work, and calls the real landing a stray

What it is: both fixtures write two commits per landed slice — a red-proof commit, then the commit that turns it green — and both carry the same `Slice:` trailer. D57.4 credits the oldest claim, so the board read the red-proof commit as the landing and printed the real landing under "what a person has to look at". Both keys name the later commit: 9bfa992 and 2d812e1 on sift, c79da6a and 878a29a on gauge. Both intent pages say the same in prose, unread by either board. Four sound commits flagged, and four landing pointers aimed one commit early. This repo's own working agreement produces that very shape: commit the test while it still fails, then land the work.

What caught it: the held-out grading — two fixtures authored by somebody who had never read the contract, both choosing the same convention on their own.

What happened: open. Checks-side, not translation: landedness is read from trailers and no plan file touches it. A ruling is owed on which same-trailer commit lands a slice. D64 upheld the oldest reading against F107, and neither had a tests-first fixture in front of it.

Caught by: battery — the held-out grading run, on both sealed fixtures at once
Class: green-but-wrong

## F121 — 2026-08-27 — The wiring red's own tail clause reads as an exemption from the red

What it is: gauge's wiring row went red on `ToMetres`, and the red is right. On a library D41 keeps the row's teeth for an export nothing names at all, tests included, and the only test that would have named `ToMetres` is the planted empty body. But the line ends `on profile library an export needs no in-repo caller`, placed after the hit. The clause is there to say which rule was applied. Read in order, it says the hit does not count. The blind runner read it that way and listed the row as suspect. A second true signal of a planted stub arrived looking like a bug in the check.

What caught it: the blind runner, reading the row's line with no key in front of it.

What happened: open. The red stands. The sentence needs the clause before the hit, or wording no reader can take as a stand-down.

Caught by: worker — the blind runner's suspect list, upheld against the key
Class: other — a correct red whose own tail clause reads as an exemption from it

## F122 — 2026-08-27 — The mutate row has nothing to say about a repo mid-bet

What it is: mutation needs a package whose tests pass unmutated. A part-landed bet has red proofs, so every package holding unlanded work is blocked. On gauge, one package at the module root, all six targets were blocked and the row went unrunnable. On sift the row went green having judged the landed package alone: `killed 2, 2 blocked`. So the row speaks about the finished half and stays silent on the half being built — which is the state this tool exists to serve. It cost nothing on these fixtures, because neither key hides a defect mutation would have found. The gap is named here so it is known rather than missed — F13's lesson, in F28's shape.

What caught it: the held-out grading's audit of the rows that did not run.

What happened: open. Recorded as this grading's named loss. A row that cannot run on a mid-bet repo wants a ruling before it wants a fix.

Caught by: blind-review — the slice 8 grading dispatch's audit of the unrunnable rows
Class: coverage-gap

## F123 — 2026-08-27 — The grading asked two of bet 3's four questions and never said which two it skipped

What it is: `docs/ladder.md` sets bet 3's done-when in four clauses. The graded runs exercised two of them: decomposition, and the three stub styles. They never exercised "the board starts red for the right reason". They never exercised "three slices land in sequence, each one turning exactly its own row green". Both fixtures carry the earlier commits those two clauses need. Each graded run sat at one mid-bet commit, so nobody ran there. `docs/evidence/bet-3/holdout.md` then claimed a complete grade and named no gap. Both fixtures are burned, so the loss looked permanent.

What caught it: the slice 8 blind review, counting the grading record's answers against the ladder's four clauses.

What happened: recovered, not lost. A `board` run at a fixed commit over fixed plan files is a pure reading. It derives from the plan, from git and from a test run, and none of the three reads a key. So opening the keys cannot change what a board prints, and a later run is worth the same as an earlier one. Both fixtures were re-materialized by the recipe already recorded, with the same binary and the same authored plan files, and walked commit by commit. The determinism claim was checked first: both graded boards reproduced line for line. The runs are in `docs/evidence/bet-3/slice-8/runs.md` under "The supplemental runs", and the grades in `holdout.md` under "The supplement". The walk answered both clauses and turned up F124's false red. The forward rule: a grading record names every clause it did not ask.

Caught by: blind-review — the slice 8 review
Class: coverage-gap

## F124 — 2026-08-27 — The board reads a slice landed before its work, and goes falsely red on tests-first history

What it is: F120 named a stray pointer under "what a person has to look at" and classed it green-but-wrong. The supplemental walk shows a graver shape. At every red-proof commit `LANDED` reads yes for a slice with nothing implemented: sift at `035d288` and `af14585`, gauge at `ee669c1` and `863e12f`. `EXPECTED` follows it wrong. At sift `af14585` milestone 1 reads fully landed, so all three of its proofs turn `EXPECTED green`. `p_record_parse` then fails, because it is the red proof that commit just added. The board prints `behind its plan`, counts `1 behind`, and exits 1. gauge does the same at `863e12f` on `p_format_short`. So the worst case is a false red with a non-zero exit, not a mis-aimed pointer. It fires on a repo doing what this repo's own working agreement demands: commit the test while it fails, then land the work. D66.1 was ruled on the understated version.

What caught it: the slice 8 blind review, which re-ran `board` at the commits the graded runs skipped.

What happened: open. This is F120's fault seen whole, so one ruling covers both, and that ruling now needs the real worst case in front of it. D66.1 stands until the fix slice. The fix lands at the next battery major with freshly authored fixtures, per D41. Evidence: the verbatim boards at `035d288`, `af14585`, `ee669c1` and `863e12f` in `docs/evidence/bet-3/slice-8/runs.md`.

Caught by: blind-review — the slice 8 review
Class: other — a false red with a non-zero exit, on the history the working agreement demands

## F125 — 2026-08-27 — The ladder makes the slice the unit and the contract makes the milestone the unit

What it is: `docs/ladder.md` says three slices land in sequence and each turns exactly its own row green. `docs/derivation-contract.md` section 3.3 says expected state comes from the milestone, not the slice, and gives its reason. Both cannot hold. The supplemental walk shows the cost. sift at `9bfa992` lands `s_tokenize` and both its proofs pass. Both still read `EXPECTED red`, and both are flagged `ahead of plan`. Those rows turn green one commit later, when the milestone's last slice claims a landing. gauge at `c79da6a` behaves the same way. So no board built to the contract can meet the ladder's clause. Slice 8 was the moment this was due to surface, and the grading did not notice. A second mismatch sits beside it, also unrecorded: `docs/plan/rebuild/bet_3/b3s8.md` declares its first fixture as "a two-milestone bet whose three slices land in sequence". Neither sealed repo is that. sift has four slices and lands two. gauge has five and lands two.

What caught it: the slice 8 blind review, reading the ladder's clause against the contract's rule.

What happened: open. Nothing is changed here, and neither page is edited. Which unit is right is a ruling, not a fix, and it belongs to the bet-3 close-out audit. That audit has both burned fixtures' walks to read.

Caught by: blind-review — the slice 8 review
Class: parallel-definition

## F126 — 2026-08-27 — The grading's score line counts a fault its own ledger entry does not name

What it is: the grading record's one-line score reads "one miss, one false red". Nothing went falsely red at either graded tip. F120, the entry that line points at, is classed green-but-wrong. It describes a green row carrying a wrong hit. Meanwhile the one red a reader would argue about — wiring on gauge, which sends `verify` to exit 1 — was weighed against the key and cleared into prose. F121 files only its wording. So the headline counts a fault the ledger does not hold, and leaves out the one that is contestable. A reader who reads the score line alone gets the wrong shape of the grade.

What caught it: the slice 8 blind review, counting the score line against the four entries it summarises.

What happened: fixed by appending. Nothing is struck, because a record is a record. A correction sentence now follows the score line, and the supplement carries the honest count: one miss and one wrong hit on a green row at the tips. The real false red is at the commits the graded runs skipped, and F124 files it.

Caught by: blind-review — the slice 8 review
Class: other — a headline that counts a fault its own ledger entry does not name

## F127 — 2026-08-27 — A facing item no proof asserts is invisible to every row

What it is: R12 says each facing id is claimed by exactly one slice's proof. `internal/trace/trace.go:10` implements "claimed by exactly one of its slices". Nothing anywhere links a facing item to a proof. So a slice can claim an item that none of its proofs asserts, and no row can see it. The trace row counts ids per slice, so it reports zero unclaimed and is right by its own rule. D61.2 ruled the slice-as-unit reading deliberately: a proof carries no facing field, and the slice is the unit that lands. This hole is that ruling's residue, not a slip. It cost nothing on either fixture. The grading said sift's shared proof was a wrinkle that did not bite, which is true, and missed that this hole is the reason.

What caught it: the slice 8 blind review, reading the sift key's second wrinkle against what the trace row can see.

What happened: open. Recorded as a named loss awaiting a ruling — F122's shape. Closing it means giving a proof its own facing link, which changes the plan shape. It wants a walk before it wants code.

Caught by: blind-review — the slice 8 review
Class: coverage-gap

## F128 — 2026-08-27 — The proof of the grading run proved only that prose exists

What it is: `TestProof_b3s8_grading_the_sealed_fixtures_are_run_once` checked one anchor, one heading, the absence of a placeholder, twenty words, and two repo names. It never opened `runs.md`. So it could not see whether a run happened, whether it happened once, or at which battery version. Its own marker claims the sealed fixtures are run once. `runs.md` was also missing from `b3s8.md`'s `records:` list, so no record row and no test pinned it. A later edit could gut the whole run record and every check would stay green.

What caught it: the slice 8 blind review, reading the test against the sentence its marker makes.

What happened: half fixed in this round, by adding checks and removing none. The test now opens `runs.md` and requires four things: both fixture names, the battery version `12.0+ra48a79a`, fenced verbatim output for at least the four graded runs, and the supplemental section's heading. Each new assertion was probed in memory: the load-bearing text was blanked in a copy held in memory, the test failed on that copy, and the file was swapped back from memory. No git command touched an uncommitted file — F118's rule.

The other half is blocked, and F131 records it. Adding `runs.md` to `b3s8.md`'s `records:` list would let the record row pin the page too. `b3s8.md` sits under `seal/design/bet_3`, so the edit reddens the seal-verify row. Moving that seal is the owner's call under R6, not a builder's, so the line is not added here.

Caught by: blind-review — the slice 8 review
Class: front-door-hollow

## F131 — 2026-08-27 — A slice cannot gain a record after its design is sealed

What it is: F128's fix wants `docs/evidence/bet-3/slice-8/runs.md` in `b3s8.md`'s `records:` list, so the record row pins the run record. `b3s8.md` is covered by `seal/design/bet_3`. Adding the line changes the blob, and `seal-verify` goes red on a moved artifact. That red is correct: the seal is doing its job. But it means a slice's record set is frozen at design sealing, and a record found to be worth pinning later cannot be pinned without moving a seal. R6 says a seal moves only on the owner's explicit words, and an agent typing a reason is not the owner speaking. So a builder cannot close this on its own.

What caught it: the battery, at this slice's landing — `TestSealRowIsGreenOnThisRepo` went red the moment the line was added.

What happened: open, and the line is not added. Two ways out, both the driver's: amend `seal/design/bet_3` through `groundwork seal amend`, recording who signed it; or rule that a records list may grow after sealing and give the seal a way to say so. Until then the run record is pinned by the proof test alone, which is what F128's fix landed.

Caught by: battery — the seal-verify row, on this repo's own landing
Class: other — a correct seal red standing between a finding and its fix

## F129 — 2026-08-27 — The grading record's singleness sentence drops the parse pre-check

What it is: the record says "no fixture was run a second time". `runs.md` discloses a throwaway program that called `plan.Load` and `manifest.Load` on both fixtures before the graded runs. It printed only whether they read, and it changed nothing. But the plan row's green was pre-tested with the battery's own loader, and the flat sentence drops that. No rule was written for what to do had a plan failed to parse after a graded run.

What caught it: the slice 8 blind review, reading the grading record against `runs.md`'s own disclosure.

What happened: fixed by appending. The sentence now names the pre-check and points at `runs.md`. The missing rule is written beside it: a parse failure found after a graded run's judgments would be tuning, so translation fixes end when the first graded output is seen.

Caught by: blind-review — the slice 8 review
Class: record-not-written

## F130 — 2026-08-27 — One source, three catcher names

What it is: F119 and F120 say `Caught by: battery`. F121 says `worker`. F122 says `blind-review`. All four came out of the same pair: the blind runner, and the grading dispatch that read the keys. Each line is defensible on its own. Together they make the ledger hard to count by source, which is the one thing that field exists for.

What caught it: the slice 8 blind review, reading the four attribution lines side by side.

What happened: open, and no entry is changed. The ledger is append-only, so the four lines stand. The forward rule is the driver's and goes in a decision. This entry records the inconsistency, so a later count knows why the four disagree.

Caught by: blind-review — the slice 8 review
Class: other — four entries from one source, filed under three catcher names
