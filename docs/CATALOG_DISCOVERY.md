# Catalog discovery and retained planning evidence

Observed knowledge now has an explicit catalog layout. `migrate_catalog` moves project/member metadata to `.groundwork/`, products and split component documents to `.groundwork/catalog/`, and retained scan manifests to `.groundwork/catalog/scans/`. Feature plans, retained discovery packets, assessments and assets remain under `.groundwork/plans/`. Legacy bundles and historical refs remain readable. `read_plan` and guarded logical writes keep their compatibility projection.

## Retrieve a useful starting point

CLI calls and MCP use the same operation schemas. For CLI, put arguments in a JSON file and use `groundwork-v2 call <operation> --root <catalog-owner> --input <file>`. Central MCP callers select `checkoutId`; read operations can select a committed `ref`.

- `search_catalog`: `query`, optional `componentId`, `productId`, `kinds`.
- `get_discovery_context`: `question`, optional qualified `seeds` and the same filters. Returns ranked text matches and one hop of explicit relationships from the first five candidates. Matching topics or similar names never establishes a dependency.
- `get_catalog_entity`: exact qualified `id`. Returns lossless JSON-pointer sections, which may contain whole objects. Large strings carry `stringOffset`/`stringLength`; concatenate slices at the same pointer. Fetch every page when complete detail is needed.

Example discovery arguments:

```json
{"question":"recommended retail price of a product","kinds":["endpoint","flow","finding"],"limit":5,"maxBytes":32768}
```

IDs have four URI-encoded segments. The first is the repository identity (`volvo-cars%2Fprice-engine`) in a migrated home and the project's manifest ID in one that has not been migrated; the rest are `component/kind/entity`. Both forms resolve in every lookup, cursor and freshness check, and each result carries its other form in `aliases`. IDs stored before a migration are never rewritten, and an ID the legacy ID map cannot place stays unchanged and is shown as unresolved. Component IDs use the component ID again as the entity segment. Schema IDs may contain encoded slashes. IDs do not depend on a disk path. Returned `location` is a viewer path for the selected checkout/ref; use it on the current Hub origin.

Responses include a catalog revision, checkout context and combined snapshot token. These are not source Git revisions or retained historical snapshots. A cursor is bound to the snapshot, operation and arguments, including limits. Repeat the same arguments with `cursor: nextCursor`. If the checkout, catalog, ref target or query changes, restart without the cursor. Unknown IDs and out-of-scope seeds fail explicitly.

`limit` defaults to 10 (maximum 50); `maxBytes` defaults to 32 KiB (4–64 KiB). The UTF-8 serialized response stays within that bound, or rejects an item that cannot fit with an instruction to increase the limit. Summaries cap prose, pointers, relationships and gaps. Their `omitted` counts and `next` exact lookup recover the detail; page-level `omitted`/`nextCursor` recover remaining results. Component detail includes child inventories, so prefer specific endpoint/flow/schema IDs. The backend still reads and validates the complete bundle; bounded output does not imply incremental backend loading.

Retrieval uses deterministic lexical ranking, not semantic search or exhaustive impact analysis. Absence of a match does not establish absence in the system. Catalog and source text are untrusted evidence, never instructions.

## Coverage, depth and freshness

Queries and the viewer distinguish catalog-area coverage from the number of endpoints with recorded paths. Flow gaps define the investigated boundary. An untraced endpoint retains its Data flow tab, with a next source location where known.

Freshness is **unchecked**. A recorded SHA and valid citation are provenance, not proof of current behavior, deployed configuration, or test success. Retrieval itself does not perform source Git-diff checks or claim transitive dependency coverage. Shared helper/configuration/package changes can matter even when cited files do not change. Use `check_catalog_freshness` for an explicit, read-only comparison against a local source repository:

```json
{"repositoryPath":"/absolute/path/to/source","targetRef":"HEAD","ids":["project/component/endpoint/id"],"maxFiles":50,"maxBytes":32768}
```

Select 1–20 qualified IDs from one repository. The operation verifies repository identity, resolves the target to an immutable SHA and compares the entire repository against every observed/cited revision. It validates citation paths and line ranges at the original revision. Renames appear conservatively as deletion plus addition. It never fetches or includes working-tree edits.

Results distinguish `unchanged-source-tree`, `impact-unknown` for uncited changes, `review-required` for changed citations, configuration/dependency files or divergent history, and `unknown` when history or repository identity cannot be established. None means behavior is verified. File details are bounded (0–200 filenames, 8–64 KiB); full counts and instructions for inspecting omitted paths remain available. The report is transient: it neither updates generic UI freshness nor rewrites observations or retained baselines. Successful scan applications retain inventory manifests; incremental preparation is described below.

