"""Stage 3: queued writes apply in order when signal returns."""

import pytest

pytestmark = pytest.mark.skip(reason="Stage 3 not reached — replay not implemented")


def test_replay_applies_in_order(tmp_path):
    raise NotImplementedError


def test_replay_keeps_entry_on_apply_failure(tmp_path):
    raise NotImplementedError
