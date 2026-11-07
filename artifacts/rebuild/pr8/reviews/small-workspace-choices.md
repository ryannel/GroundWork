# Small-workspace migration choices

Independent read-only cross-check of the fresh personal and Acme review packets. No source data, acceptance rows or migration outputs were edited during this review.

## Scope and count

The pending packets contain 33 subjective decisions: three external identities, four resource-owner claims and 26 uncited edges. Acme has two identities, four owners and 24 edges (five contract declarations and nineteen summaries); personal has one identity and two summary edges. The dry-run source fingerprints are recorded in each `migration.json` and must remain pinned when acceptance packets are written.

## Identity decisions

| Source declaration | Evidence | Reviewed disposition |
| --- | --- | --- |
| Met Office DataPoint, Daily frost and rain forecast | `workspaces/personal/domains/side-projects/systems/allotment-log/system.yaml:22–25` explicitly names it and marks it external. | External boundary. Preserve both exact texts and the old-to-new alias. No new implementation, operator contract or schedule is inferred. |
| Card provider, Charges cards | `.workspaces/rebuild/acme/domains/orders/systems/payments/system.yaml:15–19` explicitly marks the generic provider external; `contracts.yaml:15–21` records its separate API provider and POST signature. | External boundary as a labelled placement interpretation. The operator is unknown; do not invent a vendor or legal-ownership claim. Preserve Charges cards and the actual API declaration. |
| Identity provider, Checks passwords | `.workspaces/rebuild/acme/domains/storefront/systems/accounts/system.yaml:14–18` explicitly marks the generic provider external. | External boundary as a labelled placement interpretation. Retain Checks passwords and visible unknown-operator wording. Do not infer the operator from its consuming system's team or repo. |

These choices classify a boundary using the source's existing external label. The two generic names do not identify an organisation. An interpretation label and unknown-operator description are therefore material, not editorial decoration.

## Owner claims

The four claims are present but uncited at the resource record:

- `st:orders-db → svc:order-api`: Acme ordering `contracts.yaml:2–8`.
- `st:order-events → svc:order-api`: Acme ordering `contracts.yaml:9–14`, rewritten to native `top:order-events` with its alias retained.
- `st:products-db → svc:products`: Acme products `contracts.yaml:14–20`.
- `st:search-index → svc:search-indexer`: Acme search `contracts.yaml:2–10`.

The cited Products component summary at `products/contracts.yaml:1–12` does not provide a resource-level citation for the separate ownership assertion. An `origin: extracted` label also supplies no implementation pin. Omitting these four current owner fields is the narrow safe choice, provided the original owner assertions remain in the committed review records. It does not move the resources or make their owners false. `model-index.ts` derives `no_owner` when no cited owner exists; that visibility must be verified on the converted copy.

## Uncited edges

All 26 candidate rows have empty matching evidence or empty contract citations. The five Acme contract rows are the declared OrderPlaced producer/consumer, ProductChanged producer/consumer and search-index read access. The other 21 rows are `talks_to` summaries, including the two personal edges. The summaries retain their complete source endpoints/transport labels in the review packets.

Endorse explicit unverified dispositions, with no fabricated relationship/connection, handler, citation or implementation pin. A curated flow remains a narrative and does not replace missing cited execution backing. Every original row, source fingerprint, alias rewrite and accepted disposition must remain available in committed artefacts; an ignored dry-run folder alone is not a durable home.

The specification explicitly routes unproved declarations to `review-edges.yaml` (`docs/rebuild/rebuild.md`, PR6 item8). Those records are retained uncertainty, not proof that a relationship does not exist. The current graph must continue to distinguish no recorded execution from a disproved connection. Before replacing the small source copies, reconcile the corresponding baseline differences to these exact rows and verify the backed facts that remain.

## Review conclusion

Endorse all 33 proposed conservative choices under the user's delegated reversible-review authority, subject to the retention and visibility obligations above. No additional product decision or schema amendment is needed for these choices. This receipt is a review recommendation, not an acceptance file.
