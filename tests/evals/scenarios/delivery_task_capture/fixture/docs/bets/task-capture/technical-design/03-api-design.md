# API Design — the `TaskStore` interface

The store is the bet's one internal interface. It lives at
`src/taskcli/store.py`. The CLI is the only caller.

## `TaskStore(path)`

Construct a store backed by the JSON file at `path` (default `.taskcli/tasks.json`).
A missing file is treated as an empty store; it is created on first write.

## `add(title: str) -> Task`

Append a new task. Assigns the next integer id (1, 2, 3, … — max existing id + 1,
starting at 1), `done=False`, then persists. Returns the created `Task`.

## `all() -> list[Task]`

Return every task in **insertion order** (ascending id). Never reorders. Returns
an empty list for an empty or missing store.

## `complete(task_id: int) -> Task` *(milestone 2)*

Set `done=True` on the task with `task_id`, persist, and return it. Raises
`KeyError` if no task has that id.

There are no other public methods in this bet. Edit and delete are out of scope
(pitch no-gos).
