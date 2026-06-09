# The GroundWork Lifecycle

GroundWork operates in two modes: a one-time **Setup** that establishes the project's foundations and ships the first bet, followed by an ongoing **Delivery Loop** of bets. A separate **Maintenance** layer keeps documentation aligned with code as the project evolves.

The lifecycle is documented across three files:

1. **[01. Setup](./01-setup.md)** — The one-time pipeline that takes a project from idea (greenfield) or existing codebase (brownfield) to its first bet. Covers both paths: greenfield's facilitated discovery through Product Brief, Design System, Architecture, Scaffolding, and MVP Planning; and brownfield's Scan and extract phases through Infra Adoption.

2. **[02. The Delivery Loop](./02-delivery-loop.md)** — The repeating five-phase Bet workflow (Discovery → Design Foundations → Decomposition → Delivery → Validation) that drives all feature work after the MVP ships.

3. **[03. Maintenance](./03-maintenance.md)** — How documentation stays current: the Living Documents protocol applied at every bet's Validation, the `groundwork-update` skill for surgical patches, and the `groundwork-check` drift detector for CI.

## The Operating Contract

All lifecycle phases share a single set of behavioral protocols defined in `operating-contract.md` and loaded by every methodology skill:

- **Discovery Notes** — capturing signals that belong to a different phase under a canonical 5-section header set, so they're available to the phase that needs them.
- **Living Documents** — surgical, permissionless updates to upstream `docs/` artifacts when any phase or bet reveals new information.
- **Phase Lifecycle** — the init/check/execute/commit/handoff sequence every phase follows.

Refer to the Operating Contract directly for protocol details. The lifecycle docs describe what each phase does and how phases connect; the contract describes the cross-phase behaviors that every phase shares.

## Project Modes

Setup adapts to what it finds. **Greenfield** (an empty repository) builds the canonical documents through facilitated discovery, then scaffolds the designed system with generators. **Brownfield** (an existing codebase) reverse-engineers the same documents from the code itself and additively bolts on the operational layer without regenerating the app. Both paths converge to the same end-state and enter the same Delivery Loop. The orchestrator detects the mode from the filesystem and routes accordingly.
