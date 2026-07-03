# Slice 1.1 — taskcli: Store add & persist

**Owner service:** taskcli (the single local package)

**Complexity:** S

**Prerequisite:** none

## Scope

Implement the store's write path: `TaskStore.add(title)` assigns the next id,
appends a `Task` with `done=False`, and persists the whole array to the JSON
file; `TaskStore.all()` reads it back in insertion order. This is the persistence
foundation the whole bet rests on — the CLI slice (1.2) and all of milestone 2
build on the record shape this slice commits to.

**Required Capabilities:**
- `TaskStore.add("Buy milk")` on an empty store returns a `Task` with `id == 1`, `title == "Buy milk"`, `done == False`, and writes it to the store file.
- `TaskStore.all()` after two `add` calls returns both tasks in insertion order with ids 1 then 2.
- A new `TaskStore` opened on the same path sees the persisted tasks (survives across instances).

## Design

Implements the `TaskStore.add` and `all` interfaces in
`technical-design/03-api-design.md`, persisting the `Task` record defined in
`technical-design/04-data-design.md` to the JSON store file. Realizes the Add and
List data flows in `02-data-flows.md` at the store layer (no CLI yet).

## Proof of work

**Proves:** The store can capture a task and read it back, persisted to a real
file and durable across store instances.

**How we prove it:** Construct a `TaskStore` on a temp path, `add` two titles,
assert `all()` returns them in order with sequential ids; then construct a second
`TaskStore` on the same path and assert it reads the same two tasks — proving the
write hit the file, not just memory.

**Test file:** `tests/bets/task-capture/test_slice_1_taskcli_add_task.py` —
generated red at Delivery start; traces to the `add`/`all` interfaces in
`technical-design/03-api-design.md` and the store file in `04-data-design.md`.
