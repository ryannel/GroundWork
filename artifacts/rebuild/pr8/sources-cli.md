# Source checker cutover

The standalone `node tools/sources.ts <folder>` command selects the canonical reader when the workspace records format 2. The subprocess uses the repository loader and server conditions from any working directory. It reads the folder with the same canonical reader used by the app, then uses `index.cites` and the shared code citation resolver. It preserves evidence IDs and resolved code pins. It reports missing source information and unresolved references without assigning an origin or authored file. Only authored model records appear as report rows. Their cited evidence stays accessible by its exact ID.

The original format-1 reader remains available for the PR 9 scan-mark workflow. `scan-diff.ts` and `scan-mark.ts` still invoke `sources.ts --index --repo` in a subprocess. They consume `id` and the resolved `sources` path and commit. The legacy branch still supplies its authored file and origin fields. The check against remote file lengths uses the same implementation.

## Focused proof

- Before the fix, `node tools/sources.ts test/fixtures/acme-model --index` returned 70 rows with zero sources.
- Native Acme now reports 96 authored records, of which four cite code. `svc:products` retains `acme/products`, `cmd/products/main.go`, commit `4f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c` and lines 12 to 80. The 92 uncited records remain visible through `--missing`.
- The model fixture returns 39 records for `--index --repo example/orders`. The `con:order` citation stays `ev:source` and resolves to `apps/ordering/src/Confirm.ts`, lines 1 to 80. The same file's `h:confirm#load` retains its distinct span from lines 5 to 7.
- The registered format-1 Acme input still yields one matching record for `--index --repo acme/products`, with the original commit, lines 12 to 80, authored file and extracted origin.
- Final focused Vitest run passed 27 tests across the standalone CLI, source checker, scan-mark and scan-diff files. ESLint, formatting and whitespace checks passed. The tests invoke the direct Node command from outside the checkout.

No production rendering or model reader source changed in this batch.