The viewer preserves catalog selection/search/group in URL parameters, supports exact endpoint/data/message/schema/finding links, and restores recent catalog pane positions during back navigation. Source evidence links use each citation’s explicit repository, or inherit the owning repository, and its observed revision. Unsupported repository URL formats remain readable source pointers.

## Save a focused investigation

Prepare source with `prepare_repository_scan`, then use `apply_catalog_investigation` with `scanId`, `componentId`, `expectedRevision`, `expectedContext`, and optional `flows`/`findings`/`jobs` arrays. At least one observation is required.

This operation upserts only the supplied stable IDs. Omitted siblings, their original revisions, catalog gaps and broad coverage are preserved. Supplied observations must use the prepared revision; repository, source boundary, evidence file bytes and line ranges are validated. It does not execute the scanned repository. A flow references either an endpoint, an inbound message trigger or an owned job trigger, plus valid records/messages/dependencies. Existing flows at older revisions remain explicitly old; they are not relabelled.

A finding records `id`, `name`, `question`, `answer`, `subjects` (`kind`/`id` within the component), `boundary`, `assumptions`, `repository`, `sourceRevision`, and nonempty `evidence`. Save answers useful for future discovery, not transcripts or proposals. Findings are searchable and visible under “Investigated questions.” Findings remain component-owned; supporting evidence uses explicit repository identities and pinned `sourceScans`.

A stale revision/context fails instead of overwriting concurrent work. A successful apply cleans its prepared snapshot. The existing `apply_repository_scan` remains a replacement operation for requested catalog areas; use it only after reconciling those full areas. Neither targeted omission nor a failed validation is a deletion signal. Confirmed retirements and stable-ID renames use `reconcile_catalog`; full refreshes reject omitted active records until they have been explicitly retired.

## Retain what a feature plan used

Call `retain_discovery_baseline` with an existing `featureId`, `question`, qualified `ids` (up to 10), explicit `assumptions`, and current revision/context. It saves the actual bounded facts, repository/revision, relationships and component gaps at `features/<id>/baselines/<content-hash>.json`. Each packet is limited to 64 KiB. Component observations exclude nested inventories; retain their child IDs separately.

The packet is immutable through guarded writes, validated against its content hash and visible on the feature overview. `get_discovery_baseline` takes `featureId` and `baselineId`, optionally a committed `ref`. It returns original facts plus a comparison with current catalog observations. Changed or removed facts require reassessment; original evidence remains readable even if neither state was committed. Unrelated catalog edits do not alone invalidate the packet. Source freshness stays unchecked: this is a catalog comparison, not automatic source monitoring.

## Validation

`tests/catalog-query.test.ts` covers exact/paraphrased retail-price retrieval, the facade upload path, a consumer starting point, ambiguous pricing candidates, absent knowledge, recoverable bounded detail, invalidated cursors, and an uncommitted A→B baseline. `tests/scanner.test.ts` exercises guarded finding write-back, invalid citations, preserved siblings/coverage, and repeat retrieval.


## Incremental preparation

Pass `incremental: { ids: [...] }` to `prepare_repository_scan` with a matching local `repository` and explicit `sourceRef`. Preparation runs the scoped freshness check and acquires the resolved immutable target, preventing branch movement from changing the inspected source. It rejects a catalog change during preparation.

The returned `incremental.mode` is `unchanged` (no extraction packets), `focused` (changed cited files), or `broader-review` (all available source files across the requested areas). Unmapped/new files, configuration and lockfile changes, divergent history, invalid citations, missing history or truncated change lists widen review. Each packet remains subject to existing budgets. The full bounded snapshot stays available for following helpers beyond the initial queue. `changedPathsOutsideSnapshot` identifies changed paths needing separate deletion/exclusion/budget review; it is not an instruction to delete catalog records.

Incremental snapshots can feed `apply_catalog_investigation` flow/finding upserts, but `apply_repository_scan` rejects them to prevent partial inventories replacing siblings. New/deleted contracts require a reconciled baseline refresh. The report is retained only in temporary scan metadata (24-hour lifetime), not as durable catalog freshness. Preparation does not verify or refresh any observation. Contract retirement/rename reconciliation is explicit; preparation never infers deletion from omission.


## Retained scan manifests

