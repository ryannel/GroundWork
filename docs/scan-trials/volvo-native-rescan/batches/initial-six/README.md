# Initial six-repository selection

**Historical baseline:** later source review found HTTP wrappers represented as inner DTOs in the payment
captures. Replacement selections correct those facts. This baseline remains replayable for comparison;
structural validation and its saved query checks did not establish source fidelity.

This immutable baseline combines six reviewed captures before the deeper transaction/Manage and Segment
passes and scheduler capture. It contains 9,959 records after removing 602 identical canonical record
duplicates shared by the two soft-offer captures. Conflicting IDs fail reconciliation. Similar component,
route or package names are never sufficient to join records or resolve an imported client.

`inputs.json` records each source selection and bundle digest. Original per-repository selections remain
available under `../../captures/`; this merged bundle is a separate publication. All 71 saved request fixtures
from those selections replay against this snapshot and remain within their node/support budgets. See
`query-replay.json`. This is represented-graph regression evidence, not complete endpoint discovery,
path-feasibility checking or a production performance budget.

The generic validator checked the selection and all 3,556 pinned source ranges locally. Source range checks
establish available files and valid bounds, not citation entailment, artefact correspondence or deployment.
The represented entries retain partial coverage and frontiers. No Volvo API, store or broker was called.

```sh
npm run knowledge:validate -- docs/scan-trials/volvo-native-rescan/batches/initial-six/bundle.json --snapshot docs/scan-trials/volvo-native-rescan/batches/initial-six/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
```
