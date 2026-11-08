# Archive mutation checks

The first hosted mutation run had three incomplete batches. Two archive helpers had no pure-layer
test. The remaining batch held a type declaration module and generated no runtime code.

Focused tests exercise exact archive addresses, the unique source pin and ambiguous source
sets. Stryker detected 82 of 87 mutants across those two helpers, for 94.25% against the unchanged
75% floor. The batch planner omits only files whose stripped TypeScript consists of comments
and whitespace. Unsupported syntax stays in scope. The runtime matrix covers 19 complete files.
