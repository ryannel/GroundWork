# Active fact roots and reviewed dispositions

The consumer inventory records three independent measurements. `reachable` includes imports, re-exports and lazy dependencies conservatively. `legacyPath` shows that a file can reach an old fact boundary when requested as a whole. `activeLegacyPath` shows that an actual app or command entry point reaches that old fact through the requested binding or evaluation. `factBindings` lists the names requested by those entry points.

The pre-cutover read-only probe found 47 app entry points and no old fact reads. Ordinary baseline capture and comparison still reached old readers. After the native capture and route-selection cutover, the binding-root inventory found zero traced active legacy dependencies. Source attribution's old raw YAML reader was identified by source review and addressed separately. A shortest path also discovers an active entry point that never matched a lexical inventory pattern. Exact source hashes, line evidence and proof hashes are still required for every runtime disposition.

The focused tests cover a live indirect command, conservative namespace and evaluation behaviour, an unused legacy export that remains evaluated, and a mixed file with a separate selected native binding. App tests that had been categorised as routes remain in the original candidate denominator and are shown as test evidence. See `inventory-active-tests.log`.

The proposed PR10 packet retains 301 present old-binding files, of which 58 remain reachable through module evaluation. This does not authorise file deletion. In particular, native `src/application/model-area.ts` and `src/application/model-area-facts.ts` import bounded DTO types from `src/application/workspace-area.ts`. Move or preserve those type contracts before removing that file. Review the current dependency graph again when performing the removal.

The route, native reader and mixed module packets contain independent exact source and focused proof references. They remain proposals until integrated by review.

The tracked inventory outputs report the current source tree, so their generated rows and line numbers can change as consumers move. The denominator comes from `original-candidates.json`. The tool verifies its exact SHA-256 and 1,697 entries before using it, then retains each original candidate as a complete nested `original` row. New files appear separately with `original: null`. This does not rewrite the PR 1 capture or any frozen baseline under `artifacts/rebuild/baseline/`.
