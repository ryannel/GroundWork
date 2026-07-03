"""The command-line front door.

At the sealed baseline the parser exists but the command handlers are stubs.
Delivery's CLI slices wire them onto :class:`~taskcli.store.TaskStore`.

Surface (see ``technical-design/01-ui-design.md``):

    taskcli add "<title>"   ->  Added #<id>: <title>
    taskcli list            ->  one line per task, checkbox-prefixed
    taskcli done <id>       ->  Completed #<id>            (milestone 2)
"""

from __future__ import annotations

import sys

from .store import TaskStore

DEFAULT_DB = ".taskcli/tasks.json"


def main(argv=None) -> int:
    """Dispatch a single command. Returns a process exit code."""
    raise NotImplementedError("slice 1.2 — CLI dispatch (add, list); slice 2.1 — done")


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))
