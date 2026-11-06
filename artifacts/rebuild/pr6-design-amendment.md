# Queue access in the canonical model

Status: proposed; awaiting the user's approval. No specification, application code or Volvo data has changed.

PR5 is merged as [#69](https://github.com/ryannel/GroundWork/pull/69), merge
`2048a2ce45388d54b087b2bca7e869b158704525`. PR6 starts from that commit in its own worktree.
Volvo is registered as `volvo-cars`, name **Volvo Cars**, folder `/Users/RNEL/Workspace/volvo-groundwork`,
at commit `723085497ded5b51d3c23fdcb5f6b1c778aa3efa` with a clean working tree.

## Observed conflict

PR6 item 1 requires the 125 legacy topics and queues to receive `top:` ids. The two queues below have
four explicitly queue-backed schemas and nine explicit handler effects: one read and eight writes.
Neither has a declared message contract in any of the workspace's authored `contracts.yaml` files.

| Existing fact                                                                | Workspace file and line                                                                                                  |     Count |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------: |
| River queue on PostgreSQL, legacy `type: queue` and detail `kind: queue`     | `domains/commercial-backbone/systems/car-configuration-engine/system.yaml:429`; `contracts.yaml:1459` in the same system |   1 queue |
| River job records stored in that queue                                       | Same system's `contracts.yaml:5264`, `:5288`, `:5461`                                                                    | 3 schemas |
| Writes of those job records                                                  | Same system's `handlers.yaml:5520`, `:5577`, `:5711`, `:5768`, `:5811`                                                   |  5 writes |
| Azure Storage Queue `dam-upload-retry`, also `type: queue` and `kind: queue` | `domains/shopping/systems/media-site/system.yaml:47`; `contracts.yaml:100` in the same system                            |   1 queue |
| Upload-job payload explicitly stored in that queue                           | Same system's `contracts.yaml:1157`                                                                                      |  1 schema |
| Read and writes of that payload                                              | Same system's `handlers.yaml:4041` (read), `:3989`, `:4123`, `:4245` (writes)                                            | 4 effects |

The record sources point to the pinned River job types (`internal/database/queuedb/models.go:9–47`)
and Azure queue implementation (`apps/media/src/api/queue/damUploadQueue.ts:19–48`). The evidence report
retains each case's nearest available source citations (including inherited sources), enclosing handler and exact YAML pointer.

Design §4.4 permits `read`/`write` only against a store. The schema enforces `st:` at
`schema/workspace.schema.json:1283` (`Schema.store`), `:2507` (`Step.from`) and `:2514` (`Step.to`).
The mandatory `top:` rewrite therefore conflicts with the target schema. Changing those facts into
message publication/subscription would require an additional semantic decision; the existing data does not
declare corresponding `msg:` contracts. Keeping the two ids as `st:` would contradict the specified prefix rewrite.

## Proposed amendment to docs/rebuild/design.md

Add after the field-type rules in §4.2:

> A schema's `store` may name a `st:` component or a `top:` component whose form is `queue` when the cited
> code stores records or job payloads there. This records the observed queue access without asserting a
> message contract. A stream cannot be a record store.

Replace the effect rule in §4.4 with:

> At most one of `read`+`from`, `write`+`to` (the store or queue is always named), `call` (`api:` or `gql:`),
> `publish` (`msg:`), `wait` (a duration or words), `return` (a status or words). `from` and `to` may name
> a `st:` component or a `top:` component whose form is `queue`; a stream is not a read/write target.
> None means computation.

Add after the step table in §4.4:

> Preserve cited record access to queues as read/write effects. Derive access edges from those effects.
> Do not infer publication, a subscription, a message contract or asynchronous causation from queue access.
> Declared message publication and subscriptions retain their existing forms.

Record the reason and the measured counts in the design's review-change ledger (§12).

If approved, PR6 will make the matching schema/type changes and enforce the queue-form restriction in
semantic validation. Focused tests will prove that queue-backed records and access effects validate and
remain in the index and entry flow, while stream targets and missing targets fail. All existing thresholds,
citation requirements and frozen baselines remain in force.

## Focused reproduction

Run from the Groundwork code checkout:

```sh
node --import ./tools/register.ts --conditions=react-server \
  artifacts/rebuild/verification/pr6/queue-compatibility.mjs /Users/RNEL/Workspace/volvo-groundwork
```

The script reads all authored system, contract and handler files. It identifies legacy queue ids, finds every
schema and read/write reference to them, and checks minimal probes against the existing shared Ajv loader.
The probes use a synthetic child id and citation home solely to isolate the prefix restriction; they do not
claim to be migrated records or resolved citations.

Result in `verification/pr6/queue-compatibility.json`: all 13 original probes validate; all 13 rewritten probes
fail **only** the `/store`, `/from` or `/to` target pattern. The report includes hashes for the six affected
source files and the unchanged workspace schema. This proves the conflict without changing data or relaxing a rule.

PR6 implementation is paused at the user-required specification amendment gate. No expensive application
checks were rerun: this preflight changes only review artefacts, and PR5's verified inputs remain unchanged.
