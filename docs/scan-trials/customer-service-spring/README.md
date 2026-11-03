# Customer service Spring bindings

The reusable extractors now publish source-backed Spring routes, schemas and security bindings natively.
The independent review retains all 22 original questions: **3 supported, 18 partial, 1 unsupported**.
Only customer-service was refreshed; the wider repository queue remains stopped.

## Accepted capture

Repository: `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea`, parsed with the managed Java 25 compiler.

- [Repository capture](../../../reports/customer-service-spring-002/repository.json): all 340 selected Java
  files, including 256 production files and 84 tests; no parser diagnostics. Tests are parsed, never run.
  The final warm generations share the accepted analysis fingerprint; the development first phase spans
  a formatting change and is not the accepted provenance baseline.
- [Framework document](../../../reports/customer-service-spring-001/bindings-final/document.json):
  19 routes with exact implementations, 278 declared source shapes, 19 method policies and one header
  interceptor. Shapes include internal source types; they are not 278 complete public wire contracts.
- [Binding receipt](../../../reports/customer-service-spring-001/bindings-final/receipt.json): all nine
  source baselines and actual cache statistics.
- [Independent bounded review](../../../reports/customer-service-spring-001/review-002/receipt.json):
  1,636 records retrieved completely across 409 pages, using four-record/64 KiB page limits.
- [Frozen question review](answerability-review.md) and [machine-readable results](answerability.json).

## What changed

Routes join inherited mappings and prefixes to exact implementation signatures, parameter locations,
defaults, declared generic response types, schema references and security references. All 17 customer
and audit routes link to the configured `/v1/customers/**` interceptor; both migration routes are outside
that scope. Policy declarations, configuration exclusions and imported configuration retain source anchors.

Schemas retain inheritance, generic substitution, enum values, property/getter annotations, validation
groups, JSON views and polymorphism. The actual nested `Views.Update` and `Views.Patch` inheritance is
resolved without inventing package-level types. Unresolved inheritance becomes a gap. Field constraints
remain separate from mandatory wire presence and effective ObjectMapper behaviour.

Every nested source reference, binding kind and repository/commit pin is validated. Bindings use the
existing bounded record API; detailed execution graphs remain in the repository's immutable shards.
False-positive tests cover custom annotation/type names, misleading body text, missing compiler calls,
wrong references, changed source pins and removed query relationships.

## Question acceptance and limits

Q01 now establishes all 19 paths and declared request/response types. Q07 and Q08 establish the unchanged
write guard and the immediate-versus-later archive branch/default reason. Their typed evidence is verified
against the final capture in
[the equivalence receipt](../../../reports/customer-service-spring-001/native-review/final-equivalence.json).

The source excludes security auto-configuration and imports external `EcomWebAppConfiguration`; its exact
dependency implementation is unavailable here. Method-security activation, effective filter rules and
authority conversion remain unresolved. Jackson configuration, external types and generated accessors
also prevent claiming complete wire shapes. Cross-call effects, asynchronous guarantees and actor journeys
remain partial or unsupported as detailed in the unchanged 22-question review.

The final warm extraction took 13.02 seconds across nine shards; binding publication took 8.92 seconds.
Each reused all 340 indexes with zero source-blob reads and zero parses. These are cached runs under
concurrent development checks, not cold-scan throughput measurements. Extraction used zero model calls;
the separate agent reviews are not included in that count. Bindings currently regenerate from cached
indexes rather than reusing persistent semantic summaries.

`npm run lint:changed`, `npm test -- --testTimeout=15000`, `npm run check` and `npm run build` passed.
See [the pipeline guide](../../scan-pipeline.md#bind-spring-declarations) for the reusable command and
the distinction between source freshness, analysis freshness and unobserved deployment state.
