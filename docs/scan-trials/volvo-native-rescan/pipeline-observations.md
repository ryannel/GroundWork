# Scan pipeline observations

The user has stopped all active code scans, superseding the earlier instruction to finish work underway. No Conditional Order checkpoint completion, further repository scan or CDLS unit should run. Completed selections and unfinished drafts are preserved separately. This records evidence for the discussion; it does not approve or implement a replacement pipeline.

## What the current pass taught us

Endpoint control/data flow, runtime component identity, exact schemas and pinned source anchors remain essential. Independent reviews found real errors: missing source await dependencies, omitted native nullability, helpers mistaken for remote boundaries, source-known void calls given fabricated results, and generic dispatch treated as resolved without its invocation context. Mechanical validity and record counts did not catch all of these.

A repository-wide syntax/body census is useful discovery, but it is not semantic coverage. A native execution graph made from unreviewed syntax must not be presented as a fully understood repository. Likewise, a direct handler-to-SQL query does not establish an endpoint-to-handler dispatch path. A truncated query remains truncated even when every support page has been downloaded.

## Measured query packaging cost

The Facade author's primary query directory contains 3,903 request files totalling **9,176,958,874 bytes**, plus 3,903 compressed response files totalling **2,312,235,543 bytes**. This excludes its separate registry-query pack. Its largest request is **5,786,937 bytes**, carrying **70,000 omitted IDs** despite a 5,000-record page cap. Growing omission lists and recursive supporting-record closure defeat any assumption that node/record caps alone provide a small retrieval budget. See the [exact measurement](captures/cce-optimization-facade-complete-r1/independent-source/pagination-cost.json).

The independent Facade review used 43 targeted queries over 81 strictly validated pages, with about 40 MB of compressed complete proofs. It retained eight broad traversal bounds and the unresolved generic-registry dispatch. This is evidence that targeted acceptance can produce a smaller useful review pack; it is **not** a measured throughput comparison or proof that it replaces every author's check. Agent time, tokens, extraction time, query latency and comparable question coverage have not yet been benchmarked.

## Points to settle before resuming

- Separate cached source discovery from canonical system facts and derived UI/agent projections. Keeping an AST/source index does not require eagerly materialising every possible execution context or support closure. Detailed source exploration must remain available when an endpoint question needs it.
- Reuse tested extraction rules for source registrations, framework declarations, calls, schemas and storage. Record extractor/rule versions and actual dependency correspondence; an annotation or nearby library repository is not proof of effective runtime behaviour.
- Account mechanically for discovered endpoints, consumers, stores and outbound sites. For each item distinguish source-known, source-supported, unresolved, excluded and not yet examined. Route agent attention to ambiguous dispatch, security, transformations, asynchronous behaviour and failure windows.
- Cache extraction and evidence verification by pinned content and extractor version. Invalidate dependent facts when code, configuration, schemas or imported implementation correspondence changes. Validating only unchanged cited lines is insufficient.
- Replace repeated client-carried omission lists with a considered bounded retrieval contract. Compare compact snapshot-bound cursors, lazy related-record expansion and explicit byte/time limits. No paging protocol change has been implemented in this run.
- Use finite runtime-component work units with separate extraction and review queues. Keep compact reports and reproducible checks; do not require thousands of copied requests per repository as a proxy for confidence.

A possible next experiment is three fixed representative scopes using existing pinned sources: a Spring write/async endpoint, a Go route/typed-dispatch/River path, and a Next/browser/server unit. Agree the question set and expected evidence first, then compare extraction/review cost, incremental refresh cost, query size/latency and missed or incorrect facts. Keep failures and unresolved cases in the result. These are discussion proposals; no benchmark or new scan has started.
