# Eight repository source captures

Combined review candidate: **328,250 records**, **26,551 input source ranges**, and **61 independently authored
acceptance requests replayed**. Exact graph nodes, edges and query limits match their repository-local results in the in-memory indexed reader.
A separate SQLite import/replay passes all 61 requests; unlimited graph nodes/edges match regardless of order.
Every request, response and supporting-record continuation is schema-validated within the declared limits.
The earlier `query-acceptance.json`, `query-results.json.gz` and `sqlite-acceptance.json` are retained prototype
graph checks: their non-value request representation required correction before strict contract acceptance.
The strict replay changes that request mode to `constructed`; graph nodes, edges and limits are identical.
The source-evidence ledger records unique evidence after deduplication; it reuses independent pinned-source
checks and exact source-tuple equality for return-only successors, rather than claiming a new source rerun.

Snapshot `bc0610c246dadbb0e8084a03ddcc7b78052291b7c82f4d1e2a7f1ddd3ee60f17`.
[Compressed bundle](bundle.json.gz), [snapshot](snapshot.json), [reconciliation](reconciliation.json),
[strict query acceptance](strict-query-acceptance.json) and [source evidence](source-evidence-provenance.json) retain the result.

The bundle is compressed for storage. Decompress it to a new local JSON file before using the canonical
validator or importer; its parsed contents and snapshot digest are unchanged. Query replays use the indexed
reader, not a browser loading the whole bundle.

The candidate combines Transaction r6, Inbound r3, Customer r8, Assortment r5, Manage and Segment r3,
PSP Integration r2, Scheduler r1 and Account Profile r2. Five conflicting shared historical facts explicitly
select the current Manage and Segment revision; 597 identical shared records are deduplicated. Inbound's
standalone workspace alias is normalised only in combined bundle metadata. Original sealed inputs remain intact.
No cross-repository execution or producer/consumer match is inferred from names.

This candidate has not replaced the earlier selected bounded manifest or production application data.
Historical proof graphs remain supporting scope and must be separated from current registration catalogue
views before application adoption. Assortment's internal processor entry lacks an exposure binding: use its
actual worker implementation or separately established subscription; a successful implementation query is
not evidence that the internal entry ID has a runtime exposure.

Broad Scheduler polling and some Transaction create views retain node limits. Local source completeness does
not mean whole-query exhaustiveness or runtime proof. Imported dispatch/transport, effective wire formats,
path feasibility, heap state, deployment and acknowledgement/durability distinctions remain explicit.

The [strict SQLite replay](strict-sqlite-acceptance.json) measures this local candidate: import 23.1 seconds, index size
1.01 GB, median query 99 ms, p95 795 ms and maximum 1.57 seconds. This is single-process evidence on this
machine, not a production SLA, concurrent UI benchmark or an exhaustive result for node-limited queries.
The disposable index stays under reports; the canonical compressed bundle and immutable selection are portable.

[Component identity findings](component-reconciliation-findings.json) also retain two source declarations
sharing a recurring-charge topic logical ID. Matching names do not establish broker/profile identity; these
records are not silently merged or counted as two observed deployed topics. This remains a reconciliation
gate, alongside historical/current catalogue views. A large endpoint can also hit its control budget before
an outbound edge appears; partial empty interaction results must stay diagnostic, with source-body drill-down.
