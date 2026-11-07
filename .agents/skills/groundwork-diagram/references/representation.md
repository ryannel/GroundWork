# Author in the representation the app reads

Run commands from the Groundwork checkout. `<ws>` is the registered workspace ID; `<workspace>` is its
filesystem path. Read [system narratives](../../../../docs/system-narratives.md) for the production formats
and [the consolidated schema](../../groundwork-schema/SKILL.md) when repairing facts. For newer scan captures,
retain their evidence/interpretation contract; do not write invented production keys into immutable bundles.

| Meaning                                                         | Existing representation                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Runtime component, purpose, system membership                   | `system.yaml` and source-backed model records                                       |
| Calls, publishing, consumption, data use                        | Typed handlers, contracts, message consumers and store access                       |
| Cross-system reading order and key exchanges                    | Area `valueFlow.columns`, `bands`, `connections` and `overview` in `landscape.yaml` |
| Purpose labels for existing supporting exchanges                | `valueFlow.summaries` with `from`, `to`, `kind`, `label`, `evidence`                |
| System-local overview and optional highlights                   | `narratives.yaml` beside `system.yaml`                                              |
| Orphan decisions and batch coverage not supported by the schema | Separate run report with stable record references                                   |

`summaries` relabel existing directed exchanges: they neither create a missing edge nor promote it into
the core story. Cite every operation a summary covers. Match direction and kind; distinguish operations
with different purposes or conditions. Grouping must not discard evidence or convert source-declared
configuration into proof of actual execution.

For a system-local narrative, export its current packet:

```sh
node --import ./tools/register.ts --conditions=react-server tools/system-narrative.ts packet <ws> <system> > /tmp/system-packet.json
```

Use the packet's exact basis, current IDs and evidence. The first story explains the whole system;
later stories highlight subsets without replacing the overview. Cross-system value flows are authored
separately in the area; a system narrative does not automatically populate every area's value flow.

```sh
node --import ./tools/register.ts --conditions=react-server tools/system-narrative.ts check <ws> <system>
npm run workspace -- check <workspace>
```

The system-narrative check validates references and freshness, not meaning. Its conservative fingerprint
includes workspace flows. Review changed inputs before replacing the basis. Area value flows do not have
the same per-system fingerprint mechanism: record reviewed inputs and affected references in the run report
and recheck them on refresh. Do not imply automatic freshness enforcement where none exists.

Useful implementation boundaries when investigating rendering:

- `src/application/model-area.ts`: validates value-flow references and constructs the area view.
- `src/application/area-map/resources.ts`: global resource usage and private ownership.
- `src/application/area-map/value-flow-components.ts`: folding and component identities.
- `src/application/area-map/value-flow-connections.ts`: projected/rolled-up relationships.
- `src/application/area-map/value-flow-visibility.ts`: default supporting connections.
- `src/application/area-map/value-flow-layout.ts`: collapsed and expanded placement.

Fix evidence in data and general rendering defects in the renderer. Avoid company-specific names or
prose-matching heuristics in layout code. When the representation cannot preserve a required distinction,
report that limitation; evolve the shared contract within the authorised task rather than inventing keys.

An area may provide `valueFlow.overview`: a short array in the same shape as `connections`, selecting exact
existing core endpoints and kinds. An empty array means no cross-system backbone is appropriate. It controls the default cross-system backbone without deleting other
core or technical facts. Evidence must resolve, and each entry must reuse a core exchange. Keep labels
faithful to the selected work. Test default, selected and All connections states at reading size, not only
a whole-boundary miniature.

An area may provide `valueFlow.columns: [{system, column}]` to order collapsed systems from information
source to consumer. System IDs must belong to the area and occur once; columns are non-negative integers.
This is independent of `bands[].nodes[].column`, which orders components inside an expanded activity.
Omitted systems retain the existing fallback. For a fully reviewed area, account for every system's
placement and legitimate independent work. The renderer packs parallel contributions into available rows.

With an explicit overview, secondary cross-system exchanges stay outside the default supporting forest.
They remain available through selection, service expansion and All connections. Internal supporting links
still explain reachable components. If a meaningful business collaboration is missing from core, verify
the existing typed exchange and evidence before promoting it; an overview cannot manufacture that edge.
