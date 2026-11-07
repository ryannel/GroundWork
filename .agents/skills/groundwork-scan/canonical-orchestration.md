# Canonical orchestration

Historical reference for retained proof. For current workspace authoring, use the consolidated
[Groundwork schema](../groundwork-schema/SKILL.md) and [native scan](../groundwork-scan/SKILL.md).

1. Establish the repository/revision inventory, investigation scope, output directory and existing logical IDs.
   Existing workspace repository lists can seed discovery; their team/system assignments do not determine
   runtime boundaries. Include downstream source only at an explicit revision, and distinguish candidates.
2. Brief one explorer per repository in parallel using [groundwork-explore](../groundwork-explore/SKILL.md),
   explicitly selecting canonical mode. Give each the clone path/full commit, workspace ID, related record/ID
   index, source/dependency inputs and output path. Require a discovered-entry inventory, native coverage and
   gaps, and complete referenced schema closure rather than selected happy paths.
3. Reconcile discoveries before snapshot selection: match technical components, resources, entries, contracts
   and source revisions by their natural identities; retain existing logical IDs and reconcile every reference.
   Shared code must keep its invocation host. Do not join services by similar names, teams or repository names.
   Preserve version mismatches as gaps and candidates; do not promote them into resolved calls or handoffs.
4. Validate all selected bundles together with `the historical bundle validator -- <bundle.json> [<bundle.json> ...]`.
   Fix conflicting IDs, missing references and host/contract/continuation inconsistencies before writing a new
   snapshot. Verify pinned sources with `--sources <clone-root>` and use `--write-snapshot <new.json>` to create
   a new immutable selection; use `--snapshot <snapshot.json>` to verify an existing selection.
5. Review the endpoint acceptance questions and report discovered entries, obligations examined/partial/not
   examined, unresolved calls, partial schemas, excluded candidates, evidence checks and tests actually run.
   Separate schema/reference validity from behavioural coverage and runtime verification. Keep previous
   immutable bundles/snapshots and the original Volvo v1/v2 fixtures unchanged. A source check cannot prove
   deployment, transport delivery or exhaustive behaviour. Canonical query smoke tests and proof walkthroughs
   are useful acceptance evidence; the existing proof CLIs are limited to the named Volvo fixtures.

For incremental canonical work, use source/dependency invalidation, not only changed cited lines. When
closure is unknown, re-explore conservatively and preserve partial coverage. Legacy diff/mark tools do not
track all semantic dependencies or provide canonical snapshot publication.
