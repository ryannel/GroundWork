# Blind review — Bet 2, slice 8: the wiring row learns profiles

Reviewer: a fresh session, no contact with the builder. The slice answers F27, the held-out grading's one false red. Verdict: **lands after fixes**; closed on the second round. Date: 2026-08-23.

## Round one findings

HIGH — a library test file that goes unread produces a false red. D42's completeness rule was implemented for parse failure only; a symlinked test file and a named pipe each flipped a library green to red, and the pipe left no trace at all — breaking the scan contract that nothing is skipped in silence. On a library the test sweep is load-bearing for the verdict, so any unread file must refuse the row, not decide it.

MED: the 52-byte library clause starved the evidence line — ordinary library reds fell into a nameless fallback with 80 bytes of budget unused, and the fallback never re-appended the tail. The mixed-repo sentence was per-repo while the judgment was per-surface, so a cli surface's hit wore the library clause. And nothing pinned the 5.0 that D41 mandates — reverting the lock to 4.0 left everything green, since the digest had not moved.

LOW: a third spelling of the profile vocabulary; the Classes pin died by panic rather than assertion; the module-wide test sweep was undocumented; a handoff count was wrong.

## What held up in round one

The headline, exactly: the real holdout at its pre-key commit went green under a library manifest with the honest sentence, and red again with the profile flipped to cli — the old rule keeps its teeth elsewhere. Byte-identical wiring evidence on this repo, proven character by character. One reader, not two: the test sweep reuses the same walk, gate, parser and reference collector as the shipped sweep. "Named" means an identifier reference — doc comments and string literals do not count; a real call from another package's test does. Build-tagged test files count, per D30. D42's three calls held: init never a candidate, library-wins on a double declaration, cli repos untouched by the sweep. All fourteen mutants dead independently, the three F29 pins each the sole carrier of its kill, and the new tests genuinely red-first against the pre-slice code.

## The fix round

All eight findings closed, each reproduced on the reviewer's fixtures first. The completeness rule now covers every way a file goes unread, and openFile counts what it declines for all three scans. The evidence tail became a clause list, dropped clause-by-clause before any hit name; the fallback climbs a ladder that keeps name and line. Sentences follow the surface that judged each hit. The lock floor is pinned at 5. The profile vocabulary lives once, in the manifest package. The builder's extended mutation pass reached twenty-six dead — including its own catch, a library green that would have claimed "a non-test file names every one" about an export no non-test file names — and re-shaped two mutants that had died on the compiler rather than a test, which is not a kill.
