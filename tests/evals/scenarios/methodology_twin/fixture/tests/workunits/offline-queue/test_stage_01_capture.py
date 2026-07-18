"""Stage 1: writes land in the local queue when offline."""

from capture_queue import CaptureQueue


def test_capture_appends_in_order(tmp_path):
    q = CaptureQueue(tmp_path / "q.json")
    assert q.capture({"sku": "A1", "count": 3}) == 1
    assert q.capture({"sku": "B2", "count": 7}) == 2
    assert [e["sku"] for e in q.entries()] == ["A1", "B2"]
