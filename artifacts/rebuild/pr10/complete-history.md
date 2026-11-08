# Historical explorer cutover

Volvo data PR 4 merged at `68d6a129a16d1401c38451f113eb0f76f008a765` after both CodeQL checks passed.
The committed archive index is 61,965 bytes with SHA-256
`8330e53640d90943fcdefa6ba1c7caba0333b24253397fe7bbf495d0e53c3401`.
Its receipt is `artifacts/rebuild/pr10-direct-history/direct-proof.json` in that revision.
It adds 108,788,101 bytes across 4,246 generated files.

## Preserved addresses and original bytes

Independent readback reconciled all 541,105 live addresses in 108 repository scopes and all
1,727 fallback addresses in the two older scopes. It compared archive content to the original
page receipts, checked unique addresses and exact SHA-256 digests, and found zero unavailable
recorded targets in either publication. The 191,858 additional pages comprise 86,991 data
and 104,867 overview pages. Both publications keep their recorded caller roots, incoming
references, nested data targets and source-file addresses. The fallback has 986 incoming
or target occurrences, all resolved, including 36 retired method destinations.

The original 1,725 entry pages keep their flow nodes, edges, data shapes, source links, labels
and selection identities. The 245 verified native matches have current entry links. The other
1,480 remain historical. The 561 reviewed interpretations and their original reasoning, review
and context are retained separately. Only the 215 with complete canonical citations become
canonical claims. See [historical-release.md](historical-release.md) and
[archive-release.md](archive-release.md).

The two fallback scopes share a flat page namespace. Of the 1,088 preserved fallback snapshots,
1,086 have a single source pin. The two caller roots have either mixed source pins or none.
In the shared data set, 275 pages cite Customer Service and 775 cite Pretax. The archive
distinguishes the source revision of each from the repository selected for browsing. For example,
`?service=gpe-pretax&page=page-ed3cc3e2dd5f17099cab3996.json` presents the original Customer
Service `09623ab3a1f39845d8fc02abc3d591b53a3b5fea` GraphQL data inside the Pretax browsing scope.
Both caller roots retain their scope and their individual source links.

## Approved retirement

Arbitrary source operations, method-only flows and embedded source excerpts retire under the
user's explicit approval. Their addresses have recorded dispositions and original pinned source
destinations. The fallback has 639 method-only addresses, of which 190 belong to Customer Service
and 449 to Pretax. The code at `329dc9f225b1f640f05b782357453aa06ca45c40` and the original data
remain available for historical replay. The old browser's source transport and client runtime can
retire once the new route proof and parity gate pass.

## Bounds and current interaction

All 4,391 packs were checked for exact size and unambiguous bucket prefixes. The largest
direct pack decodes to 2,541,651 bytes, the largest method disposition pack to 3,989,857 bytes,
and the largest base pack to 1,024,719 bytes. All are within the existing 4 MiB decoded limit.
The largest scope manifest is 1,371,366 bytes. Corrupt objects fail the bounded read or digest
check before display and the retry control reloads the same address.

Historical indexes search repository, entry and reference labels while preserving the exact
destinations. A selected node lists its recorded incoming and outgoing connections. Overview
diagrams use the same recorded edges as before. The native canvas covers recorded triggers,
failures, grouped effects, schema references and exact calls, publications and causes. Both
canvases provide the observed pan, zoom and fit controls. The original explorer supplied no
fullscreen control.

## Route proof

The base-path preview requested 27 pages after the old browser was removed. It returned
200 for all 18 frozen Volvo selectors, the three workspace history roots, two previously
unavailable live pages, two older fallback selections and the native nested entry step.
The largest uncompressed response was 89,921 bytes. Both retired browser-only asset endpoints
returned 404. The exact URLs and measured sizes are in `complete-history-http.json`.
Focused tests cover search, reloading after a corrupt read, selected-node links, the exact fallback
data pin, native step history, recorded targets and shared canvas viewport behaviour.

The retired exporter and publisher, installer, refiner, packer and entry repair commands are
available in a detached checkout at the predecessor revision above. The historical route reads
only the committed archive. The active model scanner and evidence index keep their own
bounded input readers. The in-place legacy evidence migration is also historical.
