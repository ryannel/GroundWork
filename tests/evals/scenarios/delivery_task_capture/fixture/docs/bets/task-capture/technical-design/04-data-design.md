# Data Design — the `Task` record and the store file

## The `Task` record

One task is a record of exactly three fields:

| Field | Type | Notes |
|---|---|---|
| `id` | int | Sequential from 1, assigned by the store, immutable. |
| `title` | str | The captured text, verbatim. Non-empty. |
| `done` | bool | `False` at capture; flipped to `True` by `complete` (milestone 2). |

Modelled as `taskcli.store.Task` (a dataclass). No other fields — no timestamps,
no tags — in this bet.

## The store file

Tasks persist to a single JSON file (default `.taskcli/tasks.json`): a JSON array
of task objects in insertion order.

```json
[
  { "id": 1, "title": "Buy milk", "done": false },
  { "id": 2, "title": "Ship the bet", "done": true }
]
```

The parent directory is created on first write. The whole array is rewritten on
every mutation (read-modify-write). A missing file reads as `[]`.
