# PR 2: ids and code links

Base: PR 1 merge `74e4a17b14cd21dded7505ba5a551a01b526c67d`. Branch: `codex/rebuild-pr2`.
The user's latest instruction authorises merging completed PRs and continuing in separate worktrees until a real human decision is needed or PR 10 is reached.

## What changed

- `src/domain/ids.ts` owns model prefixes, building, parsing, child paths, failures, aliases, scoped references and legacy address tokens. The existing plan vocabulary remains available without broadening the old plan reader's entity union. Aliases return their traversed ids, retirement reasons and cycle gaps; they never choose an invented successor.
- All inventoried runtime prefix operations, field/step ids and Git-link implementations now call the two domain modules. A slash in a nested child path no longer incorrectly counts as a qualification into another plan.
- `src/domain/code-links.ts` owns permalinks, repository homes, issue links and Git remote/link parsing. Explicit legacy citation styles preserve existing URL output. Nested repository namespaces and malformed links have regression coverage.
- Six architecture regression cases enforce the boundary, covering prefix construction/stripping, child construction/parsing, issue links and repository homes. No lint or architecture rule was disabled.
- `rebuild:inventory` writes outstanding enforced runtime findings to `ids-and-urls.json` and retains all 6,792 literal/helper candidates separately in `ids-and-urls-candidates.json`. The 1,590 consumer rows still make no claim that the old model has migrated. All 20 explorer capabilities remain unproven, with none retired.

## Proof

- `npm run check:quick`: passed, including 2,622 related tests. A final focused run on the shared modules and fixtures also passed.
- `npm run check`: passed: 496 test files, 3,862 tests; 27 files and 125 tests retain their existing skips. Type coverage is 100%; pure-layer coverage is 96.96% lines and 86.26% branches. Duplication remains 0.38%.
- `npm run build`: passed. `npm run budget`: all 599 pages passed; the largest is 1,021 KB against 1,024 KB.
- Personal, Acme and Volvo comparisons each report zero differences and zero unexplained differences. Reports are under `verification/pr2/`. No allowance was added or widened.
- All 193 frozen baseline files match the SHA-256 values committed in PR 1; see `verification/pr2/baseline-integrity.json`.
- The main source checkout stays at `24cb5020eab2e352fb2f0102681179b732ed3bf6`; Volvo stays at `723085497ded5b51d3c23fdcb5f6b1c778aa3efa`. Both source worktrees have no changes. No Volvo data was edited.

## The transient Personal comparison

The initial Personal comparison reported only `/personal/side-projects/plans/` changing from 25,975 to 25,932 HTML bytes. It is retained as `verification/pr2/personal-initial-comparison.json`; it was not hidden by refreshing a baseline or changing an allowance.

Twelve further responses from the unchanged production server reproduced both sizes: eleven had ten Flight scripts and one had nine. Ordinary HTML and extracted content/links were identical. Flight import record numbers varied with resolution order. Concatenating type-1 Flight chunks, replacing import record ids and their references with hashes of their import definitions, and sorting records gives one identical hash across all twelve responses. This is the same 43-byte streaming-wrapper variation recorded for Acme in PR 1.

`verification/pr2/personal-streaming-responses.json` records the measured sizes and hashes, and two complete responses are retained as inert `.html.txt` files for inspection. A repeat of the complete Personal comparison then matched its frozen baseline exactly.

## Final parser review

The first GitHub run passed audit, static checks, lint, tests, build/budget and both CodeQL analyses. Review against the kept glossary contract found `term:` missing from the new kind parser: Volvo's `language.yaml` has 13 such declarations (first at line 15), and `workspace-model-schema.ts` validates them as key terms. The shared parser now recognises them. Its child-kind lookup also returns a visible gap for unsupported parents rather than classifying a system's arbitrary child as a step. Regression assertions cover both cases.

The focused check passed 2,241 tests in 257 files, and the production build passed again. The refreshed inventory includes `term:` literals as well as the previously inventoried prefixes, with zero uncentralised runtime implementations.

## Worktree hook correction

The first commit attempt failed: the local pre-commit copy still inherited Git repository identity, although the pre-push copy already cleared it. Its related tests changed the common `core.bare` setting and left PR 2's staging index referring to a fixture blob. This was an environment failure: 11 Git-fixture tests failed after the clean full and focused checks had passed.

The common setting was restored to its recorded `false` value. Only PR 2's index was recovered from its base and the unchanged working files were restaged; no source file or branch tip was reset. Private copies of the affected metadata were retained under `/tmp/groundwork-pr2-hook-*`. Direct checks then confirmed the original main branch tip and clean source worktree, and the unchanged Volvo worktree.

The corrected pre-commit run passed all 2,622 related tests in 297 files, and the commit succeeded. The common repository mode remained `false` and the original main worktree remained clean.

All three local hook copies now clear inherited repository identity before running the existing commands. `docs/rebuild/README.md` contains the corrected setup. The original main checkout's hook files were not edited and no check was skipped.

## Reproduction and next work

Use the worktree check environment in `docs/rebuild/README.md`; it keeps Knip within the checkout and clears inherited Git repository identity before hook-run fixture tests. The local Acme copy is `.workspaces/rebuild/acme`; the workspace registry lists this copy, Personal and the original read-only Volvo workspace.

Run `npm run rebuild:inventory`, then `npm run rebuild:compare -- --workspace <id> --before artifacts/rebuild/baseline/<id> --out <new-output-folder>` for `personal`, `acme` and `volvo-cars` against a production build. Captures retain their route selections, facts and payloads in the ignored worktree output folders; only the reports are duplicated here.

After this PR is merged, start PR 3 in another worktree from the updated main. Read the repository specification. Keep legacy and canonical schemas side by side until their consumers migrate. PR 7 still needs a person to accept headline/edge review rows; before PR 9 reconfirm the cache decision in design §10.2.
