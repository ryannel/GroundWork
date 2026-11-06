# PR 2: ids and code links

Base: PR 1 merge `74e4a17b14cd21dded7505ba5a551a01b526c67d`. Branch: `codex/rebuild-pr2`.
The user's latest instruction authorises merging completed PRs and continuing in separate worktrees until a real human decision is needed or PR 10 is reached.

## What changed

- `src/domain/ids.ts` owns model prefixes, building, parsing, child paths, failures, aliases, scoped references and legacy address tokens. The existing plan vocabulary remains available without broadening the old plan reader's entity union. Aliases return their traversed ids, retirement reasons and cycle gaps; they never choose an invented successor.
- All inventoried runtime prefix operations, field/step ids and Git-link implementations now call the two domain modules. A slash in a nested child path no longer incorrectly counts as a qualification into another plan.
- `src/domain/code-links.ts` owns permalinks, repository homes, issue links and Git remote/link parsing. Explicit legacy citation styles preserve existing URL output. Nested repository namespaces and malformed links have regression coverage.
- Six architecture regression cases enforce the boundary, covering prefix construction/stripping, child construction/parsing, issue links and repository homes. No lint or architecture rule was disabled.
- `rebuild:inventory` writes outstanding enforced runtime findings to `ids-and-urls.json` and retains all 6,801 literal/helper candidates separately in `ids-and-urls-candidates.json`. The 1,590 consumer rows still make no claim that the old model has migrated. All 20 explorer capabilities remain unproven, with none retired.

## Proof

- `npm run check:quick`: passed, including 2,622 related tests. A final focused run on the shared modules and fixtures also passed.
- `npm run check` on the completed change: passed: 497 test files, 3,867 tests; 27 files and 125 tests retain their existing skips. Type coverage is 100%; pure-layer coverage is 96.96% lines and 86.26% branches. Duplication remains 0.38%.
- `npm run build`: passed. `npm run budget`: all 599 pages passed; the largest is 1,021 KB against 1,024 KB.
- The latest Personal and Volvo comparisons report zero differences. Acme reports only the exact 43-byte HTML-wrapper difference already allowed in PR 1; every comparison has zero unexplained differences. Reports are under `verification/pr2/`, alongside the earlier clean Acme comparison. No allowance was added or widened.
- All 193 frozen baseline files match the SHA-256 values committed in PR 1; see `verification/pr2/baseline-integrity.json`.
- The main source checkout stays at `24cb5020eab2e352fb2f0102681179b732ed3bf6`; Volvo stays at `723085497ded5b51d3c23fdcb5f6b1c778aa3efa`. Both source worktrees have no changes. No Volvo data was edited.

## The transient Personal comparison

The initial Personal comparison reported only `/personal/side-projects/plans/` changing from 25,975 to 25,932 HTML bytes. It is retained as `verification/pr2/personal-initial-comparison.json`; it was not hidden by refreshing a baseline or changing an allowance.

Twelve further responses from the unchanged production server reproduced both sizes: eleven had ten Flight scripts and one had nine. Ordinary HTML and extracted content/links were identical. Flight import record numbers varied with resolution order. Concatenating type-1 Flight chunks, replacing import record ids and their references with hashes of their import definitions, and sorting records gives one identical hash across all twelve responses. This is the same 43-byte streaming-wrapper variation recorded for Acme in PR 1.

`verification/pr2/personal-streaming-responses.json` records the measured sizes and hashes, and two complete responses are retained as inert `.html.txt` files for inspection. A repeat of the complete Personal comparison then matched its frozen baseline exactly.

## Final parser review

The first GitHub run passed audit, static checks, lint, tests, build/budget and both CodeQL analyses. Review against the kept glossary contract found `term:` missing from the new kind parser: Volvo's `language.yaml` has 13 such declarations (first at line 15), and `workspace-model-schema.ts` validates them as key terms. The shared parser now recognises them. Its child-kind lookup also returns a visible gap for unsupported parents rather than classifying a system's arbitrary child as a step. Regression assertions cover both cases.

The focused check passed 2,241 tests in 257 files, and the production build passed again. The refreshed inventory includes `term:` literals as well as the previously inventoried prefixes, with zero uncentralised runtime implementations.

## Explicit aliases and nested descendants

The completed path review keeps alias resolution on explicitly declared node mappings. A retired parent's alias alone cannot establish the identity of one of its children: that child remains a visible gap until it has its own mapping. Nested child mappings chain normally, and cycles and retirements retain their existing diagnostics. Descendant checks respect slash-separated paths, so `h:x#tx/read` is within `h:x#tx` and `h:x#tx-other/read` is not.

