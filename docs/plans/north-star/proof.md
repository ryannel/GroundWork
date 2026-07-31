# Part 4: The Proof

The battery is the shipped set of checks behind one `verify` surface.

## Probes by topology

The capability manifest declares a topology profile: server, desktop, CLI, or mobile. Each profile names its universal probes. Server: compose boot, HTTP health, round trip, migration apply. Desktop: launch-to-window, relaunch-after-crash, UI-driver smoke. A capability with no runnable probe on its platform gets a fail-closed placeholder, never silence.

## Integrity over the checker's lifetime

- Universal checks run from the installed package, never the working tree. `verify` confirms the package hash against the lockfile.
- Project probes run at their sealed git revision. A probe diff re-opens the seal and re-runs the adversary. Probe *intent* is sealed at intent. Probe *code* is sealed at first green, because a probe cannot be deletion-tested before its capability exists.
- Deletion tests apply to probes and ratchet linters, not just product tests.

## The adversary

Fresh-context review with zero shared context with the author, at two altitudes doing two different jobs.

- **Per slice**: blind correctness review of the diff.
- **Per milestone sum**: the honesty audit plus edge-case judgment over the assembled diff. The audit carries the six-tell gaming catalog: faked dependencies, fixtures nothing produces, tests asserting test-only mirrors, and the three mechanized tells.

The split is evidence-based. Per-slice honesty auditing was measured and rejected for rubber-stamping. Per-slice correctness review was not, and stays. The measurements are in [evidence.md](evidence.md).

## The human's instruments

- **The drive artifact.** The acceptance seal requires evidence of a real drive of the product, recorded after the work's last commit. `verify` refuses the seal without it. This is what keeps one-click accept from being indistinguishable from ownership.
- **The waiver.** A sealed, dated override for a wrong check, rendered loudly on the Map. Wrong checks happen. Without a legitimate exit, the only escape is tampering.

## Also in the battery

Honesty scan, wiring scan, token scan, and mutate (the deletion test). Visual rows: render smoke, a11y, token conformance, plus the affordance-floor checklist for UI review. The one-page worker contract: unstaged handoff, parseable report, blocking-concern escalation, never mock what the proof names. Dispatch tiers follow the core context principle: frontier drives and reviews, execution workers build, tier explicit on every dispatch.
