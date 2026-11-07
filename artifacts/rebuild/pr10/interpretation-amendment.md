# Approved PR 10 clarification for archived interpretations

Design §7 and the frozen explorer parity inventory require the reviewed Inferred material and
reference repairs to survive the explorer. The published explorer displays its reviewed text
through `tools/refine-explorer-interpretation.ts:19`. The canonical `EvidenceClaim` definition
at `schema/evidence.schema.json:6601` requires citations and has no fields for the source context
snapshot, reviewed alternatives or the original run and review metadata.

An independent audit verified all 561 published claim projections against 108 exact sidecars and
their checked review hashes at the matching repository pins. Every claim's identity, statement,
reasoning, confidence and limitations matched the published page. The canonical evidence validator
and persisted top-level IDs show:

| Claim count | Canonical support |
| ---: | --- |
| 150 | Every observed citation resolved and the canonical claim validated. |
| 60 | At least one observed citation would have to be dropped for this partial transposition. |
| 5 | All observed citations were absent from canonical evidence. |
| 346 | The only support was an examined context snapshot. |

All 561 refer to a source context snapshot. Thirty-four distinct observed record identities are
absent across 13 repositories, including 29 summaries and five sources. The canonical repository
and observed support pins showed no mismatch. Schema validation rejected 351 claims because they
would have empty required citations. This accounts for the 346 context-only claims and the five
claims with absent observed support. The original confidence stays attached. The review has an
explicit partial-source-discovery state for 215 claims, and 346 carry no explicit acceptance state.

A read-only recovery located all 34 missing originals at the same pins in the live SQLite index
and checked their exact values against the original cache or evidence. The canonical closure
adds 357 schema-valid records, including 29 summaries, 186 sources and 142 gaps. All 213 cited
source spans checked against the recorded Git tree, blob and physical lines. With this closure,
all 65 affected claims validate with their full observed support. The resulting denominator is
215 complete canonical candidates and 346 context-only claims.

For example, Account Profile API's `inferred:purpose` at
`bc3003a9130cd9a8013d74ec4561575d1f1d935b` is in the epoch-003 interpretation sidecar at
lines 59–111 and its associated review at lines 184–197. The published page
`page-1c785f0acfa389ee8a18825b.json` reproduces its text, medium confidence, reasoning and two
limitations. All three framework records and three source records are canonical at that pin.

## Approved change

Permit a durable, checksum-pinned archive of the published Inferred sidecars, reviews and examined
contexts alongside canonical evidence. Preserve all 561 interpretations with their original
metadata and make them available through a repository-scoped evidence destination. Link canonical
claims back to their archived originals, and promote only the claims with every observed citation
resolved at its recorded pin. The 346 context-only claims stay visibly archived with their original context. This leaves current-fact evidence and the canonical claim validator strict.

Prove the archive from the original bytes and installed projections, verify access to both groups,
and pin a claim-by-claim crosswalk before any explorer removal. The user approved a separate Volvo data PR to publish the archive and approved retiring the
method-only UI after the pinned source and reviewed interpretations are preserved.

The local per-claim and per-record receipts are `pr10-canonical-claim-audit.json` (SHA-256
`92b6f462b1d0b4e4cfe0d852d6be87c2b0aef0ee1cb0e0c114385e44cceda473`) and
`pr10-claim-support-closure.json` (SHA-256
`e6fd951a81a39ce18e98634047306232b774270da6a96a58f36bd44bb0542043`). The exact Volvo
records remain in the local proof directory for use in the separate data PR.
