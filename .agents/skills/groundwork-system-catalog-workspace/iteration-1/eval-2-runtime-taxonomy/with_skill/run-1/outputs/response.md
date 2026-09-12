# Normalized catalog proposal

## Classification dimensions
- **Component role:** business-service
- **Ownership:** internal
- **Outbound transport:** SDK for LaunchDarkly; HTTP for internal APIs and partner API; Redis client for persistence
- **Dependencies:** 1 platform capability, 2 internal services, 1 external provider
- **Data at rest:** Redis cache/keyspace with observed record boundary; fields unresolved

## Example normalized records
```json
{
  "repository": "n/a",
  "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
  "component": {
    "id": "example-service",
    "name": "Example Service",
    "system": "example-system",
    "ownership": "internal",
    "role": "business-service"
  },
  "relations": [
    {
      "direction": "outbound",
      "target": "launchdarkly",
      "role": "platform-service",
      "ownership": "external",
      "transport": "sdk",
      "operation": "Evaluate feature flags",
      "evidence": [{
        "path": "task input",
        "lines": "n/a",
        "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
        "claim": "Service uses LaunchDarkly for feature-flag evaluation"
      }]
    },
    {
      "direction": "outbound",
      "target": "internal-api-1",
      "role": "business-service",
      "ownership": "internal",
      "transport": "http",
      "operation": "Call internal API #1",
      "evidence": [{
        "path": "task input",
        "lines": "n/a",
        "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
        "claim": "Service calls one internal API"
      }]
    },
    {
      "direction": "outbound",
      "target": "internal-api-2",
      "role": "business-service",
      "ownership": "internal",
      "transport": "http",
      "operation": "Call internal API #2",
      "evidence": [{
        "path": "task input",
        "lines": "n/a",
        "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
        "claim": "Service calls a second internal API"
      }]
    },
    {
      "direction": "outbound",
      "target": "partner-payment-api",
      "role": "external-provider",
      "ownership": "external",
      "transport": "http",
      "operation": "Submit payment request",
      "evidence": [{
        "path": "task input",
        "lines": "n/a",
        "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
        "claim": "Service calls a partner payment API"
      }]
    }
  ],
  "resources": [
    {
      "id": "service-redis",
      "kind": "cache",
      "technology": "Redis",
      "access": ["read", "write"],
      "records": [
        {
          "id": "redis-records",
          "name": "observed Redis records",
          "kind": "record",
          "keyPattern": "unknown",
          "ttl": null,
          "fields": [],
          "evidence": [{
            "path": "task input",
            "lines": "n/a",
            "revision": "f410533d5d071ba31ce08c8746463946c4ebd226",
            "claim": "Service stores records in Redis"
          }]
        }
      ]
    }
  ],
  "apis": [],
  "messages": [],
  "gaps": [
    {
      "area": "component.identity",
      "reason": "No source files or catalog records were provided, so the service name and system id are unresolved."
    },
    {
      "area": "resources.service-redis.records.redis-records.fields",
      "reason": "Redis key pattern and serialized record schema were not provided."
    }
  ]
}
```
