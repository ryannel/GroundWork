# Customer service pipeline trial

Subsequent [Java 25 parser upgrade](java25.md): all 340 files now parse without diagnostics; the six parser
quarantines reported in this historical trial are resolved. Other semantic gaps below remain.

The full customer-service trial produces useful, queryable local source facts, but **does not yet close
end-to-end system questions**. Independent Sol reviewers on Medium tested 22 questions fixed before reading
the capture: **20 have partial answers, two are unsupported, none are fully closed**. Seven narrower local
proofs pass with actual bounded evidence retrieval. This is an answerability review of demanding questions,
not an accuracy percentage for all possible questions.

**Only customer service was scanned. All other repository scans remain stopped.** No production scan marks
moved and the application has not migrated. The source pin is
`volvo-cars/cds-ecom-customer-service@09623ab3a1f39845d8fc02abc3d591b53a3b5fea`.

| Coverage                                        | Result |
| ----------------------------------------------- | -----: |
| Tracked entries inventoried                     |    386 |
| Production Java files attempted                 |    256 |
| Java test files attempted, never executed       |     84 |
| Java files without parser diagnostics           |    334 |
| Java files quarantined from semantic answers    |      6 |
| Ancillary UTF-8 texts retained, not interpreted |     45 |
| Binary explicitly excluded                      |      1 |
| Bounded immutable shards                        |      9 |

## What it can answer

These narrower questions have native local proofs, with relations and pinned source anchors delivered
through the bounded reader:

- Inside `saveAndPostProcess`, does equality return before validation, save and post-processing? **Yes.**
- Inside `CustomerApiService`, which call is chosen by `forceArchive`? **False selects mark-for-later; true
  reaches the immediate move call.** A missing reason becomes `NONE_SPECIFIED`. That establishes branch
  selection, not successful archival. The retained controller description conflicts with this implementation.
- During restoration, does the local save call precede deletion from the archive? **Yes.** Atomicity and
  persisted state after failure remain unproved.
- Which post-processing calls occur in order? The local invocation sequence is captured; successful audit,
  publication, durable completion and runtime activation are not established.
- Which marketing-consent guards exit before the send call? The graph establishes four skip guards;
  effective payload serialisation and broker delivery remain unresolved.

The other two local proofs establish the customer ID passed by the delete consumer and the scheduler's job
start call. The [22-question review](answerability-review.md) gives every broader question, its actual partial
answer and the precise missing evidence. For example, request field declarations exist, but effective
create/update/patch wire schemas do not; role policies exist, but enforcement is unbound. Actor journeys and
the quarantined order-update consumer are unsupported. All **2,720 broad obligation answers remain unresolved**.

## What the full trial exposed

We corrected four concrete defects rather than promoting partial captures into complete answers:

1. Classes without explicit methods now retain structured declarations, fields and annotations. These remain
   source declarations, not resolved Lombok/Jackson wire contracts.
2. Java throws have their own node kind, including rethrows in catches.
3. Parser diagnostics now quarantine the entire file's semantic/local extraction. Java 17 cannot faithfully
   parse the repository's Java 25 record/unnamed patterns. Recovered trees had truncated real returns.
   The six files retain source, diagnostics and explicit gaps; a compatible parser is still needed.
4. Analysis host IDs and component placeholders now remain consistent across all nine shards. They do not
   establish which components are deployed or where libraries and tests execute.

The [adversarial review](adversarial-review.md) records the original findings and verifies their correction.
Remaining extraction limits include inline comments confusing operator recognition, unbound framework/receiver
resolution and unsupported constructs. None is silently converted into a resolved effect.

## Cost and freshness

The original empty-cache pass took **155.4 seconds** for 340 source reads/parse attempts. Its unchanged pass
took **9.2 seconds**, with **zero source reads and reparses**. Initial cold shards overlapped lint/unit tests,
so these are observational timings. They do not establish a speedup over the previous agent workflow.
The scripted extraction makes zero model calls; implementation and agent review consumption were not measured.

After the fixes, regeneration reused all 340 indexes with no source reads or reparses. The final selection is
[trial 003](../../../reports/customer-service-pipeline-003/repository.json). Its 18 first/warm documents are
byte-identical to the corrected [reviewed trial 002](../../../reports/customer-service-pipeline-002/repository.json),
so the exported query evidence remains valid; only scanner provenance changed in the last refresh.
The [original trial](../../../reports/customer-service-pipeline-001/repository.json) remains immutable.

Local HEAD and current scanner/schema/toolchain fingerprints were checked for every shard. Remote and deployed
freshness remain unknown. Parser caches are reusable, but the six files require a compatible Java parser
before semantic answers can be accepted.

Storage and retrieval still need work: the final pretty JSON captures total **169.8 MB for 0.90 MB of source**.
Four records exceed 64 KiB, and the reader clones/indexes the whole shard before serving bounded pages.
The 21 review probes retrieved 6,503 records in 1,632 pages, about **2.81 MB**, because they export complete
local proof slices. This is useful auditable evidence, but a compact question projection and persistent index
are needed before making these captures a fast UI or agent-facing repository query service.

## Next work justified by this trial

Prioritise compatible parser selection; Spring route, implementation, validation and serialisation bindings;
resolved storage/publication/outbound contracts; and compact indexed question projections. Actor actions and
visible outcomes need explicit evidence and composition. More repository scans would not close those gaps.

The reusable command, cache refresh, quarantine and publication contracts are in the
[pipeline guide](../../scan-pipeline.md). The [machine-readable trial receipt](trial.json) preserves source pins,
selection hashes, observation times and counters; [question results](answerability.json) preserve all 22 scores.

## Verification

`npm run lint:changed`, `npm run check` and `npm run build` pass. The final full check passed
2,530 tests, coverage thresholds and 100% type coverage. Seven explicit native Java tests and six
diagnostic/probe regressions passed separately. The build exported 391 pages. No Volvo application or
repository tests were executed.
