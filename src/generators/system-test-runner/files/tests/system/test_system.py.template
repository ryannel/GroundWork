"""Real, discovery-driven system tests. Parametrized over every APP service
found in the workspace docker-compose.yml (see conftest.services_manifest).

FAIL LOUD: the span tests are gated by GROUNDWORK_REQUIRE_TRACES=1. When that
flag is set (CI, `./dev test integration`), an unreachable backend or a
missing span is a FAILURE, not a skip.
"""

import os
import time
import uuid

import httpx
import pytest

from conftest import JAEGER_URL, _base_url, _discover_services

REQUIRE_TRACES = os.environ.get("GROUNDWORK_REQUIRE_TRACES") == "1"
# BatchSpanProcessor flushes ~every 5s; give spans time to land.
EXPORT_TIMEOUT_S = 30

# Build params at import time so pytest can show one case per service. An empty
# workspace yields zero params (and the suite is a no-op, which is correct).
_SERVICES = _discover_services()
_PARAMS = [pytest.param(s, id=s["name"]) for s in _SERVICES]


def _fetch_trace(trace_id: str) -> dict | None:
    deadline = time.time() + EXPORT_TIMEOUT_S
    while time.time() < deadline:
        resp = httpx.get(f"{JAEGER_URL}/api/traces/{trace_id}", timeout=3.0)
        if resp.status_code == 200 and resp.json().get("data"):
            return resp.json()["data"][0]
        time.sleep(1)
    return None


@pytest.mark.parametrize("svc", _PARAMS)
def test_every_service_is_healthy(cluster, svc):
    """Each discovered service answers its health endpoint. Synchronous on
    purpose (like the trace probes below): a plain GET needs no event loop, and
    avoiding an async fixture keeps the suite robust across pytest-asyncio /
    Python versions."""
    if svc["host_port"] is None:
        pytest.skip(f"{svc['name']} has no published host port")
    url = f"{_base_url(svc)}{svc['health_path']}"
    resp = httpx.get(url, timeout=5.0)
    assert resp.status_code == 200, f"{url} -> {resp.status_code}"
    data = resp.json()
    if svc["type"] == "go":
        assert data.get("status") == "ok", f"{svc['name']} status: {data}"
        assert data.get("checks", {}).get("db") == "ok", f"{svc['name']} db: {data}"
    else:
        # Python FastAPI returns {"status": "alive"}; Next returns its own shape.
        assert data.get("status") in {"ok", "alive", "ready", "healthy"}, f"{svc['name']}: {data}"


@pytest.mark.parametrize("svc", _PARAMS)
def test_instrumented_get_exports_span(cluster, svc):
    """A traced GET to an instrumented route produces a span that reaches jaeger.

    Go and Python both export spans over OTLP: Go via otel.go, Python via the
    FastAPI instrumentation wired in adapters/telemetry.py. Next.js server-side
    tracing is unverified through this harness (no domain GET route to probe),
    so it xfails here.
    """
    if svc["type"] not in ("go", "python"):
        pytest.xfail(f"{svc['type']} trace export not verified through this harness (TODO)")
    if svc["host_port"] is None:
        pytest.skip(f"{svc['name']} has no published host port")

    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]
    # The trailing -01 (sampled) flag is load-bearing: ParentBased(AlwaysSample)
    # inherits it. -00 exports nothing.
    traceparent = f"00-{trace_id}-{span_id}-01"
    # /health is excluded from tracing by the otelhttp middleware; use a real
    # route. Default is per-service-type (Go /api/v1/entities, Python /examples);
    # TRACE_PROBE_PATH overrides for ad-hoc runs.
    probe = os.environ.get("TRACE_PROBE_PATH", svc["probe_path"])

    # Warm up: a just-booted service can serve liveness before its DB-backed routes
    # are ready (e.g. a schema migration is still settling), so the first requests
    # may transiently 5xx. Retry until the route is ready so this asserts span
    # export, not startup ordering (test_every_service_is_healthy covers liveness).
    resp = None
    for attempt in range(8):
        resp = httpx.get(
            f"{_base_url(svc)}{probe}",
            headers={"traceparent": traceparent},
            timeout=5.0,
        )
        if resp.status_code == 200:
            break
        time.sleep(2)
    assert resp.status_code == 200, f"probe failed after warmup retries: {resp.status_code}"

    trace = _fetch_trace(trace_id)
    if trace is None:
        msg = (
            f"no span with trace_id={trace_id} reached jaeger within "
            f"{EXPORT_TIMEOUT_S}s — the OTLP export pipeline is broken"
        )
        if REQUIRE_TRACES:
            pytest.fail(msg)
        pytest.skip(msg)

    services = {p["serviceName"] for p in trace["processes"].values()}
    assert svc["otel_name"] in services, (
        f"expected span from '{svc['otel_name']}', got {services}"
    )
    assert trace["spans"], "trace arrived but contains no spans"


@pytest.mark.parametrize("svc", _PARAMS)
def test_trace_context_propagates_unchanged(cluster, svc):
    """The service continues the incoming trace id rather than starting a new one."""
    if svc["type"] not in ("go", "python"):
        pytest.xfail(f"{svc['type']} trace export not verified through this harness (TODO)")
    if svc["host_port"] is None:
        pytest.skip(f"{svc['name']} has no published host port")

    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]
    traceparent = f"00-{trace_id}-{span_id}-01"
    probe = os.environ.get("TRACE_PROBE_PATH", svc["probe_path"])

    httpx.get(
        f"{_base_url(svc)}{probe}",
        headers={"traceparent": traceparent},
        timeout=5.0,
    )
    trace = _fetch_trace(trace_id)
    if trace is None:
        msg = "injected trace context was not propagated/exported"
        if REQUIRE_TRACES:
            pytest.fail(msg)
        pytest.skip(msg)
    # Compare numerically so leading-zero normalisation doesn't cause a false fail.
    assert int(trace["traceID"], 16) == int(trace_id, 16)


@pytest.mark.skip(reason="real CRUD lands in Phase 4")
@pytest.mark.asyncio
@pytest.mark.parametrize("svc", _PARAMS)
async def test_crud_round_trip(cluster, api_client: httpx.AsyncClient, svc):
    """POST then GET an entity and assert the round-trip through the real DB."""
    if svc["type"] != "go":
        pytest.skip("CRUD round-trip targets Go services for now")
    base = _base_url(svc)
    payload = {"name": "phase0-roundtrip"}
    created = await api_client.post(f"{base}/api/v1/entities", json=payload, timeout=5.0)
    assert created.status_code in (200, 201), created.text
    entity_id = created.json().get("id")
    assert entity_id, "POST did not return an id"
    fetched = await api_client.get(f"{base}/api/v1/entities/{entity_id}", timeout=5.0)
    assert fetched.status_code == 200
    assert fetched.json().get("name") == payload["name"]
