# Verification round — bet 2, slice 5: the deletion test

Reviewer: a fresh session, no contact with either builder round. A focused third pass: re-run both earlier rounds' probes against the fixed tree, and probe only the newest mechanisms. Date: 2026-08-23.

## Round three findings

The three second-round escapes were confirmed closed with probes. Three new items:

HIGH — the accounting ladder's last rung had no proven bound. The reviewer computed 207 bytes from legal inputs — a 32-byte declared version and a grading-sized sample — where the handoff had measured 194 off one fixture. Below the last rung only cut() remained, which truncates counts. Ruled in D36: the last rung collapses the inconclusive classes into one counted total, drops the version, and proves its bound by arithmetic.

MED — the two could-not-write guards each passed the other's only test. The write branch mattered: with it gone, an unwritable mutant was never applied, the package ran clean, and the row reported a false-red survivor it never touched.

MED — the borrowed-record guard was unproven at depth and over-broad: narrowing it to the surface root survived the suite, and a self-contained project keeping a linked-worktree fixture under testdata went permanently unrunnable on a false sentence. Ruled in D36: the guard refuses only where a .git file can govern a run.

## Closure check

After the final fix round, the same reviewer re-verified each of its findings:

- The collapsed rung's bound recomputed independently: 58 fixed bytes plus seven 19-digit integers is 191, nine bytes under the cap, with negatives structurally unreachable. The 89991-of-999999 probe now prints 187 bytes, reconciling, crash split kept, version shed. cut() is dead on the path.
- The write-branch guard dies alone; the immutable-attribute fixture runs for real in this environment. The read branch is still shielded by its sibling — accepted as residue: the consequence needs a file to vanish from a directory only the row touches, inside the throwaway copy.
- The git guard: narrowing dies, the submodule at a build-named package refuses naming lib/.git, the testdata fixture is green with no git-record mention, and the worktree fixture's log shows no run ever touching the real git directory.
- One latent gap found on the way: the linearised name-fitting helper under-counts names in shapes no real tally can produce (0 in 300,000 randomised runs; every real name is longer than the 8-byte trigger). Accepted as residue.

Final verdict: lands. Full suite green, gofmt and vet clean, verify on this repo 7 rows green with the line whole at 176 bytes: sampled 10 of 62 targets, killed 8 (2 by crash), 2 did not compile.
