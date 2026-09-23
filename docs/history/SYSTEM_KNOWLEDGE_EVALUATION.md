# System knowledge evaluation

**History — evaluation notes, superseded by the shipped contract.** For the current catalog discovery contract, see [`../CATALOG_DISCOVERY.md`](../CATALOG_DISCOVERY.md).

Evaluated 17 September 2026 against Order Platform revision `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd`.

Run `node scripts/catalog-evaluation.ts /path/to/catalog-owner` to repeat the assertions. Planning exercises run in a temporary copy, never in the production catalog.

## Retrieval

All eight scenarios passed: exact quote-total lookup, paraphrased quote total behavior, full-features upload, tax-event consumption, pending invalidation processing, market authorization, ambiguous price search, and missing quantum-payroll knowledge. Expected records appeared within the first five results where applicable. Ambiguous searches preserved multiple candidates; missing knowledge returned no invented match. Discovery packets retained uncertainty and stayed below the 32 KiB bound (largest observed: 17,274 bytes).

This single local sample took 82–134.8 ms to read and query the catalog, and 6.5–10.9 ms when reusing an already loaded projection. This is not a persistent-cache benchmark or evidence of end-to-end agent speedup. Broad queries still include irrelevant candidates; narrowing by component and record kind is useful.

## Planning exercises

Two hypothetical drafts exercised feature creation, immutable discovery retention, delivery planning and explicit reassessment:

- Carry upload correlation through the facade API, storage and Kafka.
- Introduce an explicit quote pricing policy.

Both retained endpoint/flow facts, named assumptions and product unknowns, and put component-owned discovery before dependent implementation. They included boundary and end-to-end validation plans and rollback considerations. These are evaluation drafts, not approved requirements or executed source-system tests. No evaluation features were added to Order Platform.

## Live evidence and integrity

The storage migration preserved 676 entities and 1,138 relations while moving 15 logical documents into 66 physical catalog documents. A subsequent pinned investigation added a tax-consumer flow, an owned background job and its execution flow, bringing the catalog to 679 entities. Eight source files were inspected for that investigation. Shared framework behavior and deployment configuration remain explicit gaps; exhaustive downstream tracing was not claimed.

Regression coverage includes migration recovery, mixed-authority rejection, immutable baselines and assessments, source-only drift, explicit retirement and stable-ID rename, message/job triggers, and repository-qualified citations with matching supporting snapshots. Automated checks establish these contracts, not completeness of all product knowledge.

## Remaining limits

Freshness checks are explicit and scoped to recorded source evidence. They do not monitor repositories continuously or prove deployed behavior. A focused scan can guide just-in-time discovery but cannot replace feature-specific requirements, domain decisions or validation of untouched dependencies. Retired observations retain their evidence; automatic restoration is outside this increment.
