# Source return contracts

Immutable successor `bundle.final-r6.json` + `snapshot.final-r6.json`, snapshot `5c7d986c75ed935403fcd8f299d6183fcc24ba2988e7a717d8e47a0234cbaa1d`. Prior r5 bundle and manifest are preserved.

Pinned declarations establish 389 return signatures. 86 invented void-call values and dependent false flows/derivations are removed. 77 local constructors now have void call results and separate allocation/new-expression values, with normal completion between them. Source actual parameters, receivers, captures, mutations, exceptions, non-void results and async handles remain. Transaction expression lambdas calling known void methods also have void contracts.

Native/source validation passes. `return-acceptance-r6/acceptance.json` checks every known void/constructor contract and representative true parameter/capture/allocation lineage. All 43 I/O calls retain 39 positive source-owner interaction queries in `io-acceptance-final-r6`; 17 payload queries in `payload-queries-final-r6` preserve exact caller schemas, destinations and field lineage. The 185 all-entry queries retain 14 node-budget frontiers; source review is not inferred from those limits.

Original source ledgers and earlier acceptance packs remain tied to their original selection. Translate record IDs through the exact `changed` map in the adjacent correction JSON when using those ledgers with this successor; deleted false facts are listed separately. No source build/test, network fetch or live call was run.
