# Captures and instance receivers

A source callback can read values from its enclosing scope without receiving them as formal arguments.
For example, Java `optional.orElseGet(() -> createTransaction(session, psp, payload))` has no callback
parameters. Its body captures `session`, `psp`, `payload` and potentially its receiver. Treating these as
formal parameters would misstate the source and break value exploration.

The current canonical schema retains this distinction:

- An implementation may declare `captures`, a list of values owned by that implementation, with
  `role: capture` and `definition` equal to the implementation entry operation.
- A bound call may carry `captureBindings`, each with `capture`, caller `value` and `mode`.
  Formal parameters still use the existing `parameters` and `bindings` fields.
- Capture bindings must cover the target's captures exactly once. Origins belong to the caller;
  captured values belong to the target. A capture cannot also be a formal parameter. Unresolved calls
  cannot establish capture bindings.

`mode` describes the variable binding. `value` copies the variable's value, which can itself be an object
reference; it does not copy the object. `reference` aliases a captured variable cell. `unresolved`
establishes neither. Java effectively-final local captures use `value`, including object references.
C# closure variables commonly use `reference`; evaluate the actual source construct rather than classifying
captures by primitive versus object type. Mutable object state, alias updates and reaching definitions still
require source analysis.

A value query follows the selected invocation's capture bindings back to its enclosing context. It composes
with ordinary actual-to-formal and return-to-result bindings. An unknown capture mode remains an explicit
`binding_unresolved` frontier. Querying a closure implementation alone cannot recover an enclosing invocation;
that also returns a frontier. Supporting records and dependency references include capture declarations and
bindings.

Capturing values does not establish when a callback runs. A source-proven conditional invocation needs its
own guarded control path and actual callback formals. A deferred completion handler, framework registration,
LINQ expression or imported `Bind` policy is not an eager ordinary call. Keep an association to its separate
implementation and a policy gap until invocation is established. The capture extension adds no generic
callback scheduler, automatic delegate dispatch, transaction guarantee or mutable alias analysis.

The regression suite in `tools/capture-bindings.test.ts` uses explicitly mutated test graphs. These graphs
are test inputs, not new claims about the source cited by the original Volvo fixtures. It checks zero-formal
capture bindings, call-context and return lineage, uncertain capture frontiers, reference closure, malformed
declarations and invalid invocation bindings. Archived snapshots remain unchanged.

## Instance receivers

An ordinary instance method also has an implicit receiver: the object on which it runs. This is neither a
formal parameter nor a lexical capture. `Implementation.receiver` may reference a value with `role: receiver`,
owned by that implementation and defined at its entry. `Operation.receiver` identifies the caller-owned
actual object. A bound instance target requires that actual receiver; a bound target declaring none rejects
one. An unresolved library call may retain its actual receiver without claiming an implementation target.

Receiver queries follow the selected call frame to its actual object. A root implementation queried alone
leaves its instance unknown. This supports source instance method references without inventing an extra
formal argument. Lambda access to an enclosing receiver remains a lexical capture. Neither binding form
establishes changes through mutable object aliases. `tools/receiver-bindings.test.ts` covers instance/formal
separation, call-context origins, supporting references and malformed or unresolved bindings.

## Local work that is not awaited

A call may state `waitsFor: return`, `await` or `none`. Omission preserves the earlier traversal behaviour.
A proven non-awaited local task uses `none`: the control projection shows possible work in its own call
context and a separate caller continuation. Child return or failure does not unwind into the caller's
continuation or catch handler. The query retains a `concurrency_unresolved` frontier: synchronous prefix,
scheduling and interleaving are not established. This is an in-process task, not a broker subscription.

A non-awaited result is a task or handle, distinct from the callee's eventual result. Value queries leave
that mapping unresolved rather than copying the eventual value into the handle. Source callbacks may return
a different completed task while ignoring a cache-write task; those values remain distinct. Native
`tools/local-task.test.ts` regressions cover the fork, fault isolation, recursive starts, conditional effects
and task-result boundary. Waiting metadata applies to call operations only.

## Source entry kinds

`Entry.trigger` distinguishes `rest`, `process`, `schedule`, `startup` and `callback`. Omission retains the
original REST rule. Explicit bindings use established source contracts with the following protocol/method
pairs and a matching source address:

| Trigger  | Protocol      | Method                 |
| -------- | ------------- | ---------------------- |
| rest     | http or https | Registered HTTP method |
| process  | process       | PROCESS                |
| schedule | timer         | SCHEDULE               |
| startup  | lifecycle     | STARTUP                |
| callback | callback      | CALLBACK               |

A Program or main entry therefore needs no invented HTTP interface. Source registration does not prove
that a process was deployed, a timer fired, a callback ran or framework activation order was established.
Message consumers still use subscriptions. `tools/source-entry.test.ts` checks native entry bindings and
retains the original strict HTTP requirements for REST entries.

## Finding source associations

Requesting a record with a `records` query now includes its owned claims, coverage and gaps
in the supporting closure. Traced operations also lead to these declarations through their owning implementation.
This makes callback, iterator, source mutation and framework registration associations discoverable without
knowing each claim ID in advance. Existing record budgets, pagination and snapshot pinning still apply.

Catalogue ownership is followed for explicitly requested IDs. Incidental source-revision provenance does
not load every declaration in that repository into an endpoint response. Method and entry associations
remain discoverable within execution support; catalogue exploration uses explicit record requests.
V3 continuation requests carry `associationOwners` so later record pages preserve the initial catalogue
selection. An omitted selection defaults to the initial `records.ids`; continuation IDs do not silently
become new catalogue roots. An empty selection requests no extra catalogue-owner expansion.

Related declarations in `records` are not assertions that their targets executed on the displayed control path.
The separate `claims` field retains its path-support rule. Agents can follow an association to its source-owned
implementation and query that body directly when automatic delegate or iterator-context dispatch is unavailable.
`tools/related-knowledge.test.ts` checks discovery, separation from control and bounded pagination without duplicates.

Non-executable declarations own their facts directly. Claims, coverage and gaps may belong to a source revision,
artefact, shape, resource, runtime component, interface contract, channel binding or subscription as well as an
entry or implementation. A type or OpenAPI declaration must not use an unrelated method as its catalogue anchor.
Operations, values and other executable records retain their strict implementation ownership. Metadata cannot
own declarations, and catalogue ownership does not establish execution or make a declaration path-proven.
