"""taskcli — a tiny command-line task manager.

Delivery-sim fixture. At the sealed-bet baseline the public surface exists as
importable stubs so the red board fails for the feature's *absence*, never for
an import error. Delivery's slices fill these in to green.
"""

from .store import Task, TaskStore

__all__ = ["Task", "TaskStore"]
