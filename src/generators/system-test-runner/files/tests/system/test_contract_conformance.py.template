"""Contract conformance: the served API vs the promoted design spec.

For each discovered APP service (see conftest.services_manifest) with a
canonical promoted spec at docs/architecture/api/<service>/openapi.yaml, fetch the spec the
RUNNING service serves (Huma on Go and FastAPI both expose /openapi.json) and
structurally compare paths + methods + response codes.

Drift taxonomy:
  BREAKING — surface present in the design spec but missing from the served
             spec (a path, method, or response code the design promises and
             the implementation does not deliver). Fails the test.
  ADDITIVE — surface the service serves that the design spec does not declare.
             Reported as a warning: no consumer breaks, but the canonical spec
             is stale and should be re-promoted (see the bet validation phase).

Skips cleanly when no design spec is committed for a service, or the service
does not expose a machine-readable spec.
"""

import re
import warnings

import httpx
import pytest
import yaml

from conftest import WORKSPACE_ROOT, _base_url, _discover_services

DESIGN_SPEC_ROOT = WORKSPACE_ROOT / "docs" / "api"
# Huma serves both; FastAPI serves /openapi.json. Try JSON first.
SERVED_SPEC_PATHS = ("/openapi.json", "/openapi.yaml")
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}

# Build params at import time so pytest shows one case per service.
_SERVICES = _discover_services()
_PARAMS = [pytest.param(s, id=s["name"]) for s in _SERVICES]


def _normalize_path(path: str) -> str:
    """Collapse path-parameter names so /users/{id} == /users/{userId}.

    Parameter naming is a spec-authoring choice, not an API surface change —
    comparing it would report false breaking drift.
    """
    return re.sub(r"\{[^}]*\}", "{}", path)


def _surface(spec: dict) -> dict[tuple[str, str], set[str]]:
    """Flatten an OpenAPI document to {(path, method): {response codes}}."""
    surface: dict[tuple[str, str], set[str]] = {}
    for raw_path, item in (spec.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        for method, op in item.items():
            if method.lower() not in HTTP_METHODS or not isinstance(op, dict):
                continue
            codes = {str(c) for c in (op.get("responses") or {})}
            surface[(_normalize_path(raw_path), method.lower())] = codes
    return surface


def _load_design_spec(service_name: str) -> dict | None:
    spec_path = DESIGN_SPEC_ROOT / service_name / "openapi.yaml"
    if not spec_path.exists():
        return None
    return yaml.safe_load(spec_path.read_text()) or {}


def _fetch_served_spec(svc: dict) -> dict | None:
    for path in SERVED_SPEC_PATHS:
        try:
            resp = httpx.get(f"{_base_url(svc)}{path}", timeout=5.0)
        except httpx.HTTPError:
            continue
        if resp.status_code != 200:
            continue
        if path.endswith(".json"):
            return resp.json()
        return yaml.safe_load(resp.text)
    return None


def _diff(design: dict, served: dict) -> tuple[list[str], list[str]]:
    """Compare flattened surfaces. Returns (breaking, additive) drift lines."""
    breaking: list[str] = []
    additive: list[str] = []
    for (path, method), designed_codes in design.items():
        label = f"{method.upper()} {path}"
        served_codes = served.get((path, method))
        if served_codes is None:
            breaking.append(f"{label} — designed but not served")
            continue
        missing = designed_codes - served_codes
        if missing:
            breaking.append(
                f"{label} — designed response codes not served: {sorted(missing)}"
            )
        extra = served_codes - designed_codes
        if extra:
            additive.append(f"{label} — served response codes not in design: {sorted(extra)}")
    for path, method in sorted(served.keys() - design.keys()):
        additive.append(f"{method.upper()} {path} — served but not in design spec")
    return breaking, additive


@pytest.mark.parametrize("svc", _PARAMS)
def test_served_api_conforms_to_design_spec(cluster, svc):
    """The running service implements at least the surface its promoted spec declares."""
    design_doc = _load_design_spec(svc["name"])
    if design_doc is None:
        pytest.skip(
            f"no promoted design spec at docs/architecture/api/{svc['name']}/openapi.yaml — "
            "promote one in bet validation to bring this service under contract test"
        )
    if svc["host_port"] is None:
        pytest.skip(f"{svc['name']} has no published host port")

    served_doc = _fetch_served_spec(svc)
    if served_doc is None:
        pytest.skip(f"{svc['name']} does not expose a served spec at {SERVED_SPEC_PATHS}")

    design = _surface(design_doc)
    if not design:
        pytest.skip(f"design spec for {svc['name']} declares no paths — nothing to conform to")
    served = _surface(served_doc)

    breaking, additive = _diff(design, served)

    if additive:
        warnings.warn(
            f"ADDITIVE drift for {svc['name']} — the served API exceeds "
            f"docs/architecture/api/{svc['name']}/openapi.yaml; re-promote the spec:\n  "
            + "\n  ".join(additive)
        )

    assert not breaking, (
        f"BREAKING drift for {svc['name']} — the design spec at "
        f"docs/architecture/api/{svc['name']}/openapi.yaml promises surface the running "
        "service does not deliver:\n  " + "\n  ".join(breaking)
    )
