# Repository scan readiness

The pipeline is prepared for explicitly authorised repository passes with declared limits. The wider Volvo
queue remains stopped. Readiness concerns the scan workflow; it does not mean every source question or
runtime behaviour has been resolved, and does not migrate the application.

## What a scan now produces

1. A pinned tracked-file inventory, explicit exclusions and retained ancillary bytes.
2. Checkpointed source shards, reusable syntax indexes and typed source facts. Only changed or added source
   needs parsing; a same-blob rename reuses its index and regenerates source anchors. Deleted files retire
   their facts. Analysis changes regenerate facts; parser changes reparse retained bytes.
3. A lightweight Spring entry catalogue, with execution evidence expanded for a selected entry on demand.
   No hand-maintained method roster is needed for discovery. Bounds and unresolved frontiers are visible.
4. A required LLM interpretation of purpose, probable actors, actions, journeys and relationships, using the
   source and the surrounding context. Each claim says **Inferred** and retains rationale, confidence,
   alternatives, limitations and dependencies. Exact input snapshots and model usage are recorded separately.
5. Independent semantic acceptance and a readiness receipt. Inventory coverage, schema validity and inferred
   confidence are distinct from a supported source proof.

The closed interpretation contract is [scan-interpretation.schema.json](../../../schema/scan-interpretation.schema.json).
The [interpretation skill reference](../../../.agents/skills/groundwork-schema/interpretation.md) explains the
required best-effort reasoning. A useful likely intent is expected even when intent cannot be established
absolutely. Genuine insufficient context is an explicit attempted outcome, not a reason to omit the phase.

## Run one authorised repository

```sh
npm run scan:pass -- org/repo /path/to/clones /path/to/NEW-output \
  --commit FULL_COMMIT --cache /path/to/cache --stop-after 1
npm run scan:pass -- org/repo /path/to/clones /path/to/NEW-output --resume
```

Create the parent output directory first. Stop is cooperative between bounded shards: use `--stop-after N`
or create an output `STOP` file. Remove that file only when resuming is authorised. A stop publishes no
repository aggregate. Committed task artefacts are immutable; abandoned attempts are ignored. Resume checks
scope, commit, policy, analysis fingerprints and all committed artefact hashes before new source work.
A mismatch requires a new output directory. An interruption before the initial prepared checkpoint also
requires a new output directory; this is not an arbitrary filesystem transaction recovery mechanism.

For the next revision, start another output with `--previous /path/to/old-output/repository.json`.
The planner preserves prior shard membership, refreshes changed files and appends new files. It records
added, modified, deleted and unambiguous same-blob renamed paths. Ambiguous renames remain delete/add.
Unchanged indexes and verified ancillary bytes are reused; the source inventory and affected facts are
still checked. A whole-repository delta differs from the older fixed-selection `scan:refresh` command.

```sh
npm run scan:entries -- /path/to/output/repository.json /path/to/clones /path/to/cache /path/to/NEW-catalogue
npm run scan:entry -- /path/to/catalogue ENTRY_ID /path/to/clones /path/to/cache /path/to/NEW-query
npm run scan:interpretation -- /path/to/interpretation.json /path/to/inputs.json --query
npm run scan:ready -- /path/to/readiness-input.json /path/to/NEW-verdict
```

The interpretation command validates authored LLM reasoning against its actual supplied input bytes; it
does not invoke a model. The scan and explore skills require the agent to perform that reasoning. Pending
interpretation remains pending. Unknown model usage is reported as unmetered, never copied from the
deterministic source phase's zero calls/tokens.

The readiness command verifies current source checkpoints, frozen benchmark/question rosters, regression
proofs, current catalogue/query checksums, actual bounded pages and the exact interpretation input snapshot.
It only assesses the evidence named in its manifest. It cannot authorise or start a wider scan. Binding
five interpretation attempts to the current catalogue metadata proves input provenance, not discovery
coverage. Do not present that check alone as complete repository or workspace discovery.

## Discovery completion

Keep tracked-source capture, five-area interpretation attempts, discovery coverage and source semantic
acceptance separate. Follow the [discovery coverage contract](../../../.agents/skills/groundwork-schema/interpretation.md#discovery-coverage).
The separate `scan-discovery/v1` assessment reconciles an independent frozen inventory of source runtime/app
candidates and entries/operations. Component counts and one generic purpose per repository are insufficient;
meaningful activities need local evidence, with shared/supporting behaviour, exclusions and unknowns visible.
Source declarations do not establish deployed activation. Independent review must challenge omissions and
groupings against the inventory, rather than accept a self-authored pass declaration.

For selective enrichment, reuse retained source/indexes and interpretation inputs. Inventory the missing
behaviour, request only its missing evidence slices and re-evaluate dependent claims and groupings. Added
candidates or changed discovery rules invalidate affected completeness conclusions even when parser inputs
are unchanged. Retain older receipts; unresolved material discovery remains partial. This process does not
require an automatic full native pass or imply a new CLI command.

## Limits and meaning

The default selected-source bound is 1 MiB per file. Every selected file in a shard is checked before that
shard accesses selected blobs, caches or parsers. A later shard can fail while earlier completed checkpoints
remain available; the failed pass publishes no aggregate. An explicit override up to 32 MiB is part of
analysis provenance. Ancillary resources
have separate bounds. Query selection is bounded to 2,048 records and 8 MiB of raw selected records; pages
contain at most four records and 64 KiB, and requests at most thirty-two IDs. Oversized or omitted records
and exhausted planner budgets remain incomplete results.

Native parser time/output limits, bounded shard sizes and page caps are enforced. This does not establish
arbitrary-repository heap limits, a TypeScript parser deadline or a bound for every cached syntax index.
Remote/deployed freshness requires an explicit observation beyond a local source reference check. Source
declarations cannot prove live authorisation, delivery guarantees or successful durable effects.

The independent [source review](source-review.md) describes the acceptance obligations and adversarial cases.
The current evidence and verification results are recorded in [validation.md](validation.md).
