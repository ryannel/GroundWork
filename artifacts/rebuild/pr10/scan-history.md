# Historical scan marks

The Volvo data commit `68d6a129a16d1401c38451f113eb0f76f008a765` retains all 116
historical marks under `scans/`, totalling 784,958 bytes. Its sorted Git tree receipt
from `git ls-tree -r --long <commit> -- scans` has SHA-256
`82de8d7cd9203a25d02181e425a9665f2a6a7c1ef0bfc9b3ed048447bd88afe6`.
The former tools are preserved in code revision `329dc9f225b1f640f05b782357453aa06ca45c40`.
Use detached worktrees at those revisions for historical inspection. Keep the saved checks
as historical observations. Repeating a remote status check today would make a new observation.

Of the marks, 74 record a branch check. The 108 repositories with a corresponding canonical
repository record contain 66 equal pins and 42 different pins. The other eight lack that
canonical metadata. The scanner's current freshness describes the pinned native repository.
It does not reassign the historical marks to that pin.

The model fixture source index and its 52 gap rows were byte-identical before and after the
cutover. Their SHA-256 digests are
`afc9c7413c2c250773610fb5d71401bd53f3bb2df7b017d814d87df10cf885c9` and
`3aaa1ced617f845ebf509704855ffbfc31e13da92ae9b68da7e161d0eb3fc394`.
