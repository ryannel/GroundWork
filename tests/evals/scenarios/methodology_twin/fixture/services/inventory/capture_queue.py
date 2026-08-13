"""Offline capture queue: durable-ordered writes for dead-zone warehouses."""

import json
from pathlib import Path


class CaptureQueue:
    def __init__(self, store: Path):
        self.store = store
        self.store.parent.mkdir(parents=True, exist_ok=True)

    def capture(self, entry: dict) -> int:
        entries = self.entries()
        entries.append(entry)
        self.store.write_text(json.dumps(entries))
        return len(entries)

    def entries(self) -> list:
        if not self.store.exists():
            return []
        return json.loads(self.store.read_text())

    def replay(self, apply):
        """Apply queued entries in order; drop each only after apply succeeds."""
        raise NotImplementedError("stage 3")

    def pending_count(self) -> int:
        raise NotImplementedError("stage 4")
