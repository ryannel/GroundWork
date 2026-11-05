# Rebuild PR 1 handoff

PR 1 fixes plan-lock correctness and establishes the inventories and proof commands for the remaining stack.
Start the next session from the repository specification in `docs/rebuild/`, after the user reviews this PR.
PR 2 has not started. No merge is authorised by this handoff.

## Inputs and scope

- Code base: `24cb5020eab2e352fb2f0102681179b732ed3bf6` (`main`). Branch: `codex/rebuild-pr1`.
- First commit: `5f6ae58f`, copying design revision 3, work plan revision 2 and requirements into `docs/rebuild/`.
  Prettier changed presentation only.
- Volvo Cars: `723085497ded5b51d3c23fdcb5f6b1c778aa3efa`, resolved from the workspace registry.
- Personal: the bundled `workspaces/personal` example on the code base.
- Acme: the maintained typed fixture in `test/fixtures/acme`, materialised by `rebuild:acme` through
  `test/workspace-kit.ts`, registered only in this worktree's ignored local registry.
- The main checkout and Volvo source file state and commit ids remain as found and were checked
  before and after the work. A pre-push fixture run inherited Git repository variables and changed shared
  Git metadata (`core.bare` and user identity); normal worktree mode and the identity recorded by the
  pre-test commits were restored, and both checkouts were verified again. No Volvo file, existing producer, cache or model file was changed or deleted.

## Plan-lock proof

`nodeIndex` recursively indexes every base collection. Independently prefixed nested endpoints now resolve
without first finding an interface by that endpoint's prefix. Local child ids receive their parent path, so
repeated local ids in different handlers/screens stay separate. A lock or drift check builds this index once.
The scope traversal keeps its existing top-level ownership semantics; legacy `parent#name` lookup remains.

The regression tests prove a changed nested `api:get` reports drift, a changed nested `h:get#tx/read` reports
drift, a fully qualified flow-step anchor reports drift, and unchanged/colliding local children remain scoped.
The prior named-region and fingerprint/source-order tests remain. Existing Volvo locks are untouched: endpoint
anchors previously recorded as absent may now correctly appear stale until their normal plan check is run.

## Inventories

- `consumers.md` / `consumers.json`: 1,594 conservative consumer rows, including every route and package script,
  the named quality gates, docs, skills and fixtures. JSON retains every matched line; Markdown groups by file.
- `ids-and-urls.md` / `ids-and-urls.json`: 6,790 candidate sites with file/line evidence, including fixture
  literals. Construction/parsing and literal candidates remain visible for PR 2 to reconcile.
- `explorer-parity.md` / `explorer-parity.json`: 20 reachable capabilities, their current source sites,
  future replacement and publication inventories for the registered workspaces.
- `inventory-replay.json` proves two unchanged runs produce byte-identical output.

Rows are marked `adapter`; no migration or retirement is claimed. Every explorer capability is still
unproven. Arbitrary and test-method flows, embedded source text, source-file navigation and reviewed Inferred
context need a proven replacement or explicit user-approved retirement before PR 10. The entry flow route
alone does not prove parity with arbitrary method browsing.

## Baselines

| Workspace | Selected routes | Indexed nodes | Component edges | Handler effects | Area views | Plans |
|---|---|---|---|---|---|---|
| personal | 24 | 8 | 1 | 0 | 0 | 0 |
| acme | 35 | 80 | 15 | 0 | 0 | 0 |
| volvo-cars | 128 | 16334 | 1693 | 7533 | 14 | 8 |

Every selected route returned HTTP 200. Route selection uses the application's own reference catalogue and
journey/plan outlines. The route samples are deliberate, not an exhaustive browser interaction crawl.
`facts.json.gz` includes all indexed nodes, both graphs of all loaded plans, ownership query results, caller
and message queries, store access, code/repository attribution, all area view models and both explorer
publication descriptions. Unknowns and existing legacy behaviour remain recorded. Compression is lossless.
`baseline-summary.json` records input commits, counts and SHA-256 hashes of every baseline file.

`verification/<workspace>/comparison.json` records fresh captures against the final baselines. Personal and
Volvo have zero differences. Acme's only observed difference is actual HTML size on `/acme/catalogue/plans/`:
27,172 versus 27,129 bytes. Repeated unchanged responses showed Next coalescing one 43-byte Flight script
wrapper while visible content, headings, links and all JSON stayed identical. `allowed-diffs.yaml` permits
only this exact before/after hash pair with that reason. No byte tolerance or wildcard approval is used.
Every comparison reports zero unexplained differences.

## Verification

- `npm run check:quick` over every changed source/document: passed; 222 related files and 1,974 tests passed.
- `npm run check`: passed, including the architecture checks; 3,835 tests passed and 125 were skipped by the
  existing suite. No test or rule was disabled in this PR. Lines: 96.96%; statements: 95.60%; functions: 96.76%;
  branches: 86.08%. Type coverage is 100% and duplication remains 0.38%.
- `npm run build`: passed on the final source.
- `npm run budget`: passed; 599 pages, heaviest 1,021 KB, all within 1,024 KB.
- The command integration test proves unchanged captures compare cleanly, a content change fails, its exact
  explained change passes, a later unreviewed change fails, and neither baseline nor comparison can overwrite
  a completed baseline. The pointer/approval tests also distinguish missing values from null and preserve
  array order.

Logs are committed under `validation/`. Knip's broad file search followed shared Git hooks outside the
worktree and waited indefinitely. The hooks were copied locally and their process-local
Git discovery path was overridden for `check`. The local pre-push copy also clears inherited repository
identity variables (`GIT_DIR`, work-tree/index/object paths and prefix) before running the original commands:
otherwise temporary-repository tests use the outer worktree metadata. No repository hook, configuration, test
or rule was changed or disabled. Reproduction commands
are in `docs/rebuild/README.md`. The offline install could not supply the locked versions, so this worktree
used independent copies of the main checkout's already-installed dependencies; dependency versions and the
lock file are unchanged.

## Next session

Wait for the user's PR 1 review. PR 2 centralises id construction/parsing and Git-host links using these
inventories, and must run the comparison against these committed baselines. Do not refresh them to erase a
difference. Reconfirm design §10.2 with the user before PR 9: commit the compressed analysis cache, or keep
it uncommitted and promote cited records into evidence. That decision remains open.
