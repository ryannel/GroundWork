# Semantic edge identities

Semantic edge identities describe the complete edge fact, independently of traversal order.

The analysis identity version is `semantic-edge-identity/v1`. Both compiler graph emitters use the shared
`semanticEdge` factory and `createSemanticEdgeWriter` in
`src/infrastructure/scan/semantic-edge-identity.ts`: the backend emitter covers Java and Go, and the
TypeScript emitter covers TypeScript and JavaScript. The rule fingerprint includes this implementation.
The parser, source and semantic node identity formats have not changed.

An identity is `semantic-edge:v1:` followed by the SHA-256 digest of the version, a NUL separator and the
canonical JSON edge body. The body contains every field except the root `id`, including `kind`, `owner`,
`source`, `from`, `to`, `relation`, and any supplied `position` or `label`. Object keys sort by Unicode code points;
array order remains significant. Missing optional fields remain distinct from supplied zero or empty text.
Non-finite numbers and values that cannot be represented in JSON fail explicitly.

Adding an unrelated edge or changing the order in which roles are traversed does not renumber existing
facts. Changing a semantic field changes the identity. This guarantee assumes that source, owner and node
identities remain the same: source-content changes can still change their existing content-based identities.
The change introduces no source facts and removes no semantic bodies or relations.

Repeated edges with distinct positions, labels, sources or other semantic fields remain distinct records.
The writer rejects an exact duplicate full-body emission by default. Native compiler graph projections
explicitly coalesce exact repeated facts and count every repeated emission in
`extractBackendSemantics(...).diagnostics.exactDuplicateEdges`, propagated as
`extractLocalFacts(...).semanticDiagnostics.exactDuplicateEdges`. This handles retained compiler indexes
which repeat the same parent/child projection. All distinct semantic fields, including positions and labels,
remain separate facts; no occurrence suffix or invented provenance is introduced. A detected hash collision
still throws. Callers can report the normalisation counter alongside extraction statistics.

Existing accepted captures remain immutable. The read-only `semanticEdge` factory can project an old edge
onto its natural identity without changing the original object. The existing
`tools/scan-native-replay-migration.ts` checker verifies a unique bijection with every non-ID edge field and
every non-edge record unchanged. Strict replay remains the default; an explicitly requested semantic-edge
ID migration is required for the legacy sequence-based identifiers. Changed facts are not an ID migration.
