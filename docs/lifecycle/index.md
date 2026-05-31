# The GroundWork Lifecycle

GroundWork operates in two modes: a one-time **Setup** that establishes the project's foundations and ships the first bet, followed by an ongoing **Delivery Loop** of bets. A separate **Maintenance** layer keeps documentation aligned with code as the project evolves.

The lifecycle is documented across three files:

1. **[01. Greenfield Setup](./01-setup.md)** — The one-time, six-phase pipeline that takes a new project from idea to first shipped bet. Covers Product Brief, Design System, Architecture, Scaffolding, MVP Planning, and the handoff to the first Bet.

2. **[02. The Delivery Loop](./02-delivery-loop.md)** — The repeating five-phase Bet workflow (Discovery → Design Foundations → Decomposition → Delivery → Validation) that drives all feature work after the MVP ships.

3. **[03. Maintenance](./03-maintenance.md)** — How documentation stays current: the Living Documents protocol applied at every bet's Validation, the `groundwork-update` skill for surgical patches, and the `groundwork-check` drift detector for CI.

## The Operating Contract

All lifecycle phases share a single set of behavioral protocols defined in `operating-contract.md` and loaded by every methodology skill:

- **Discovery Notes** — capturing signals that belong to a different phase under a canonical 5-section header set, so they're available to the phase that needs them.
- **Living Documents** — surgical, permissionless updates to upstream `docs/` artifacts when any phase or bet reveals new information.
- **Phase Lifecycle** — the init/check/execute/commit/handoff sequence every phase follows.

Refer to the Operating Contract directly for protocol details. The lifecycle docs describe what each phase does and how phases connect; the contract describes the cross-phase behaviors that every phase shares.

## Project Modes

GroundWork currently implements the **Greenfield** path only. Brownfield initialisation (running GroundWork against an existing codebase) is on the roadmap — see `TODO.md`.
