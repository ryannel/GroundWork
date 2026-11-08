# Canonical execution records

Replay the historical workflow at Groundwork revision `329dc9f2`. Use the native scan skill
for current model updates.

Historical reference for retained proof. For current workspace authoring, use the consolidated
[Groundwork schema](../groundwork-schema/SKILL.md) and [native scan](../groundwork-scan/SKILL.md).

Read `schema/knowledge.schema.json`, `docs/scan-trials/runtime-components.md` and the practical
[canonical authoring workflow](../groundwork-explore/canonical-scan.md). Objects are closed: consult the schema
for every field and enum. Generate domain types with `npm run generate:knowledge`.

V3 separates runtime components, implementations/execution bindings, resource/entry bindings, interface
contracts and call-site interactions. Stores and topics are components. Technical identity is independent of
teams and domain/system grouping. REST/message/storage shapes retain representation, completeness and
commit-pinned evidence; source DTOs and candidate library versions do not establish effective wire contracts.
V2 records still describe writes, channels, subscriptions, handoffs, delivery and consistency.

Source-declared shape constraints include `additionalProperties: boolean` on `container: object` shapes and
scalar field `const` (including null) or nonempty, unique scalar `enum`. Retain their evidence and
representation: known fields or `completeness: closed` do not establish an additional-properties policy,
and a sample value does not prove a constant or an exhaustive enum. Do not promote source constraints into
effective wire enforcement without evidence. A compact offline worked capture and eight acceptance requests
live in `test/fixtures/knowledge/notification/`; `tools/scan-example.test.ts` verifies its bundled synthetic
source and queries. Its example GitHub repository identity is synthetic.

For an SDK argument with unknown transport/serialisation, retain construction in the contract's `sourceShape`
with a gap for unresolved wire shape/presence. Use interaction `selection` for the whole source argument and
`result` for the returned object, explaining the unresolved placement in the transformation. Do not label an
SDK object an HTTP body merely because the object fields are known.

Validate arbitrary bundles with `the historical bundle validator -- <bundle.json> [<bundle.json> ...]`;
`--sources <clone-root>` checks pinned files/ranges, `--snapshot <snapshot.json>` verifies a selection and
`--write-snapshot <new.json>` creates one without overwriting an existing manifest. Structural/semantic
validation is distinct from completeness and source verification. Native coverage is per obligation and uses
`examined`, `partial` or `not_examined`; no passing validator proves all repository entrypoints were found.

Preserve `schema/knowledge-v1.schema.json`, `schema/knowledge-v2.schema.json` and original Volvo fixtures'
replay rules. Keep canonical outputs outside production workspace YAML. Do not copy JSON record keys into
`contracts.yaml`/`handlers.yaml` or substitute an unvalidated companion for canonical records.
