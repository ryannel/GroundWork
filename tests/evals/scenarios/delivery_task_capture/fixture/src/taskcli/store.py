"""The task store — persistence and mutation.

At the sealed baseline every method is an unimplemented stub. Delivery's store
slices (1.1, and the completion slice in milestone 2) implement them against the
data design in ``technical-design/04-data-design.md``.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Task:
    """One task record. Shape is fixed by ``technical-design/04-data-design.md``."""

    id: int
    title: str
    done: bool = False


class TaskStore:
    """A file-backed list of tasks.

    ``path`` is the JSON file the tasks persist to. The store is deliberately
    tiny: insertion-ordered, integer ids assigned sequentially from 1.
    """

    def __init__(self, path):
        self.path = path

    def add(self, title: str) -> Task:
        """Create a task with the next id and persist it. Slice 1.1."""
        raise NotImplementedError("slice 1.1 — add(title)")

    def all(self) -> list[Task]:
        """Return every task in insertion order. Slice 1.1."""
        raise NotImplementedError("slice 1.1 — all()")

    def complete(self, task_id: int) -> Task:
        """Mark the task done and persist it. Milestone 2, slice 2.1."""
        raise NotImplementedError("slice 2.1 — complete(id)")
