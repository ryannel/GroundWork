# Queue access in the canonical model

Status: implemented after the user's instruction to apply common sense and best-practice corrections while preserving existing facts. The queue-specific rule preserves the recorded read/write facts and retains strict evidence checks; Volvo data remains unchanged.

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

PR6 makes the matching schema/type correction and enforces the queue-form restriction in semantic
validation. The focused tests retain record access in the index and flow and reject streams and missing
topics. Existing thresholds, citation requirements and frozen baselines remain in force.

## Focused reproduction

Run from the Groundwork code checkout:

```sh
node --import ./tools/register.ts --conditions=react-server \
  artifacts/rebuild/verification/pr6/queue-compatibility.mjs /Users/RNEL/Workspace/volvo-groundwork
```

The script reads all authored system, contract and handler files. It identifies legacy queue ids, finds every
schema and read/write reference to them, and checks minimal probes against the frozen PR5 schema and the current shared Ajv loader.
The probes use a synthetic child id and citation home solely to isolate the prefix restriction; they do not
claim to be migrated records or resolved citations.

Result in `verification/pr6/queue-compatibility.json`: all 13 original probes validate; all 13 rewritten probes
fail **only** the `/store`, `/from` or `/to` target pattern. The report includes hashes for the six affected
source files and the unchanged workspace schema. This proves the conflict without changing data or relaxing a rule.

The original report remains frozen. `queue-compatibility-current.json` records the same 13 prefix failures
against PR5 commit `2048a2ce45388d54b087b2bca7e869b158704525` and verifies that all 13 rewritten probes
validate under the corrected current schema. Queue-versus-stream semantics are proved separately by
`src/infrastructure/model-queue-access.test.ts`.