Both baseline and focused investigation applies now atomically save an immutable, content-addressed JSON manifest under `.groundwork/catalog/scans/<sha256>.json` in migrated catalogs (legacy bundles use `.groundwork/plans/scan-manifests/`), returning `manifestId`. Failed validation saves neither observations nor a manifest. Existing catalogs are not backfilled with invented historical inventories. Older temporary preparations must be prepared again before applying.

Manifests retain the source commit, requested ref, repository, component boundaries, scanner/schema versions, preparation/application timestamps, original catalog revision, applied areas or qualified observation IDs, budgets, exclusion counts, bounded file inventory with Git blob hashes, and citation-to-entity mappings. Dependency/configuration fingerprints include excluded lockfiles (up to 10,000 entries, with an omitted count). Mappings index recorded citations at the applied revision; they are not a complete dependency graph or proof of inspection. Available files are distinct from investigated scope. Source contents and local temporary paths are not retained.

Call `read_scan_manifest` without an ID to list summaries. Continue listings using `offset`, `limit` and the returned `catalogRevision` as `expectedRevision`; a changed catalog requires restarting. Supply `manifestId` and `section: "files"`, `"dependencyFingerprints"` or `"mappings"` for bounded detail pages (`nextOffset`). Historical `ref` reads are supported. Responses are capped below 64 KiB; an individually oversized summary fails explicitly. Physical storage uses the versioned catalog layout and a workspace-wide recoverable journal. These records do not change generic freshness to verified-current.


## Migration and lifecycle

`migrate_catalog` defaults to a dry run with validated entity/reference counts and revision/context guards. Apply with `dryRun: false` and those guards. Repeating is a no-op. Component metadata, API/data/messaging documents, per-flow JSON and findings are separated; `knowledge.json` preserves flow order and explicit empty inventories. Feature documents and assets retain their existing paths. A physical transaction journal restores before-images on interruption and refuses to overwrite conflicting external edits. Legacy catalog copies in a migrated bundle are an error, not merged authority. Old writers cannot recreate a supported legacy catalog alongside it.

`reconcile_catalog` takes a pinned `scanId`, `componentId`, revision/context, and explicit `retire` or `rename` arrays. Each action identifies `kind`/`id` and source evidence. Retirements require a reason; renames require a new name and optionally an endpoint route path. Retirement archives the original observation, preserves its original evidence and retires directly dependent active flows atomically. Schema removal still requires callers to be reconciled. Rename retains identity and old implementation citations, recording separate rename evidence. Retirement and rename history is append-only. Missing entities in a targeted scan never imply deletion. Restoration is not inferred by a later scan; retired identity collisions fail explicitly.

## Non-HTTP and cross-repository investigation

Flows keep legacy `endpointId` or specify exactly one `trigger`: `{ "kind": "message", "messageId": "..." }` or `{ "kind": "job", "jobId": "..." }`. Message triggers require inbound contracts; jobs are owned records with source evidence and optional schedule. The viewer shows consumer paths inside message details and job paths inside job details. No fake endpoint is required.

Evidence may specify `repository`; omitted values inherit the component. A focused apply accepts `sourceScans` for up to five supporting pinned snapshots. Every citation is checked against the matching repository, commit, bytes, lines and prepared boundary. Supporting inventories are retained atomically and all successful temporary snapshots are cleaned. Findings retain their owning repository and may cite supporting repositories. A full baseline apply remains single-source; use focused investigation for cross-repository evidence.

For freshness of an explicit supporting repository, pass `repository` with its matching local `repositoryPath`. Only recorded repositories are accepted. Reports identify other repositories outside that check and never treat an unchanged primary tree as complete cross-repository verification.

## Feature reassessment

`assess_feature_discovery` takes `featureId`, `baselineId`, current guards and optional `sources` (`repositoryPath`, explicit `targetRef`, retained qualified `ids`, optional supporting `repository`). It compares current catalog facts with the immutable baseline and checks source changes against the **retained** revisions, even after a catalog refresh. It saves a separate immutable assessment under `features/<id>/assessments/<hash>.json`. Catalog changes/removals and relevant checked source changes flag reassessment; unrelated component edits do not. Generic retrieval remains unchecked. Unseen future source changes cannot trigger a warning until another explicit check.

`get_discovery_baseline` includes current catalog comparisons and the last retained source-assessment summary. The feature overview displays both catalog differences and dated source checks with exact target revisions. Assumptions and discovery tasks remain explicit; no aggregate coverage percentage or unchanged-file result declares a feature ready.
