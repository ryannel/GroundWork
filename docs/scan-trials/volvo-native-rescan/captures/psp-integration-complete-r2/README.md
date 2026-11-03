# PSP Integration completed source capture

Selected snapshot `b70c8fd860424a42de9de948c21109efc6cee4e340ced841c0ec50d45d7586ac`.
Source `volvo-cars/cds-paymentservice-psp-integration` at `dabd6c825499b706ff4ddbf15eaf354adbfb6794`.

The capture has 31,278 records and 3,868 independently verified ranges. All 165 production Java files and
production configuration/support were inspected. It retains 511 source/declaration/callback frames, 20 REST
registrations and 20 process/startup/advice views. All 106 author query requests pass; four initial support
pages hit maxRecords and finish through saved continuations. No maxNodes limit occurs.

Twenty-three actual Stripe SDK call sites remain visible from actual REST roots as unresolved invocation
boundaries. Eight config/enrichment boundaries remain unresolved library calls. These placeholders do not
establish deployed services or default Stripe URLs. Every caller signature retains all positional actual
values and source shapes, without inventing callee formals, runtime argument-wrapper objects or wire bodies.
RequestOptions-returning helpers preserve their declared return type. Native return kinds retain source
void calls without results; Task handles and constructor allocation stay distinct.

Root independently read 14 pinned source files covering transaction routes, factory selection, payment-intent
operations, request options and capture/create/authorise/transfer/customer mapping. Four additional independent
queries verify capture's unknown invocation, both params/options values and both source shapes. Capture sets
metadata/latest_charge expansion without an amount, retrieves before the capture try/catch, and uses the
basic response mapper. The previously found Builder/Client inference defect is corrected.

See [handoff](HANDOFF.md), [report](REPORT.md), native return/type/signature audits and compressed query results.
Whole local source inspection does not claim imported transport/serialization policy, deployment, storage
behaviour or runtime/path-feasibility proof. Previous sealed inputs remain unchanged. No source application
build/test, fetch, live API/store/broker call or production workspace migration was performed.
