# Canonical model fixture

These are handwritten, synthetic contract examples. Names, code spans and evidence records are test data,
not assertions about a company or a scan. Missing ownership, job timing and field types deliberately remain
unknown. References to missing entities remain available for the model reader's gap checks in PR 4.

The folder follows design §4: workspace identity, aliases, both glossaries, a domain target, system identity
and components, contracts, screens, handlers, narratives, a graph, a flow, a journey, a programme and a plan.
The plan modifies nested steps, a failure, a field and a region, and adds, deprecates and removes entities.

The handler exercises reads, writes, calls, publishing, waiting and returns; guards, alternatives, loops,
parallel lanes, transactions, retry exhaustion and try/catch/finally; conditions, asynchronous work and
causes. Leaf effects and failures cite evidence. The contracts exercise REST, GraphQL, gRPC and SDK entries,
a retained free-text signature, subscriptions, all schedule forms, operations and every field-type tag.

Each of the 22 evidence families has a handwritten record beside one repository commit pin. Sources refer
to file records rather than repeating paths or commit pins. The differing language examples exercise
family contracts; they do not describe one real repository. Unexamined and unresolved answers remain
explicit. `invalid/` contains rejected authored files, an overlay that copies base facts, a retired alias
without a reason and evidence with a legacy id and repeated pin.

`src/infrastructure/model-schema.test.ts` checks these through direct Ajv predicates and the same schema
boundary used for file loading. It compares complete error-path lists, tests every evidence family's id
boundary and rejects duplicate sibling steps across branch, lane and retry arrays. Semantic reference
resolution, placement and derivation belong to the core-model work in PR 4.
