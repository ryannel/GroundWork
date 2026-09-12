#!/usr/bin/env python3
"""Validate normalized Groundwork system-catalog discovery output."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_TOP_LEVEL = {"repository", "revision", "component", "relations", "apis", "resources", "messages", "gaps"}
ROLES = {"business-service", "platform-service", "external-provider"}
OWNERSHIP = {"internal", "external"}
DIRECTIONS = {"inbound", "outbound"}
RESOURCE_KINDS = {"database", "cache", "object-storage", "local-storage", "queue"}
RECORD_KINDS = {"document", "record", "keyspace", "message"}


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_evidence(items: object, location: str, errors: list[str]) -> None:
    require(isinstance(items, list), f"{location} must be an array", errors)
    if not isinstance(items, list):
        return
    for index, evidence in enumerate(items):
        item = f"{location}[{index}]"
        require(isinstance(evidence, dict), f"{item} must be an object", errors)
        if not isinstance(evidence, dict):
            continue
        for key in ("path", "claim", "revision"):
            require(isinstance(evidence.get(key), str) and bool(evidence[key].strip()), f"{item}.{key} is required", errors)


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        return [f"Cannot read JSON: {error}"]

    require(isinstance(data, dict), "Output must be a JSON object", errors)
    if not isinstance(data, dict):
        return errors
    missing = REQUIRED_TOP_LEVEL - data.keys()
    require(not missing, f"Missing top-level fields: {', '.join(sorted(missing))}", errors)
    require(isinstance(data.get("revision"), str) and len(data.get("revision", "")) >= 7, "revision must be a commit SHA", errors)

    component = data.get("component")
    require(isinstance(component, dict), "component must be an object", errors)
    if isinstance(component, dict):
        require(component.get("ownership") in OWNERSHIP, "component.ownership must be internal or external", errors)
        require(component.get("role") in ROLES, "component.role is invalid", errors)

    for index, relation in enumerate(data.get("relations", [])):
        location = f"relations[{index}]"
        require(isinstance(relation, dict), f"{location} must be an object", errors)
        if not isinstance(relation, dict):
            continue
        require(relation.get("direction") in DIRECTIONS, f"{location}.direction is invalid", errors)
        require(relation.get("role") in ROLES, f"{location}.role is invalid", errors)
        require(relation.get("ownership") in OWNERSHIP, f"{location}.ownership is invalid", errors)
        validate_evidence(relation.get("evidence"), f"{location}.evidence", errors)

    for index, resource in enumerate(data.get("resources", [])):
        location = f"resources[{index}]"
        require(isinstance(resource, dict), f"{location} must be an object", errors)
        if not isinstance(resource, dict):
            continue
        require(resource.get("kind") in RESOURCE_KINDS, f"{location}.kind is invalid", errors)
        for record_index, record in enumerate(resource.get("records", [])):
            record_location = f"{location}.records[{record_index}]"
            require(record.get("kind") in RECORD_KINDS, f"{record_location}.kind is invalid", errors)
            validate_evidence(record.get("evidence"), f"{record_location}.evidence", errors)

    for index, message in enumerate(data.get("messages", [])):
        location = f"messages[{index}]"
        require(message.get("direction") in DIRECTIONS, f"{location}.direction is invalid", errors)
        validate_evidence(message.get("evidence"), f"{location}.evidence", errors)

    require(isinstance(data.get("gaps"), list), "gaps must be an array", errors)
    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_output.py <discovery.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    errors = validate(path)
    if errors:
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"Valid discovery output: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
