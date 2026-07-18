"""Stage 2: the queue survives a restart (fresh instance, same store)."""

from capture_queue import CaptureQueue


def test_queue_survives_restart(tmp_path):
    store = tmp_path / "q.json"
    CaptureQueue(store).capture({"sku": "A1", "count": 3})
    assert CaptureQueue(store).entries() == [{"sku": "A1", "count": 3}]
