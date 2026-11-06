# Checkpoint Git-list overflow

PR7 exposed a repeatable checkpoint failure at the merged PR6 tree. Git lists 11,299 paths in
1,137,707 bytes, exceeding the subprocess default buffer of 1 MiB. The previous tool concealed
`ENOBUFS` behind “Cannot read the Git file list”. No Git monitor or verification rule caused this failure.

`filesInGit` now allows a bounded 16 MiB listing and throws subprocess errors before inspecting exit
status. The regression runs the public checkpoint and quick-check commands with more than 1 MiB of
Git output, then verifies both the first and final maintained files and an unchanged quick check.
The pre-fix regression fails; the fixed checkpoint and scope suite passes seven tests in two files.
Focused lint, types and formatting pass. Logs and the two-file source freeze are retained here.

The broken CLI could not create its own initial checkpoint. Before editing, an ordinary complete Git
listing and the unchanged `scope.snapshot` function recorded the clean checkout. The bootstrap receipt
records its size and zero existing edits; no checkpoint was reset to hide a failure.

Application, domain, infrastructure, rendering, data-loading, schemas, workspace facts and thresholds
are unchanged. Existing PR6 budget and baseline proofs remain applicable to those unchanged inputs.
The build is refreshed for the changed TypeScript. The normal pre-push full check and GitHub checks
remain mandatory gates. No pure-layer mutation scope is changed by this tooling-only patch.

PR7 data work remains in its own worktree, with original authored files unchanged and review proposals
unaccepted. Its pinned validator can advance to this fix after merge.
