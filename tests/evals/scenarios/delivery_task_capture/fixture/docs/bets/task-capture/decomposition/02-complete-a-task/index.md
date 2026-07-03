# Milestone 2: Complete a task

**Consumer:** The same person at the terminal. Having captured tasks, they mark
one done and see its state reflected when they list.

**Demonstrable goal:** `taskcli done <id>` flips a task to complete, and `list`
shows it with a checked box — the capture-list-complete loop closed through the
real CLI.

**Sequencing rationale:** Builds directly on milestone 1's store and list. It is
second because completion is meaningless until capture and list are real; it
reuses the exact record shape and list format milestone 1 committed to.

**Acceptance criteria (agreed front-door cases):**
- [ ] `taskcli done 1` then `taskcli list` shows `[x] #1` for that task while other tasks stay `[ ]`.
- [ ] `taskcli list --pending` shows only the tasks that are still open.

## Proof of work

**Proves:** A person can complete a captured task and see the completion when
listing, through the real CLI against the real store file.

**How we prove it:** Drive the front door end to end — `taskcli add` a task,
`taskcli done` its id, then `taskcli list` in a fresh process, and assert the
task's line now carries the checked box `[x]`. Real processes over the real file
prove the completion persisted.

**Test file:** `tests/bets/task-capture/test_milestone_2_complete_a_task.py` —
generated red when Delivery opens this milestone; drives the CLI surface in
`01-ui-design.md` over the `TaskStore.complete` interface in
`technical-design/03-api-design.md`.

## Slices

> *Slices authored on arrival.*
