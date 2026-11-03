# Payment transaction source capture

The repository-local source pass is reviewed at `020d2fabb141b47b6d1e8173c02405795f71613a`.
This immutable capture supersedes the earlier bounded Transaction capture for source-local exploration.
The earlier selections remain available; the combined seven-repository selection has not yet changed.

- [Bundle](bundle.json) and [snapshot](snapshot.json): `e2ec8f901c7ba3b9fcf11455638ec14ae764a0f41c0551af91bf20efbbec3d1c`.
- 168 production Java files and 480 source method/lambda frames reconciled; 56,280 records.
- Independent pinned validation checked all 4,417 cited ranges. This verifies files and ranges, not every claim.
- Acceptance retained 185 entry/value/write queries, 37 representative method queries, 17 payload queries and 19 semantic checks.
- Fourteen create-route queries and one representative create method reach the node budget. They are partial query views, with supporting records paginated and smaller method/payload queries available.

Independent review checked the actual capture method against its caller-construction schema and field queries:
`attributes` comes from the capture payload; `psp`, `countryCode`, `pspTransactionId` and `accountId` come from
the stored transaction. The SDK result is ignored and the source returns the existing transaction. There is
no amount field in this construction. PSP and retry scheduler destinations retain configuration/constructor
evidence; imported SDK HTTP placement and deployed routing remain unresolved. Configuration libraries do
not become separate services merely because their implementations are imported.

[Source report](source-report.md), [handoff](HANDOFF.md), ledgers and query evidence distinguish completed
local source review from imported, generated, runtime, alias and scheduling limits. No source application
build/test, fetch, live endpoint, broker or store operation was performed. This is canonical scan data;
production workspace YAML and scan marks are unchanged.

## Follow-up source check

The two generically labelled Optional callback nodes are genuine conditional repository method references:
PaymentSessionRepository.findByPaymentSessionId and RefundRepository.findByRefundId. The pinned source
confirms these reads; they must not be removed as mapper operations. A small successor clarifies their
labels and adds classification assertions. Review must inspect the actual callback target, rather than
inferring I/O from a generic label or the wrapper expression alone.
