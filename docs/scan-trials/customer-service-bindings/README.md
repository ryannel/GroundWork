# Customer service call and value bindings

Shared call and value bindings close Q05 and Q14 and prove the selected Fleet client source path.
The unchanged 22-question review now has **5 supported, 16 partial and 1 unsupported** answers.
Only `volvo-cars/cds-ecom-customer-service` was analysed, at commit
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`. Wider scans remain stopped.

- [Question review](answerability-review.md) retains every question and its remaining boundary.
- [Machine-readable review](answerability.json) records the frozen result.
- [Independent source review](source-review.md) fixes the expected paths and storage operation inventory.
- [Pipeline contracts](../../scan-pipeline.md) describe reusable extraction and bounded retrieval.

Q05 follows the individual membership guard through the thrown ID, controller/API/core propagation,
applicable source advice and HTTP 404 response construction. Q14 accounts for three Mongo collections,
their repositories and all 20 source data-operation callsites, including the custom archive upsert.
Those callsites do not establish 20 physical writes or durable completion.

The Fleet proof follows `getFleetAccount` from its input into
`GET /v1/fleetaccounts/{fleetAccountId}`, through the registry-selected logical `fleet` client,
`FleetAccountResponse`, generic `nullCheck` and the record's `data()` projection to the returned value.
It also checks the null guard and all three HTTP error translations. Q12 and Q13 remain partial because
their required scope extends beyond this client path. Effective external client configuration, headers,
codecs and deployed address remain unknown.

## Accepted evidence

Paths below are relative to the workspace root. Earlier development captures remain available but are
not the accepted result.

| Artifact                                  | Path                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Final repository capture                  | `reports/customer-service-bindings-002/repository.json`                           |
| Canonical document and extraction receipt | `reports/customer-service-bindings-001/final/{document,receipt}.json`             |
| Bounded proof and returned records        | `reports/customer-service-bindings-001/final-review/{receipt,pages}.json`         |
| Independent source pin audit              | `reports/customer-service-bindings-001/independent-native/source-pins.json`       |
| Final native evidence equivalence         | `reports/customer-service-bindings-001/independent-native/final-equivalence.json` |

The document snapshot is `6b9e671750d58b91750b6356efce8751f3452ef7771dde0c39e07d8e690247b3`.
The bounded review retrieves 5,669 records in 1,418 pages, totalling 3,015,569 bytes.
All 56 destructive relation/binding checks reject the affected claim after its baseline passes.
An independent Git-object audit verifies 2,555 returned source anchors across 253 production files.
Twenty-one previously accepted native probe evidence sets retain identical IDs and values in the final
repository capture; Q08's default-value proof also rejects eight relation removals.

## Reuse and verification

The final repository run inventories all 386 tracked files and reuses all 340 Java indexes across nine
shards, with no diagnostics. Both its first and warm phases perform zero blob reads and zero parses;
the combined run takes 25.54 seconds. The binding stage reuses those indexes and takes 8.06 seconds.
These are cache-reuse measurements under concurrent work, not cold-scan timings or a measured speedup
against the previous agent workflow. Scripted extraction makes zero model calls; development and review
agent consumption is separate.

Changed-file lint, the full test suite, `npm run check` and `npm run build` pass. A targeted native-parser
run passes 39 tests across nine files, covering shared bindings, Mongo, exceptions, outbound adversarial
cases, evidence selection and Spring document integration. Three Sol agents on Medium worked in parallel
on shared bindings, storage/schema integration and independent source/question review.

Reproduce the bounded acceptance check into a new directory:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-bindings-review.ts \
  reports/customer-service-bindings-001/final/document.json /path/to/NEW-output
```

This remains a source capture. It does not establish runtime security activation, remote or deployment
currency, delivery guarantees or actor journeys. It does not migrate the production workspace reader.
