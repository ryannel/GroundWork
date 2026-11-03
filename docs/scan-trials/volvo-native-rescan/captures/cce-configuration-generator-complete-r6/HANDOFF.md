# CCE generator computed map key correction

This immutable r6 successor corrects one computed map key in River queue configuration. `river.QueueDefault` is an evaluated imported expression, not a fixed property name. The key remains unresolved; the actual QueueConfig operand and MaxWorkers construction are retained.

The correction changes four facts and adds six. Every other record is identical after the fresh r6 namespace translation. All 8,904 evidence tuples are unchanged and reuse the verified r5 evidence. No I/O, control, runtime component or write fact changed.

Native validation passed for 137,812 records. Exact r6 replay passed 941 standard queries, 314 source assertions with 34 targeted queries, and 41 independent strict queries. Limits remain explicit. The r5 capture remains preserved. See correction.json for exact record identities and source verification reuse.
