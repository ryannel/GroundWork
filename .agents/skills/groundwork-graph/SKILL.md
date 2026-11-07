---
name: groundwork-graph
description: Map federated GraphQL schemas, subgraphs and operations, and plan graph changes in Groundwork's production workspace model.
---

# Map the graph

First run `npm run --silent workspace -- list --json` in the Groundwork checkout. Resolve the
workspace ID and folder from the registry. Start with `npm run map -- repos --workspace <id>` for
source pins and `map -- show <id>` for existing graph records.

Use `graphs/<graph>.yaml` for the graph, gateway, subgraphs and recorded composition. A subgraph
names its serving `component` when the source establishes it. Keep unresolved gateway configuration,
routing or ownership visible. Use `cites:` for pinned schema and router evidence.

- Put graph-type schemas and executable interfaces in the relevant system's `contracts.yaml`.
  Fields declare stable IDs. Record keys, ownership, requirements, provisions and overrides from
  the schema and the composition rules that actually apply.
- Give operations `gql:` IDs. The operation's `document` is a persisted `ev:` record containing
  the document. Record the invoking component only when the call site establishes it. Keep a
  screen link separate from the code that invokes the operation.
- Keep calls, reads, writes and failures in handler steps. Cite code and configuration for cache
  behaviour. A cache directive is a policy declaration. An actual cache lookup or authorisation
  boundary needs its own evidence.
- Let the shared graph query derive the fields an operation may reach. Possible composition does
  not establish the router's actual execution order, live deployment or effective policy.

A plan changes the graph with operations on the current IDs. Put changes to fields, subgraphs,
operations and handler steps in the change that owns them. Keep current facts in the model, and
cite proposed behaviour as proposed. Use the [native schema](../groundwork-schema/SKILL.md)
for exact fields and run `npm run workspace -- check <folder>`. Read a representative operation
in the app and compare its declared reach and gaps with the pinned source.
