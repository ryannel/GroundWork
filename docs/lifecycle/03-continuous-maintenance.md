# 03. Continuous Maintenance

Maintenance in GroundWork is not a distinct "phase" that happens at the end of a project. It happens continuously. Documentation is a first-class citizen: every time we touch code, we think about the documentation.

## 1. Drift Detection (`groundwork-check`)
To trust the documentation, the system must provably know when it is out of date.
- **Source of Truth Mapping:** Every extracted component, API, and schema in the documentation declares its underlying file paths using a `source_of_truth` property.
- **Git Timestamp Comparison:** The `groundwork-check` skill runs in CI. It compares the `last_reviewed` date in the document against the Git modification timestamp of the files listed in `source_of_truth`.
- **Staleness Flagging:** If the code has been updated more recently than the doc's `last_reviewed` date, the documentation is mathematically stale and flagged.

## 2. Targeted Updates (`groundwork-update`)
Re-running full extraction pipelines after every minor code change is inefficient.
- **Surgical Updates:** The `groundwork-update` skill performs lightweight, in-place modifications to specific documents.
- When code ships, it updates *only* the affected `architecture.md` or `events.md` files based on the specific diff, avoiding the need to re-scan the whole repository.
