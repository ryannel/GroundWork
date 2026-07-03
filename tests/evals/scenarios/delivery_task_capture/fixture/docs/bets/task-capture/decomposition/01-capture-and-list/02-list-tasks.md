# Slice 1.2 — taskcli: CLI add & list

**Owner service:** taskcli (the single local package)

**Complexity:** S

**Prerequisite:** Slice 1.1 merged

## Scope

Wire the `add` and `list` commands in `src/taskcli/cli.py` onto the store proven
in slice 1.1. `add "<title>"` calls `TaskStore.add` and prints the confirmation;
`list` calls `TaskStore.all()` and prints one checkbox line per task. This closes
milestone 1's front-door loop: a real person driving the real CLI.

**Required Capabilities:**
- `taskcli add "Buy milk"` (as a subprocess) exits 0 and prints `Added #1: Buy milk`.
- `taskcli list` after that add prints exactly `[ ] #1 Buy milk`.
- `list` on an empty store prints nothing and exits 0.

## Design

Implements the `add` and `list` commands of the CLI surface in
`technical-design/01-ui-design.md`, dispatching over the `TaskStore` interface in
`03-api-design.md`. Realizes the Add and List data flows in `02-data-flows.md`
end to end (front door to file). The checkbox line format (`[ ] #<id> <title>`)
is the one fixed in `01-ui-design.md`.

## Proof of work

**Proves:** A person can capture and list a task through the real CLI front door.

**How we prove it:** Invoke `taskcli add "Buy milk"` as a subprocess against a
temp store, assert the confirmation line; invoke `taskcli list` as a separate
subprocess against the same store and assert the output is the checkbox line for
the task. Separate processes sharing the file prove the front door and the
persistence together.

**Test file:** `tests/bets/task-capture/test_slice_1_taskcli_list_tasks.py` —
generated red at Delivery start; traces to the CLI surface in `01-ui-design.md`
and the `TaskStore` interface in `03-api-design.md`.
