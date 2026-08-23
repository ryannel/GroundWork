# Blind re-review — bet 2, slice 5 rework: the deletion test

Reviewer: a fresh session, no contact with either builder round. Verified the uncommitted rework on top of 24850cb, aimed at the rework's newest code: the go list integration, the D34 crash boundary, and what carrying .git into the copy might open. Verdict: **bounce**, the fourth of the rebuild and the second on this slice. Date: 2026-08-23.

## Findings

HIGH — three, each in code the rework was the first to ship:

1. The faithful copy carried a linked worktree's .git file verbatim. That file names a git directory outside the project, so git inside the throwaway copy resolved to the developer's real object store — the reviewer committed mutated content onto the real branch from a copy, and the real working tree came back dirty. A regression opened by the first round's H5 fix; the after-the-fact isolation test had been changed to skip .git, so it no longer watched the one directory that became reachable. The ordinary .git-directory copy was checked and is self-contained. Ruled in D35: a non-directory .git is refused, unrunnable naming the shape.
2. The new go list call inherited the parent's PWD while running elsewhere. The go tool prefers $PWD when it names the same directory, so a repo entered through a symlink — bash's default cd — reported every package under the symlinked path, the out-of-tree guard silently dropped them all, and the row printed "the surface holds no exported function to delete" about a project full of them. Exit 0; nothing announced the gate was off. The guard itself had no test.
3. The crash-kill class read go test's own timeout panic as a kill. With any test timeout shorter than the row's per-mutant clock — the project's flags, GOFLAGS passing through the environment, or go test's default — a mutant that wedged the suite forever was reported as caught. Ruled in D35: a timeout panic is the clock noticing the suite, never the suite noticing the mutant.

MED:

4. The accounting could still be cut on this repo's own numbers: five classes plus the budget verdict truncated a count, and the reconciliation check passed anyway because the surviving fragment still summed. D35 restates D33: counts are never cut; words give way.
5. Seven load-bearing lines in the new code survived mutation, one producing a false green: ErrNoTests on a mutant run counted as a kill printed "killed 2 (1 by crash)" over a suite that ran nothing. The others: the ran-nothing class dropped from the accounting, unwritten counted as a kill, an unreadable file skipped in silence, bounded() dropped from the go list child, the out-of-tree guard dropped, the recursion guard dropped from the go list child.

LOW: the register evidence in the handoff measured comment lines where the finding was about sentences (the substance held — the file is no longer the package's outlier); old throwaway directories now cost 20 MB each rather than 1.7 MB (recorded, not a defect); a surface root that is not a module root got a vaguer blame than the run-evidence row beside it; a copy failure on a later surface discards earlier surfaces' tallies (accepted as the S4 precedent).

## What held up

This repo end-to-end: 7 rows green, the mutate line's arithmetic reconciling, internal/battery and internal/manifest judged with nothing blamed. All eight first-round fixtures reproduced the handoff's lines exactly. Seventeen of the builder's mutations re-run by hand, all killed. cgo files, generated files, a syntactically broken go.mod, and a package that does not build all get honest answers. The row's own clock is never a kill, proven by ordering mutations. The first round's five HIGHs stayed closed under re-probing.
