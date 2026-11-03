# Transaction source depth

This selection deepens refund and recurring charge at
`volvo-cars/cds-paymentservice-transaction@020d2fabb141b47b6d1e8173c02405795f71613a`, retaining the capture
entry and its refreshed queries. It contains 3,871 records and 663 pinned source ranges across 138 files.
[Report](report.json), [entry depth](entry-depth-ledger.json), [acceptance](acceptance.json) and
[revision mapping](revision-map.json) retain the detailed scope and superseded identities.

The local source saves a session before recurring-charge existence/customer/instrument validation. Its
403/404 outcomes can therefore follow a normal save. The later attempt can persist a transaction/session
link before PSP or scheduler failures. Scheduler failure can also prevent later publication. These are
conditional source paths, with native operations, value bindings, effects and failure-window claims;
they do not establish a shared transaction or observed production persistence.

Refund retains ordered validation loops before publication, partial-previous-refund checks and known 422
paths. Per-line private helper calls are represented by source predicates; complete helper/exception and
path-feasibility closure remains partial. A non-awaited producer future and its logging callback do not
establish broker persistence or consumer completion.

The review also corrected local shared-module authority, REST factory/ResponseEntity boundaries and the
unsupported HTTP/body claim at the unmatched capture SDK boundary. Local `PaymentSession`, `AttributeBase`,
`RecurringChargeState` and exception bases are retained as available source. History is prepended in memory;
charge has no later explicit session save in this source slice. Imported SDK transports and complete
wire/formatter behaviour remain gaps.

All eleven REST entries remain partial end to end. Eighteen saved requests cover capture, refund, charge,
value origins, outcomes, consistency and explicit source claims. All select the adjacent immutable snapshot.
The [capture explorer](../../views/capture/runtime/index.html) uses this selection.

```sh
npm run knowledge:validate -- docs/scan-trials/volvo-native-rescan/captures/payment-transaction-deep/bundle.json --snapshot docs/scan-trials/volvo-native-rescan/captures/payment-transaction-deep/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
```

No source repository, Volvo runtime or production workspace was changed.
