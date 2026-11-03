# Customer service messaging

Q17 and Q18 are supported by native source bindings and an independent bounded review.
The unchanged 22-question review now has **11 supported, 10 partial and 1 unsupported** answers.
Only `volvo-cars/cds-ecom-customer-service` at
`09623ab3a1f39845d8fc02abc3d591b53a3b5fea` was analysed. Other scans remain stopped.

- [Independent source review](source-review.md) fixes the Q17/Q18 clauses before evaluating extraction.
- [Question review](answerability-review.md) retains all 22 questions and their boundaries.
- [Machine-readable review](answerability.json) records results and evidence locations.
- [Pipeline guide](../../scan-pipeline.md) describes the reusable contracts and commands.

## What can be answered

Q17 distinguishes customer and analytics event selection. Both first test whether the previous customer is
null, then whether the updated customer has archival data, then take the update branch. Customer uses
CUSTOMER_CREATED, CUSTOMER_ARCHIVED and CUSTOMER_UPDATED. Analytics uses CREATED, DELETED and UPDATED,
with declared JSON names created, deleted and updated. An archived analytics customer therefore uses
DELETED; that name does not establish physical deletion.

Customer publication constructs its payload from the updated customer's ID, version and modified time,
into declared fields customerId, dataVersion and timestamp. Metadata.type comes from the selected enum.
Analytics maps the updated customer and selected fleet account into AnalyticsCustomer, including typed
nested individuals and corporate entities, then constructs AnalyticsEvent with its selected type.
Native calls, values, constructors and control relations connect source inputs through those helpers
to the payload, message and publication attempt.

Declared default topics are `app5541-customer-events` and `app5541-customer-analytics`. Typed settings
selectors join publisher arguments to the corresponding ConfigurationProperties prefixes and pinned
application YAML. The local profile disables both publishers. Producer declarations condition their
factories on the corresponding enabled property, construct typed KafkaTemplates and declare
JacksonJsonSerializer. Customer submission uses the external SDK's sendSafely; analytics uses
KafkaTemplate.send and attaches logging to the returned future.

Q18 starts at the deletion listener's String input and its declared topic, group and container factory.
Source defaults are `app5541-delete-customer-events` and `app5541-customer-integration-api`; the local
profile disables the consumer and declares a different group. The deserialiser's TypeReference names
Event<DeleteCustomerEventPayload>, whose payload declares customerId:String. Its returned event supplies
metadata correlation and the customer ID passed to CustomerService.deleteCustomer, then to the repository's
derived Mongo delete operation. The consumer contains no event-type discriminator or local catch.

A JacksonException in deserialisation is wrapped in CustomerServiceException with its original cause.
Synchronous failures prevent later statements or escape the listener along the retained source paths.
The factory declares reconnect settings and calls an imported base factory. Reconnect backoff does not
establish retry of failed business handling. The deletion path attempts active-customer deletion; it
contains no local archive deletion, audit write or postprocessing/publication call.

## Reusable contracts and limits

Three new record kinds bring the reusable Spring binding catalogue to seventeen. `configuration_binding`
retains exact property declarations, nominal record selectors, source factory candidates and declared
activation conditions. Pinned application YAML retains typed scalar values, placeholder expressions and
profile candidates. `consumer_binding` retains typed listener declarations, source factory candidates,
deserialisation type references and bounded listener and decoder bodies. Downstream operations remain in
the shared call/value graph for separate retrieval; each consumer record avoids copying a complete
application flow. `enum_binding` retains constants, compiler string literals for explicit Jackson
JsonProperty names and JsonValue method sources. Compiler-folded literal concatenations remain known
source literals; absent or unknown names remain null.

Display spelling alone cannot establish branch selection, payload lineage, nominal schema identity or
an exact call target. Native control and value relations remain part of the proof.

Source configuration is separate from effective configuration. No environment or SpEL expression is
evaluated, no active profile is selected, and no deployed override or Spring property precedence is inferred.
A source factory candidate does not establish runtime bean selection or listener activation. Imported SDK,
base factory and codec implementations, effective wire serialisation, acknowledgement, retries, redelivery,
broker delivery and durable Mongo completion remain unobserved. A successful-looking log is source code,
not evidence that its preceding effect completed.

