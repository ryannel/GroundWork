"""Shared harness config for the scaffold suites.

The one job here is sandbox isolation under `pytest-xdist`. Every scaffold suite
keeps a module-level sandbox constant and a session fixture that `rmtree`s it
before yielding. That is correct serially and catastrophic in parallel: xdist
runs the session fixture once PER WORKER, so worker gw3 deletes the tree gw0 is
mid-scaffold in, and the failure surfaces as an unrelated missing-file error
somewhere else entirely.

`sandbox_root()` keys the root on the worker id, so each worker gets its own
tree and the existing fixtures keep working untouched. Serial runs are
unaffected — no worker id means the original path.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()


def sandbox_root(*parts: str) -> Path:
    """A scaffold sandbox path, isolated per xdist worker.

    Read from the environment rather than the `worker_id` fixture because these
    paths are module-level constants evaluated at import time, long before any
    fixture runs. xdist sets PYTEST_XDIST_WORKER in each worker process before
    collection, so it is available exactly when needed.
    """
    worker = os.environ.get("PYTEST_XDIST_WORKER", "")
    root = REPO_ROOT / ".sandboxes" / "scaffolds"
    if worker:
        root = root / f"_{worker}"
    return root.joinpath(*parts)