The final focused run passed 2,242 tests in 257 files. The production build, all 599 page budgets and the full three-workspace comparison were repeated on this version. No new allowance was required. The normal pre-push hook runs the full suite on each published head.

## Worktree hook correction

The first commit attempt failed: the local pre-commit copy still inherited Git repository identity, although the pre-push copy already cleared it. Its related tests changed the common `core.bare` setting and left PR 2's staging index referring to a fixture blob. This was an environment failure: 11 Git-fixture tests failed after the clean full and focused checks had passed.

The common setting was restored to its recorded `false` value. Only PR 2's index was recovered from its base and the unchanged working files were restaged; no source file or branch tip was reset. Private copies of the affected metadata were retained under `/tmp/groundwork-pr2-hook-*`. Direct checks then confirmed the original main branch tip and clean source worktree, and the unchanged Volvo worktree.

The corrected pre-commit run passed all 2,622 related tests in 297 files, and the commit succeeded. The common repository mode remained `false` and the original main worktree remained clean.

All three local hook copies now clear inherited repository identity before running the existing commands. `docs/rebuild/README.md` contains the corrected setup. The original main checkout's hook files were not edited and no check was skipped.

## Standalone Node commands

Command-line smoke checks caught a loader regression: the newly shared helpers were imported with the app's `@/` alias, while `node tools/permalink.ts`, `node tools/sources.ts` and `node tools/scan-status.ts` are documented standalone commands. The package now maps `#domain/*` to the same pure source modules, and those three tools use the native imports. Their documented commands remain unchanged.

Three child-process regressions run the tools from outside the checkout without the app loader. The focused tool run passes all 33 tests. An additional architecture case proves a UI module still cannot reach the domain through the native alias; all 67 architecture tests pass. The full suite was then repeated successfully: 3,867 tests in 497 files, with the existing skips unchanged, plus build and all 599 page budgets.

## Reproduction and next work

Use the worktree check environment in `docs/rebuild/README.md`; it keeps Knip within the checkout and clears inherited Git repository identity before hook-run fixture tests. The local Acme copy is `.workspaces/rebuild/acme`; the workspace registry lists this copy, Personal and the original read-only Volvo workspace.

Run `npm run rebuild:inventory`, then `npm run rebuild:compare -- --workspace <id> --before artifacts/rebuild/baseline/<id> --out <new-output-folder>` for `personal`, `acme` and `volvo-cars` against a production build. Captures retain their route selections, facts and payloads in the ignored worktree output folders; only the reports are duplicated here.

After this PR is merged, start PR 3 in another worktree from the updated main. Read the repository specification. Keep legacy and canonical schemas side by side until their consumers migrate. PR 7 still needs a person to accept headline/edge review rows; before PR 9 reconfirm the cache decision in design §10.2.

## Whole-file mutation batches

The single mutation job for head `c494f86e` reached its 60-minute limit after completing 12,594 of 21,103 active mutations in 134 touched pure-layer files. This was an incomplete run, not a passing score. See the recorded run and counters in `verification/pr2/mutation-timeout.json`.

The architecture explicitly brings whole touched files under its 75% bar. The workflow therefore partitions those same complete files into 20 deterministic batches, balanced by source length, and computes one score weighted by mutant count. Neither the mutation scope nor the threshold is reduced. Batch score failures are collected for that overall decision; missing reports, changed scopes or thresholds, stale source, duplicate results, unknown statuses and pending mutations fail the final gate. Uncovered mutations count against the score, while compile/runtime errors and ignored mutations retain Stryker's existing scoring semantics.

Eleven focused tests cover the partition, native Git failure, report validation and weighted score. A real two-mutation Stryker smoke run passed, and its completed JSON report passed the same validator used by CI. The final required check remains named `mutate`.

The full local check with this batching change passes: 3,878 tests, the architecture suite, static checks, lint and coverage (96.96% lines; 86.26% branches). The refreshed inventory remains at zero uncentralised runtime operations. Build, page budgets and frozen-baseline comparisons are unchanged by this CI-only follow-up and retain the standalone-command head's recorded successful results. The completed batched CI mutation score must pass before merge.

## Completed mutation failure and regression proof