## Evidence

Paths below are relative to the workspace root. Accepted artefacts are immutable; reproductions must use
a new output directory. The combined bounded review is accepted and complete.

| Artefact                               | Path                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Source capture                         | `reports/customer-service-messaging-005/repository.json`                                          |
| Canonical bindings and receipt         | `reports/customer-service-messaging-001/accepted-current/{document,receipt}.json`                 |
| Bounded review, pages and source audit | `reports/customer-service-messaging-001/accepted-review-current/{receipt,pages,source-pins}.json` |
| Independent native proofs and replays  | `reports/customer-service-messaging-001/independent-native-current/`                              |

| Measurement                             | Result                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| Original 22-question results            | 11 supported; ten partial; one unsupported                 |
| Bounded records, pages and bytes        | 41,904 records; 10,481 pages; 19,588,598 bytes             |
| Audited source anchors and files        | 10,549 anchors across 260 files                            |
| Destructive evidence mutations rejected | 182 of 182                                                 |
| Tracked files, Java indexes and shards  | 386 tracked files; 340 Java indexes; nine shards           |
| Git blob reads, parses and cache reuse  | Zero reads and parses; 340 index hits in each source phase |
| Source and binding timings              | 22.88 s source; 37.44 s bindings                           |
| Full repository checks and build        | `npm run check` and `npm run build` pass                   |

The full bounded review rejects all 182 destructive evidence mutations: the previous 152 and thirty new
messaging mutations. They challenge event selection, typed enum and payload identity, mapper and constructor
lineage, configuration joins, listener subscription, deserialisation and deletion propagation while
preserving earlier accepted proofs. A mutation counts only when the complete original question passes
and the mutation actually applies.

The first and warm source phases reuse all 340 Java indexes. The resource stage performs seven size
checks and reuses verified retained bytes for five YAML and two GraphQL resources, with zero Git blob
reads. The publication contains 25 enum, twelve configuration and two consumer bindings. These are
cache-reuse measurements, not cold-scan timings or a measured speedup against an earlier workflow.
Scripted extraction makes zero model calls; development and review agent consumption is separate.

Each consumer record fits the 65,536-byte page limit: deletion is 16,298 bytes (16,453 with its page
envelope), and order consumption is 50,719 bytes (50,874 with its envelope). The record-size proof is
`reports/customer-service-messaging-001/consumer-record-sizes-current.json`.

Seven earlier native proofs freshly replay from the source capture, and the archival default proof
rejects eight additional mutations. Their receipts are
`independent-native-current/accepted-native-replay.json` and
`independent-native-current/Q08-default-review.json` under the messaging trial output above.

Reproduce the combined bounded review into a new directory:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-messages-review.ts \
  reports/customer-service-messaging-001/accepted-current/document.json /path/to/clones /path/to/NEW-output
```

Replay the frozen seven-probe native roster and archival default proof separately:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-native-answerability-replay.ts \
  reports/customer-service-messaging-005/repository.json \
  reports/customer-service-events-001/independent-native \
  reports/customer-service-pipeline-001/answerability /path/to/NEW-native-output
```

Each request selects at most 32 IDs; each page returns at most four records and 65,536 bytes. The combined
review explicitly caps its total at 49,152 records and 32 MiB. The independent review reconstructs answers
from these bounded pages and audits source anchors against pinned local Git trees, blob hashes and line
bounds. Earlier accepted proofs replay against the new publication without lowering their denominator.

Local source and analysis freshness is recorded in
`reports/customer-service-messaging-001/freshness-current.json`; it reports unchanged analysis with no
rescan required. Remote and deployment currency remain unobserved. No application, dependency build or
broker is run in the source repository. This trial does not migrate the production workspace reader.

Changed-file lint, formatting, full repository checks and the production build pass.
Targeted native tests cover configuration selectors and conditions, enum literals, listener execution
and independent question proofs. Coverage is 96.13% statements, 86.36% branches, 97.44% functions
and 97.49% lines.
