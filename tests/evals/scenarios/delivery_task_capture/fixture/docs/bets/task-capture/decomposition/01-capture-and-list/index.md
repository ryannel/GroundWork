# Milestone 1: Capture & list

**Consumer:** A person at the terminal. They run `taskcli add` to capture a task
and `taskcli list` to see everything they have captured.

**Demonstrable goal:** A working capture-and-list loop through the real CLI — a
task added in one command shows up when the store is listed, persisted across
invocations in a real file.

**Sequencing rationale:** This is the bet's riskiest real path: the persisted
record shape. Everything later (completion in milestone 2, and every future bet)
builds on the store this milestone proves. Capture and list must be real before
completion can mean anything.

**Acceptance criteria (agreed front-door cases):**
- [ ] `taskcli add "Buy milk"` then `taskcli list` prints `[ ] #1 Buy milk`.
- [ ] Adding a second task and listing prints both, in insertion order, each on its own checkbox line.

## Proof of work

**Proves:** A person can capture a task and list it back through the real CLI,
against a real JSON file that survives between commands.

**How we prove it:** Drive the shipping front door end to end — invoke
`taskcli add "Buy milk"` as a subprocess, then `taskcli list` as a second
subprocess against the same store file, and assert the listing output contains
the checkbox line for the captured task. Because the two invocations are separate
processes sharing only the file, a pass proves real persistence, not in-memory
state.

**Test file:** `tests/bets/task-capture/test_milestone_1_capture_and_list.py` —
generated red at Delivery start; drives the CLI surface in `01-ui-design.md` over
the `TaskStore` interface in `technical-design/03-api-design.md` and the store
file in `04-data-design.md`.

## Slices

- [Slice 1.1: Store add & persist](./01-add-task.md)
- [Slice 1.2: CLI add & list](./02-list-tasks.md)
