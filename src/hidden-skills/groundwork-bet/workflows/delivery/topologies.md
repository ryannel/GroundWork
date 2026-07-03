# Delivery: cross-service topologies

Loaded only when the bet spans more than one repository — the monorepo path the delivery spine assumes needs no delta.

## Recording a cross-service slice, by repository topology

A slice can span more than one service; how it commits depends on the project's repository layout. The scaffold produces a **monorepo**, the path the rest of this workflow assumes; the other two are supported with the deltas below.

| Topology | Unit of record | Key rule |
|---|---|---|
| **Monorepo** *(scaffold default)* | One atomic commit spanning the service directories — the slice itself (`step-02-slice-loop.md`, §3). Consumer client and producer contract land in the same commit. | A backwards-incompatible change slices as expand → migrate → contract, never one mega-commit. |
| **Submodules** *(each service a superrepo submodule)* | A **gitlink-bump commit in the superrepo**, referencing the child SHAs. | Each touched submodule is edited on a real branch — never detached HEAD — and pushed before the bump; bootstrap must run `submodule update --init`. Prefer the monorepo unless already committed. |
| **Polyrepo** *(each service its own repository)* | A **change-set id** recorded as a manifest binding the N commits in the bet's home repo. | Gate integration on producer-before-consumer ordering or a contract check (Pact, `buf breaking`) — there is no shared green build. Reach for it only when services must ship separately. |