The completed 20-batch run at `188c0a7e` failed the unchanged 75% gate: 12,865 of 21,116 active mutants were detected (60.93%). This was a real test-quality gap across the 134 whole touched pure-layer files. No file was removed from scope and no threshold was lowered. The failure log is retained as `verification/pr2/mutation-completed-initial-failure.log` (GitHub run 42131932127).

Regression tests now assert the public behaviour of ownership and placement gaps, caller bindings, handler narratives, flow geometry and grouping, data links, migration milestones and work-item warnings, change traceability, browser transport, store summaries, decisions, version words, workspace readers and Mermaid exports. The completed targeted runs and their source hashes are recorded in `mutation-targeted-runs.json`; `mutation-regression-estimate.json` is a diagnostic estimate only. A local whole-scope diagnostic was interrupted after a Vitest cache collision; its incomplete incremental output is excluded from the estimate and is not merge proof. The final CI aggregate must still complete and pass.

The source audit also found eight prefix-regex sites: `plan-viz-flow-key.ts:31`, `plan-viz-flow-graph.ts:115`, `plan/flow-steps.ts:74`, `plan/derive-edges.ts:247`, `plan/derive-contracts.ts:104`, `features/plan/viz/journey/journey-value.tsx:78`, `plan-viz-compat.ts:91` and `plan-story-journey-execution.ts:33`. They now call the shared ID module with the existing authored-link grammar preserved. Architecture negatives reject grouped prefix tests, child tests and authored flow-link regexes; ordinary non-capturing text regexes remain valid.

All 193 PR 1 baseline hashes remain unchanged (`baseline-integrity-regressions.json`). Both source worktrees remain clean at their recorded original revisions (`source-worktrees-regressions.json`). The production build and all 599 page budgets pass again, with the largest still 1,021 KB. Personal compares exactly; Acme has only the pre-existing precisely allowed 43-byte wrapper variation. No allowance has been added or broadened.

The user has authorised merging completed PRs and continuing the stack. Proceed from each updated main in a fresh worktree, while keeping PR 7's human acceptance and the PR 9 cache decision as explicit human decisions.

## Generic Markdown and model reference policy

The strengthened regex check also caught `src/shared/markdown.ts:30`, whose legacy authored-reference validator belonged in the domain identity authority. The generic Markdown parser now receives a reference predicate; the UI passes it through without importing the model. Feature callers supply `isAuthoredReference` from `src/domain/ids.ts`. `src/domain/plain-text.ts` supplies the same policy to the generic plain-text helpers, retaining their existing model-facing signatures.

The grammar is unchanged: arbitrary lower-case prefixes and the former word/dot/hash/hyphen body remain accepted, while spaces, slash child paths and failure markers remain visible literal text in this legacy Markdown reader. New canonical route and citation work must not silently broaden this legacy grammar. Tests prove both the exact grammar and that the generic parser can accept a caller's unrelated reference syntax. Focused tests pass (41 tests across six files), as does TypeScript.

This correction and the earlier regex sites expand the complete mutation scope from the initial 134 files to 148. The earlier targeted estimate covered the original scope only and cannot establish the expanded scope's final score. All 148 files must pass the weighted CI gate. Failed local checks are retained beside the successful reruns; the first regression check caught formatting, and the next caught two test-style errors plus this final shared-layer validator.

The corrected Markdown build passes, all 599 budgets pass again (maximum 1,021 KB), and the repeated Personal, Acme and Volvo comparisons each report zero unexplained differences. Personal and Volvo are exact matches; Acme retains only its existing allowance. The reports are `verification/pr2/markdown-<workspace>-comparison.json`. The build's earlier duplicate-directive failure is retained as `build-markdown-final.log`; `build-markdown-corrected.log` records the corrected result.

The final inventory reports **zero** uncentralised runtime operations, retaining 8,060 literal/helper candidates and 1,612 consumer rows. All 20 explorer capabilities remain unproven and none is retired. `mutation-pending-scope.json` records the expanded 148 whole-file paths and source hashes; it is a scope record, not a passing score.

The final complete local check passes (`check-markdown-corrected.log`): 4,084 tests in 520 test files, with the existing 27 files/125 tests skipped. Type coverage is 100%; pure-layer coverage is 97.48% lines and 87.65% branches. Lint, architecture tests and every static check pass. Duplication remains 0.38%. The expanded CI mutation gate remains required before merge.

New terminal logs have trailing whitespace and terminal carriage returns normalised for Git; their outcomes and messages are retained. Raw local copies are under `/tmp/groundwork-pr2-raw-verification-logs`.
